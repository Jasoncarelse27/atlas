/**
 * Ritual Library - Grid of Preset Rituals
 * Displays rituals filtered by user tier with upgrade prompts
 * 
 * Mobile Features:
 * - Pull-to-refresh gestures
 * - 120px minimum touch targets
 * - Bottom sheet for locked ritual preview
 * - Floating action button
 */

import '../styles/mobile.css';

import { useUpgradeModals } from '@/contexts/UpgradeModalContext';
import { useMobileOptimization } from '@/hooks/useMobileOptimization';
import { useTierQuery } from '@/hooks/useTierQuery';
import { logger } from '@/lib/logger';
import { Lock, MessageCircle, Plus, Sparkles, TrendingUp, X } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useFavoriteRituals } from '../hooks/useFavoriteRituals';
import { useRitualStore } from '../hooks/useRitualStore';
import type { Ritual } from '../types/rituals';
import { DataMigrationButton } from './DataMigrationButton';
import { PatternInsights } from './PatternInsights';
import { QuickStartWidget } from './QuickStartWidget';
import { RitualStepCard } from './RitualStepCard';
import { StreakFreeze } from './StreakFreeze';
import { StreakPrediction } from './StreakPrediction';

export const RitualLibrary: React.FC = () => {
  const navigate = useNavigate();
  const { tier, userId } = useTierQuery();
  const { showGenericUpgrade } = useUpgradeModals();
  const { presets, userRituals, loading, loadPresets, loadUserRituals, deleteRitual } = useRitualStore();
  const { isMobile, triggerHaptic } = useMobileOptimization();
  const { favoriteIds, toggleFavorite, isFavorite } = useFavoriteRituals();

  // Pull-to-refresh state
  const [pullStartY, setPullStartY] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastRefreshTimeRef = useRef<number>(0); // ✅ Prevent rapid refreshes
  const touchStartTimeRef = useRef<number>(0); // ✅ Track touch duration for debouncing

  // Bottom sheet for locked ritual preview
  const [selectedLockedRitual, setSelectedLockedRitual] = useState<Ritual | null>(null);

  useEffect(() => {
    loadPresets();
    if (userId) {
      loadUserRituals(userId);
    }
  }, [userId, loadPresets, loadUserRituals]);

  // ✅ Performance: Memoize tier filtering
  const visiblePresets = useMemo(() => {
    return presets.filter((ritual) => {
      if (tier === 'free') return ritual.tierRequired === 'free';
      if (tier === 'core')
        return ritual.tierRequired === 'free' || ritual.tierRequired === 'core';
      return true; // Studio sees all
    });
  }, [presets, tier]);

  // User's custom rituals (renamed from userRituals to avoid conflict)
  const customRituals = userRituals;
  
  // ✅ Sort rituals: favorites first
  const sortedPresets = useMemo(() => {
    return [...visiblePresets].sort((a, b) => {
      const aFav = isFavorite(a.id);
      const bFav = isFavorite(b.id);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return 0;
    });
  }, [visiblePresets, favoriteIds]);
  
  const sortedCustomRituals = useMemo(() => {
    return [...customRituals].sort((a, b) => {
      const aFav = isFavorite(a.id);
      const bFav = isFavorite(b.id);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return 0;
    });
  }, [customRituals, favoriteIds]);

  // ✅ BEST PRACTICE: Pull-to-refresh handlers with debouncing and proper thresholds
  const handleTouchStart = (e: React.TouchEvent) => {
    // ✅ Prevent refresh if already refreshing or if not mobile
    if (!isMobile || isRefreshing) return;
    
    // ✅ Check container scroll position (more reliable than window.scrollY)
    const container = containerRef.current;
    if (container && container.scrollTop > 10) return;
    
    // ✅ Prevent refresh if less than 2 seconds since last refresh (debouncing)
    const now = Date.now();
    if (now - lastRefreshTimeRef.current < 2000) return;
    
    touchStartTimeRef.current = now;
    setPullStartY(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // ✅ Prevent if conditions not met
    if (!isMobile || pullStartY === 0 || isRefreshing) return;
    
    const container = containerRef.current;
    if (container && container.scrollTop > 10) {
      setPullDistance(0);
      setPullStartY(0);
      return;
    }
    
    const distance = Math.max(0, e.touches[0].clientY - pullStartY);
    // ✅ Increased max distance to 150px for better UX
    if (distance > 0 && distance < 150) {
      setPullDistance(distance);
    } else if (distance >= 150) {
      // Cap at 150px to prevent excessive pulling
      setPullDistance(150);
    }
  };

  const handleTouchEnd = async () => {
    // ✅ Reset state if conditions not met
    if (!isMobile || pullDistance < 100 || isRefreshing) {
      setPullDistance(0);
      setPullStartY(0);
      touchStartTimeRef.current = 0;
      return;
    }

    // ✅ Require minimum touch duration (prevents accidental triggers)
    const touchDuration = Date.now() - touchStartTimeRef.current;
    if (touchDuration < 200) {
      setPullDistance(0);
      setPullStartY(0);
      touchStartTimeRef.current = 0;
      return;
    }

    // ✅ Prevent rapid refreshes (minimum 2 seconds between refreshes)
    const now = Date.now();
    if (now - lastRefreshTimeRef.current < 2000) {
      setPullDistance(0);
      setPullStartY(0);
      touchStartTimeRef.current = 0;
      return;
    }

    // ✅ Trigger refresh (threshold increased from 80px to 100px)
    setIsRefreshing(true);
    lastRefreshTimeRef.current = now;
    triggerHaptic(50); // Medium haptic
    setPullDistance(0);
    setPullStartY(0);
    touchStartTimeRef.current = 0;

    try {
      await Promise.all([
        loadPresets(),
        userId ? loadUserRituals(userId) : Promise.resolve(),
      ]);
      triggerHaptic(100); // Success haptic
      toast.success('Rituals refreshed');
    } catch (error) {
      logger.error('[RitualLibrary] Failed to refresh:', error);
      toast.error('Failed to refresh. Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleStartRitual = (ritual: Ritual) => {
    triggerHaptic(10); // Light tap
    navigate(`/rituals/run/${ritual.id}`);
  };

  const handlePreviewLocked = (ritual: Ritual) => {
    triggerHaptic(10); // Light tap
    // Show bottom sheet instead of immediate modal
    setSelectedLockedRitual(ritual);
  };

  const handleCloseBottomSheet = () => {
    triggerHaptic(10);
    setSelectedLockedRitual(null);
  };

  const handleUpgradeFromSheet = () => {
    triggerHaptic(50);
    if (selectedLockedRitual) {
      showGenericUpgrade(selectedLockedRitual.tierRequired === 'studio' ? 'voice_calls' : 'audio');
      setSelectedLockedRitual(null);
    }
  };

  const handleCreateRitual = () => {
    triggerHaptic(50); // Medium haptic
    if (tier === 'free') {
      showGenericUpgrade('audio');
    } else {
      // Navigate to builder (Phase 3)
      navigate('/rituals/builder');
    }
  };

  const handleEditRitual = (ritual: Ritual) => {
    triggerHaptic(10);
    // Navigate to builder with ritual data for editing
    navigate('/rituals/builder', { state: { editRitual: ritual } });
  };

  const handleDeleteRitual = async (ritual: Ritual) => {
    // Confirm deletion
    const confirmed = window.confirm(`Delete "${ritual.title}"? This cannot be undone.`);
    if (!confirmed) return;

    triggerHaptic(100); // Strong haptic for destructive action

    try {
      await deleteRitual(ritual.id);
      toast.success('Ritual deleted successfully');
    } catch (error) {
      logger.error('[RitualLibrary] Failed to delete ritual:', error);
      toast.error('Failed to delete ritual. Please try again.');
    }
  };

  if (loading && presets.length === 0) {
    return (
      <div className="min-h-screen bg-[#F9F6F1] dark:bg-gray-900 p-4 sm:p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header Skeleton */}
          <div className="animate-pulse">
            <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
            <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
          
          {/* Grid Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 p-6 animate-pulse">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                  <div className="flex-1">
                    <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                    <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  </div>
                </div>
                <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                <div className="h-3 w-3/4 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="h-screen overflow-y-auto bg-[#F9F6F1] dark:bg-gray-900 relative safe-area overscroll-contain"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-Refresh Indicator */}
      {pullDistance > 0 && (
        <div 
          className="fixed top-0 left-0 right-0 flex items-center justify-center z-50 transition-opacity"
          style={{ 
            height: `${pullDistance}px`,
            opacity: Math.min(pullDistance / 80, 1),
          }}
        >
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-full p-2 shadow-lg">
            <Sparkles className="w-5 h-5 text-[#B2BDA3] dark:text-gray-400 animate-pulse" />
          </div>
        </div>
      )}

      {/* Refreshing Indicator */}
      {isRefreshing && (
        <div className="fixed top-4 left-0 right-0 flex justify-center z-50">
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#B2BDA3] dark:text-gray-400 animate-spin" />
            <span className="text-sm font-medium text-[#3B3632] dark:text-white">Refreshing...</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#3B3632] dark:text-white mb-2">Ritual Library</h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              Micro-moments for energy, calm, focus, and creativity
            </p>
          </div>

          {/* Desktop Action Buttons */}
          <div className="hidden sm:flex items-center gap-3">
            {/* Data Migration - Fix Corrupted Durations */}
            {customRituals.length > 0 && <DataMigrationButton />}

            {/* Back to Chat Button */}
            <button
              onClick={() => {
                triggerHaptic(10);
                navigate('/chat');
              }}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border-2 border-[#E8DCC8] dark:border-gray-700 text-[#3B3632] dark:text-white 
                rounded-xl hover:bg-[#F9F6F1] dark:hover:bg-gray-700 transition-all hover:shadow-md active:scale-95
                min-h-[44px] touch-manipulation"
              aria-label="Back to chat"
            >
              <MessageCircle className="w-5 h-5 text-[#8B7E74] dark:text-gray-400" />
              <span className="font-medium">Chat</span>
            </button>

            {/* Insights Button (Core/Studio only) */}
            {tier !== 'free' && (
              <button
                onClick={() => {
                  triggerHaptic(10);
                  navigate('/rituals/insights');
                }}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border-2 border-[#E8DCC8] dark:border-gray-700 text-[#3B3632] dark:text-white 
                  rounded-xl hover:bg-[#F9F6F1] dark:hover:bg-gray-700 transition-all hover:shadow-md active:scale-95
                  min-h-[44px]"
              >
                <TrendingUp size={18} />
                <span className="font-medium">Insights</span>
              </button>
            )}

            {/* Create Custom Ritual Button */}
            <button
              onClick={handleCreateRitual}
              className="flex items-center gap-2 px-6 py-3 bg-[#3B3632] text-white rounded-xl 
                hover:bg-[#2A2621] transition-all active:scale-95 min-h-[48px]"
            >
              <Plus size={20} />
              <span className="font-medium">Create Ritual</span>
            </button>
          </div>

          {/* Mobile Top Actions (Chat + Insights only) */}
          <div className="flex sm:hidden items-center gap-3 w-full justify-end">
            {customRituals.length > 0 && <DataMigrationButton />}
            
            <button
              onClick={() => {
                triggerHaptic(10);
                navigate('/chat');
              }}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border-2 border-[#E8DCC8] dark:border-gray-700 text-[#3B3632] dark:text-white 
                rounded-xl active:scale-95 min-h-[48px] touch-manipulation"
              aria-label="Back to chat"
            >
              <MessageCircle className="w-5 h-5 text-[#8B7E74] dark:text-gray-400" />
            </button>

            {tier !== 'free' && (
              <button
                onClick={() => {
                  triggerHaptic(10);
                  navigate('/rituals/insights');
                }}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border-2 border-[#E8DCC8] dark:border-gray-700 text-[#3B3632] dark:text-white 
                  rounded-xl active:scale-95 min-h-[48px]"
                aria-label="Ritual insights"
              >
                <TrendingUp size={20} />
              </button>
            )}
          </div>
        </div>

        {/* User's Custom Rituals */}
        {userRituals.length > 0 && (
          <div className="mb-12">
            <h2 className="text-lg sm:text-xl font-semibold text-[#3B3632] dark:text-white mb-4">Your Custom Rituals</h2>
            {/* Mobile: Single column, Desktop: Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {sortedCustomRituals.map((ritual) => (
                <div key={ritual.id} className="min-h-[120px]"> {/* Minimum touch target height */}
                  <RitualStepCard
                    ritual={ritual}
                    userTier={tier}
                    onStart={handleStartRitual}
                    onEdit={handleEditRitual}
                    onDelete={handleDeleteRitual}
                    isCustom={true}
                    isFavorite={isFavorite(ritual.id)}
                    onToggleFavorite={toggleFavorite}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Start Widget */}
        <QuickStartWidget />
        
        {/* Streak Prediction */}
        <StreakPrediction />
        
        {/* Streak Freeze */}
        <StreakFreeze />
        
        {/* Pattern Insights */}
        <PatternInsights />

        {/* Preset Rituals */}
        <div>
          <h2 className="text-lg sm:text-xl font-semibold text-[#3B3632] dark:text-white mb-4">Preset Rituals</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {sortedPresets.map((ritual) => (
              <div key={ritual.id} className="min-h-[120px]">
                <RitualStepCard
                  ritual={ritual}
                  userTier={tier}
                  onStart={handleStartRitual}
                  onPreview={handlePreviewLocked}
                  isFavorite={isFavorite(ritual.id)}
                  onToggleFavorite={toggleFavorite}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Locked Presets (show grayed out for free users) */}
        {tier === 'free' && presets.filter((r) => r.tierRequired !== 'free').length > 0 && (
          <div className="mt-12">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-400 mb-4">Unlock with Core</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {presets
                .filter((r) => r.tierRequired !== 'free')
                .map((ritual) => (
                  <div key={ritual.id} className="min-h-[120px]">
                    <RitualStepCard
                      ritual={ritual}
                      userTier={tier}
                      onStart={handleStartRitual}
                      onPreview={handlePreviewLocked}
                      isFavorite={isFavorite(ritual.id)}
                      onToggleFavorite={toggleFavorite}
                    />
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {presets.length === 0 && !loading && (
          <div className="text-center py-20">
            <Sparkles className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">No rituals yet</h3>
            <p className="text-gray-500">Check back soon for curated micro-moments</p>
          </div>
        )}

        {/* Mobile Spacing for FAB */}
        <div className="h-24 sm:hidden" />
      </div>

      {/* Floating Action Button (Mobile Only) */}
      <button
        onClick={handleCreateRitual}
        className="sm:hidden fixed bottom-6 right-6 z-40 
          flex items-center gap-2 px-6 py-4 
          bg-[#3B3632] text-white rounded-full shadow-2xl
          active:scale-95 transition-transform
          min-h-[56px] min-w-[56px]
          touch-manipulation"
        style={{
          boxShadow: '0 4px 20px rgba(59, 54, 50, 0.3)',
        }}
        aria-label="Create ritual"
      >
        <Plus size={24} className="flex-shrink-0" />
        <span className="font-semibold">Create</span>
      </button>

      {/* Bottom Sheet for Locked Ritual Preview */}
      {selectedLockedRitual && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/40 z-50 animate-in fade-in duration-200"
            onClick={handleCloseBottomSheet}
          />
          
          {/* Bottom Sheet */}
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl 
            animate-in slide-in-from-bottom duration-300 max-h-[80vh] overflow-y-auto">
            {/* Handle Bar */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full" />
            </div>

            {/* Close Button */}
            <button
              onClick={handleCloseBottomSheet}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95 
                min-h-[44px] min-w-[44px]"
              aria-label="Close"
            >
              <X size={24} className="text-gray-600 dark:text-gray-400" />
            </button>

            {/* Content */}
            <div className="px-6 pb-8 pt-4">
              {/* Ritual Info */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 mb-4">
                  <Sparkles size={32} className="text-gray-400 dark:text-gray-500" />
                </div>
                <h2 className="text-2xl font-bold text-[#3B3632] dark:text-white mb-2">
                  {selectedLockedRitual.title}
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {selectedLockedRitual.steps.length} steps • {' '}
                  {(() => {
                    const totalDuration = selectedLockedRitual.steps.reduce((sum, step) => sum + step.duration, 0);
                    const minutes = Math.floor(totalDuration / 60);
                    const seconds = totalDuration % 60;
                    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
                  })()}
                </p>

                {/* Lock Badge */}
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#E8DCC8] dark:bg-gray-700 mb-6">
                  <Lock size={16} className="text-[#8B7E74] dark:text-gray-400" />
                  <span className="text-sm font-semibold text-[#3B3632] dark:text-white">
                    {selectedLockedRitual.tierRequired === 'core' ? 'Core Tier' : 'Studio Tier'}
                  </span>
                </div>
              </div>

              {/* Steps Preview */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3 uppercase tracking-wide">
                  What's Inside
                </h3>
                <div className="space-y-2">
                  {selectedLockedRitual.steps.map((step, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#B2BDA3]/20 dark:bg-gray-700/50
                        flex items-center justify-center text-xs font-bold text-[#8B7E74] dark:text-gray-400">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                          {step.config.instructions}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                          {step.duration}s
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Upgrade CTA */}
              <button
                onClick={handleUpgradeFromSheet}
                className="w-full py-4 bg-[#3B3632] text-white rounded-xl font-semibold text-lg
                  active:scale-95 transition-transform shadow-lg min-h-[56px]"
              >
                Upgrade to {selectedLockedRitual.tierRequired === 'core' ? 'Core ($19.99/mo)' : 'Studio ($149.99/mo)'} {/* ✅ CORRECTED */}
              </button>

              <p className="text-center text-xs text-gray-500 mt-4">
                Unlock this ritual and {selectedLockedRitual.tierRequired === 'core' ? 'unlimited chat' : 'advanced features'}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

