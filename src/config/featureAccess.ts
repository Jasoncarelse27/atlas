// src/config/featureAccess.ts
// Atlas Usage Management System - Revenue Protection & Cost Control

import type { Tier } from '../types/tier';

// Runtime tier values (for runtime usage)
export const TIER_VALUES = ['free', 'core', 'studio'] as const;

// 🎯 ATLAS SUBSCRIPTION TIERS - Updated Pricing Structure
export const tierFeatures = {
  free: { 
    text: true, 
    audio: false, 
    image: false,
    voiceEmotionAnalysis: false,
    // Usage Limits
    maxConversationsPerDay: 15,  // Reset at midnight UTC
    maxTokensPerResponse: 100,
    maxContextWindow: 2000,  // tokens
    maxConversationLength: 20,  // messages before requiring fresh session
    // Pricing & Model
    monthlyPrice: 0,
    model: 'claude-3-haiku',
    // Features
    emotionalAnalysis: 'basic',  // Basic emotional check-ins only
    habitTracking: false,
    reflectionMode: false,
    responseCache: true,
    priorityProcessing: false,
    supportLevel: 'community',
    supportResponseTime: null,
    weeklyInsights: false
  },
  core: { 
    text: true, 
    audio: true, 
    image: false,
    voiceEmotionAnalysis: false,
    // Usage Limits
    maxConversationsPerDay: 150,
    maxTokensPerResponse: 250,
    maxContextWindow: 4000,  // tokens
    maxConversationLength: 100,  // messages before requiring fresh session
    // Pricing & Model
    monthlyPrice: 19.99,
    model: 'claude-3-sonnet',
    // Features
    emotionalAnalysis: 'full',  // Full emotional intelligence coaching
    habitTracking: true,  // Habit tracking and correlation insights
    reflectionMode: true,  // Personal reflection mode (private)
    responseCache: true,
    priorityProcessing: false,
    supportLevel: 'email',
    supportResponseTime: '48 hours',
    weeklyInsights: false
  },
  studio: { 
    text: true, 
    audio: true, 
    image: true,
    voiceEmotionAnalysis: true,  // Advanced voice emotion analysis
    // Usage Limits
    maxConversationsPerDay: 500,
    maxTokensPerResponse: 400,
    maxContextWindow: 8000,  // tokens
    maxConversationLength: -1,  // Unlimited
    // Pricing & Model
    monthlyPrice: 179.99,
    model: 'claude-3-opus',
    // Features
    emotionalAnalysis: 'advanced',  // Enhanced emotional intelligence reporting
    habitTracking: true,
    reflectionMode: true,
    responseCache: true,
    priorityProcessing: true,  // Priority AI processing (faster responses)
    supportLevel: 'priority',
    supportResponseTime: '4 hours',
    weeklyInsights: true  // Weekly coaching insights
  },
} as const;

// 🛡️ REVENUE PROTECTION - Daily API Budget Limits
export const DAILY_API_BUDGET = {
  development: 50,  // $50/day in dev
  production: 500,  // $500/day in prod (higher due to Studio tier)
};

// 🚨 ETHICAL SAFEGUARDS - Crisis Detection Keywords
export const CRISIS_KEYWORDS = [
  'suicide', 'suicidal', 'kill myself', 'end my life', 'want to die',
  'self harm', 'self-harm', 'cutting', 'overdose', 'pills',
  'emergency', 'crisis', 'help me', 'desperate', 'can\'t go on',
  'no point', 'worthless', 'hopeless', 'give up'
];

// 🏥 MENTAL HEALTH RESOURCES
export const MENTAL_HEALTH_RESOURCES = {
  crisis: {
    title: "Crisis Support Available 24/7",
    resources: [
      { name: "National Suicide Prevention Lifeline", contact: "988 or 1-800-273-8255", available: "24/7" },
      { name: "Crisis Text Line", contact: "Text HOME to 741741", available: "24/7" },
      { name: "International Association for Suicide Prevention", contact: "https://www.iasp.info/resources/Crisis_Centres/", available: "24/7" }
    ]
  },
  support: {
    title: "Additional Mental Health Support",
    resources: [
      { name: "NAMI (National Alliance on Mental Illness)", contact: "1-800-950-NAMI (6264)", available: "Mon-Fri 10am-10pm ET" },
      { name: "SAMHSA National Helpline", contact: "1-800-662-4357", available: "24/7" },
      { name: "Psychology Today Therapist Finder", contact: "https://www.psychologytoday.com/us/therapists", available: "Online" }
    ]
  }
};

// ⚠️ SOFT LIMIT THRESHOLDS
export const USAGE_THRESHOLDS = {
  warning: 0.8,  // Show warning at 80% usage
  critical: 0.95  // Show critical warning at 95% usage
};

// 🎯 COST OPTIMIZATION - Response Caching Config
export const CACHE_CONFIG = {
  enabled: true,
  ttl: 3600, // 1 hour
  maxSize: 1000, // max cached responses
  commonQueries: [
    'how to manage anxiety',
    'breathing exercises for stress',
    'stress relief techniques',
    'emotional regulation tips',
    'mindfulness practices',
    'coping with depression',
    'building self confidence',
    'anger management',
    'dealing with grief',
    'improving sleep'
  ]
};

// 💳 PADDLE CONFIGURATION (Live API Integration)
export const PADDLE_CONFIG = {
  environment: import.meta.env.VITE_PADDLE_ENVIRONMENT || 'live',
  vendorId: import.meta.env.VITE_PADDLE_VENDOR_ID,
  apiKey: import.meta.env.VITE_PADDLE_API_KEY,
  publicKey: import.meta.env.VITE_PADDLE_PUBLIC_KEY,
  webhookSecret: import.meta.env.VITE_PADDLE_WEBHOOK_SECRET,
  products: {
    core: {
      productId: import.meta.env.VITE_PADDLE_CORE_PRODUCT_ID,
      planId: import.meta.env.VITE_PADDLE_CORE_PLAN_ID,
      priceId: import.meta.env.VITE_PADDLE_CORE_PRICE_ID || 'pri_core_plan',
      price: 19.99
    },
    studio: {
      productId: import.meta.env.VITE_PADDLE_STUDIO_PRODUCT_ID,
      planId: import.meta.env.VITE_PADDLE_STUDIO_PLAN_ID,
      priceId: import.meta.env.VITE_PADDLE_STUDIO_PRICE_ID || 'pri_studio_plan',
      price: 179.99
    }
  },
  // Subscription status cache duration (5 minutes)
  cacheTimeout: 5 * 60 * 1000
};

// Validate tier value
export function isValidTier(tier: string): tier is Tier {
  return TIER_VALUES.includes(tier as any);
}

// Map tiers → Claude model with exact model names
export function getClaudeModelName(tier: Tier): string {
  if (tier === 'studio') return 'claude-3-opus-20240229';
  if (tier === 'core') return 'claude-3-sonnet-20240229';
  return 'claude-3-haiku-20240307'; // fallback for free
}

// Get tier pricing for upgrade prompts
export function getTierPricing(tier: Tier): number {
  return tierFeatures[tier].monthlyPrice;
}

// Check if user is within daily conversation limit
export function isWithinDailyLimit(tier: Tier, conversationsToday: number): boolean {
  const limit = tierFeatures[tier].maxConversationsPerDay;
  if (limit === -1) return true; // Unlimited
  return conversationsToday < limit;
}

// Get remaining conversations for the day
export function getRemainingConversations(tier: Tier, conversationsToday: number): number | 'unlimited' {
  const limit = tierFeatures[tier].maxConversationsPerDay;
  if (limit === -1) return 'unlimited';
  return Math.max(0, limit - conversationsToday);
}

// Check if message contains crisis keywords
export function containsCrisisKeywords(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return CRISIS_KEYWORDS.some(keyword => lowerMessage.includes(keyword));
}

// Get usage warning level
export function getUsageWarningLevel(tier: Tier, conversationsToday: number): 'normal' | 'warning' | 'critical' | 'exceeded' {
  const limit = tierFeatures[tier].maxConversationsPerDay;
  if (limit === -1) return 'normal'; // Unlimited
  
  const usage = conversationsToday / limit;
  
  if (conversationsToday >= limit) return 'exceeded';
  if (usage >= USAGE_THRESHOLDS.critical) return 'critical';
  if (usage >= USAGE_THRESHOLDS.warning) return 'warning';
  return 'normal';
}

// Get subscription display name
export function getSubscriptionDisplayName(tier: Tier): string {
  switch (tier) {
    case 'free': return 'Atlas Free';
    case 'core': return 'Atlas Core';
    case 'studio': return 'Atlas Studio';
    default: return 'Atlas Free';
  }
}