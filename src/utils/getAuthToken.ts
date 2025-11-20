/**
 * ✅ ATLAS BEST PRACTICE: Centralized authentication token helper
 * 
 * This utility provides a single source of truth for getting valid Supabase tokens
 * with automatic refresh logic. Use this instead of manual session handling.
 * 
 * Features:
 * - Automatic session refresh if token is missing/expired
 * - Consistent error handling
 * - No mock token fallbacks (production-safe)
 * 
 * @example
 * ```ts
 * const token = await getAuthToken();
 * if (!token) {
 *   throw new Error('Authentication required');
 * }
 * ```
 */

import { logger } from '../lib/logger';
import { supabase } from '../lib/supabaseClient';

/**
 * Get a valid Supabase authentication token with automatic refresh
 * 
 * ✅ PRODUCTION BEST PRACTICE:
 * - Supabase handles auto-refresh automatically (autoRefreshToken: true)
 * - We only need to check if token exists and is valid
 * - Manual refresh only needed if Supabase's auto-refresh fails
 * 
 * @param forceRefresh - If true, always attempt to refresh the session
 * @returns Promise<string | null> - The access token, or null if not authenticated
 */
export async function getAuthToken(forceRefresh = false): Promise<string | null> {
  try {
    // Get current session (Supabase auto-refreshes expired tokens automatically)
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      logger.warn('[getAuthToken] Session error:', sessionError.message);
      return null;
    }
    
    // ✅ PRODUCTION FIX: Supabase handles auto-refresh, so we just check if token exists
    // Only manually refresh if explicitly requested (for edge cases)
    if (session?.access_token && !forceRefresh) {
      // Token exists - Supabase will auto-refresh if expired
      return session.access_token;
    }
    
    // Force refresh requested or no token - attempt manual refresh
    if (forceRefresh && session) {
      logger.debug('[getAuthToken] Force refresh requested, refreshing...');
      
      try {
        const { data: { session: refreshedSession }, error: refreshError } = 
          await supabase.auth.refreshSession();
        
        if (refreshError) {
          logger.error('[getAuthToken] ❌ Refresh error:', {
            message: refreshError.message,
            status: refreshError.status,
            name: refreshError.name
          });
          
          // ✅ IMPROVED: If refresh token is expired, user needs to sign in again
          if (refreshError.message?.includes('refresh_token') || refreshError.message?.includes('expired')) {
            logger.warn('[getAuthToken] ⚠️ Refresh token expired - user needs to sign in again');
          }
          
          return null;
        }
        
        if (refreshedSession?.access_token) {
          logger.debug('[getAuthToken] ✅ Token refreshed successfully', {
            tokenLength: refreshedSession.access_token.length,
            expiresAt: refreshedSession.expires_at ? new Date(refreshedSession.expires_at * 1000).toISOString() : 'unknown'
          });
          return refreshedSession.access_token;
        } else {
          logger.warn('[getAuthToken] ⚠️ Refresh succeeded but no access token in response');
        }
      } catch (refreshException) {
        logger.error('[getAuthToken] ❌ Exception during refresh:', refreshException);
        return null;
      }
    }
    
    // No session or token available
    if (!session) {
      logger.debug('[getAuthToken] ⚠️ No session found');
    }
    
    return session?.access_token || null;
  } catch (error) {
    logger.error('[getAuthToken] ❌ Unexpected error:', error);
    return null;
  }
}

// ✅ RATE LIMIT PROTECTION: Track recent refresh attempts to prevent loops
let lastRefreshAttempt = 0;
let consecutiveFailures = 0;
const RATE_LIMIT_WINDOW = 5000; // 5 seconds
const MAX_CONSECUTIVE_FAILURES = 3;

/**
 * Get auth token or throw error (convenience wrapper)
 * 
 * ✅ FIXED: Prevents rate limit loops by:
 * - Not forcing refresh if no session exists
 * - Detecting rate limits and backing off
 * - Tracking consecutive failures
 * 
 * @param errorMessage - Custom error message if token is not available
 * @returns Promise<string> - The access token (never null)
 * @throws Error if token is not available
 */
export async function getAuthTokenOrThrow(errorMessage = 'Authentication required. Please sign in and try again.'): Promise<string> {
  // ✅ RATE LIMIT PROTECTION: Check if we've hit rate limit recently
  const now = Date.now();
  const timeSinceLastAttempt = now - lastRefreshAttempt;
  
  if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES && timeSinceLastAttempt < RATE_LIMIT_WINDOW) {
    logger.warn('[getAuthToken] ⚠️ Rate limit protection: Too many recent failures, backing off');
    throw new Error('Authentication rate limit reached. Please wait a moment and try again.');
  }
  
  // ✅ FIXED: Check if session exists BEFORE forcing refresh
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    // No session - don't try to refresh, just fail fast
    consecutiveFailures++;
    lastRefreshAttempt = now;
    throw new Error(errorMessage);
  }
  
  // Session exists - try to get token (with refresh if needed)
  const token = await getAuthToken(true); // Force refresh attempt
  
  if (!token) {
    consecutiveFailures++;
    lastRefreshAttempt = now;
    throw new Error(errorMessage);
  }
  
  // Success - reset failure counter
  consecutiveFailures = 0;
  return token;
}

