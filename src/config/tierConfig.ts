/**
 * Atlas Tier Configuration - Single Source of Truth
 * 
 * This file defines the exact feature access for each tier.
 * All tier gating logic should reference this configuration.
 */

export type Tier = 'free' | 'core' | 'studio';

export interface TierFeatures {
  text: boolean;
  audio: boolean;
  image: boolean;
  camera: boolean;
}

export const tierConfig: Record<Tier, TierFeatures> = {
  free: {
    text: true,
    audio: false,
    image: false,
    camera: false,
  },
  core: {
    text: true,
    audio: true,
    image: true,
    camera: false,
  },
  studio: {
    text: true,
    audio: true,
    image: true,
    camera: true,
  },
};

/**
 * Get the Claude model name for a given tier
 */
export function getClaudeModelName(tier: Tier): string {
  switch (tier) {
    case 'studio':
      return 'claude-3-opus-20240229';
    case 'core':
      return 'claude-3.5-sonnet-20240620';
    case 'free':
    default:
      return 'claude-3-haiku-20240307';
  }
}

/**
 * Get tier pricing information
 */
export function getTierPricing(tier: Tier): number {
  switch (tier) {
    case 'core':
      return 19.99;
    case 'studio':
      return 179.99;
    case 'free':
    default:
      return 0;
  }
}

/**
 * Get tier display name
 */
export function getTierDisplayName(tier: Tier): string {
  switch (tier) {
    case 'core':
      return 'Atlas Core';
    case 'studio':
      return 'Atlas Studio';
    case 'free':
    default:
      return 'Atlas Free';
  }
}
