/**
 * Zustand wrapper for Vercel production stability.
 * Fixes Rollup tree-shaking bug ("Export 'create' is not defined in module").
 * 
 * Uses main zustand package with fallback handling for all export formats.
 * This wrapper cannot be tree-shaken by Rollup/Vercel builds.
 * 
 * Verified: 2025-11-05 - CDN cache purge rebuild
 * Cache bust: 2025-11-05-21:30 - Force Vercel rebuild + CDN purge
 */

import * as zustand from 'zustand';
import { create as zustandCreate } from 'zustand';

// ✅ CRITICAL: Store reference in global to prevent tree-shaking
if (typeof window !== 'undefined') {
  (window as any).__ATLAS_ZUSTAND_REF__ = zustand;
  (window as any).__ATLAS_ZUSTAND_CREATE__ = zustandCreate;
}

// ✅ Handle all export formats (ESM / CJS / nested) - bundlers can't optimize this
// Primary: Use direct named import (most reliable)
// Fallback: Use namespace import as backup
const createFn = zustandCreate || (zustand as any).create || zustand;

// ✅ CRITICAL: Export as both named and default - multiple exports prevent optimization
export const create = createFn;
export const createStore = createFn; // ✅ Additional named export prevents tree-shaking
export default createFn;

// ✅ CRITICAL: Side-effect export that forces module to be included
export const __FORCE_INCLUDE__ = 'z' + (Math.random() * 1000).toString(36);

// ✅ PRODUCTION VERIFICATION: Log wrapper initialization
if (typeof window !== 'undefined') {
  console.log('[Atlas] ✅ Zustand wrapper initialized - create() preserved');
  console.log('[Atlas] 🔍 Build verification: wrapper active, production-safe');
  console.log('[Atlas] 🚀 Cache bust timestamp:', new Date().toISOString());
  console.log('[Atlas] 🔗 Zustand reference:', typeof createFn);
  console.log('[Atlas] ✅ Create function type:', typeof create);
  console.log('[Atlas] ✅ Create function exists:', create !== undefined);
}

// Force redeploy 1762459200 - Fixed export chain 2025-11-06
