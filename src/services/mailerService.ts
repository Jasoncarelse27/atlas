// 📩 Atlas AI – MailerLite Integration Service
// Central service for managing MailerLite subscriber data and event triggers

import { createChatError } from '../features/chat/lib/errorHandler';

// Environment variable helper
const getEnvVar = (key: string): string => {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || '';
  }
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key] || '';
  }
  return '';
};

// MailerLite API configuration
const MAILERLITE_API_KEY = getEnvVar('VITE_MAILERLITE_API_KEY');
const MAILERLITE_API_BASE = 'https://api.mailerlite.com/api/v2';

// Atlas tier mapping to MailerLite groups
const TIER_GROUP_MAPPING = {
  free: 'atlas_free_users',
  core: 'atlas_premium_monthly',
  studio: 'atlas_premium_yearly',
  complete: 'atlas_complete_bundle',
} as const;

// Event types for automation triggers
export type MailerLiteEvent = 
  | 'user_signup'
  | 'first_conversation'
  | 'conversation_limit_reached'
  | 'tier_upgrade'
  | 'tier_downgrade'
  | 'subscription_cancelled'
  | 'subscription_reactivated'
  | 'inactive_user'
  | 'feature_usage_milestone'
  | 'onboarding_complete';

// Subscriber data interface
export interface SubscriberData {
  email: string;
  name?: string;
  tier: keyof typeof TIER_GROUP_MAPPING;
  conversations_today?: number;
  total_conversations?: number;
  last_active?: string;
  signup_date?: string;
  subscription_status?: 'active' | 'cancelled' | 'past_due';
  custom_fields?: Record<string, any>;
}

// Event trigger interface
export interface EventTrigger {
  email: string;
  event: MailerLiteEvent;
  properties?: Record<string, any>;
  timestamp?: string;
}

// API response interfaces
export interface MailerLiteResponse<T = any> {
  data: T;
  message?: string;
  error?: string;
}

export interface SubscriberResponse {
  id: string;
  email: string;
  status: 'active' | 'unsubscribed' | 'unconfirmed';
  groups: string[];
  custom_fields: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// Main service object following your preferred structure
export const mailerService = {
  /**
   * Check if service is properly configured
   */
  isConfigured(): boolean {
    return !!MAILERLITE_API_KEY;
  },

  /**
   * Create or update subscriber
   */
  async createOrUpdateSubscriber(payload: SubscriberData) {
    try {
      if (!this.isConfigured()) {
        throw new Error('MailerLite service not configured');
      }

      const res = await fetch(`${MAILERLITE_API_BASE}/subscribers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MailerLite-ApiKey': MAILERLITE_API_KEY,
        },
        body: JSON.stringify({
          email: payload.email,
          name: payload.name || '',
          fields: {
            tier: payload.tier,
            conversations_today: payload.conversations_today || 0,
            total_conversations: payload.total_conversations || 0,
            last_active: payload.last_active || new Date().toISOString(),
            signup_date: payload.signup_date || new Date().toISOString(),
            subscription_status: payload.subscription_status || 'active',
            ...payload.custom_fields,
          },
          resubscribe: true,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${res.status}: ${res.statusText}`);
      }

      const result = await res.json();
      
      // Automatically segment subscriber into correct group
      if (payload.tier) {
        await this.segmentSubscriber({
          email: payload.email,
          groupName: TIER_GROUP_MAPPING[payload.tier],
        });
      }

      return result;
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'createOrUpdateSubscriber',
        email: payload.email,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  },

  /**
   * Trigger event for automation
   */
  async triggerEvent({ email, event, properties = {} }: EventTrigger) {
    try {
      if (!this.isConfigured()) {
        throw new Error('MailerLite service not configured');
      }

      const res = await fetch(`${MAILERLITE_API_BASE}/subscribers/${email}/actions/${event}`, {
        method: 'POST',
        headers: {
          'X-MailerLite-ApiKey': MAILERLITE_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: {
            ...properties,
            timestamp: properties.timestamp || new Date().toISOString(),
            source: 'atlas_ai',
          },
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${res.status}: ${res.statusText}`);
      }

      return await res.json();
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'triggerEvent',
        email,
        event,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  },

  /**
   * Segment subscriber into specific group
   */
  async segmentSubscriber({ email, groupName }: { email: string; groupName: string }) {
    try {
      if (!this.isConfigured()) {
        throw new Error('MailerLite service not configured');
      }

      const res = await fetch(`${MAILERLITE_API_BASE}/groups/${groupName}/subscribers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MailerLite-ApiKey': MAILERLITE_API_KEY,
        },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${res.status}: ${res.statusText}`);
      }

      return await res.json();
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'segmentSubscriber',
        email,
        groupName,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  },

  /**
   * Update subscriber custom fields
   */
  async updateCustomFields(email: string, customFields: Record<string, any>) {
    try {
      if (!this.isConfigured()) {
        throw new Error('MailerLite service not configured');
      }

      const res = await fetch(`${MAILERLITE_API_BASE}/subscribers/${email}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-MailerLite-ApiKey': MAILERLITE_API_KEY,
        },
        body: JSON.stringify({
          fields: customFields,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${res.status}: ${res.statusText}`);
      }

      return await res.json();
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'updateCustomFields',
        email,
        customFields,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  },

  /**
   * Get subscriber statistics
   */
  async getSubscriberStats() {
    try {
      if (!this.isConfigured()) {
        throw new Error('MailerLite service not configured');
      }

      const res = await fetch(`${MAILERLITE_API_BASE}/subscribers`, {
        headers: {
          'X-MailerLite-ApiKey': MAILERLITE_API_KEY,
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      
      const stats = {
        total: data.data?.length || 0,
        byTier: {} as Record<string, number>,
        byStatus: {} as Record<string, number>,
      };

      if (data.data && data.data.length > 0) {
        data.data.forEach((subscriber: any) => {
          const tier = subscriber.fields?.tier || 'unknown';
          const status = subscriber.status;
          
          stats.byTier[tier] = (stats.byTier[tier] || 0) + 1;
          stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
        });
      }

      return stats;
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'getSubscriberStats',
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  },

  /**
   * Remove subscriber from group
   */
  async removeFromGroup({ email, groupName }: { email: string; groupName: string }) {
    try {
      if (!this.isConfigured()) {
        throw new Error('MailerLite service not configured');
      }

      const res = await fetch(`${MAILERLITE_API_BASE}/groups/${groupName}/subscribers/${email}`, {
        method: 'DELETE',
        headers: {
          'X-MailerLite-ApiKey': MAILERLITE_API_KEY,
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${res.status}: ${res.statusText}`);
      }

      return await res.json();
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'removeFromGroup',
        email,
        groupName,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  },
};

// Export the service and types
export const mailerLiteService = mailerService;
export default mailerService;
