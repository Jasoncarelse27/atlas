/**
 * Cache Middleware for Atlas Backend
 * Automatically caches tier information and user profiles
 * Prevents cache poisoning and tier escalation attacks
 */

import { logger } from '../lib/logger.mjs';
import { redisService } from '../services/redisService.mjs';

/**
 * Cache tier information after successful authentication
 */
export const cacheTierMiddleware = async (req, res, next) => {
  // Only cache for authenticated users
  if (!req.user || !req.user.id) {
    return next();
  }

  try {
    // Check if tier is already cached
    const cachedTier = await redisService.getCachedTierStatus(req.user.id);
    
    if (cachedTier && cachedTier.tier === req.user.tier) {
      // Cache hit - tier matches
      logger.debug(`[CacheMiddleware] Tier cache hit for user ${req.user.id}`);
      req.tierFromCache = true;
    } else if (cachedTier && cachedTier.tier !== req.user.tier) {
      // Cache mismatch - potential tier change, invalidate cache
      logger.warn(`[CacheMiddleware] Tier mismatch for user ${req.user.id} - invalidating cache`);
      await redisService.invalidateTierCache(req.user.id);
      req.tierCacheMismatch = true;
    }

    // Cache the current tier data
    if (!cachedTier || req.tierCacheMismatch) {
      const tierData = {
        tier: req.user.tier,
        userId: req.user.id,
        cachedAt: new Date().toISOString(),
        features: req.user.features || []
      };
      
      await redisService.cacheTierStatus(req.user.id, tierData);
      logger.debug(`[CacheMiddleware] Cached tier data for user ${req.user.id}`);
    }
  } catch (error) {
    // Don't fail the request if caching fails
    logger.error('[CacheMiddleware] Error caching tier:', error);
  }

  next();
};

/**
 * API Response caching middleware
 */
export const apiCacheMiddleware = (options = {}) => {
  const {
    ttlCategory = 'apiResponses',
    varyByTier = true,
    varyByUser = false
  } = options;

  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip if no-cache header is present
    if (req.headers['cache-control'] === 'no-cache') {
      return next();
    }

    const tier = req.user?.tier || 'free';
    const userId = req.user?.id;

    // Generate cache key
    let cacheKey = req.path;
    if (varyByUser && userId) {
      cacheKey = `${userId}:${cacheKey}`;
    }

    try {
      // Check cache
      const cached = await redisService.getCachedApiResponse(
        cacheKey,
        req.query,
        varyByTier ? tier : null
      );

      if (cached) {
        logger.debug(`[APICache] Cache hit for ${req.path}`);
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Tier', tier);
        return res.json(cached);
      }

      // Cache miss - store original json method
      const originalJson = res.json.bind(res);
      
      // Override json method to cache response
      res.json = (data) => {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          redisService.cacheApiResponse(
            cacheKey,
            req.query,
            data,
            varyByTier ? tier : null
          ).catch(err => {
            logger.error('[APICache] Error caching response:', err);
          });
        }

        res.setHeader('X-Cache', 'MISS');
        res.setHeader('X-Cache-Tier', tier);
        return originalJson(data);
      };

      next();
    } catch (error) {
      logger.error('[APICache] Error checking cache:', error);
      next();
    }
  };
};

/**
 * Invalidate cache on data mutations
 */
export const invalidateCacheMiddleware = (cacheType) => {
  return async (req, res, next) => {
    // Store original methods
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    const invalidateCache = async () => {
      if (!req.user?.id) return;

      try {
        switch (cacheType) {
          case 'user':
            await redisService.invalidateUserCache(req.user.id);
            break;
          case 'conversation': {
            const conversationId = req.params.conversationId || req.body?.conversationId;
            if (conversationId) {
              await redisService.invalidateConversationCache(conversationId);
            }
            break;
          }
          case 'tier':
            await redisService.invalidateTierCache(req.user.id);
            break;
          default:
            logger.warn(`[InvalidateCache] Unknown cache type: ${cacheType}`);
        }
      } catch (error) {
        logger.error('[InvalidateCache] Error invalidating cache:', error);
      }
    };

    // Override response methods to invalidate after successful mutation
    res.json = async (data) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        await invalidateCache();
      }
      return originalJson(data);
    };

    res.send = async (data) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        await invalidateCache();
      }
      return originalSend(data);
    };

    next();
  };
};

/**
 * Cache warming middleware for critical data
 */
export const cacheWarmingMiddleware = async (req, res, next) => {
  if (!req.user?.id || req.user.warmedCache) {
    return next();
  }

  try {
    // Mark as warmed to prevent repeated warming
    req.user.warmedCache = true;

    // Warm cache in background
    setImmediate(async () => {
      try {
        const userData = {
          profile: {
            id: req.user.id,
            tier: req.user.tier,
            email: req.user.email,
            features: req.user.features
          },
          tierData: {
            tier: req.user.tier,
            userId: req.user.id,
            features: req.user.features || []
          }
        };

        await redisService.warmCache(req.user.id, userData, req.user.tier);
        logger.debug(`[CacheWarming] Warmed cache for user ${req.user.id}`);
      } catch (error) {
        logger.error('[CacheWarming] Error warming cache:', error);
      }
    });
  } catch (error) {
    logger.error('[CacheWarming] Error in cache warming middleware:', error);
  }

  next();
};
