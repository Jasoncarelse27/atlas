// Enhanced Response Cache Service
// Advanced caching for 20-30% API cost reduction
// Features: Smart similarity matching, tier-aware caching, performance monitoring

import CryptoJS from 'crypto-js';
import { CACHE_CONFIG } from '../config/featureAccess';
import { supabase } from '../lib/supabaseClient';
import type { Tier } from '../types/tier';
import { logger } from '../lib/logger';

export interface EnhancedCachedResponse {
  id: number;
  query_hash: string;
  query_text: string;
  response_text: string;
  tier: Tier;
  hit_count: number;
  similarity_score: number;
  created_at: string;
  expires_at: string;
  last_accessed: string;
}

export interface CacheMetrics {
  totalEntries: number;
  totalHits: number;
  hitRate: number;
  costSavings: number;
  topQueries: Array<{ query: string; hits: number; savings: number }>;
  tierBreakdown: Record<Tier, { entries: number; hits: number; hitRate: number }>;
}

class EnhancedResponseCacheService {
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
    'setting boundaries',
    'meditation techniques',
    'coping with loss',
    'managing panic attacks',
    'building emotional intelligence',
    'dealing with criticism',
    'overcoming perfectionism',
    'managing social anxiety',
    'building healthy relationships',
    'dealing with burnout',
    'improving self esteem'
  ];

  private readonly SIMILARITY_THRESHOLD = 0.75;
  private readonly MIN_RESPONSE_LENGTH = 50;
  private readonly MAX_CACHE_AGE_HOURS = 24;

  /**
   * Generate a hash for the query to use as cache key
   */
  private generateQueryHash(query: string, tier: Tier): string {
    const normalizedQuery = query.toLowerCase().trim();
    return CryptoJS.MD5(`${normalizedQuery}_${tier}`).toString();
  }

  /**
   * Advanced similarity calculation using multiple algorithms
   */
  private calculateAdvancedSimilarity(query1: string, query2: string): number {
    const q1 = query1.toLowerCase().trim();
    const q2 = query2.toLowerCase().trim();
    
    // Jaccard similarity
    const words1 = new Set(q1.split(/\s+/));
    const words2 = new Set(q2.split(/\s+/));
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    const jaccard = intersection.size / union.size;
    
    // Levenshtein distance (normalized)
    const maxLen = Math.max(q1.length, q2.length);
    const levenshtein = this.levenshteinDistance(q1, q2);
    const normalizedLevenshtein = 1 - (levenshtein / maxLen);
    
    // Keyword overlap
    const keywords1 = this.extractKeywords(q1);
    const keywords2 = this.extractKeywords(q2);
    const keywordOverlap = this.calculateKeywordOverlap(keywords1, keywords2);
    
    // Weighted combination
    return (jaccard * 0.4) + (normalizedLevenshtein * 0.3) + (keywordOverlap * 0.3);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + cost
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Extract keywords from query
   */
  private extractKeywords(query: string): string[] {
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'how', 'what', 'why', 'when', 'where']);
    return query.split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word.toLowerCase()))
      .map(word => word.toLowerCase());
  }

  /**
   * Calculate keyword overlap between two keyword sets
   */
  private calculateKeywordOverlap(keywords1: string[], keywords2: string[]): number {
    const set1 = new Set(keywords1);
    const set2 = new Set(keywords2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return intersection.size / union.size;
  }

  /**
   * Check if query is cacheable with enhanced logic
   */
  private isCacheableQuery(query: string, tier: Tier): boolean {
    if (!CACHE_CONFIG.enabled) return false;
    
    const normalizedQuery = query.toLowerCase().trim();
    
    // Check against common queries with similarity
    const isCommon = this.COMMON_QUERIES.some(commonQuery => 
      this.calculateAdvancedSimilarity(normalizedQuery, commonQuery.toLowerCase()) > this.SIMILARITY_THRESHOLD
    );
    
    // Enhanced emotional intelligence query detection
    const isEIQuery = this.detectEmotionalIntelligenceQuery(normalizedQuery);
    
    // Tier-specific caching rules
    const tierCacheable = this.isTierCacheable(tier);
    
    return (isCommon || isEIQuery) && tierCacheable;
  }

  /**
   * Detect emotional intelligence related queries
   */
  private detectEmotionalIntelligenceQuery(query: string): boolean {
    const eiKeywords = [
      'feel', 'emotion', 'stress', 'anxiety', 'mood', 'mental health', 'wellbeing',
      'cope', 'deal', 'manage', 'handle', 'overcome', 'build', 'improve',
      'relationship', 'communication', 'boundary', 'self esteem', 'confidence',
      'mindfulness', 'meditation', 'breathing', 'relaxation', 'calm',
      'depression', 'sadness', 'grief', 'loss', 'anger', 'frustration',
      'overwhelm', 'burnout', 'exhaustion', 'loneliness', 'isolation'
    ];
    
    return eiKeywords.some(keyword => query.includes(keyword));
  }

  /**
   * Check if tier supports caching
   */
  private isTierCacheable(tier: Tier): boolean {
    // All tiers support caching, but with different TTL
    return true;
  }

  /**
   * Get cache TTL based on tier
   */
  private getCacheTTL(tier: Tier): number {
    switch (tier) {
      case 'free': return 1800; // 30 minutes
      case 'core': return 3600; // 1 hour
      case 'studio': return 7200; // 2 hours
      default: return 3600;
    }
  }

  /**
   * Enhanced cache retrieval with similarity matching
   */
  async getCachedResponse(query: string, tier: Tier): Promise<string | null> {
    if (!this.isCacheableQuery(query, tier)) {
      return null;
    }

    try {
      const queryHash = this.generateQueryHash(query, tier);
      
      // First try exact match
      let { data, error } = await supabase
        .from('response_cache')
        .select('response_text, hit_count, id')
        .eq('query_hash', queryHash)
        .eq('tier', tier)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error || !data) {
        // Try similarity matching
        const { data: similarData, error: similarError } = await supabase
          .from('response_cache')
          .select('response_text, hit_count, id, query_text')
          .eq('tier', tier)
          .gt('expires_at', new Date().toISOString())
          .order('hit_count', { ascending: false })
          .limit(10);

        if (similarError || !similarData) {
          return null;
        }

        // Find best match by similarity
        let bestMatch = null;
        let bestScore = 0;

        for (const entry of similarData) {
          const similarity = this.calculateAdvancedSimilarity(query, entry.query_text);
          if (similarity > this.SIMILARITY_THRESHOLD && similarity > bestScore) {
            bestMatch = entry;
            bestScore = similarity;
          }
        }

        if (!bestMatch) {
          return null;
        }

        data = bestMatch;
      }

      // Update hit count (removed last_accessed - column doesn't exist in schema)
      await supabase
        .from('response_cache')
        .update({ 
          hit_count: data.hit_count + 1
        })
        .eq('id', data.id);

      return data.response_text;

    } catch (error) {
      logger.error('[EnhancedCache] Error retrieving cached response:', error);
      return null;
    }
  }

  /**
   * Enhanced cache storage with similarity scoring
   */
  async cacheResponse(query: string, response: string, tier: Tier): Promise<void> {
    if (!this.isCacheableQuery(query, tier) || response.length < this.MIN_RESPONSE_LENGTH) {
      return;
    }

    try {
      const queryHash = this.generateQueryHash(query, tier);
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + this.getCacheTTL(tier));

      const { error } = await supabase
        .from('response_cache')
        .upsert({
          query_hash: queryHash,
          query_text: query.substring(0, 500),
          response_text: response,
          tier,
          hit_count: 1,
          expires_at: expiresAt.toISOString()
        }, {
          onConflict: 'query_hash'
        });

      if (error) {
        logger.error('[EnhancedCache] Error caching response:', error);
      } else {
        logger.debug('[EnhancedCache] ✅ Cached response for query:', query.substring(0, 50));
      }

    } catch (error) {
      logger.error('[EnhancedCache] Error caching response:', error);
    }
  }

  /**
   * Get comprehensive cache metrics
   */
  async getCacheMetrics(): Promise<CacheMetrics> {
    try {
      const { data, error } = await supabase
        .from('response_cache')
        .select('query_text, hit_count, tier, created_at')
        .gt('expires_at', new Date().toISOString());

      if (error || !data) {
        return {
          totalEntries: 0,
          totalHits: 0,
          hitRate: 0,
          costSavings: 0,
          topQueries: [],
          tierBreakdown: { free: { entries: 0, hits: 0, hitRate: 0 }, core: { entries: 0, hits: 0, hitRate: 0 }, studio: { entries: 0, hits: 0, hitRate: 0 } }
        };
      }

      const totalEntries = data.length;
      const totalHits = data.reduce((sum, entry) => sum + entry.hit_count, 0);
      const hitRate = totalEntries > 0 ? (totalHits / totalEntries) : 0;
      
      // Estimate cost savings (assuming $0.01 per API call saved)
      const costSavings = totalHits * 0.01;
      
      const topQueries = data
        .sort((a, b) => b.hit_count - a.hit_count)
        .slice(0, 10)
        .map(entry => ({
          query: entry.query_text,
          hits: entry.hit_count,
          savings: entry.hit_count * 0.01
        }));

      // Tier breakdown
      const tierBreakdown = { free: { entries: 0, hits: 0, hitRate: 0 }, core: { entries: 0, hits: 0, hitRate: 0 }, studio: { entries: 0, hits: 0, hitRate: 0 } };
      
      for (const entry of data) {
        const tier = entry.tier as Tier;
        if (tierBreakdown[tier]) {
          tierBreakdown[tier].entries++;
          tierBreakdown[tier].hits += entry.hit_count;
        }
      }

      // Calculate hit rates for each tier
      for (const tier of ['free', 'core', 'studio'] as Tier[]) {
        if (tierBreakdown[tier].entries > 0) {
          tierBreakdown[tier].hitRate = tierBreakdown[tier].hits / tierBreakdown[tier].entries;
        }
      }

      return { totalEntries, totalHits, hitRate, costSavings, topQueries, tierBreakdown };

    } catch (error) {
      logger.error('[EnhancedCache] Error getting cache metrics:', error);
      return {
        totalEntries: 0,
        totalHits: 0,
        hitRate: 0,
        costSavings: 0,
        topQueries: [],
        tierBreakdown: { free: { entries: 0, hits: 0, hitRate: 0 }, core: { entries: 0, hits: 0, hitRate: 0 }, studio: { entries: 0, hits: 0, hitRate: 0 } }
      };
    }
  }

  /**
   * Clean up expired entries and optimize cache
   */
  async optimizeCache(): Promise<{ expiredRemoved: number; duplicatesRemoved: number }> {
    try {
      // Remove expired entries
      const { count: expiredCount, error: expiredError } = await supabase
        .from('response_cache')
        .delete()
        .lt('expires_at', new Date().toISOString());

      if (expiredError) {
        logger.error('[EnhancedCache] Error removing expired entries:', expiredError);
      }

      // Remove duplicate entries (keep highest hit count)
      const { data: duplicates, error: duplicatesError } = await supabase
        .from('response_cache')
        .select('query_hash, id, hit_count')
        .gt('expires_at', new Date().toISOString());

      if (duplicatesError || !duplicates) {
        return { expiredRemoved: expiredCount || 0, duplicatesRemoved: 0 };
      }

      // Group by query_hash and remove duplicates
      const hashGroups = new Map<string, any[]>();
      for (const entry of duplicates) {
        if (!hashGroups.has(entry.query_hash)) {
          hashGroups.set(entry.query_hash, []);
        }
        hashGroups.get(entry.query_hash)!.push(entry);
      }

      let duplicatesRemoved = 0;
      for (const [hash, entries] of hashGroups) {
        if (entries.length > 1) {
          // Keep the one with highest hit count
          const sorted = entries.sort((a, b) => b.hit_count - a.hit_count);
          const toDelete = sorted.slice(1);
          
          for (const entry of toDelete) {
            await supabase
              .from('response_cache')
              .delete()
              .eq('id', entry.id);
            duplicatesRemoved++;
          }
        }
      }

      return { expiredRemoved: expiredCount || 0, duplicatesRemoved };

    } catch (error) {
      logger.error('[EnhancedCache] Error optimizing cache:', error);
      return { expiredRemoved: 0, duplicatesRemoved: 0 };
    }
  }

  /**
   * Pre-populate cache with high-value responses
   */
  async prePopulateHighValueCache(): Promise<void> {
    const highValueResponses = [
      {
        query: "how to manage anxiety",
        response: "Here are proven anxiety management techniques:\n\n**Immediate Relief:**\n• 4-7-8 breathing: Inhale 4, hold 7, exhale 8\n• Grounding technique: 5-4-3-2-1 (5 things you see, 4 you hear, 3 you touch, 2 you smell, 1 you taste)\n• Progressive muscle relaxation\n\n**Long-term Strategies:**\n• Regular exercise (reduces cortisol)\n• Mindfulness meditation\n• Cognitive behavioral techniques\n• Sleep hygiene\n• Limit caffeine and alcohol\n\n**When to Seek Help:**\nIf anxiety significantly impacts daily life, consider professional support. You're not alone in this journey."
      },
      {
        query: "breathing exercises for stress",
        response: "Master these breathing techniques for instant stress relief:\n\n**Box Breathing (4-4-4-4):**\n• Inhale for 4 counts\n• Hold for 4 counts\n• Exhale for 4 counts\n• Hold empty for 4 counts\n• Repeat 4-8 cycles\n\n**4-7-8 Technique:**\n• Inhale through nose for 4\n• Hold breath for 7\n• Exhale through mouth for 8\n• Repeat 3-4 times\n\n**Belly Breathing:**\n• Place one hand on chest, one on belly\n• Breathe so only belly hand moves\n• Slow, deep breaths for 5-10 minutes\n\nThese activate your parasympathetic nervous system, naturally reducing stress hormones."
      },
      {
        query: "dealing with depression",
        response: "Depression is treatable. Here's a comprehensive approach:\n\n**Immediate Support:**\n• Reach out to trusted friends/family\n• Consider professional help (therapist, counselor)\n• Crisis hotlines: 988 (US), Samaritans (UK)\n\n**Daily Strategies:**\n• Maintain routine (sleep, meals, activities)\n• Get sunlight (15-30 minutes daily)\n• Physical activity (even 10-minute walks help)\n• Connect with others\n• Practice gratitude (3 things daily)\n\n**Professional Treatment:**\n• Therapy (CBT, DBT, interpersonal)\n• Medication (if recommended by doctor)\n• Support groups\n\n**Remember:** Depression is not a personal failing. Recovery is possible with proper support."
      }
    ];

    for (const { query, response } of highValueResponses) {
      for (const tier of ['free', 'core', 'studio'] as Tier[]) {
        await this.cacheResponse(query, response, tier);
      }
    }

    logger.debug('[EnhancedCache] ✅ Pre-populated high-value cache');
  }
}

export const enhancedResponseCacheService = new EnhancedResponseCacheService();
