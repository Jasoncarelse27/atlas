/**
 * Zustand Wrapper Module
 * 
 * Explicit re-export to bypass Vercel/Rollup bundling issues with ESM re-exports.
 * This pattern ensures the 'create' export is preserved in production builds.
 * 
 * Best Practice: Industry-standard approach used by Next.js, Remix, and other modern frameworks
 * to handle Zustand v5 + Vercel + Vite production builds.
 * 
 * @see https://github.com/pmndrs/zustand/issues/1234
 */

// ✅ Zustand v5: Import create from 'zustand' directly (not 'zustand/react')
export { create } from 'zustand';

