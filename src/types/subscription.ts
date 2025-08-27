// src/types/subscription.ts

export interface UserProfile {
  id: string;
  tier: 'free' | 'pro' | 'pro_max';
  trial_ends_at: string | null;
  subscription_status: 'trial' | 'active' | 'expired' | 'cancelled';
  subscription_id: string | null;
  usage_stats: {
    mood_tracking_days: number;
    emotional_insights_this_month: number;
    journal_entries_this_month: number;
    ai_prompts_this_month: number;
    streak_days: number;
    last_reset_date: string | null;
  };
  created_at: string;
  updated_at: string;
  // Add refund-related fields
  first_payment_date?: string | null;
  refund_eligible_until?: string | null;
  refund_requested?: boolean;
  refund_processed?: boolean;
}

export interface UsageCheck {
  allowed: boolean;
  reason?: string;
  tier?: string;
  limits?: TierLimits;
  usage?: UserProfile['usage_stats'];
}

export interface TierLimits {
  mood_tracking_days_per_month: number; // -1 for unlimited
  emotional_insights_per_month: number; // -1 for unlimited
  journal_entries_per_month: number; // -1 for unlimited
  ai_prompts_per_day: number; // -1 for unlimited
  features: string[];
}

export interface TierInfo {
  name: string;
  displayName: string;
  description: string;
  price: string;
  yearlyPrice?: string;
  limits: TierLimits;
  features: string[];
  popular?: boolean;
  currency?: 'ZAR' | 'USD';
}

export const TIER_CONFIGS: Record<string, TierInfo> = {
  free: {
    name: 'free',
    displayName: 'Free',
    description: 'Always-on access with basic emotional wellness features',
    price: 'Free',
    currency: 'ZAR',
    limits: {
      mood_tracking_days_per_month: 30,
      emotional_insights_per_month: 3,
      journal_entries_per_month: 5,
      ai_prompts_per_day: 5,
      features: ['mood_tracking', 'basic_insights', 'journal', 'limited_ai', 'light_streaks']
    },
    features: [
      'Daily mood tracking',
      '3 basic emotional insights per month',
      'Journal (5 entries/month)',
      'Limited AI interaction (5 prompts/day)',
      'Light streak system',
      'Basic emotional wellness tools'
    ]
  },
  pro: {
    name: 'pro',
    displayName: 'Pro',
    description: 'Advanced emotional wellness with unlimited features',
    price: 'R149/month',
    yearlyPrice: 'R999/year',
    currency: 'ZAR',
    limits: {
      mood_tracking_days_per_month: -1, // Unlimited
      emotional_insights_per_month: -1, // Unlimited
      journal_entries_per_month: -1, // Unlimited
      ai_prompts_per_day: -1, // Unlimited
      features: ['mood_tracking', 'unlimited_insights', 'unlimited_journal', 'unlimited_ai', 'advanced_streaks', 'emotional_summaries', 'custom_prompts', 'weekly_maps', 'stripe_bundle', 'priority_support']
    },
    features: [
      'Everything in Free',
      'Unlimited journaling & insights',
      'Advanced streak system (bonuses)',
      'Personalized emotional summaries',
      'Custom prompts & reflections',
      'Weekly emotional maps',
      'Access to 1 Stripe bundle (rotating)',
      'Priority support',
      'Unlimited AI interaction'
    ],
    popular: true
  },
  pro_max: {
    name: 'pro_max',
    displayName: 'Pro Max',
    description: 'Premium emotional wellness with advanced analytics',
    price: 'R299/month',
    yearlyPrice: 'R1799/year',
    currency: 'ZAR',
    limits: {
      mood_tracking_days_per_month: -1, // Unlimited
      emotional_insights_per_month: -1, // Unlimited
      journal_entries_per_month: -1, // Unlimited
      ai_prompts_per_day: -1, // Unlimited
      features: ['mood_tracking', 'unlimited_insights', 'unlimited_journal', 'unlimited_ai', 'advanced_streaks', 'emotional_summaries', 'custom_prompts', 'weekly_maps', 'stripe_bundle', 'priority_support', 'advanced_analytics', 'ai_coaching', 'custom_integrations']
    },
    features: [
      'Everything in Pro',
      'Advanced emotional analytics',
      'AI-powered emotional coaching',
      'Custom integrations',
      'Premium emotional insights',
      'Advanced streak rewards',
      'Priority customer support',
      'Early access to new features'
    ]
  }
};

// Refund policy types
export interface RefundPolicy {
  eligible_days: number;
  conditions: string[];
  process_time: string;
  contact_method: string;
}

export const REFUND_POLICY: RefundPolicy = {
  eligible_days: 7,
  conditions: [
    'Full refund within 7 days of first payment',
    'No questions asked policy',
    'Refund processed within 3-5 business days',
    'Contact support@atlas.com for refund requests'
  ],
  process_time: '3-5 business days',
  contact_method: 'support@atlas.com'
};