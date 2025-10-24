import { getSubscriptionDisplayName, hasUnlimitedMessages } from '@/config/featureAccess';
import { AlertTriangle, TrendingUp, Zap } from 'lucide-react';
import React from 'react';
import { useSubscription } from '../hooks/useSubscription';
import type { Tier } from '../types/tier';

interface UsageIndicatorProps {
  userTier: Tier;
  currentUsage: {
    text_messages_this_month: number;
    audio_minutes_this_month: number;
    image_uploads_this_month: number;
  };
  onUpgrade: () => void;
}

export const UsageIndicator: React.FC<UsageIndicatorProps> = ({
  userTier,
  currentUsage,
  onUpgrade
}) => {
  const { tier, tierLimits } = useSubscription();

  const getUsagePercentage = (current: number, limit: number) => {
    if (limit === -1) return 0; // Unlimited
    return Math.min((current / limit) * 100, 100);
  };

  // Helper functions for usage display
  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600 bg-red-50';
    if (percentage >= 75) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  const getUsageIcon = (percentage: number) => {
    if (percentage >= 90) return AlertTriangle;
    if (percentage >= 75) return TrendingUp;
    return Zap;
  };

  const textLimit = tierLimits.monthlyMessages === -1 ? -1 : tierLimits.monthlyMessages;
  const audioLimit = tierLimits.audioMinutes;
  const imageLimit = tierLimits.imageUploads;

  const textPercentage = getUsagePercentage(currentUsage.text_messages_this_month, textLimit);
  const audioPercentage = getUsagePercentage(currentUsage.audio_minutes_this_month, audioLimit);
  const imagePercentage = getUsagePercentage(currentUsage.image_uploads_this_month, imageLimit);

  const showWarning = textPercentage >= 75 || audioPercentage >= 75 || imagePercentage >= 75;
  const showCritical = textPercentage >= 90 || audioPercentage >= 90 || imagePercentage >= 90;
  const isUnlimited = hasUnlimitedMessages(tier);

  if (isUnlimited && tier === 'studio') {
    // Studio users have unlimited everything
    return (
      <div className="bg-gradient-to-r from-atlas-sand/20 to-atlas-stone/20 border border-atlas-stone/40 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-atlas-stone/20 rounded-lg">
            <Zap className="w-5 h-5 text-atlas-stone" />
          </div>
          <div>
            <h3 className="font-semibold text-atlas-stone">Atlas Studio</h3>
            <p className="text-sm" style={{ color: '#978671' }}>Unlimited access to all features</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`border rounded-lg p-4 ${
      showCritical 
        ? 'border-red-200 bg-red-50' 
        : showWarning 
          ? 'border-yellow-200 bg-yellow-50' 
          : 'border-gray-200 bg-gray-50'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {showCritical ? (
            <AlertTriangle className="w-5 h-5 text-red-600" />
          ) : showWarning ? (
            <TrendingUp className="w-5 h-5 text-yellow-600" />
          ) : (
            <Zap className="w-5 h-5 text-green-600" />
          )}
          <h3 className="font-semibold text-gray-900">
            {getSubscriptionDisplayName(userTier)} Usage
          </h3>
        </div>
        {showWarning && (
          <button
            onClick={onUpgrade}
            className="text-sm bg-atlas-sage text-gray-800 px-3 py-1 rounded-lg hover:bg-atlas-success transition-colors font-medium"
          >
            Upgrade
          </button>
        )}
      </div>

      <div className="space-y-3">
        {/* Text Messages */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-700">Messages</span>
            <span className={`font-medium ${
              textPercentage >= 90 ? 'text-atlas-error' : 
              textPercentage >= 75 ? 'text-atlas-warning' : 
              'text-atlas-success'
            }`}>
              {isUnlimited 
                ? 'Unlimited' 
                : `${currentUsage.text_messages_this_month}/${textLimit}`
              }
            </span>
          </div>
          {!isUnlimited && (
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  textPercentage >= 90 ? 'bg-atlas-error' :
                  textPercentage >= 75 ? 'bg-atlas-warning' :
                  'bg-atlas-success'
                }`}
                style={{ width: `${textPercentage}%` }}
              />
            </div>
          )}
        </div>

        {/* Audio Minutes */}
        {userTier !== 'free' && (
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-700">Voice (minutes)</span>
              <span className={`font-medium ${
                audioPercentage >= 90 ? 'text-atlas-error' : 
                audioPercentage >= 75 ? 'text-atlas-warning' : 
                'text-atlas-success'
              }`}>
              {isUnlimited 
                ? 'Unlimited' 
                : `${currentUsage.audio_minutes_this_month}/${audioLimit}`
              }
              </span>
            </div>
            {!isUnlimited && (
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    audioPercentage >= 90 ? 'bg-atlas-error' :
                    audioPercentage >= 75 ? 'bg-atlas-warning' :
                    'bg-atlas-success'
                  }`}
                  style={{ width: `${audioPercentage}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Image Uploads */}
        {userTier !== 'free' && (
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-700">Images</span>
              <span className={`font-medium ${
                imagePercentage >= 90 ? 'text-atlas-error' : 
                imagePercentage >= 75 ? 'text-atlas-warning' : 
                'text-atlas-success'
              }`}>
              {isUnlimited 
                ? 'Unlimited' 
                : `${currentUsage.image_uploads_this_month}/${imageLimit}`
              }
              </span>
            </div>
            {!isUnlimited && (
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    imagePercentage >= 90 ? 'bg-atlas-error' :
                    imagePercentage >= 75 ? 'bg-atlas-warning' :
                    'bg-atlas-success'
                  }`}
                  style={{ width: `${imagePercentage}%` }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Upgrade Prompt */}
      {showWarning && (
        <div className="mt-4 p-3 bg-white rounded-lg border border-gray-200">
          <p className="text-sm text-gray-700 mb-2">
            {showCritical 
              ? 'You\'ve reached your usage limit! Upgrade to continue.'
              : 'You\'re approaching your usage limit. Consider upgrading for unlimited access.'
            }
          </p>
          <button
            onClick={onUpgrade}
            className="w-full bg-atlas-sage text-gray-800 py-2 px-4 rounded-lg hover:bg-atlas-success transition-colors font-medium"
          >
            Upgrade to {getSubscriptionDisplayName(userTier === 'free' ? 'core' : 'studio')}
          </button>
        </div>
      )}
    </div>
  );
};