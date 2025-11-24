// backend/middleware/cooldownMiddleware.mjs
// ✅ LAUNCH PROTECTION: Temporary cooldown for Core tier (50 messages/4 hours)
// Studio tier: No cooldown ever
// Free tier: Handled by dailyLimitMiddleware

import { logger } from '../lib/simpleLogger.mjs';

/**
 * Cooldown middleware for Core tier launch protection
 * - Core: 50 messages per 4 hours (temporary, will be removed after FastSpring activation)
 * - Studio: No cooldown (unlimited always)
 * - Free: Handled by dailyLimitMiddleware
 */
export default async function cooldownMiddleware(req, res, next) {
  try {
    const userId = req.user?.id;
    const tier = req.user?.tier || req.tier || 'free';

    // Skip if no userId
    if (!userId) {
      return next();
    }

    // ✅ Studio tier: No cooldown ever
    if (tier === 'studio') {
      return next();
    }

    // ✅ Free tier: Handled by dailyLimitMiddleware (skip here)
    if (tier === 'free') {
      return next();
    }

    // ✅ Core tier: Apply cooldown (50 messages per 4 hours)
    if (tier === 'core') {
      const COOLDOWN_LIMIT = 50;
      const COOLDOWN_WINDOW_MS = 4 * 60 * 60 * 1000; // 4 hours

      try {
        const { supabase } = await import('../config/supabaseClient.mjs');
        const fourHoursAgo = new Date(Date.now() - COOLDOWN_WINDOW_MS).toISOString();
        
        // Count messages in last 4 hours (using existing 'chat_message' event)
        const { count, error } = await supabase
          .from('usage_logs')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('event', 'chat_message')
          .gte('timestamp', fourHoursAgo);

        if (error) {
          logger.debug('[Cooldown] Query error (fail-open):', error.message);
          return next(); // Fail-open: Allow request if DB fails
        }

        const messagesInWindow = count || 0;

        if (messagesInWindow >= COOLDOWN_LIMIT) {
          // Get oldest message timestamp to calculate unlock time
          const { data: oldestMessage } = await supabase
            .from('usage_logs')
            .select('timestamp')
            .eq('user_id', userId)
            .eq('event', 'chat_message')
            .gte('timestamp', fourHoursAgo)
            .order('timestamp', { ascending: true })
            .limit(1)
            .maybeSingle();

          let unlockTime = null;
          let minutesUntilUnlock = 240; // Default 4 hours
          
          if (oldestMessage?.timestamp) {
            const oldestTimestamp = new Date(oldestMessage.timestamp).getTime();
            unlockTime = new Date(oldestTimestamp + COOLDOWN_WINDOW_MS);
            minutesUntilUnlock = Math.ceil((unlockTime.getTime() - Date.now()) / (60 * 1000));
          }

          const hoursUntilUnlock = Math.floor(minutesUntilUnlock / 60);
          const minsRemaining = minutesUntilUnlock % 60;

          logger.info(`[Cooldown] Core tier user ${userId} blocked: ${messagesInWindow}/${COOLDOWN_LIMIT} messages in last 4 hours`);
          
          return res.status(429).json({
            success: false,
            error: 'COOLDOWN_LIMIT_REACHED',
            code: 'COOLDOWN_LIMIT_REACHED',
            message: `You've had a deep conversation session today. To maintain service quality during our early launch, there's a brief cooldown. More messages unlock in ${hoursUntilUnlock}h ${minsRemaining}m.`,
            upgradeMessage: 'Studio users never experience cooldowns.',
            tier: tier,
            limit: COOLDOWN_LIMIT,
            used: messagesInWindow,
            remaining: 0,
            unlockTime: unlockTime?.toISOString() || null,
            minutesUntilUnlock
          });
        }

        // ✅ Under limit, continue
        return next();

      } catch (dbError) {
        logger.error('[Cooldown] Error (fail-open):', dbError.message);
        return next(); // Fail-open: Better UX than blocking
      }
    }

    return next();

  } catch (err) {
    logger.error('[Cooldown] Middleware error (fail-open):', err.message);
    return next(); // Fail-open on any error
  }
}

















