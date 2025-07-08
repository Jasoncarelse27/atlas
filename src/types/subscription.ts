// src/types/subscription.ts

export interface UserProfile {
  id: string;
  tier: 'basic' | 'standard' | 'pro';
  trial_ends_at: string | null;
  subscription_status: 'trial' | 'active' | 'expired' | 'cancelled';
  subscription_id: string | null;
  usage_stats: {
    requests_this_month: number;
    audio_minutes_this_month: number;
    storage_used_mb: number;
    last_reset_date: string | null;
  };
  created_at: string;
  updated_at: string;
}

export interface TierLimits {
  requests_per_month: number; // -1 for unlimited
  audio_minutes_per_month: number; // -1 for unlimited
  storage_limit_mb: number;
  features: string[];
}

export interface TierInfo {
  name: string;
  displayName: string;
  description: string;
  price: string;
  limits: TierLimits;
  features: string[];
  popular?: boolean;
}

export const TIER_CONFIGS: Record<string, TierInfo> = {
  basic: {
    name: 'basic',
    displayName: 'Basic',
    description: '7-day free trial with essential features',
    price: 'Free Trial',
    limits: {
      requests_per_month: 100,
      audio_minutes_per_month: 30,
      storage_limit_mb: 100,
      features: ['voice', 'text']
    },
    features: [
      'Voice conversations',
      'Text chat',
      '100 requests per month',
      '30 minutes of audio',
      '100MB storage',
      '7-day free trial'
    ]
  },
  standard: {
    name: 'standard',
    displayName: 'Standard',
    description: 'Perfect for regular users with more features',
    price: '$19/month',
    limits: {
      requests_per_month: 1000,
      audio_minutes_per_month: 300,
      storage_limit_mb: 1000,
      features: ['voice', 'text', 'image']
    },
    features: [
      'Everything in Basic',
      'Image analysis',
      '1,000 requests per month',
      '5 hours of audio',
      '1GB storage',
      'Priority support',
      'Advanced AI models'
    ],
    popular: true
  },
  pro: {
    name: 'pro',
    displayName: 'Pro',
    description: 'Unlimited access for power users',
    price: '$49/month',
    limits: {
      requests_per_month: -1, // Unlimited
      audio_minutes_per_month: -1, // Unlimited
      storage_limit_mb: 10000,
      features: ['voice', 'text', 'image', 'advanced_ai', 'priority_support']
    },
    features: [
      'Everything in Standard',
      'Unlimited requests',
      'Unlimited audio',
      '10GB storage',
      'Advanced AI models (GPT-4)',
      'Priority support',
      'Usage analytics',
      'API access',
      'Custom integrations'
    ]
  }
};

export interface UsageCheck {
  allowed: boolean;
  reason?: string;
  tier?: string;
  limits?: TierLimits;
  usage?: UserProfile['usage_stats'];
}