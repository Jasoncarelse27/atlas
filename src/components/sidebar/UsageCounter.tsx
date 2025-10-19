import { Crown } from 'lucide-react';
import { getTierColor, getTierDisplayName, getTierTooltip, useTierQuery } from '../../hooks/useTierQuery';
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
      <div className="bg-slate-700/20 border border-slate-600/20 p-4 rounded-2xl shadow animate-pulse">
        <div className="h-4 bg-slate-600/40 rounded w-24 mb-2"></div>
        <div className="h-6 bg-slate-600/40 rounded w-32"></div>
      </div>
    );
  }
  
  // Calculate usage for free tier (studio/core are unlimited)
  const messageCount = 0; // TODO: Connect to real usage API
  const maxMessages = tier === 'free' ? 15 : -1;
  const remainingMessages = tier === 'free' ? 15 - messageCount : 0;
  const isUnlimited = tier === 'core' || tier === 'studio';

  return (
    <div className="bg-slate-700/20 border border-slate-600/20 p-4 rounded-2xl shadow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-slate-300 text-sm font-medium">Current Tier</h3>
        <span 
          className={`text-xs font-semibold ${getTierColor(tier)} cursor-help`}
          title={getTierTooltip(tier)}
        >
          {getTierDisplayName(tier)}
        </span>
      </div>
      
      {isUnlimited ? (
        <div className="text-center py-2">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="p-2 rounded-xl bg-emerald-600/20">
              <Crown className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <p className="text-emerald-400 text-sm font-medium">Unlimited Messages</p>
          <p className="text-slate-400 text-xs mt-1">All features unlocked</p>
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
