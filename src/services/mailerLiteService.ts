/**
 * MailerLite Service
 * Handles subscriber management, events, and group segmentation
 * ✅ FIXED: Uses backend proxy to avoid CORS and API key exposure
 */

import { logger } from '../lib/logger';
import { supabase } from '../lib/supabaseClient';
import { getApiEndpoint } from '../utils/apiClient';
import { getAuthToken } from '../utils/getAuthToken';

export type MailerLiteEvent = 
  | 'user_signup'
  | 'first_message'
  | 'first_conversation'
  | 'tier_upgrade'
  | 'tier_downgrade'
  | 'monthly_limit_reached'
  | 'conversation_limit_reached'
  | 'feature_usage_milestone'
  | 'onboarding_complete'
  | 'subscription_cancelled'
  | 'subscription_reactivated';

export interface SubscriberData {
  email: string;
  name?: string;
  tier: 'free' | 'core' | 'studio' | 'complete';
  conversations_today?: number;
  total_conversations?: number;
  last_active?: string;
  signup_date?: string;
  subscription_status?: 'active' | 'cancelled' | 'past_due';
  custom_fields?: Record<string, any>;
}

interface TriggerEventParams {
  email: string;
  event: MailerLiteEvent;
  properties?: Record<string, any>;
}

class MailerLiteService {
  /**
   * Check if MailerLite is configured
   * Note: Configuration is now checked server-side via the proxy endpoint
   */
  isConfigured(): boolean {
    // Always return true - let backend handle configuration check
    // Backend will return { disabled: true } if not configured
    return true;
  }

  /**
   * Create or update subscriber
   * ✅ FIXED: Uses backend proxy to avoid CORS and API key exposure
   * ✅ FIXED: Checks authentication before attempting token refresh to prevent rate limits
   */
  async createOrUpdateSubscriber(data: SubscriberData): Promise<void> {
    try {
      // ✅ FIXED: Check if user is authenticated BEFORE trying to get token
      // This prevents rate limit loops when session is expired
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        logger.debug('[MailerLite] No session - skipping subscriber sync');
        return;
      }
      
      const token = await getAuthToken().catch(() => null);
      if (!token) {
        logger.debug('[MailerLite] Not authenticated - skipping subscriber sync');
        return;
      }

      const response = await fetch(getApiEndpoint('/api/mailerlite/proxy'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          operation: 'createOrUpdateSubscriber',
          data: {
            email: data.email,
            name: data.name,
            tier: data.tier,
            conversations_today: data.conversations_today,
            total_conversations: data.total_conversations,
            last_active: data.last_active,
            signup_date: data.signup_date,
            subscription_status: data.subscription_status,
            custom_fields: data.custom_fields,
          },
        }),
      });

      const result = await response.json().catch(() => ({}));
      
      if (result.disabled) {
        logger.debug('[MailerLite] Not configured on backend - skipping subscriber sync');
        return;
      }

      if (!response.ok || !result.success) {
        throw new Error(result.details || result.message || `MailerLite API error: ${response.status}`);
      }

      logger.debug(`[MailerLite] ✅ Subscriber ${data.email} synced successfully`);
    } catch (error) {
      logger.error('[MailerLite] Failed to sync subscriber:', error);
      // Don't throw - MailerLite failures shouldn't break the app
    }
  }

  /**
   * Update custom fields for subscriber
   * ✅ FIXED: Uses backend proxy to avoid CORS and API key exposure
   * ✅ FIXED: Checks authentication before attempting token refresh to prevent rate limits
   */
  async updateCustomFields(email: string, fields: Record<string, any>): Promise<void> {
    try {
      // ✅ FIXED: Check if user is authenticated BEFORE trying to get token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        logger.debug('[MailerLite] No session - skipping custom fields update');
        return;
      }
      
      const token = await getAuthToken().catch(() => null);
      if (!token) {
        logger.debug('[MailerLite] Not authenticated - skipping custom fields update');
        return;
      }

      const response = await fetch(getApiEndpoint('/api/mailerlite/proxy'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          operation: 'updateCustomFields',
          data: { email, fields },
        }),
      });

      const result = await response.json().catch(() => ({}));
      
      if (result.disabled) {
        logger.debug('[MailerLite] Not configured on backend - skipping custom fields update');
        return;
      }

      if (!response.ok || !result.success) {
        throw new Error(result.details || result.message || `MailerLite API error: ${response.status}`);
      }

      logger.debug(`[MailerLite] ✅ Custom fields updated for ${email}`);
    } catch (error) {
      logger.error('[MailerLite] Failed to update custom fields:', error);
      // Don't throw - MailerLite failures shouldn't break the app
    }
  }

  /**
   * Trigger event for subscriber
   * ✅ FIXED: Uses backend proxy to avoid CORS and API key exposure
   * ✅ FIXED: Checks authentication before attempting token refresh to prevent rate limits
   */
  async triggerEvent(params: TriggerEventParams): Promise<void> {
    try {
      // ✅ FIXED: Check if user is authenticated BEFORE trying to get token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        logger.debug('[MailerLite] No session - skipping event trigger');
        return;
      }
      
      const token = await getAuthToken().catch(() => null);
      if (!token) {
        logger.debug('[MailerLite] Not authenticated - skipping event trigger');
        return;
      }

      const response = await fetch(getApiEndpoint('/api/mailerlite/proxy'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          operation: 'triggerEvent',
          data: {
            email: params.email,
            event: params.event,
            properties: params.properties,
          },
        }),
      });

      const result = await response.json().catch(() => ({}));
      
      if (result.disabled) {
        logger.debug('[MailerLite] Not configured on backend - skipping event trigger');
        return;
      }

      if (!response.ok || !result.success) {
        throw new Error(result.details || result.message || `MailerLite API error: ${response.status}`);
      }

      logger.debug(`[MailerLite] ✅ Event ${params.event} triggered for ${params.email}`);
    } catch (error) {
      logger.error('[MailerLite] Failed to trigger event:', error);
      // Don't throw - MailerLite failures shouldn't break the app
    }
  }

  /**
   * Add subscriber to group
   * ✅ FIXED: Uses backend proxy to avoid CORS and API key exposure
   * ✅ FIXED: Checks authentication before attempting token refresh to prevent rate limits
   */
  async segmentSubscriber(email: string, groupName: string): Promise<void> {
    try {
      // ✅ FIXED: Check if user is authenticated BEFORE trying to get token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        logger.debug('[MailerLite] No session - skipping group segment');
        return;
      }
      
      const token = await getAuthToken().catch(() => null);
      if (!token) {
        logger.debug('[MailerLite] Not authenticated - skipping group segment');
        return;
      }

      const response = await fetch(getApiEndpoint('/api/mailerlite/proxy'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          operation: 'segmentSubscriber',
          data: { email, groupName },
        }),
      });

      const result = await response.json().catch(() => ({}));
      
      if (result.disabled) {
        logger.debug('[MailerLite] Not configured on backend - skipping group segment');
        return;
      }

      // Don't fail if group doesn't exist (404 handled by backend)
      if (!response.ok && response.status !== 404 && !result.success) {
        throw new Error(result.details || result.message || `MailerLite API error: ${response.status}`);
      }

      logger.debug(`[MailerLite] ✅ Added ${email} to group ${groupName}`);
    } catch (error) {
      logger.error('[MailerLite] Failed to add subscriber to group:', error);
      // Don't throw - MailerLite failures shouldn't break the app
    }
  }

  /**
   * Remove subscriber from group
   * ✅ FIXED: Uses backend proxy to avoid CORS and API key exposure
   * ✅ FIXED: Checks authentication before attempting token refresh to prevent rate limits
   */
  async removeFromGroup(email: string, groupName: string): Promise<void> {
    try {
      // ✅ FIXED: Check if user is authenticated BEFORE trying to get token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        logger.debug('[MailerLite] No session - skipping group removal');
        return;
      }
      
      const token = await getAuthToken().catch(() => null);
      if (!token) {
        logger.debug('[MailerLite] Not authenticated - skipping group removal');
        return;
      }

      const response = await fetch(getApiEndpoint('/api/mailerlite/proxy'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          operation: 'removeFromGroup',
          data: { email, groupName },
        }),
      });

      const result = await response.json().catch(() => ({}));
      
      if (result.disabled) {
        logger.debug('[MailerLite] Not configured on backend - skipping group removal');
        return;
      }

      // Don't fail if group doesn't exist (404 handled by backend)
      if (!response.ok && response.status !== 404 && !result.success) {
        throw new Error(result.details || result.message || `MailerLite API error: ${response.status}`);
      }

      logger.debug(`[MailerLite] ✅ Removed ${email} from group ${groupName}`);
    } catch (error) {
      logger.error('[MailerLite] Failed to remove subscriber from group:', error);
      // Don't throw - MailerLite failures shouldn't break the app
    }
  }
}

export const mailerLiteService = new MailerLiteService();

