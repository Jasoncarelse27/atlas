// backend/middleware/tierGateMiddleware.mjs
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

import { createClient } from '@supabase/supabase-js';

// Service role client (server-side only!)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// Model configurations per tier
const TIER_MODELS = {
  free: {
    model: 'claude-3-haiku-20240307',
    maxTokens: 1024,
    dailyBudget: 2.00 // $2 per day max for free tier
  },
  core: {
    model: 'claude-3-sonnet-20240229',
    maxTokens: 4096,
    dailyBudget: 50.00 // $50 per day max for core tier
  },
  studio: {
    model: 'claude-3-opus-20240229',
    maxTokens: 4096,
    dailyBudget: 200.00 // $200 per day max for studio tier
  }
};

/**
 * Middleware to enforce budget ceilings and select optimal models per tier.
 * - Checks daily spending against tier budget limits
 * - Selects appropriate Claude model based on tier
 * - Tracks budget usage in real-time
 * 
 * Attaches `req.selectedModel`, `req.budgetStatus` for downstream services.
 */
export async function tierGateMiddleware(req, res, next) {
  try {
    const tier = req.tier || req.body?.tier || 'free';
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "UNAUTHORIZED" });

    const tierConfig = TIER_MODELS[tier];
    if (!tierConfig) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tier for model selection',
        error: 'INVALID_TIER'
      });
    }

    const today = new Date().toISOString().slice(0, 10);

    // Check current daily spending for this tier
    const { data: budgetData, error: budgetError } = await supabase
      .from('budget_tracking')
      .select('total_spend, request_count')
      .eq('date', today)
      .eq('tier', tier)
      .maybeSingle();

    if (budgetError && budgetError.code !== 'PGRST116') {
      console.error('[tierGateMiddleware] Budget check error:', budgetError.message);
      // Fail safe - allow request but log error
    }

    const currentSpend = budgetData?.total_spend || 0;
    const requestCount = budgetData?.request_count || 0;
    const budgetLimit = tierConfig.dailyBudget;
    const budgetRemaining = budgetLimit - currentSpend;

    // Budget ceiling enforcement
    if (currentSpend >= budgetLimit) {
      console.warn(`[tierGateMiddleware] Budget ceiling hit for ${tier}: $${currentSpend}/$${budgetLimit}`);
      
      return res.status(429).json({
        success: false,
        message: `Daily budget limit reached for ${tier} tier. Please try again tomorrow or upgrade.`,
        error: 'BUDGET_LIMIT_EXCEEDED',
        budgetUsed: currentSpend,
        budgetLimit: budgetLimit,
        upgradeUrl: '/upgrade'
      });
    }

    // Estimate cost for this request (rough approximation)
    const messageLength = req.body?.message?.length || 0;
    const estimatedTokens = Math.min(Math.ceil(messageLength / 3), tierConfig.maxTokens);
    const estimatedCost = calculateEstimatedCost(tierConfig.model, estimatedTokens);

    // Warn if this request would exceed budget
    if (currentSpend + estimatedCost > budgetLimit) {
      console.warn(`[tierGateMiddleware] Request would exceed budget: $${currentSpend + estimatedCost} > $${budgetLimit}`);
      
      return res.status(429).json({
        success: false,
        message: `This request would exceed your daily budget. Remaining: $${budgetRemaining.toFixed(2)}`,
        error: 'BUDGET_WOULD_EXCEED',
        estimatedCost: estimatedCost,
        budgetRemaining: budgetRemaining,
        upgradeUrl: '/upgrade'
      });
    }

    // Pre-increment budget tracking (optimistic)
    const { error: budgetIncrementError } = await supabase
      .rpc('increment_budget_tracking', {
        p_date: today,
        p_tier: tier,
        p_spend_delta: estimatedCost,
        p_req_delta: 1
      });

    if (budgetIncrementError) {
      console.warn('[tierGateMiddleware] Failed to increment budget tracking:', budgetIncrementError.message);
    }

    // Log model usage for analytics
    const { error: modelLogError } = await supabase
      .rpc('log_model_usage', {
        p_date: today,
        p_model: tierConfig.model,
        p_tier: tier,
        p_cost: estimatedCost
      });

    if (modelLogError) {
      console.warn('[tierGateMiddleware] Failed to log model usage:', modelLogError.message);
    }

    // Attach model selection and budget info for downstream
    req.selectedModel = {
      name: tierConfig.model,
      maxTokens: tierConfig.maxTokens,
      estimatedCost: estimatedCost,
      estimatedTokens: estimatedTokens
    };

    req.budgetStatus = {
      tier: tier,
      used: currentSpend + estimatedCost,
      limit: budgetLimit,
      remaining: budgetRemaining - estimatedCost,
      requestCount: requestCount + 1
    };

    console.log(`[tierGateMiddleware] ${tier} tier: ${tierConfig.model} selected, budget: $${(currentSpend + estimatedCost).toFixed(4)}/$${budgetLimit}`);

    return next();
  } catch (err) {
    console.error('[tierGateMiddleware] Unexpected error:', err);
    
    // Graceful fallback - use free tier defaults
    const fallbackTier = 'free';
    const fallbackConfig = TIER_MODELS[fallbackTier];
    
    req.selectedModel = {
      name: fallbackConfig.model,
      maxTokens: fallbackConfig.maxTokens,
      estimatedCost: 0.001,
      estimatedTokens: 100
    };
    
    req.budgetStatus = {
      tier: fallbackTier,
      used: 0,
      limit: fallbackConfig.dailyBudget,
      remaining: fallbackConfig.dailyBudget,
      requestCount: 1,
      error: true
    };
    
    return next();
  }
}

/**
 * Calculate estimated API cost based on model and token count
 * Uses approximate pricing as of 2024
 */
function calculateEstimatedCost(model, tokens) {
  const pricing = {
    'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 }, // per 1K tokens
    'claude-3-sonnet-20240229': { input: 0.003, output: 0.015 },
    'claude-3-opus-20240229': { input: 0.015, output: 0.075 }
  };

  const modelPricing = pricing[model] || pricing['claude-3-haiku-20240307'];
  
  // Rough estimate: 60% input tokens, 40% output tokens
  const inputTokens = Math.ceil(tokens * 0.6);
  const outputTokens = Math.ceil(tokens * 0.4);
  
  const inputCost = (inputTokens / 1000) * modelPricing.input;
  const outputCost = (outputTokens / 1000) * modelPricing.output;
  
  return inputCost + outputCost;
}

export default tierGateMiddleware;
