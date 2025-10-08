import { useEffect, useState } from 'react';
import type { Tier } from '../types/tier';
import { supabase } from '../lib/supabase';

export function useUserTier(userId: string | undefined) {
  const [tier, setTier] = useState<Tier>('free');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    async function fetchTier() {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('subscription_tier')
          .eq('id', userId)
          .single();

        if (error) {
          setTier('free');
        } else {
          const dbTier = data?.subscription_tier;
          if (dbTier === 'core' || dbTier === 'studio') {
            setTier(dbTier as Tier);
          } else {
            setTier('free');
          }
        }
      } catch (error) {
        setTier('free');
      } finally {
        setLoading(false);
      }
    }

    fetchTier();
  }, [userId]);

  return { tier, loading };
}
