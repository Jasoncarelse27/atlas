// Atlas Tier Cache Synchronization Hook
// Invalidates React Query cache after tier updates for consistent UI

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTier } from '../contexts/TierContext';
import { logger } from '../lib/logger';

/**
 * Hook for invalidating React Query cache after tier updates
 * Ensures UI consistency when subscription tier changes
 */
export function useTierCacheSync() {
  const queryClient = useQueryClient();
  const { tier, refreshTier } = useTier();
  
  /**
   * Refresh tier and invalidate all tier-dependent queries
   */
  const syncTierCache = useCallback(async () => {
    // First, refresh the tier from the server
    await refreshTier();
    
    // Then invalidate all tier-dependent queries
    // These queries need to be refetched with the new tier context
    await Promise.all([
      // User profile queries (contains tier info)
      queryClient.invalidateQueries({ queryKey: ['userProfile'] }),
      queryClient.invalidateQueries({ queryKey: ['user-profile'] }),
      
      // Subscription-related queries
      queryClient.invalidateQueries({ queryKey: ['subscription'] }),
      queryClient.invalidateQueries({ queryKey: ['subscription-status'] }),
      queryClient.invalidateQueries({ queryKey: ['fastspring-subscription'] }),
      
      // Feature access queries
      queryClient.invalidateQueries({ queryKey: ['feature-access'] }),
      queryClient.invalidateQueries({ queryKey: ['tier-features'] }),
      
      // Usage tracking queries (tier affects limits)
      queryClient.invalidateQueries({ queryKey: ['usage'] }),
      queryClient.invalidateQueries({ queryKey: ['daily-usage'] }),
      queryClient.invalidateQueries({ queryKey: ['message-count'] }),
      
      // AI model queries (tier affects which model is used)
      queryClient.invalidateQueries({ queryKey: ['ai-model'] }),
      queryClient.invalidateQueries({ queryKey: ['model-config'] }),
    ]);
    
    // Also clear any cached responses that might be tier-specific
    // This ensures fresh data on next API call
    queryClient.removeQueries({ 
      predicate: (query) => {
        const queryKey = query.queryKey as string[];
        // Remove cached AI responses as they might be tier-limited
        return queryKey.includes('ai-response') || 
               queryKey.includes('cached-response') ||
               queryKey.includes('conversation-messages');
      }
    });
    
    logger.debug('✅ Tier cache synchronized:', tier);
  }, [refreshTier, queryClient, tier]);
  
  /**
   * Invalidate specific tier-dependent query
   */
  const invalidateTierQuery = useCallback(async (queryKey: string[]) => {
    await queryClient.invalidateQueries({ queryKey });
  }, [queryClient]);
  
  /**
   * Check if a query should be invalidated based on tier change
   */
  const shouldInvalidateOnTierChange = useCallback((queryKey: string[]): boolean => {
    const tierDependentKeys = [
      'userProfile', 'user-profile', 'subscription', 'feature-access',
      'usage', 'daily-usage', 'message-count', 'ai-model', 'model-config'
    ];
    
    return tierDependentKeys.some(key => 
      queryKey.some(k => k.toString().toLowerCase().includes(key.toLowerCase()))
    );
  }, []);
  
  return {
    syncTierCache,
    invalidateTierQuery,
    shouldInvalidateOnTierChange,
    currentTier: tier,
  };
}

/**
 * Hook to use after successful subscription upgrade
 * Automatically syncs tier cache and shows success message
 */
export function useAfterUpgrade() {
  const { syncTierCache } = useTierCacheSync();
  
  const handleUpgradeSuccess = useCallback(async (newTier: 'core' | 'studio') => {
    // Sync the cache to reflect new tier
    await syncTierCache();
    
    // Show success message (could integrate with toast service)
    logger.debug(`🎉 Successfully upgraded to ${newTier} tier!`);
    
    // Optional: Track upgrade event for analytics
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'subscription_upgrade', {
        new_tier: newTier,
        timestamp: new Date().toISOString(),
      });
    }
  }, [syncTierCache]);
  
  return { handleUpgradeSuccess };
}
