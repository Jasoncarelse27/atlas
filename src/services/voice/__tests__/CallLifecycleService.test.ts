/**
 * CallLifecycleService Unit Tests
 * 
 * Tests for the extracted CallLifecycleService
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CallLifecycleService } from '../CallLifecycleService';
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

describe('CallLifecycleService', () => {
  let service: CallLifecycleService;
  let timeoutManager: TimeoutManagementService;

  beforeEach(() => {
    vi.useFakeTimers();
    timeoutManager = new TimeoutManagementService();
    service = new CallLifecycleService(timeoutManager, {
      maxCallDuration: 60000, // 1 minute for testing
    });
  });

  afterEach(() => {
    service.stop();
    vi.useRealTimers();
  });

  describe('start', () => {
    it('should start call lifecycle', () => {
      const callbacks = {
        onCallStarted: vi.fn(),
        onCallStopped: vi.fn(),
        onMaxDurationReached: vi.fn(),
      };

      service.start(callbacks);

      expect(service.isCallActive()).toBe(true);
      expect(callbacks.onCallStarted).toHaveBeenCalled();
    });

    it('should not start if already active', () => {
      const callbacks1 = { onCallStarted: vi.fn() };
      const callbacks2 = { onCallStarted: vi.fn() };

      service.start(callbacks1);
      service.start(callbacks2);

      expect(callbacks1.onCallStarted).toHaveBeenCalledTimes(1);
      expect(callbacks2.onCallStarted).not.toHaveBeenCalled();
    });

    it('should trigger max duration callback', () => {
      const callbacks = {
        onMaxDurationReached: vi.fn(),
      };

      service.start(callbacks);

      // Advance time past max duration (1 minute)
      vi.advanceTimersByTime(61000);

      expect(callbacks.onMaxDurationReached).toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('should stop call lifecycle', () => {
      const callbacks = {
        onCallStopped: vi.fn(),
      };

      service.start(callbacks);
      vi.advanceTimersByTime(5000); // 5 seconds

      service.stop();

      expect(service.isCallActive()).toBe(false);
      expect(callbacks.onCallStopped).toHaveBeenCalledWith(5);
    });

    it('should not throw if stopped when not active', () => {
      expect(() => service.stop()).not.toThrow();
    });
  });

  describe('getCallDuration', () => {
    it('should return 0 when not started', () => {
      expect(service.getCallDuration()).toBe(0);
    });

    it('should return correct duration', () => {
      service.start({});
      vi.advanceTimersByTime(5000);

      const duration = service.getCallDuration();
      expect(duration).toBeCloseTo(5, 1);
    });
  });

  describe('isCallActive', () => {
    it('should return false initially', () => {
      expect(service.isCallActive()).toBe(false);
    });

    it('should return true when started', () => {
      service.start({});
      expect(service.isCallActive()).toBe(true);
    });

    it('should return false after stop', () => {
      service.start({});
      service.stop();
      expect(service.isCallActive()).toBe(false);
    });
  });
});

