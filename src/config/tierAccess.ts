/**
 * Atlas Tier Access Control - Unified Feature Gating
 * 
 * This file provides a single function to check feature access
 * and generate appropriate upgrade messages.
 */

import { tierConfig, type Tier } from './tierConfig';

export interface FeatureAccessResult {
  allowed: boolean;
  message: string | null;
  suggestedTier?: Tier;
}

/**
 * Check if a user can access a specific feature based on their tier
 */
export function checkFeatureAccess(feature: string, tier: Tier): FeatureAccessResult {
  // Check if the feature is allowed for this tier
  if (tierConfig[tier]?.[feature as keyof typeof tierConfig[Tier]]) {
    return { allowed: true, message: null };
  }

  // Generate appropriate upgrade message based on tier and feature
  if (tier === 'free') {
    if (feature === 'camera') {
      return {
        allowed: false,
        message: 'Camera features require Atlas Studio (Claude Opus – $179.99/mo). Upgrade to unlock the full experience.',
        suggestedTier: 'studio'
      };
    }
    return {
      allowed: false,
      message: 'This feature requires Atlas Core (Claude Sonnet – $19.99/mo). Upgrade to unlock audio and image features.',
      suggestedTier: 'core'
    };
  }

  if (tier === 'core' && feature === 'camera') {
    return {
      allowed: false,
      message: 'Camera features are exclusive to Atlas Studio (Claude Opus – $179.99/mo). Upgrade to unlock.',
      suggestedTier: 'studio'
    };
  }

  // Default case - should not happen with proper tier config
  return {
    allowed: false,
    message: 'This feature requires an upgrade.',
    suggestedTier: 'core'
  };
}

/**
 * Check if a user can access a feature (simple boolean check)
 */
export function canAccessFeature(feature: string, tier: Tier): boolean {
  return checkFeatureAccess(feature, tier).allowed;
}

/**
 * Get upgrade message for a feature (returns null if no upgrade needed)
 */
export function getUpgradeMessage(feature: string, tier: Tier): string | null {
  const result = checkFeatureAccess(feature, tier);
  return result.allowed ? null : result.message;
}
