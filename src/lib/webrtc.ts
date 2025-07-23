import { supabase } from './supabase';

export interface PeerConnection {
  peerId: string;
  peer: RTCPeerConnection;
  stream?: MediaStream;
  name: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
  isScreenSharing: boolean;
}

export class WebRTCManager {
  private localStream: MediaStream | null = null;
  private peers: Map<string, PeerConnection> = new Map();
  private meetingId: string;
  private participantId: string;
  private participantName: string;
  private onStreamCallback?: (peerId: string, stream: MediaStream, name: string, audioEnabled: boolean, videoEnabled: boolean) => void;
  private onPeerLeftCallback?: (peerId: string) => void;
  private onParticipantCountCallback?: (count: number) => void;
  private onMediaStateCallback?: (peerId: string, audioEnabled: boolean, videoEnabled: boolean) => void;
  private onHandRaisedCallback?: (participantId: string, name: string, raised: boolean) => void;
  private signalingChannel: any;
  private isInitialized = false;

  constructor(meetingId: string, participantId: string, participantName: string) {
    this.meetingId = meetingId;
    this.participantId = participantId;
    this.participantName = participantName;
    this.setupSignaling();
  }

  private setupSignaling() {
    console.log('🔧 Setting up signaling for participant:', this.participantName);
    
    this.signalingChannel = supabase
      .channel(`webrtc-${this.meetingId}`)
      .on('broadcast', { event: 'offer' }, (payload) => {
        console.log('📨 Received offer from:', payload.payload.name);
        this.handleOffer(payload.payload);
      })
      .on('broadcast', { event: 'answer' }, (payload) => {
        console.log('📨 Received answer from:', payload.payload.name);
        this.handleAnswer(payload.payload);
      })
      .on('broadcast', { event: 'ice-candidate' }, (payload) => {
        console.log('📨 Received ICE candidate from:', payload.payload.from);
        this.handleIceCandidate(payload.payload);
      })
      .on('broadcast', { event: 'user-joined' }, (payload) => {
        console.log('👋 User joined:', payload.payload.name);
        this.handleUserJoined(payload.payload);
      })
      .on('broadcast', { event: 'user-left' }, (payload) => {
        console.log('👋 User left:', payload.payload.participantId);
        this.handleUserLeft(payload.payload);
      })
      .on('broadcast', { event: 'media-state-changed' }, (payload) => {
        console.log('🎛️ Media state changed:', payload.payload);
        this.handleMediaStateChanged(payload.payload);
      })
      .on('broadcast', { event: 'hand-raised' }, (payload) => {
        console.log('✋ Hand raised:', payload.payload);
        if (payload.payload.participantId !== this.participantId) {
          this.onHandRaisedCallback?.(
            payload.payload.participantId, 
            payload.payload.name, 
            payload.payload.raised
          );
        }
      })
      .subscribe((status) => {
        console.log('📡 Signaling channel status:', status);
      });
  }

  async initializeMedia(video: boolean = true, audio: boolean = true): Promise<MediaStream> {
    try {
      console.log('🎥 Initializing media - Video:', video, 'Audio:', audio);
      
      // Stop existing stream if any
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          track.stop();
          console.log('🛑 Stopped existing track:', track.kind);
        });
      }

      const constraints: MediaStreamConstraints = {
        video: video ? {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 30 },
          facingMode: 'user'
        } : false,
        audio: audio ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        } : false
      };

      console.log('📋 Media constraints:', constraints);
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('✅ Media stream obtained with tracks:', this.localStream.getTracks().map(t => `${t.kind}: ${t.label}`));
      
      // Update existing peer connections with new stream
      this.updatePeerConnectionsWithStream();
      
      return this.localStream;
    } catch (error) {
      console.error('❌ Error accessing media devices:', error);
      
      // Fallback to lower quality
      try {
        console.log('🔄 Trying fallback constraints...');
        const fallbackConstraints = {
          video: video ? { width: 640, height: 480, frameRate: 15 } : false,
          audio: audio
        };
        
        this.localStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
        console.log('✅ Fallback media stream obtained');
        this.updatePeerConnectionsWithStream();
        return this.localStream;
      } catch (fallbackError) {
        console.error('❌ Fallback media access failed:', fallbackError);
        throw fallbackError;
      }
    }
  }

  private updatePeerConnectionsWithStream() {
    if (!this.localStream) return;

    console.log('🔄 Updating peer connections with new stream');
    this.peers.forEach(({ peer, name }) => {
      // Remove old tracks
      peer.getSenders().forEach(sender => {
        if (sender.track) {
          peer.removeTrack(sender);
          console.log('🗑️ Removed old track from peer:', name);
        }
      });

      // Add new tracks
      this.localStream!.getTracks().forEach(track => {
        const sender = peer.addTrack(track, this.localStream!);
        console.log('➕ Added new track to peer:', name, track.kind);
        
        // Set encoding parameters for better quality
        if (track.kind === 'video') {
          const params = sender.getParameters();
          if (params.encodings && params.encodings.length > 0) {
            params.encodings[0].maxBitrate = 1500000; // 1.5 Mbps
            params.encodings[0].maxFramerate = 30;
            sender.setParameters(params).catch(console.error);
          }
        }
      });
    });
  }

  async startScreenShare(): Promise<MediaStream> {
    try {
      console.log('🖥️ Starting screen share...');
      
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: true
      });
      
      console.log('✅ Screen share stream obtained');
      
      // Replace video track in all peer connections
      const videoTrack = screenStream.getVideoTracks()[0];
      this.peers.forEach(({ peer, name }) => {
        const sender = peer.getSenders().find(s => 
          s.track && s.track.kind === 'video'
        );
        if (sender && videoTrack) {
          sender.replaceTrack(videoTrack).then(() => {
            console.log('🔄 Replaced video track for screen share:', name);
          }).catch(console.error);
        }
      });

      // Broadcast screen sharing state
      await this.broadcastMediaState(this.isAudioEnabled(), true, true);

      // Handle screen share end
      videoTrack.onended = async () => {
        console.log('🛑 Screen share ended');
        if (this.localStream) {
          const videoTrack = this.localStream.getVideoTracks()[0];
          this.peers.forEach(({ peer, name }) => {
            const sender = peer.getSenders().find(s => 
              s.track && s.track.kind === 'video'
            );
            if (sender && videoTrack) {
              sender.replaceTrack(videoTrack).then(() => {
                console.log('🔄 Restored camera track:', name);
              }).catch(console.error);
            }
          });
          
          await this.broadcastMediaState(this.isAudioEnabled(), this.isVideoEnabled(), false);
        }
      };

      return screenStream;
    } catch (error) {
      console.error('❌ Error starting screen share:', error);
      throw error;
    }
  }

  async joinMeeting() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    console.log('🚀 Joining meeting:', this.meetingId, 'as', this.participantName);

    // Wait for channel to be ready then announce joining
    setTimeout(async () => {
      console.log('📢 Broadcasting user joined...');
      const result = await this.signalingChannel.send({
        type: 'broadcast',
        event: 'user-joined',
        payload: { 
          participantId: this.participantId,
          name: this.participantName,
          audioEnabled: this.isAudioEnabled(),
          videoEnabled: this.isVideoEnabled(),
          isScreenSharing: false
        }
      });
      console.log('📡 User joined broadcast result:', result);
    }, 1000);

    this.updateParticipantCount();
  }

  private async handleUserJoined(data: { participantId: string; name: string; audioEnabled: boolean; videoEnabled: boolean; isScreenSharing: boolean }) {
    if (data.participantId === this.participantId) return;

    console.log('👤 Handling user joined:', data.name);
    await this.createPeerConnection(data.participantId, data.name, true);
    this.updateParticipantCount();
  }

  private async createPeerConnection(peerId: string, name: string, isInitiator: boolean) {
    console.log('🔗 Creating peer connection for:', name, 'isInitiator:', isInitiator);

    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
      ],
      iceCandidatePoolSize: 10
    };

    const peer = new RTCPeerConnection(configuration);

    // Add local stream tracks immediately
    if (this.localStream) {
      console.log('➕ Adding local stream tracks to peer connection for:', name);
      this.localStream.getTracks().forEach(track => {
        const sender = peer.addTrack(track, this.localStream!);
        console.log('✅ Added track:', track.kind, 'to peer:', name);
        
        // Apply encoding parameters for better quality
        if (track.kind === 'video') {
          const params = sender.getParameters();
          if (params.encodings && params.encodings.length > 0) {
            params.encodings[0].maxBitrate = 1500000; // 1.5 Mbps
            params.encodings[0].maxFramerate = 30;
            sender.setParameters(params).catch(console.error);
          }
        }
      });
    } else {
      console.warn('⚠️ No local stream available when creating peer connection for:', name);
    }

    // Handle remote stream
    peer.ontrack = (event) => {
      console.log('🎬 Received remote track from:', name, 'Kind:', event.track.kind);
      const [remoteStream] = event.streams;
      
      if (remoteStream && remoteStream.getTracks().length > 0) {
        console.log('✅ Remote stream received with tracks:', remoteStream.getTracks().map(t => t.kind));
        
        const peerConnection = this.peers.get(peerId);
        if (peerConnection) {
          peerConnection.stream = remoteStream;
          console.log('📞 Calling onStreamCallback for:', name);
          this.onStreamCallback?.(
            peerId, 
            remoteStream, 
            name, 
            peerConnection.audioEnabled, 
            peerConnection.videoEnabled
          );
        }
      } else {
        console.warn('⚠️ Received empty or invalid remote stream from:', name);
      }
    };

    // Enhanced ICE handling
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 Sending ICE candidate to:', name);
        this.signalingChannel.send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: {
            from: this.participantId,
            to: peerId,
            candidate: event.candidate
          }
        }).catch(error => {
          console.error('❌ Failed to send ICE candidate:', error);
        });
      } else {
        console.log('🧊 ICE gathering complete for:', name);
      }
    };

    // Enhanced connection state monitoring
    peer.onconnectionstatechange = () => {
      console.log(`🔗 Connection state with ${name}:`, peer.connectionState);
      
      switch (peer.connectionState) {
        case 'connected':
          console.log(`✅ Successfully connected to ${name}`);
          break;
        case 'connecting':
          console.log(`🔄 Connecting to ${name}...`);
          break;
        case 'failed':
          console.log(`❌ Connection failed with ${name}, attempting ICE restart`);
          peer.restartIce();
          break;
        case 'disconnected':
          console.log(`⚠️ Disconnected from ${name}`);
          setTimeout(() => {
            if (peer.connectionState === 'disconnected') {
              console.log(`🗑️ Removing disconnected peer: ${name}`);
              this.peers.delete(peerId);
              this.onPeerLeftCallback?.(peerId);
              this.updateParticipantCount();
            }
          }, 5000);
          break;
        case 'closed':
          console.log(`🔒 Connection closed with ${name}`);
          this.peers.delete(peerId);
          this.onPeerLeftCallback?.(peerId);
          this.updateParticipantCount();
          break;
      }
    };

    // Monitor ICE connection state
    peer.oniceconnectionstatechange = () => {
      console.log(`🧊 ICE connection state with ${name}:`, peer.iceConnectionState);
    };

    // Monitor signaling state
    peer.onsignalingstatechange = () => {
      console.log(`📡 Signaling state with ${name}:`, peer.signalingState);
    };

    // Store peer connection
    this.peers.set(peerId, { 
      peerId, 
      peer, 
      name, 
      audioEnabled: true, 
      videoEnabled: true, 
      isScreenSharing: false 
    });

    if (isInitiator) {
      console.log('📤 Creating and sending offer to:', name);
      try {
        // Create and send offer
        const offer = await peer.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });
        
        await peer.setLocalDescription(offer);
        console.log('✅ Local description set for offer to:', name);
        
        const offerResult = await this.signalingChannel.send({
          type: 'broadcast',
          event: 'offer',
          payload: {
            from: this.participantId,
            to: peerId,
            offer: offer,
            name: this.participantName
          }
        });
        console.log('📡 Offer sent result:', offerResult);
      } catch (error) {
        console.error('❌ Error creating/sending offer to:', name, error);
      }
    }
  }

  private async handleOffer(data: { from: string; to: string; offer: RTCSessionDescriptionInit; name: string }) {
    if (data.to !== this.participantId) return;

    console.log('📨 Processing offer from:', data.name);
    
    try {
      await this.createPeerConnection(data.from, data.name, false);
      
      const peerConnection = this.peers.get(data.from);
      if (peerConnection) {
        console.log('📝 Setting remote description and creating answer for:', data.name);
        await peerConnection.peer.setRemoteDescription(data.offer);
        console.log('✅ Remote description set for:', data.name);
        
        const answer = await peerConnection.peer.createAnswer();
        await peerConnection.peer.setLocalDescription(answer);
        console.log('✅ Local description set for answer to:', data.name);
        
        console.log('📤 Sending answer to:', data.name);
        await this.signalingChannel.send({
          type: 'broadcast',
          event: 'answer',
          payload: {
            from: this.participantId,
            to: data.from,
            answer: answer,
            name: this.participantName
          }
        });
        console.log('✅ Answer sent to:', data.name);
      }
    } catch (error) {
      console.error('❌ Error handling offer from:', data.name, error);
    }
  }

  private async handleAnswer(data: { from: string; to: string; answer: RTCSessionDescriptionInit; name: string }) {
    if (data.to !== this.participantId) return;

    console.log('📨 Processing answer from:', data.name);
    
    try {
      const peerConnection = this.peers.get(data.from);
      if (peerConnection) {
        await peerConnection.peer.setRemoteDescription(data.answer);
        console.log('✅ Remote description set from answer for:', data.name);
      }
    } catch (error) {
      console.error('❌ Error handling answer from:', data.name, error);
    }
  }

  private async handleIceCandidate(data: { from: string; to: string; candidate: RTCIceCandidateInit }) {
    if (data.to !== this.participantId) return;

    const peerConnection = this.peers.get(data.from);
    if (peerConnection) {
      try {
        await peerConnection.peer.addIceCandidate(data.candidate);
        console.log('🧊 Added ICE candidate from:', data.from);
      } catch (error) {
        console.error('❌ Error adding ICE candidate from:', data.from, error);
      }
    }
  }

  private async handleUserLeft(data: { participantId: string }) {
    console.log('👋 Processing user left:', data.participantId);
    const peerConnection = this.peers.get(data.participantId);
    if (peerConnection) {
      peerConnection.peer.close();
      this.peers.delete(data.participantId);
      this.onPeerLeftCallback?.(data.participantId);
      this.updateParticipantCount();
      console.log('✅ Cleaned up peer connection for:', data.participantId);
    }
  }

  private async handleMediaStateChanged(data: { participantId: string; audioEnabled: boolean; videoEnabled: boolean; isScreenSharing: boolean }) {
    if (data.participantId === this.participantId) return;

    console.log('🎛️ Processing media state change for:', data.participantId);
    const peerConnection = this.peers.get(data.participantId);
    if (peerConnection) {
      peerConnection.audioEnabled = data.audioEnabled;
      peerConnection.videoEnabled = data.videoEnabled;
      peerConnection.isScreenSharing = data.isScreenSharing;
      this.onMediaStateCallback?.(data.participantId, data.audioEnabled, data.videoEnabled);
      console.log('✅ Updated media state for:', data.participantId);
    }
  }

  private async broadcastMediaState(audioEnabled: boolean, videoEnabled: boolean, isScreenSharing: boolean) {
    try {
      await this.signalingChannel.send({
        type: 'broadcast',
        event: 'media-state-changed',
        payload: {
          participantId: this.participantId,
          audioEnabled,
          videoEnabled,
          isScreenSharing
        }
      });
      console.log('📡 Broadcasted media state:', { audioEnabled, videoEnabled, isScreenSharing });
    } catch (error) {
      console.error('❌ Error broadcasting media state:', error);
    }
  }

  private updateParticipantCount() {
    const count = this.peers.size + 1; // +1 for local participant
    console.log('👥 Participant count updated:', count);
    this.onParticipantCountCallback?.(count);
  }

  // Public callback setters
  onStream(callback: (peerId: string, stream: MediaStream, name: string, audioEnabled: boolean, videoEnabled: boolean) => void) {
    this.onStreamCallback = callback;
  }

  onPeerLeft(callback: (peerId: string) => void) {
    this.onPeerLeftCallback = callback;
  }

  onParticipantCount(callback: (count: number) => void) {
    this.onParticipantCountCallback = callback;
  }

  onMediaStateChanged(callback: (peerId: string, audioEnabled: boolean, videoEnabled: boolean) => void) {
    this.onMediaStateCallback = callback;
  }

  onHandRaised(callback: (participantId: string, name: string, raised: boolean) => void) {
    this.onHandRaisedCallback = callback;
  }

  // Media control methods
  async toggleAudio(enabled: boolean) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = enabled;
        console.log('🎤 Audio track enabled:', enabled);
      });
      await this.broadcastMediaState(enabled, this.isVideoEnabled(), this.isScreenSharing());
    }
  }

  async toggleVideo(enabled: boolean) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = enabled;
        console.log('📹 Video track enabled:', enabled);
      });
      await this.broadcastMediaState(this.isAudioEnabled(), enabled, this.isScreenSharing());
    }
  }

  isAudioEnabled(): boolean {
    if (!this.localStream) return false;
    const audioTracks = this.localStream.getAudioTracks();
    return audioTracks.length > 0 && audioTracks[0].enabled;
  }

  isVideoEnabled(): boolean {
    if (!this.localStream) return false;
    const videoTracks = this.localStream.getVideoTracks();
    return videoTracks.length > 0 && videoTracks[0].enabled;
  }

  isScreenSharing(): boolean {
    if (!this.localStream) return false;
    const videoTracks = this.localStream.getVideoTracks();
    return videoTracks.length > 0 && videoTracks[0].label.includes('screen');
  }

  getParticipantCount(): number {
    return this.peers.size + 1;
  }

  async raiseHand(raised: boolean) {
    try {
      await this.signalingChannel.send({
        type: 'broadcast',
        event: 'hand-raised',
        payload: {
          participantId: this.participantId,
          name: this.participantName,
          raised: raised
        }
      });
      console.log('✋ Hand raised state broadcasted:', raised);
    } catch (error) {
      console.error('❌ Error broadcasting hand raise:', error);
    }
  }

  async leaveMeeting() {
    console.log('👋 Leaving meeting...');
    
    try {
      // Announce leaving
      await this.signalingChannel.send({
        type: 'broadcast',
        event: 'user-left',
        payload: { participantId: this.participantId }
      });
    } catch (error) {
      console.error('❌ Error announcing leave:', error);
    }

    // Clean up peer connections
    this.peers.forEach(({ peer, name }) => {
      console.log('🔒 Closing peer connection with:', name);
      peer.close();
    });
    this.peers.clear();
    
    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
        console.log('🛑 Stopped local track:', track.kind);
      });
    }

    // Unsubscribe from signaling
    if (this.signalingChannel) {
      this.signalingChannel.unsubscribe();
      console.log('📡 Unsubscribed from signaling channel');
    }

    console.log('✅ Meeting cleanup complete');
  }
}