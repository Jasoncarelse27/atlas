/**
 * Streak Freeze Component
 * Allows Core/Studio users to protect their streak once per month
 */

import { useTierQuery } from '@/hooks/useTierQuery';
import { useUpgradeModals } from '@/contexts/UpgradeModalContext';
import { Shield, Snowflake, Check } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { streakService } from '../services/streakService';
import { format } from 'date-fns';

export const StreakFreeze: React.FC = () => {
  const { userId, tier } = useTierQuery();
  const { showGenericUpgrade } = useUpgradeModals();
  const [canUseFreeze, setCanUseFreeze] = useState(false);
  const [loading, setLoading] = useState(true);
  const [freezeUsedDate, setFreezeUsedDate] = useState<string | null>(null);

  useEffect(() => {
    const checkFreezeStatus = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        const canUse = await streakService.canUseStreakFreeze(userId);
        setCanUseFreeze(canUse);
        
        // Also check when it was last used
        const { data: profile } = await supabase
          .from('profiles')
          .select('streak_freeze_used_at')
          .eq('id', userId)
          .single() as { data: { streak_freeze_used_at?: string | null } | null };
          
        if (profile?.streak_freeze_used_at) {
          setFreezeUsedDate(profile.streak_freeze_used_at);
        }
      } catch (error) {
        console.error('Failed to check freeze status:', error);
      } finally {
        setLoading(false);
      }
    };

    checkFreezeStatus();
  }, [userId]);

  const handleUseFreeze = async () => {
    if (tier === 'free') {
      showGenericUpgrade('audio');
      return;
    }

    if (!canUseFreeze) return;

    const result = await streakService.useStreakFreeze(userId!);
    
    if (result.success) {
      toast.success(result.message, {
        icon: <Snowflake className="w-4 h-4" />,
        duration: 5000,
      });
      setCanUseFreeze(false);
      setFreezeUsedDate(new Date().toISOString());
    } else {
      toast.error(result.message);
    }
  };

  if (loading) return null;

  // Free tier sees upgrade prompt
  if (tier === 'free') {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-4 mb-4 border border-blue-200/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/80 shadow-sm">
              <Shield className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">Streak Freeze</p>
              <p className="text-xs text-gray-600">Protect your streak once per month</p>
            </div>
          </div>
          <button
            onClick={() => showGenericUpgrade('audio')}
            className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 
                       transition-colors font-medium"
          >
            Unlock
          </button>
        </div>
      </div>
    );
  }

  // Core/Studio users
  const usedThisMonth = freezeUsedDate && 
    new Date(freezeUsedDate).getMonth() === new Date().getMonth() &&
    new Date(freezeUsedDate).getFullYear() === new Date().getFullYear();

  const usedToday = freezeUsedDate && 
    format(new Date(freezeUsedDate), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

  if (usedThisMonth) {
    return (
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-4 mb-4 border border-gray-200/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/80 shadow-sm">
              <Shield className="w-5 h-5 text-gray-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">
                Streak Freeze {usedToday && <span className="text-green-600">Active Today</span>}
              </p>
              <p className="text-xs text-gray-600">
                Used on {format(new Date(freezeUsedDate), 'MMM d')} • Resets next month
              </p>
            </div>
          </div>
          {usedToday && (
            <div className="p-2 rounded-lg bg-green-100">
              <Check className="w-4 h-4 text-green-600" />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-4 mb-4 border border-blue-200/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-white/80 shadow-sm">
            <Shield className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-800">Streak Freeze Available</p>
            <p className="text-xs text-gray-600">Miss a day? Use your monthly freeze</p>
          </div>
        </div>
        <button
          onClick={handleUseFreeze}
          disabled={!canUseFreeze}
          className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 
                     transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed
                     flex items-center gap-2"
        >
          <Snowflake className="w-4 h-4" />
          Use Freeze
        </button>
      </div>
    </div>
  );
};

// Missing import
import { supabase } from '@/lib/supabaseClient';
