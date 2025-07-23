import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn('Supabase environment variables are not set. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          role: 'host' | 'participant' | 'admin';
          avatar_url?: string;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          role?: 'host' | 'participant' | 'admin';
          avatar_url?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          role?: 'host' | 'participant' | 'admin';
          avatar_url?: string;
          created_at?: string;
        };
      };
      meetings: {
        Row: {
          id: string;
          title: string;
          host_id: string;
          start_time: string;
          end_time?: string;
          is_private: boolean;
          access_code: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          host_id: string;
          start_time: string;
          end_time?: string;
          is_private?: boolean;
          access_code: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          host_id?: string;
          start_time?: string;
          end_time?: string;
          is_private?: boolean;
          access_code?: string;
          created_at?: string;
        };
      };
      participants: {
        Row: {
          id: string;
          user_id?: string;
          meeting_id: string;
          name: string;
          joined_at: string;
          left_at?: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          meeting_id: string;
          name: string;
          joined_at?: string;
          left_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          meeting_id?: string;
          name?: string;
          joined_at?: string;
          left_at?: string;
        };
      };
    };
  };
};