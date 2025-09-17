import { createClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

// Mobile Supabase configuration
// For development, you can use environment variables or hardcode for testing
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Mobile auth hook with fallback for development
export const useAuth = () => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // For development, create a mock session if Supabase is not configured
    if (supabaseUrl === 'https://your-project.supabase.co') {
      const mockSession = {
        access_token: 'mock-token-for-development',
        user: { id: 'mobile-dev-user' }
      };
      setSession(mockSession);
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { session, loading };
};
