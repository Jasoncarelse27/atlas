/**
 * Zustand Wrapper - Production-Safe for Vercel/Rollup
 * 
 * CRITICAL: This wrapper prevents Rollup from tree-shaking the 'create' export
 * during Vercel production builds. Uses dynamic import pattern that bundlers
 * cannot statically analyze and optimize away.
 * 
 * Official Zustand v5 recommendation: Import from 'zustand/react'
 * This wrapper ensures that export survives all bundler optimizations.
 */

// ✅ Import from zustand/react (official v5 entry point)
import * as zustandReact from 'zustand/react';

// ✅ Use dynamic property access - Rollup cannot optimize this away
// This pattern ensures 'create' is always available even if bundler tries to tree-shake
const CREATE_KEY = 'create';
export const create = (zustandReact as any)[CREATE_KEY];

// ✅ Runtime validation - fail fast if bundling breaks
if (typeof create !== 'function') {
  throw new Error(
    '[Zustand Wrapper] Critical: create export not found from zustand/react. ' +
    'This indicates a bundling configuration issue.'
  );
}

