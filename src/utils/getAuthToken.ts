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

import { supabase } from '../lib/supabaseClient';
import { logger } from '../lib/logger';

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
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      logger.warn('[getAuthToken] Session error:', sessionError.message);
      return null;
    }
    
    if (!session) {
      logger.debug('[getAuthToken] ⚠️ No session found');
      return null;
    }
    
    // ✅ CRITICAL FIX: Check if token is expired or about to expire
    const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
    const now = Date.now();
    const timeUntilExpiry = expiresAt - now;
    const isExpired = timeUntilExpiry < 0;
    const isExpiringSoon = timeUntilExpiry < 5 * 60 * 1000; // Less than 5 minutes
    
    // ✅ FIX: Always refresh if expired or expiring soon, or if forceRefresh requested
    if (isExpired || isExpiringSoon || forceRefresh) {
      logger.debug('[getAuthToken] Token expired or expiring soon, refreshing...', {
        isExpired,
        isExpiringSoon,
        timeUntilExpiry: Math.round(timeUntilExpiry / 1000) + 's',
        forceRefresh
      });
      
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
            // Clear invalid session
            await supabase.auth.signOut();
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
          return null;
        }
      } catch (refreshException) {
        logger.error('[getAuthToken] ❌ Exception during refresh:', refreshException);
        return null;
      }
    }
    
    // Token is still valid
    return session.access_token;
  } catch (error) {
    logger.error('[getAuthToken] ❌ Unexpected error:', error);
    return null;
  }
}

/**
 * Get auth token or throw error (convenience wrapper)
 * 
 * @param errorMessage - Custom error message if token is not available
 * @returns Promise<string> - The access token (never null)
 * @throws Error if token is not available
 */
export async function getAuthTokenOrThrow(errorMessage = 'Authentication required. Please sign in and try again.'): Promise<string> {
  const token = await getAuthToken(true); // Force refresh attempt
  if (!token) {
    throw new Error(errorMessage);
  }
  return token;
}

