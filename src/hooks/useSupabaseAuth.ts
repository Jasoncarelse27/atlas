import type { Session, User } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { subscriptionApi } from '../services/subscriptionApi';
import { logger } from '../lib/logger';

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

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
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
      if (!user || !accessToken) {
        setTier('free');
        setIsLoading(false);
        return;
      }
      try {
        // Use subscription API instead of direct Supabase call
        const profile = await subscriptionApi.getUserProfile(user.id, accessToken);
        const dbTier = (profile?.subscription_tier as UserTier | undefined) ?? 'free';
        
        // Future-proof tier validation
        if (dbTier && ['free', 'core', 'studio'].includes(dbTier)) {
          setTier(dbTier);
          logger.debug(`✅ [useSupabaseAuth] Tier loaded: ${dbTier}`);
        } else {
          setTier('free'); // Default to free when no valid tier found
        }
      } catch (error) {
        setTier('free'); // Default to free on error
      } finally {
        setIsLoading(false); // Always set loading to false after tier loads
      }
    };

    loadTier();
  }, [user?.id, accessToken]);

  return { session, user, accessToken, tier, isLoading, error };
}


