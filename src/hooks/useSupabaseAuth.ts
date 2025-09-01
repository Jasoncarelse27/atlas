import type { Session, User } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type UserTier = 'free' | 'core' | 'studio';

interface UseSupabaseAuthResult {
  session: Session | null;
  user: User | null;
  accessToken: string | null;
  tier: UserTier;
  isLoading: boolean;
  error: string | null;
}

export function useSupabaseAuth(): UseSupabaseAuthResult {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [tier, setTier] = useState<UserTier>('free');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        setIsLoading(true);
        setError(null);
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
      } finally {
        setIsLoading(false);
      }
    };
    init();

    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setAccessToken(newSession?.access_token ?? null);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const loadTier = async () => {
      if (!user) {
        setTier('free');
        return;
      }
      try {
        const { data, error } = await supabase
          .from('subscriptions')
          .select('tier')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle();

        if (error) {
          setTier('free');
          return;
        }

        const dbTier = (data?.tier as UserTier | undefined) ?? 'free';
        setTier(dbTier);
      } catch {
        setTier('free');
      }
    };

    loadTier();
  }, [user?.id]);

  return { session, user, accessToken, tier, isLoading, error };
}


