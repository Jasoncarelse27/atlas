/**
 * Performance Monitoring Service
 * Tracks API response times, slow operations, and memory usage
 * Integrates with Sentry for alerting
 */

import { logger } from '@/lib/logger';
import { captureMessage } from './sentryService';

interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: number;
  context?: Record<string, unknown>;
}

interface OperationTimer {
  startTime: number;
  operation: string;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private timers: Map<string, OperationTimer> = new Map();
  private maxMetrics = 1000; // Keep last 1000 metrics in memory
  
  // Performance thresholds (milliseconds)
  private readonly SLOW_API_THRESHOLD = 2000; // 2 seconds
  private readonly CRITICAL_API_THRESHOLD = 5000; // 5 seconds
  private readonly MEMORY_WARNING_MB = 100; // 100MB
  
  /**
   * Start timing an operation
   */
  start(operation: string): void {
    const startTime = performance.now();
    this.timers.set(operation, { startTime, operation });
    
    if (import.meta.env.DEV) {
      logger.debug(`[PerfMonitor] Started: ${operation}`);
    }
  }
  
  /**
   * End timing and record metric
   */
  end(operation: string, context?: Record<string, unknown>): number | null {
    const timer = this.timers.get(operation);
    if (!timer) {
      logger.warn(`[PerfMonitor] No timer found for operation: ${operation}`);
      return null;
    }
    
    const duration = performance.now() - timer.startTime;
    this.timers.delete(operation);
    
    // Record metric
    const metric: PerformanceMetric = {
      operation,
      duration,
      timestamp: Date.now(),
      context,
    };
    
    this.metrics.push(metric);
    
    // Trim old metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
    
    // Check thresholds and alert if needed
    this.checkThresholds(metric);
    
    if (import.meta.env.DEV) {
      logger.debug(`[PerfMonitor] ${operation}: ${duration.toFixed(0)}ms`);
    }
    
    return duration;
  }
  
  /**
   * Check performance thresholds and send alerts
   */
  private checkThresholds(metric: PerformanceMetric): void {
    // Critical threshold - always alert
    if (metric.duration > this.CRITICAL_API_THRESHOLD) {
      captureMessage(
        `CRITICAL: ${metric.operation} took ${(metric.duration / 1000).toFixed(2)}s`,
        'error'
      );
      
      logger.error(`[PerfMonitor] CRITICAL SLOW: ${metric.operation} took ${metric.duration.toFixed(0)}ms`, metric.context);
      return;
    }
    
    // Slow threshold - warning
    if (metric.duration > this.SLOW_API_THRESHOLD) {
      // Only send to Sentry in production to avoid noise
      if (import.meta.env.PROD) {
        captureMessage(
          `SLOW: ${metric.operation} took ${(metric.duration / 1000).toFixed(2)}s`,
          'warning'
        );
      }
      
      logger.warn(`[PerfMonitor] SLOW: ${metric.operation} took ${metric.duration.toFixed(0)}ms`, metric.context);
    }
  }
  
  /**
   * Get average duration for an operation
   */
  getAverageDuration(operation: string, last: number = 10): number | null {
    const operationMetrics = this.metrics
      .filter(m => m.operation === operation)
      .slice(-last);
    
    if (operationMetrics.length === 0) {
      return null;
    }
    
    const sum = operationMetrics.reduce((acc, m) => acc + m.duration, 0);
    return sum / operationMetrics.length;
  }
  
  /**
   * Get p95 duration for an operation
   */
  getP95Duration(operation: string): number | null {
    const operationMetrics = this.metrics
      .filter(m => m.operation === operation)
      .map(m => m.duration)
      .sort((a, b) => a - b);
    
    if (operationMetrics.length === 0) {
      return null;
    }
    
    const p95Index = Math.floor(operationMetrics.length * 0.95);
    return operationMetrics[p95Index];
  }
  
  /**
   * Get slow operations count
   */
  getSlowOperationsCount(minutes: number = 5): number {
    const threshold = Date.now() - minutes * 60 * 1000;
    return this.metrics.filter(m => 
      m.timestamp > threshold && m.duration > this.SLOW_API_THRESHOLD
    ).length;
  }
  
  /**
   * Get performance summary
   */
  getSummary() {
    const now = Date.now();
    const last5min = this.metrics.filter(m => m.timestamp > now - 5 * 60 * 1000);
    const last1hour = this.metrics.filter(m => m.timestamp > now - 60 * 60 * 1000);
    
    const slowOpsLast5min = last5min.filter(m => m.duration > this.SLOW_API_THRESHOLD).length;
    const criticalOpsLast5min = last5min.filter(m => m.duration > this.CRITICAL_API_THRESHOLD).length;
    
    return {
      totalOperations: this.metrics.length,
      operationsLast5min: last5min.length,
      operationsLast1hour: last1hour.length,
      slowOperationsLast5min: slowOpsLast5min,
      criticalOperationsLast5min: criticalOpsLast5min,
      averageDurationLast5min: last5min.length > 0
        ? last5min.reduce((acc, m) => acc + m.duration, 0) / last5min.length
        : 0,
    };
  }
  
  /**
   * Monitor memory usage
   */
  checkMemoryUsage(): void {
    if (typeof performance === 'undefined' || !(performance as any).memory) {
      return; // Not available in all browsers
    }
    
    const memory = (performance as any).memory;
    const usedMB = memory.usedJSHeapSize / 1024 / 1024;
    const limitMB = memory.jsHeapSizeLimit / 1024 / 1024;
    const usagePercent = (usedMB / limitMB) * 100;
    
    // Alert if using more than 80% of available memory
    if (usagePercent > 80 || usedMB > this.MEMORY_WARNING_MB) {
      captureMessage(
        `HIGH MEMORY USAGE: ${usedMB.toFixed(0)}MB (${usagePercent.toFixed(0)}% of limit)`,
        'warning'
      );
      
      logger.warn('[PerfMonitor] High memory usage detected', {
        usedMB: usedMB.toFixed(0),
        limitMB: limitMB.toFixed(0),
        usagePercent: usagePercent.toFixed(0),
      });
    }
  }
  
  /**
   * Clear all metrics (useful for testing)
   */
  clear(): void {
    this.metrics = [];
    this.timers.clear();
  }
  
  /**
   * Get all metrics (for debugging)
   */
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Convenience function for timing async operations
export async function withPerformanceTracking<T>(
  operation: string,
  fn: () => Promise<T>,
  context?: Record<string, unknown>
): Promise<T> {
  performanceMonitor.start(operation);
  try {
    const result = await fn();
    performanceMonitor.end(operation, context);
    return result;
  } catch (error) {
    performanceMonitor.end(operation, { ...context, error: true });
    throw error;
  }
}

// Check memory every 30 seconds in production
if (typeof window !== 'undefined' && import.meta.env.PROD) {
  setInterval(() => {
    performanceMonitor.checkMemoryUsage();
  }, 30000);
}

