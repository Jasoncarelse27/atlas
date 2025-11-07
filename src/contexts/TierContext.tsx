// 🔥 Golden Future-Proof Tier Context for Atlas
// ✅ Single global tier state (no duplicate fetches)
// ✅ Shared across all components
// ✅ Automatic cache invalidation
// ✅ Future-proof for enterprise features

import React, { createContext, useContext, useEffect, useState } from 'react';
import { tierFeatures } from '../config/featureAccess';
import { logger } from '../lib/logger';
import { supabase } from '../lib/supabaseClient';

type Tier = "free" | "core" | "studio" | null;

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
    return globalTierState.tier;
  }

  // Prevent duplicate fetches
  if (globalTierState.inFlight) {
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
    logger.debug("✅ TierContext - Tier loaded:", globalTierState.tier);
  } catch (err: unknown) {
    const error = err as Error;
    globalTierState.tier = "free";
    globalTierState.error = error;
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

    // ✅ UNIFIED: Listen for centralized cache invalidation events
    const handleTierChanged = (event: CustomEvent) => {
      const { userId, newTier } = event.detail;
      // Force refresh tier when cache is invalidated
      globalTierState.lastFetch = 0; // Force refresh
      fetchTierGlobal();
    };
    
    window.addEventListener('tier-changed', handleTierChanged as EventListener);
    window.addEventListener('tier-cache-invalidated', handleTierChanged as EventListener);

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchTierGlobal();
    });

    return () => {
      listeners.delete(listener);
      subscription.unsubscribe();
      window.removeEventListener('tier-changed', handleTierChanged as EventListener);
      window.removeEventListener('tier-cache-invalidated', handleTierChanged as EventListener);
    };
  }, []);

  const refreshTier = async () => {
    globalTierState.lastFetch = 0; // Force refresh
    await fetchTierGlobal();
  };

  const canUseFeature = (feature: string): boolean => {
    if (state.loading || !state.tier) return false;
    // Use centralized config instead of hardcoded checks
    const features = tierFeatures[state.tier];
    if (!features) return false;
    
    // Check if feature exists in tier config
    if (feature in features) {
      const featureValue = features[feature as keyof typeof features];
      // Handle boolean features
      if (typeof featureValue === 'boolean') return featureValue;
      // Handle numeric features (e.g., limits > 0 means enabled)
      if (typeof featureValue === 'number') return featureValue > 0;
      // Handle string features (non-empty means enabled)
      if (typeof featureValue === 'string') return featureValue !== '';
    }
    
    // Legacy compatibility for features not in config
    if (state.tier === "studio") return true;
    if (state.tier === "core") return feature !== "studio-only";
    if (state.tier === "free") return feature === "text";
    return false;
  };

  const requiresUpgrade = (required: "core" | "studio", feature?: string): boolean => {
    if (state.loading || !state.tier) return true;
    
    // Use tier hierarchy for upgrade checks
    const tierHierarchy = { free: 0, core: 1, studio: 2 };
    const currentTierLevel = tierHierarchy[state.tier] ?? 0;
    const requiredTierLevel = tierHierarchy[required] ?? 0;
    
    // If specific feature provided, check if current tier has it
    if (feature && canUseFeature(feature)) {
      return false; // Current tier already has the feature
    }
    
    return currentTierLevel < requiredTierLevel;
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

// Telemetry for tier checks (analytics-ready)
let tierCheckTelemetry: { feature: string; tier: Tier; allowed: boolean; timestamp: number }[] = [];

function logTierCheck(feature: string, tier: Tier, allowed: boolean) {
  tierCheckTelemetry.push({
    feature,
    tier,
    allowed,
    timestamp: Date.now()
  });
  
  // Keep only last 100 entries
  if (tierCheckTelemetry.length > 100) {
    tierCheckTelemetry = tierCheckTelemetry.slice(-100);
  }
}

// Export telemetry getter for analytics
export function getTierCheckTelemetry() {
  return [...tierCheckTelemetry];
}

// Simple feature checking with centralized config
export function canUseFeature(tier: Tier, feature: string): boolean {
  if (!tier) return false;
  
  const features = tierFeatures[tier];
  if (!features) return false;
  
  let allowed = false;
  
  // Check if feature exists in tier config
  if (feature in features) {
    const featureValue = features[feature as keyof typeof features];
    if (typeof featureValue === 'boolean') allowed = featureValue;
    else if (typeof featureValue === 'number') allowed = featureValue > 0;
    else if (typeof featureValue === 'string') allowed = featureValue !== '';
  } else {
    // Legacy compatibility
    if (tier === "studio") allowed = true;
    else if (tier === "core") allowed = feature !== "studio-only";
    else if (tier === "free") allowed = feature === "text";
  }
  
  // Log for telemetry
  logTierCheck(feature, tier, allowed);
  
  return allowed;
}

// Simple upgrade requirement check with centralized config
export function requiresUpgrade(tier: Tier, feature: string): boolean {
  if (!tier) return true;
  
  // If current tier has the feature, no upgrade needed
  if (canUseFeature(tier, feature)) return false;
  
  // Check if any higher tier has the feature
  const tierOrder: Tier[] = ['free', 'core', 'studio'];
  const currentIndex = tierOrder.indexOf(tier);
  
  for (let i = currentIndex + 1; i < tierOrder.length; i++) {
    if (canUseFeature(tierOrder[i], feature)) {
      return true; // A higher tier has this feature
    }
  }
  
  return false; // No tier has this feature
}
