// backend/services/jwtVerificationService.mjs
// ✅ SECURE JWT Verification Service for Mobile & Web
// Uses Supabase auth.getClaims() for local verification (signature verified)
// Falls back to auth.getUser() with retry logic for network errors

import { logger } from '../lib/simpleLogger.mjs';

// ✅ Cache for verification results (5 minutes)
const verificationCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ✅ Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff

/**
 * ✅ SECURE: Verify JWT using Supabase auth.getClaims() (local verification)
 * Falls back to auth.getUser() with retry logic if needed
 * Works for both web and mobile browsers
 * 
 * @param {string} token - JWT access token
 * @returns {Promise<Object>} User object from verified token
 * @throws {Error} If token verification fails
 */
export async function verifyJWT(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('Invalid token: token must be a non-empty string');
  }

  // 1. Check cache first (performance optimization)
  const cacheKey = token.substring(0, 50);
  const cached = verificationCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    logger.debug('[JWT] ✅ Cache hit for token verification');
    return cached.user;
  }

  // 2. Try auth.getClaims() first (local verification - secure & fast)
  // Note: getClaims() may not be available in all Supabase versions
  // If unavailable, it will fall through to getUser() fallback
  try {
    const { supabasePublic } = await import('../config/supabaseClient.mjs');
    
    // Check if getClaims() method exists
    if (supabasePublic.auth.getClaims) {
      const { data: { user }, error } = await supabasePublic.auth.getClaims(token);
      
      if (!error && user) {
        // ✅ Cache successful verification
        verificationCache.set(cacheKey, {
          user,
          expiresAt: Date.now() + CACHE_TTL
        });
        
        logger.debug('[JWT] ✅ Verified using auth.getClaims() (local verification)');
        return user;
      }
      
      // If getClaims() fails, log but don't throw yet
      logger.debug('[JWT] ⚠️ auth.getClaims() failed, trying getUser() fallback:', error?.message);
    } else {
      logger.debug('[JWT] ⚠️ auth.getClaims() not available, using getUser() fallback');
    }
  } catch (error) {
    // getClaims() not available or failed - fall through to getUser()
    logger.debug('[JWT] ⚠️ auth.getClaims() exception, trying getUser() fallback:', error.message);
  }

  // 3. Fallback to auth.getUser() with retry logic
  return await verifyJWTWithRetry(token, cacheKey);
}

/**
 * ✅ FALLBACK: Verify JWT using auth.getUser() with retry logic
 * Handles transient network errors gracefully
 * 
 * @param {string} token - JWT access token
 * @param {string} cacheKey - Cache key for storing result
 * @returns {Promise<Object>} User object from verified token
 * @throws {Error} If token verification fails after all retries
 */
async function verifyJWTWithRetry(token, cacheKey) {
  const { supabasePublic } = await import('../config/supabaseClient.mjs');
  let lastError = null;
  
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await supabasePublic.auth.getUser(token);
      
      if (result.data?.user) {
        // ✅ Cache successful verification
        verificationCache.set(cacheKey, {
          user: result.data.user,
          expiresAt: Date.now() + CACHE_TTL
        });
        
        logger.debug(`[JWT] ✅ Verified using auth.getUser() (attempt ${attempt + 1})`);
        return result.data.user;
      }
      
      // Check if it's a network error (retry) or auth error (fail immediately)
      const error = result.error;
      if (error) {
        const isNetworkError = isNetworkErrorType(error);
        
        if (!isNetworkError) {
          // Auth error (invalid token) - fail immediately (fail closed)
          logger.warn('[JWT] ❌ Auth error (invalid token) - failing immediately:', error.message);
          throw new Error(`Invalid token: ${error.message}`);
        }
        
        // Network error - retry
        lastError = error;
        if (attempt < MAX_RETRIES - 1) {
          const delay = RETRY_DELAYS[attempt] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
          logger.debug(`[JWT] ⚠️ Network error, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
    } catch (error) {
      // Check if it's a network error
      if (isNetworkErrorType(error)) {
        lastError = error;
        if (attempt < MAX_RETRIES - 1) {
          const delay = RETRY_DELAYS[attempt] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
          logger.debug(`[JWT] ⚠️ Network exception, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      } else {
        // Non-network error - fail immediately (fail closed)
        logger.warn('[JWT] ❌ Non-network error - failing immediately:', error.message);
        throw error;
      }
    }
  }
  
  // All retries failed - fail closed
  logger.error(`[JWT] ❌ Verification failed after ${MAX_RETRIES} attempts:`, lastError?.message);
  throw new Error(`JWT verification failed after ${MAX_RETRIES} attempts: ${lastError?.message || 'Unknown error'}`);
}

/**
 * ✅ Helper: Detect network errors vs auth errors
 * Network errors should be retried, auth errors should fail immediately
 * 
 * @param {Error|Object} error - Error object from Supabase
 * @returns {boolean} True if error is network-related
 */
function isNetworkErrorType(error) {
  if (!error) return false;
  
  const errorMsg = error.message?.toLowerCase() || '';
  const errorName = error.name?.toLowerCase() || '';
  
  // Network-related error indicators
  const networkIndicators = [
    'fetch',
    'network',
    'connection',
    'timeout',
    'econnrefused',
    'enotfound',
    'econnreset',
    'etimedout',
    'eai_again',
    'dns',
    'socket',
    'tls',
    'ssl'
  ];
  
  // Check error message and name
  const isNetworkError = 
    networkIndicators.some(indicator => errorMsg.includes(indicator)) ||
    networkIndicators.some(indicator => errorName.includes(indicator)) ||
    errorName === 'typeerror' ||
    errorName === 'networkerror' ||
    error.status === undefined; // Network errors often lack status codes
  
  return isNetworkError;
}

/**
 * ✅ Cleanup: Clear expired cache entries
 * Prevents memory leaks from cache growth
 */
export function clearExpiredCache() {
  const now = Date.now();
  let cleared = 0;
  
  for (const [key, value] of verificationCache.entries()) {
    if (value.expiresAt <= now) {
      verificationCache.delete(key);
      cleared++;
    }
  }
  
  if (cleared > 0) {
    logger.debug(`[JWT] 🧹 Cleared ${cleared} expired cache entries`);
  }
}

// ✅ Run cleanup every 10 minutes to prevent memory leaks
if (typeof setInterval !== 'undefined') {
  setInterval(clearExpiredCache, 10 * 60 * 1000);
}

/**
 * ✅ Get cache statistics (for monitoring)
 */
export function getCacheStats() {
  const now = Date.now();
  let valid = 0;
  let expired = 0;
  
  for (const value of verificationCache.values()) {
    if (value.expiresAt > now) {
      valid++;
    } else {
      expired++;
    }
  }
  
  return {
    total: verificationCache.size,
    valid,
    expired
  };
}




