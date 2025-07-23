import React, { useRef, useEffect, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, Hand, Monitor, Maximize2, Volume2, VolumeX } from 'lucide-react';

interface VideoTileProps {
  stream?: MediaStream;
  participantName: string;
  isLocal?: boolean;
  isMuted?: boolean;
  isCameraOff?: boolean;
  isScreenShare?: boolean;
  handRaised?: boolean;
  isLarge?: boolean;
  onToggleFullscreen?: () => void;
  audioEnabled?: boolean;
  videoEnabled?: boolean;
}

function VideoTile({ 
  stream, 
  participantName, 
  isLocal = false, 
  isMuted = false, 
  isCameraOff = false,
  isScreenShare = false,
  handRaised = false,
  isLarge = false,
  onToggleFullscreen,
  audioEnabled = true,
  videoEnabled = true
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(console.error);
      
      // Monitor video load
      const video = videoRef.current;
      const handleLoadedData = () => setIsVideoLoaded(true);
      video.addEventListener('loadeddata', handleLoadedData);
      
      return () => {
        video.removeEventListener('loadeddata', handleLoadedData);
      };
    }
  }, [stream]);

  // Audio level monitoring for visual feedback
  useEffect(() => {
    if (!stream || !audioEnabled || isMuted) {
      setAudioLevel(0);
      return;
    }

    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    source.connect(analyser);
    analyser.fftSize = 256;

    const updateAudioLevel = () => {
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      setAudioLevel(average / 255);
      requestAnimationFrame(updateAudioLevel);
    };

    updateAudioLevel();

    return () => {
      audioContext.close();
    };
  }, [stream, audioEnabled, isMuted]);

  const initials = participantName
    .split(' ')
    .map(name => name.charAt(0))
    .join('')
    .toUpperCase();

  const showVideo = stream && videoEnabled && !isCameraOff && isVideoLoaded;

  return (
    <div className={`relative bg-gray-800 rounded-lg overflow-hidden transition-all duration-300 ${
      isLarge ? 'aspect-video' : 'aspect-video'
    } ${handRaised ? 'ring-4 ring-yellow-400 ring-opacity-75' : ''} ${
      audioLevel > 0.1 ? 'ring-2 ring-green-400 ring-opacity-50' : ''
    }`}>
      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover transition-opacity duration-300"
          style={{ transform: isLocal && !isScreenShare ? 'scaleX(-1)' : 'none' }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-800">
          <div className="text-center text-white">
            <div className={`bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-2 ${
              isLarge ? 'w-20 h-20' : 'w-16 h-16'
            }`}>
              <span className={`text-white font-semibold ${isLarge ? 'text-2xl' : 'text-xl'}`}>
                {initials}
              </span>
            </div>
            <p className={`font-medium ${isLarge ? 'text-base' : 'text-sm'}`}>
              {participantName}
            </p>
            {!videoEnabled && (
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
          <div className="bg-green-500 text-white px-2 py-1 rounded text-xs font-medium flex items-center gap-1">
            <Monitor className="w-3 h-3" />
            Screen Share
          </div>
        </div>
      )}

      {/* Audio level indicator */}
      {audioEnabled && !isMuted && audioLevel > 0.1 && (
        <div className="absolute top-3 left-3 z-10">
          <div className="bg-green-500 text-white p-1 rounded-full">
            <Volume2 className="w-3 h-3" />
          </div>
        </div>
      )}

      {/* Overlay info */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className={`text-white font-medium ${isLarge ? 'text-base' : 'text-sm'}`}>
              {participantName} {isLocal && '(You)'}
            </span>
            {/* Connection quality indicator */}
            <div className="flex space-x-1">
              <div className="w-1 h-3 bg-green-400 rounded-full"></div>
              <div className="w-1 h-3 bg-green-400 rounded-full"></div>
              <div className="w-1 h-2 bg-gray-400 rounded-full"></div>
            </div>
          </div>
          
          <div className="flex items-center space-x-1">
            {/* Audio indicator */}
            {audioEnabled && !isMuted ? (
              <div className={`p-1 rounded ${audioLevel > 0.1 ? 'bg-green-500' : 'bg-gray-600'}`}>
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

            {/* Fullscreen toggle for mobile */}
            {onToggleFullscreen && (
              <button
                onClick={onToggleFullscreen}
                className="p-1 rounded bg-gray-600 hover:bg-gray-500 transition-colors lg:hidden"
              >
                <Maximize2 className="w-3 h-3 text-white" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Loading indicator */}
      {stream && !isVideoLoaded && videoEnabled && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      )}
    </div>
  );
}

interface VideoGridProps {
  localStream?: MediaStream;
  remoteStreams: Map<string, { stream: MediaStream; name: string; audioEnabled?: boolean; videoEnabled?: boolean }>;
  localParticipantName: string;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  handRaisedParticipants: Set<string>;
  localHandRaised: boolean;
  participantCount: number;
}

export function VideoGrid({
  localStream,
  remoteStreams,
  localParticipantName,
  isMuted,
  isCameraOff,
  isScreenSharing,
  handRaisedParticipants,
  localHandRaised,
  participantCount
}: VideoGridProps) {
  const [fullscreenParticipant, setFullscreenParticipant] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const totalParticipants = participantCount;
  
  // Enhanced grid layout logic
  const getGridClass = () => {
    if (fullscreenParticipant) return 'grid-cols-1';
    
    if (isMobile) {
      if (totalParticipants === 1) return 'grid-cols-1';
      if (totalParticipants === 2) return 'grid-cols-1 gap-2';
      return 'grid-cols-2 gap-2';
    }
    
    // Desktop layout
    if (totalParticipants === 1) return 'grid-cols-1';
    if (totalParticipants === 2) return 'grid-cols-1 lg:grid-cols-2';
    if (totalParticipants <= 4) return 'grid-cols-2';
    if (totalParticipants <= 6) return 'grid-cols-2 lg:grid-cols-3';
    if (totalParticipants <= 9) return 'grid-cols-3';
    return 'grid-cols-3 xl:grid-cols-4';
  };

  const handleToggleFullscreen = (participantId: string) => {
    setFullscreenParticipant(fullscreenParticipant === participantId ? null : participantId);
  };

  // Determine if we should show a participant in fullscreen mode
  const shouldShowInFullscreen = (participantId: string) => {
    return fullscreenParticipant === participantId;
  };

  // Get the main participant for mobile layout
  const getMainParticipant = () => {
    if (fullscreenParticipant === 'local') return 'local';
    if (fullscreenParticipant && remoteStreams.has(fullscreenParticipant)) {
      return fullscreenParticipant;
    }
    // Default to first remote participant or local if no remote
    const firstRemote = Array.from(remoteStreams.keys())[0];
    return firstRemote || 'local';
  };

  const mainParticipant = isMobile && totalParticipants > 1 ? getMainParticipant() : null;

  return (
    <div className="h-full flex flex-col">
      {/* Main video area for mobile */}
      {isMobile && totalParticipants > 1 && (
        <div className="flex-1 p-2">
          {mainParticipant === 'local' ? (
            <VideoTile
              stream={localStream}
              participantName={localParticipantName}
              isLocal={true}
              isMuted={isMuted}
              isCameraOff={isCameraOff}
              isScreenShare={isScreenSharing}
              handRaised={localHandRaised}
              isLarge={true}
              onToggleFullscreen={() => handleToggleFullscreen('local')}
              audioEnabled={!isMuted}
              videoEnabled={!isCameraOff}
            />
          ) : (
            (() => {
              const remoteData = remoteStreams.get(mainParticipant!);
              return remoteData ? (
                <VideoTile
                  stream={remoteData.stream}
                  participantName={remoteData.name}
                  isLocal={false}
                  handRaised={handRaisedParticipants.has(mainParticipant!)}
                  isLarge={true}
                  onToggleFullscreen={() => handleToggleFullscreen(mainParticipant!)}
                  audioEnabled={remoteData.audioEnabled}
                  videoEnabled={remoteData.videoEnabled}
                />
              ) : null;
            })()
          )}
        </div>
      )}

      {/* Thumbnail strip for mobile or main grid */}
      <div className={`${
        isMobile && totalParticipants > 1 
          ? 'h-24 p-2 bg-gray-900/50' 
          : 'flex-1 p-4'
      }`}>
        <div className={`${
          isMobile && totalParticipants > 1
            ? 'flex space-x-2 overflow-x-auto'
            : `grid gap-4 h-full ${getGridClass()}`
        }`}>
          {/* Local video */}
          {(!isMobile || totalParticipants === 1 || mainParticipant !== 'local') && (
            <div className={isMobile && totalParticipants > 1 ? 'flex-shrink-0 w-20' : ''}>
              <VideoTile
                stream={localStream}
                participantName={localParticipantName}
                isLocal={true}
                isMuted={isMuted}
                isCameraOff={isCameraOff}
                isScreenShare={isScreenSharing}
                handRaised={localHandRaised}
                isLarge={!isMobile || totalParticipants === 1}
                onToggleFullscreen={() => handleToggleFullscreen('local')}
                audioEnabled={!isMuted}
                videoEnabled={!isCameraOff}
              />
            </div>
          )}

          {/* Remote videos */}
          {Array.from(remoteStreams.entries()).map(([peerId, { stream, name, audioEnabled, videoEnabled }]) => {
            if (isMobile && totalParticipants > 1 && mainParticipant === peerId) {
              return null; // Skip if this is the main participant on mobile
            }
            
            return (
              <div key={peerId} className={isMobile && totalParticipants > 1 ? 'flex-shrink-0 w-20' : ''}>
                <VideoTile
                  stream={stream}
                  participantName={name}
                  isLocal={false}
                  handRaised={handRaisedParticipants.has(peerId)}
                  isLarge={!isMobile || totalParticipants === 1}
                  onToggleFullscreen={() => handleToggleFullscreen(peerId)}
                  audioEnabled={audioEnabled}
                  videoEnabled={videoEnabled}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Participant count indicator */}
      <div className="absolute top-4 left-4 bg-black/50 text-white px-3 py-1 rounded-full text-sm font-medium backdrop-blur-sm">
        {participantCount} participant{participantCount !== 1 ? 's' : ''}
      </div>
    </div>
  );
}