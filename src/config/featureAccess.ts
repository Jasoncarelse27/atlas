// src/config/featureAccess.ts

// Runtime tier values (for runtime usage)
export const TIER_VALUES = ['free', 'core', 'studio'] as const;

// Define tier type from runtime values
export type Tier = typeof TIER_VALUES[number];

// Runtime export for Tier (to ensure it's available at runtime)
export const Tier = TIER_VALUES;

// Map of feature access by tier
export const tierFeatures = {
  free: { text: true, audio: false, image: false },
  core: { text: true, audio: true, image: true },
  studio: { text: true, audio: true, image: true },
} as const;

// Validate tier value
export function isValidTier(tier: string): tier is Tier {
  return TIER_VALUES.includes(tier as any);
}

// Map tiers → Claude model
export function getClaudeModelName(tier: Tier): string {
  if (tier === 'studio') return 'claude-3-opus';
  if (tier === 'core') return 'claude-3-sonnet';
  return 'claude-3-haiku'; // fallback for free
}
