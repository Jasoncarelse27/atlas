// Atlas V1 Golden Standard Tier Access Hook
// Centralized tier enforcement and feature access logic
// 🎯 REVENUE PROTECTION + USAGE MANAGEMENT

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { getUpgradeMessage as getUpgradeMessageFromConfig } from '../config/tierAccess';
import { getClaudeModelName, getTierPricing, tierConfig } from '../config/tierConfig';
import { usageTrackingService, type UsageCheckResult } from '../services/usageTrackingService';
import type { Tier } from '../types/tier';
import { useSubscription } from './useSubscription';
import { useSupabaseAuth } from './useSupabaseAuth';

// 🚀 PERFORMANCE: Cache for tier access data
const tierAccessCache = new Map<string, {
  data: any;
  timestamp: number;
  ttl: number;
}>();

const CACHE_TTL = 30000; // 30 seconds cache
const DEBOUNCE_DELAY = 1000; // 1 second debounce

export interface TierAccessReturn {
  // Current tier info
  tier: Tier;
  features: typeof tierConfig[Tier];
  
  // 🎯 CONVERSATION LIMITS (NEW)
  canStartConversation: () => Promise<boolean>;
  remainingConversations: number | 'unlimited';
  conversationsToday: number;
  
  // Feature access checks
  canUseFeature: (feature: 'text' | 'audio' | 'image' | 'camera') => boolean;
  isWithinLimit: (currentCount: number) => boolean;
  
  // Model routing with token limits
  model: string;
  claudeModelName: string;
  maxTokensPerResponse: number;
  maxContextWindow: number;
  
  // Usage tracking & recording
  logFeatureAttempt: (feature: string, allowed: boolean) => Promise<void>;
  recordConversation: (tokensUsed: number) => Promise<void>;
  
  // Upgrade helpers
  showUpgradeModal: (feature: string) => void;
  getUpgradeMessage: (feature: string) => string;
  
  // Budget protection
  budgetStatus: 'ok' | 'warning' | 'critical';
  isMaintenanceMode: boolean;
}

export function useTierAccess(): TierAccessReturn {
  const { user } = useSupabaseAuth();
  const { profile, canAccessFeature, updateUsage } = useSubscription(user);
  
  // State for usage tracking
  const [usageCheck, setUsageCheck] = useState<UsageCheckResult | null>(null);
  const [budgetStatus, setBudgetStatus] = useState<'ok' | 'warning' | 'critical'>('ok');
  const [conversationsToday, setConversationsToday] = useState(0);
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  
  // ✅ FUTURE-PROOF TIER SYSTEM: Always use normalized tier values
  // This ensures the frontend only depends on these 3 tier values from backend profile
  // Tier mapping to AI models:
  // - 'free' → Claude Haiku (fast, cost-effective)
  // - 'core' → Claude Sonnet (balanced performance)  
  // - 'studio' → Claude Opus (most advanced)
  // Fallback to 'free' if no profile or invalid tier value
  const currentTier: Tier = (profile?.tier && ['free', 'core', 'studio'].includes(profile.tier)) ? profile.tier as Tier : 'free';
  const features = tierConfig[currentTier];
  
  // Debug logging to track tier changes
  useEffect(() => {
    console.log('🔍 [useTierAccess] Tier changed:', currentTier, 'Profile:', profile);
  }, [currentTier, profile]);
  
  // 🚀 PERFORMANCE: Debounced usage data loading with caching
  useEffect(() => {
    if (!user?.id) return;
    
    const cacheKey = `usage_${user.id}_${currentTier}`;
    const cached = tierAccessCache.get(cacheKey);
    
    // Use cache if available and not expired
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      setUsageCheck(cached.data.usageCheck);
      setConversationsToday(cached.data.conversationsToday);
      setBudgetStatus(cached.data.budgetStatus);
      setIsMaintenanceMode(cached.data.isMaintenanceMode);
      return;
    }
    
    // Debounce API calls
    const timeoutId = setTimeout(async () => {
      try {
        // Check current usage status
        const check = await usageTrackingService.checkUsageBeforeConversation(user.id, currentTier);
        
        // Get today's conversation count
        const stats = await usageTrackingService.getUsageStats(user.id);
        
        // Check budget health
        const budget = await usageTrackingService.checkBudgetHealth();
        
        const data = {
          usageCheck: check,
          conversationsToday: stats.today.conversations_count,
          budgetStatus: budget.status,
          isMaintenanceMode: budget.status === 'critical'
        };
        
        // Update state
        setUsageCheck(check);
        setConversationsToday(stats.today.conversations_count);
        setBudgetStatus(budget.status);
        setIsMaintenanceMode(budget.status === 'critical');
        
        // Cache the result
        tierAccessCache.set(cacheKey, {
          data,
          timestamp: Date.now(),
          ttl: CACHE_TTL
        });
        
      } catch (error) {
        console.error('Failed to load usage data:', error);
        // Graceful fallback
        setUsageCheck({ canProceed: true, remainingConversations: 'unlimited', upgradeRequired: false });
      }
    }, DEBOUNCE_DELAY);
    
    return () => clearTimeout(timeoutId);
  }, [user?.id, currentTier]);
  
  // 🎯 NEW: Conversation limit check with daily tracking
  const canStartConversation = useCallback(async (): Promise<boolean> => {
    if (!user?.id) return false;
    
    // Check maintenance mode
    if (isMaintenanceMode) {
      toast.error('Atlas is temporarily in maintenance mode. Please try again later.', {
        duration: 5000,
        icon: '🛠️'
      });
      return false;
    }
    
    try {
      const check = await usageTrackingService.checkUsageBeforeConversation(user.id, currentTier);
      setUsageCheck(check);
      
      if (!check.canProceed) {
        if (check.reason === 'daily_limit') {
          showUpgradeModal('daily_limit');
        } else if (check.reason === 'budget_exceeded') {
          toast.error('Daily usage limit reached. Please try again tomorrow.', {
            duration: 5000,
            icon: '💰'
          });
        }
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Conversation check failed:', error);
      return true; // Graceful fallback
    }
  }, [user?.id, currentTier, isMaintenanceMode]);
  
  // 🚀 PERFORMANCE: Memoized feature checks
  const canUseFeature = useCallback((feature: 'text' | 'audio' | 'image' | 'camera'): boolean => {
    return canAccessFeature(feature, currentTier);
  }, [currentTier]);
  
  // Legacy message limit check (kept for compatibility)
  const isWithinLimit = useCallback((currentCount: number): boolean => {
    const maxConversations = features.maxConversationsPerDay;
    if (maxConversations === -1) return true; // Unlimited
    return currentCount < maxConversations;
  }, [features]);
  
  // 🚀 PERFORMANCE: Memoized model routing
  const model = useMemo(() => features.model, [features]);
  const claudeModelName = useMemo(() => getClaudeModelName(currentTier), [currentTier]);
  const maxTokensPerResponse = useMemo(() => features.maxTokensPerResponse, [features]);
  const maxContextWindow = useMemo(() => features.maxContextWindow, [features]);
  
  // 🎯 NEW: Record successful conversation with token usage
  const recordConversation = useCallback(async (tokensUsed: number): Promise<void> => {
    if (!user?.id) return;
    
    try {
      await usageTrackingService.recordConversation(user.id, currentTier, tokensUsed);
      
      // Update local state
      setConversationsToday(prev => prev + 1);
      
      // Refresh usage check for next conversation
      const newCheck = await usageTrackingService.checkUsageBeforeConversation(user.id, currentTier);
      setUsageCheck(newCheck);
      
      // Clear cache to force refresh
      const cacheKey = `usage_${user.id}_${currentTier}`;
      tierAccessCache.delete(cacheKey);
      
    } catch (error) {
      console.error('Failed to record conversation:', error);
    }
  }, [user?.id, currentTier]);
  
  // Create system message for tier enforcement
  const createSystemMessage = useCallback((type: 'limit_reached' | 'feature_locked' | 'upgrade_required', feature?: string) => {
    const messages = {
      limit_reached: {
        text: `You've reached your daily limit (${maxMessages} messages). Upgrade to continue.`,
        type: 'warning' as const
      },
      feature_locked: {
        text: `This feature requires Core or Studio tier. Upgrade to unlock ${feature || 'this feature'}.`,
        type: 'error' as const
      },
      upgrade_required: {
        text: `❌ Upgrade required to upload images or audio.`,
        type: 'error' as const
      }
    };

    return {
      id: `system-${Date.now()}`,
      type: 'system' as const,
      text: messages[type].text,
      messageType: messages[type].type,
      timestamp: new Date().toISOString(),
      sender: 'system'
    };
  }, [maxMessages]);

  // Log feature attempts for analytics
  const logFeatureAttempt = useCallback(async (feature: string, allowed: boolean): Promise<void> => {
    if (!user?.id) return;
    
    console.log('🔍 [logFeatureAttempt] Logging feature attempt:', { feature, tier: currentTier, profile });
    
    try {
      // Use backend API to log feature attempts - use Railway backend URL
      const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      await fetch(`${backendUrl}/api/feature-attempts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user.id,
          feature,
          tier: currentTier
        })
      });
    } catch (error) {
      console.warn('Failed to log feature attempt:', error);
    }
  }, [user?.id, currentTier, profile]);
  
  // 🎯 ENHANCED: Upgrade modal with specific pricing
  const showUpgradeModal = useCallback((feature: string): void => {
    // Studio tier has access to all features - don't show upgrade modal
    if (currentTier === 'studio') {
      return;
    }

    const message = getUpgradeMessage(feature);
    if (!message) return; // Don't show modal if no message
    
    // Suggest Core for audio/image, Studio for camera
    const suggestedTier = feature === 'camera' ? 'studio' : 'core';
    const price = getTierPricing(suggestedTier);
    const tierName = suggestedTier === 'core' ? 'Core' : 'Studio';
    
    toast.error(message, {
      duration: 8000,
      action: {
        label: `Upgrade to ${tierName} $${price}/mo`,
        onClick: () => {
          // TODO: Open Paddle checkout modal with specific tier
          console.log('Open upgrade modal for', feature, 'to', suggestedTier);
          // Track upgrade intent
          logFeatureAttempt(`upgrade_intent_${suggestedTier}`, true);
        }
      }
    });
  }, [currentTier, logFeatureAttempt]);
  
  // 🎯 UPDATED: Get upgrade message with correct Atlas tier structure and model mapping
  const getUpgradeMessage = useCallback((feature: string): string => {
    const message = getUpgradeMessageFromConfig(feature, currentTier);
    return message || '';
  }, [currentTier]);
  
  return {
    // Current tier info
    tier: currentTier,
    features,
    
    // 🎯 NEW: Conversation limits
    canStartConversation,
    remainingConversations: usageCheck?.remainingConversations || 0,
    conversationsToday,
    
    // Feature access checks
    canUseFeature,
    isWithinLimit,
    
    // Model routing with token limits
    model,
    claudeModelName,
    maxTokensPerResponse,
    maxContextWindow,
    
    // System message creation for tier enforcement
    createSystemMessage,
    
    // Usage tracking & recording
    logFeatureAttempt,
    recordConversation,
    
    // Upgrade helpers
    showUpgradeModal,
    getUpgradeMessage,
    
    // Budget protection
    budgetStatus,
    isMaintenanceMode
  };
}

// Helper hook for specific feature checks
export function useFeatureAccess(feature: 'text' | 'audio' | 'image' | 'camera') {
  const { canUseFeature, showUpgradeModal, logFeatureAttempt } = useTierAccess();
  
  const attemptFeature = useCallback(async (): Promise<boolean> => {
    const allowed = canUseFeature(feature);
    await logFeatureAttempt(feature, allowed);
    
    if (!allowed) {
      showUpgradeModal(feature);
    }
    
    return allowed;
  }, [canUseFeature, feature, logFeatureAttempt, showUpgradeModal]);
  
  return {
    canUse: canUseFeature(feature),
    attemptFeature
  };
}

// Helper hook for message limits
export function useMessageLimit() {
  const { isWithinLimit, showUpgradeModal, logFeatureAttempt } = useTierAccess();
  
  const checkAndAttemptMessage = useCallback(async (currentCount: number): Promise<boolean> => {
    const allowed = isWithinLimit(currentCount);
    await logFeatureAttempt('text', allowed);
    
    if (!allowed) {
      showUpgradeModal('text');
    }
    
    return allowed;
  }, [isWithinLimit, logFeatureAttempt, showUpgradeModal]);
  
  return {
    isWithinLimit,
    checkAndAttemptMessage
  };
}