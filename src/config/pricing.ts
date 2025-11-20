// src/config/pricing.ts
// ✅ CENTRALIZED PRICING CONFIGURATION - Single Source of Truth
// Best Practice: All pricing should reference these constants

/**
 * 🎯 Atlas Subscription Pricing Configuration
 * 
 * Best Practice Update (Nov 2025):
 * - Single source of truth for all pricing
 * - Prevents inconsistencies across codebase
 * - Easy to update pricing in one place
 * - Type-safe pricing access
 */

export const TIER_PRICING = {
  free: {
    monthlyPrice: 0,
    yearlyPrice: 0,
    displayPrice: '$0/month',
    displayYearlyPrice: '$0/year',
    creditAmount: 0,
    creditMultiplier: 0,
  },
  core: {
    monthlyPrice: 19.99,
    yearlyPrice: 199.99,
    displayPrice: '$19.99/month',
    displayYearlyPrice: '$199.99/year',
    creditAmount: 19.99,
    creditMultiplier: 1.0,
  },
  studio: {
    monthlyPrice: 149.99, // ✅ CORRECTED: Was $189.99
    yearlyPrice: 1499.99, // ✅ Updated: ~10% discount for yearly
    displayPrice: '$149.99/month',
    displayYearlyPrice: '$1499.99/year',
    creditAmount: 299.98, // ✅ 2× multiplier (matches Cursor Ultra model)
    creditMultiplier: 2.0,
  },
} as const;

/**
 * Get monthly price for a tier
 */
export function getMonthlyPrice(tier: 'free' | 'core' | 'studio'): number {
  return TIER_PRICING[tier].monthlyPrice;
}

/**
 * Get display price string for a tier
 */
export function getDisplayPrice(tier: 'free' | 'core' | 'studio'): string {
  return TIER_PRICING[tier].displayPrice;
}

/**
 * Get credit amount for a tier (for credit-based billing)
 */
export function getCreditAmount(tier: 'free' | 'core' | 'studio'): number {
  return TIER_PRICING[tier].creditAmount;
}

/**
 * Get credit multiplier for a tier
 */
export function getCreditMultiplier(tier: 'free' | 'core' | 'studio'): number {
  return TIER_PRICING[tier].creditMultiplier;
}




























