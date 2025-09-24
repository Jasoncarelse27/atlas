// Atlas V1 Golden Standard Tier Access Hook
// Centralized tier enforcement and feature access logic
// 🎯 REVENUE PROTECTION + USAGE MANAGEMENT

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { getUpgradeMessage as getUpgradeMessageFromConfig } from '../config/tierAccess';
import { getClaudeModelName, tierConfig } from '../config/tierConfig';
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
  tier: Tier | 'loading';
  features: typeof tierConfig[Tier];
  
  // 🎯 CONVERSATION LIMITS (NEW)
  canStartConversation: () => Promise<boolean>;
  remainingConversations: number | 'unlimited';
  conversationsToday: number;
  
  // Feature access checks
  canUseFeature: (feature: 'text' | 'audio' | 'image' | 'camera') => boolean;
  isWithinLimit: (currentCount: number) => boolean;
  
  // Loading state
  isProfileLoading: boolean;
  
  // Model routing with token limits
  model: string;
  claudeModelName: string;
  maxTokensPerResponse: number;
  maxContextWindow: number;
  
  // Usage tracking & recording
  logFeatureAttempt: (feature: string, allowed: boolean) => Promise<void>;
  recordConversation: (tokensUsed: number) => Promise<void>;
  
  // System message creation for tier enforcement
  createSystemMessage: (type: 'limit_reached' | 'feature_locked' | 'upgrade_required', feature?: string) => any;
  
  // Upgrade helpers
  showUpgradeModal: (reason?: string) => void;
  getUpgradeMessage: (feature: string) => string;
  
  // Budget protection
  budgetStatus: 'healthy' | 'warning' | 'critical' | 'maintenance';
  isMaintenanceMode: boolean;
  
  // Message tracking for sidebar
  messageCount: number;
  maxMessages: number;
  remainingMessages: number;
}

export function useTierAccess(): TierAccessReturn {
  const { user } = useSupabaseAuth();
  const { profile, canAccessFeature, updateUsage, isLoading } = useSubscription(user);
  
  // State for usage tracking
  const [usageCheck, setUsageCheck] = useState<UsageCheckResult | null>(null);
  const [budgetStatus, setBudgetStatus] = useState<'healthy' | 'warning' | 'critical' | 'maintenance'>('healthy');
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);

  // ✅ GOLDEN STANDARD: Handle loading state properly
  const currentTier: Tier | 'loading' = profile?.tier || 'loading';
  
  // Log tier changes for debugging
  useEffect(() => {
    console.log(`[useTierAccess] Tier changed: ${currentTier}`);
  }, [currentTier]);

  // Get message limits based on tier
  const getMessageLimit = (tier: Tier | 'loading'): number => {
    switch (tier) {
      case 'free': return 15;
      case 'core': return 999999; // Essentially unlimited
      case 'studio': return 999999; // Essentially unlimited
      case 'loading': return 15; // Conservative during loading
      default: return 15;
    }
  };

  const maxMessages = getMessageLimit(currentTier);
  const messageCount = usageCheck?.conversationsToday || 0;
  const remainingMessages = currentTier === 'loading' ? 15 : Math.max(0, maxMessages - messageCount);

  // Feature access with loading state handling
  const canUseFeature = useCallback((feature: 'text' | 'audio' | 'image' | 'camera'): boolean => {
    // ✅ GOLDEN STANDARD: Optimistic access during loading
    if (currentTier === 'loading') {
      console.log(`[useTierAccess] Loading state - allowing optimistic access to ${feature}`);
      return true; // Don't block during loading
    }
    
    return canAccessFeature(feature);
  }, [currentTier, canAccessFeature]);

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

  // Log feature attempts
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

  // Record conversation usage
  const recordConversation = useCallback(async (tokensUsed: number): Promise<void> => {
    if (!user?.id) return;

    try {
      await updateUsage('ai_prompts_this_month', 1);
      console.log('📊 Conversation recorded:', { tokensUsed, tier: currentTier });
    } catch (error) {
      console.error('Failed to record conversation:', error);
    }
  }, [user?.id, updateUsage, currentTier]);

  // Check if user can start a conversation
  const canStartConversation = useCallback(async (): Promise<boolean> => {
    if (currentTier === 'loading') {
      console.log('[useTierAccess] Loading state - allowing optimistic conversation start');
      return true; // Optimistic during loading
    }

    try {
      const result = await usageTrackingService.checkUsageBeforeConversation(user?.id || '', currentTier as Tier);
      setUsageCheck(result);
      return result.allowed;
    } catch (error) {
      console.error('Failed to check conversation limit:', error);
      return true; // Fail open
    }
  }, [user?.id, currentTier]);

  // Check if within limit
  const isWithinLimit = useCallback((currentCount: number): boolean => {
    if (currentTier === 'loading') return true; // Optimistic during loading
    return currentCount < maxMessages;
  }, [currentTier, maxMessages]);

  // Show upgrade modal (placeholder - will be connected to actual modal)
  const showUpgradeModal = useCallback((reason: string = 'upgrade') => {
    console.log(`[useTierAccess] Upgrade modal requested: ${reason}`);
    toast.error(`Upgrade required: ${reason}`, {
      duration: 5000,
      icon: '🚀'
    });
  }, []);

  // Get upgrade message
  const getUpgradeMessage = useCallback((feature: string): string => {
    return getUpgradeMessageFromConfig(feature, currentTier as Tier);
  }, [currentTier]);

  // Model routing based on tier
  const model = useMemo(() => {
    if (currentTier === 'loading') return 'groq'; // Conservative during loading
    
    switch (currentTier) {
      case 'free': return 'groq'; // Free tier uses Groq
      case 'core': return 'claude'; // Core tier uses Claude Sonnet
      case 'studio': return 'opus'; // Studio tier uses Claude Opus
      default: return 'groq';
    }
  }, [currentTier]);

  const claudeModelName = useMemo(() => {
    if (currentTier === 'loading') return 'claude-3-haiku-20240307';
    
    return getClaudeModelName(currentTier as Tier);
  }, [currentTier]);

  const maxTokensPerResponse = useMemo(() => {
    if (currentTier === 'loading') return 1000;
    
    switch (currentTier) {
      case 'free': return 1000;
      case 'core': return 4000;
      case 'studio': return 8000;
      default: return 1000;
    }
  }, [currentTier]);

  const maxContextWindow = useMemo(() => {
    if (currentTier === 'loading') return 200000;
    
    switch (currentTier) {
      case 'free': return 200000;
      case 'core': return 200000;
      case 'studio': return 200000;
      default: return 200000;
    }
  }, [currentTier]);

  // Get features for current tier
  const features = useMemo(() => {
    if (currentTier === 'loading') {
      return tierConfig.free; // Conservative during loading
    }
    
    return tierConfig[currentTier as Tier] || tierConfig.free;
  }, [currentTier]);

  // Load usage data on mount and tier change
  useEffect(() => {
    if (user?.id && currentTier !== 'loading') {
      usageTrackingService.checkUsageBeforeConversation(user.id, currentTier as Tier)
        .then(setUsageCheck)
        .catch(console.error);
    }
  }, [user?.id, currentTier]);

  return {
    // Current tier info
    tier: currentTier,
    features,
    
    // 🎯 NEW: Conversation limits
    canStartConversation,
    remainingConversations: usageCheck?.remainingConversations || 0,
    conversationsToday: usageCheck?.conversationsToday || 0,
    
    // Feature access checks
    canUseFeature,
    isWithinLimit,
    
    // Loading state
    isProfileLoading: isLoading,
    
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
    isMaintenanceMode,
    
    // Message tracking for sidebar
    messageCount,
    maxMessages,
    remainingMessages
  };
}