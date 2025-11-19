// backend/middleware/authMiddleware.mjs

import { logger } from '../lib/simpleLogger.mjs';
import { redisService } from '../services/redisService.mjs';
import { normalizeTier, getUserTier } from '../services/tierService.mjs';

export default async function authMiddleware(req, res, next) {
  const hdr = req.headers.authorization || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing or invalid authorization header" });

  try {
    // Verify the Supabase JWT token
    const { supabasePublic } = await import('../config/supabaseClient.mjs');
    const { data: { user }, error: authError } = await supabasePublic.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ error: "UNAUTHORIZED", message: "Invalid token" });
    }

    const userId = user.id;
    if (!userId) return res.status(401).json({ error: "UNAUTHORIZED", message: "Invalid user ID" });

    // Fetch user profile to get tier information
    let tier = 'free'; // Default fallback
    let fromCache = false;
    
    // First, try to get tier from cache
    try {
      const cachedTier = await redisService.getCachedTierStatus(userId);
      if (cachedTier) {
        // ✅ CRITICAL: Normalize cached tier (handles old non-normalized cache data)
        tier = normalizeTier(cachedTier.tier);
        fromCache = true;
        logger.debug(`[Auth] Tier cache hit for user ${userId}: ${tier}`);
      }
    } catch (cacheError) {
      logger.debug('[Auth] Cache error:', cacheError.message);
    }
    
    // If not in cache, fetch from database using centralized tierService
    if (!fromCache) {
      try {
        // ✅ CRITICAL: Use centralized tierService for consistent normalization
        tier = await getUserTier(userId);
        
        // ✅ CRITICAL: Normalize tier BEFORE caching in Redis
        const normalizedTier = normalizeTier(tier);
        
        // Cache the normalized tier for future requests
        const tierData = {
          tier: normalizedTier, // Always store normalized tier in cache
          userId,
          cachedAt: new Date().toISOString()
        };
        await redisService.cacheTierStatus(userId, tierData).catch(err => {
          logger.debug('[Auth] Failed to cache tier:', err.message);
        });
        
        tier = normalizedTier; // Use normalized tier
      } catch (profileError) {
        logger.debug('Profile error:', profileError.message);
        tier = 'free'; // Fail closed
      }
    }

    req.user = { 
      id: userId, 
      email: user.email,
      tier: tier
    };
    req.auth = { user: req.user, raw: user };
    
    // Also set req.tier for middleware compatibility
    req.tier = tier;
    
    next();
  } catch (e) {
    return res.status(401).json({ error: "UNAUTHORIZED", message: "Bad token" });
  }
}