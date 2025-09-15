import { AlertTriangle, TrendingUp, Zap } from 'lucide-react';
import React from 'react';
import { useTierAccess } from '../hooks/useTierAccess';
import { Tier } from '../utils/featureAccess';

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
  const { getLimit, isUnlimited, getRemainingUsage } = useTierAccess(userTier);

  const getUsagePercentage = (current: number, limit: number) => {
    if (limit === -1) return 0; // Unlimited
    return Math.min((current / limit) * 100, 100);
  };

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

  const textLimit = getLimit('textMessages') || 15;
  const audioLimit = getLimit('audioMinutes') || 0;
  const imageLimit = getLimit('imageUploads') || 0;

  const textPercentage = getUsagePercentage(currentUsage.text_messages_this_month, textLimit);
  const audioPercentage = getUsagePercentage(currentUsage.audio_minutes_this_month, audioLimit);
  const imagePercentage = getUsagePercentage(currentUsage.image_uploads_this_month, imageLimit);

  const showWarning = textPercentage >= 75 || audioPercentage >= 75 || imagePercentage >= 75;
  const showCritical = textPercentage >= 90 || audioPercentage >= 90 || imagePercentage >= 90;

  if (userTier === 'studio') {
    // Studio users have unlimited everything
    return (
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Zap className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-semibold text-purple-900">Atlas Studio</h3>
            <p className="text-sm text-purple-700">Unlimited access to all features</p>
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
            {userTier === 'free' ? 'Atlas Free' : 'Atlas Core'} Usage
          </h3>
        </div>
        {showWarning && (
          <button
            onClick={onUpgrade}
            className="text-sm bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 transition-colors"
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
              textPercentage >= 90 ? 'text-red-600' : 
              textPercentage >= 75 ? 'text-yellow-600' : 
              'text-green-600'
            }`}>
              {isUnlimited('textMessages') 
                ? 'Unlimited' 
                : `${currentUsage.text_messages_this_month}/${textLimit}`
              }
            </span>
          </div>
          {!isUnlimited('textMessages') && (
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  textPercentage >= 90 ? 'bg-red-500' :
                  textPercentage >= 75 ? 'bg-yellow-500' :
                  'bg-green-500'
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
                audioPercentage >= 90 ? 'text-red-600' : 
                audioPercentage >= 75 ? 'text-yellow-600' : 
                'text-green-600'
              }`}>
                {isUnlimited('audioMinutes') 
                  ? 'Unlimited' 
                  : `${currentUsage.audio_minutes_this_month}/${audioLimit}`
                }
              </span>
            </div>
            {!isUnlimited('audioMinutes') && (
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    audioPercentage >= 90 ? 'bg-red-500' :
                    audioPercentage >= 75 ? 'bg-yellow-500' :
                    'bg-green-500'
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
                imagePercentage >= 90 ? 'text-red-600' : 
                imagePercentage >= 75 ? 'text-yellow-600' : 
                'text-green-600'
              }`}>
                {isUnlimited('imageUploads') 
                  ? 'Unlimited' 
                  : `${currentUsage.image_uploads_this_month}/${imageLimit}`
                }
              </span>
            </div>
            {!isUnlimited('imageUploads') && (
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    imagePercentage >= 90 ? 'bg-red-500' :
                    imagePercentage >= 75 ? 'bg-yellow-500' :
                    'bg-green-500'
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
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Upgrade to {userTier === 'free' ? 'Core' : 'Studio'}
          </button>
        </div>
      )}
    </div>
  );
};