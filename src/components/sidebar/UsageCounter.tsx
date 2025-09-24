import React from 'react';
import { useTierAccess } from '../../hooks/useTierAccess';
import { UpgradeButton } from '../UpgradeButton';

export default function UsageCounter() {
  const { tier, messageCount, maxMessages, remainingMessages } = useTierAccess();

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

  const isUnlimited = tier === 'core' || tier === 'studio';

  return (
    <div className="bg-[#2c2f36] p-4 rounded-lg shadow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-gray-300 text-sm font-medium">Current Tier</h3>
        <span className={`text-xs font-semibold ${getTierColor(tier)}`}>
          {getTierDisplayName(tier)}
        </span>
      </div>
      
      {isUnlimited ? (
        <div className="text-center">
          <p className="text-green-400 text-sm font-medium">✨ Unlimited Messages</p>
          <p className="text-gray-400 text-xs mt-1">All features unlocked</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Messages Today</span>
            <span className="text-gray-200">{messageCount} / {maxMessages}</span>
          </div>
          
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div 
              className="bg-yellow-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(messageCount / maxMessages) * 100}%` }}
            />
          </div>
          
          <p className="text-gray-400 text-xs text-center">
            {remainingMessages} messages remaining
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
