// Atlas Response Cache Service
// Cost optimization through intelligent caching of emotional intelligence responses

import CryptoJS from 'crypto-js';
import { CACHE_CONFIG } from '../config/featureAccess';
import { supabase } from '../lib/supabaseClient';
import type { Tier } from '../types/tier';

export interface CachedResponse {
  id: number;
  query_hash: string;
  query_text: string;
  response_text: string;
  tier: Tier;
  hit_count: number;
  created_at: string;
  expires_at: string;
}

class ResponseCacheService {
  private readonly COMMON_QUERIES = [
    'how to manage anxiety',
    'breathing exercises for stress',
    'dealing with depression',
    'emotional regulation techniques',
    'mindfulness practices',
    'coping with grief',
    'anger management strategies',
    'building self confidence',
    'overcoming fear',
    'stress relief methods',
    'improving mood',
    'handling rejection',
    'dealing with loneliness',
    'managing overwhelm',
    'building resilience',
    'positive thinking techniques',
    'sleep hygiene tips',
    'work life balance',
    'relationship communication',
    'setting boundaries'
  ];

  /**
   * Generate a hash for the query to use as cache key
   */
  private generateQueryHash(query: string, tier: Tier): string {
    const normalizedQuery = query.toLowerCase().trim();
    return CryptoJS.MD5(`${normalizedQuery}_${tier}`).toString();
  }

  /**
   * Check if query is cacheable (common emotional intelligence topics)
   */
  private isCacheableQuery(query: string): boolean {
    if (!CACHE_CONFIG.enabled) return false;
    
    const normalizedQuery = query.toLowerCase();
    
    // Check against common queries
    const isCommon = this.COMMON_QUERIES.some(commonQuery => 
      normalizedQuery.includes(commonQuery.toLowerCase()) ||
      this.calculateSimilarity(normalizedQuery, commonQuery.toLowerCase()) > 0.8
    );
    
    // Also cache short, general emotional intelligence questions
    const isShortEIQuery = normalizedQuery.length < 100 && (
      normalizedQuery.includes('how') || 
      normalizedQuery.includes('what') || 
      normalizedQuery.includes('why')
    ) && (
      normalizedQuery.includes('feel') ||
      normalizedQuery.includes('emotion') ||
      normalizedQuery.includes('stress') ||
      normalizedQuery.includes('anxiety') ||
      normalizedQuery.includes('mood') ||
      normalizedQuery.includes('mental health') ||
      normalizedQuery.includes('wellbeing')
    );
    
    return isCommon || isShortEIQuery;
  }

  /**
   * Calculate similarity between two strings (simple Jaccard similarity)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = new Set(str1.split(' '));
    const words2 = new Set(str2.split(' '));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  /**
   * Try to get cached response for a query
   */
  async getCachedResponse(query: string, tier: Tier): Promise<string | null> {
    if (!this.isCacheableQuery(query)) {
      return null;
    }

    try {
      const queryHash = this.generateQueryHash(query, tier);
      
      const { data, error } = await supabase
        .from('response_cache')
        .select('response_text, hit_count, id')
        .eq('query_hash', queryHash)
        .eq('tier', tier)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error || !data) {
        return null;
      }

      // Increment hit count
      await supabase
        .from('response_cache')
        .update({ hit_count: data.hit_count + 1 })
        .eq('id', data.id);

      return data.response_text;

    } catch (error) {
      return null;
    }
  }

  /**
   * Store response in cache
   */
  async cacheResponse(query: string, response: string, tier: Tier): Promise<void> {
    if (!this.isCacheableQuery(query) || response.length < 50) {
      return; // Don't cache very short responses
    }

    try {
      const queryHash = this.generateQueryHash(query, tier);
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + CACHE_CONFIG.ttl);

      const { error } = await supabase
        .from('response_cache')
        .upsert({
          query_hash: queryHash,
          query_text: query.substring(0, 500), // Truncate for storage
          response_text: response,
          tier,
          hit_count: 1,
          expires_at: expiresAt.toISOString()
        }, {
          onConflict: 'query_hash'
        });

      if (error) {
        console.error('[ResponseCache] Error caching response:', error);
      } else {
        console.log('[ResponseCache] ✅ Response cached successfully');
      }

    } catch (error) {
      console.error('[ResponseCache] Error in cacheResponse:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalEntries: number;
    totalHits: number;
    hitRate: number;
    topQueries: Array<{ query: string; hits: number }>;
  }> {
    try {
      const { data, error } = await supabase
        .from('response_cache')
        .select('query_text, hit_count')
        .gt('expires_at', new Date().toISOString())
        .order('hit_count', { ascending: false });

      if (error || !data) {
        return { totalEntries: 0, totalHits: 0, hitRate: 0, topQueries: [] };
      }

      const totalEntries = data.length;
      const totalHits = data.reduce((sum, entry) => sum + entry.hit_count, 0);
      const hitRate = totalEntries > 0 ? (totalHits / totalEntries) : 0;
      
      const topQueries = data.slice(0, 10).map(entry => ({
        query: entry.query_text,
        hits: entry.hit_count
      }));

      return { totalEntries, totalHits, hitRate, topQueries };

    } catch (error) {
      return { totalEntries: 0, totalHits: 0, hitRate: 0, topQueries: [] };
    }
  }

  /**
   * Clean up expired cache entries
   */
  async cleanupExpiredEntries(): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('response_cache')
        .delete()
        .lt('expires_at', new Date().toISOString());

      if (error) {
        return 0;
      }

      return count || 0;

    } catch (error) {
      return 0;
    }
  }

  /**
   * Clear cache for specific tier (admin function)
   */
  async clearCacheForTier(tier: Tier): Promise<void> {
    try {
      const { error } = await supabase
        .from('response_cache')
        .delete()
        .eq('tier', tier);

      if (error) {
        console.error('[ResponseCache] Error clearing tier cache:', error);
      } else {
        console.log('[ResponseCache] ✅ Cleared cache for tier:', tier);
      }

    } catch (error) {
      console.error('[ResponseCache] Error in clearTierCache:', error);
    }
  }

  /**
   * Pre-populate cache with common responses (admin function)
   */
  async prePopulateCache(): Promise<void> {
    const commonResponses = [
      {
        query: "how to manage anxiety",
        response: "Here are some effective anxiety management techniques:\n\n1. **Deep Breathing**: Practice the 4-7-8 technique - inhale for 4, hold for 7, exhale for 8\n2. **Grounding**: Use the 5-4-3-2-1 method - notice 5 things you see, 4 you hear, 3 you touch, 2 you smell, 1 you taste\n3. **Progressive Muscle Relaxation**: Tense and release muscle groups systematically\n4. **Mindfulness**: Focus on the present moment without judgment\n5. **Regular Exercise**: Physical activity naturally reduces anxiety hormones\n\nRemember, if anxiety significantly impacts your daily life, consider speaking with a mental health professional."
      },
      {
        query: "breathing exercises for stress",
        response: "Here are proven breathing exercises for stress relief:\n\n**Box Breathing (4-4-4-4)**:\n- Inhale for 4 counts\n- Hold for 4 counts\n- Exhale for 4 counts\n- Hold empty for 4 counts\n\n**4-7-8 Breathing**:\n- Inhale through nose for 4\n- Hold breath for 7\n- Exhale through mouth for 8\n\n**Belly Breathing**:\n- Place one hand on chest, one on belly\n- Breathe so only the belly hand moves\n- Slow, deep breaths\n\nPractice these for 5-10 minutes daily. They activate your parasympathetic nervous system, naturally reducing stress hormones."
      }
      // Add more common responses as needed
    ];

    for (const { query, response } of commonResponses) {
      for (const tier of ['free', 'basic', 'premium'] as Tier[]) {
        await this.cacheResponse(query, response, tier);
      }
    }

    console.log('✅ Pre-populated cache with common responses');
  }
}

export const responseCacheService = new ResponseCacheService();
