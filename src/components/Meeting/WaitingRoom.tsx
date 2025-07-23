import React, { useState, useEffect } from 'react';
import { Clock, User, Shield, CheckCircle, XCircle } from 'lucide-react';

interface WaitingRoomProps {
  meetingTitle: string;
  participantName: string;
  meetingId: string;
  onAdmitted: () => void;
  onRejected: () => void;
}

export function WaitingRoom({ meetingTitle, participantName, meetingId, onAdmitted, onRejected }: WaitingRoomProps) {
  const [waitingTime, setWaitingTime] = useState(0);
  const [admissionStatus, setAdmissionStatus] = useState<'waiting' | 'admitted' | 'rejected'>('waiting');

  useEffect(() => {
    const interval = setInterval(() => {
      setWaitingTime(prev => prev + 1);
    }, 1000);

    // Set up real-time admission status monitoring
    const admissionChannel = supabase
      .channel(`waiting-${meetingId}-${participantName}`)
      .on('postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'participants',
          filter: `meeting_id=eq.${meetingId}`
        },
        (payload) => {
          const updatedParticipant = payload.new as any;
          if (updatedParticipant.name === participantName) {
            if (updatedParticipant.admitted === true) {
              setAdmissionStatus('admitted');
              onAdmitted();
            } else if (updatedParticipant.left_at) {
              setAdmissionStatus('rejected');
              onRejected();
            }
          }
        }
      )
      .subscribe();
      admissionChannel.unsubscribe();
    return () => clearInterval(interval);
  }, [meetingId, participantName, onAdmitted, onRejected]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-200 p-8 text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <Clock className="w-8 h-8 text-white animate-pulse" />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Waiting for Host</h1>
        <p className="text-gray-600 mb-6">
          You're in the waiting room for <span className="font-semibold">"{meetingTitle}"</span>
        </p>
        
        <div className="bg-gray-50 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-center space-x-2 mb-3">
            <User className="w-5 h-5 text-gray-500" />
            <span className="text-gray-700 font-medium">{participantName}</span>
          </div>
          <div className="flex items-center justify-center space-x-2">
            <Clock className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600">Waiting: {formatTime(waitingTime)}</span>
          </div>
        </div>
        
        <div className="space-y-3 text-sm text-gray-600">
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-green-500" />
            <span>Your connection is secure</span>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-blue-500" />
            <span>Audio and video are ready</span>
          </div>
        </div>
        
        <div className="mt-8 p-4 bg-blue-50 rounded-xl">
          <p className="text-sm text-blue-700">
            The host will admit you shortly. Please wait while they review your request to join.
          </p>
        </div>
        
        <div className="mt-6">
          <div className="flex space-x-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}