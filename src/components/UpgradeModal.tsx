import { Check, Crown, Star, X, Zap } from 'lucide-react';
import React from 'react';
import { Tier } from '../types/tier';
import { TIER_CONFIGS } from '../types/subscription';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTier: Tier;
  triggerReason?: 'message_limit' | 'voice_feature' | 'image_feature' | 'general';
  onUpgrade: (tier: 'core' | 'studio') => void;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  isOpen,
  onClose,
  currentTier,
  triggerReason,
  onUpgrade
}) => {
  if (!isOpen) return null;

  const getTriggerMessage = () => {
    switch (triggerReason) {
      case 'message_limit':
        return 'You\'ve reached your monthly message limit!';
      case 'voice_feature':
        return 'Voice features are available in Atlas Core!';
      case 'image_feature':
        return 'Image analysis is available in Atlas Core!';
      default:
        return 'Unlock the full power of Atlas!';
    }
  };

  const getTriggerDescription = () => {
    switch (triggerReason) {
      case 'message_limit':
        return 'Upgrade to continue your conversations with unlimited messages.';
      case 'voice_feature':
        return 'Speak naturally with Atlas using advanced voice recognition.';
      case 'image_feature':
        return 'Upload and analyze images with AI-powered insights.';
      default:
        return 'Choose the plan that fits your needs and unlock advanced features.';
    }
  };

  const tiers = ['core', 'studio'] as const;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="relative p-6 border-b border-gray-200">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-4">
              <Zap className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {getTriggerMessage()}
            </h2>
            <p className="text-gray-600">
              {getTriggerDescription()}
            </p>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="p-6">
          <div className="grid md:grid-cols-2 gap-6">
            {tiers.map((tier) => {
              const config = TIER_CONFIGS[tier];
              const isPopular = config.popular;
              
              return (
                <div
                  key={tier}
                  className={`relative rounded-xl border-2 p-6 transition-all hover:shadow-lg ${
                    isPopular
                      ? 'border-blue-500 bg-blue-50/50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <div className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                        <Star className="w-4 h-4" />
                        Most Popular
                      </div>
                    </div>
                  )}

                  <div className="text-center mb-6">
                    <div className="flex items-center justify-center mb-3">
                      {tier === 'core' ? (
                        <Crown className="w-8 h-8 text-blue-600" />
                      ) : (
                        <Star className="w-8 h-8 text-purple-600" />
                      )}
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      {config.displayName}
                    </h3>
                    <p className="text-gray-600 text-sm mb-4">
                      {config.description}
                    </p>
                    <div className="mb-4">
                      <span className="text-3xl font-bold text-gray-900">
                        {config.price}
                      </span>
                      {config.yearlyPrice && (
                        <div className="text-sm text-gray-500 mt-1">
                          or {config.yearlyPrice} (save 17%)
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Features */}
                  <div className="space-y-3 mb-6">
                    {config.features.map((feature, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-gray-700">{feature}</span>
                      </div>
                    ))}
                  </div>

                  {/* Upgrade Button */}
                  <button
                    onClick={() => onUpgrade(tier)}
                    className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                      isPopular
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-900 text-white hover:bg-gray-800'
                    }`}
                  >
                    Upgrade to {config.displayName}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-center text-sm text-gray-600">
            <p className="mb-2">
              <strong>7-day money-back guarantee</strong> • Cancel anytime
            </p>
            <p>
              All plans include secure data storage and privacy protection
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};