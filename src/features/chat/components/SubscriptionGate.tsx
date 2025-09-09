import { AlertTriangle, Crown, Lock, Sparkles } from 'lucide-react';
import React from 'react';
import type { Subscription } from '../../types/subscription';

interface SubscriptionGateProps {
  subscription: Subscription | null;
  messageCount: number;
  maxFreeMessages: number;
  onUpgrade: () => void;
  children: React.ReactNode;
}

const SubscriptionGate: React.FC<SubscriptionGateProps> = ({
  subscription,
  messageCount,
  maxFreeMessages,
  onUpgrade,
  children
}) => {
  const isSubscribed = subscription?.status === 'active';
  const hasReachedLimit = !isSubscribed && messageCount >= maxFreeMessages;
  const remainingMessages = Math.max(0, maxFreeMessages - messageCount);

  if (isSubscribed) {
    return <>{children}</>;
  }

  if (hasReachedLimit) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="mb-4 p-4 bg-gradient-to-r from-purple-100 to-blue-100 rounded-full">
          <Lock className="w-8 h-8 text-purple-600" />
        </div>
        
        <h3 className="text-xl font-bold text-gray-900 mb-2">
          Free Message Limit Reached
        </h3>
        
        <p className="text-gray-600 mb-6 max-w-md">
          You've used all {maxFreeMessages} free messages. Upgrade to Atlas Pro for unlimited conversations with advanced AI models.
        </p>
        
        <div className="space-y-4 w-full max-w-sm">
          <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Crown className="w-5 h-5 text-purple-600" />
              <span className="font-semibold text-purple-900">Atlas Pro Benefits</span>
            </div>
            <ul className="text-sm text-purple-800 space-y-1">
              <li>• Unlimited messages with Claude Sonnet and Opus</li>
              <li>• Advanced voice and image processing</li>
              <li>• Priority support and faster responses</li>
              <li>• Export conversations and insights</li>
            </ul>
          </div>
          
          <button
            onClick={onUpgrade}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105"
          >
            <div className="flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5" />
              Upgrade to Atlas Pro
            </div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {children}
      
      {/* Usage indicator */}
      <div className="fixed bottom-4 right-4 bg-white border border-gray-200 rounded-lg shadow-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-medium text-gray-700">Free Plan</span>
        </div>
        
        <div className="text-xs text-gray-600 mb-2">
          {remainingMessages} messages remaining
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-orange-400 to-red-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(messageCount / maxFreeMessages) * 100}%` }}
          />
        </div>
        
        <button
          onClick={onUpgrade}
          className="mt-2 w-full text-xs bg-blue-600 hover:bg-blue-700 text-white py-1 px-2 rounded transition-colors"
        >
          Upgrade
        </button>
      </div>
    </div>
  );
};

export default SubscriptionGate;
