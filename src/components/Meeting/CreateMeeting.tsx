import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, Lock, Globe, Copy, Video } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

export function CreateMeeting() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    hostName: '',
  });

  const generateAccessCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!formData.title.trim() || !formData.hostName.trim()) {
      toast.error('Please enter meeting title and your name');
      return;
    }

    setLoading(true);
    try {
      const accessCode = generateAccessCode();
      
      const { data, error } = await supabase
        .from('meetings')
        .insert({
          title: formData.title.trim(),
          host_name: formData.hostName.trim(),
          start_time: new Date().toISOString(),
          is_private: false,
          access_code: accessCode,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Meeting created successfully!');
      navigate(`/meeting/${accessCode}`, {
        state: {
          meetingTitle: formData.title.trim(),
          hostName: formData.hostName.trim(),
          isHost: true,
        }
      });
    } catch (error: any) {
      console.error('Error creating meeting:', error);
      toast.error(error.message || 'Failed to create meeting');
    } finally {
      setLoading(false);
    }
  };

  const startInstantMeeting = async () => {
    if (loading) return;

    if (!formData.hostName.trim()) {
      toast.error('Please enter your name first');
      return;
    }

    setLoading(true);
    try {
      const accessCode = generateAccessCode();
      const now = new Date().toISOString();
      
      const { data, error } = await supabase
        .from('meetings')
        .insert({
          title: 'Instant Meeting',
          host_name: formData.hostName.trim(),
          start_time: now,
          is_private: false,
          access_code: accessCode,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Instant meeting started!');
      navigate(`/meeting/${accessCode}`, {
        state: {
          meetingTitle: 'Instant Meeting',
          hostName: formData.hostName.trim(),
          isHost: true,
        }
      });
    } catch (error: any) {
      console.error('Error starting instant meeting:', error);
      toast.error(error.message || 'Failed to start meeting');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Create a Meeting</h1>
          <p className="text-gray-600">Schedule a meeting or start one instantly</p>
        </div>

        {/* Instant Meeting */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-6 sm:p-8 mb-6 sm:mb-8 text-white">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold mb-2">Start Instant Meeting</h2>
              <p className="text-blue-100">Enter your name and start a meeting instantly</p>
            </div>
            <button
              onClick={startInstantMeeting}
              disabled={loading || !formData.hostName.trim()}
              className="bg-white text-blue-600 px-4 sm:px-6 py-2 sm:py-3 rounded-xl font-semibold hover:bg-blue-50 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 w-full sm:w-auto justify-center"
            >
              <Video className="w-5 h-5" />
              Start Now
            </button>
          </div>
        </div>

        {/* Schedule Meeting */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6">Create a Meeting</h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="hostName" className="block text-sm font-medium text-gray-700 mb-2">
                Your Name *
              </label>
              <input
                type="text"
                id="hostName"
                name="hostName"
                required
                value={formData.hostName}
                onChange={handleInputChange}
                className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base"
                placeholder="Enter your name"
              />
            </div>

            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                Meeting Title *
              </label>
              <input
                type="text"
                id="title"
                name="title"
                required
                value={formData.title}
                onChange={handleInputChange}
                className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base"
                placeholder="Enter meeting title"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="flex-1 px-4 sm:px-6 py-2 sm:py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  'Creating...'
                ) : (
                  <>
                    <Calendar className="w-4 h-4" />
                    Create Meeting
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}