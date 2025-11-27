import { supabase } from "../lib/supabaseClient";
import { logger } from '../lib/logger';
import { getAuthTokenOrThrow } from '../utils/getAuthToken';
import { handle401Auth } from '../utils/handle401Auth';

/**
 * ✅ FIXED: Now uses proper token refresh on 401 instead of immediate sign-out
 * Follows best practices: refresh → retry → fail gracefully
 */
export async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // ✅ BEST PRACTICE: Use centralized auth helper with automatic refresh
  const token = await getAuthTokenOrThrow("No valid auth token found. Please log in again.");

  // Create original request function for retry
  const makeRequest = async (): Promise<Response> => {
    const currentToken = await getAuthTokenOrThrow("No valid auth token found. Please log in again.");
    return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      "Content-Type": "application/json",
        Authorization: `Bearer ${currentToken}`,
    },
  });
  };

  const res = await makeRequest();

  // ✅ FIXED: Handle 401 with automatic token refresh and retry
  if (res.status === 401) {
    try {
      return await handle401Auth({
        response: res,
        originalRequest: makeRequest,
        preventRedirect: false
      });
    } catch (error) {
      logger.error('[FetchWithAuth] 401 handling failed:', error);
      throw error;
    }
  }

  if (!res.ok) {
    logger.error('[FetchWithAuth] Request failed:', res.status, res.statusText);
  }

  return res;
}

// Helper for JSON responses
export async function fetchWithAuthJSON(
  url: string,
  options: RequestInit = {}
): Promise<any> {
  const response = await fetchWithAuth(url, options);
  const json = await response.json();
  
  // --- FIX: server instructs frontend to clear invalid session ---
  if (json?.clearSession) {
    console.warn('[API] Server requested session clear — wiping session.');
    await supabase.auth.signOut();
    window.location.href = '/login';
    throw new Error('Session invalid');
  }
  
  return json;
}
