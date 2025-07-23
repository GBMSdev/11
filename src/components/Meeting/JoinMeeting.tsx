import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Video, VideoOff, Mic, MicOff, Settings, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface Meeting {
  id: string;
  title: string;
  host_name: string;
  is_private: boolean;
  access_code: string;
}

export function JoinMeeting() {
  const { meetingCode } = useParams<{ meetingCode: string }>();
  const navigate = useNavigate();
  
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);

  useEffect(() => {
    if (meetingCode) {
      fetchMeeting();
    }
  }, [meetingCode]);

  const fetchMeeting = async () => {
    if (!meetingCode) return;

    try {
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('access_code', meetingCode.toUpperCase())
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          toast.error('Meeting not found');
          navigate('/');
          return;
        }
        throw error;
      }

      setMeeting(data);
    } catch (error: any) {
      console.error('Error fetching meeting:', error);
      toast.error('Failed to load meeting details');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinMeeting = async () => {
    if (!meeting || joining) return;

    if (!guestName.trim()) {
      toast.error('Please enter your name to join the meeting');
      return;
    }

    setJoining(true);
    try {
      // Record participant
      const { error } = await supabase
        .from('participants')
        .insert({
          user_id: null,
          meeting_id: meeting.id,
          name: guestName.trim(),
          joined_at: new Date().toISOString(),
        });

      if (error) throw error;

      // Navigate to meeting room
      navigate(`/meeting/${meeting.access_code}`, {
        state: {
          meetingTitle: meeting.title,
          isHost: false,
          participantName: guestName.trim(),
          videoEnabled,
          audioEnabled,
        }
      });
    } catch (error: any) {
      console.error('Error joining meeting:', error);
      toast.error('Failed to join meeting');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Meeting Not Found</h1>
          <p className="text-gray-600 mb-8">The meeting you're looking for doesn't exist or has ended.</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left side - Meeting info and controls */}
          <div className="space-y-8">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                {meeting.title}
              </h1>
              <p className="text-gray-600">
                Meeting ID: <span className="font-mono font-semibold">{meeting.access_code}</span>
              </p>
              {meeting.is_private && (
                <div className="inline-flex items-center px-3 py-1 bg-yellow-100 text-yellow-800 text-sm rounded-full mt-2">
                  Private Meeting
                </div>
              )}
            </div>

            {/* Guest name input */}
            <div>
              <label htmlFor="guestName" className="block text-sm font-medium text-gray-700 mb-2">
                Your Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  id="guestName"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 sm:py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base"
                  placeholder="Enter your name"
                />
              </div>
            </div>

            {/* Media controls */}
            <div className="space-y-4">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">Ready to join?</h3>
              <div className="flex items-center space-x-3 sm:space-x-4">
                <button
                  onClick={() => setVideoEnabled(!videoEnabled)}
                  className={`p-3 sm:p-4 rounded-xl transition-all ${
                    videoEnabled
                      ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      : 'bg-red-100 text-red-700 hover:bg-red-200'
                  }`}
                >
                  {videoEnabled ? <Video className="w-5 h-5 sm:w-6 sm:h-6" /> : <VideoOff className="w-5 h-5 sm:w-6 sm:h-6" />}
                </button>
                <button
                  onClick={() => setAudioEnabled(!audioEnabled)}
                  className={`p-3 sm:p-4 rounded-xl transition-all ${
                    audioEnabled
                      ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      : 'bg-red-100 text-red-700 hover:bg-red-200'
                  }`}
                >
                  {audioEnabled ? <Mic className="w-5 h-5 sm:w-6 sm:h-6" /> : <MicOff className="w-5 h-5 sm:w-6 sm:h-6" />}
                </button>
                <button className="p-3 sm:p-4 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all">
                  <Settings className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>
              <div className="text-sm text-gray-600">
                <p>Camera: {videoEnabled ? 'On' : 'Off'}</p>
                <p>Microphone: {audioEnabled ? 'On' : 'Off'}</p>
              </div>
            </div>

            {/* Join button */}
            <button
              onClick={handleJoinMeeting}
              disabled={joining || !guestName.trim()}
              className="w-full py-3 sm:py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
            >
              {joining ? (
                'Joining...'
              ) : (
                <>
                  <Video className="w-5 h-5" />
                  Join Meeting
                </>
              )}
            </button>

            <p className="text-sm text-gray-600 text-center">
              Ready to join the meeting
            </p>
          </div>

          {/* Right side - Preview */}
          <div className="bg-gray-900 rounded-2xl aspect-video flex items-center justify-center relative overflow-hidden order-first lg:order-last">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-purple-600/20"></div>
            <div className="text-center text-white z-10">
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                {videoEnabled ? (
                  <Video className="w-10 h-10 sm:w-12 sm:h-12" />
                ) : (
                  <VideoOff className="w-10 h-10 sm:w-12 sm:h-12" />
                )}
              </div>
              <p className="text-base sm:text-lg font-medium">
                {guestName || 'Your Name'}
              </p>
              <p className="text-sm text-white/80 mt-1">
                {videoEnabled ? 'Camera ready' : 'Camera off'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}