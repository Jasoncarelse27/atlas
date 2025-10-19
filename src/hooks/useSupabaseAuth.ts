import type { Session, User } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useTierQuery } from './useTierQuery'; // Import modern tier hook

type UserTier = 'free' | 'core' | 'studio';

interface UseSupabaseAuthResult {
  session: Session | null;
  user: User | null;
  accessToken: string | null;
  tier: UserTier;
  isLoading: boolean;
  error: string | null;
}

/**
 * Supabase authentication hook with centralized tier management
 * @deprecated Consider using useTierQuery directly for tier-only needs
 */
export function useSupabaseAuth(): UseSupabaseAuthResult {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ✅ Use centralized tier from React Query (no duplicate fetches)
  const { tier, isLoading: tierLoading } = useTierQuery();

  useEffect(() => {
    const init = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          setError(error.message);
        }
        if (data?.session) {
          setSession(data.session);
          setUser(data.session.user);
          setAccessToken(data.session.access_token ?? null);
        } else {
          setSession(null);
          setUser(null);
          setAccessToken(null);
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to load session');
      }
    };
    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setAccessToken(newSession?.access_token ?? null);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  return { 
    session, 
    user, 
    accessToken, 
    tier, // From React Query - single source of truth
    isLoading: tierLoading, 
    error 
  };
}


