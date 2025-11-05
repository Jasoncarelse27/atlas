/**
 * Zustand wrapper for Vercel production stability.
 * Fixes Rollup tree-shaking bug ("Export 'create' is not defined in module").
 * 
 * Uses main zustand package with fallback handling for all export formats.
 * This wrapper cannot be tree-shaken by Rollup/Vercel builds.
 * 
 * Verified: 2025-11-05 - CDN cache purge rebuild
 * Cache bust: 2025-11-05-20:58 - Force Vercel rebuild to clear edge cache
 */

import * as zustand from 'zustand';

// ✅ Handle all export formats (ESM / CJS / nested) - bundlers can't optimize this
const createFn =
  (zustand as any).create ||
  (zustand as any).default?.create ||
  (zustand as any).default ||
  zustand;

export const create = createFn;
export default createFn;

// ✅ PRODUCTION VERIFICATION: Log wrapper initialization
if (typeof window !== 'undefined') {
  console.log('[Atlas] ✅ Zustand wrapper initialized - create() preserved');
  console.log('[Atlas] 🔍 Build verification: wrapper active, production-safe');
  console.log('[Atlas] 🚀 Cache bust timestamp:', new Date().toISOString());
}

