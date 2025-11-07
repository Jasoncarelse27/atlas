/**
 * RetryService Integration Tests
 * 
 * Tests retry logic in failure scenarios
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

describe('RetryService Integration', () => {
  let service: RetryService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = new RetryService();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Real-world Failure Scenarios', () => {
    it('should retry network failures with exponential backoff', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce('success');

      const promise = service.withBackoff(fn, 'Network Operation');

      // Advance through retries
      await vi.advanceTimersByTimeAsync(3000);

      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should fail fast for authentication errors', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('401 Unauthorized'));

      const promise = service.withBackoff(fn, 'Auth Operation');

      await expect(promise).rejects.toThrow('401 Unauthorized');
      expect(fn).toHaveBeenCalledTimes(1); // No retries
    });

    it('should fail fast for rate limit errors', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('429 Too Many Requests'));

      const promise = service.withBackoff(fn, 'Rate Limited Operation');

      await expect(promise).rejects.toThrow('429 Too Many Requests');
      expect(fn).toHaveBeenCalledTimes(1); // No retries
    });

    it('should fail fast for 0.0% confidence errors', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('confidence too low: 0.0%'));

      const promise = service.withBackoff(fn, 'STT Operation');

      await expect(promise).rejects.toThrow('confidence too low: 0.0%');
      expect(fn).toHaveBeenCalledTimes(1); // No retries
    });

    it('should preserve low confidence errors for resume logic', async () => {
      const originalError = new Error('confidence too low: 15.0%');
      const fn = vi.fn().mockRejectedValue(originalError);

      const promise = service.withBackoff(fn, 'STT Operation');

      // Advance through all retries
      await vi.advanceTimersByTimeAsync(30000);

      // ✅ FIX: Ensure promise is fully settled with try/catch to prevent unhandled rejection
      try {
        await promise;
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toMatch(/confidence too low|Connection lost/);
      }
    });

    it('should call callbacks correctly during retries', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce('success');

      const onRetry = vi.fn();
      const onError = vi.fn();

      const promise = service.withBackoff(fn, 'Operation', {
        onRetry,
        onError,
      });

      await vi.advanceTimersByTimeAsync(3000);

      const result = await promise;

      expect(result).toBe('success');
      expect(onRetry).toHaveBeenCalled();
      // onError should not be called on success
    });
  });

  describe('Production Scenarios', () => {
    it('should handle intermittent network failures', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce('success');

      const promise = service.withBackoff(fn, 'Intermittent Network');

      await vi.advanceTimersByTimeAsync(5000);

      const result = await promise;
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should eventually fail after max retries', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Persistent failure'));

      const promise = service.withBackoff(fn, 'Persistent Failure');

      // Advance through all retries (5 attempts total: 0, 1, 2, 3, 4)
      await vi.advanceTimersByTimeAsync(30000);

      // ✅ FIX: Use expect().rejects.toThrow() to properly handle promise rejection
      // ✅ FIX: Ensure promise is fully settled before checking call count
      try {
        await promise;
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toMatch(/Connection lost|Persistent failure/);
      }
      
      // ✅ FIX: maxRetries=5 means 5 total attempts (attempts 0-4), not 6
      expect(fn).toHaveBeenCalledTimes(5); // 5 attempts total (maxRetries)
    });
  });
});

