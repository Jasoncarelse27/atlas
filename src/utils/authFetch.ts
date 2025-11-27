import { logger } from '../lib/logger';
import { getAuthToken as getAuthTokenHelper } from './getAuthToken';
import { navigateTo } from './navigation';
import { supabase } from '../lib/supabaseClient';

// Environment variable safety check
if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  throw new Error("❌ Missing Supabase env vars. Check Railway & .env.local");
}

interface AuthFetchOptions extends RequestInit {
  retryOn401?: boolean;
  showErrorToast?: boolean;
  preventRedirect?: boolean; // ✅ NEW: Prevent redirect to login on 401 (for silent failures)
}

interface ApiError {
  error: string;
  message: string;
  code?: string;
  limit?: number;
  used?: number;
}

/**
 * Centralized fetch utility with automatic auth token handling
 * Detects environment and uses appropriate Supabase key
 */
export async function fetchWithAuth(
  url: string, 
  options: AuthFetchOptions = {}
): Promise<Response> {
  const { retryOn401 = true, showErrorToast = true, preventRedirect = false, ...fetchOptions } = options;
  
  // Get the appropriate token based on environment
  const token = await getAuthToken();
  
  if (!token) {
    const error = new Error('No authentication token available');
    if (showErrorToast) {
      showToast('⚠️ Please log in to continue', 'error');
    }
    throw error;
  }

  // Prepare headers
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...fetchOptions.headers,
  };

  // Debug logging in development
  if (import.meta.env.DEV && import.meta.env.VITE_DEBUG_AUTH) {
    logger.debug('[AuthFetch]', {
      url,
      hasToken: !!token,
      tokenPrefix: token.substring(0, 20) + '...',
    });
  }

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
    });

    // Handle 401 Unauthorized
    if (response.status === 401) {
      // --- FIX: Check if server requested session clear (ghost user) ---
      try {
        const errorData = await response.clone().json().catch(() => null);
        if (errorData?.clearSession || errorData?.code === 'USER_NOT_FOUND') {
          logger.warn('[AuthFetch] 🚨 Server requested session clear (ghost user)');
          await supabase.auth.signOut();
          if (!preventRedirect) {
            setTimeout(() => {
              navigateTo('/login', true);
            }, 100);
          }
          const errorData: ApiError = { error: 'UNAUTHORIZED', message: 'Session invalid - user no longer exists' };
          throw new Error(JSON.stringify(errorData));
        }
      } catch (parseError) {
        // Not JSON or already handled, continue with refresh logic
      }
      
      if (retryOn401) {
        logger.debug('[AuthFetch] 401 received, attempting token refresh...');
        
        // ✅ IMPROVED: Try to refresh token
        const newToken = await getAuthToken(true);
        
        if (newToken) {
          logger.debug('[AuthFetch] ✅ Token available, retrying request...', {
            tokenChanged: newToken !== token,
            originalTokenLength: token?.length || 0,
            newTokenLength: newToken.length
          });
          
          // ✅ IMPROVED: Retry with new token (even if same - Supabase may have refreshed it)
          // The backend might accept it now if Supabase refreshed it internally
          const retryHeaders = {
            ...headers,
            'Authorization': `Bearer ${newToken}`,
          };
          
          const retryResponse = await fetch(url, {
            ...fetchOptions,
            headers: retryHeaders,
          });
          
          logger.debug('[AuthFetch] Retry response status:', retryResponse.status);
          
          if (retryResponse.status !== 401) {
            logger.debug('[AuthFetch] ✅ Retry successful');
            return retryResponse;
          } else {
            // Get error details for better diagnostics
            const errorText = await retryResponse.text().catch(() => '');
            logger.error('[AuthFetch] ❌ Retry still returned 401:', {
              errorText: errorText.substring(0, 200), // First 200 chars
              tokenPreview: newToken.substring(0, 20) + '...'
            });
          }
        } else {
          logger.error('[AuthFetch] ❌ Token refresh failed - no new token available');
        }
      }
      
      // Still 401 after retry, handle session expiry
      if (showErrorToast) {
        showToast('⚠️ Session expired. Please log in again.', 'error');
      }
      
      // ✅ NEW: Only redirect if not prevented (for silent failures like TTS)
      if (!preventRedirect) {
        // ✅ FIX: Use React Router navigation instead of hard reload
        setTimeout(() => {
          navigateTo('/login', true);
        }, 2000);
      }
      
      const errorData: ApiError = { error: 'UNAUTHORIZED', message: 'Session expired' };
      throw new Error(JSON.stringify(errorData));
    }

    // Handle 429 Rate Limit / Tier Limit
    if (response.status === 429) {
      try {
        const errorData: ApiError = await response.json();
        await handleTierLimitError(errorData);
      } catch (parseError) {
        logger.error('[AuthFetch] Error parsing tier limit error:', parseError);
      }
    }

    return response;
  } catch (error) {
    
    if (showErrorToast && error instanceof Error && !error.message.includes('Session expired')) {
      showToast('⚠️ Network error. Please try again.', 'error');
    }
    
    throw error;
  }
}

/**
 * Get authentication token based on environment
 * 
 * ✅ BEST PRACTICE: Uses the centralized getAuthToken from utils/getAuthToken.ts
 * This function is kept for backward compatibility with authFetch utility
 */
async function getAuthToken(forceRefresh = false): Promise<string | null> {
  // ✅ BEST PRACTICE: Use centralized helper
  return getAuthTokenHelper(forceRefresh);
}

/**
 * Handle tier limit errors (429 responses)
 */
async function handleTierLimitError(errorData: ApiError): Promise<void> {

  if (errorData.code === 'DAILY_LIMIT_EXCEEDED') {
    showToast('⚠️ Daily limit reached. Upgrade to continue.', 'warning');
    
    // Trigger upgrade modal
    if (typeof window !== 'undefined' && (window as any).showUpgradeModal) {
      (window as any).showUpgradeModal();
    } else {
      // ✅ FIX: Use React Router navigation instead of hard reload
      navigateTo('/upgrade', true);
    }
  } else if (errorData.code === 'BUDGET_LIMIT_EXCEEDED') {
    showToast('⚠️ Budget exceeded. Please upgrade.', 'warning');
    
    // Trigger upgrade modal
    if (typeof window !== 'undefined' && (window as any).showUpgradeModal) {
      (window as any).showUpgradeModal();
    } else {
      // ✅ FIX: Use React Router navigation instead of hard reload
      navigateTo('/upgrade', true);
    }
  } else {
    // Generic 429 error
    showToast('⚠️ Rate limit exceeded. Please try again later.', 'warning');
  }
}

/**
 * Simple toast notification system
 */
function showToast(message: string, type: 'error' | 'warning' | 'success' = 'error'): void {
  if (typeof window === 'undefined') return;
  
  // Create toast element
  const toast = document.createElement('div');
  toast.className = `fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-white max-w-sm ${
    type === 'error' ? 'bg-red-500' : 
    type === 'warning' ? 'bg-yellow-500' : 
    'bg-green-500'
  }`;
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 5000);
}

/**
 * Convenience methods for common API calls
 */
export const authApi = {
  async post(url: string, data: Record<string, unknown>, options: AuthFetchOptions = {}) {
    const response = await fetchWithAuth(url, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  },

  async get(url: string, options: AuthFetchOptions = {}) {
    const response = await fetchWithAuth(url, {
      ...options,
      method: 'GET',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  },
};
