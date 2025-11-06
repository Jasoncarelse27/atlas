/**
 * Cache Busting Module - 2025-11-06
 * ----------------------------------
 * This module forces Vercel to generate a new bundle hash.
 * Import this in main.tsx to ensure cache invalidation.
 * 
 * CRITICAL: Changing this file forces a new deployment with fresh cache.
 */

// ✅ Unique timestamp that changes on every deployment
export const CACHE_BUSTER = `atlas-cache-bust-${Date.now()}`;

// ✅ Side effect that cannot be optimized away
if (typeof window !== 'undefined') {
  (window as any).__ATLAS_CACHE_BUSTER__ = CACHE_BUSTER;
  console.log('[Atlas] 🔄 Cache buster active:', CACHE_BUSTER);
}

// ✅ Export that must be included
export default CACHE_BUSTER;

