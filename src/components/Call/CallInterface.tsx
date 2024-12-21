import React, { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { CallService } from '../../services/calls';

interface CallInterfaceProps {
  chatId: string;
  callType: 'audio' | 'video';
  remoteUserId: string;
  currentUserId: string;
  onEndCall: () => void;
}

export const CallInterface: React.FC<CallInterfaceProps> = ({
  chatId,
  callType,
  remoteUserId,
  currentUserId,
  onEndCall,
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callService, setCallService] = useState<CallService | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (chatId && currentUserId && remoteUserId) {
      try {
        setCallService(new CallService(chatId, currentUserId));
      } catch (error) {
        console.error('Error creating call service:', error);
        setError('Failed to initialize call');
        onEndCall();
      }
    }
  }, [chatId, currentUserId, remoteUserId, onEndCall]);

  useEffect(() => {
    if (!callService) return;

    const initializeCall = async () => {
      try {
        callService.onRemoteStream = (stream) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = stream;
          }
        };

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: callType === 'video',
        });

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        await callService.startCall(stream);
        await callService.createOffer();
      } catch (error) {
        console.error('Error starting call:', error);
        setError('Failed to start call');
        onEndCall();
      }
    };

    initializeCall();

    return () => {
      callService.close();
    };
  }, [callService, callType, onEndCall]);

  const toggleMute = () => {
    const stream = localVideoRef.current?.srcObject as MediaStream;
    if (stream) {
      stream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    const stream = localVideoRef.current?.srcObject as MediaStream;
    if (stream) {
      stream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center">
        <div className="bg-white p-4 rounded-lg text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={onEndCall}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (!callService) {
    return <div>Initializing call...</div>;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center">
      <div className="relative w-full max-w-4xl">
        {/* Remote Video */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full rounded-lg"
        />
        
        {/* Local Video (Picture-in-Picture) */}
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="absolute top-4 right-4 w-48 rounded-lg border-2 border-white"
        />

        {/* Controls */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-4">
          <button
            onClick={toggleMute}
            className="p-4 rounded-full bg-white hover:bg-gray-100"
          >
            {isMuted ? <MicOff /> : <Mic />}
          </button>
          
          {callType === 'video' && (
            <button
              onClick={toggleVideo}
              className="p-4 rounded-full bg-white hover:bg-gray-100"
            >
              {isVideoOff ? <VideoOff /> : <Video />}
            </button>
          )}
          
          <button
            onClick={onEndCall}
            className="p-4 rounded-full bg-red-500 hover:bg-red-600 text-white"
          >
            <PhoneOff />
          </button>
        </div>
      </div>
    </div>
  );
}; 