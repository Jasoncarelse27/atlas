// 🔥 REDIRECTED TO MODERN TIER SYSTEM
// All tier access now uses the centralized React Query hook with Realtime updates

import { useCallback } from 'react';
import toast from 'react-hot-toast';
import { getClaudeModelName, tierFeatures } from '../config/featureAccess';
import { useTierQuery } from './useTierQuery';

type Tier = "free" | "core" | "studio";

interface TierAccessState {
  tier: Tier;
  loading: boolean;
  userId: string | null;
}

// ✅ CENTRALIZED TIER ACCESS HOOK - NOW USES REACT QUERY + REALTIME
export function useTierAccess() {
  const { tier, userId, isLoading: loading } = useTierQuery();
  
  // ✅ Feature access based on tier config (NO hardcoded checks!)
  const hasAccess = useCallback((feature: "file" | "image" | "camera" | "audio") => {
    if (loading) return false;
    
    const config = tierFeatures[tier];
    
    // Map feature names to config keys
    const featureMap = {
      file: 'text',
      image: 'image',
      camera: 'camera',
      audio: 'audio'
    } as const;
    
    return config[featureMap[feature]] || false;
  }, [tier, loading]);

  // ✅ Show upgrade modal
  const showUpgradeModal = useCallback((feature?: string) => {
    toast.error(`${feature || 'This feature'} requires an upgrade`);
  }, []);

  // ✅ Claude model name from config
  const claudeModelName = getClaudeModelName(tier);

  return { 
    tier,
    userId,
    hasAccess, 
    loading, 
    showUpgradeModal,
    claudeModelName,
    tierFeatures: tierFeatures[tier],
    refresh: () => {}, // No manual refresh needed with Realtime!
  };
}

// ✅ FEATURE ACCESS HOOK - For specific feature checks
export function useFeatureAccess(feature: "audio" | "image" | "camera" | "voice") {
  const { tier, loading, userId } = useTierAccess();
  
  // ✅ Use tier config instead of hardcoded checks
  const canUse = tierFeatures[tier]?.[feature] || false;
  
  const attemptFeature = useCallback(async () => {
    if (canUse) return true;
    
    toast.error(`${feature} requires ${feature === 'voice' ? 'Studio' : 'Core or Studio'} tier`);
    return false;
  }, [canUse, feature]);

  return {
    canUse,
    attemptFeature,
    isLoading: loading,
    tier,
    userId,
  };
}

// ✅ MESSAGE LIMIT HOOK - For message/usage limits
export function useMessageLimit() {
  const { tier, loading } = useTierAccess();
  
  // ✅ Get limits from tier config (NO hardcoded checks!)
  const monthlyLimit = tierFeatures[tier]?.monthlyMessages || 15;
  const isUnlimited = monthlyLimit === -1;
  
  return {
    monthlyLimit,
    isUnlimited,
    canSendMessage: true, // TODO: Connect to real usage API
    remainingMessages: isUnlimited ? -1 : monthlyLimit,
    isLoading: loading,
  };
}

// Export type for compatibility
export type { Tier };
