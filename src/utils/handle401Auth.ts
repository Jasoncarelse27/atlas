/**
 * ✅ ATLAS BEST PRACTICE: Centralized 401 Unauthorized handler
 * 
 * Best practices implemented:
 * - Automatic token refresh on 401
 * - Single retry with fresh token
 * - Graceful failure if refresh doesn't work
 * - Prevents infinite retry loops
 * - Consistent error handling across app
 * 
 * Based on industry best practices:
 * - Refresh token rotation
 * - Single retry attempt (prevents loops)
 * - Clear error messages
 */

import { supabase } from '../lib/supabaseClient';
import { logger } from '../lib/logger';
import { navigateTo } from './navigation';

interface Handle401Options {
  response: Response;
  originalRequest: () => Promise<Response>;
  maxRetries?: number;
  preventRedirect?: boolean;
}

/**
 * Handle 401 Unauthorized with automatic token refresh and retry
 * 
 * @returns Promise<Response> - Retry response if successful, throws error if refresh fails
 */
export async function handle401Auth({
  response,
  originalRequest,
  maxRetries = 1,
  preventRedirect = false
}: Handle401Options): Promise<Response> {
  if (response.status !== 401) {
    return response; // Not a 401, return as-is
  }

  // --- FIX: Check if server requested session clear (ghost user) ---
  try {
    const errorData = await response.clone().json().catch(() => null);
    if (errorData?.clearSession || errorData?.code === 'USER_NOT_FOUND') {
      logger.warn('[handle401Auth] 🚨 Server requested session clear (ghost user)');
      await supabase.auth.signOut();
      if (!preventRedirect) {
        setTimeout(() => {
          navigateTo('/login', true);
        }, 100);
      }
      throw new Error('Session invalid - user no longer exists');
    }
  } catch (parseError) {
    // Not JSON or already handled, continue with refresh logic
  }

  logger.warn('[handle401Auth] 🔄 401 Unauthorized - attempting token refresh...');

  try {
    // Attempt to refresh the session
    const { data: { session: refreshedSession }, error: refreshError } = 
      await supabase.auth.refreshSession();

    if (refreshError || !refreshedSession?.access_token) {
      logger.error('[handle401Auth] ❌ Token refresh failed:', {
        error: refreshError?.message || 'No token in response',
        status: refreshError?.status
      });

      // If refresh token is expired, user needs to sign in again
      if (refreshError?.message?.includes('refresh_token') || 
          refreshError?.message?.includes('expired')) {
        logger.warn('[handle401Auth] ⚠️ Refresh token expired - user needs to sign in');
        
        if (!preventRedirect) {
          // ✅ FIX: Use React Router navigation instead of hard reload
          setTimeout(() => {
            navigateTo('/login', true);
          }, 2000);
        }
      }

      throw new Error('Session expired. Please sign in again.');
    }

    // Retry request with fresh token
    logger.info('[handle401Auth] ✅ Token refreshed, retrying request...');
    const retryResponse = await originalRequest();

    if (retryResponse.ok || retryResponse.status !== 401) {
      logger.info('[handle401Auth] ✅ Retry successful after token refresh');
      return retryResponse;
    } else {
      // Still 401 after refresh - user needs to sign in again
      const errorText = await retryResponse.text().catch(() => 'Unknown error');
      logger.error('[handle401Auth] ❌ Retry still returned 401:', errorText.substring(0, 200));
      
      if (!preventRedirect) {
        // ✅ FIX: Use React Router navigation instead of hard reload
        setTimeout(() => {
          navigateTo('/login', true);
        }, 2000);
      }

      throw new Error('Authentication failed. Please sign in again.');
    }
  } catch (error) {
    logger.error('[handle401Auth] ❌ Token refresh/retry failed:', error);
    throw error instanceof Error ? error : new Error('Session expired. Please sign in again.');
  }
}

