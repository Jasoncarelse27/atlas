/**
 * Favorite Rituals Hook
 * Manages user's favorite rituals with optimistic updates
 */

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabaseClient';
import { useTierQuery } from '@/hooks/useTierQuery';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

export function useFavoriteRituals() {
  const { userId } = useTierQuery();
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Load favorites on mount
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const loadFavorites = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('favorite_ritual_ids')
          .eq('id', userId)
          .single() as { data: { favorite_ritual_ids?: string[] } | null };

        if (data?.favorite_ritual_ids) {
          setFavoriteIds(data.favorite_ritual_ids as string[]);
        }
      } catch (error) {
        logger.error('[useFavoriteRituals] Failed to load favorites:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFavorites();
  }, [userId]);

  // Toggle favorite with optimistic update
  const toggleFavorite = useCallback(async (ritualId: string) => {
    if (!userId) return;

    const wasFavorite = favoriteIds.includes(ritualId);
    const newFavorites = wasFavorite
      ? favoriteIds.filter(id => id !== ritualId)
      : [...favoriteIds, ritualId];

    // Optimistic update
    setFavoriteIds(newFavorites);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ favorite_ritual_ids: newFavorites } as any)
        .eq('id', userId);

      if (error) throw error;

      // Success feedback
      toast.success(wasFavorite ? 'Removed from favorites' : 'Added to favorites', {
        duration: 2000,
      });
    } catch (error) {
      // Revert on error
      setFavoriteIds(favoriteIds);
      logger.error('[useFavoriteRituals] Failed to update favorites:', error);
      toast.error('Failed to update favorites');
    }
  }, [userId, favoriteIds]);

  return {
    favoriteIds,
    toggleFavorite,
    isFavorite: (ritualId: string) => favoriteIds.includes(ritualId),
    loading,
  };
}
