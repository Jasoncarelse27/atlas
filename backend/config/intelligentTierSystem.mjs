// Atlas Enhanced Tier Gate System (backend, ESM, no removals)

import { logger } from '../lib/simpleLogger.mjs';
export const TIER_DEFINITIONS = {
  free:   { dailyMessages: 15, models: ['haiku'],              features: ['basic_chat','habit_logging'],                     budgetCeiling: 20,  priority: 1, monthlyPrice: 0 },
  core:   { dailyMessages: -1, models: ['haiku','sonnet'],     features: ['all_basic','persistent_memory','eq_challenges'],  budgetCeiling: 100, priority: 2, monthlyPrice: 19.99 },
  studio: { dailyMessages: -1, models: ['haiku','sonnet','opus'], features: ['all_features','priority_processing','advanced_analytics'], budgetCeiling: 80, priority: 3, monthlyPrice: 149.99 } // ✅ CORRECTED: Updated from $189.99
};

export const FEATURE_GATES = {
  voice_analysis: ['core','studio'],
  advanced_insights: ['studio'],
  priority_processing: ['studio'],
  persistent_memory: ['core','studio']
};

export const MODEL_COSTS = {
  // Current models (updated Dec 2024)
  'claude-3-haiku-20240307':  { input: 0.00025, output: 0.00125 }, // ✅ Correct Haiku model name
  'claude-3-sonnet-20240229': { input: 0.003,   output: 0.015   }, // ✅ Updated to correct format (Nov 2025)
  'claude-3-opus-20240229': { input: 0.015,   output: 0.075   }, // ✅ Updated to correct format (Nov 2025)
  // Legacy model names for backward compatibility
  'claude-sonnet-4-5-20250929': { input: 0.003,   output: 0.015   }, // Legacy (keep for compatibility)
  // ✅ REMOVED: claude-3.5-sonnet-20240620 (wrong format, returns 404)
  'claude-3-haiku':  { input: 0.00025, output: 0.00125 },
  'claude-3-sonnet': { input: 0.003,   output: 0.015   },
  'claude-3-opus':   { input: 0.015,   output: 0.075   }
};

export const PROMPT_CACHE_CONFIG = {
  systemPersonality: { cacheTTL: 24*60*60*1000, estimatedTokens: 2000 },
  habitFramework:    { cacheTTL: 12*60*60*1000, estimatedTokens: 500  },
  eqChallenges:      { cacheTTL: 24*60*60*1000, estimatedTokens: 800  }
};

export const SYSTEM_LIMITS = {
  maxDailySpend: 200,
  emergencyShutoff: 250,
  highTrafficThreshold: 150
};

export function selectOptimalModel(userTier, messageContent = '', requestType = '') {
  // ✅ Tier-based model selection (aligned with messageService.js)
  // ✅ FIXED: Using claude-sonnet-4-5-20250929 (claude-3-sonnet-20240229 returns 404)
  const MODEL_MAP = {
    free: 'claude-3-haiku-20240307', // ✅ Correct Haiku model name
    core: 'claude-sonnet-4-5-20250929', // ✅ FIXED: Updated from claude-3-sonnet-20240229 (returns 404)
    studio: 'claude-sonnet-4-5-20250929', // ✅ FIXED: Updated from claude-3-opus-20240229 (returns 404)
  };
  
  const selectedModel = MODEL_MAP[userTier] || MODEL_MAP.free;
  
  logger.debug({
    tier: userTier,
    selectedModel,
    messageLength: messageContent.length,
    type: requestType
  });
  
  return selectedModel;
}

export function estimateRequestCost(model, inputTokens = 0, outputTokens = 0) {
  const c = MODEL_COSTS[model];
  if (!c) return 0;
  return (inputTokens * c.input / 1000) + (outputTokens * c.output / 1000);
}

// ==========================================================
// Cursor-Style Billing System Extensions
// ==========================================================
// Added for Cursor-style billing with monthly credit allowances
// and overage billing (mid-month + end-month invoices)

/**
 * MODEL_PRICING - Pricing per 1K tokens for each model
 * Reuses existing MODEL_COSTS structure for consistency
 */
export const MODEL_PRICING = {
  'claude-3-haiku-20240307': { inputPer1K: 0.00025, outputPer1K: 0.00125 },
  'claude-3-sonnet-20240229': { inputPer1K: 0.003, outputPer1K: 0.015 },
  'claude-3-opus-20240229': { inputPer1K: 0.015, outputPer1K: 0.075 },
  'claude-sonnet-4-5-20250929': { inputPer1K: 0.003, outputPer1K: 0.015 }, // Legacy compatibility
  'claude-3-haiku': { inputPer1K: 0.00025, outputPer1K: 0.00125 },
  'claude-3-sonnet': { inputPer1K: 0.003, outputPer1K: 0.015 },
  'claude-3-opus': { inputPer1K: 0.015, outputPer1K: 0.075 }
};

/**
 * PLAN_INCLUDED_CREDITS_USD - Monthly credit allowance per tier (in USD)
 * Matches subscription price: Core = $19.99, Studio = $149.99
 */
export const PLAN_INCLUDED_CREDITS_USD = {
  free: 0,
  core: 19.99,    // Matches Core subscription price
  studio: 149.99  // Matches Studio subscription price
};

/**
 * Calculate token cost in USD for a given model and token counts
 * Enhanced version of estimateRequestCost() for billing system
 * 
 * @param {Object} params - Token usage parameters
 * @param {string} params.model - Model name (e.g. 'claude-sonnet-4-5-20250929')
 * @param {number} params.inputTokens - Input token count
 * @param {number} params.outputTokens - Output token count
 * @returns {number} Total cost in USD (rounded to 6 decimal places)
 */
export function calculateTokenCostUsd({ model, inputTokens, outputTokens }) {
  const pricing = MODEL_PRICING[model];
  if (!pricing) {
    logger.warn(`[Billing] Unknown model pricing for: ${model}, defaulting to 0`);
    return 0;
  }
  
  const inCost = (inputTokens / 1000) * pricing.inputPer1K;
  const outCost = (outputTokens / 1000) * pricing.outputPer1K;
  const totalCost = inCost + outCost;
  
  // Round to 6 decimal places for precision
  return Number(totalCost.toFixed(6));
}

/**
 * Get included credits in USD for a given tier
 * 
 * @param {string} tier - User tier ('free' | 'core' | 'studio')
 * @returns {number} Included credits in USD
 */
export function getIncludedCreditsUsdForTier(tier) {
  return PLAN_INCLUDED_CREDITS_USD[tier] ?? 0;
}
