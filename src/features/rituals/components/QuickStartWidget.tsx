/**
 * Quick Start Widget
 * Shows "Continue Your Last Ritual" button for easy re-runs
 */

import { logger } from '@/lib/logger';
import { useTierQuery } from '@/hooks/useTierQuery';
import { Clock, RotateCcw } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import type { Ritual } from '../types/rituals';
import { useRitualStore } from '../hooks/useRitualStore';

export const QuickStartWidget: React.FC = () => {
  const navigate = useNavigate();
  const { userId } = useTierQuery();
  const { presets, userRituals } = useRitualStore();
  const [lastRitual, setLastRitual] = useState<Ritual | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLastRitual = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        // Get the last ritual from profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('last_ritual_id')
          .eq('id', userId)
          .single() as { data: { last_ritual_id?: string } | null };

        if (profile?.last_ritual_id) {
          // Find the ritual in our local state
          const allRituals = [...presets, ...userRituals];
          const ritual = allRituals.find(r => r.id === profile.last_ritual_id!);
          if (ritual) {
            setLastRitual(ritual);
          }
        }
      } catch (error) {
        logger.error('[QuickStartWidget] Failed to fetch last ritual:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLastRitual();
  }, [userId, presets, userRituals]);

  if (loading) {
    // ✅ Mobile: Loading skeleton prevents layout shift
    return (
      <div className="bg-white rounded-2xl p-6 mb-6 border-2 border-gray-200 animate-pulse">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 rounded bg-gray-200" />
              <div className="h-5 bg-gray-200 rounded w-40" />
            </div>
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
            <div className="flex items-center gap-3">
              <div className="h-4 bg-gray-200 rounded w-16" />
              <div className="h-4 bg-gray-200 rounded w-20" />
            </div>
          </div>
          <div className="w-24 h-12 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!lastRitual) {
    return null; // Don't show widget if no last ritual
  }

  const totalMinutes = Math.ceil(lastRitual.steps.reduce((sum, step) => sum + step.duration, 0) / 60);

  return (
    <div className="bg-gradient-to-r from-[#E8DDD2] to-[#F5F0E8] rounded-2xl p-6 mb-6 border-2 border-[#D4C4A8]">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <RotateCcw size={20} className="text-[#8B7E74]" />
            <h3 className="text-lg font-semibold text-[#3B3632]">Continue Your Ritual</h3>
          </div>
          <p className="text-[#8B7E74] text-sm mb-3">
            {lastRitual.title}
          </p>
          <div className="flex items-center gap-3 text-sm text-[#8B7E74]">
            <span className="flex items-center gap-1">
              <Clock size={14} />
              {totalMinutes} min
            </span>
            <span className="capitalize px-2 py-0.5 bg-white/50 rounded-full text-xs">
              {lastRitual.goal}
            </span>
          </div>
        </div>
        <button
          onClick={() => navigate(`/rituals/run/${lastRitual.id}`)}
          className="px-6 py-3 bg-[#3B3632] text-white rounded-xl hover:bg-[#2A2621] 
                     transition-colors font-medium whitespace-nowrap"
        >
          Start Now
        </button>
      </div>
    </div>
  );
};
