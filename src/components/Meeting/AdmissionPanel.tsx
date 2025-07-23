import React, { useState, useEffect } from 'react';
import { User, CheckCircle, XCircle, Clock, Shield } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface PendingParticipant {
  id: string;
  name: string;
  joined_at: string;
  user_id?: string;
}

interface AdmissionPanelProps {
  meetingId: string;
  isHost: boolean;
  onParticipantAdmitted: (participantId: string) => void;
  onParticipantRejected: (participantId: string) => void;
}

export function AdmissionPanel({ 
  meetingId, 
  isHost, 
  onParticipantAdmitted, 
  onParticipantRejected 
}: AdmissionPanelProps) {
  const [pendingParticipants, setPendingParticipants] = useState<PendingParticipant[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!isHost) return;

    fetchPendingParticipants();
    
    // Set up real-time subscription for pending participants
    const channel = supabase
      .channel(`admission-${meetingId}`)
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'participants',
          filter: `meeting_id=eq.${meetingId}`
        }, 
        (payload) => {
          const newParticipant = payload.new as PendingParticipant;
          if (!newParticipant.left_at) {
            setPendingParticipants(prev => [...prev, newParticipant]);
            setIsVisible(true);
            toast.info(`${newParticipant.name} wants to join the meeting`);
          }
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
          const updatedParticipant = payload.new as PendingParticipant & { admitted?: boolean };
          setPendingParticipants(prev => 
            prev.filter(p => p.id !== updatedParticipant.id)
          );
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [meetingId, isHost]);

  const fetchPendingParticipants = async () => {
    try {
      const { data, error } = await supabase
        .from('participants')
        .select('*')
        .eq('meeting_id', meetingId)
        .is('admitted', null)
        .is('left_at', null)
        .order('joined_at', { ascending: true });

      if (error) throw error;
      
      setPendingParticipants(data || []);
      setIsVisible((data || []).length > 0);
    } catch (error) {
      console.error('Error fetching pending participants:', error);
    }
  };

  const admitParticipant = async (participantId: string, participantName: string) => {
    try {
      const { error } = await supabase
        .from('participants')
        .update({ admitted: true })
        .eq('id', participantId);

      if (error) throw error;

      setPendingParticipants(prev => prev.filter(p => p.id !== participantId));
      onParticipantAdmitted(participantId);
      toast.success(`${participantName} has been admitted to the meeting`);
      
      if (pendingParticipants.length <= 1) {
        setIsVisible(false);
      }
    } catch (error) {
      console.error('Error admitting participant:', error);
      toast.error('Failed to admit participant');
    }
  };

  const rejectParticipant = async (participantId: string, participantName: string) => {
    try {
      const { error } = await supabase
        .from('participants')
        .update({ left_at: new Date().toISOString() })
        .eq('id', participantId);

      if (error) throw error;

      setPendingParticipants(prev => prev.filter(p => p.id !== participantId));
      onParticipantRejected(participantId);
      toast.info(`${participantName} was not admitted to the meeting`);
      
      if (pendingParticipants.length <= 1) {
        setIsVisible(false);
      }
    } catch (error) {
      console.error('Error rejecting participant:', error);
      toast.error('Failed to reject participant');
    }
  };

  const admitAll = async () => {
    try {
      const participantIds = pendingParticipants.map(p => p.id);
      
      const { error } = await supabase
        .from('participants')
        .update({ admitted: true })
        .in('id', participantIds);

      if (error) throw error;

      pendingParticipants.forEach(p => onParticipantAdmitted(p.id));
      setPendingParticipants([]);
      setIsVisible(false);
      toast.success(`Admitted ${pendingParticipants.length} participant${pendingParticipants.length > 1 ? 's' : ''}`);
    } catch (error) {
      console.error('Error admitting all participants:', error);
      toast.error('Failed to admit all participants');
    }
  };

  if (!isHost || !isVisible || pendingParticipants.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 max-w-sm w-full mx-4 sm:mx-0">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Waiting to Join</h3>
            <p className="text-xs text-gray-500">{pendingParticipants.length} participant{pendingParticipants.length > 1 ? 's' : ''}</p>
          </div>
        </div>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-gray-600 p-1"
        >
          <XCircle className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-3 max-h-64 overflow-y-auto">
        {pendingParticipants.map((participant) => (
          <div key={participant.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
                <span className="text-white font-medium text-sm">
                  {participant.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="font-medium text-gray-900 text-sm">{participant.name}</p>
                <div className="flex items-center space-x-1 text-xs text-gray-500">
                  <Clock className="w-3 h-3" />
                  <span>Waiting</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => rejectParticipant(participant.id, participant.name)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Reject"
              >
                <XCircle className="w-4 h-4" />
              </button>
              <button
                onClick={() => admitParticipant(participant.id, participant.name)}
                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                title="Admit"
              >
                <CheckCircle className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {pendingParticipants.length > 1 && (
        <div className="mt-4 pt-3 border-t border-gray-200">
          <button
            onClick={admitAll}
            className="w-full py-2 px-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all text-sm"
          >
            Admit All ({pendingParticipants.length})
          </button>
        </div>
      )}
      
      <div className="mt-3 flex items-center justify-center space-x-1 text-xs text-gray-500">
        <Shield className="w-3 h-3" />
        <span>Host controls</span>
      </div>
    </div>
  );
}