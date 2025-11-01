/**
 * Network Quality Monitoring Service
 * 
 * Monitors network connection quality by measuring API latency.
 * Extracted from voiceCallService.ts for better separation of concerns.
 * 
 * Created: 2025-01-01
 */

import { logger } from '@/lib/logger';
import type {
  NetworkQuality,
  NetworkMonitoringServiceConfig,
  NetworkMonitoringServiceCallbacks,
  NetworkMonitoringService as INetworkMonitoringService,
} from './interfaces';

export class NetworkMonitoringService implements INetworkMonitoringService {
  private networkQuality: NetworkQuality = 'excellent';
  private networkCheckInterval: NodeJS.Timeout | null = null;
  private recentApiLatencies: number[] = [];
  private callbacks?: NetworkMonitoringServiceCallbacks;
  private config: NetworkMonitoringServiceConfig;
  private isActive: boolean = false;
  private pendingTimeouts: Set<NodeJS.Timeout>;

  constructor(
    config: Partial<NetworkMonitoringServiceConfig> = {},
    pendingTimeouts: Set<NodeJS.Timeout>
  ) {
    this.config = {
      checkInterval: config.checkInterval ?? 5000,
      maxLatencyHistory: config.maxLatencyHistory ?? 10,
      healthCheckEndpoint: config.healthCheckEndpoint ?? '/api/health',
      healthCheckTimeout: config.healthCheckTimeout ?? 2000,
    };
    this.pendingTimeouts = pendingTimeouts;
  }

  /**
   * Start network quality monitoring
   */
  start(callbacks?: NetworkMonitoringServiceCallbacks): void {
    if (this.networkCheckInterval) {
      return; // Already monitoring
    }

    this.callbacks = callbacks;
    this.isActive = true;

    this.networkCheckInterval = setInterval(async () => {
      if (!this.isActive) return;

      const quality = await this.checkQuality();
      const previousQuality = this.networkQuality;
      this.networkQuality = quality;

      // Log quality changes
      if (quality !== previousQuality) {
        logger.info(`[NetworkMonitoring] 🌐 Network quality: ${previousQuality} → ${quality}`);
        
        // Notify callbacks if quality changed
        this.callbacks?.onQualityChange?.(quality, previousQuality);
      }
    }, this.config.checkInterval);
  }

  /**
   * Stop network quality monitoring
   */
  stop(): void {
    this.isActive = false;
    
    if (this.networkCheckInterval) {
      clearInterval(this.networkCheckInterval);
      this.networkCheckInterval = null;
    }
    
    this.recentApiLatencies = [];
    this.networkQuality = 'excellent';
    this.callbacks = undefined;
  }

  /**
   * Check current network quality by measuring API latency
   */
  async checkQuality(): Promise<NetworkQuality> {
    try {
      const start = performance.now();
      
      // Use a lightweight health check endpoint or simple HEAD request
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.healthCheckTimeout);
      this.pendingTimeouts.add(timeout); // Track timeout for cleanup
      
      try {
        // Try to fetch a lightweight endpoint (use existing API)
        const response = await fetch(this.config.healthCheckEndpoint, { 
          signal: controller.signal,
          method: 'HEAD', // HEAD request is lighter than GET
        });
        clearTimeout(timeout);
        this.pendingTimeouts.delete(timeout); // Remove from tracking when cleared
        
        const latency = performance.now() - start;
        
        if (!response.ok) {
          return 'offline';
        }

        // Track latency history
        this.recentApiLatencies.push(latency);
        if (this.recentApiLatencies.length > this.config.maxLatencyHistory) {
          this.recentApiLatencies.shift();
        }

        // Calculate average latency
        const avgLatency = this.recentApiLatencies.reduce((a, b) => a + b, 0) / this.recentApiLatencies.length;

        // Classify quality based on latency
        if (avgLatency < 100) return 'excellent';
        if (avgLatency < 300) return 'good';
        if (avgLatency < 1000) return 'poor';
        return 'offline';
      } catch (error) {
        clearTimeout(timeout);
        this.pendingTimeouts.delete(timeout); // Remove from tracking when cleared
        if ((error as any).name === 'AbortError') {
          return 'offline';
        }
        throw error;
      }
    } catch (error) {
      logger.debug('[NetworkMonitoring] Network check failed:', error);
      return 'offline';
    }
  }

  /**
   * Get current network quality (cached)
   */
  getQuality(): NetworkQuality {
    return this.networkQuality;
  }

  /**
   * Get adaptive timeout based on network quality
   */
  getSTTTimeout(audioBlobSize?: number): number {
    let baseTimeout: number;
    switch (this.networkQuality) {
      case 'excellent': 
        baseTimeout = 12000;  // ✅ FIX: 12s (was 10s) - handle large chunks
        break;
      case 'good': 
        baseTimeout = 8000;      // 8s
        break;
      case 'poor': 
        baseTimeout = 15000;     // 15s
        break;
      case 'offline': 
        baseTimeout = 20000;  // 20s
        break;
      default: 
        baseTimeout = 10000;
    }
    
    // ✅ FIX: Increase timeout for large chunks (>200KB need more time)
    if (audioBlobSize && audioBlobSize > 200 * 1024) {
      return Math.max(baseTimeout, 15000); // At least 15s for large chunks
    }
    
    return baseTimeout;
  }

  /**
   * Get recent API latencies
   */
  getRecentLatencies(): number[] {
    return [...this.recentApiLatencies];
  }

  /**
   * Set active state (called by VoiceCallService when call starts/stops)
   */
  setActive(active: boolean): void {
    this.isActive = active;
  }
}

