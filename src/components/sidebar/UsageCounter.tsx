import { Crown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { hasUnlimitedMessages } from '../../config/featureAccess';
import { getTierDisplayName, getTierTooltip, useTierQuery } from '../../hooks/useTierQuery';
import { UpgradeButton } from '../UpgradeButton';
import { fetchWithAuthJSON } from '../../services/fetchWithAuth';
import { logger } from '../../lib/logger';
import { supabase } from '../../lib/supabaseClient';

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
  
  // ✅ FIX: Fetch actual monthly message count from backend
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(true);
  const [actualUserId, setActualUserId] = useState<string | null>(propUserId || null);
  
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
        const API_URL = import.meta.env.VITE_API_URL || '';
        const usageData = await fetchWithAuthJSON(`${API_URL}/api/usage`);
        
        setUsage({
          tier: usageData.tier || tier,
          monthlyCount: usageData.monthlyCount || 0,
          monthlyLimit: usageData.monthlyLimit || 15,
          remaining: usageData.remaining ?? (usageData.monthlyLimit === -1 ? -1 : Math.max(0, (usageData.monthlyLimit || 15) - (usageData.monthlyCount || 0))),
          isUnlimited: usageData.isUnlimited || false
        });
      } catch (error) {
        logger.error('[UsageCounter] Failed to fetch usage:', error);
        // Fallback to showing 0 if fetch fails
        setUsage({
          tier,
          monthlyCount: 0,
          monthlyLimit: hasUnlimitedMessages(tier) ? -1 : 15,
          remaining: hasUnlimitedMessages(tier) ? -1 : 15,
          isUnlimited: hasUnlimitedMessages(tier)
        });
      } finally {
        setLoadingUsage(false);
      }
    };
    
    fetchUsage();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchUsage, 30000);
    return () => clearInterval(interval);
  }, [actualUserId, tier]);
  
  // ✅ PROFESSIONAL FIX: Cap display at limit maximum (never show 62/15, show 15/15 instead)
  const rawCount = usage?.monthlyCount ?? 0;
  const maxMessages = usage?.monthlyLimit ?? (hasUnlimitedMessages(tier) ? -1 : 15);
  const messageCount = maxMessages === -1 ? rawCount : Math.min(rawCount, maxMessages); // Cap at limit
  const remainingMessages = usage?.remaining ?? (hasUnlimitedMessages(tier) ? -1 : Math.max(0, maxMessages - messageCount));
  const isUnlimited = usage?.isUnlimited ?? hasUnlimitedMessages(tier);

  return (
    <div className="bg-white/50 border border-[#E8DDD2] p-4 rounded-xl shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[#8B7E74] text-sm font-medium uppercase tracking-wider">Current Tier</h3>
        <span 
          className="text-xs font-semibold text-[#9B8FDB] cursor-help"
          title={getTierTooltip(tier)}
        >
          {getTierDisplayName(tier)}
        </span>
      </div>
      
      {isUnlimited ? (
        <div className="text-center py-2">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="p-2 rounded-xl bg-[#8FA67E]/20">
              <Crown className="w-5 h-5 text-[#8FA67E]" />
            </div>
          </div>
          <p className="text-[#8FA67E] text-sm font-semibold">Unlimited Messages</p>
          <p className="text-[#8B7E74] text-xs mt-1">All features unlocked</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-[#8B7E74]">Messages This Month</span>
            <span className={`font-medium ${messageCount >= maxMessages ? 'text-red-600' : 'text-[#5A524A]'}`}>
              {messageCount} / {maxMessages}
            </span>
          </div>
          
          <div className="w-full bg-[#E8DDD2] rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                messageCount >= maxMessages ? 'bg-red-500' : 'bg-[#F3B562]'
              }`}
              style={{ width: `${Math.min(100, (messageCount / maxMessages) * 100)}%` }}
            />
          </div>
          
          <p className={`text-xs text-center ${
            messageCount >= maxMessages ? 'text-red-600 font-semibold' : 'text-[#8B7E74]'
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
