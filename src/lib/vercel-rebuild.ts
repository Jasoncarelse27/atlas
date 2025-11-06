/**
 * Atlas CDN Rebuild Trigger – 2025-11-06
 * ---------------------------------------
 * Forces Vercel to rebuild and purge its edge cache.
 * Guarantees that updated Zustand wrapper + cache-busting
 * HTML are propagated globally.
 * 
 * This file is imported to ensure it's included in the build,
 * changing the build signature and forcing a fresh deployment.
 */

// ✅ Build signature timestamp - changes on every deployment
export const BUILD_SIGNATURE = "atlas-rebuild-1762459200000";

// ✅ CRITICAL: Export wrapper verification to ensure it's bundled
// Re-export creates import chain that prevents tree-shaking
export { create, createStore, __FORCE_INCLUDE__ } from './zustand-wrapper';

// ✅ Side-effect: Log to console to ensure this module is executed
if (typeof window !== 'undefined') {
  console.log('[Atlas] 🚀 Vercel rebuild module loaded - BUILD_SIGNATURE:', BUILD_SIGNATURE);
}

