// backend/middleware/dailyLimitMiddleware.mjs
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables (only in development)
if (process.env.NODE_ENV !== 'production') {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
}

import { createClient } from '@supabase/supabase-js';

// Service role client (server-side only!)
// In production, environment variables are injected by the platform
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('[dailyLimitMiddleware] Missing Supabase credentials - middleware will fail gracefully');
}

const supabase = supabaseUrl && supabaseServiceKey ? createClient(
  supabaseUrl,
  supabaseServiceKey,
  { auth: { persistSession: false } }
) : null;

// Tier configuration
const TIER_LIMITS = {
  free: 15,
  core: -1,    // unlimited
  studio: -1   // unlimited
};

/**
 * Middleware to enforce per-tier daily message limits.
 * - Free users: 15 messages per day
 * - Core/Studio: unlimited (-1 in config = no limit)
 *
 * Attaches `req.tier` and `req.dailyUsage` for downstream services.
 */
export async function dailyLimitMiddleware(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "UNAUTHORIZED" });
    
    const { tier } = req.body || {};
    if (!tier) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing tier information',
        error: 'MISSING_TIER'
      });
    }

    const dailyLimit = TIER_LIMITS[tier];
    if (dailyLimit === undefined) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid tier provided',
        error: 'INVALID_TIER'
      });
    }

    // If unlimited, just skip limit check
    if (dailyLimit === -1) {
      req.tier = tier;
      req.dailyUsage = { count: 0, limit: -1, unlimited: true };
      return next();
    }

    const today = new Date().toISOString().slice(0, 10);

    // Attach userId to request body for downstream middleware compatibility
    req.body.userId = userId;

    // Get or create today's usage record
    let usageData = null;
    let selectError = null;
    
    if (supabase) {
      const result = await supabase
        .from('daily_usage')
        .select('conversations_count')
        .eq('user_id', req.body.userId)
        .eq('date', today)
        .maybeSingle();
      usageData = result.data;
      selectError = result.error;
    } else {
      console.warn('[dailyLimitMiddleware] Supabase not available, using in-memory tracking');
    }

    let currentCount = 0;
    
    if (selectError && selectError.code !== 'PGRST116') { // PGRST116 = no rows
      console.error('[dailyLimitMiddleware] Supabase select error:', selectError.message);
      // Fall back to in-memory tracking for test users
      if (!global.testUserUsage) global.testUserUsage = {};
      const userKey = `${req.body.userId}-${today}`;
      currentCount = global.testUserUsage[userKey] || 0;
    } else {
      currentCount = usageData?.conversations_count || 0;
      // If no DB record, check in-memory tracking
      if (currentCount === 0 && global.testUserUsage) {
        const userKey = `${req.body.userId}-${today}`;
        currentCount = global.testUserUsage[userKey] || 0;
      }
    }

    // Check if limit exceeded
    if (currentCount >= dailyLimit) {
      return res.status(429).json({
        success: false,
        message: `Daily limit of ${dailyLimit} messages reached. Upgrade to Core for unlimited conversations.`,
        error: 'DAILY_LIMIT_EXCEEDED',
        limit: dailyLimit,
        used: currentCount,
        upgradeUrl: '/upgrade'
      });
    }

    // For testing/demo purposes, track usage in memory when DB constraints fail
    let actualCount = currentCount + 1;
    
    try {
      if (supabase) {
        const { data: updatedUsage, error: incrementError } = await supabase
          .from('daily_usage')
          .upsert({
            user_id: req.body.userId,
            date: today,
            tier: tier,
            conversations_count: actualCount,
            total_tokens_used: 0, // Will be updated later
            api_cost_estimate: 0 // Will be updated later
          });

        if (incrementError) {
          console.warn('[dailyLimitMiddleware] DB insert failed, using in-memory tracking:', incrementError.message);
          // Use in-memory tracking as fallback
          if (!global.testUserUsage) global.testUserUsage = {};
          const userKey = `${req.body.userId}-${today}`;
          global.testUserUsage[userKey] = (global.testUserUsage[userKey] || 0) + 1;
          actualCount = global.testUserUsage[userKey];
        }
      } else {
        // No Supabase available, use in-memory tracking
        if (!global.testUserUsage) global.testUserUsage = {};
        const userKey = `${req.body.userId}-${today}`;
        global.testUserUsage[userKey] = (global.testUserUsage[userKey] || 0) + 1;
        actualCount = global.testUserUsage[userKey];
        console.log(`[dailyLimitMiddleware] In-memory tracking: ${actualCount} for user ${req.body.userId}`);
      }
    } catch (err) {
      console.warn('[dailyLimitMiddleware] Unexpected error, using in-memory tracking:', err.message);
      if (!global.testUserUsage) global.testUserUsage = {};
      const userKey = `${req.body.userId}-${today}`;
      global.testUserUsage[userKey] = (global.testUserUsage[userKey] || 0) + 1;
      actualCount = global.testUserUsage[userKey];
    }

    // Attach data for downstream middlewares
    req.tier = tier;
    req.dailyUsage = { 
      count: actualCount, 
      limit: dailyLimit, 
      unlimited: false,
      remaining: dailyLimit - actualCount
    };
    
    console.log(`[dailyLimitMiddleware] User ${userId} (${tier}): ${req.dailyUsage.count}/${dailyLimit} messages used`);
    
    return next();
  } catch (err) {
    console.error('[dailyLimitMiddleware] Unexpected error:', err);
    // Graceful fallback - don't block users on middleware errors
    req.tier = req.body?.tier || 'free';
    req.dailyUsage = { count: 0, limit: TIER_LIMITS[req.tier] || 15, error: true };
    return next();
  }
}

export default dailyLimitMiddleware;
