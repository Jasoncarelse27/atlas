import { Crown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { hasUnlimitedMessages } from '../../config/featureAccess';
import { getTierDisplayName, getTierTooltip, useTierQuery } from '../../hooks/useTierQuery';
import { logger } from '../../lib/logger';
import { supabase } from '../../lib/supabaseClient';
import { fetchWithAuthJSON } from '../../services/fetchWithAuth';
import { UpgradeButton } from '../UpgradeButton';

interface UsageCounterProps {
  userId?: string;
}

interface UsageData {
  tier: string;
  monthlyCount: number;
  monthlyLimit: number;
  remaining: number;
  isUnlimited: boolean;
}

export default function UsageCounter({ userId: propUserId }: UsageCounterProps) {
  // 🚀 Modern tier management with React Query + Realtime
  const { tier, isLoading } = useTierQuery();
  
  // ✅ CRITICAL: Log tier changes for debugging
  useEffect(() => {
    logger.info(`[UsageCounter] 🔄 Tier updated: ${tier.toUpperCase()}, isLoading: ${isLoading}`);
  }, [tier, isLoading]);
  
  // ✅ FIX: Fetch actual monthly message count from backend
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(true);
  const [actualUserId, setActualUserId] = useState<string | null>(propUserId || null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  
  // ✅ Get userId from session if not provided
  useEffect(() => {
    const getUserId = async () => {
      if (propUserId) {
        setActualUserId(propUserId);
        return;
      }
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          setActualUserId(session.user.id);
        }
      } catch (error) {
        logger.error('[UsageCounter] Failed to get userId:', error);
      }
    };
    
    getUserId();
  }, [propUserId]);
  
  useEffect(() => {
    const fetchUsage = async () => {
      if (!actualUserId) {
        setLoadingUsage(false);
        return;
      }
      
      try {
        setLoadingUsage(true);
        // ✅ FIX: Use centralized API client to handle HTTPS/HTTP mixed content issues
        const { getApiEndpoint } = await import('../../utils/apiClient');
        const usageEndpoint = getApiEndpoint('/api/usage');
        const usageData = await fetchWithAuthJSON(usageEndpoint);
        
        logger.debug('[UsageCounter] Fetched usage data:', usageData);
        
        // ✅ CRITICAL FIX: Ensure we get actual count from backend
        const monthlyCount = usageData.monthlyCount ?? 0;
        
        // ✅ CRITICAL FIX: Always calculate limits based on tier from useTierQuery (database source of truth), NOT API response
        // The API might return stale/cached tier data, so we ignore monthlyLimit from API and calculate it ourselves
        const monthlyLimit = hasUnlimitedMessages(tier) ? -1 : 15;
        const isUnlimited = hasUnlimitedMessages(tier);
        const remaining = isUnlimited ? -1 : Math.max(0, monthlyLimit - monthlyCount);
        
        logger.info(`[UsageCounter] 📊 Setting usage with tier from database: ${tier.toUpperCase()}, monthlyLimit: ${monthlyLimit}, isUnlimited: ${isUnlimited}`);
        logger.debug(`[UsageCounter] API returned tier: ${usageData.tier}, but using database tier: ${tier}`);
        
        setUsage({
          tier: tier, // Always use tier from useTierQuery hook (fetches DIRECTLY from Supabase)
          monthlyCount: monthlyCount,
          monthlyLimit: monthlyLimit, // Calculated from tier, not API response
          remaining: remaining, // Calculated from tier, not API response
          isUnlimited: isUnlimited // Calculated from tier, not API response
        });
      } catch (error) {
        logger.error('[UsageCounter] Failed to fetch usage:', error);
        // ✅ FIX: If API fails, try to get count from local messages as fallback
        try {
          const { atlasDB } = await import('../../database/atlasDB');
          const now = new Date();
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          const localMessages = await atlasDB.messages
            .where('timestamp')
            .aboveOrEqual(startOfMonth.toISOString())
            .filter(msg => msg.role === 'user')
            .count();
          
          const monthlyLimit = hasUnlimitedMessages(tier) ? -1 : 15;
          setUsage({
            tier,
            monthlyCount: localMessages,
            monthlyLimit: monthlyLimit,
            remaining: monthlyLimit === -1 ? -1 : Math.max(0, monthlyLimit - localMessages),
            isUnlimited: monthlyLimit === -1
          });
        } catch (fallbackError) {
          logger.error('[UsageCounter] Fallback also failed:', fallbackError);
          // Final fallback
          setUsage({
            tier,
            monthlyCount: 0,
            monthlyLimit: hasUnlimitedMessages(tier) ? -1 : 15,
            remaining: hasUnlimitedMessages(tier) ? -1 : 15,
            isUnlimited: hasUnlimitedMessages(tier)
          });
        }
      } finally {
        setLoadingUsage(false);
      }
    };
    
    // Initial fetch
    fetchUsage();
    
    // ✅ BEST PRACTICE: Supabase Realtime subscription for instant cross-device sync
    // Follows pattern from useRealtimeConversations and useTierQuery
    if (actualUserId) {
      const sanitizedId = actualUserId.replace(/-/g, "_");
      const channelName = `usage_counter_${sanitizedId}`;
      
      // Clean up existing channel if any
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      
      // Create channel for user message INSERT events
      const channel = supabase.channel(channelName);
      
      // ✅ CRITICAL: Listen for user message INSERTs (only count user messages, not assistant)
      channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `user_id=eq.${actualUserId} AND role=eq.user`,
        },
        async (payload) => {
          const newMessage = payload.new;
          logger.debug('[UsageCounter] 🔔 New user message inserted via Realtime, refreshing usage count...', {
            messageId: newMessage.id,
            userId: actualUserId
          });
          
          // ✅ Refresh usage count immediately when new user message is inserted
          // This provides instant cross-device sync (mobile ↔ web)
          await fetchUsage();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.debug('[UsageCounter] ✅ Subscribed to message INSERT events for usage updates');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          logger.warn('[UsageCounter] ⚠️ Realtime channel closed, falling back to polling');
        }
      });
      
      channelRef.current = channel;
    }
    
    // ✅ FALLBACK: Poll every 30 seconds as backup (in case Realtime fails)
    const interval = setInterval(fetchUsage, 30000);
    
    return () => {
      clearInterval(interval);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [actualUserId, tier]);
  
  // ✅ PROFESSIONAL FIX: Cap display at limit maximum (never show 65/15, show 15/15 instead)
  const rawCount = usage?.monthlyCount ?? 0;
  const maxMessages = usage?.monthlyLimit ?? (hasUnlimitedMessages(tier) ? -1 : 15);
  // ✅ CRITICAL: Always cap at limit for display (works on both mobile and web)
  const messageCount = maxMessages === -1 ? rawCount : Math.min(rawCount, maxMessages);
  // ✅ CRITICAL: Calculate remaining based on capped count, not raw count
  const remainingMessages = maxMessages === -1 ? -1 : Math.max(0, maxMessages - messageCount);
  const isUnlimited = usage?.isUnlimited ?? hasUnlimitedMessages(tier);
  
  // ✅ DEBUG: Log for troubleshooting mobile/web differences
  if (import.meta.env.DEV) {
    logger.debug('[UsageCounter] Display values:', {
      rawCount,
      messageCount,
      maxMessages,
      remainingMessages,
      isUnlimited,
      userAgent: navigator.userAgent.slice(0, 50)
    });
  }

  // ✅ CRITICAL FIX: Ensure tier is loaded before displaying
  if (isLoading || !tier) {
    logger.debug(`[UsageCounter] ⏳ Waiting for tier... isLoading: ${isLoading}, tier: ${tier}`);
    return (
      <div className="bg-atlas-pearl/50 dark:bg-[#1A1D26]/80 border border-atlas-border dark:border-[#2A2E3A] p-4 rounded-xl shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-atlas-text-muted dark:text-gray-400 text-sm font-medium uppercase tracking-wider">Current Tier</h3>
          <span className="text-xs font-semibold text-atlas-sage dark:text-[#F4E5D9]">Loading...</span>
        </div>
      </div>
    );
  }

  // ✅ CRITICAL: Log what tier we're displaying
  logger.info(`[UsageCounter] 🎨 Rendering with tier: ${tier.toUpperCase()}, display name: ${getTierDisplayName(tier)}`);

  return (
    <div className="bg-atlas-pearl/50 dark:bg-[#1A1D26]/80 border border-atlas-border dark:border-[#2A2E3A] p-4 rounded-xl shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-atlas-text-muted dark:text-gray-400 text-sm font-medium uppercase tracking-wider">Current Tier</h3>
        <span 
          className="text-xs font-semibold text-atlas-sage dark:text-[#F4E5D9] cursor-help"
          title={getTierTooltip(tier)}
        >
          {getTierDisplayName(tier)}
        </span>
      </div>
      
      {isUnlimited ? (
        <div className="text-center py-2">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="p-2 rounded-xl bg-atlas-sage/20 dark:bg-[#F4E5D9]/20">
              <Crown className="w-5 h-5 text-atlas-sage dark:text-[#F4E5D9]" />
            </div>
          </div>
          <p className="text-atlas-sage dark:text-[#F4E5D9] text-sm font-semibold">Unlimited Messages</p>
          <p className="text-atlas-text-muted dark:text-gray-400 text-xs mt-1">All features unlocked</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-atlas-text-muted dark:text-gray-400">Messages This Month</span>
            <span className={`font-medium ${
              messageCount >= maxMessages 
                ? 'text-red-600 dark:text-red-400' 
                : 'text-atlas-text-dark dark:text-gray-300'
            }`}>
              {messageCount} / {maxMessages}
            </span>
          </div>
          
          <div className="w-full bg-atlas-border dark:bg-[#2A2E3A] rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                messageCount >= maxMessages 
                  ? 'bg-red-500 dark:bg-red-400' 
                  : 'bg-atlas-sage dark:bg-[#F4E5D9]'
              }`}
              style={{ width: `${Math.min(100, (messageCount / maxMessages) * 100)}%` }}
            />
          </div>
          
          <p className={`text-xs text-center ${
            messageCount >= maxMessages 
              ? 'text-red-600 dark:text-red-400 font-semibold' 
              : 'text-atlas-text-muted dark:text-gray-400'
          }`}>
            {messageCount >= maxMessages 
              ? 'Limit reached - Upgrade to continue' 
              : `${remainingMessages} messages remaining this month`
            }
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
