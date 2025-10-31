/**
 * Call Lifecycle Service
 * 
 * Manages voice call start/stop orchestration and resource cleanup.
 * Extracted from voiceCallService.ts for better separation of concerns.
 * 
 * Created: 2025-01-01
 */

import { logger } from '@/lib/logger';
import type { ICallLifecycleService, CallLifecycleCallbacks } from './interfaces';
import { TimeoutManagementService } from './TimeoutManagementService';

export class CallLifecycleService implements ICallLifecycleService {
  private isActive: boolean = false;
  private callStartTime: Date | null = null;
  private durationCheckInterval: NodeJS.Timeout | null = null;
  private timeoutManager: TimeoutManagementService;
  private callbacks?: CallLifecycleCallbacks;
  private maxCallDuration: number;

  constructor(
    timeoutManager: TimeoutManagementService,
    config: { maxCallDuration?: number } = {}
  ) {
    this.timeoutManager = timeoutManager;
    this.maxCallDuration = config.maxCallDuration ?? 30 * 60 * 1000; // 30 minutes
  }

  /**
   * Start call lifecycle
   */
  start(callbacks: CallLifecycleCallbacks): void {
    if (this.isActive) {
      logger.warn('[CallLifecycle] Call already active');
      return;
    }

    this.isActive = true;
    this.callStartTime = new Date();
    this.callbacks = callbacks;

    // Start duration check
    this.durationCheckInterval = this.timeoutManager.setInterval(() => {
      this.checkCallDuration();
    }, 60000); // Check every minute

    logger.info('[CallLifecycle] ✅ Call started');
    callbacks.onCallStarted?.();
  }

  /**
   * Stop call lifecycle
   */
  stop(): void {
    if (!this.isActive) {
      return;
    }

    this.isActive = false;

    // Clear duration check
    if (this.durationCheckInterval) {
      this.timeoutManager.clearInterval(this.durationCheckInterval);
      this.durationCheckInterval = null;
    }

    const duration = this.callStartTime
      ? (Date.now() - this.callStartTime.getTime()) / 1000
      : 0;

    logger.info(`[CallLifecycle] ✅ Call stopped (duration: ${duration.toFixed(1)}s)`);
    this.callbacks?.onCallStopped?.(duration);

    this.callStartTime = null;
    this.callbacks = undefined;
  }

  /**
   * Check if call is active
   */
  isCallActive(): boolean {
    return this.isActive;
  }

  /**
   * Get call duration in seconds
   */
  getCallDuration(): number {
    if (!this.callStartTime) return 0;
    return (Date.now() - this.callStartTime.getTime()) / 1000;
  }

  /**
   * Check call duration and trigger max duration callback if exceeded
   */
  private checkCallDuration(): void {
    if (!this.isActive || !this.callStartTime) return;

    const duration = Date.now() - this.callStartTime.getTime();
    if (duration >= this.maxCallDuration) {
      logger.warn(`[CallLifecycle] ⚠️ Max call duration reached (${this.maxCallDuration / 1000 / 60} minutes)`);
      this.callbacks?.onMaxDurationReached?.();
    }
  }
}

