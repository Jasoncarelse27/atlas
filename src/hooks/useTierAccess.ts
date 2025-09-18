// Atlas V1 Golden Standard Tier Access Hook
// Centralized tier enforcement and feature access logic
// 🎯 REVENUE PROTECTION + USAGE MANAGEMENT

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { getClaudeModelName, getTierPricing, isValidTier, tierFeatures } from '../config/featureAccess';
import { supabase } from '../lib/supabase';
import { usageTrackingService, type UsageCheckResult } from '../services/usageTrackingService';
import type { Tier } from '../types/tier';
import { useSubscription } from './useSubscription';
import { useSupabaseAuth } from './useSupabaseAuth';

export interface TierAccessReturn {
  // Current tier info
  tier: Tier;
  features: typeof tierFeatures[Tier];
  
  // 🎯 CONVERSATION LIMITS (NEW)
  canStartConversation: () => Promise<boolean>;
  remainingConversations: number | 'unlimited';
  conversationsToday: number;
  
  // Feature access checks
  canUseFeature: (feature: 'text' | 'audio' | 'image') => boolean;
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
  
  // Get current tier with fallback to 'free'
  const tier: Tier = (profile?.tier && isValidTier(profile.tier)) ? profile.tier as Tier : 'free';
  const features = tierFeatures[tier];
  
  // Load usage data on mount and tier change
  useEffect(() => {
    if (!user?.id) return;
    
    const loadUsageData = async () => {
      try {
        // Check current usage status
        const check = await usageTrackingService.checkUsageBeforeConversation(user.id, tier);
        setUsageCheck(check);
        
        // Get today's conversation count
        const stats = await usageTrackingService.getUsageStats(user.id);
        setConversationsToday(stats.today.conversations_count);
        
        // Check budget health
        const budget = await usageTrackingService.checkBudgetHealth();
        setBudgetStatus(budget.status);
        setIsMaintenanceMode(budget.status === 'critical');
        
      } catch (error) {
        console.error('Failed to load usage data:', error);
        // Graceful fallback
        setUsageCheck({ canProceed: true, remainingConversations: 'unlimited', upgradeRequired: false });
      }
    };
    
    loadUsageData();
  }, [user?.id, tier]);
  
  // 🎯 NEW: Conversation limit check with daily tracking
  const canStartConversation = async (): Promise<boolean> => {
    if (!user?.id) return false;
    
    // Development bypass
    if (import.meta.env.DEV) {
      console.log('🔓 DEV MODE: Bypassing conversation limits');
      return true;
    }
    
    // Check maintenance mode
    if (isMaintenanceMode) {
      toast.error('Atlas is temporarily in maintenance mode. Please try again later.', {
        duration: 5000,
        icon: '🛠️'
      });
      return false;
    }
    
    try {
      const check = await usageTrackingService.checkUsageBeforeConversation(user.id, tier);
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
  };
  
  // Feature access checks
  const canUseFeature = (feature: 'text' | 'audio' | 'image'): boolean => {
    // Development bypass
    if (import.meta.env.DEV) {
      console.log('🔓 DEV MODE: Bypassing feature access for', feature);
      return true;
    }
    
    return !!features[feature];
  };
  
  // Legacy message limit check (kept for compatibility)
  const isWithinLimit = (currentCount: number): boolean => {
    const maxConversations = features.maxConversationsPerDay;
    if (maxConversations === -1) return true; // Unlimited
    return currentCount < maxConversations;
  };
  
  // Model routing with token limits
  const model = features.model;
  const claudeModelName = getClaudeModelName(tier);
  const maxTokensPerResponse = features.maxTokensPerResponse;
  const maxContextWindow = features.maxContextWindow;
  
  // 🎯 NEW: Record successful conversation with token usage
  const recordConversation = async (tokensUsed: number): Promise<void> => {
    if (!user?.id) return;
    
    try {
      await usageTrackingService.recordConversation(user.id, tier, tokensUsed);
      
      // Update local state
      setConversationsToday(prev => prev + 1);
      
      // Refresh usage check for next conversation
      const newCheck = await usageTrackingService.checkUsageBeforeConversation(user.id, tier);
      setUsageCheck(newCheck);
      
    } catch (error) {
      console.error('Failed to record conversation:', error);
    }
  };
  
  // Log feature attempts for analytics
  const logFeatureAttempt = async (feature: string, allowed: boolean): Promise<void> => {
    if (!user?.id) return;
    
    try {
      await supabase
        .from('feature_attempts')
        .insert({
          user_id: user.id,
          feature,
          tier,
          allowed,
          timestamp: new Date().toISOString()
        });
    } catch (error) {
      console.warn('Failed to log feature attempt:', error);
    }
  };
  
  // 🎯 ENHANCED: Upgrade modal with specific pricing
  const showUpgradeModal = (feature: string): void => {
    const message = getUpgradeMessage(feature);
    const suggestedTier = feature === 'daily_limit' && tier === 'free' ? 'basic' : 'premium';
    const price = getTierPricing(suggestedTier);
    
    toast.error(message, {
      duration: 8000,
      action: {
        label: `Upgrade $${price}/mo`,
        onClick: () => {
          // TODO: Open Paddle checkout modal with specific tier
          console.log('Open upgrade modal for', feature, 'to', suggestedTier);
          // Track upgrade intent
          logFeatureAttempt(`upgrade_intent_${suggestedTier}`, true);
        }
      }
    });
  };
  
  // 🎯 UPDATED: Get upgrade message with new pricing
  const getUpgradeMessage = (feature: string): string => {
    switch (feature) {
      case 'audio':
        return 'Voice features require Atlas Basic ($9.99/month) or Premium ($19.99/month)';
      case 'image':
        return 'Image analysis requires Atlas Premium ($19.99/month)';
      case 'daily_limit':
        if (tier === 'free') {
          return `You've used all 20 conversations today! Upgrade to Basic for 100 daily conversations ($9.99/month)`;
        }
        return `You've used all 100 conversations today! Upgrade to Premium for unlimited conversations ($19.99/month)`;
      case 'text':
        return 'You\'ve reached your daily conversation limit. Upgrade to continue chatting!';
      default:
        return 'This feature requires an upgrade to Atlas Basic or Premium';
    }
  };
  
  return {
    // Current tier info
    tier,
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
export function useFeatureAccess(feature: 'text' | 'audio' | 'image') {
  const { canUseFeature, showUpgradeModal, logFeatureAttempt } = useTierAccess();
  
  const attemptFeature = async (): Promise<boolean> => {
    const allowed = canUseFeature(feature);
    await logFeatureAttempt(feature, allowed);
    
    if (!allowed) {
      showUpgradeModal(feature);
    }
    
    return allowed;
  };
  
  return {
    canUse: canUseFeature(feature),
    attemptFeature
  };
}

// Helper hook for message limits
export function useMessageLimit() {
  const { isWithinLimit, showUpgradeModal, logFeatureAttempt } = useTierAccess();
  
  const checkAndAttemptMessage = async (currentCount: number): Promise<boolean> => {
    const allowed = isWithinLimit(currentCount);
    await logFeatureAttempt('text', allowed);
    
    if (!allowed) {
      showUpgradeModal('text');
    }
    
    return allowed;
  };
  
  return {
    isWithinLimit,
    checkAndAttemptMessage
  };
}