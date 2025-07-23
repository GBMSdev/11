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

export interface MediaQuality {
  video: {
    width: number;
    height: number;
    frameRate: number;
    bitrate: number;
  };
  audio: {
    sampleRate: number;
    bitrate: number;
    echoCancellation: boolean;
    noiseSuppression: boolean;
    autoGainControl: boolean;
  };
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
  private signalingChannel: any;
  private isInitialized = false;
  private mediaQuality: MediaQuality;
  private isMobile: boolean;

  constructor(meetingId: string, participantId: string, participantName: string) {
    this.meetingId = meetingId;
    this.participantId = participantId;
    this.participantName = participantName;
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Adaptive quality based on device
    this.mediaQuality = this.getOptimalQuality();
    this.setupSignaling();
  }

  private getOptimalQuality(): MediaQuality {
    const isMobile = this.isMobile;
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    const isSlowConnection = connection && (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g');

    return {
      video: {
        width: isMobile ? (isSlowConnection ? 480 : 720) : (isSlowConnection ? 720 : 1280),
        height: isMobile ? (isSlowConnection ? 360 : 540) : (isSlowConnection ? 540 : 720),
        frameRate: isMobile ? (isSlowConnection ? 15 : 24) : (isSlowConnection ? 24 : 30),
        bitrate: isMobile ? (isSlowConnection ? 300000 : 800000) : (isSlowConnection ? 800000 : 1500000)
      },
      audio: {
        sampleRate: 48000,
        bitrate: isSlowConnection ? 32000 : 64000,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    };
  }

  private setupSignaling() {
    this.signalingChannel = supabase
      .channel(`webrtc-${this.meetingId}`)
      .on('broadcast', { event: 'offer' }, (payload) => {
        this.handleOffer(payload.payload);
      })
      .on('broadcast', { event: 'answer' }, (payload) => {
        this.handleAnswer(payload.payload);
      })
      .on('broadcast', { event: 'ice-candidate' }, (payload) => {
        this.handleIceCandidate(payload.payload);
      })
      .on('broadcast', { event: 'user-joined' }, (payload) => {
        this.handleUserJoined(payload.payload);
      })
      .on('broadcast', { event: 'user-left' }, (payload) => {
        this.handleUserLeft(payload.payload);
      })
      .on('broadcast', { event: 'media-state-changed' }, (payload) => {
        this.handleMediaStateChanged(payload.payload);
      })
      .subscribe();
  }

  async initializeMedia(video: boolean = true, audio: boolean = true): Promise<MediaStream> {
    try {
      const constraints: MediaStreamConstraints = {
        video: video ? {
          width: { ideal: this.mediaQuality.video.width },
          height: { ideal: this.mediaQuality.video.height },
          frameRate: { ideal: this.mediaQuality.video.frameRate },
          facingMode: this.isMobile ? 'user' : undefined
        } : false,
        audio: audio ? {
          sampleRate: this.mediaQuality.audio.sampleRate,
          echoCancellation: this.mediaQuality.audio.echoCancellation,
          noiseSuppression: this.mediaQuality.audio.noiseSuppression,
          autoGainControl: this.mediaQuality.audio.autoGainControl
        } : false
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Apply bitrate constraints
      if (this.localStream && video) {
        const videoTrack = this.localStream.getVideoTracks()[0];
        if (videoTrack && 'applyConstraints' in videoTrack) {
          await videoTrack.applyConstraints({
            width: { ideal: this.mediaQuality.video.width },
            height: { ideal: this.mediaQuality.video.height },
            frameRate: { ideal: this.mediaQuality.video.frameRate }
          });
        }
      }

      return this.localStream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      // Fallback to lower quality
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          video: video ? { width: 640, height: 480 } : false,
          audio: audio
        });
        return this.localStream;
      } catch (fallbackError) {
        console.error('Fallback media access failed:', fallbackError);
        throw fallbackError;
      }
    }
  }

  async startScreenShare(): Promise<MediaStream> {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: true
      });
      
      // Replace video track in all peer connections
      const videoTrack = screenStream.getVideoTracks()[0];
      this.peers.forEach(({ peer, peerId }) => {
        const sender = peer.getSenders().find(s => 
          s.track && s.track.kind === 'video'
        );
        if (sender && videoTrack) {
          sender.replaceTrack(videoTrack).catch(console.error);
        }
        
        // Update peer connection state
        const peerConnection = this.peers.get(peerId);
        if (peerConnection) {
          peerConnection.isScreenSharing = true;
        }
      });

      // Broadcast screen sharing state
      await this.broadcastMediaState(true, true, true);

      // Handle screen share end
      videoTrack.onended = async () => {
        if (this.localStream) {
          const videoTrack = this.localStream.getVideoTracks()[0];
          this.peers.forEach(({ peer, peerId }) => {
            const sender = peer.getSenders().find(s => 
              s.track && s.track.kind === 'video'
            );
            if (sender && videoTrack) {
              sender.replaceTrack(videoTrack).catch(console.error);
            }
            
            // Update peer connection state
            const peerConnection = this.peers.get(peerId);
            if (peerConnection) {
              peerConnection.isScreenSharing = false;
            }
          });
          
          await this.broadcastMediaState(true, true, false);
        }
      };

      return screenStream;
    } catch (error) {
      console.error('Error starting screen share:', error);
      throw error;
    }
  }

  async joinMeeting() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Announce joining
    await this.signalingChannel.send({
      type: 'broadcast',
      event: 'user-joined',
      payload: { 
        participantId: this.participantId,
        name: this.participantName,
        audioEnabled: true,
        videoEnabled: true,
        isScreenSharing: false
      }
    });

    this.updateParticipantCount();
  }

  private async handleUserJoined(data: { participantId: string; name: string; audioEnabled: boolean; videoEnabled: boolean; isScreenSharing: boolean }) {
    if (data.participantId === this.participantId) return;

    console.log('User joined:', data.name);
    await this.createPeerConnection(data.participantId, data.name, true);
    this.updateParticipantCount();
  }

  private async createPeerConnection(peerId: string, name: string, isInitiator: boolean) {
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

    // Add local stream tracks with enhanced settings
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        const sender = peer.addTrack(track, this.localStream!);
        
        // Apply encoding parameters for better quality
        if (track.kind === 'video') {
          const params = sender.getParameters();
          if (params.encodings && params.encodings.length > 0) {
            params.encodings[0].maxBitrate = this.mediaQuality.video.bitrate;
            params.encodings[0].maxFramerate = this.mediaQuality.video.frameRate;
            sender.setParameters(params).catch(console.error);
          }
        }
      });
    }

    // Handle remote stream with enhanced tracking
    peer.ontrack = (event) => {
      console.log('Received remote stream from:', name);
      const [remoteStream] = event.streams;
      const peerConnection = this.peers.get(peerId);
      if (peerConnection) {
        peerConnection.stream = remoteStream;
        this.onStreamCallback?.(
          peerId, 
          remoteStream, 
          name, 
          peerConnection.audioEnabled, 
          peerConnection.videoEnabled
        );
      }
    };

    // Enhanced ICE handling
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        this.signalingChannel.send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: {
            from: this.participantId,
            to: peerId,
            candidate: event.candidate
          }
        });
      }
    };

    // Enhanced connection state monitoring
    peer.onconnectionstatechange = () => {
      console.log(`Connection state with ${name}:`, peer.connectionState);
      if (peer.connectionState === 'failed') {
        // Attempt to restart ICE
        peer.restartIce();
      } else if (peer.connectionState === 'disconnected') {
        // Wait a bit before removing peer
        setTimeout(() => {
          if (peer.connectionState === 'disconnected') {
            this.peers.delete(peerId);
            this.onPeerLeftCallback?.(peerId);
            this.updateParticipantCount();
          }
        }, 5000);
      } else if (peer.connectionState === 'closed') {
        this.peers.delete(peerId);
        this.onPeerLeftCallback?.(peerId);
        this.updateParticipantCount();
      }
    };

    // Monitor ICE connection state
    peer.oniceconnectionstatechange = () => {
      console.log(`ICE connection state with ${name}:`, peer.iceConnectionState);
    };

    this.peers.set(peerId, { 
      peerId, 
      peer, 
      name, 
      audioEnabled: true, 
      videoEnabled: true, 
      isScreenSharing: false 
    });

    if (isInitiator) {
      // Create and send offer with enhanced options
      const offer = await peer.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
        iceRestart: false
      });
      await peer.setLocalDescription(offer);
      
      this.signalingChannel.send({
        type: 'broadcast',
        event: 'offer',
        payload: {
          from: this.participantId,
          to: peerId,
          offer: offer,
          name: this.participantName
        }
      });
    }
  }

  private async handleOffer(data: { from: string; to: string; offer: RTCSessionDescriptionInit; name: string }) {
    if (data.to !== this.participantId) return;

    console.log('Received offer from:', data.name);
    await this.createPeerConnection(data.from, data.name, false);
    
    const peerConnection = this.peers.get(data.from);
    if (peerConnection) {
      await peerConnection.peer.setRemoteDescription(data.offer);
      
      const answer = await peerConnection.peer.createAnswer();
      await peerConnection.peer.setLocalDescription(answer);
      
      this.signalingChannel.send({
        type: 'broadcast',
        event: 'answer',
        payload: {
          from: this.participantId,
          to: data.from,
          answer: answer,
          name: this.participantName
        }
      });
    }
  }

  private async handleAnswer(data: { from: string; to: string; answer: RTCSessionDescriptionInit; name: string }) {
    if (data.to !== this.participantId) return;

    console.log('Received answer from:', data.name);
    const peerConnection = this.peers.get(data.from);
    if (peerConnection) {
      await peerConnection.peer.setRemoteDescription(data.answer);
    }
  }

  private async handleIceCandidate(data: { from: string; to: string; candidate: RTCIceCandidateInit }) {
    if (data.to !== this.participantId) return;

    const peerConnection = this.peers.get(data.from);
    if (peerConnection) {
      try {
        await peerConnection.peer.addIceCandidate(data.candidate);
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    }
  }

  private async handleUserLeft(data: { participantId: string }) {
    console.log('User left:', data.participantId);
    const peerConnection = this.peers.get(data.participantId);
    if (peerConnection) {
      peerConnection.peer.close();
      this.peers.delete(data.participantId);
      this.onPeerLeftCallback?.(data.participantId);
      this.updateParticipantCount();
    }
  }

  private async handleMediaStateChanged(data: { participantId: string; audioEnabled: boolean; videoEnabled: boolean; isScreenSharing: boolean }) {
    if (data.participantId === this.participantId) return;

    const peerConnection = this.peers.get(data.participantId);
    if (peerConnection) {
      peerConnection.audioEnabled = data.audioEnabled;
      peerConnection.videoEnabled = data.videoEnabled;
      peerConnection.isScreenSharing = data.isScreenSharing;
      this.onMediaStateCallback?.(data.participantId, data.audioEnabled, data.videoEnabled);
    }
  }

  private async broadcastMediaState(audioEnabled: boolean, videoEnabled: boolean, isScreenSharing: boolean) {
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
  }

  private updateParticipantCount() {
    const count = this.peers.size + 1; // +1 for local participant
    this.onParticipantCountCallback?.(count);
  }

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

  async toggleAudio(enabled: boolean) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = enabled;
      });
      await this.broadcastMediaState(enabled, this.isVideoEnabled(), this.isScreenSharing());
    }
  }

  async toggleVideo(enabled: boolean) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = enabled;
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

  getPeerMediaStates(): Map<string, { audioEnabled: boolean; videoEnabled: boolean; isScreenSharing: boolean }> {
    const states = new Map();
    this.peers.forEach((peer, peerId) => {
      states.set(peerId, {
        audioEnabled: peer.audioEnabled,
        videoEnabled: peer.videoEnabled,
        isScreenSharing: peer.isScreenSharing
      });
    });
    return states;
  }

  async raiseHand(raised: boolean) {
    await this.signalingChannel.send({
      type: 'broadcast',
      event: 'hand-raised',
      payload: {
        participantId: this.participantId,
        name: this.participantName,
        raised: raised
      }
    });
  }

  onHandRaised(callback: (participantId: string, name: string, raised: boolean) => void) {
    this.signalingChannel.on('broadcast', { event: 'hand-raised' }, (payload: any) => {
      if (payload.payload.participantId !== this.participantId) {
        callback(payload.payload.participantId, payload.payload.name, payload.payload.raised);
      }
    });
  }

  async leaveMeeting() {
    // Announce leaving
    await this.signalingChannel.send({
      type: 'broadcast',
      event: 'user-left',
      payload: { participantId: this.participantId }
    });

    // Clean up
    this.peers.forEach(({ peer }) => peer.close());
    this.peers.clear();
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }

    this.signalingChannel.unsubscribe();
  }
}