// Enhanced Usage Indicator with Revenue Protection
// Shows daily conversation limits and encourages upgrades

import { Clock, MessageCircle, TrendingUp, Zap } from 'lucide-react';
import { tierFeatures } from '../config/featureAccess';
import type { Tier } from '../types/tier';

interface UsageIndicatorEnhancedProps {
  tier: Tier;
  conversationsToday: number;
  remainingConversations: number | 'unlimited';
  onUpgrade: () => void;
  className?: string;
}

export function UsageIndicatorEnhanced({
  tier,
  conversationsToday,
  remainingConversations,
  onUpgrade,
  className = ''
}: UsageIndicatorEnhancedProps) {
  
  const features = tierFeatures[tier];
  const maxConversations = features.maxConversationsPerDay;
  
  // Calculate usage percentage
  const usagePercentage = maxConversations === -1 
    ? 0 
    : (conversationsToday / maxConversations) * 100;
  
  // Determine status and styling
  const getStatusInfo = () => {
    if (remainingConversations === 'unlimited') {
      return {
        status: 'unlimited',
        color: 'text-green-600',
        bgColor: 'bg-green-100',
        barColor: 'bg-green-500',
        showUpgrade: false
      };
    }
    
    const remaining = remainingConversations as number;
    
    if (remaining === 0) {
      return {
        status: 'exhausted',
        color: 'text-red-600',
        bgColor: 'bg-red-100',
        barColor: 'bg-red-500',
        showUpgrade: true
      };
    }
    
    if (remaining <= 3) {
      return {
        status: 'low',
        color: 'text-orange-600',
        bgColor: 'bg-orange-100',
        barColor: 'bg-orange-500',
        showUpgrade: true
      };
    }
    
    return {
      status: 'good',
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      barColor: 'bg-blue-500',
      showUpgrade: false
    };
  };

  const statusInfo = getStatusInfo();

  const getStatusMessage = () => {
    if (remainingConversations === 'unlimited') {
      return `${conversationsToday} conversations today • Unlimited`;
    }
    
    const remaining = remainingConversations as number;
    
    if (remaining === 0) {
      return `All ${maxConversations} conversations used today`;
    }
    
    return `${conversationsToday} of ${maxConversations} conversations used`;
  };

  const getUpgradeMessage = () => {
    if (tier === 'free') {
      return "Upgrade to Basic for 100 daily conversations";
    }
    return "Upgrade to Premium for unlimited conversations";
  };

  const getResetTime = () => {
    const now = new Date();
    const utcMidnight = new Date();
    utcMidnight.setUTCHours(24, 0, 0, 0);
    
    const hoursUntilReset = Math.ceil((utcMidnight.getTime() - now.getTime()) / (1000 * 60 * 60));
    
    if (hoursUntilReset <= 1) {
      return "Resets in less than 1 hour";
    }
    return `Resets in ${hoursUntilReset} hours`;
  };

  return (
    <div className={`${className}`}>
      <div className={`rounded-lg p-4 border ${statusInfo.bgColor} border-opacity-50`}>
        
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center">
            <MessageCircle className={`w-4 h-4 ${statusInfo.color} mr-2`} />
            <span className={`text-sm font-medium ${statusInfo.color}`}>
              Daily Usage
            </span>
          </div>
          
          {tier !== 'premium' && (
            <button
              onClick={onUpgrade}
              className="text-xs px-2 py-1 bg-white rounded border hover:bg-gray-50 transition-colors"
            >
              Upgrade
            </button>
          )}
        </div>

        {/* Progress Bar (only for limited tiers) */}
        {maxConversations !== -1 && (
          <div className="mb-3">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${statusInfo.barColor}`}
                style={{ width: `${Math.min(usagePercentage, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Status Message */}
        <div className="text-sm text-gray-700 mb-2">
          {getStatusMessage()}
        </div>

        {/* Reset Time (for limited tiers) */}
        {maxConversations !== -1 && (
          <div className="flex items-center text-xs text-gray-500">
            <Clock className="w-3 h-3 mr-1" />
            {getResetTime()}
          </div>
        )}

        {/* Upgrade Prompt */}
        {statusInfo.showUpgrade && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <TrendingUp className="w-4 h-4 text-green-500 mr-2" />
                <span className="text-sm text-gray-700">
                  {getUpgradeMessage()}
                </span>
              </div>
              <button
                onClick={onUpgrade}
                className="text-xs px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
              >
                Upgrade
              </button>
            </div>
          </div>
        )}

        {/* Tier Badge */}
        <div className="mt-2">
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            tier === 'studio' 
              ? 'bg-purple-100 text-purple-800'
              : tier === 'core'
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-800'
          }`}>
            <Zap className="w-3 h-3 mr-1" />
            {tier.charAt(0).toUpperCase() + tier.slice(1)} Plan
          </span>
        </div>
      </div>
    </div>
  );
}
