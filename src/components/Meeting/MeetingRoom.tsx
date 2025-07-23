import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { 
  Video, VideoOff, Mic, MicOff, Monitor, MonitorOff, 
  MessageSquare, Users, Hand, PhoneOff, Settings,
  Copy, Send, MoreVertical, X, UserCheck
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { WebRTCManager } from '../../lib/webrtc';
import { VideoGrid } from './VideoGrid';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

interface ChatMessage {
  id: string;
  sender_id: string | null;
  sender_name: string;
  content: string;
  created_at: string;
}

interface Participant {
  id: string;
  name: string;
  user_id?: string;
  joined_at: string;
}

export function MeetingRoom() {
  const { meetingCode } = useParams<{ meetingCode: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Meeting state
  const [meeting, setMeeting] = useState<any>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isHost, setIsHost] = useState(false);
  const [participantName, setParticipantName] = useState('');
  const [participantId] = useState(uuidv4());
  
  // UI state
  const [activeTab, setActiveTab] = useState<'chat' | 'participants'>('chat');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Media state
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [handRaisedParticipants, setHandRaisedParticipants] = useState<Set<string>>(new Set());
  const [participantCount, setParticipantCount] = useState(1);
  const [localAudioLevel, setLocalAudioLevel] = useState(0);

  // WebRTC
  const [webrtcManager, setWebrtcManager] = useState<WebRTCManager | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, { 
    stream: MediaStream; 
    name: string; 
    audioEnabled?: boolean; 
    videoEnabled?: boolean;
    isScreenSharing?: boolean;
    audioLevel?: number;
  }>>(new Map());

  // Refs
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const realtimeChannelsRef = useRef<any[]>([]);

  useEffect(() => {
    if (meetingCode) {
      initializeMeeting();
    }
    return () => {
      cleanup();
    };
  }, [meetingCode]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const cleanup = () => {
    console.log('Cleaning up meeting room...');
    
    // Clean up WebRTC
    if (webrtcManager) {
      webrtcManager.leaveMeeting();
    }
    
    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach(track => {
        track.stop();
        console.log('Stopped track:', track.kind);
      });
    }
    
    // Unsubscribe from all realtime channels
    realtimeChannelsRef.current.forEach(channel => {
      if (channel && typeof channel.unsubscribe === 'function') {
        channel.unsubscribe();
      }
    });
    realtimeChannelsRef.current = [];
  };

  const initializeMeeting = async () => {
    try {
      console.log('Initializing meeting with code:', meetingCode);
      
      // Get participant name from location state or prompt
      const name = location.state?.participantName || 
                   location.state?.hostName || 
                   prompt('Enter your name:') || 
                   'Guest';
      
      setParticipantName(name);
      const hostStatus = location.state?.isHost || false;
      setIsHost(hostStatus);

      console.log('Participant name:', name, 'Is host:', hostStatus);

      // Fetch meeting details
      const { data: meetingData, error: meetingError } = await supabase
        .from('meetings')
        .select('*')
        .eq('access_code', meetingCode?.toUpperCase())
        .single();

      if (meetingError) {
        console.error('Meeting fetch error:', meetingError);
        toast.error('Meeting not found');
        navigate('/');
        return;
      }
      
      console.log('Meeting data:', meetingData);
      setMeeting(meetingData);

      // Add participant to database (auto-admitted, no waiting room)
      const { error: participantError } = await supabase
        .from('participants')
        .insert({
          meeting_id: meetingData.id,
          name: name,
          user_id: null,
          admitted: true, // Everyone is auto-admitted
        });

      if (participantError) {
        console.error('Error adding participant:', participantError);
      }

      // Proceed directly to meeting
      await proceedToMeeting(meetingData, name);
      
    } catch (error: any) {
      console.error('Error initializing meeting:', error);
      toast.error('Failed to join meeting');
      navigate('/');
    }
  };

  const proceedToMeeting = async (meetingData: any, name: string) => {
    try {
      console.log('Proceeding to meeting...');
      
      // Initialize WebRTC
      const manager = new WebRTCManager(meetingData.id, participantId, name);
      setWebrtcManager(manager);

      // Setup WebRTC callbacks
      manager.onStream((peerId, stream, participantName, audioEnabled, videoEnabled) => {
        console.log('🎥 Received stream from:', participantName, 'Stream tracks:', stream.getTracks().length);
        setRemoteStreams(prev => {
          const newMap = new Map(prev);
          newMap.set(peerId, { 
            stream, 
            name: participantName, 
            audioEnabled, 
            videoEnabled,
            isScreenSharing: false,
            audioLevel: 0
          });
          console.log('Updated remote streams count:', newMap.size);
          return newMap;
        });
      });

      manager.onPeerLeft((peerId) => {
        console.log('👋 Peer left:', peerId);
        setRemoteStreams(prev => {
          const newMap = new Map(prev);
          newMap.delete(peerId);
          return newMap;
        });
        setHandRaisedParticipants(prev => {
          const newSet = new Set(prev);
          newSet.delete(peerId);
          return newSet;
        });
      });

      manager.onHandRaised((participantId, name, raised) => {
        setHandRaisedParticipants(prev => {
          const newSet = new Set(prev);
          if (raised) {
            newSet.add(participantId);
            toast.success(`${name} raised their hand`);
          } else {
            newSet.delete(participantId);
          }
          return newSet;
        });
      });

      // Setup participant count tracking
      manager.onParticipantCount((count) => {
        console.log('👥 Participant count updated:', count);
        setParticipantCount(count);
      });

      // Setup media state tracking
      manager.onMediaStateChanged((peerId, audioEnabled, videoEnabled) => {
        console.log('🎛️ Media state changed for', peerId, 'Audio:', audioEnabled, 'Video:', videoEnabled);
        
        // Update remote streams with media state
        setRemoteStreams(prev => {
          const newMap = new Map(prev);
          const existing = newMap.get(peerId);
          if (existing) {
            newMap.set(peerId, {
              ...existing,
              audioEnabled,
              videoEnabled
            });
          }
          return newMap;
        });
      });

      // Initialize media with better constraints
      console.log('🎬 Initializing media...');
      const stream = await manager.initializeMedia(!isCameraOff, !isMuted);
      setLocalStream(stream);
      console.log('✅ Local stream initialized with tracks:', stream.getTracks().map(t => t.kind));

      // Setup local audio monitoring
      setupLocalAudioMonitoring(stream);

      // Join the meeting
      console.log('🚀 Joining meeting...');
      await manager.joinMeeting();

      // Start real-time updates
      startRealtimeUpdates(meetingData.id);
      
      setIsLoading(false);
      toast.success('Joined meeting successfully!');
      
    } catch (error: any) {
      console.error('Error proceeding to meeting:', error);
      toast.error('Failed to join meeting: ' + error.message);
      navigate('/');
    }
  };

  const setupLocalAudioMonitoring = (stream: MediaStream) => {
    if (!stream.getAudioTracks().length) return;
    
    try {
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const updateAudioLevel = () => {
        if (!isMuted) {
          analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          const normalizedLevel = Math.min(average / 128, 1);
          setLocalAudioLevel(normalizedLevel);
        } else {
          setLocalAudioLevel(0);
        }
        requestAnimationFrame(updateAudioLevel);
      };

      updateAudioLevel();
    } catch (error) {
      console.error('Audio monitoring setup failed:', error);
    }
  };

  const startRealtimeUpdates = (meetingId: string) => {
    console.log('🔄 Starting real-time updates for meeting:', meetingId);
    
    // Fetch initial data
    fetchChatMessages(meetingId);
    fetchParticipants(meetingId);

    // Set up real-time chat subscription
    const chatChannel = supabase
      .channel(`chat-${meetingId}`)
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages',
          filter: `meeting_id=eq.${meetingId}`
        }, 
        (payload) => {
          console.log('💬 New message received:', payload.new);
          setChatMessages(prev => [...prev, payload.new as ChatMessage]);
        }
      )
      .subscribe();

    // Set up real-time participants subscription
    const participantsChannel = supabase
      .channel(`participants-${meetingId}`)
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'participants',
          filter: `meeting_id=eq.${meetingId}`
        },
        (payload) => {
          console.log('👤 New participant joined:', payload.new);
          setParticipants(prev => [...prev, payload.new as Participant]);
        }
      )
      .on('postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'participants',
          filter: `meeting_id=eq.${meetingId}`
        },
        (payload) => {
          console.log('👤 Participant updated:', payload.new);
          setParticipants(prev => 
            prev.map(p => p.id === payload.new.id ? payload.new as Participant : p)
          );
        }
      )
      .on('postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'participants',
          filter: `meeting_id=eq.${meetingId}`
        },
        (payload) => {
          console.log('👤 Participant left:', payload.old);
          setParticipants(prev => prev.filter(p => p.id !== payload.old.id));
        }
      )
      .subscribe();

    // Store channels for cleanup
    realtimeChannelsRef.current = [chatChannel, participantsChannel];
  };

  const fetchChatMessages = async (meetingId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setChatMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const fetchParticipants = async (meetingId: string) => {
    try {
      const { data, error } = await supabase
        .from('participants')
        .select('*')
        .eq('meeting_id', meetingId)
        .is('left_at', null)
        .order('joined_at', { ascending: true });

      if (error) throw error;
      setParticipants(data || []);
    } catch (error) {
      console.error('Error fetching participants:', error);
    }
  };

  const toggleMute = async () => {
    if (webrtcManager) {
      const newMutedState = !isMuted;
      await webrtcManager.toggleAudio(!newMutedState);
      setIsMuted(newMutedState);
      toast.success(newMutedState ? 'Microphone muted' : 'Microphone unmuted');
    }
  };

  const toggleCamera = async () => {
    if (webrtcManager) {
      const newCameraState = !isCameraOff;
      await webrtcManager.toggleVideo(!newCameraState);
      setIsCameraOff(newCameraState);
      console.log('Camera toggled:', newCameraState ? 'OFF' : 'ON');
      toast.success(newCameraState ? 'Camera turned off' : 'Camera turned on');
    }
  };

  const toggleScreenShare = async () => {
    if (!webrtcManager) return;

    try {
      if (isScreenSharing) {
        // Stop screen sharing and return to camera
        const stream = await webrtcManager.initializeMedia(!isCameraOff, !isMuted);
        setLocalStream(stream);
        setIsScreenSharing(false);
        toast.success('Screen sharing stopped');
      } else {
        // Start screen sharing
        const screenStream = await webrtcManager.startScreenShare();
        setLocalStream(screenStream);
        setIsScreenSharing(true);
        toast.success('Screen sharing started');
        
        // Listen for screen share end
        const videoTrack = screenStream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.onended = async () => {
            setIsScreenSharing(false);
            const stream = await webrtcManager.initializeMedia(!isCameraOff, !isMuted);
            setLocalStream(stream);
            toast.info('Screen sharing ended');
          };
        }
      }
    } catch (error) {
      console.error('Error toggling screen share:', error);
      toast.error('Failed to toggle screen sharing');
    }
  };

  const toggleHandRaise = async () => {
    if (!webrtcManager) return;

    const newHandRaisedState = !handRaised;
    setHandRaised(newHandRaisedState);
    await webrtcManager.raiseHand(newHandRaisedState);
    toast.success(newHandRaisedState ? 'Hand raised' : 'Hand lowered');
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !meeting?.id) return;

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          meeting_id: meeting.id,
          sender_id: null,
          sender_name: participantName,
          content: newMessage.trim(),
        });

      if (error) throw error;
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  const leaveMeeting = async () => {
    try {
      // Update participant as left
      if (meeting?.id) {
        await supabase
          .from('participants')
          .update({ left_at: new Date().toISOString() })
          .eq('meeting_id', meeting.id)
          .eq('name', participantName);
      }

      cleanup();
      toast.success('Left meeting');
      navigate('/');
    } catch (error) {
      console.error('Error leaving meeting:', error);
      navigate('/');
    }
  };

  const copyMeetingLink = () => {
    const meetingLink = `${window.location.origin}/join/${meetingCode}`;
    navigator.clipboard.writeText(meetingLink);
    toast.success('Meeting link copied to clipboard!');
  };

  if (isLoading) {
    return (
      <div className="h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-lg">Joining meeting...</p>
          <p className="text-sm opacity-75 mt-2">Setting up video and audio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-900 flex">
      {/* Main video area */}
      <div className="flex-1 relative">
        {/* Video Grid */}
        <VideoGrid
          localStream={localStream || undefined}
          remoteStreams={remoteStreams}
          localParticipantName={participantName}
          localParticipantId={participantId}
          isMuted={isMuted}
          isCameraOff={isCameraOff}
          isScreenSharing={isScreenSharing}
          handRaisedParticipants={handRaisedParticipants}
          localHandRaised={handRaised}
          participantCount={participantCount}
          localAudioLevel={localAudioLevel}
        />
        
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/50 to-transparent p-6 z-10">
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-semibold">{meeting?.title}</h1>
              {isHost && (
                <span className="text-xs bg-blue-500/80 px-2 py-1 rounded-full font-medium flex items-center gap-1">
                  <UserCheck className="w-3 h-3" />
                  Host
                </span>
              )}
              <span className="text-sm opacity-75">
                {format(new Date(), 'HH:mm')}
              </span>
              <span className="text-sm bg-white/20 px-3 py-1 rounded-full font-medium">
                {participantCount} participant{participantCount !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={copyMeetingLink}
                className="px-3 py-1 bg-white/20 rounded-lg hover:bg-white/30 transition-all text-sm flex items-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Copy Link
              </button>
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-all lg:hidden"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Bottom controls */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 sm:p-6 z-10">
          <div className="flex items-center justify-center space-x-1 sm:space-x-3 max-w-full overflow-x-auto">
            <button
              onClick={toggleMute}
              className={`p-2 sm:p-4 rounded-full transition-all transform hover:scale-105 flex-shrink-0 ${
                isMuted 
                  ? 'bg-red-500 hover:bg-red-600' 
                  : 'bg-white/20 hover:bg-white/30'
              }`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? (
                <MicOff className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
              ) : (
                <Mic className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
              )}
            </button>

            <button
              onClick={toggleCamera}
              className={`p-2 sm:p-4 rounded-full transition-all transform hover:scale-105 flex-shrink-0 ${
                isCameraOff 
                  ? 'bg-red-500 hover:bg-red-600' 
                  : 'bg-white/20 hover:bg-white/30'
              }`}
              title={isCameraOff ? 'Turn on camera' : 'Turn off camera'}
            >
              {isCameraOff ? (
                <VideoOff className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
              ) : (
                <Video className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
              )}
            </button>

            <button
              onClick={toggleScreenShare}
              className={`p-2 sm:p-4 rounded-full transition-all transform hover:scale-105 flex-shrink-0 hidden sm:flex ${
                isScreenSharing 
                  ? 'bg-blue-500 hover:bg-blue-600' 
                  : 'bg-white/20 hover:bg-white/30'
              }`}
              title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
            >
              {isScreenSharing ? (
                <MonitorOff className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
              ) : (
                <Monitor className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
              )}
            </button>

            <button
              onClick={toggleHandRaise}
              className={`p-2 sm:p-4 rounded-full transition-all transform hover:scale-105 flex-shrink-0 ${
                handRaised 
                  ? 'bg-yellow-500 hover:bg-yellow-600' 
                  : 'bg-white/20 hover:bg-white/30'
              }`}
              title={handRaised ? 'Lower hand' : 'Raise hand'}
            >
              <Hand className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
            </button>

            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 sm:p-4 rounded-full bg-white/20 hover:bg-white/30 transition-all transform hover:scale-105 flex-shrink-0 lg:hidden"
              title="Toggle chat"
            >
              <MessageSquare className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
            </button>

            <button
              onClick={leaveMeeting}
              className="p-2 sm:p-4 rounded-full bg-red-500 hover:bg-red-600 transition-all transform hover:scale-105 flex-shrink-0"
              title="Leave meeting"
            >
              <PhoneOff className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
            </button>
          </div>
          
          {/* Mobile screen share button */}
          <div className="flex justify-center mt-2 sm:hidden">
            <button
              onClick={toggleScreenShare}
              className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${
                isScreenSharing 
                  ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                  : 'bg-white/20 hover:bg-white/30 text-white'
              }`}
              title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
            >
              {isScreenSharing ? 'Stop Share' : 'Share Screen'}
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className={`w-full sm:w-80 bg-white border-l border-gray-200 flex flex-col transition-all duration-300 ${
        sidebarOpen ? 'translate-x-0' : 'translate-x-full'
      } lg:translate-x-0 fixed lg:relative top-0 right-0 h-full z-20 lg:z-auto`}>
        {/* Sidebar header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4 lg:hidden">
            <h3 className="text-lg font-semibold text-gray-900">Meeting Info</h3>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex space-x-1">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === 'chat'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <MessageSquare className="w-4 h-4 inline mr-2" />
              Chat
            </button>
            <button
              onClick={() => setActiveTab('participants')}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === 'participants'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Users className="w-4 h-4 inline mr-2" />
              People ({participantCount})
            </button>
          </div>
        </div>

        {/* Sidebar content */}
        <div className="flex-1 flex flex-col">
          {activeTab === 'chat' ? (
            <>
              {/* Chat messages */}
              <div 
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-4"
              >
                {chatMessages.map((message) => (
                  <div key={message.id} className="flex flex-col space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-900">
                        {message.sender_name}
                      </span>
                      <span className="text-xs text-gray-500">
                        {format(new Date(message.created_at), 'HH:mm')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">
                      {message.content}
                    </p>
                  </div>
                ))}
                {chatMessages.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No messages yet</p>
                    <p className="text-xs">Start the conversation!</p>
                  </div>
                )}
              </div>

              {/* Chat input */}
              <div className="p-4 border-t border-gray-200">
                <form onSubmit={sendMessage} className="flex space-x-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            /* Participants list */
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-3">
                {participants.map((participant) => (
                  <div key={participant.id} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-medium text-sm">
                        {participant.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium text-gray-900">
                          {participant.name}
                          {participant.name === participantName && ' (You)'}
                          {participant.name === meeting?.host_name && ' (Host)'}
                        </p>
                        {handRaisedParticipants.has(participant.id) && (
                          <Hand className="w-4 h-4 text-yellow-500" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        Joined {format(new Date(participant.joined_at), 'HH:mm')}
                      </p>
                    </div>
                  </div>
                ))}
                {participants.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No participants yet</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}