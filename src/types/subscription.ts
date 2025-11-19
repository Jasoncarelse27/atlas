// src/types/subscription.ts - ATLAS V1 CHAT-FOCUSED SYSTEM

export interface UserProfile {
  id: string;
  tier: 'free' | 'core' | 'studio';
  trial_ends_at: string | null;
  subscription_status: 'trial' | 'active' | 'expired' | 'cancelled';
  subscription_id: string | null;
  usage_stats: {
    text_messages_this_month: number;
    audio_minutes_this_month: number;
    image_uploads_this_month: number;
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
  remaining?: {
    text_messages?: number;
    audio_minutes?: number;
    image_uploads?: number;
  };
}

export interface TierLimits {
  text_messages_per_month: number; // -1 for unlimited
  audio_minutes_per_month: number; // -1 for unlimited
  image_uploads_per_month: number; // -1 for unlimited
  features: string[];
  ai_model: 'claude_haiku' | 'claude_sonnet' | 'claude_opus';
  priority_processing: boolean;
  memory_persistence: boolean;
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
  currency?: 'USD';
}

export const TIER_CONFIGS: Record<string, TierInfo> = {
  free: {
    name: 'free',
    displayName: 'Atlas Free',
    description: 'Basic AI conversations with emotional intelligence focus',
    price: '$0/month',
    currency: 'USD',
    limits: {
      text_messages_per_month: 15,
      audio_minutes_per_month: 0,
      image_uploads_per_month: 0,
      features: ['basic_chat'],
      ai_model: 'claude_haiku',
      priority_processing: false,
      memory_persistence: false
    },
    features: [
      '15 AI conversations per month',
      'Claude Haiku - Fast, cost-effective responses',
      'Session-only memory',
      'Standard response time',
      'Basic emotional intelligence tips'
    ]
  },
  core: {
    name: 'core',
    displayName: 'Atlas Core',
    description: 'Unlimited conversations with persistent memory and voice features',
    price: '$19.99/month',
    yearlyPrice: '$199.99/year',
    currency: 'USD',
    limits: {
      text_messages_per_month: -1, // Unlimited
      audio_minutes_per_month: 60,
      image_uploads_per_month: 10,
      features: ['unlimited_chat', 'voice_input', 'voice_output', 'image_analysis', 'persistent_memory'],
      ai_model: 'claude_sonnet',
      priority_processing: false,
      memory_persistence: true
    },
    features: [
      'Unlimited AI conversations',
      'Claude Sonnet - Better reasoning and coaching',
      'Persistent memory across sessions',
      'Voice input and output (60 min/month)',
      'Image analysis (10 uploads/month)',
      'Standard response quality'
    ],
    popular: true
  },
  studio: {
    name: 'studio',
    displayName: 'Atlas Studio',
    description: 'Premium AI with advanced emotional intelligence and priority processing',
    price: '$149.99/month', // ✅ CORRECTED: Updated from $189.99 - Consider importing from pricing.ts
    yearlyPrice: '$1499.99/year', // ✅ Updated: ~10% discount for yearly
    currency: 'USD',
    limits: {
      text_messages_per_month: -1, // Unlimited
      audio_minutes_per_month: -1, // Unlimited
      image_uploads_per_month: -1, // Unlimited
      features: ['unlimited_chat', 'unlimited_voice', 'unlimited_images', 'voice_emotion_analysis', 'advanced_ai_models', 'priority_processing', 'advanced_coaching', 'facial_emotion_analysis'],
      ai_model: 'claude_opus',
      priority_processing: true,
      memory_persistence: true
    },
    features: [
      'Everything in Core',
      'Claude Opus - Most advanced emotional intelligence',
      'Unlimited voice conversations',
      'Unlimited image analysis',
      'Voice emotion analysis',
      'Priority processing queue',
      'Real-time emotional coaching',
      'Facial expression analysis',
      'Advanced emotional insights',
      'Future: Custom personality tuning'
    ]
  }
};

// AI Model allocation by tier
export const AI_MODELS = {
  free: 'claude-3-5-haiku-latest', // ✅ Billing-enabled model
  core: 'claude-sonnet-4-5-20250929', // ✅ Works (4.x models don't return usage, backend estimates)
  studio: 'claude-sonnet-4-5-20250929' // ✅ Works (4.x models don't return usage, backend estimates)
};

// Hard limits for cost protection
export const HARD_LIMITS = {
  FREE_TIER: { 
    textMessages: 15, 
    audioMinutes: 0, 
    imageUploads: 0 
  },
  CORE_TIER: { 
    textMessages: -1, 
    audioMinutes: 60, 
    imageUploads: 10 
  },
  STUDIO_TIER: { 
    textMessages: -1, 
    audioMinutes: -1, 
    imageUploads: -1 
  }
};

// Cost protection settings
export const COST_PROTECTION = {
  max_tokens_per_response: {
    free: 1000,    // Haiku is cheaper, can afford more tokens
    core: 2000,    // Sonnet balance
    studio: 4000   // Opus is expensive, but justified by price
  },
  daily_spending_cap: {
    free: 0.50,    // $0.50 per day max
    core: 2.00,    // $2.00 per day max  
    studio: 10.00  // $10.00 per day max
  },
  emergency_killswitch_threshold: 100.00 // $100 total daily spend
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