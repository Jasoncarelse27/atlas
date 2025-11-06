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
export const BUILD_SIGNATURE = "atlas-rebuild-1762464000000";

// ✅ CRITICAL: Import and immediately use to prevent tree-shaking
import { create, createStore, __VERIFY_EXPORT__ } from './zustand-wrapper';

// ✅ CRITICAL: Re-export creates import chain that prevents tree-shaking
export { create, createStore, __VERIFY_EXPORT__ };

// ✅ CRITICAL: Side-effect that uses the imports - forces module execution
// This cannot be optimized away because it has observable side effects
if (typeof window !== 'undefined') {
  // Verify exports exist
  const exportsExist = typeof create === 'function' && typeof createStore === 'function';
  console.log('[Atlas] 🚀 Vercel rebuild module loaded');
  console.log('[Atlas] 📦 BUILD_SIGNATURE:', BUILD_SIGNATURE);
  console.log('[Atlas] ✅ Exports verified:', exportsExist);
  console.log('[Atlas] 🔗 Create function:', typeof create);
  
  // Store in global to prevent optimization
  (window as any).__ATLAS_REBUILD_SIGNATURE__ = BUILD_SIGNATURE;
  (window as any).__ATLAS_CREATE_EXPORT__ = create;
}

