// Cache Management Service
// Monitor and optimize enhanced response caching performance

import { supabase } from '../lib/supabaseClient';
import type { Tier } from '../types/tier';
import { enhancedResponseCacheService } from './enhancedResponseCacheService';

export interface CachePerformanceMetrics {
  hitRate: number;
  costSavings: number;
  totalQueries: number;
  cachedQueries: number;
  apiCallsSaved: number;
  estimatedMonthlySavings: number;
}

class CacheManagementService {
  private metrics: CachePerformanceMetrics = {
    hitRate: 0,
    costSavings: 0,
    totalQueries: 0,
    cachedQueries: 0,
    apiCallsSaved: 0,
    estimatedMonthlySavings: 0
  };

  /**
   * Get comprehensive cache performance metrics
   */
  async getPerformanceMetrics(): Promise<CachePerformanceMetrics> {
    try {
      const cacheMetrics = await enhancedResponseCacheService.getCacheMetrics();
      
      // Calculate performance metrics
      const hitRate = cacheMetrics.hitRate;
      const costSavings = cacheMetrics.costSavings;
      const totalQueries = cacheMetrics.totalEntries;
      const cachedQueries = cacheMetrics.totalHits;
      const apiCallsSaved = cachedQueries;
      
      // Estimate monthly savings (assuming 30 days, 100 queries per day per user)
      const estimatedMonthlySavings = costSavings * 30;

      this.metrics = {
        hitRate,
        costSavings,
        totalQueries,
        cachedQueries,
        apiCallsSaved,
        estimatedMonthlySavings
      };

      return this.metrics;

    } catch (error) {
      console.error('[CacheManagement] Error getting performance metrics:', error);
      return this.metrics;
    }
  }

  /**
   * Log cache performance to usage_logs
   */
  async logCachePerformance(userId: string): Promise<void> {
    try {
      const metrics = await this.getPerformanceMetrics();
      
      await supabase.from('usage_logs').insert({
        user_id: userId,
        event: 'cache_performance_report',
        data: {
          hitRate: metrics.hitRate,
          costSavings: metrics.costSavings,
          apiCallsSaved: metrics.apiCallsSaved,
          estimatedMonthlySavings: metrics.estimatedMonthlySavings,
          timestamp: new Date().toISOString()
        }
      });

      console.log('[CacheManagement] ✅ Logged cache performance metrics');

    } catch (error) {
      console.error('[CacheManagement] Error logging cache performance:', error);
    }
  }

  /**
   * Optimize cache by removing expired entries and duplicates
   */
  async optimizeCache(): Promise<{ expiredRemoved: number; duplicatesRemoved: number }> {
    try {
      console.log('[CacheManagement] 🔧 Starting cache optimization...');
      
      const result = await enhancedResponseCacheService.optimizeCache();
      
      console.log('[CacheManagement] ✅ Cache optimization complete:', result);
      return result;

    } catch (error) {
      console.error('[CacheManagement] Error optimizing cache:', error);
      return { expiredRemoved: 0, duplicatesRemoved: 0 };
    }
  }

  /**
   * Pre-populate cache with high-value responses
   */
  async prePopulateHighValueCache(): Promise<void> {
    try {
      console.log('[CacheManagement] 🌱 Pre-populating high-value cache...');
      
      await enhancedResponseCacheService.prePopulateHighValueCache();
      
      console.log('[CacheManagement] ✅ High-value cache pre-population complete');

    } catch (error) {
      console.error('[CacheManagement] Error pre-populating cache:', error);
    }
  }

  /**
   * Get cache statistics by tier
   */
  async getTierBreakdown(): Promise<Record<Tier, { entries: number; hits: number; hitRate: number }>> {
    try {
      const metrics = await enhancedResponseCacheService.getCacheMetrics();
      return metrics.tierBreakdown;

    } catch (error) {
      console.error('[CacheManagement] Error getting tier breakdown:', error);
      return { 
        free: { entries: 0, hits: 0, hitRate: 0 }, 
        core: { entries: 0, hits: 0, hitRate: 0 }, 
        studio: { entries: 0, hits: 0, hitRate: 0 } 
      };
    }
  }

  /**
   * Get top performing cached queries
   */
  async getTopQueries(limit: number = 10): Promise<Array<{ query: string; hits: number; savings: number }>> {
    try {
      const metrics = await enhancedResponseCacheService.getCacheMetrics();
      return metrics.topQueries.slice(0, limit);

    } catch (error) {
      console.error('[CacheManagement] Error getting top queries:', error);
      return [];
    }
  }

  /**
   * Clear cache for specific tier (admin function)
   */
  async clearCacheForTier(tier: Tier): Promise<void> {
    try {
      console.log(`[CacheManagement] 🗑️ Clearing cache for tier: ${tier}`);
      
      // This would need to be implemented in enhancedResponseCacheService
      // For now, we'll log the request
      console.log('[CacheManagement] Cache clearing requested for tier:', tier);

    } catch (error) {
      console.error('[CacheManagement] Error clearing cache for tier:', error);
    }
  }

  /**
   * Get cache health status
   */
  async getCacheHealth(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    recommendations: string[];
  }> {
    try {
      const metrics = await this.getPerformanceMetrics();
      const issues: string[] = [];
      const recommendations: string[] = [];

      // Check hit rate
      if (metrics.hitRate < 0.1) {
        issues.push('Low cache hit rate (< 10%)');
        recommendations.push('Consider pre-populating cache with common queries');
      } else if (metrics.hitRate < 0.3) {
        issues.push('Moderate cache hit rate (< 30%)');
        recommendations.push('Review cache TTL settings and query patterns');
      }

      // Check cost savings
      if (metrics.costSavings < 1) {
        issues.push('Low cost savings detected');
        recommendations.push('Monitor query patterns and optimize cache strategy');
      }

      // Check total queries
      if (metrics.totalQueries > 10000) {
        issues.push('Large cache size detected');
        recommendations.push('Consider cache optimization and cleanup');
      }

      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (issues.length > 2) {
        status = 'critical';
      } else if (issues.length > 0) {
        status = 'warning';
      }

      return { status, issues, recommendations };

    } catch (error) {
      console.error('[CacheManagement] Error getting cache health:', error);
      return {
        status: 'critical',
        issues: ['Failed to retrieve cache metrics'],
        recommendations: ['Check cache service connectivity']
      };
    }
  }

  /**
   * Schedule automatic cache optimization
   */
  scheduleOptimization(intervalHours: number = 24): void {
    const intervalMs = intervalHours * 60 * 60 * 1000;
    
    setInterval(async () => {
      console.log('[CacheManagement] 🔄 Running scheduled cache optimization...');
      await this.optimizeCache();
    }, intervalMs);

    console.log(`[CacheManagement] ⏰ Scheduled cache optimization every ${intervalHours} hours`);
  }
}

export const cacheManagementService = new CacheManagementService();
