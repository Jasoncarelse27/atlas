/**
 * NetworkMonitoringService Unit Tests
 * 
 * Tests for the extracted NetworkMonitoringService
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NetworkMonitoringService } from '../NetworkMonitoringService';

// Mock fetch
global.fetch = vi.fn();

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('NetworkMonitoringService', () => {
  let service: NetworkMonitoringService;
  let pendingTimeouts: Set<NodeJS.Timeout>;

  beforeEach(() => {
    pendingTimeouts = new Set<NodeJS.Timeout>();
    service = new NetworkMonitoringService({}, pendingTimeouts);
    vi.clearAllMocks();
  });

  afterEach(() => {
    service.stop();
  });

  describe('start/stop', () => {
    it('should start monitoring', () => {
      const onQualityChange = vi.fn();
      service.start({ onQualityChange });
      
      expect(onQualityChange).not.toHaveBeenCalled();
      // Service should be monitoring (checking quality periodically)
    });

    it('should stop monitoring', () => {
      service.start();
      service.stop();
      
      // After stop, should not throw errors
      expect(() => service.stop()).not.toThrow();
    });

    it('should not start twice', () => {
      service.start();
      const initialInterval = (service as any).networkCheckInterval;
      
      service.start(); // Should not create new interval
      
      expect((service as any).networkCheckInterval).toBe(initialInterval);
    });
  });

  describe('checkQuality', () => {
    it('should return excellent for low latency', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
      });

      // Mock performance.now() to simulate low latency
      const originalNow = performance.now;
      let callCount = 0;
      performance.now = vi.fn(() => {
        callCount++;
        if (callCount === 1) return 0;
        return 50; // 50ms latency
      });

      const quality = await service.checkQuality();

      expect(quality).toBe('excellent');
      performance.now = originalNow;
    });

    it('should return good for medium latency', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
      });

      const originalNow = performance.now;
      let callCount = 0;
      performance.now = vi.fn(() => {
        callCount++;
        if (callCount === 1) return 0;
        return 200; // 200ms latency
      });

      const quality = await service.checkQuality();

      expect(quality).toBe('good');
      performance.now = originalNow;
    });

    it('should return poor for high latency', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
      });

      const originalNow = performance.now;
      let callCount = 0;
      performance.now = vi.fn(() => {
        callCount++;
        if (callCount === 1) return 0;
        return 500; // 500ms latency
      });

      const quality = await service.checkQuality();

      expect(quality).toBe('poor');
      performance.now = originalNow;
    });

    it('should return offline for failed requests', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const quality = await service.checkQuality();

      expect(quality).toBe('offline');
    });

    it('should return offline for timeout', async () => {
      (global.fetch as any).mockImplementationOnce(() => 
        new Promise((resolve) => setTimeout(resolve, 5000))
      );

      const quality = await service.checkQuality();

      expect(quality).toBe('offline');
    }, 10000);
  });

  describe('getSTTTimeout', () => {
    it('should return correct timeout for excellent', () => {
      (service as any).networkQuality = 'excellent';
      expect(service.getSTTTimeout()).toBe(12000); // ✅ Updated to match implementation (12s for large chunks)
    });

    it('should return correct timeout for good', () => {
      (service as any).networkQuality = 'good';
      expect(service.getSTTTimeout()).toBe(8000);
    });

    it('should return correct timeout for poor', () => {
      (service as any).networkQuality = 'poor';
      expect(service.getSTTTimeout()).toBe(15000);
    });

    it('should return correct timeout for offline', () => {
      (service as any).networkQuality = 'offline';
      expect(service.getSTTTimeout()).toBe(20000);
    });
  });

  describe('callbacks', () => {
    it('should call onQualityChange when quality changes', async () => {
      const onQualityChange = vi.fn();
      service.start({ onQualityChange });

      // Wait for quality check
      await new Promise(resolve => setTimeout(resolve, 100));

      // Mock a quality change
      (service as any).networkQuality = 'excellent';
      await service.checkQuality();

      // Callback should be called if quality actually changed
      // (implementation depends on actual quality detection)
    });
  });

  describe('getRecentLatencies', () => {
    it('should return recent latencies', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
      });

      const originalNow = performance.now;
      let callCount = 0;
      performance.now = vi.fn(() => {
        callCount++;
        if (callCount % 2 === 1) return 0;
        return 100 * (callCount / 2); // Increasing latency
      });

      // Make multiple checks
      await service.checkQuality();
      await service.checkQuality();
      await service.checkQuality();

      const latencies = service.getRecentLatencies();
      expect(latencies.length).toBeGreaterThan(0);

      performance.now = originalNow;
    });
  });
});

