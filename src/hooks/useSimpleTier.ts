// 🔥 Golden Future-Proof useSimpleTier Hook for Atlas
// ✅ Uses global TierContext (no duplicate fetches)
// ✅ Single source of truth for subscription tier
// ✅ Automatic deduplication and caching
// ✅ Future-proof for tier expansion

import { canUseFeature, requiresUpgrade, useTier } from '../contexts/TierContext';

export function useSimpleTier() {
  const { tier, loading, error } = useTier();
  return { tier, loading, error };
}

// Re-export helper functions
export { canUseFeature, requiresUpgrade };
