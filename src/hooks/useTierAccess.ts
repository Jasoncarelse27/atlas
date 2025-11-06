import { useCallback } from 'react';
import toast from 'react-hot-toast';
import { getClaudeModelName, tierFeatures, isVoiceCallComingSoon } from '../config/featureAccess';
import { useTierQuery } from './useTierQuery';

type Tier = "free" | "core" | "studio";

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
  // ✅ SOFT LAUNCH: Respect soft launch flag for voice calls
  const canUse = feature === 'voice' 
    ? !isVoiceCallComingSoon() && (tierFeatures[tier]?.voiceCallsEnabled || false)
    : tierFeatures[tier]?.[feature] || false;
  
  const attemptFeature = useCallback(async () => {
    if (canUse) return true;
    
    // Tier-specific upgrade messages (skip for voice - handled by custom modal)
    if (feature !== 'voice') {
      toast.error(`${feature} requires Core or Studio tier`);
    } else if (isVoiceCallComingSoon()) {
      // ✅ SOFT LAUNCH: Show "coming soon" message for voice calls
      toast.info('🎙️ Voice calls coming soon!', { 
        icon: '🔜',
        duration: 3000,
      });
    }
    // No toast for voice - components trigger custom VoiceUpgradeModal
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
  const config = tierFeatures[tier] as any;
  const monthlyLimit = config?.monthlyMessages || config?.maxConversationsPerMonth || 15;
  const isUnlimited = monthlyLimit === -1;
  
  return {
    monthlyLimit,
    isUnlimited,
    canSendMessage: true, // Always true - enforcement happens in attemptFeature
    remainingMessages: isUnlimited ? -1 : monthlyLimit,
    isLoading: loading,
  };
}

// Export type for compatibility
export type { Tier };
