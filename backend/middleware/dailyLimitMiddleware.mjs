// backend/middleware/dailyLimitMiddleware.mjs
import { logger } from '../lib/simpleLogger.mjs';
import { TIER_DEFINITIONS } from '../config/intelligentTierSystem.mjs';

// In-memory fallback for development when Supabase is not available
const inMemoryUsage = new Map();

/**
 * Middleware to enforce per-tier monthly message limits.
 * - Free users: 15 messages per month (blocks on 16th)
 * - Core/Studio: unlimited (-1 in config = no limit)
 * 
 * Attaches `req.tier` and `req.dailyUsage` for downstream services.
 */
export default async function dailyLimitMiddleware(req, res, next) {
  try {
    // 🔒 SECURITY FIX: Never trust client-sent tier
    // Get userId from authenticated user (set by authMiddleware)
    const userId = req.user?.id;
    const tier = req.user?.tier || 'free'; // Always use server-validated tier
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing userId - authentication required' 
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

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const limit = tierConfig.dailyMessages; // ✅ FIX: Use dailyMessages (15 for free tier)

    try {
      // Get usage count from Supabase
      const { supabase } = await import('../config/supabaseClient.mjs');
      const { data, error } = await supabase
        .from('monthly_usage')
        .select('conversations_count')
        .eq('user_id', userId)
        .eq('month', startOfMonth.toISOString().slice(0, 7))
        .maybeSingle();

      if (error) {
        // Fall back to in-memory tracking for development
        return handleInMemoryTracking(userId, tier, startOfMonth, limit, req, res, next);
      }

      const currentCount = data?.conversations_count || 0;

      // ✅ FIX: Block on 16th message (after 15 allowed messages)
      // currentCount is the count BEFORE this request, so if it's >= 15, block the 16th
      if (currentCount >= limit) {
        logger.info(`[DailyLimit] Free tier user ${userId} blocked: ${currentCount}/${limit} messages used`);
        return res.status(429).json({
          success: false,
          error: 'DAILY_LIMIT_EXCEEDED',
          code: 'DAILY_LIMIT_EXCEEDED',
          message: `You've used all ${limit} free messages this month. Upgrade to Core for unlimited conversations.`,
          upgrade_required: true,
          tier: tier,
          limit: limit,
          used: currentCount,
          remaining: 0
        });
      }

      // Increment usage
      const { error: upsertErr } = await supabase
        .from('monthly_usage')
        .upsert({
          user_id: userId,
          month: startOfMonth.toISOString().slice(0, 7),
          conversations_count: currentCount + 1,
          tier: tier
        });

      if (upsertErr) {
        logger.debug('Daily limit upsert error:', upsertErr.message);
      }

      req.tier = tier;
      req.monthlyUsage = { count: currentCount + 1, limit };
      return next();

    } catch (dbError) {
      // Fall back to in-memory tracking
      return handleInMemoryTracking(userId, tier, startOfMonth, limit, req, res, next);
    }

  } catch (err) {
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
}

/**
 * Handle usage tracking in memory when Supabase is not available
 */
function handleInMemoryTracking(userId, tier, startOfMonth, limit, req, res, next) {
  
  const key = `${userId}-${startOfMonth.toISOString().slice(0, 7)}`;
  const currentCount = inMemoryUsage.get(key) || 0;
  
  // ✅ FIX: Block on 16th message (after 15 allowed messages)
  if (currentCount >= limit) {
    logger.info(`[DailyLimit] Free tier user ${userId} blocked (in-memory): ${currentCount}/${limit} messages used`);
    return res.status(429).json({
      success: false,
      error: 'DAILY_LIMIT_EXCEEDED',
      code: 'DAILY_LIMIT_EXCEEDED',
      message: `You've used all ${limit} free messages this month. Upgrade to Core for unlimited conversations.`,
      upgrade_required: true,
      tier: tier,
      limit: limit,
      used: currentCount,
      remaining: 0
    });
  }
  
  inMemoryUsage.set(key, currentCount + 1);
  
  req.tier = tier;
  req.monthlyUsage = { count: currentCount + 1, limit };
  return next();
}