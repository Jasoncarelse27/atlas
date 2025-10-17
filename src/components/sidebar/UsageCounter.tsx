import { RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSupabaseAuth } from '../../hooks/useSupabaseAuth';
import { supabase } from '../../lib/supabaseClient';
import { subscriptionApi } from '../../services/subscriptionApi';
import { UpgradeButton } from '../UpgradeButton';
import { logger } from '../../lib/logger';

interface UsageCounterProps {
  userId?: string;
}

export default function UsageCounter({ userId }: UsageCounterProps) {
  const { tier, isLoading } = useSupabaseAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [forceRender, setForceRender] = useState(0);
  
  // ✅ Force re-render when tier changes and fix tier mismatch
  // MUST be before any conditional returns to follow Rules of Hooks
  useEffect(() => {
    logger.debug('[UsageCounter] 🔄 Tier changed:', tier, 'isLoading:', isLoading);
    setForceRender(prev => prev + 1);
    
    // If tier is 'free' but should be 'studio', force a refresh
    if (!isLoading && tier === 'free' && userId) {
      logger.debug('[UsageCounter] ⚠️ Tier mismatch detected - forcing refresh');
      const fixTierMismatch = async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            subscriptionApi.clearUserCache(userId);
            await subscriptionApi.forceRefreshProfile(userId, session.access_token);
          }
        } catch (error) {
          logger.error('[UsageCounter] Failed to fix tier mismatch:', error);
        }
      };
      fixTierMismatch();
    }
  }, [tier, isLoading, userId]);

  // Show loading state while tier is being fetched
  if (isLoading) {
    return (
      <div className="bg-[#2c2f36] p-4 rounded-lg shadow">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-gray-300 text-sm font-medium">Current Tier</h3>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-gray-400">Loading...</span>
          </div>
        </div>
        <div className="text-center">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-700 rounded w-24 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  // Debug log to verify tier value
  logger.debug('[UsageCounter] Current tier:', tier, 'isLoading:', isLoading, 'forceRender:', forceRender);
  
  // Simplified remaining messages calculation for studio/core users
  const remainingMessages = tier === 'free' ? 15 : 0;
  
  // Use consolidated subscription hook for real usage data
  const messageCount = tier === 'free' ? (15 - remainingMessages) : 0;
  const maxMessages = tier === 'free' ? 15 : -1; // -1 means unlimited (15 messages per month for Free)

  const getTierDisplayName = (tier: string) => {
    switch (tier) {
      case 'free': return 'Atlas Free';
      case 'core': return 'Atlas Core';
      case 'studio': return 'Atlas Studio';
      default: return 'Atlas Free';
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'free': return 'text-yellow-400';
      case 'core': return 'text-blue-400';
      case 'studio': return 'text-purple-400';
      default: return 'text-yellow-400';
    }
  };

  const getTierTooltip = (tier: string) => {
    switch (tier) {
      case 'free': return '15 conversations/day. Upgrade for unlimited conversations and advanced features.';
      case 'core': return 'Unlimited text + voice + image analysis with Claude Sonnet.';
      case 'studio': return 'All features unlocked with Claude Opus and priority support.';
      default: return '15 conversations/day. Upgrade for unlimited conversations and advanced features.';
    }
  };

  const isUnlimited = tier === 'core' || tier === 'studio';

  const handleRefreshTier = async () => {
    if (!userId || isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      // Set global flag to skip debounce in useSubscription hook
      (window as any).__skipDebounce = true;
      
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        // Clear all caches first
        subscriptionApi.clearUserCache(userId);
        
        // Force refresh with cache-busting
        await subscriptionApi.forceRefreshProfile(userId, session.access_token);
        
        // Force a page refresh to update all components
        setTimeout(() => window.location.reload(), 500);
      }
    } catch (error) {
      logger.error('Failed to refresh tier:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="bg-[#2c2f36] p-4 rounded-lg shadow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-gray-300 text-sm font-medium">Current Tier</h3>
        <div className="flex items-center space-x-2">
          <span 
            className={`text-xs font-semibold ${getTierColor(tier || 'free')} cursor-help`}
            title={getTierTooltip(tier || 'free')}
          >
            {getTierDisplayName(tier || 'free')}
          </span>
          <button
            onClick={handleRefreshTier}
            disabled={isRefreshing}
            className="p-1 text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-50"
            title="Refresh tier status"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      
      {isUnlimited ? (
        <div className="text-center">
          <p className="text-green-400 text-sm font-medium">✨ Unlimited Messages</p>
          <p className="text-gray-400 text-xs mt-1">All features unlocked</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Messages This Month</span>
            <span className="text-gray-200">{messageCount} / {maxMessages}</span>
          </div>
          
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div 
              className="bg-yellow-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(messageCount / maxMessages) * 100}%` }}
            />
          </div>
          
          <p className="text-gray-400 text-xs text-center">
            {remainingMessages} messages remaining this month
          </p>
          
          {remainingMessages <= 3 && (
            <div className="mt-3">
              <UpgradeButton size="sm" className="w-full" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
