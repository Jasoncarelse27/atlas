// backend/middleware/promptCacheMiddleware.mjs
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Service role client (server-side only!)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// Cache configuration
const CACHE_CONFIG = {
  systemPrompts: {
    ttl: 24 * 60 * 60 * 1000, // 24 hours
    enabled: true
  },
  eqChallenges: {
    ttl: 12 * 60 * 60 * 1000, // 12 hours
    enabled: true
  },
  userPrompts: {
    ttl: 2 * 60 * 60 * 1000, // 2 hours
    enabled: false // Disabled for privacy
  }
};

// System prompts that are commonly used
const SYSTEM_PROMPTS = {
  emotional_intelligence: `You are Atlas, an emotionally intelligent AI assistant designed to help users develop their emotional intelligence and interpersonal skills. You provide empathetic, thoughtful responses while encouraging self-reflection and growth.`,
  
  daily_eq_challenge: `You are Atlas, providing a daily emotional intelligence challenge. Create engaging, practical exercises that help users develop emotional awareness, empathy, and social skills. Keep challenges achievable and relevant to daily life.`,
  
  crisis_support: `You are Atlas, providing compassionate crisis support. Your primary goal is to listen, validate feelings, and guide users toward appropriate professional help when needed. Always prioritize safety and never attempt to replace professional mental health services.`,
  
  habit_tracking: `You are Atlas, helping users build positive emotional habits. Provide encouragement, track progress, and offer practical strategies for maintaining emotional wellness routines.`
};

/**
 * Middleware to cache system prompts and common responses for cost optimization.
 * - Caches system prompts to reduce token usage by ~90%
 * - Handles EQ challenges and common patterns
 * - Updates cache hit/miss statistics
 * 
 * Attaches `req.cachedPrompt`, `req.cacheStats` for downstream services.
 */
export async function promptCacheMiddleware(req, res, next) {
  try {
    const { message, promptType } = req.body || {};
    const userId = req.user?.id;
    const tier = req.tier || 'free';

    // Determine if this request is cacheable
    const cacheableTypes = ['system', 'eq_challenge', 'emotional_intelligence'];
    const isCacheable = promptType && cacheableTypes.includes(promptType);

    if (!isCacheable) {
      // Skip caching for regular user conversations
      req.cachedPrompt = null;
      req.cacheStats = { hit: false, type: 'skip', reason: 'not_cacheable' };
      return next();
    }

    const today = new Date().toISOString().slice(0, 10);

    // Generate cache key based on prompt type and content
    const cacheKey = generateCacheKey(promptType, message, tier);

    try {
      // Try to get cached prompt
      const { data: cachedData, error: cacheError } = await supabase
        .from('prompt_cache')
        .select('content, tokens, created_at')
        .eq('hash', cacheKey)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (cacheError && cacheError.code !== 'PGRST116') {
        console.warn('[promptCacheMiddleware] Cache lookup error:', cacheError.message);
      }

      if (cachedData) {
        // Cache hit!
        console.log(`[promptCacheMiddleware] Cache HIT for ${promptType}: ${cacheKey.slice(0, 8)}...`);
        
        // Update cache statistics
        const estimatedSavings = calculateCacheSavings(cachedData.tokens, tier);
        await updateCacheStats(today, true, estimatedSavings);

        req.cachedPrompt = {
          content: cachedData.content,
          tokens: cachedData.tokens,
          cacheHit: true,
          type: promptType,
          savings: estimatedSavings
        };

        req.cacheStats = { 
          hit: true, 
          type: promptType, 
          tokens: cachedData.tokens,
          savings: estimatedSavings
        };

        return next();
      }

      // Cache miss - prepare for caching after response
      console.log(`[promptCacheMiddleware] Cache MISS for ${promptType}: ${cacheKey.slice(0, 8)}...`);
      
      await updateCacheStats(today, false, 0);

      // Check if we have a system prompt to use
      let systemPrompt = null;
      if (promptType === 'emotional_intelligence' || promptType === 'system') {
        systemPrompt = SYSTEM_PROMPTS.emotional_intelligence;
      } else if (promptType === 'eq_challenge') {
        systemPrompt = SYSTEM_PROMPTS.daily_eq_challenge;
      } else if (promptType === 'crisis_support') {
        systemPrompt = SYSTEM_PROMPTS.crisis_support;
      }

      req.cachedPrompt = {
        content: systemPrompt,
        tokens: systemPrompt ? Math.ceil(systemPrompt.length / 3) : 0,
        cacheHit: false,
        type: promptType,
        cacheKey: cacheKey,
        shouldCache: true
      };

      req.cacheStats = { 
        hit: false, 
        type: promptType, 
        cacheKey: cacheKey 
      };

      return next();

    } catch (cacheErr) {
      console.warn('[promptCacheMiddleware] Cache operation failed:', cacheErr.message);
      
      // Fallback to no caching
      req.cachedPrompt = null;
      req.cacheStats = { hit: false, type: 'error', error: cacheErr.message };
      return next();
    }

  } catch (err) {
    console.error('[promptCacheMiddleware] Unexpected error:', err);
    
    // Graceful fallback
    req.cachedPrompt = null;
    req.cacheStats = { hit: false, type: 'error', error: err.message };
    return next();
  }
}

/**
 * Helper function to cache a response after it's generated
 * Call this from your chat route after getting the AI response
 */
export async function cachePromptResponse(cacheKey, content, tokens, promptType) {
  try {
    const config = CACHE_CONFIG[promptType] || CACHE_CONFIG.systemPrompts;
    if (!config.enabled) return;

    const expiresAt = new Date(Date.now() + config.ttl).toISOString();

    const { error } = await supabase
      .from('prompt_cache')
      .upsert({
        hash: cacheKey,
        content: content,
        tokens: tokens,
        expires_at: expiresAt
      });

    if (error) {
      console.warn('[promptCacheMiddleware] Failed to cache prompt:', error.message);
    } else {
      console.log(`[promptCacheMiddleware] Cached prompt: ${cacheKey.slice(0, 8)}... (${tokens} tokens)`);
    }
  } catch (err) {
    console.warn('[promptCacheMiddleware] Cache storage error:', err.message);
  }
}

/**
 * Generate a consistent cache key for prompts
 */
function generateCacheKey(promptType, message, tier) {
  const content = `${promptType}:${tier}:${message || ''}`;
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Calculate cost savings from cache hit
 */
function calculateCacheSavings(tokens, tier) {
  const pricing = {
    free: 0.00025,    // Haiku pricing per 1K tokens
    core: 0.003,      // Sonnet pricing per 1K tokens  
    studio: 0.015     // Opus pricing per 1K tokens
  };

  const pricePerToken = (pricing[tier] || pricing.free) / 1000;
  return tokens * pricePerToken;
}

/**
 * Update cache hit/miss statistics
 */
async function updateCacheStats(date, isHit, savings) {
  try {
    const { error } = await supabase
      .rpc('update_cache_stats', {
        p_date: date,
        p_hit: isHit,
        p_cost_savings: savings || 0
      });

    if (error) {
      console.warn('[promptCacheMiddleware] Failed to update cache stats:', error.message);
    }
  } catch (err) {
    console.warn('[promptCacheMiddleware] Cache stats error:', err.message);
  }
}

/**
 * Clean up expired cache entries (call periodically)
 */
export async function cleanupExpiredCache() {
  try {
    const { error } = await supabase
      .rpc('cleanup_expired_cache');

    if (error) {
      console.warn('[promptCacheMiddleware] Cache cleanup error:', error.message);
    } else {
      console.log('[promptCacheMiddleware] Expired cache entries cleaned up');
    }
  } catch (err) {
    console.warn('[promptCacheMiddleware] Cache cleanup failed:', err.message);
  }
}

export default promptCacheMiddleware;
