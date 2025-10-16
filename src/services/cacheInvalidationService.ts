// 🔒 SECURITY: Cache Invalidation Service
// Ensures all tier caches are cleared simultaneously when a user's tier changes
// This prevents stale cache exploits where users access paid features after downgrade

import { fastspringService } from './fastspringService';
import { subscriptionApi } from './subscriptionApi';

type Tier = 'free' | 'core' | 'studio';

class CacheInvalidationService {
  private broadcastChannel: BroadcastChannel | null = null;

  constructor() {
    // Initialize BroadcastChannel for cross-tab communication
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.broadcastChannel = new BroadcastChannel('atlas_tier_updates');
      this.setupListener();
    }
  }

  /**
   * Clear ALL tier-related caches for a specific user
   * Called when webhook updates user tier or when user cancels subscription
   */
  async invalidateUserTier(userId: string): Promise<void> {
    console.log(`[CacheInvalidation] Clearing all caches for user ${userId}`);
    
    try {
      await Promise.all([
        // Clear service-level caches
        this.clearFastSpringCache(userId),
        this.clearPaddleCache(userId),
        this.clearSubscriptionApiCache(userId),
        
        // Clear browser storage
        this.clearBrowserStorage(userId),
        
        // Clear Dexie offline cache
        this.clearDexieCache(userId),
      ]);
      
      console.log(`✅ [CacheInvalidation] All caches cleared for user ${userId}`);
    } catch (error) {
      console.error(`[CacheInvalidation] Error clearing caches:`, error);
      // Don't throw - partial cache clear is better than none
    }
  }

  /**
   * Called when tier changes (e.g., webhook received, subscription updated)
   * Clears caches AND broadcasts to other tabs
   */
  async onTierChange(userId: string, newTier: Tier, source: string = 'webhook'): Promise<void> {
    console.log(`[CacheInvalidation] Tier changed for ${userId}: ${newTier} (source: ${source})`);
    
    // Clear all caches first
    await this.invalidateUserTier(userId);
    
    // Broadcast to other tabs/windows
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: 'TIER_CHANGED',
        userId,
        newTier,
        timestamp: Date.now(),
        source
      });
    }
    
    // Trigger global tier context refresh
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tier-changed', {
        detail: { userId, newTier }
      }));
    }
  }

  /**
   * Listen for tier changes from other tabs
   */
  private setupListener(): void {
    if (!this.broadcastChannel) return;
    
    this.broadcastChannel.onmessage = (event) => {
      const { type, userId, newTier } = event.data;
      
      if (type === 'TIER_CHANGED') {
        console.log(`[CacheInvalidation] Received tier change from another tab: ${userId} -> ${newTier}`);
        
        // Trigger refresh in this tab
        window.dispatchEvent(new CustomEvent('tier-changed', {
          detail: { userId, newTier }
        }));
      }
    };
  }

  /**
   * Clear FastSpring service cache
   */
  private async clearFastSpringCache(userId: string): Promise<void> {
    try {
      // @ts-ignore - accessing private cache property
      if (fastspringService?.subscriptionCache) {
        // @ts-ignore
        fastspringService.subscriptionCache.delete(userId);
      }
    } catch (error) {
      console.warn('[CacheInvalidation] Could not clear FastSpring cache:', error);
    }
  }

  /**
   * Clear Paddle service cache
   */
  private async clearPaddleCache(userId: string): Promise<void> {
    // Paddle service removed - only FastSpring is used
  }

  /**
   * Clear subscription API cache
   */
  private async clearSubscriptionApiCache(userId: string): Promise<void> {
    try {
      // Get access token for force refresh
      const supabase = (await import('../lib/supabaseClient')).default;
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      
      if (accessToken) {
        // Force refresh by calling the API's cache clear method
        await subscriptionApi.forceRefreshProfile(userId, accessToken);
      }
    } catch (error) {
      console.warn('[CacheInvalidation] Could not clear SubscriptionAPI cache:', error);
    }
  }

  /**
   * Clear browser localStorage and sessionStorage
   */
  private async clearBrowserStorage(userId: string): Promise<void> {
    if (typeof window === 'undefined') return;
    
    try {
      // Clear tier-related keys
      const keysToRemove = [
        `tier_${userId}`,
        `subscription_${userId}`,
        `profile_${userId}`,
        'cachedTier',
        'lastTierFetch'
      ];
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      });
    } catch (error) {
      console.warn('[CacheInvalidation] Could not clear browser storage:', error);
    }
  }

  /**
   * Clear Dexie offline cache
   */
  private async clearDexieCache(userId: string): Promise<void> {
    try {
      // Dynamically import Dexie DB instance from the correct database file
      const dbModule = await import('../database/atlasDB');
      const { atlasDB } = dbModule;
      
      if (!atlasDB) {
        console.warn('[CacheInvalidation] AtlasDB not available');
        return;
      }
      
      // Clear user-related data from AtlasDB
      try {
        await atlasDB.messages.where('userId').equals(userId).delete();
        await atlasDB.conversations.where('userId').equals(userId).delete();
      } catch (err) {
        // Tables might not exist or be accessible
        console.warn('[CacheInvalidation] Could not clear specific tables:', err);
      }
      
      console.log(`[CacheInvalidation] Cleared AtlasDB cache for user ${userId}`);
    } catch (error) {
      console.warn('[CacheInvalidation] Could not clear AtlasDB cache:', error);
    }
  }

  /**
   * Force immediate tier refresh from server
   */
  async forceRefresh(userId: string): Promise<Tier> {
    console.log(`[CacheInvalidation] Force refreshing tier for ${userId}`);
    
    // Clear all caches first
    await this.invalidateUserTier(userId);
    
    // Fetch fresh tier from server
    try {
      const supabase = (await import('../lib/supabaseClient')).default;
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      
      if (!accessToken) {
        return 'free';
      }
      
      const tier = await subscriptionApi.getUserTier(userId, accessToken);
      console.log(`✅ [CacheInvalidation] Fresh tier fetched: ${tier}`);
      return tier;
    } catch (error) {
      console.error('[CacheInvalidation] Error fetching fresh tier:', error);
      return 'free';
    }
  }

  /**
   * Cleanup - close broadcast channel
   */
  destroy(): void {
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }
  }
}

// Export singleton instance
export const cacheInvalidationService = new CacheInvalidationService();

// Cleanup on window unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    cacheInvalidationService.destroy();
  });
}

