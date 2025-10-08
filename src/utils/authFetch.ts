import { supabase } from '../lib/supabase';

// Environment variable safety check
if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  throw new Error("❌ Missing Supabase env vars. Check Railway & .env.local");
}

interface AuthFetchOptions extends RequestInit {
  retryOn401?: boolean;
  showErrorToast?: boolean;
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
  const { retryOn401 = true, showErrorToast = true, ...fetchOptions } = options;
  
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
      if (retryOn401) {
        // Refresh token and retry once
        const newToken = await getAuthToken(true);
        if (newToken && newToken !== token) {
          const retryHeaders = {
            ...headers,
            'Authorization': `Bearer ${newToken}`,
          };
          
          const retryResponse = await fetch(url, {
            ...fetchOptions,
            headers: retryHeaders,
          });
          
          if (retryResponse.status !== 401) {
            return retryResponse;
          }
        }
      }
      
      // Still 401 after retry, handle session expiry
      if (showErrorToast) {
        showToast('⚠️ Session expired. Please log in again.', 'error');
      }
      
      // Redirect to login after a short delay
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
      
      const errorData: ApiError = { error: 'UNAUTHORIZED', message: 'Session expired' };
      throw new Error(JSON.stringify(errorData));
    }

    // Handle 429 Rate Limit / Tier Limit
    if (response.status === 429) {
      try {
        const errorData: ApiError = await response.json();
        await handleTierLimitError(errorData);
      } catch (parseError) {
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
 */
async function getAuthToken(forceRefresh = false): Promise<string | null> {
  try {
    // Check if we're in browser environment
    if (typeof window === 'undefined') {
      // Server-side: use service role key if available
      return process.env.SUPABASE_SERVICE_ROLE_KEY || null;
    }

    // Client-side: get session from Supabase
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      return null;
    }

    if (!session?.access_token) {
      if (forceRefresh) {
        // Try to refresh the session
        const { data: { session: refreshedSession }, error: refreshError } = 
          await supabase.auth.refreshSession();
        
        if (refreshError) {
          return null;
        }
        
        return refreshedSession?.access_token || null;
      }
      
      return null;
    }

    return session.access_token;
  } catch (error) {
    return null;
  }
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
      // Fallback: redirect to upgrade page
      window.location.href = '/upgrade';
    }
  } else if (errorData.code === 'BUDGET_LIMIT_EXCEEDED') {
    showToast('⚠️ Budget exceeded. Please upgrade.', 'warning');
    
    // Trigger upgrade modal
    if (typeof window !== 'undefined' && (window as any).showUpgradeModal) {
      (window as any).showUpgradeModal();
    } else {
      // Fallback: redirect to upgrade page
      window.location.href = '/upgrade';
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
  async post(url: string, data: any, options: AuthFetchOptions = {}) {
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
