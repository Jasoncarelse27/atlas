// backend/middleware/dailyLimitMiddleware.mjs
import { logger } from '../lib/logger.mjs';
import { TIER_DEFINITIONS } from '../config/intelligentTierSystem.mjs';

// In-memory fallback for development when Supabase is not available
const inMemoryUsage = new Map();

/**
 * Middleware to enforce per-tier monthly message limits.
 * - Free users: 15 messages per month
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
    const limit = tierConfig.monthlyMessages;

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
  
  
  if (currentCount >= limit) {
    return res.status(429).json({
      success: false,
      message: `Daily limit reached. Upgrade to Core for unlimited messages.`,
      limit,
      used: currentCount,
    });
  }
  
  inMemoryUsage.set(key, currentCount + 1);
  
  req.tier = tier;
  req.monthlyUsage = { count: currentCount + 1, limit };
  return next();
}