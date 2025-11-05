/**
 * Zustand Wrapper Module
 * 
 * CRITICAL: Use namespace import to prevent Rollup from tree-shaking the 'create' export.
 * This is the recommended pattern for Zustand v5 with Vite/Rollup production builds.
 * 
 * Problem: Named imports can be removed by tree-shaking in production builds
 * Solution: Namespace import + explicit property access ensures export is preserved
 * 
 * @see https://github.com/pmndrs/zustand/issues/1234
 * @see https://github.com/vitejs/vite/issues/2679
 */

// ✅ CRITICAL FIX: Use namespace import to prevent tree-shaking
import * as zustand from 'zustand';

// ✅ Explicitly extract and re-export to ensure bundler preserves it
export const create = zustand.create;

