/**
 * Zustand Wrapper Module - Production-Safe Implementation
 * 
 * CRITICAL FIX: Import directly from 'zustand/react' and use dynamic property access
 * to prevent Rollup from tree-shaking the export during production builds.
 * 
 * Strategy:
 * 1. Import namespace from zustand/react (where create actually lives)
 * 2. Use dynamic property access that Rollup can't statically analyze
 * 3. Add runtime validation to ensure create exists
 * 
 * This pattern ensures the export is preserved in all bundler configurations.
 * 
 * @see https://github.com/pmndrs/zustand/issues/1234
 * @see https://github.com/vitejs/vite/issues/2679
 */

// ✅ Import namespace from zustand/react (direct source, avoids re-export chain)
import * as zustandReact from 'zustand/react';

// ✅ Use dynamic property access - Rollup can't statically analyze this
const createKey = 'create';
const zustandCreate = (zustandReact as any)[createKey];

// ✅ Runtime validation - ensure create exists
if (typeof zustandCreate !== 'function') {
  throw new Error(
    '[Zustand Wrapper] Failed to locate create export from zustand/react. ' +
    'This indicates a bundling issue. Please check Vite/Rollup configuration.'
  );
}

// ✅ Export as const to ensure it's preserved
export const create = zustandCreate;

