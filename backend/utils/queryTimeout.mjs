/**
 * ✅ SCALABILITY FIX: Query timeout helper for Supabase queries
 * Prevents slow queries from blocking all users
 */

/**
 * Create AbortSignal with timeout for Supabase queries
 * @param {number} timeoutMs - Timeout in milliseconds (default: 5000)
 * @returns {AbortSignal} AbortSignal that will abort after timeout
 */
export function createQueryTimeout(timeoutMs = 5000) {
  if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) {
    return AbortSignal.timeout(timeoutMs);
  }
  
  // Fallback for older Node.js versions
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

/**
 * Wrap Supabase query with timeout
 * @param {Promise} queryPromise - The Supabase query promise
 * @param {number} timeoutMs - Timeout in milliseconds (default: 5000)
 * @returns {Promise} Query promise with timeout
 */
export async function withQueryTimeout(queryPromise, timeoutMs = 5000) {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Query timeout after ${timeoutMs}ms`)), timeoutMs);
  });
  
  return Promise.race([queryPromise, timeoutPromise]);
}

export default {
  createQueryTimeout,
  withQueryTimeout,
};

