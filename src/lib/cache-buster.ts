/**
 * Cache Busting Module - 2025-11-06
 * ----------------------------------
 * This module forces Vercel to generate a new bundle hash.
 * Import this in main.tsx to ensure cache invalidation.
 * 
 * CRITICAL: Changing this file forces a new deployment with fresh cache.
 */

import { logger } from './logger';

// ✅ Unique timestamp that changes on every deployment
// Use build-time timestamp for consistent cache busting
const BUILD_TIME = import.meta.env.VITE_BUILD_TIME || Date.now().toString();
export const CACHE_BUSTER = `atlas-cache-bust-${BUILD_TIME}`;

// ✅ Side effect that cannot be optimized away
if (typeof window !== 'undefined') {
  (window as any).__ATLAS_CACHE_BUSTER__ = CACHE_BUSTER;
  // ✅ Use logger for production cleanliness (silent in production)
  logger.debug('[Atlas] 🔄 Cache buster active:', CACHE_BUSTER);
}

// ✅ Export that must be included
export default CACHE_BUSTER;

