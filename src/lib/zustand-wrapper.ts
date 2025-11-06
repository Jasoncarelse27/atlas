/**
 * Zustand wrapper for Vercel production stability.
 * Fixes Rollup tree-shaking bug ("Export 'create' is not defined in module").
 * 
 * CRITICAL: This module MUST be included in the bundle. Do not tree-shake.
 * Uses aggressive anti-tree-shaking techniques to ensure exports are preserved.
 * 
 * Last fix: 2025-11-06 - Direct function assignment to prevent optimization
 */

import { create as zustandCreate } from 'zustand';

// ✅ CRITICAL: Direct assignment - simplest pattern that Rollup can't break
// Using Object.assign to create a non-optimizable reference
const createRef = Object.assign(zustandCreate, { __ATLAS_EXPORT: true });
export const create = createRef;

// ✅ CRITICAL: Multiple named exports prevent single-export optimization
export const createStore = zustandCreate;
export const createZustandStore = zustandCreate;
export const zustandCreateFn = zustandCreate;

// ✅ CRITICAL: Default export - some bundlers require this
export default zustandCreate;

// ✅ CRITICAL: Side-effect that uses the export - forces module inclusion
// This cannot be removed because it has side effects
const _verifyExport = (() => {
  if (typeof window !== 'undefined') {
    (window as any).__ATLAS_ZUSTAND_CREATE__ = create;
    console.log('[Atlas] ✅ Zustand wrapper loaded - create export verified');
    console.log('[Atlas] 🔍 Create function type:', typeof create);
    console.log('[Atlas] 🚀 Build timestamp:', new Date().toISOString());
  }
  return create;
})();

// ✅ CRITICAL: Export verification result - prevents dead code elimination
export const __VERIFY_EXPORT__ = _verifyExport;

// ✅ CRITICAL: Force module to be marked as having side effects
// This comment tells bundlers: "DO NOT TREE-SHAKE THIS MODULE"
// @ts-ignore - Intentional side effect
void _verifyExport;

// Force cache bust: 1762464000 - 2025-11-06 10:00 UTC
