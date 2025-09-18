// Enhanced Upgrade Modal with Revenue Protection
// Clear value propositions and specific pricing for Atlas tiers

import { Check, Clock, Image, MessageCircle, Mic, Shield, X, Zap } from 'lucide-react';
import { tierFeatures } from '../config/featureAccess';
import type { Tier } from '../types/tier';

interface EnhancedUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTier: Tier;
  reason: 'daily_limit' | 'audio' | 'image' | 'voice_emotion' | 'habit_tracking' | 'reflection_mode' | 'priority_support' | 'weekly_insights';
  remainingConversations?: number | 'unlimited';
  warningLevel?: 'normal' | 'warning' | 'critical' | 'exceeded';
  graceEndsAt?: string;
  onUpgrade: (tier: Tier) => void;
}

export function EnhancedUpgradeModal({
  isOpen,
  onClose,
  currentTier,
  reason,
  remainingConversations,
  onUpgrade
}: EnhancedUpgradeModalProps) {
  if (!isOpen) return null;

  const getReasonMessage = () => {
    switch (reason) {
      case 'daily_limit':
        if (currentTier === 'free') {
          return "You've used all 15 conversations today! 🎯";
        }
        return currentTier === 'core' 
          ? "You've used all 150 conversations today! 🎯"
          : "Upgrade for more conversations! 🎯";
      case 'audio':
        return "Voice features unlock deeper emotional connection 🎤";
      case 'image':
        return "Image analysis helps understand emotional context 📸";
      case 'voice_emotion':
        return "Advanced voice emotion analysis for deeper insights 🎙️";
      case 'habit_tracking':
        return "Track habits and discover emotional patterns 📊";
      case 'reflection_mode':
        return "Private reflection mode for personal growth 🪞";
      case 'priority_support':
        return "Get priority support within 4 hours ⚡";
      case 'weekly_insights':
        return "Receive weekly coaching insights 📈";
      default:
        return "Unlock Atlas's full potential 🚀";
    }
  };

  const getSuggestedTier = (): Tier => {
    if (reason === 'image' || reason === 'voice_emotion' || reason === 'priority_support' || reason === 'weekly_insights') {
      return 'studio';
    }
    if (currentTier === 'free') return 'core';
    return 'studio';
  };

  const suggestedTier = getSuggestedTier();
  const freeFeatures = tierFeatures.free;
  const coreFeatures = tierFeatures.core;
  const studioFeatures = tierFeatures.studio;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 relative">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {getReasonMessage()}
            </h2>
            <p className="text-gray-600">
              Choose the plan that fits your emotional wellbeing journey
            </p>
            {typeof remainingConversations === 'number' && remainingConversations === 0 && (
              <div className="mt-3 px-4 py-2 bg-orange-100 text-orange-800 rounded-lg inline-block">
                Your conversations reset at midnight UTC
              </div>
            )}
            {graceEndsAt && (
              <div className="mt-3 px-4 py-2 bg-red-100 text-red-800 rounded-lg inline-block">
                ⚠️ Payment failed - Grace period ends {new Date(graceEndsAt).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="p-6">
          <div className="grid md:grid-cols-3 gap-6">
            
            {/* Free Tier */}
            <div className={`border-2 rounded-xl p-6 ${currentTier === 'free' ? 'border-blue-200 bg-blue-50' : 'border-gray-200'}`}>
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Free</h3>
                <div className="text-3xl font-bold text-gray-900 mt-2">
                  $0<span className="text-sm font-normal text-gray-500">/month</span>
                </div>
                {currentTier === 'free' && (
                  <div className="mt-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                    Current Plan
                  </div>
                )}
              </div>

              <ul className="space-y-3 mb-6">
                <li className="flex items-center">
                  <MessageCircle className="w-4 h-4 text-blue-500 mr-3" />
                  <span className="text-sm">15 conversations/day</span>
                </li>
                <li className="flex items-center">
                  <Zap className="w-4 h-4 text-blue-500 mr-3" />
                  <span className="text-sm">100 tokens per response</span>
                </li>
                <li className="flex items-center">
                  <Shield className="w-4 h-4 text-blue-500 mr-3" />
                  <span className="text-sm">Basic emotional check-ins</span>
                </li>
                <li className="flex items-center">
                  <Check className="w-4 h-4 text-blue-500 mr-3" />
                  <span className="text-sm">Community support</span>
                </li>
                <li className="flex items-center text-gray-400">
                  <X className="w-4 h-4 mr-3" />
                  <span className="text-sm">No voice features</span>
                </li>
                <li className="flex items-center text-gray-400">
                  <X className="w-4 h-4 mr-3" />
                  <span className="text-sm">No habit tracking</span>
                </li>
              </ul>

              <button 
                disabled
                className="w-full py-3 px-4 bg-gray-100 text-gray-400 rounded-lg font-medium cursor-not-allowed"
              >
                Current Plan
              </button>
            </div>

            {/* Core Tier */}
            <div className={`border-2 rounded-xl p-6 relative ${suggestedTier === 'core' ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
              {suggestedTier === 'core' && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <div className="bg-green-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                    Recommended
                  </div>
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Atlas Core</h3>
                <div className="text-3xl font-bold text-gray-900 mt-2">
                  $19.99<span className="text-sm font-normal text-gray-500">/month</span>
                </div>
                <div className="text-sm text-gray-500 mt-1">Full emotional intelligence coaching</div>
              </div>

              <ul className="space-y-3 mb-6">
                <li className="flex items-center">
                  <MessageCircle className="w-4 h-4 text-green-500 mr-3" />
                  <span className="text-sm font-medium">150 conversations/day</span>
                </li>
                <li className="flex items-center">
                  <Zap className="w-4 h-4 text-green-500 mr-3" />
                  <span className="text-sm">250 tokens per response</span>
                </li>
                <li className="flex items-center">
                  <Mic className="w-4 h-4 text-green-500 mr-3" />
                  <span className="text-sm font-medium">Voice conversations</span>
                </li>
                <li className="flex items-center">
                  <Shield className="w-4 h-4 text-green-500 mr-3" />
                  <span className="text-sm font-medium">Habit tracking & insights</span>
                </li>
                <li className="flex items-center">
                  <Clock className="w-4 h-4 text-green-500 mr-3" />
                  <span className="text-sm">Private reflection mode</span>
                </li>
                <li className="flex items-center">
                  <Check className="w-4 h-4 text-green-500 mr-3" />
                  <span className="text-sm">Email support (48h)</span>
                </li>
              </ul>

              <button 
                onClick={() => onUpgrade('core')}
                className="w-full py-3 px-4 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
              >
                Upgrade to Core
              </button>
            </div>

            {/* Studio Tier */}
            <div className={`border-2 rounded-xl p-6 relative ${suggestedTier === 'studio' ? 'border-purple-500 bg-purple-50' : 'border-gray-200'}`}>
              {suggestedTier === 'studio' && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <div className="bg-purple-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                    Recommended
                  </div>
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Atlas Studio</h3>
                <div className="text-3xl font-bold text-gray-900 mt-2">
                  $179.99<span className="text-sm font-normal text-gray-500">/month</span>
                </div>
                <div className="text-sm text-gray-500 mt-1">For professionals & power users</div>
              </div>

              <ul className="space-y-3 mb-6">
                <li className="flex items-center">
                  <MessageCircle className="w-4 h-4 text-purple-500 mr-3" />
                  <span className="text-sm font-medium">500 conversations/day</span>
                </li>
                <li className="flex items-center">
                  <Zap className="w-4 h-4 text-purple-500 mr-3" />
                  <span className="text-sm">400 tokens per response</span>
                </li>
                <li className="flex items-center">
                  <Mic className="w-4 h-4 text-purple-500 mr-3" />
                  <span className="text-sm font-medium">Advanced voice emotion analysis</span>
                </li>
                <li className="flex items-center">
                  <Image className="w-4 h-4 text-purple-500 mr-3" />
                  <span className="text-sm font-medium">Image analysis</span>
                </li>
                <li className="flex items-center">
                  <Shield className="w-4 h-4 text-purple-500 mr-3" />
                  <span className="text-sm font-medium">Enhanced emotional reporting</span>
                </li>
                <li className="flex items-center">
                  <Clock className="w-4 h-4 text-purple-500 mr-3" />
                  <span className="text-sm">Priority processing</span>
                </li>
                <li className="flex items-center">
                  <Check className="w-4 h-4 text-purple-500 mr-3" />
                  <span className="text-sm font-medium">Weekly coaching insights</span>
                </li>
                <li className="flex items-center">
                  <Check className="w-4 h-4 text-purple-500 mr-3" />
                  <span className="text-sm">Priority support (4h)</span>
                </li>
              </ul>

              <button 
                onClick={() => onUpgrade('studio')}
                className="w-full py-3 px-4 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium transition-colors"
              >
                Upgrade to Studio
              </button>
            </div>
          </div>

          {/* Value Proposition */}
          <div className="mt-8 text-center">
            <div className="bg-gray-50 rounded-xl p-6">
              <h4 className="font-semibold text-gray-900 mb-3">
                Why upgrade your Atlas experience?
              </h4>
              <div className="grid md:grid-cols-3 gap-4 text-sm text-gray-600">
                <div className="flex items-start">
                  <MessageCircle className="w-4 h-4 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium text-gray-900">More Conversations</div>
                    <div>Never hit daily limits during important moments</div>
                  </div>
                </div>
                <div className="flex items-start">
                  <Zap className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium text-gray-900">Deeper Responses</div>
                    <div>More detailed, thoughtful emotional support</div>
                  </div>
                </div>
                <div className="flex items-start">
                  <Shield className="w-4 h-4 text-purple-500 mr-2 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium text-gray-900">Advanced AI</div>
                    <div>Better understanding of complex emotions</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Money Back Guarantee */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              💝 <strong>30-day money-back guarantee</strong> • Cancel anytime • No hidden fees
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
