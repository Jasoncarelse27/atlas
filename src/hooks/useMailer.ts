import { useCallback, useEffect, useRef, useState } from 'react';
import { isPaidTier } from '../config/featureAccess';
import { createChatError } from '../features/chat/lib/errorHandler';
import { mailerLiteService, type MailerLiteEvent, type SubscriberData } from '../services/mailerService';
import { logger } from '../lib/logger';

// Hook configuration interface
interface UseMailerConfig {
  email: string;
  name?: string;
  tier: 'free' | 'core' | 'studio' | 'complete';
  autoSync?: boolean;
  onError?: (error: Error) => void;
  onSuccess?: (operation: string) => void;
}

// Hook return interface
interface UseMailerReturn {
  // Subscriber management
  syncSubscriber: (data?: Partial<SubscriberData>) => Promise<void>;
  updateTier: (newTier: SubscriberData['tier']) => Promise<void>;
  updateUsage: (conversationsToday: number, totalConversations: number) => Promise<void>;
  
  // Event triggering
  triggerEvent: (event: MailerLiteEvent, properties?: Record<string, any>) => Promise<void>;
  
  // Group management
  addToGroup: (groupName: string) => Promise<void>;
  removeFromGroup: (groupName: string) => Promise<void>;
  
  // Status and configuration
  isConfigured: boolean;
  isLoading: boolean;
  lastError: Error | null;
  
  // Utility functions
  resetError: () => void;
}

/**
 * Hook for MailerLite integration and automation
 * Automatically syncs user data and triggers events based on app state
 */
export function useMailer(config: UseMailerConfig): UseMailerReturn {
  const { email, name, tier, autoSync = true, onError, onSuccess } = config;
  
  // State refs to avoid unnecessary re-renders
  const isLoadingRef = useRef(false);
  const lastErrorRef = useRef<Error | null>(null);
  
  // ✅ STABILITY: Cooldown and in-flight guards to prevent spam calls
  const lastSyncRef = useRef<number | null>(null);
  const syncInFlightRef = useRef(false);
  
  // Check if service is configured
  const isConfigured = mailerLiteService.isConfigured();

  // Error handler
  const handleError = useCallback((error: Error, operation: string) => {
    const chatError = createChatError(error, {
      operation,
      email,
      timestamp: new Date().toISOString(),
    });
    
    lastErrorRef.current = chatError;
    onError?.(chatError);
    
  }, [email, onError]);

  // Success handler
  const handleSuccess = useCallback((operation: string) => {
    onSuccess?.(operation);
    lastErrorRef.current = null;
  }, [onSuccess]);

  // Sync subscriber data
  const syncSubscriber = useCallback(async (data?: Partial<SubscriberData>) => {
    if (!isConfigured || !email) return;

    try {
      isLoadingRef.current = true;
      
      const subscriberData: SubscriberData = {
        email,
        name: name || data?.name,
        tier: data?.tier || tier,
        conversations_today: data?.conversations_today,
        total_conversations: data?.total_conversations,
        last_active: new Date().toISOString(),
        signup_date: data?.signup_date || new Date().toISOString(),
        subscription_status: data?.subscription_status || 'active',
        custom_fields: data?.custom_fields,
      };

      await mailerLiteService.createOrUpdateSubscriber(subscriberData);
      handleSuccess('subscriber_sync');
    } catch (error) {
      // Intentionally empty - error handling not required
      handleError(error instanceof Error ? error : new Error('Unknown error'), 'subscriber_sync');
    } finally {
      isLoadingRef.current = false;
    }
  }, [isConfigured, email, name, tier, handleError, handleSuccess]);

  // Update user tier
  const updateTier = useCallback(async (newTier: SubscriberData['tier']) => {
    if (!isConfigured || !email) return;

    try {
      isLoadingRef.current = true;
      
      // Update subscriber with new tier
      await mailerLiteService.createOrUpdateSubscriber({
        email,
        tier: newTier,
        last_active: new Date().toISOString(),
      });

      // Trigger tier change event
      const eventType: MailerLiteEvent = newTier === 'free' ? 'tier_downgrade' : 'tier_upgrade';
      await mailerLiteService.triggerEvent({
        email,
        event: eventType,
        properties: {
          previous_tier: tier,
          new_tier: newTier,
          timestamp: new Date().toISOString(),
        },
      });

      handleSuccess('tier_update');
    } catch (error) {
      // Intentionally empty - error handling not required
      handleError(error instanceof Error ? error : new Error('Unknown error'), 'tier_update');
    } finally {
      isLoadingRef.current = false;
    }
  }, [isConfigured, email, tier, handleError, handleSuccess]);

  // Update usage statistics
  const updateUsage = useCallback(async (conversationsToday: number, totalConversations: number) => {
    if (!isConfigured || !email) return;

    try {
      isLoadingRef.current = true;
      
      // Update subscriber with new usage data
      await mailerLiteService.updateCustomFields(email, {
        conversations_today: conversationsToday,
        total_conversations: totalConversations,
        last_active: new Date().toISOString(),
      });

      // ✅ Check for conversation limit reached (free tier: 2/day)
      if (!isPaidTier(tier) && conversationsToday >= 2) {
        await mailerLiteService.triggerEvent({
          email,
          event: 'conversation_limit_reached',
          properties: {
            conversations_today: conversationsToday,
            tier_limit: 2,
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Check for usage milestones
      if (totalConversations === 1) {
        await mailerLiteService.triggerEvent({
          email,
          event: 'first_conversation',
          properties: {
            total_conversations: totalConversations,
            timestamp: new Date().toISOString(),
          },
        });
      } else if (totalConversations % 10 === 0) {
        // Every 10 conversations
        await mailerLiteService.triggerEvent({
          email,
          event: 'feature_usage_milestone',
          properties: {
            milestone: totalConversations,
            conversations_today: conversationsToday,
            timestamp: new Date().toISOString(),
          },
        });
      }

      handleSuccess('usage_update');
    } catch (error) {
      // Intentionally empty - error handling not required
      handleError(error instanceof Error ? error : new Error('Unknown error'), 'usage_update');
    } finally {
      isLoadingRef.current = false;
    }
  }, [isConfigured, email, tier, handleError, handleSuccess]);

  // Trigger custom event
  const triggerEvent = useCallback(async (event: MailerLiteEvent, properties?: Record<string, any>) => {
    if (!isConfigured || !email) return;

    try {
      isLoadingRef.current = true;
      
      await mailerLiteService.triggerEvent({
        email,
        event,
        properties: {
          ...properties,
          timestamp: new Date().toISOString(),
        },
      });

      handleSuccess(`event_trigger_${event}`);
    } catch (error) {
      // Intentionally empty - error handling not required
      handleError(error instanceof Error ? error : new Error('Unknown error'), `event_trigger_${event}`);
    } finally {
      isLoadingRef.current = false;
    }
  }, [isConfigured, email, handleError, handleSuccess]);

  // Add subscriber to group
  const addToGroup = useCallback(async (groupName: string) => {
    if (!isConfigured || !email) return;

    try {
      isLoadingRef.current = true;
      
      await mailerLiteService.segmentSubscriber(email, groupName);
      handleSuccess(`add_to_group_${groupName}`);
    } catch (error) {
      // Intentionally empty - error handling not required
      handleError(error instanceof Error ? error : new Error('Unknown error'), `add_to_group_${groupName}`);
    } finally {
      isLoadingRef.current = false;
    }
  }, [isConfigured, email, handleError, handleSuccess]);

  // Remove subscriber from group
  const removeFromGroup = useCallback(async (groupName: string) => {
    if (!isConfigured || !email) return;

    try {
      isLoadingRef.current = true;
      
      await mailerLiteService.removeFromGroup(email, groupName);
      handleSuccess(`remove_from_group_${groupName}`);
    } catch (error) {
      // Intentionally empty - error handling not required
      handleError(error instanceof Error ? error : new Error('Unknown error'), `remove_from_group_${groupName}`);
    } finally {
      isLoadingRef.current = false;
    }
  }, [isConfigured, email, handleError, handleSuccess]);

  // Reset error state
  const resetError = useCallback(() => {
    lastErrorRef.current = null;
  }, []);

  // ✅ FIX: Track last synced values to prevent infinite loops
  // Only sync when email/name/tier actually change, not when callback reference changes
  const lastSyncedRef = useRef<{ email?: string; name?: string; tier?: string }>({});
  const syncSubscriberRef = useRef(syncSubscriber);
  
  // Keep ref updated with latest syncSubscriber function
  useEffect(() => {
    syncSubscriberRef.current = syncSubscriber;
  }, [syncSubscriber]);
  
  // ✅ STABILITY: Auto-sync with cooldown and in-flight guard
  useEffect(() => {
    if (!autoSync) return;
    if (!email || !name || !tier) return;

    const now = Date.now();
    const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

    // Respect cooldown
    if (lastSyncRef.current && now - lastSyncRef.current < COOLDOWN_MS) {
      logger.debug('[MailerLite] Skipping sync due to cooldown', {
        lastSyncAt: new Date(lastSyncRef.current).toISOString(),
      });
      return;
    }

    // Prevent concurrent syncs
    if (syncInFlightRef.current) {
      logger.debug('[MailerLite] Sync already in flight, skipping.');
      return;
    }

    // Only sync if email, name, or tier actually changed
    const lastSynced = lastSyncedRef.current;
    const hasChanged = 
      lastSynced.email !== email ||
      lastSynced.name !== name ||
      lastSynced.tier !== tier;
    
    if (!hasChanged) {
      return; // No change, skip sync
    }

    lastSyncedRef.current = { email, name, tier };
    syncInFlightRef.current = true;
    
    syncSubscriberRef.current({ email, name, tier })
      .then(() => {
        lastSyncRef.current = Date.now();
        logger.info('[MailerLite] Subscriber synced successfully');
      })
      .catch((err) => {
        logger.warn('[MailerLite] Failed to sync subscriber', { err });
      })
      .finally(() => {
        syncInFlightRef.current = false;
      });
  }, [email, name, tier, autoSync]);

  // Auto-trigger signup event on first sync
  useEffect(() => {
    if (autoSync && isConfigured && email) {
      // Trigger signup event (only once per session)
      const hasTriggeredSignup = sessionStorage.getItem(`mailer_signup_${email}`);
      if (!hasTriggeredSignup) {
        triggerEvent('user_signup', {
          tier,
          signup_date: new Date().toISOString(),
        });
        sessionStorage.setItem(`mailer_signup_${email}`, 'true');
      }
    }
  }, [autoSync, isConfigured, email, tier, triggerEvent]);

  return {
    // Subscriber management
    syncSubscriber,
    updateTier,
    updateUsage,
    
    // Event triggering
    triggerEvent,
    
    // Group management
    addToGroup,
    removeFromGroup,
    
    // Status and configuration
    isConfigured,
    isLoading: isLoadingRef.current,
    lastError: lastErrorRef.current,
    
    // Utility functions
    resetError,
  };
}

/**
 * Hook for triggering MailerLite events without subscriber management
 * Useful for one-off event triggers
 */
export function useMailerEvents(email: string) {
  const isConfigured = mailerLiteService.isConfigured();

  const triggerEvent = useCallback(async (event: MailerLiteEvent, properties?: Record<string, any>) => {
    if (!isConfigured || !email) return;

    try {
      await mailerLiteService.triggerEvent({
        email,
        event,
        properties: {
          ...properties,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      // Intentionally empty - error handling not required
    }
  }, [isConfigured, email]);

  return {
    triggerEvent,
    isConfigured,
  };
}

/**
 * Hook for MailerLite subscriber statistics
 * Useful for admin dashboards
 */
export function useMailerStats() {
  const [stats, setStats] = useState<{
    total: number;
    byTier: Record<string, number>;
    byStatus: Record<string, number>;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchStats = useCallback(async () => {
    if (!mailerLiteService.isConfigured()) return;

    try {
      setIsLoading(true);
      setError(null);
      
      const statsData = await mailerLiteService.getSubscriberStats();
      setStats(statsData);
    } catch (err) {
      // Intentionally empty - error handling not required
      const error = err instanceof Error ? err : new Error('Failed to fetch stats');
      setError(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    isLoading,
    error,
    refetch: fetchStats,
  };
}
