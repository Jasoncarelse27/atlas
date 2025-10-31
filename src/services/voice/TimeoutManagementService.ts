/**
 * Timeout Management Service
 * 
 * Centralized timeout tracking and cleanup to prevent memory leaks.
 * Extracted from voiceCallService.ts for better resource management.
 * 
 * Created: 2025-01-01
 */

import { logger } from '@/lib/logger';
import type { ITimeoutManagementService } from './interfaces';

export class TimeoutManagementService implements ITimeoutManagementService {
  private pendingTimeouts: Set<NodeJS.Timeout> = new Set();
  private pendingIntervals: Set<NodeJS.Timeout> = new Set();

  /**
   * Create a tracked timeout
   */
  setTimeout(callback: () => void, delay: number): NodeJS.Timeout {
    const timeout = setTimeout(() => {
      this.pendingTimeouts.delete(timeout);
      callback();
    }, delay);
    this.pendingTimeouts.add(timeout);
    return timeout;
  }

  /**
   * Create a tracked interval
   */
  setInterval(callback: () => void, delay: number): NodeJS.Timeout {
    const interval = setInterval(callback, delay);
    this.pendingIntervals.add(interval);
    return interval;
  }

  /**
   * Clear a timeout
   */
  clearTimeout(timeout: NodeJS.Timeout): void {
    clearTimeout(timeout);
    this.pendingTimeouts.delete(timeout);
  }

  /**
   * Clear an interval
   */
  clearInterval(interval: NodeJS.Timeout): void {
    clearInterval(interval);
    this.pendingIntervals.delete(interval);
  }

  /**
   * Clear all timeouts and intervals
   */
  clearAll(): void {
    this.pendingTimeouts.forEach(timeout => clearTimeout(timeout));
    this.pendingIntervals.forEach(interval => clearInterval(interval));
    this.pendingTimeouts.clear();
    this.pendingIntervals.clear();
    logger.debug('[TimeoutManagement] ✅ Cleared all timeouts and intervals');
  }

  /**
   * Get count of pending timeouts
   */
  getPendingTimeoutCount(): number {
    return this.pendingTimeouts.size;
  }

  /**
   * Get count of pending intervals
   */
  getPendingIntervalCount(): number {
    return this.pendingIntervals.size;
  }

  /**
   * Get the underlying Set (for direct access if needed)
   */
  getPendingTimeouts(): Set<NodeJS.Timeout> {
    return this.pendingTimeouts;
  }
}

