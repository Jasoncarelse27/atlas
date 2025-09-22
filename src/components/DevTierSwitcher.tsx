import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface DevTierSwitcherProps {
  onTierChange?: (newTier: string) => void;
}

export const DevTierSwitcher: React.FC<DevTierSwitcherProps> = ({ onTierChange }) => {
  const { user } = useAuth();
  const [currentTier, setCurrentTier] = useState<string>('free');
  const [isUpdating, setIsUpdating] = useState(false);

  // Only render in development mode
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  useEffect(() => {
    if (user) {
      fetchCurrentTier();
    }
  }, [user]);

  const fetchCurrentTier = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching current tier:', error);
        return;
      }

      setCurrentTier(data.subscription_tier || 'free');
    } catch (err) {
      console.error('Error fetching tier:', err);
    }
  };

  const handleTierChange = async (newTier: string) => {
    if (!user || isUpdating) return;

    setIsUpdating(true);
    try {
      console.log(`[DevTierSwitcher] Updating tier from ${currentTier} to ${newTier}`);

      const { error } = await supabase
        .from('profiles')
        .update({ 
          subscription_tier: newTier,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) {
        console.error('Error updating tier:', error);
        return;
      }

      setCurrentTier(newTier);
      onTierChange?.(newTier);
      
      // Show success message
      console.log(`✅ Upgrade successful! Tier: ${newTier} (voice + image unlocked)`);
      
      // Refresh the page to update all components
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (err) {
      console.error('Error updating tier:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-yellow-100 border border-yellow-300 rounded-lg p-3 shadow-lg z-50">
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
