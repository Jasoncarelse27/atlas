// src/types/atlas.ts
// Atlas Application Type Definitions

/**
 * User subscription tiers for Atlas
 */
export type Tier = 'free' | 'core' | 'studio';

/**
 * Subscription status
 */
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing';

/**
 * User profile interface
 */
export interface Profile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
  subscription_tier: Tier;
  subscription_status: SubscriptionStatus;
  subscription_id?: string;
  trial_ends_at?: string;
  first_payment_date?: string;
  last_reset_date: string;
  paddle_customer_id?: string;
}

/**
 * Feature access configuration
 */
export interface FeatureAccess {
  canUse: boolean;
  attemptFeature: () => Promise<boolean>;
  restrictionMessage?: string;
}

/**
 * Paddle product configuration
 */
export interface PaddleProduct {
  productId?: string;
  planId?: string;
  priceId: string;
  price: number;
}

/**
 * Paddle configuration
 */
export interface PaddleConfig {
  environment: 'sandbox' | 'live';
  vendorId?: string;
  apiKey?: string;
  publicKey?: string;
  webhookSecret?: string;
  products: {
    core: PaddleProduct;
    studio: PaddleProduct;
  };
  cacheTimeout: number;
}

/**
 * Webhook event types from Paddle
 */
export type PaddleEventType = 
  | 'transaction.completed'
  | 'subscription.canceled'
  | 'subscription.updated'
  | 'subscription.paused'
  | 'subscription.resumed';

/**
 * Paddle webhook event
 */
export interface PaddleWebhookEvent {
  event_type: PaddleEventType;
  data: {
    id: string;
    customer_id: string;
    items?: Array<{
      price: {
        id: string;
      };
    }>;
  };
}

/**
 * Feature types for upgrade modals
 */
export type FeatureType = 'voice' | 'image' | 'advanced';

/**
 * Upgrade modal configuration
 */
export interface UpgradeModalConfig {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  benefits: string[];
}

/**
 * Toast action configuration
 */
export interface ToastAction {
  label: string;
  onClick: () => void;
}

/**
 * Toast notification configuration
 */
export interface ToastConfig {
  message: string;
  action?: ToastAction;
  duration?: number;
}

/**
 * Audio event types for analytics
 */
export type AudioEventType = 
  | 'recording_start'
  | 'recording_stop'
  | 'transcription_success'
  | 'transcription_fail'
  | 'tts_playback_start'
  | 'tts_playback_stop';

/**
 * Image event types for analytics
 */
export type ImageEventType =
  | 'upload_start'
  | 'upload_success'
  | 'upload_fail'
  | 'analysis_start'
  | 'analysis_success'
  | 'analysis_fail';

/**
 * Analytics event
 */
export interface AnalyticsEvent {
  event_type: AudioEventType | ImageEventType;
  user_id: string;
  session_id?: string;
  timestamp: string;
  props: {
    tier: Tier;
    [key: string]: any;
  };
}

/**
 * Usage tracking data
 */
export interface UsageData {
  conversations_count: number;
  total_tokens_used: number;
  api_cost_estimate: number;
  last_updated: string;
}

/**
 * Response cache entry
 */
export interface CacheEntry {
  id: string;
  user_id: string;
  prompt_hash: string;
  response: string;
  tokens_used: number;
  created_at: string;
  expires_at: string;
}

/**
 * Health check response
 */
export interface HealthCheck {
  ok: boolean;
  timestamp: string;
  services: {
    supabase: boolean;
    paddle?: boolean;
    ai?: boolean;
  };
  error?: string;
}
