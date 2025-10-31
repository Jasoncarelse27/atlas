/**
 * TimeoutManagementService Unit Tests
 * 
 * Tests for the extracted TimeoutManagementService
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TimeoutManagementService } from '../TimeoutManagementService';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('TimeoutManagementService', () => {
  let service: TimeoutManagementService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = new TimeoutManagementService();
  });

  afterEach(() => {
    service.clearAll();
    vi.useRealTimers();
  });

  describe('setTimeout', () => {
    it('should create and track timeout', () => {
      const callback = vi.fn();
      const timeout = service.setTimeout(callback, 1000);

      expect(timeout).toBeDefined();
      expect(service.getPendingTimeoutCount()).toBe(1);

      vi.advanceTimersByTime(1000);
      expect(callback).toHaveBeenCalled();
      expect(service.getPendingTimeoutCount()).toBe(0);
    });

    it('should track multiple timeouts', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      service.setTimeout(callback1, 1000);
      service.setTimeout(callback2, 2000);

      expect(service.getPendingTimeoutCount()).toBe(2);

      vi.advanceTimersByTime(1000);
      expect(callback1).toHaveBeenCalled();
      expect(service.getPendingTimeoutCount()).toBe(1);

      vi.advanceTimersByTime(1000);
      expect(callback2).toHaveBeenCalled();
      expect(service.getPendingTimeoutCount()).toBe(0);
    });
  });

  describe('clearTimeout', () => {
    it('should clear tracked timeout', () => {
      const callback = vi.fn();
      const timeout = service.setTimeout(callback, 1000);

      expect(service.getPendingTimeoutCount()).toBe(1);

      service.clearTimeout(timeout);
      expect(service.getPendingTimeoutCount()).toBe(0);

      vi.advanceTimersByTime(1000);
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('setInterval', () => {
    it('should create and track interval', () => {
      const callback = vi.fn();
      const interval = service.setInterval(callback, 1000);

      expect(interval).toBeDefined();
      expect(service.getPendingIntervalCount()).toBe(1);

      vi.advanceTimersByTime(3000);
      expect(callback).toHaveBeenCalledTimes(3);
      expect(service.getPendingIntervalCount()).toBe(1);
    });
  });

  describe('clearInterval', () => {
    it('should clear tracked interval', () => {
      const callback = vi.fn();
      const interval = service.setInterval(callback, 1000);

      expect(service.getPendingIntervalCount()).toBe(1);

      service.clearInterval(interval);
      expect(service.getPendingIntervalCount()).toBe(0);

      vi.advanceTimersByTime(3000);
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('clearAll', () => {
    it('should clear all timeouts and intervals', () => {
      const timeoutCallback = vi.fn();
      const intervalCallback = vi.fn();

      service.setTimeout(timeoutCallback, 1000);
      service.setInterval(intervalCallback, 500);

      expect(service.getPendingTimeoutCount()).toBe(1);
      expect(service.getPendingIntervalCount()).toBe(1);

      service.clearAll();

      expect(service.getPendingTimeoutCount()).toBe(0);
      expect(service.getPendingIntervalCount()).toBe(0);

      vi.advanceTimersByTime(2000);
      expect(timeoutCallback).not.toHaveBeenCalled();
      expect(intervalCallback).not.toHaveBeenCalled();
    });
  });

  describe('getPendingTimeouts', () => {
    it('should return the underlying Set', () => {
      const timeout = service.setTimeout(() => {}, 1000);
      const timeouts = service.getPendingTimeouts();

      expect(timeouts).toBeInstanceOf(Set);
      expect(timeouts.has(timeout)).toBe(true);
    });
  });
});

