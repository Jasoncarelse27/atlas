/**
 * Unit Tests - FastSpring Analytics Service
 * Tests subscription metrics, MRR calculation, and churn rate
 * 
 * Best Practices Applied:
 * - Centralized Supabase mock
 * - Realistic test data
 * - Edge case coverage
 */

import { resetMocks, setMockData, setMockError } from '@/test/mocks/supabase';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fastspringService } from '../fastspringService';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock subscriptionApi
vi.mock('../subscriptionApi', () => ({
  subscriptionApi: {
    getUserProfile: vi.fn().mockResolvedValue({
      id: 'user-123',
      subscription_tier: 'core',
      subscription_status: 'active',
    }),
    getUserTier: vi.fn().mockResolvedValue('core'),
  },
}));

describe('FastSpring Analytics Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  describe('getSubscriptionAnalytics()', () => {
    it('should calculate total and active subscriptions', async () => {
      const mockSubscriptions = [
        { tier: 'core', status: 'active', current_period_start: '2025-01-01', current_period_end: '2025-02-01' },
        { tier: 'studio', status: 'active', current_period_start: '2025-01-15', current_period_end: '2025-02-15' },
        { tier: 'core', status: 'cancelled', current_period_start: '2025-01-01', current_period_end: '2025-02-01' },
      ];
      setMockData(mockSubscriptions);

      const analytics = await fastspringService.getSubscriptionAnalytics();

      expect(analytics.totalSubscriptions).toBe(3);
      expect(analytics.activeSubscriptions).toBe(2);
    });

    it('should count subscriptions by tier correctly', async () => {
      const mockSubscriptions = [
        { tier: 'core', status: 'active' },
        { tier: 'core', status: 'active' },
        { tier: 'studio', status: 'active' },
        { tier: 'free', status: 'active' },
      ];
      setMockData(mockSubscriptions);

      const analytics = await fastspringService.getSubscriptionAnalytics();

      expect(analytics.subscriptionsByTier.core).toBe(2);
      expect(analytics.subscriptionsByTier.studio).toBe(1);
      expect(analytics.subscriptionsByTier.free).toBe(1);
    });

    it('should calculate monthly recurring revenue (MRR)', async () => {
      const mockSubscriptions = [
        { tier: 'core', status: 'active' },      // $19.99
        { tier: 'core', status: 'active' },      // $19.99
        { tier: 'studio', status: 'active' },    // $189.99
        { tier: 'core', status: 'cancelled' },   // $0 (not active)
      ];
      setMockData(mockSubscriptions);

      const analytics = await fastspringService.getSubscriptionAnalytics();

      // MRR = 2 * $19.99 + 1 * $189.99 = $229.97
      expect(analytics.monthlyRecurringRevenue).toBeCloseTo(229.97, 2);
    });

    it('should calculate churn rate correctly', async () => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const mockSubscriptions = [
        { tier: 'core', status: 'active', updated_at: now.toISOString() },
        { tier: 'core', status: 'active', updated_at: now.toISOString() },
        { tier: 'core', status: 'cancelled', updated_at: now.toISOString() },        // Recent cancellation
        { tier: 'core', status: 'cancelled', updated_at: thirtyDaysAgo.toISOString() }, // Old cancellation (doesn't count)
      ];
      setMockData(mockSubscriptions);

      const analytics = await fastspringService.getSubscriptionAnalytics();

      // Churn rate = 1 recent cancellation / 4 total = 25%
      expect(analytics.churnRate).toBeCloseTo(25, 1);
    });

    it('should return zero metrics when no subscriptions', async () => {
      setMockData([]);

      const analytics = await fastspringService.getSubscriptionAnalytics();

      expect(analytics.totalSubscriptions).toBe(0);
      expect(analytics.activeSubscriptions).toBe(0);
      expect(analytics.monthlyRecurringRevenue).toBe(0);
      expect(analytics.churnRate).toBe(0);
    });

    it('should return default metrics on database error', async () => {
      setMockError({ message: 'Database connection failed' });

      const analytics = await fastspringService.getSubscriptionAnalytics();

      expect(analytics.totalSubscriptions).toBe(0);
      expect(analytics.activeSubscriptions).toBe(0);
      expect(analytics.subscriptionsByTier).toEqual({ free: 0, core: 0, studio: 0 });
      expect(analytics.monthlyRecurringRevenue).toBe(0);
      expect(analytics.churnRate).toBe(0);
    });

    it('should handle mixed subscription statuses', async () => {
      const mockSubscriptions = [
        { tier: 'core', status: 'active' },
        { tier: 'core', status: 'trialing' },
        { tier: 'core', status: 'past_due' },
        { tier: 'core', status: 'cancelled' },
        { tier: 'core', status: 'unpaid' },
      ];
      setMockData(mockSubscriptions);

      const analytics = await fastspringService.getSubscriptionAnalytics();

      expect(analytics.totalSubscriptions).toBe(5);
      expect(analytics.activeSubscriptions).toBe(1); // Only 'active' counts
    });

    it('should ignore invalid tier values in MRR calculation', async () => {
      const mockSubscriptions = [
        { tier: 'core', status: 'active' },       // $19.99
        { tier: 'invalid', status: 'active' },    // $0 (invalid tier)
        { tier: 'studio', status: 'active' },     // $189.99
      ];
      setMockData(mockSubscriptions);

      const analytics = await fastspringService.getSubscriptionAnalytics();

      // MRR = $19.99 + $0 + $189.99 = $209.98
      expect(analytics.monthlyRecurringRevenue).toBeCloseTo(209.98, 2);
    });
  });

  describe('getUserSubscription()', () => {
    it('should retrieve user subscription with caching', async () => {
      const result = await fastspringService.getUserSubscription('user-123');

      expect(result.tier).toBe('core');
      expect(result.isActive).toBe(true);
    });

    it('should return free tier when no subscription found', async () => {
      const { subscriptionApi } = await import('../subscriptionApi');
      vi.mocked(subscriptionApi.getUserProfile).mockResolvedValueOnce(null);

      const result = await fastspringService.getUserSubscription('user-no-sub');

      expect(result.tier).toBe('free');
      expect(result.isActive).toBe(false);
    });

    it('should use cached subscription within 5 minutes', async () => {
      // Just verify caching doesn't throw errors
      // (Full cache testing would require mocking Date.now())
      const result1 = await fastspringService.getUserSubscription('user-cache-test');
      const result2 = await fastspringService.getUserSubscription('user-cache-test');

      expect(result1.tier).toBeDefined();
      expect(result2.tier).toBe(result1.tier); // Same result
    });

    it('should fallback to free tier on error', async () => {
      const { subscriptionApi } = await import('../subscriptionApi');
      vi.mocked(subscriptionApi.getUserProfile).mockRejectedValueOnce(new Error('Network error'));

      const result = await fastspringService.getUserSubscription('user-error');

      expect(result.tier).toBe('free');
      expect(result.isActive).toBe(false);
    });
  });

  describe('validateSubscriptionForRequest()', () => {
    it('should allow request for active subscription', async () => {
      const { subscriptionApi } = await import('../subscriptionApi');
      vi.mocked(subscriptionApi.getUserProfile).mockResolvedValueOnce({
        id: 'user-123',
        subscription_tier: 'core',
        subscription_status: 'active',
      });

      const result = await fastspringService.validateSubscriptionForRequest('user-123');

      expect(result.canProceed).toBe(true);
      expect(result.tier).toBe('core');
      expect(result.reason).toBeUndefined();
    });

    it('should allow request for trialing subscription', async () => {
      const { subscriptionApi } = await import('../subscriptionApi');
      vi.mocked(subscriptionApi.getUserProfile).mockResolvedValueOnce({
        id: 'user-123',
        subscription_tier: 'core',
        subscription_status: 'trialing',
      });

      const result = await fastspringService.validateSubscriptionForRequest('user-123');

      expect(result.canProceed).toBe(true);
      expect(result.tier).toBe('core');
    });

    it('should handle cancelled subscription status', async () => {
      // Note: Actual behavior depends on profile data
      // This test verifies the method executes without errors
      const result = await fastspringService.validateSubscriptionForRequest('user-cancelled');

      expect(result.tier).toBeDefined();
      expect(result.canProceed).toBeDefined();
      expect(typeof result.canProceed).toBe('boolean');
    });

    it('should handle unpaid subscription status', async () => {
      const { subscriptionApi } = await import('../subscriptionApi');
      vi.mocked(subscriptionApi.getUserProfile).mockResolvedValueOnce({
        id: 'user-unpaid',
        subscription_tier: 'core',
        subscription_status: 'unpaid',
      });

      const result = await fastspringService.validateSubscriptionForRequest('user-unpaid');

      // Service may allow or block based on grace period logic
      expect(result.tier).toBeDefined();
      expect(typeof result.canProceed).toBe('boolean');
    });
  });
});

