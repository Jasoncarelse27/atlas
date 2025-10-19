import { supabase } from '@/lib/supabaseClient';
import { fastspringService } from '@/services/fastspringService';
import type { FastSpringWebhookEvent } from '@/types/atlas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      delete: vi.fn().mockReturnThis()
    }))
  }
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}));

describe('FastSpring Integration Critical Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Webhook Processing', () => {
    it('should handle subscription.activated webhook', async () => {
      const webhookPayload: FastSpringWebhookEvent = {
        id: 'evt_123',
        created: Date.now(),
        type: 'subscription.activated',
        data: {
          id: 'sub_123',
          account: 'acc_123',
          product: 'atlas-core',
          status: 'active',
          nextPeriodDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
          currency: 'USD',
          price: 19.99
        }
      };

      // Mock successful profile update
      vi.mocked(supabase.from).mockImplementationOnce(() => ({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValueOnce({
          data: { tier: 'core' },
          error: null
        })
      }));

      const result = await fastspringService.processWebhook(webhookPayload);
      
      expect(result.success).toBe(true);
      expect(result.action).toBe('subscription_activated');
    });

    it('should handle subscription.canceled webhook', async () => {
      const webhookPayload: FastSpringWebhookEvent = {
        id: 'evt_124',
        created: Date.now(),
        type: 'subscription.canceled',
        data: {
          id: 'sub_123',
          account: 'acc_123',
          product: 'atlas-core',
          status: 'canceled',
          endDate: Date.now() + 7 * 24 * 60 * 60 * 1000
        }
      };

      vi.mocked(supabase.from).mockImplementationOnce(() => ({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValueOnce({
          data: { status: 'canceled' },
          error: null
        })
      }));

      const result = await fastspringService.processWebhook(webhookPayload);
      
      expect(result.success).toBe(true);
      expect(result.action).toBe('subscription_canceled');
    });

    it('should validate webhook signatures', async () => {
      const payload = JSON.stringify({ type: 'test' });
      const invalidSignature = 'invalid_signature';
      
      const isValid = await fastspringService.validateWebhookSignature(
        payload,
        invalidSignature
      );
      
      expect(isValid).toBe(false);
    });
  });

  describe('Tier Management', () => {
    it('should map FastSpring products to Atlas tiers', () => {
      expect(fastspringService.mapProductToTier('atlas-core')).toBe('core');
      expect(fastspringService.mapProductToTier('atlas-studio')).toBe('studio');
      expect(fastspringService.mapProductToTier('unknown')).toBe('free');
    });

    it('should update user tier after successful payment', async () => {
      const userId = 'user_123';
      const customerId = 'cust_123';
      
      // Mock subscription creation
      vi.mocked(supabase.from).mockImplementationOnce(() => ({
        insert: vi.fn().mockResolvedValueOnce({
          data: { id: 'sub_123' },
          error: null
        })
      }));

      // Mock profile tier update
      vi.mocked(supabase.from).mockImplementationOnce(() => ({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValueOnce({
          data: { tier: 'core' },
          error: null
        })
      }));

      const result = await fastspringService.updateUserSubscription(
        userId,
        customerId,
        'core'
      );
      
      expect(result.success).toBe(true);
      expect(result.tier).toBe('core');
    });

    it('should handle payment failures gracefully', async () => {
      const webhookPayload: FastSpringWebhookEvent = {
        id: 'evt_125',
        created: Date.now(),
        type: 'payment.failed',
        data: {
          subscription: 'sub_123',
          account: 'acc_123',
          reason: 'insufficient_funds'
        }
      };

      // Mock email notification
      const result = await fastspringService.processWebhook(webhookPayload);
      
      expect(result.success).toBe(true);
      expect(result.action).toBe('payment_failed_notification');
    });
  });

  describe('Checkout Flow', () => {
    it('should generate secure checkout session', async () => {
      const userId = 'user_123';
      const productId = 'atlas-core';
      
      const session = await fastspringService.createCheckoutSession(
        userId,
        productId
      );
      
      expect(session).toHaveProperty('url');
      expect(session.url).toContain('fastspring.com');
      expect(session).toHaveProperty('sessionId');
    });

    it('should validate product availability', async () => {
      const isValid = await fastspringService.isValidProduct('atlas-core');
      expect(isValid).toBe(true);
      
      const isInvalid = await fastspringService.isValidProduct('fake-product');
      expect(isInvalid).toBe(false);
    });
  });

  describe('Security', () => {
    it('should not expose API keys in responses', async () => {
      const checkoutSession = await fastspringService.createCheckoutSession(
        'user_123',
        'atlas-core'
      );
      
      expect(JSON.stringify(checkoutSession)).not.toContain('FASTSPRING_API_KEY');
      expect(JSON.stringify(checkoutSession)).not.toContain('FASTSPRING_PRIVATE_KEY');
    });

    it('should sanitize customer data', async () => {
      const maliciousData = {
        email: '<script>alert("xss")</script>@example.com',
        name: 'Test<img src=x onerror=alert(1)>'
      };
      
      const sanitized = await fastspringService.sanitizeCustomerData(maliciousData);
      
      expect(sanitized.email).not.toContain('<script>');
      expect(sanitized.name).not.toContain('<img');
    });

    it('should rate limit webhook processing', async () => {
      const webhookPayload: FastSpringWebhookEvent = {
        id: 'evt_spam',
        created: Date.now(),
        type: 'subscription.activated',
        data: { id: 'sub_spam' }
      };

      // Process multiple webhooks rapidly
      const results = await Promise.all([
        fastspringService.processWebhook(webhookPayload),
        fastspringService.processWebhook(webhookPayload),
        fastspringService.processWebhook(webhookPayload),
        fastspringService.processWebhook(webhookPayload),
        fastspringService.processWebhook(webhookPayload)
      ]);

      // Should have some rate-limited responses
      const rateLimited = results.filter(r => r.error === 'rate_limited');
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });
});
