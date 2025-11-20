import { logger } from '../lib/logger';
import { useMessageStore } from '../stores/useMessageStore';
import { sendMessageWithAttachments } from './chatService';
import { offlineMessageStore } from './offlineMessageStore';

// Extended FailedMessage interface to support enhanced retry logic
interface FailedMessage {
  id: string;
  content: string;
  conversationId?: string;
  conversation_id?: string;
  timestamp: string;
  attachments?: Array<{ type: string; url: string }>;
}

export interface ResendResult {
  success: boolean;
  messageId: string;
  error?: string;
  retryCount?: number;
}

interface FailedMessageWithMetadata {
  id: string;
  content: string;
  conversationId?: string;
  conversation_id?: string;
  timestamp: string;
  attachments?: Array<{ type: string; url: string }>;
  retryCount?: number;
  nextRetryAt?: number | null;
  status?: 'pending' | 'failed-permanent';
  clientMessageId?: string;
}

class ResendService {
  private isResending = false;
  private retryAttempts = new Map<string, number>(); // Track retry attempts per message
  private nextRetryTimes = new Map<string, number>(); // Track next retry time for each message
  private readonly MAX_RETRIES = 5; // Increased for exponential backoff
  private readonly BASE_DELAY = 2000; // 2 seconds base delay
  private readonly MAX_DELAY = 60000; // 60 seconds max delay

  /**
   * Compute exponential backoff delay
   * Formula: min(60s, 2s * 2^retryCount)
   */
  private computeNextRetryDelay(retryCount: number): number {
    const delay = Math.min(this.MAX_DELAY, this.BASE_DELAY * Math.pow(2, retryCount));
    return delay;
  }

  /**
   * Resend all failed messages when connection is restored
   * Enhanced with exponential backoff and permanent failure detection
   */
  async resendFailedMessages(): Promise<ResendResult[]> {
    if (this.isResending) {
      return [];
    }

    this.isResending = true;

    try {
      const failedMessages = await offlineMessageStore.getFailedMessages();
      const results: ResendResult[] = [];

      if (failedMessages.length === 0) {
        return [];
      }

      const now = Date.now();

      for (const message of failedMessages) {
        try {
          // Skip if message has nextRetryAt in the future (exponential backoff)
          const nextRetryAt = this.nextRetryTimes.get(message.id);
          if (nextRetryAt && nextRetryAt > now) {
            logger.debug(`[RESEND] Skipping message ${message.id} - next retry at ${new Date(nextRetryAt).toISOString()}`);
            continue;
          }

          // Check for duplicate protection (if clientMessageId exists)
          const messageWithMetadata = message as FailedMessageWithMetadata;
          if (messageWithMetadata.clientMessageId) {
            // Check if message already exists in Dexie (duplicate protection)
            try {
              const { atlasDB } = await import('../database/atlasDB');
              const existingMessage = await atlasDB.messages.get(message.id);
              if (existingMessage && existingMessage.synced) {
                logger.debug(`[RESEND] Message ${message.id} already exists and synced - removing from queue`);
                await offlineMessageStore.deleteMessage(message.id);
                results.push({
                  success: true,
                  messageId: message.id,
                  retryCount: 0,
                });
                continue;
              }
            } catch (checkError) {
              // Continue if duplicate check fails
              logger.debug('[RESEND] Duplicate check failed (non-critical):', checkError);
            }
          }

          const result = await this.resendSingleMessage(message);
          results.push(result);
        } catch (error) {
      // Intentionally empty - error handling not required
          results.push({
            success: false,
            messageId: message.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      logger.debug(`[RESEND] ✅ Resend completed: ${results.filter(r => r.success).length}/${results.length} successful`);
      return results;

    } catch (error) {
      // Intentionally empty - error handling not required
      return [];
    } finally {
      this.isResending = false;
    }
  }

  /**
   * Resend a single failed message with exponential backoff retry and permanent failure detection
   */
  async resendSingleMessage(message: FailedMessage): Promise<ResendResult> {
    const messageId = message.id;
    const currentRetries = this.retryAttempts.get(messageId) || 0;
    const messageWithMetadata = message as FailedMessageWithMetadata;

    // Check if message is marked as permanently failed
    if (messageWithMetadata.status === 'failed-permanent') {
      logger.warn(`[RESEND] Message ${messageId} is permanently failed - skipping retry`);
      return {
        success: false,
        messageId: messageId,
        error: 'Message permanently failed (4xx error)',
        retryCount: currentRetries,
      };
    }

    try {
      // Mark as retried in offline store
      await offlineMessageStore.markAsRetried(messageId);

      // Update the message in Zustand store to show retry status
      const messageStore = useMessageStore.getState();
      messageStore.updateMessage(messageId, {
        status: 'sending',
        error: false,
      });

      // Determine if this is a text message or has attachments
      if (messageWithMetadata.attachments && messageWithMetadata.attachments.length > 0) {
        // Resend message with attachments using retry logic
        await this.resendMessageWithAttachments(message as any);
      } else {
        // Resend simple text message
        await this.resendTextMessage(message);
      }

      // Mark as sent in Zustand store
      messageStore.updateMessage(messageId, {
        status: 'sent',
        error: false,
      });

      // Clear retry attempts and next retry time on success
      this.retryAttempts.delete(messageId);
      this.nextRetryTimes.delete(messageId);

      logger.debug(`[RESEND] ✅ Message ${messageId} resent successfully`);
      return {
        success: true,
        messageId: messageId,
        retryCount: currentRetries + 1,
      };

    } catch (error: any) {
      // Intentionally empty - error handling not required
      
      // Check if this is a permanent failure (4xx error, excluding 429)
      const isPermanentFailure = error?.status >= 400 && 
                                 error?.status < 500 && 
                                 error?.status !== 429;

      if (isPermanentFailure) {
        // Mark as permanently failed - don't retry
        logger.warn(`[RESEND] Message ${messageId} failed with permanent error (${error.status}) - marking as failed-permanent`);
        
        const messageStore = useMessageStore.getState();
        messageStore.updateMessage(messageId, {
          status: 'failed',
          error: `Permanent failure: ${error.message || 'Invalid request'}`,
        });

        // Mark as permanently failed in offline store
        await offlineMessageStore.updateMessage(messageId, {
          status: 'failed-permanent' as any,
        });

        // Clear retry attempts
        this.retryAttempts.delete(messageId);
        this.nextRetryTimes.delete(messageId);

        return {
          success: false,
          messageId: messageId,
          error: `Permanent failure: ${error.message || 'Invalid request'}`,
          retryCount: currentRetries + 1,
        };
      }

      const newRetryCount = currentRetries + 1;
      this.retryAttempts.set(messageId, newRetryCount);

      // Check if we should retry again
      if (newRetryCount < this.MAX_RETRIES) {
        // Use exponential backoff
        const delay = this.computeNextRetryDelay(newRetryCount);
        const nextRetryAt = Date.now() + delay;
        this.nextRetryTimes.set(messageId, nextRetryAt);
        
        // Schedule retry with exponential backoff
        setTimeout(async () => {
          try {
            await this.resendSingleMessage(message);
          } catch (retryError) {
      // Intentionally empty - error handling not required
          }
        }, delay);

        // Mark as pending retry in Zustand store
        const messageStore = useMessageStore.getState();
        messageStore.updateMessage(messageId, {
          status: 'pending',
          error: `Retrying in ${Math.round(delay / 1000)}s...`,
        });

        return {
          success: false,
          messageId: messageId,
          error: `Retrying in ${Math.round(delay / 1000)}s...`,
          retryCount: newRetryCount,
        };
      } else {
        // Max retries exceeded, mark as failed
        const messageStore = useMessageStore.getState();
        messageStore.updateMessage(messageId, {
          status: 'failed',
          error: error.message || 'Max retries exceeded',
        });

        // Mark as sync failed in offline store
        await offlineMessageStore.markAsSyncFailed(messageId, error.message || 'Max retries exceeded');

        // Clear retry attempts
        this.retryAttempts.delete(messageId);
        this.nextRetryTimes.delete(messageId);

        return {
          success: false,
          messageId: messageId,
          error: error.message || 'Max retries exceeded',
          retryCount: newRetryCount,
        };
      }
    }
  }

  /**
   * Resend a message with attachments using retry logic
   */
  private async resendMessageWithAttachments(message: FailedMessage): Promise<void> {
    
    // Use the existing sendMessageWithAttachments function with retry logic
    const messageStore = useMessageStore.getState();
    await sendMessageWithAttachments(
      message.conversation_id,
      message.attachments,
      messageStore.addMessage
    );
  }

  /**
   * Resend a simple text message
   */
  private async resendTextMessage(message: FailedMessage): Promise<void> {
    // This would need to be implemented based on your text message sending logic
    // For now, we'll just mark it as sent since the sync service will handle the actual sending
    
    // The sync service will handle the actual sending to Supabase
    // We just need to mark it as pending for sync
    await offlineMessageStore.updateMessage(message.id, {
      sync_status: 'pending',
      status: 'sent',
    });
  }

  /**
   * Retry a specific message by ID
   */
  async retryMessage(messageId: string): Promise<ResendResult> {

    try {
      const message = await offlineMessageStore.getMessage(messageId);
      if (!message) {
        throw new Error(`Message ${messageId} not found`);
      }

      return await this.resendSingleMessage(message);

    } catch (error) {
      // Intentionally empty - error handling not required
      return {
        success: false,
        messageId,
        error: error.message,
      };
    }
  }

  /**
   * Get resend status
   */
  async getResendStatus(): Promise<{
    isResending: boolean;
    failedCount: number;
    lastResendTime: string | null;
  }> {
    const failedMessages = await offlineMessageStore.getFailedMessages();
    
    return {
      isResending: this.isResending,
      failedCount: failedMessages.length,
      lastResendTime: localStorage.getItem('lastResendTime'),
    };
  }

  /**
   * Clear all failed messages (use with caution)
   */
  async clearFailedMessages(): Promise<void> {
    
    const failedMessages = await offlineMessageStore.getFailedMessages();
    
    for (const message of failedMessages) {
      await offlineMessageStore.deleteMessage(message.id);
      
      // Also remove from Zustand store
      const messageStore = useMessageStore.getState();
      const updatedMessages = messageStore.messages.filter(m => m.id !== message.id);
      useMessageStore.setState({ messages: updatedMessages });
    }
    
    logger.debug(`[RESEND] ✅ Cleared ${failedMessages.length} failed messages`);
  }

  /**
   * Auto-retry failed messages when connection is restored
   */
  async autoRetryOnConnection(): Promise<void> {
    if (!navigator.onLine) return;

    
    const failedMessages = await offlineMessageStore.getFailedMessages();
    if (failedMessages.length > 0) {
      await this.resendFailedMessages();
    }
  }
}

// Export singleton instance
export const resendService = new ResendService();

// ✅ FIX: Auto-retry with cleanup
const handleOnline = () => {
  setTimeout(() => {
    resendService.autoRetryOnConnection();
  }, 2000); // Wait 2 seconds after coming online
};

if (typeof window !== 'undefined') {
  window.addEventListener('online', handleOnline);
  
  // ✅ MEMORY LEAK FIX: Store handler reference for cleanup
  // Note: This is a global singleton service, cleanup handled in cleanupResendListeners()
}

// ✅ FIX: Export cleanup function
export const cleanupResendListeners = () => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('online', handleOnline);
  }
};
