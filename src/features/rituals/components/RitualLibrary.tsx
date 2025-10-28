/**
 * Ritual Library - Grid of Preset Rituals
 * Displays rituals filtered by user tier with upgrade prompts
 */

import { useUpgradeModals } from '@/contexts/UpgradeModalContext';
import { useTierQuery } from '@/hooks/useTierQuery';
import { Plus, Sparkles } from 'lucide-react';
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRitualStore } from '../hooks/useRitualStore';
import type { Ritual } from '../types/rituals';
import { RitualStepCard } from './RitualStepCard';

export const RitualLibrary: React.FC = () => {
  const navigate = useNavigate();
  const { tier, userId } = useTierQuery();
  const { showGenericUpgrade } = useUpgradeModals();
  const { presets, userRituals, loading, loadPresets, loadUserRituals } = useRitualStore();

  useEffect(() => {
    loadPresets();
    if (userId) {
      loadUserRituals(userId);
    }
  }, [userId, loadPresets, loadUserRituals]);

  // Filter presets by tier
  const visiblePresets = presets.filter((ritual) => {
    if (tier === 'free') return ritual.tierRequired === 'free';
    if (tier === 'core')
      return ritual.tierRequired === 'free' || ritual.tierRequired === 'core';
    return true; // Studio sees all
  });

  const handleStartRitual = (ritual: Ritual) => {
    navigate(`/rituals/run/${ritual.id}`);
  };

  const handlePreviewLocked = (ritual: Ritual) => {
    // Show upgrade modal
    showGenericUpgrade(ritual.tierRequired === 'studio' ? 'voice_calls' : 'audio');
  };

  const handleCreateRitual = () => {
    if (tier === 'free') {
      showGenericUpgrade('audio');
    } else {
      // Navigate to builder (Phase 3)
      navigate('/rituals/builder');
    }
  };

  if (loading && presets.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F9F6F1]">
        <div className="text-center">
          <Sparkles className="w-12 h-12 text-[#B2BDA3] animate-pulse mx-auto mb-4" />
          <p className="text-gray-600">Loading rituals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9F6F1]">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#3B3632] mb-2">Ritual Library</h1>
            <p className="text-gray-600">
              Micro-moments for energy, calm, focus, and creativity
            </p>
          </div>

          {/* Create Custom Ritual Button */}
          <button
            onClick={handleCreateRitual}
            className="flex items-center gap-2 px-6 py-3 bg-[#3B3632] text-white rounded-xl hover:bg-[#2A2621] transition-colors"
          >
            <Plus size={20} />
            <span className="font-medium">Create Ritual</span>
          </button>
        </div>

        {/* User's Custom Rituals */}
        {userRituals.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xl font-semibold text-[#3B3632] mb-4">Your Custom Rituals</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {userRituals.map((ritual) => (
                <RitualStepCard
                  key={ritual.id}
                  ritual={ritual}
                  userTier={tier}
                  onStart={handleStartRitual}
                />
              ))}
            </div>
          </div>
        )}

        {/* Preset Rituals */}
        <div>
          <h2 className="text-xl font-semibold text-[#3B3632] mb-4">Preset Rituals</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visiblePresets.map((ritual) => (
              <RitualStepCard
                key={ritual.id}
                ritual={ritual}
                userTier={tier}
                onStart={handleStartRitual}
                onPreview={handlePreviewLocked}
              />
            ))}
          </div>
        </div>

        {/* Locked Presets (show grayed out for free users) */}
        {tier === 'free' && presets.filter((r) => r.tierRequired !== 'free').length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-semibold text-gray-400 mb-4">Unlock with Core</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {presets
                .filter((r) => r.tierRequired !== 'free')
                .map((ritual) => (
                  <RitualStepCard
                    key={ritual.id}
                    ritual={ritual}
                    userTier={tier}
                    onStart={handleStartRitual}
                    onPreview={handlePreviewLocked}
                  />
                ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {presets.length === 0 && !loading && (
          <div className="text-center py-20">
            <Sparkles className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">No rituals yet</h3>
            <p className="text-gray-500">Check back soon for curated micro-moments</p>
          </div>
        )}
      </div>
    </div>
  );
};

