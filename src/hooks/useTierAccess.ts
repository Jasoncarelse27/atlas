// Atlas V1 Golden Standard Tier Access Hook
// Centralized tier enforcement and feature access logic

import toast from 'react-hot-toast';
import { Tier, getClaudeModelName, isValidTier, tierFeatures } from '../config/featureAccess';
import { supabase } from '../lib/supabase';
import { useSubscription } from './useSubscription';
import { useSupabaseAuth } from './useSupabaseAuth';

export interface TierAccessReturn {
  // Current tier info
  tier: Tier;
  features: typeof tierFeatures[Tier];
  
  // Feature access checks
  canUseFeature: (feature: 'text' | 'audio' | 'image') => boolean;
  isWithinLimit: (currentCount: number) => boolean;
  
  // Model routing
  model: string;
  claudeModelName: string;
  
  // Usage tracking
  logFeatureAttempt: (feature: string, allowed: boolean) => Promise<void>;
  
  // Upgrade helpers
  showUpgradeModal: (feature: string) => void;
  getUpgradeMessage: (feature: string) => string;
}

export function useTierAccess(): TierAccessReturn {
  const { user } = useSupabaseAuth();
  const { profile, canAccessFeature, updateUsage } = useSubscription(user);
  
  // Get current tier with fallback to 'free'
  const tier: Tier = (profile?.tier && isValidTier(profile.tier)) ? profile.tier as Tier : 'free';
  const features = tierFeatures[tier];
  
  // Feature access checks
  const canUseFeature = (feature: 'text' | 'audio' | 'image'): boolean => {
    // Development bypass
    if (import.meta.env.DEV) {
      console.log('🔓 DEV MODE: Bypassing feature access for', feature);
      return true;
    }
    
    return !!features[feature];
  };
  
  // Message limit check
  const isWithinLimit = (currentCount: number): boolean => {
    if (features.maxMessages === null) return true; // Unlimited
    return currentCount < features.maxMessages;
  };
  
  // Model routing
  const model = features.model;
  const claudeModelName = getClaudeModelName(tier);
  
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
  
  // Upgrade modal trigger
  const showUpgradeModal = (feature: string): void => {
    const message = getUpgradeMessage(feature);
    toast.error(message, {
      duration: 5000,
      action: {
        label: 'Upgrade',
        onClick: () => {
          // TODO: Open Paddle checkout modal
          console.log('Open upgrade modal for', feature);
        }
      }
    });
  };
  
  // Get upgrade message based on feature
  const getUpgradeMessage = (feature: string): string => {
    switch (feature) {
      case 'audio':
        return 'Voice features require Atlas Core ($19.99/month) or Studio ($179.99/month)';
      case 'image':
        return 'Image analysis requires Atlas Core ($19.99/month) or Studio ($179.99/month)';
      case 'text':
        return 'You\'ve reached your monthly message limit. Upgrade to continue chatting!';
      default:
        return 'This feature requires an upgrade to Atlas Core or Studio';
    }
  };
  
  return {
    tier,
    features,
    canUseFeature,
    isWithinLimit,
    model,
    claudeModelName,
    logFeatureAttempt,
    showUpgradeModal,
    getUpgradeMessage
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