import { Crown } from 'lucide-react';
import { hasUnlimitedMessages } from '../../config/featureAccess';
import { getTierDisplayName, getTierTooltip, useTierQuery } from '../../hooks/useTierQuery';
import { UpgradeButton } from '../UpgradeButton';

interface UsageCounterProps {
  userId?: string;
}

export default function UsageCounter({ userId }: UsageCounterProps) {
  // 🚀 Modern tier management with React Query + Realtime
  const { tier, isLoading } = useTierQuery();

  // Show shimmer skeleton while loading
  if (isLoading) {
    return (
      <div className="bg-white/50 border border-[#E8DDD2] p-4 rounded-xl shadow-sm animate-pulse">
        <div className="h-4 bg-[#E8DDD2] rounded w-24 mb-2"></div>
        <div className="h-6 bg-[#E8DDD2] rounded w-32"></div>
      </div>
    );
  }
  
  // ✅ Usage tracking: Shows 0 until usage API is implemented
  // This is a display-only component; actual enforcement happens in useTierAccess
  const messageCount = 0; // Shows 0 messages used (enforcement happens server-side)
  const maxMessages = hasUnlimitedMessages(tier) ? -1 : 15;
  const remainingMessages = hasUnlimitedMessages(tier) ? 0 : 15 - messageCount;
  const isUnlimited = hasUnlimitedMessages(tier);

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
            <span className="text-[#5A524A] font-medium">{messageCount} / {maxMessages}</span>
          </div>
          
          <div className="w-full bg-[#E8DDD2] rounded-full h-2">
            <div 
              className="bg-[#F3B562] h-2 rounded-full transition-all duration-300"
              style={{ width: `${(messageCount / maxMessages) * 100}%` }}
            />
          </div>
          
          <p className="text-[#8B7E74] text-xs text-center">
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
