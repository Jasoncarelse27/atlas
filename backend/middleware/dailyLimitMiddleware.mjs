// backend/middleware/dailyLimitMiddleware.mjs
import { TIER_DEFINITIONS } from '../config/intelligentTierSystem.mjs';

// In-memory fallback for development when Supabase is not available
const inMemoryUsage = new Map();

/**
 * Middleware to enforce per-tier daily message limits.
 * - Free users: 15 messages per day
 * - Core/Studio: unlimited (-1 in config = no limit)
 * 
 * Attaches `req.tier` and `req.dailyUsage` for downstream services.
 */
export default async function dailyLimitMiddleware(req, res, next) {
  try {
    const { userId, tier } = req.body || {};
    
    if (!userId || !tier) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing userId or tier' 
      });
    }

    const tierConfig = TIER_DEFINITIONS[tier];
    if (!tierConfig) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid tier provided' 
      });
    }

    // If unlimited, just skip
    if (tierConfig.dailyMessages === -1) {
      req.tier = tier;
      req.dailyUsage = { count: 0, limit: -1 };
      return next();
    }

    const today = new Date().toISOString().slice(0, 10);
    const limit = tierConfig.dailyMessages;

    try {
      // Get usage count from Supabase
      const { supabase } = await import('../config/supabaseClient.mjs');
      const { data, error } = await supabase
        .from('daily_usage')
        .select('count')
        .eq('user_id', userId)
        .eq('date', today)
        .maybeSingle();

      if (error) {
        console.error('[dailyLimitMiddleware] Supabase error:', error.message);
        // Fall back to in-memory tracking for development
        return handleInMemoryTracking(userId, tier, today, limit, req, res, next);
      }

      const currentCount = data?.count || 0;

      if (currentCount >= limit) {
        return res.status(429).json({
          success: false,
          message: `Daily limit reached. Upgrade to Core for unlimited messages.`,
          limit,
          used: currentCount,
        });
      }

      // Increment usage
      const { error: upsertErr } = await supabase
        .from('daily_usage')
        .upsert({
          user_id: userId,
          date: today,
          count: currentCount + 1,
        });

      if (upsertErr) {
        console.warn('[dailyLimitMiddleware] Failed to increment usage:', upsertErr.message);
      }

      req.tier = tier;
      req.dailyUsage = { count: currentCount + 1, limit };
      return next();

    } catch (dbError) {
      console.error('[dailyLimitMiddleware] Database error:', dbError.message);
      // Fall back to in-memory tracking
      return handleInMemoryTracking(userId, tier, today, limit, req, res, next);
    }

  } catch (err) {
    console.error('[dailyLimitMiddleware] Unexpected error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
}

/**
 * Handle usage tracking in memory when Supabase is not available
 */
function handleInMemoryTracking(userId, tier, today, limit, req, res, next) {
  console.log('[dailyLimitMiddleware] Supabase not available, using in-memory tracking');
  
  const key = `${userId}-${today}`;
  const currentCount = inMemoryUsage.get(key) || 0;
  
  console.log(`[dailyLimitMiddleware] In-memory tracking: ${currentCount + 1} for user ${userId}`);
  
  if (currentCount >= limit) {
    return res.status(429).json({
      success: false,
      message: `Daily limit reached. Upgrade to Core for unlimited messages.`,
      limit,
      used: currentCount,
    });
  }
  
  inMemoryUsage.set(key, currentCount + 1);
  console.log(`[dailyLimitMiddleware] User ${userId} (${tier}): ${currentCount + 1}/${limit} messages used`);
  
  req.tier = tier;
  req.dailyUsage = { count: currentCount + 1, limit };
  return next();
}