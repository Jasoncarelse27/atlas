// backend/services/tierService.mjs
// ✅ BEST PRACTICE: Centralized tier fetching, normalization, and validation
// Single source of truth for tier resolution across the entire backend

import { logger } from '../lib/simpleLogger.mjs';
import { supabase } from '../config/supabaseClient.mjs';
import { TIER_DEFINITIONS } from '../config/intelligentTierSystem.mjs';

/**
 * Valid tier values (lowercase, normalized)
 * @type {readonly ['free', 'core', 'studio']}
 */
export const VALID_TIERS = ['free', 'core', 'studio'];

/**
 * @typedef {'free' | 'core' | 'studio'} Tier
 */

/**
 * Normalizes and validates a tier value from the database.
 * Handles case variations, whitespace, and legacy values.
 * 
 * @param {string|null|undefined} rawTier - Raw tier value from database
 * @returns {Tier} Normalized tier ('free', 'core', or 'studio')
 */
export function normalizeTier(rawTier) {
  if (!rawTier || typeof rawTier !== 'string') {
    return 'free';
  }
  
  const normalized = rawTier.toLowerCase().trim();
  
  // ✅ VALIDATION: Ensure tier is one of the expected values
  if (VALID_TIERS.includes(normalized)) {
    return normalized;
  }
  
  // ✅ LEGACY VALUES: Map old tier names to 'free'
  const legacyTierMap = {
    'pro': 'free',
    'premium': 'free',
    'mvps': 'free',
    'unknown': 'free',
    'basic': 'free',
    'standard': 'free'
  };
  
  if (legacyTierMap[normalized]) {
    logger.debug(`[TierService] 🔄 Legacy tier '${rawTier}' mapped to 'free'`);
    return 'free';
  }
  
  // ✅ FAIL CLOSED: Unknown tier defaults to 'free'
  logger.warn(`[TierService] ⚠️ Unknown tier value '${rawTier}' normalized to 'free'`);
  return 'free';
}

/**
 * Fetches user tier from database with normalization and validation.
 * This is the single source of truth for tier resolution.
 * 
 * @param {string} userId - User ID
 * @param {Object} options - Options
 * @param {boolean} options.failClosed - Default to 'free' on error (default: true)
 * @param {boolean} options.logErrors - Log errors (default: true)
 * @returns {Promise<Tier>} Normalized tier ('free', 'core', or 'studio')
 */
export async function getUserTier(userId, options = {}) {
  const { failClosed = true, logErrors = true } = options;
  
  if (!userId) {
    if (logErrors) {
      logger.warn('[TierService] Missing userId for getUserTier');
    }
    return 'free';
  }

  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .single();

    if (error) {
      if (logErrors) {
        logger.error(`[TierService] ❌ Error fetching tier for ${userId}:`, error.message || error);
      }
      return failClosed ? 'free' : null;
    }

    const rawTier = profile?.subscription_tier;
    const normalizedTier = normalizeTier(rawTier);
    
    // ✅ LOGGING: Log tier resolution for debugging (only in development or when tier changes)
    if (logErrors && normalizedTier !== rawTier) {
      logger.info(`[TierService] 🔍 Tier normalized for user ${userId}: '${rawTier}' → '${normalizedTier}'`);
    }
    
    return normalizedTier;
  } catch (err) {
    if (logErrors) {
      logger.error(`[TierService] ❌ Exception fetching tier for ${userId}:`, err.message || err);
    }
    return failClosed ? 'free' : null;
  }
}

/**
 * Validates that a tier exists in TIER_DEFINITIONS.
 * 
 * @param {string} tier - Tier to validate
 * @returns {boolean} True if tier is valid
 */
export function isValidTier(tier) {
  return VALID_TIERS.includes(tier) && TIER_DEFINITIONS[tier] !== undefined;
}

/**
 * Checks if a tier is a paid tier (core or studio).
 * 
 * @param {string} tier - Tier to check
 * @returns {boolean} True if tier is paid
 */
export function isPaidTier(tier) {
  return tier === 'core' || tier === 'studio';
}

/**
 * Checks if a tier has unlimited messages.
 * 
 * @param {string} tier - Tier to check
 * @returns {boolean} True if tier has unlimited messages
 */
export function hasUnlimitedMessages(tier) {
  const tierConfig = TIER_DEFINITIONS[tier];
  return tierConfig?.dailyMessages === -1;
}

/**
 * Alias for getUserTier for consistency with refactor plan.
 * Safe wrapper that always returns a valid tier (never null).
 * 
 * @param {string} userId - User ID
 * @param {Object} [options] - Options
 * @param {boolean} [options.failClosed=true] - Default to 'free' on error
 * @param {boolean} [options.logErrors=true] - Log errors
 * @returns {Promise<Tier>} Normalized tier ('free', 'core', or 'studio')
 */
export const getUserTierSafe = getUserTier;

