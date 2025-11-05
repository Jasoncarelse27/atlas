/**
 * Atlas CDN Rebuild Trigger – 2025-11-05
 * ---------------------------------------
 * Forces Vercel to rebuild and purge its edge cache.
 * Guarantees that updated Zustand wrapper + cache-busting
 * HTML are propagated globally.
 * 
 * This file is imported to ensure it's included in the build,
 * changing the build signature and forcing a fresh deployment.
 */

// ✅ Build signature timestamp - changes on every deployment
export const BUILD_SIGNATURE = "atlas-rebuild-1762344000000";

// ✅ Export wrapper verification to ensure it's bundled
export { create } from './zustand-wrapper';

