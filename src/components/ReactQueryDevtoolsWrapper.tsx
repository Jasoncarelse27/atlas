/**
 * ✅ PRODUCTION-SAFE: React Query Devtools Wrapper
 * 
 * Conditionally loads and renders React Query Devtools only in development.
 * Production builds completely exclude this component and its dependencies.
 */

import { lazy, Suspense } from 'react';

// ✅ PRODUCTION-SAFE: Lazy load devtools only in development
// Vite will tree-shake this entire component in production builds
const ReactQueryDevtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-query-devtools').then((module) => ({
        default: module.ReactQueryDevtools,
      }))
    )
  : null;

export function ReactQueryDevtoolsWrapper() {
  // ✅ PRODUCTION-SAFE: Return null in production (tree-shaken)
  if (!import.meta.env.DEV || !ReactQueryDevtools) {
    return null;
  }

  // ✅ SAFE: Render devtools with Suspense boundary
  return (
    <Suspense fallback={null}>
      <ReactQueryDevtools initialIsOpen={false} />
    </Suspense>
  );
}






