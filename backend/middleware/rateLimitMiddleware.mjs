/**
 * ✅ SCALABILITY FIX: Rate limiting middleware for 10k+ users
 * Prevents abuse, protects costs, ensures fair usage
 */

import pkg from 'express-rate-limit';
const rateLimit = pkg.default || pkg;
import { ipKeyGenerator as expressIpKeyGenerator } from 'express-rate-limit';
import { logger } from '../lib/simpleLogger.mjs';
import { redisService } from '../services/redisService.mjs';

// ✅ SECURITY FIX: Use proper IPv6 handling for rate limiting
// Prevents IPv6 users from bypassing rate limits
// ipKeyGenerator handles IPv6 subnets correctly (prevents bypass)
const ipKeyGenerator = (req) => {
  const ip = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown';
  // Use express-rate-limit's ipKeyGenerator for proper IPv6 handling
  return expressIpKeyGenerator(ip);
};

/**
 * Create rate limiter with Redis store (if available) or memory store
 */
function createRateLimiter(options) {
  const { windowMs, max, keyGenerator, message, skipSuccessfulRequests = false } = options;

  // Try to use Redis store if available, fallback to memory
  let store = undefined;
  
  if (redisService?.isConnected && redisService?.client) {
    // Use Redis for distributed rate limiting (multiple server instances)
    try {
      const RedisStore = rateLimit.RedisStore || undefined;
      if (RedisStore) {
        store = new RedisStore({
          client: redisService.client,
          prefix: 'rl:',
        });
        logger.debug('[RateLimit] Using Redis store for distributed rate limiting');
      }
    } catch (error) {
      logger.warn('[RateLimit] Redis store not available, using memory store');
    }
  }

  return rateLimit({
    windowMs,
    max,
    keyGenerator,
    message,
    skipSuccessfulRequests,
    store,
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    handler: (req, res) => {
      logger.warn('[RateLimit] Rate limit exceeded:', {
        userId: req.user?.id,
        ip: req.ip,
        path: req.path,
        limit: max,
        windowMs
      });
      
      res.status(429).json({
        error: 'Too many requests',
        message: message || 'Please slow down and try again in a moment',
        retryAfter: Math.ceil(windowMs / 1000), // seconds
      });
    },
  });
}

/**
 * Rate limiter for message endpoint
 * Free: 20 messages/minute, Paid: 100 messages/minute
 */
export const messageRateLimit = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: (req) => {
    const tier = req.user?.tier || 'free';
    return tier === 'free' ? 20 : 100; // 20/min free, 100/min paid
  },
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req), // ✅ SECURITY: Proper IPv6 handling
  message: 'Too many messages. Free tier: 20/min, Paid: 100/min. Please slow down.',
});

/**
 * Rate limiter for image analysis endpoint
 * Free: 5 images/minute, Paid: 30 images/minute
 */
export const imageAnalysisRateLimit = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: (req) => {
    const tier = req.user?.tier || 'free';
    return tier === 'free' ? 5 : 30; // 5/min free, 30/min paid
  },
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req), // ✅ SECURITY: Proper IPv6 handling
  message: 'Too many image analysis requests. Free tier: 5/min, Paid: 30/min. Please slow down.',
});

/**
 * Rate limiter for general API endpoints
 * Prevents abuse on any endpoint
 */
export const generalApiRateLimit = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: (req) => {
    const tier = req.user?.tier || 'free';
    return tier === 'free' ? 60 : 200; // 60/min free, 200/min paid
  },
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req), // ✅ SECURITY: Proper IPv6 handling
  message: 'Too many requests. Please slow down.',
});

/**
 * Strict rate limiter for authentication endpoints
 * Prevents brute force attacks
 */
export const authRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes
  keyGenerator: (req) => ipKeyGenerator(req), // ✅ SECURITY: Proper IPv6 handling (no user ID yet)
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
  skipSuccessfulRequests: true, // Don't count successful logins
});

export default {
  messageRateLimit,
  imageAnalysisRateLimit,
  generalApiRateLimit,
  authRateLimit,
};

