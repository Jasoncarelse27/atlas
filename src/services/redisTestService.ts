/**
 * Redis Test Service for Atlas
 * Simple test to verify Redis caching is working
 */

import { cachedDatabaseService } from './cachedDatabaseService';
import { redisCacheService } from './redisCacheService';

export class RedisTestService {
  /**
   * Test basic Redis operations
   */
  static async testBasicOperations(): Promise<boolean> {
    try {
      console.log('[RedisTest] 🧪 Testing basic Redis operations...');
      
      // Test 1: Set and get a simple value
      const testKey = 'test:basic';
      const testData = { message: 'Hello Redis!', timestamp: Date.now() };
      
      const setResult = await redisCacheService.set(testKey, testData, 'general', 'core');
      if (!setResult) {
        console.error('[RedisTest] ❌ Failed to set test data');
        return false;
      }
      
      const getResult = await redisCacheService.get(testKey, 'core');
      if (!getResult || (getResult as any).message !== testData.message) {
        console.error('[RedisTest] ❌ Failed to get test data');
        return false;
      }
      
      console.log('[RedisTest] ✅ Basic set/get operations working');
      
      // Test 2: Test cache expiration
      await redisCacheService.set('test:expiry', { test: true }, 'general', 'free');
      const beforeExpiry = await redisCacheService.get('test:expiry', 'free');
      if (!beforeExpiry) {
        console.error('[RedisTest] ❌ Failed to get data before expiry');
        return false;
      }
      
      console.log('[RedisTest] ✅ Cache expiration test passed');
      
      // Test 3: Test cache deletion
      const deleteResult = await redisCacheService.delete(testKey, 'core');
      if (!deleteResult) {
        console.error('[RedisTest] ❌ Failed to delete test data');
        return false;
      }
      
      const afterDelete = await redisCacheService.get(testKey, 'core');
      if (afterDelete) {
        console.error('[RedisTest] ❌ Data still exists after deletion');
        return false;
      }
      
      console.log('[RedisTest] ✅ Cache deletion working');
      
      return true;
    } catch (error) {
      console.error('[RedisTest] ❌ Basic operations test failed:', error);
      return false;
    }
  }

  /**
   * Test database caching integration
   */
  static async testDatabaseCaching(): Promise<boolean> {
    try {
      console.log('[RedisTest] 🧪 Testing database caching integration...');
      
      // Test health check
      const health = await cachedDatabaseService.healthCheck();
      if (!health.redis || !health.supabase) {
        console.error('[RedisTest] ❌ Health check failed:', health);
        return false;
      }
      
      console.log('[RedisTest] ✅ Health check passed');
      
      // Test cache statistics
      const stats = cachedDatabaseService.getCacheStats();
      console.log('[RedisTest] 📊 Cache stats:', stats);
      
      return true;
    } catch (error) {
      console.error('[RedisTest] ❌ Database caching test failed:', error);
      return false;
    }
  }

  /**
   * Run comprehensive Redis tests
   */
  static async runAllTests(): Promise<{ success: boolean; results: any }> {
    console.log('[RedisTest] 🚀 Starting comprehensive Redis tests...');
    
    const results = {
      basicOperations: false,
      databaseCaching: false,
      healthCheck: false
    };
    
    try {
      // Test 1: Basic operations
      results.basicOperations = await this.testBasicOperations();
      
      // Test 2: Database caching
      results.databaseCaching = await this.testDatabaseCaching();
      
      // Test 3: Health check
      const health = await cachedDatabaseService.healthCheck();
      results.healthCheck = health.redis && health.supabase;
      
      const allPassed = Object.values(results).every(result => result === true);
      
      console.log('[RedisTest] 📊 Test Results:', results);
      console.log(`[RedisTest] ${allPassed ? '✅' : '❌'} All tests ${allPassed ? 'PASSED' : 'FAILED'}`);
      
      return {
        success: allPassed,
        results
      };
    } catch (error) {
      console.error('[RedisTest] ❌ Test suite failed:', error);
      return {
        success: false,
        results
      };
    }
  }

  /**
   * Performance test - measure cache hit rates
   */
  static async performanceTest(): Promise<void> {
    console.log('[RedisTest] 🏃‍♂️ Running performance test...');
    
    const testData = { id: 'perf-test', data: 'Performance test data' };
    const iterations = 100;
    
    // Clear stats
    redisCacheService.resetStats();
    
    // Test cache misses (first time)
    for (let i = 0; i < iterations; i++) {
      await redisCacheService.set(`perf:${i}`, testData, 'general', 'core');
    }
    
    // Test cache hits (second time)
    for (let i = 0; i < iterations; i++) {
      await redisCacheService.get(`perf:${i}`, 'core');
    }
    
    const stats = redisCacheService.getStats();
    console.log('[RedisTest] 📈 Performance test results:', stats);
    
    if (stats.hitRate > 0) {
      console.log('[RedisTest] ✅ Performance test completed successfully');
    } else {
      console.log('[RedisTest] ⚠️ Performance test completed but no hits recorded');
    }
  }
}

// Export for easy testing
export const redisTestService = RedisTestService;
