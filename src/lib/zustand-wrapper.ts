/**
 * Zustand wrapper for Vercel production stability.
 * Fixes Rollup tree-shaking bug ("Export 'create' is not defined in module").
 * 
 * Uses main zustand package with fallback handling for all export formats.
 * This wrapper cannot be tree-shaken by Rollup/Vercel builds.
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

