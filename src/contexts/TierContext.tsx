// 🔥 Golden Future-Proof Tier Context for Atlas
// ✅ Single global tier state (no duplicate fetches)
// ✅ Shared across all components
// ✅ Automatic cache invalidation
// ✅ Future-proof for enterprise features

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

type Tier = "free" | "core" | "studio" | "enterprise" | null;

interface TierContextType {
  tier: Tier;
  loading: boolean;
  error: Error | null;
  refreshTier: () => Promise<void>;
  canUseFeature: (feature: string) => boolean;
  requiresUpgrade: (required: "core" | "studio" | "enterprise", feature?: string) => boolean;
}

const TierContext = createContext<TierContextType | undefined>(undefined);

// Global tier state to prevent duplicate fetches
let globalTierState = {
  tier: null as Tier,
  loading: true,
  error: null as Error | null,
  lastFetch: 0,
  inFlight: false
};

let listeners: Set<() => void> = new Set();

// Notify all listeners of state changes
function notifyListeners() {
  listeners.forEach(listener => listener());
}

// Fetch tier with global deduplication
async function fetchTierGlobal(): Promise<Tier> {
  const now = Date.now();
  const CACHE_DURATION = 30000; // 30 seconds cache

  // Return cached result if recent
  if (globalTierState.tier && (now - globalTierState.lastFetch) < CACHE_DURATION) {
    console.debug("💾 TierContext - Using cached tier:", globalTierState.tier);
    return globalTierState.tier;
  }

  // Prevent duplicate fetches
  if (globalTierState.inFlight) {
    console.debug("⏳ TierContext - Reusing in-flight request");
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (!globalTierState.inFlight) {
          clearInterval(checkInterval);
          resolve(globalTierState.tier);
        }
      }, 100);
    });
  }

  globalTierState.inFlight = true;
  globalTierState.loading = true;
  notifyListeners();

  try {
    console.debug("🔍 TierContext - Fetching tier globally");
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      globalTierState.tier = "free";
    } else {
      const { data, error } = await supabase
        .from("profiles")
        .select("subscription_tier")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      globalTierState.tier = (data?.subscription_tier as Tier) || "free";
    }

    globalTierState.lastFetch = now;
    globalTierState.error = null;
    console.debug("✅ TierContext - Tier loaded:", globalTierState.tier);
  } catch (err: any) {
    console.error("❌ TierContext - Failed to fetch tier:", err);
    globalTierState.tier = "free";
    globalTierState.error = err;
  } finally {
    globalTierState.inFlight = false;
    globalTierState.loading = false;
    notifyListeners();
  }

  return globalTierState.tier;
}

export function TierProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState(globalTierState);

  useEffect(() => {
    // Subscribe to global state changes
    const listener = () => setState({ ...globalTierState });
    listeners.add(listener);

    // Initial fetch
    fetchTierGlobal();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      console.debug("🔄 TierContext - Auth state changed, refreshing tier");
      fetchTierGlobal();
    });

    return () => {
      listeners.delete(listener);
      subscription.unsubscribe();
    };
  }, []);

  const refreshTier = async () => {
    globalTierState.lastFetch = 0; // Force refresh
    await fetchTierGlobal();
  };

  const canUseFeature = (feature: string): boolean => {
    if (state.loading || !state.tier) return false;
    if (state.tier === "studio" || state.tier === "enterprise") return true;
    if (state.tier === "core") return feature !== "studio-only";
    if (state.tier === "free") return feature === "text"; // TODO: Use centralized tier check
    return false;
  };

  const requiresUpgrade = (required: "core" | "studio" | "enterprise", _feature?: string): boolean => {
    if (state.loading || !state.tier) return true;
    if (state.tier === "studio" || state.tier === "enterprise") return false;
    if (state.tier === "core") return required === "studio" || required === "enterprise";
    if (state.tier === "free") return true; // TODO: Use centralized tier check
    return true;
  };

  return (
    <TierContext.Provider value={{
      tier: state.tier,
      loading: state.loading,
      error: state.error,
      refreshTier,
      canUseFeature,
      requiresUpgrade
    }}>
      {children}
    </TierContext.Provider>
  );
}

export function useTier() {
  const context = useContext(TierContext);
  if (context === undefined) {
    throw new Error('useTier must be used within a TierProvider');
  }
  return context;
}

// Simple feature checking
export function canUseFeature(tier: Tier, feature: string): boolean {
  if (tier === "studio" || tier === "enterprise") return true;
  if (tier === "core") return feature !== "studio-only";
  if (tier === "free") return feature === "text";
  return false;
}

// Simple upgrade requirement check
export function requiresUpgrade(tier: Tier, feature: string): boolean {
  if (tier === "studio" || tier === "enterprise") return false;
  if (tier === "core") return feature === "studio-only";
  if (tier === "free") return feature !== "text";
  return true;
}
