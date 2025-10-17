import React, { useEffect, useState } from 'react';
import { useSubscription } from '../hooks/useSubscription';
import { useSupabaseAuth } from '../hooks/useSupabaseAuth';
import { supabase } from '../lib/supabaseClient';
import { logger } from '../lib/logger';

interface DevTierSwitcherProps {
  onTierChange?: (newTier: string) => void;
}

export const DevTierSwitcher: React.FC<DevTierSwitcherProps> = ({ onTierChange }) => {
  const { user } = useSupabaseAuth();
  const { profile, refresh } = useSubscription(user?.id);
  const [currentTier, setCurrentTier] = useState<string>('free');
  const [isUpdating, setIsUpdating] = useState(false);

  // Hide in production builds
  if (import.meta.env.MODE === 'production') {
    return null;
  }

  useEffect(() => {
    if (profile?.tier) {
      setCurrentTier(profile.tier);
    }
  }, [profile?.tier]);

  const handleTierChange = async (newTier: string) => {
    if (!user || isUpdating) return;

    setIsUpdating(true);

    try {
      // 1. Update backend via Supabase
      const { error } = await supabase
        .from('profiles')
        .update({ 
          subscription_tier: newTier,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) {
        throw error;
      }

      logger.debug('✅ Backend tier updated');

      // 2. Clear Dexie cache (force next read to pull from backend)
      try {
        // Clear any cached profile data
        if (window.db?.profiles) {
          await window.db.profiles.clear();
          logger.debug('✅ Dexie cache cleared');
        }
      } catch (dexieError) {
      // Intentionally empty - error handling not required
      }

      // 3. Refresh React state (re-fetch profile from backend)
      await refresh();
      logger.debug('✅ React state refreshed');

      // 4. Update local state
      setCurrentTier(newTier);
      onTierChange?.(newTier);


    } catch (error) {
      // Intentionally empty - error handling not required
    } finally {
      setIsUpdating(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="fixed top-20 right-4 bg-yellow-100 border border-yellow-300 rounded-lg p-3 shadow-lg z-50">
      <div className="text-xs font-semibold text-yellow-800 mb-2">
        🧪 Dev Tier Switcher
      </div>
      <div className="flex items-center space-x-2">
        <label className="text-xs text-yellow-700">Tier:</label>
        <select
          value={currentTier}
          onChange={(e) => handleTierChange(e.target.value)}
          disabled={isUpdating}
          className="text-xs border border-yellow-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-yellow-500"
        >
          <option value="free">Free</option>
          <option value="core">Core</option>
          <option value="studio">Studio</option>
        </select>
        {isUpdating && (
          <div className="text-xs text-yellow-600">Updating...</div>
        )}
      </div>
      <div className="text-xs text-yellow-600 mt-1">
        Current: {currentTier}
      </div>
    </div>
  );
};