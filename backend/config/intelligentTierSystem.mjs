// Atlas Enhanced Tier Gate System (backend, ESM, no removals)

import { logger } from '../lib/simpleLogger.mjs';
export const TIER_DEFINITIONS = {
  free:   { dailyMessages: 15, models: ['haiku'],              features: ['basic_chat','habit_logging'],                     budgetCeiling: 20,  priority: 1, monthlyPrice: 0 },
  core:   { dailyMessages: -1, models: ['haiku','sonnet'],     features: ['all_basic','persistent_memory','eq_challenges'],  budgetCeiling: 100, priority: 2, monthlyPrice: 19.99 },
  studio: { dailyMessages: -1, models: ['haiku','sonnet'], features: ['all_features','priority_processing','advanced_analytics'], budgetCeiling: 80, priority: 3, monthlyPrice: 149.99 } // ✅ Use Sonnet (not Opus) for launch
};

export const FEATURE_GATES = {
  voice_analysis: ['core','studio'],
  advanced_insights: ['studio'],
  priority_processing: ['studio'],
  persistent_memory: ['core','studio']
};

export const MODEL_COSTS = {
  // ✅ PRODUCTION MODELS: Use -latest aliases for guaranteed usage reporting
  'claude-3-5-haiku-latest':   { input: 0.00025, output: 0.00050 },
  'claude-3-5-sonnet-latest':  { input: 0.00300, output: 0.01500 },
  'claude-opus-4-1-20250805': { input: 0.01500, output: 0.07500 }, // ✅ Correct Opus model
  
  // Legacy models (keep for backward compatibility with existing data)
  'claude-3-haiku-20240307':  { input: 0.00025, output: 0.00125 },
  'claude-3-sonnet-20240229': { input: 0.003,   output: 0.015   },
  'claude-3-opus-20240229':   { input: 0.015,   output: 0.075   },
  'claude-3-opus-latest':     { input: 0.01500, output: 0.07500 }, // Legacy alias
  'claude-sonnet-4-5-20250929': { input: 0.003, output: 0.015 },
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
  // ✅ PRODUCTION MODELS: Use working models (claude-3-sonnet-20240229 and claude-3-5-sonnet-latest both return 404)
  // Studio tier uses Sonnet (not Opus) for launch - matches frontend configuration
  // Note: claude-sonnet-4-5-20250929 works but doesn't return usage - we estimate tokens as fallback
  const MODEL_MAP = {
    free: 'claude-3-5-haiku-latest', // ✅ Verified working - billing-enabled
    core: 'claude-sonnet-4-5-20250929', // ✅ Works (4.x models don't return usage, we estimate)
    studio: 'claude-sonnet-4-5-20250929', // ✅ Works (4.x models don't return usage, we estimate)
  };
  
  // ✅ SMART ROUTING: Use Haiku for simple queries (research-backed cost optimization)
  // Research shows: Haiku handles simple queries well, saves 80-90% cost
  // Threshold: < 100 chars = simple query (questions, short messages)
  const messageLength = messageContent?.length || 0;
  const isSimpleQuery = messageLength > 0 && messageLength < 100 && !requestType.includes('complex');
  
  // ✅ TIER-BASED LOGIC WITH SMART ROUTING:
  // - Free: Always Haiku (no change)
  // - Core/Studio: Sonnet for complex, Haiku for simple (cost optimization)
  // - Voice calls: Always Haiku (handled separately in server.mjs)
  if (userTier === 'free') {
    return MODEL_MAP.free; // Free tier always uses Haiku
  }
  
  // ✅ Core/Studio: Smart routing based on query complexity
  if (userTier === 'core' || userTier === 'studio') {
    // Use Haiku for simple queries (cost savings: 80-90% reduction)
    if (isSimpleQuery && requestType !== 'complex_reasoning' && requestType !== 'file_analysis') {
      logger.debug('[ModelSelection] ✅ Routing simple query to Haiku (cost optimization)', {
        tier: userTier,
        messageLength,
        requestType,
        reason: 'simple_query'
      });
      return 'claude-3-5-haiku-latest';
    }
    
    // Use Sonnet for complex queries (premium experience)
    logger.debug('[ModelSelection] ✅ Routing complex query to Sonnet (premium)', {
      tier: userTier,
      messageLength,
      requestType,
      reason: 'complex_query'
    });
    return MODEL_MAP[userTier];
  }
  
  // Fallback
  const selectedModel = MODEL_MAP[userTier] || MODEL_MAP.free;
  
  logger.debug('[ModelSelection]', {
    tier: userTier,
    selectedModel,
    messageLength,
    type: requestType
  });
  
  return selectedModel;
}

/**
 * ✅ FALLBACK MODEL SELECTION: Get fallback model when primary fails
 * Used for overload fallback (Sonnet → Haiku) - research-backed best practice
 * 
 * @param {string} primaryModel - The model that failed (e.g. 'claude-sonnet-4-5-20250929')
 * @param {string} userTier - User tier ('free' | 'core' | 'studio')
 * @returns {string|null} Fallback model name or null if no fallback available
 */
export function getFallbackModel(primaryModel, userTier) {
  // ✅ If primary is Sonnet and user has access to Haiku, fallback to Haiku
  // This is a research-backed best practice for handling overloads
  if (primaryModel && primaryModel.includes('sonnet') && (userTier === 'core' || userTier === 'studio')) {
    logger.debug('[FallbackModel] ✅ Sonnet → Haiku fallback available', {
      primaryModel,
      fallbackModel: 'claude-3-5-haiku-latest',
      userTier
    });
    return 'claude-3-5-haiku-latest';
  }
  
  // ✅ If primary is Haiku, no fallback (already cheapest/fastest)
  if (primaryModel && primaryModel.includes('haiku')) {
    logger.debug('[FallbackModel] ⏭️ No fallback available (already using Haiku)', {
      primaryModel,
      userTier
    });
    return null; // No fallback available
  }
  
  // ✅ Default fallback: Try Haiku (safest option)
  logger.debug('[FallbackModel] ✅ Using default Haiku fallback', {
    primaryModel,
    fallbackModel: 'claude-3-5-haiku-latest',
    userTier
  });
  return 'claude-3-5-haiku-latest';
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
  // ✅ PRODUCTION MODELS: Use -latest aliases for guaranteed usage reporting
  'claude-3-5-haiku-latest':   { inputPer1K: 0.00025, outputPer1K: 0.00050 },
  'claude-3-5-sonnet-latest':  { inputPer1K: 0.00300, outputPer1K: 0.01500 },
  'claude-opus-4-1-20250805': { inputPer1K: 0.01500, outputPer1K: 0.07500 }, // ✅ Correct Opus model
  
  // Legacy models (keep for backward compatibility)
  'claude-3-haiku-20240307': { inputPer1K: 0.00025, outputPer1K: 0.00125 },
  'claude-3-sonnet-20240229': { inputPer1K: 0.003, outputPer1K: 0.015 },
  'claude-3-opus-20240229': { inputPer1K: 0.015, outputPer1K: 0.075 },
  'claude-3-opus-latest': { inputPer1K: 0.01500, outputPer1K: 0.07500 }, // Legacy alias
  'claude-sonnet-4-5-20250929': { inputPer1K: 0.003, outputPer1K: 0.015 },
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
