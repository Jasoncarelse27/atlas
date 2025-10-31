/**
 * RetryService Unit Tests
 * 
 * Tests for the extracted RetryService
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RetryService } from '../RetryService';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('RetryService', () => {
  let service: RetryService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = new RetryService();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('withBackoff', () => {
    it('should succeed on first attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      
      const result = await service.withBackoff(fn, 'test');
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce('success');
      
      const promise = service.withBackoff(fn, 'test');
      
      // Fast-forward through retry delay
      await vi.advanceTimersByTimeAsync(2000);
      
      const result = await promise;
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    }, 10000);

    it('should use exponential backoff', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      
      const promise = service.withBackoff(fn, 'test');
      
      // Advance through all retries (5 retries with delays: 1s, 2s, 4s, 8s, 10s)
      await vi.advanceTimersByTimeAsync(30000);
      
      try {
        await promise;
      } catch (e) {
        // Expected to fail after max retries
        expect(fn).toHaveBeenCalledTimes(5); // MAX_RETRIES
      }
    }, 15000);

    it('should not retry auth errors', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('401 Unauthorized'));
      
      const promise = service.withBackoff(fn, 'test');
      
      await expect(promise).rejects.toThrow('401 Unauthorized');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should not retry 403 errors', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('403 Forbidden'));
      
      const promise = service.withBackoff(fn, 'test');
      
      await expect(promise).rejects.toThrow('403 Forbidden');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should not retry 429 errors', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('429 Too Many Requests'));
      
      const promise = service.withBackoff(fn, 'test');
      
      await expect(promise).rejects.toThrow('429 Too Many Requests');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should not retry 0.0% confidence errors', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('confidence too low: 0.0%'));
      
      const promise = service.withBackoff(fn, 'test');
      
      await expect(promise).rejects.toThrow('confidence too low: 0.0%');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should preserve original error for low confidence', async () => {
      const originalError = new Error('confidence too low: 15.0%');
      const fn = vi.fn().mockRejectedValue(originalError);
      
      const promise = service.withBackoff(fn, 'test');
      
      // Advance through all retries
      await vi.advanceTimersByTimeAsync(30000);
      
      await expect(promise).rejects.toThrow('confidence too low: 15.0%');
    }, 15000);

    it('should call onRetry callback', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce('success');
      
      const onRetry = vi.fn();
      
      const promise = service.withBackoff(fn, 'test', { onRetry });
      
      await vi.advanceTimersByTimeAsync(2000);
      
      await promise;
      
      expect(onRetry).toHaveBeenCalledWith(1, 5); // attempt 1, max 5
    }, 10000);

    it('should call onError callback', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      const onError = vi.fn();
      
      const promise = service.withBackoff(fn, 'test', { onError });
      
      // Advance through retries
      await vi.advanceTimersByTimeAsync(30000);
      
      try {
        await promise;
      } catch (e) {
        // Expected
      }
      
      expect(onError).toHaveBeenCalled();
    }, 15000);

    it('should fail after max retries', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      
      const promise = service.withBackoff(fn, 'test');
      
      // Advance through all retries
      await vi.advanceTimersByTimeAsync(30000);
      
      await expect(promise).rejects.toThrow('Connection lost');
      expect(fn).toHaveBeenCalledTimes(5); // MAX_RETRIES
    }, 15000);
  });

  describe('configuration', () => {
    it('should use custom max retries', async () => {
      const customService = new RetryService({ maxRetries: 3 });
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      
      const promise = customService.withBackoff(fn, 'test');
      
      await vi.advanceTimersByTimeAsync(20000);
      
      try {
        await promise;
      } catch (e) {
        // Expected
      }
      
      expect(fn).toHaveBeenCalledTimes(3);
    }, 15000);

    it('should use custom retry delays', async () => {
      const customService = new RetryService({
        retryDelays: [500, 1000],
      });
      
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce('success');
      
      const promise = customService.withBackoff(fn, 'test');
      
      await vi.advanceTimersByTimeAsync(2000);
      
      const result = await promise;
      expect(result).toBe('success');
    });
  });
});

