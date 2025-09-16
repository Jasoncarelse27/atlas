// src/config/featureAccess.ts

import type { Tier } from '../types/tier';

// Runtime tier values (for runtime usage)
export const TIER_VALUES = ['free', 'core', 'studio'] as const;

// Map of feature access by tier with message limits
export const tierFeatures = {
  free: { 
    text: true, 
    audio: false, 
    image: false,
    maxMessages: 15,  // 🎯 FIXED: 15 messages per month for Free tier
    model: 'claude-3-haiku'
  },
  core: { 
    text: true, 
    audio: true, 
    image: true,
    maxMessages: null,  // Unlimited
    model: 'claude-3-sonnet'
  },
  studio: { 
    text: true, 
    audio: true, 
    image: true,
    maxMessages: null,  // Unlimited
    model: 'claude-3-opus'
  },
} as const;

// Validate tier value
export function isValidTier(tier: string): tier is Tier {
  return TIER_VALUES.includes(tier as any);
}

// Map tiers → Claude model
export function getClaudeModelName(tier: Tier): string {
  if (tier === 'studio') return 'claude-3-opus-20240229';
  if (tier === 'core') return 'claude-3-sonnet-20240229';
  return 'claude-3-haiku-20240307'; // fallback for free
}
