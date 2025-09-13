import React, { useEffect } from 'react';
import { useMailer, useMailerEvents, useMailerStats } from '../hooks/useMailer';

interface MailerLiteIntegrationProps {
  userEmail: string;
  userName?: string;
  userTier: 'free' | 'core' | 'studio' | 'complete';
  conversationsToday: number;
  totalConversations: number;
  onError?: (error: Error) => void;
  onSuccess?: (operation: string) => void;
}

/**
 * Example component demonstrating MailerLite integration
 * This component automatically syncs user data and triggers events
 */
export function MailerLiteIntegration({
  userEmail,
  userName,
  userTier,
  conversationsToday,
  totalConversations,
  onError,
  onSuccess,
}: MailerLiteIntegrationProps) {
  // Main MailerLite hook for subscriber management
  const {
    isConfigured,
    isLoading,
    lastError,
    syncSubscriber,
    updateTier,
    updateUsage,
    triggerEvent,
    addToGroup,
    removeFromGroup,
    resetError,
  } = useMailer({
    email: userEmail,
    name: userName,
    tier: userTier,
    autoSync: true,
    onError,
    onSuccess,
  });

  // Simple event trigger hook for one-off events
  const { triggerEvent: triggerSimpleEvent } = useMailerEvents(userEmail);

  // Stats hook for admin purposes
  const { stats, isLoading: statsLoading, refetch: refetchStats } = useMailerStats();

  // Auto-update usage when props change
  useEffect(() => {
    if (isConfigured && userEmail) {
      updateUsage(conversationsToday, totalConversations);
    }
  }, [isConfigured, userEmail, conversationsToday, totalConversations, updateUsage]);

  // Auto-trigger conversation limit event for free tier
  useEffect(() => {
    if (isConfigured && userEmail && userTier === 'free' && conversationsToday >= 2) {
      triggerEvent('conversation_limit_reached', {
        conversations_today: conversationsToday,
        tier_limit: 2,
        user_tier: userTier,
      });
    }
  }, [isConfigured, userEmail, userTier, conversationsToday, triggerEvent]);

  // Auto-trigger first conversation event
  useEffect(() => {
    if (isConfigured && userEmail && totalConversations === 1) {
      triggerEvent('first_conversation', {
        total_conversations: totalConversations,
        user_tier: userTier,
      });
    }
  }, [isConfigured, userEmail, totalConversations, userTier, triggerEvent]);

  // Auto-trigger milestone events
  useEffect(() => {
    if (isConfigured && userEmail && totalConversations > 0 && totalConversations % 10 === 0) {
      triggerEvent('feature_usage_milestone', {
        milestone: totalConversations,
        conversations_today: conversationsToday,
        user_tier: userTier,
      });
    }
  }, [isConfigured, userEmail, totalConversations, conversationsToday, userTier, triggerEvent]);

  // Handle manual tier upgrade
  const handleTierUpgrade = async (newTier: 'core' | 'studio' | 'complete') => {
    try {
      await updateTier(newTier);
      
      // Trigger onboarding event
      await triggerEvent('onboarding_complete', {
        previous_tier: userTier,
        new_tier: newTier,
        upgrade_date: new Date().toISOString(),
      });
      
      onSuccess?.('tier_upgrade_completed');
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error('Tier upgrade failed'));
    }
  };

  // Handle subscription cancellation
  const handleSubscriptionCancel = async () => {
    try {
      await triggerEvent('subscription_cancelled', {
        cancelled_tier: userTier,
        cancel_date: new Date().toISOString(),
        total_conversations,
      });
      
      onSuccess?.('subscription_cancelled');
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error('Subscription cancellation failed'));
    }
  };

  // Handle subscription reactivation
  const handleSubscriptionReactivate = async () => {
    try {
      await triggerEvent('subscription_reactivated', {
        reactivated_tier: userTier,
        reactivate_date: new Date().toISOString(),
      });
      
      onSuccess?.('subscription_reactivated');
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error('Subscription reactivation failed'));
    }
  };

  // Handle manual event triggers
  const handleManualEvent = async (eventName: string) => {
    try {
      await triggerSimpleEvent(eventName as any, {
        manual_trigger: true,
        trigger_time: new Date().toISOString(),
        user_context: {
          tier: userTier,
          conversations_today: conversationsToday,
          total_conversations: totalConversations,
        },
      });
      
      onSuccess?.(`manual_event_${eventName}`);
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error(`Manual event ${eventName} failed`));
    }
  };

  if (!isConfigured) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h3 className="text-lg font-medium text-yellow-800 mb-2">
          📧 MailerLite Not Configured
        </h3>
        <p className="text-yellow-700 text-sm">
          Email automation features are disabled. Add VITE_MAILERLITE_API_KEY to enable.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Section */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-3">
          📧 MailerLite Integration Status
        </h3>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-600">Status:</span>
            <span className={`ml-2 px-2 py-1 rounded text-xs ${
              isLoading ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
            }`}>
              {isLoading ? 'Syncing...' : 'Active'}
            </span>
          </div>
          
          <div>
            <span className="font-medium text-gray-600">User Tier:</span>
            <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
              {userTier}
            </span>
          </div>
          
          <div>
            <span className="font-medium text-gray-600">Conversations Today:</span>
            <span className="ml-2 font-mono">{conversationsToday}</span>
          </div>
          
          <div>
            <span className="font-medium text-gray-600">Total Conversations:</span>
            <span className="ml-2 font-mono">{totalConversations}</span>
          </div>
        </div>

        {lastError && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
            <p className="text-red-800 text-sm">
              <strong>Error:</strong> {lastError.message}
            </p>
            <button
              onClick={resetError}
              className="mt-2 text-red-600 hover:text-red-800 text-xs underline"
            >
              Dismiss Error
            </button>
          </div>
        )}
      </div>

      {/* Manual Actions Section */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-3">
          🎯 Manual Actions
        </h3>
        
        <div className="space-y-3">
          {/* Tier Upgrade Buttons */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upgrade Tier:
            </label>
            <div className="flex space-x-2">
              {(['core', 'studio', 'complete'] as const).map((tier) => (
                <button
                  key={tier}
                  onClick={() => handleTierUpgrade(tier)}
                  disabled={isLoading || userTier === tier}
                  className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                    userTier === tier
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {tier.charAt(0).toUpperCase() + tier.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Subscription Actions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subscription Actions:
            </label>
            <div className="flex space-x-2">
              <button
                onClick={handleSubscriptionCancel}
                disabled={isLoading}
                className="px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                Cancel Subscription
              </button>
              <button
                onClick={handleSubscriptionReactivate}
                disabled={isLoading}
                className="px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                Reactivate
              </button>
            </div>
          </div>

          {/* Manual Event Triggers */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Trigger Events:
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                'user_signup',
                'first_conversation',
                'conversation_limit_reached',
                'feature_usage_milestone',
                'onboarding_complete',
              ].map((event) => (
                <button
                  key={event}
                  onClick={() => handleManualEvent(event)}
                  disabled={isLoading}
                  className="px-3 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                >
                  {event.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium text-gray-900">
            📊 Subscriber Statistics
          </h3>
          <button
            onClick={refetchStats}
            disabled={statsLoading}
            className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {statsLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
        
        {stats ? (
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
              <div className="text-gray-600">Total Subscribers</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {stats.byStatus.active || 0}
              </div>
              <div className="text-gray-600">Active</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {stats.byStatus.unsubscribed || 0}
              </div>
              <div className="text-gray-600">Unsubscribed</div>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-4">
            {statsLoading ? 'Loading statistics...' : 'No statistics available'}
          </div>
        )}
      </div>

      {/* Debug Info */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-3">
          🐛 Debug Information
        </h3>
        
        <div className="text-xs text-gray-600 space-y-1">
          <div><strong>Email:</strong> {userEmail}</div>
          <div><strong>Name:</strong> {userName || 'Not provided'}</div>
          <div><strong>Current Tier:</strong> {userTier}</div>
          <div><strong>API Configured:</strong> {isConfigured ? 'Yes' : 'No'}</div>
          <div><strong>Last Sync:</strong> {isLoading ? 'In progress...' : 'Complete'}</div>
        </div>
      </div>
    </div>
  );
}
