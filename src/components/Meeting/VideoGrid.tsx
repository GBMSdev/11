import React, { useRef, useEffect, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, Hand, Monitor, Maximize2, Volume2, VolumeX, Pin, PinOff } from 'lucide-react';

interface VideoTileProps {
  stream?: MediaStream;
  participantName: string;
  participantId: string;
  isLocal?: boolean;
  isMuted?: boolean;
  isCameraOff?: boolean;
  isScreenShare?: boolean;
  handRaised?: boolean;
  isLarge?: boolean;
  isPinned?: boolean;
  onToggleFullscreen?: () => void;
  onTogglePin?: () => void;
  audioEnabled?: boolean;
  videoEnabled?: boolean;
  audioLevel?: number;
  connectionQuality?: 'excellent' | 'good' | 'poor';
}

function VideoTile({ 
  stream, 
  participantName, 
  participantId,
  isLocal = false, 
  isMuted = false, 
  isCameraOff = false,
  isScreenShare = false,
  handRaised = false,
  isLarge = false,
  isPinned = false,
  onToggleFullscreen,
  onTogglePin,
  audioEnabled = true,
  videoEnabled = true,
  audioLevel = 0,
  connectionQuality = 'good'
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);

  useEffect(() => {
    if (videoRef.current && stream) {
      console.log('🎥 Setting video stream for:', participantName, 'Tracks:', stream.getTracks().length);
      videoRef.current.srcObject = stream;
      
      // Check if stream has audio
      setHasAudio(stream.getAudioTracks().length > 0);
      
      // Handle video loading
      const video = videoRef.current;
      const handleCanPlay = () => {
        console.log('✅ Video can play for:', participantName);
        setIsVideoLoaded(true);
        video.play().catch(error => {
          console.error('❌ Video play failed for:', participantName, error);
        });
      };
      
      const handleLoadStart = () => {
        console.log('📊 Video load started for:', participantName);
      };
      
      const handleLoadedMetadata = () => {
        console.log('📊 Video metadata loaded for:', participantName);
      };
      
      const handleError = (error: any) => {
        console.error('❌ Video error for:', participantName, error);
      };
      
      video.addEventListener('canplay', handleCanPlay);
      video.addEventListener('loadstart', handleLoadStart);
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('error', handleError);
      
      // Ensure video plays
      video.autoplay = true;
      video.playsInline = true;
      if (!isLocal) {
        video.muted = false; // Ensure remote videos are not muted
      }
      
      return () => {
        video.removeEventListener('canplay', handleCanPlay);
        video.removeEventListener('loadstart', handleLoadStart);
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('error', handleError);
      };
    } else {
      console.log('⚠️ No stream for:', participantName);
      setIsVideoLoaded(false);
    }
  }, [stream, participantName]);

  const currentAudioLevel = audioLevel || 0;
  const isSpeaking = currentAudioLevel > 0.1;

  const initials = participantName
    .split(' ')
    .map(name => name.charAt(0))
    .join('')
    .toUpperCase();

  const showVideo = stream && videoEnabled && !isCameraOff;

  const getConnectionColor = () => {
    switch (connectionQuality) {
      case 'excellent': return 'bg-green-500';
      case 'good': return 'bg-yellow-500';
      case 'poor': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getAudioLevelBars = () => {
    const bars = [];
    const barCount = 5;
    const activeBarCount = Math.ceil(currentAudioLevel * barCount);
    
    for (let i = 0; i < barCount; i++) {
      bars.push(
        <div
          key={i}
          className={`w-1 rounded-full transition-all duration-100 ${
            i < activeBarCount ? 'bg-green-400' : 'bg-gray-400'
          }`}
          style={{ height: `${8 + (i * 2)}px` }}
        />
      );
    }
    return bars;
  };

  return (
    <div className={`relative bg-gray-800 rounded-lg overflow-hidden transition-all duration-300 ${
      isLarge ? 'aspect-video' : 'aspect-video'
    } ${handRaised ? 'ring-4 ring-yellow-400 ring-opacity-75' : ''} ${
      isSpeaking ? 'ring-2 ring-green-400 ring-opacity-75 shadow-lg shadow-green-400/25' : ''
    } ${isPinned ? 'ring-2 ring-blue-400 ring-opacity-75' : ''}`}>
      
      {/* Video or Avatar */}
      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          controls={false}
          className="w-full h-full object-cover transition-opacity duration-300"
          style={{ transform: isLocal && !isScreenShare ? 'scaleX(-1)' : 'none' }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-800">
          <div className="text-center text-white">
            <div className={`bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-2 transition-all duration-300 ${
              isSpeaking ? 'ring-4 ring-green-400 ring-opacity-50 scale-110' : ''
            } ${isLarge ? 'w-20 h-20' : 'w-16 h-16'}`}>
              <span className={`text-white font-semibold ${isLarge ? 'text-2xl' : 'text-xl'}`}>
                {initials}
              </span>
            </div>
            <p className={`font-medium ${isLarge ? 'text-base' : 'text-sm'}`}>
              {participantName}
            </p>
            {(!videoEnabled || !stream) && (
              <p className="text-xs text-gray-400 mt-1">Camera off</p>
            )}
          </div>
        </div>
      )}

      {/* Hand raised indicator */}
      {handRaised && (
        <div className="absolute top-3 right-3 z-10">
          <div className="bg-yellow-500 text-white p-2 rounded-full animate-bounce shadow-lg">
            <Hand className="w-4 h-4" />
          </div>
        </div>
      )}

      {/* Screen share indicator */}
      {isScreenShare && (
        <div className="absolute top-3 left-3 z-10">
          <div className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 shadow-lg">
            <Monitor className="w-3 h-3" />
            Screen Share
          </div>
        </div>
      )}

      {/* Pin indicator */}
      {isPinned && (
        <div className="absolute top-3 right-3 z-10">
          <div className="bg-blue-500 text-white p-1 rounded-full shadow-lg">
            <Pin className="w-3 h-3" />
          </div>
        </div>
      )}

      {/* Audio level visualization */}
      {audioEnabled && !isMuted && (
        <div className="absolute top-3 left-3 z-10">
          <div className="bg-black/50 backdrop-blur-sm text-white p-2 rounded-full flex items-center gap-1">
            <Volume2 className="w-3 h-3" />
            <div className="flex items-end gap-0.5 h-4">
              {getAudioLevelBars()}
            </div>
          </div>
        </div>
      )}

      {/* Overlay info */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className={`text-white font-medium truncate ${isLarge ? 'text-base' : 'text-sm'}`}>
              {participantName} {isLocal && '(You)'}
            </span>
            
            {/* Connection quality indicator */}
            <div className="flex items-center space-x-1">
              <div className={`w-2 h-2 rounded-full ${getConnectionColor()}`}></div>
              <div className={`w-2 h-3 rounded-full ${connectionQuality !== 'poor' ? getConnectionColor() : 'bg-gray-400'}`}></div>
              <div className={`w-2 h-4 rounded-full ${connectionQuality === 'excellent' ? getConnectionColor() : 'bg-gray-400'}`}></div>
            </div>
          </div>
          
          <div className="flex items-center space-x-1">
            {/* Audio indicator */}
            {audioEnabled && !isMuted ? (
              <div className={`p-1 rounded transition-all ${isSpeaking ? 'bg-green-500 scale-110' : 'bg-gray-600'}`}>
                <Mic className="w-3 h-3 text-white" />
              </div>
            ) : (
              <div className="p-1 rounded bg-red-500">
                <MicOff className="w-3 h-3 text-white" />
              </div>
            )}
            
            {/* Video indicator */}
            {videoEnabled && !isCameraOff ? (
              <div className="p-1 rounded bg-gray-600">
                <Video className="w-3 h-3 text-white" />
              </div>
            ) : (
              <div className="p-1 rounded bg-red-500">
                <VideoOff className="w-3 h-3 text-white" />
              </div>
            )}

            {/* Mobile controls */}
            <div className="flex items-center space-x-1 lg:hidden">
              {onTogglePin && (
                <button
                  onClick={onTogglePin}
                  className="p-1 rounded bg-gray-600 hover:bg-gray-500 transition-colors"
                  title={isPinned ? 'Unpin' : 'Pin participant'}
                >
                  {isPinned ? <PinOff className="w-3 h-3 text-white" /> : <Pin className="w-3 h-3 text-white" />}
                </button>
              )}
              
              {onToggleFullscreen && (
                <button
                  onClick={onToggleFullscreen}
                  className="p-1 rounded bg-gray-600 hover:bg-gray-500 transition-colors"
                  title="Focus view"
                >
                  <Maximize2 className="w-3 h-3 text-white" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Loading indicator */}
      {stream && videoEnabled && !isVideoLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
          <div className="text-center text-white">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
            <p className="text-sm">Loading video...</p>
          </div>
        </div>
      )}
      
      {/* Audio indicator for debugging */}
      {!isLocal && hasAudio && (
        <div className="absolute top-1 right-1 bg-green-500 w-2 h-2 rounded-full opacity-75"></div>
      )}

      {/* Speaking indicator overlay */}
      {isSpeaking && (
        <div className="absolute inset-0 border-2 border-green-400 rounded-lg pointer-events-none animate-pulse"></div>
      )}
    </div>
  );
}

interface VideoGridProps {
  localStream?: MediaStream;
  remoteStreams: Map<string, { 
    stream: MediaStream; 
    name: string; 
    audioEnabled?: boolean; 
    videoEnabled?: boolean;
    isScreenSharing?: boolean;
    audioLevel?: number;
  }>;
  localParticipantName: string;
  localParticipantId: string;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  handRaisedParticipants: Set<string>;
  localHandRaised: boolean;
  participantCount: number;
  localAudioLevel?: number;
}

export function VideoGrid({
  localStream,
  remoteStreams,
  localParticipantName,
  localParticipantId,
  isMuted,
  isCameraOff,
  isScreenSharing,
  handRaisedParticipants,
  localHandRaised,
  participantCount,
  localAudioLevel = 0
}: VideoGridProps) {
  const [focusedParticipant, setFocusedParticipant] = useState<string | null>(null);
  const [pinnedParticipant, setPinnedParticipant] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Find screen sharing participant
  const screenSharingParticipant = Array.from(remoteStreams.entries()).find(
    ([_, data]) => data.isScreenSharing
  );
  const isLocalScreenSharing = isScreenSharing;
  const hasScreenShare = screenSharingParticipant || isLocalScreenSharing;

  // Determine main participant (screen sharer takes priority)
  const getMainParticipant = () => {
    if (hasScreenShare) {
      return isLocalScreenSharing ? 'local' : screenSharingParticipant?.[0] || null;
    }
    if (pinnedParticipant) return pinnedParticipant;
    if (focusedParticipant) return focusedParticipant;
    
    // Default to first remote participant or local if no remote
    const firstRemote = Array.from(remoteStreams.keys())[0];
    return isMobile && participantCount > 1 ? (firstRemote || 'local') : null;
  };

  const mainParticipant = getMainParticipant();

  const handleToggleFocus = (participantId: string) => {
    setFocusedParticipant(focusedParticipant === participantId ? null : participantId);
  };

  const handleTogglePin = (participantId: string) => {
    setPinnedParticipant(pinnedParticipant === participantId ? null : participantId);
  };

  // Enhanced grid layout logic
  const getGridClass = () => {
    if (hasScreenShare || mainParticipant) return 'grid-cols-1';
    
    if (isMobile) {
      if (participantCount === 1) return 'grid-cols-1';
      if (participantCount === 2) return 'grid-cols-1 gap-2';
      return 'grid-cols-2 gap-2';
    }
    
    // Desktop layout
    if (participantCount === 1) return 'grid-cols-1';
    if (participantCount === 2) return 'grid-cols-1 lg:grid-cols-2';
    if (participantCount <= 4) return 'grid-cols-2';
    if (participantCount <= 6) return 'grid-cols-2 lg:grid-cols-3';
    if (participantCount <= 9) return 'grid-cols-3';
    return 'grid-cols-3 xl:grid-cols-4';
  };

  const getThumbnailGridClass = () => {
    const thumbnailCount = participantCount - (mainParticipant ? 1 : 0);
    if (thumbnailCount <= 3) return 'grid-cols-3';
    if (thumbnailCount <= 4) return 'grid-cols-4';
    if (thumbnailCount <= 5) return 'grid-cols-5';
    return 'grid-cols-6';
  };

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Main video area */}
      {(hasScreenShare || mainParticipant) && (
        <div className="flex-1 p-1 sm:p-2 lg:p-4">
          {mainParticipant === 'local' ? (
            <VideoTile
              stream={localStream}
              participantName={localParticipantName}
              participantId={localParticipantId}
              isLocal={true}
              isMuted={isMuted}
              isCameraOff={isCameraOff}
              isScreenShare={isScreenSharing}
              handRaised={localHandRaised}
              isLarge={true}
              isPinned={pinnedParticipant === 'local'}
              onToggleFullscreen={() => handleToggleFocus('local')}
              onTogglePin={() => handleTogglePin('local')}
              audioEnabled={!isMuted}
              videoEnabled={!isCameraOff}
              audioLevel={localAudioLevel}
            />
          ) : (
            (() => {
              const remoteData = remoteStreams.get(mainParticipant!);
              return remoteData ? (
                <VideoTile
                  stream={remoteData.stream}
                  participantName={remoteData.name}
                  participantId={mainParticipant!}
                  isLocal={false}
                  isScreenShare={remoteData.isScreenSharing}
                  handRaised={handRaisedParticipants.has(mainParticipant!)}
                  isLarge={true}
                  isPinned={pinnedParticipant === mainParticipant}
                  onToggleFullscreen={() => handleToggleFocus(mainParticipant!)}
                  onTogglePin={() => handleTogglePin(mainParticipant!)}
                  audioEnabled={remoteData.audioEnabled}
                  videoEnabled={remoteData.videoEnabled}
                  audioLevel={remoteData.audioLevel}
                />
              ) : null;
            })()
          )}
        </div>
      )}

      {/* Thumbnail strip or main grid */}
      <div className={`${
        hasScreenShare || mainParticipant
          ? 'h-20 sm:h-24 lg:h-32 p-1 sm:p-2 bg-gray-900/80 backdrop-blur-sm border-t border-gray-700' 
          : 'flex-1 p-1 sm:p-2 lg:p-4'
      }`}>
        <div className={`${
          hasScreenShare || mainParticipant
            ? `grid gap-1 sm:gap-2 h-full ${getThumbnailGridClass()} overflow-x-auto`
            : `grid gap-1 sm:gap-2 lg:gap-4 h-full ${getGridClass()}`
        }`}>
          
          {/* Local video */}
          {(!mainParticipant || mainParticipant !== 'local') && (
            <VideoTile
              stream={localStream}
              participantName={localParticipantName}
              participantId={localParticipantId}
              isLocal={true}
              isMuted={isMuted}
              isCameraOff={isCameraOff}
              isScreenShare={isScreenSharing}
              handRaised={localHandRaised}
              isLarge={!hasScreenShare && !mainParticipant}
              isPinned={pinnedParticipant === 'local'}
              onToggleFullscreen={() => handleToggleFocus('local')}
              onTogglePin={() => handleTogglePin('local')}
              audioEnabled={!isMuted}
              videoEnabled={!isCameraOff}
              audioLevel={localAudioLevel}
            />
          )}

          {/* Remote videos */}
          {Array.from(remoteStreams.entries()).map(([peerId, data]) => {
            if (mainParticipant === peerId) return null;
            
            return (
              <VideoTile
                key={peerId}
                stream={data.stream}
                participantName={data.name}
                participantId={peerId}
                isLocal={false}
                isScreenShare={data.isScreenSharing}
                handRaised={handRaisedParticipants.has(peerId)}
                isLarge={!hasScreenShare && !mainParticipant}
                isPinned={pinnedParticipant === peerId}
                onToggleFullscreen={() => handleToggleFocus(peerId)}
                onTogglePin={() => handleTogglePin(peerId)}
                audioEnabled={data.audioEnabled}
                videoEnabled={data.videoEnabled}
                audioLevel={data.audioLevel}
              />
            );
          })}
        </div>
      </div>

      {/* Enhanced participant count and status */}
      <div className="absolute top-4 left-4 flex items-center space-x-3 z-10">
        <div className="bg-black/60 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          {participantCount} participant{participantCount !== 1 ? 's' : ''}
        </div>
        
        {hasScreenShare && (
          <div className="bg-green-500/90 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1">
            <Monitor className="w-3 h-3" />
            Screen Sharing
          </div>
        )}
        
        {pinnedParticipant && (
          <div className="bg-blue-500/90 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1">
            <Pin className="w-3 h-3" />
            Pinned
          </div>
        )}
      </div>
    </div>
  );
}