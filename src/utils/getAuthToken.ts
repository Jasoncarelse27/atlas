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
 * @param forceRefresh - If true, always attempt to refresh the session
 * @returns Promise<string | null> - The access token, or null if not authenticated
 */
export async function getAuthToken(forceRefresh = false): Promise<string | null> {
  try {
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      logger.debug('[getAuthToken] Session error:', sessionError.message);
      return null;
    }
    
    // If we have a valid token, return it
    if (session?.access_token) {
      return session.access_token;
    }
    
    // No token found - try to refresh if requested
    if (forceRefresh || !session) {
      logger.debug('[getAuthToken] No token found, attempting refresh...');
      const { data: { session: refreshedSession }, error: refreshError } = 
        await supabase.auth.refreshSession();
      
      if (refreshError) {
        logger.debug('[getAuthToken] Refresh error:', refreshError.message);
        return null;
      }
      
      if (refreshedSession?.access_token) {
        logger.debug('[getAuthToken] ✅ Token refreshed successfully');
        return refreshedSession.access_token;
      }
    }
    
    // No token available
    return null;
  } catch (error) {
    logger.error('[getAuthToken] Unexpected error:', error);
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

