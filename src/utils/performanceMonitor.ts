import { logger } from '../lib/logger';

/**
 * Simple performance monitoring utility for tracking operation times
 */
export class PerformanceMonitor {
  private metrics: Map<string, number> = new Map();
  private readonly SLOW_THRESHOLD_MS = 1000;

  /**
   * Start tracking an operation
   */
  start(label: string): void {
    this.metrics.set(label, performance.now());
  }

  /**
   * End tracking and return duration
   */
  end(label: string): number | null {
    const startTime = this.metrics.get(label);
    if (!startTime) {
      logger.warn(`[PerformanceMonitor] No start time found for: ${label}`);
      return null;
    }
    
    const duration = performance.now() - startTime;
    this.metrics.delete(label);
    
    // Log slow operations
    if (duration > this.SLOW_THRESHOLD_MS) {
      logger.warn(`⚠️ [PerformanceMonitor] Slow operation: ${label} took ${duration.toFixed(0)}ms`);
    }
    
    return duration;
  }

  /**
   * Track an async operation
   */
  async track<T>(label: string, operation: () => Promise<T>): Promise<T> {
    this.start(label);
    try {
      const result = await operation();
      const duration = this.end(label);
      logger.debug(`✅ [${label}] Completed in ${duration?.toFixed(0)}ms`);
      return result;
    } catch (error) {
      this.end(label);
      throw error;
    }
  }

  /**
   * Get all active metrics
   */
  getActiveMetrics(): string[] {
    return Array.from(this.metrics.keys());
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
  }
}

// Global instance
export const perfMonitor = new PerformanceMonitor();

