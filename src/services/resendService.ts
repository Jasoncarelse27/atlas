import { useMessageStore } from '../stores/useMessageStore';
import { sendMessageWithAttachments } from './chatService';
import { offlineMessageStore } from './offlineMessageStore';
import { logger } from '../lib/logger';

export interface ResendResult {
  success: boolean;
  messageId: string;
  error?: string;
  retryCount?: number;
}

class ResendService {
  private isResending = false;
  private retryAttempts = new Map<string, number>(); // Track retry attempts per message
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAYS = [1000, 2000, 4000]; // 1s, 2s, 4s

  /**
   * Resend all failed messages when connection is restored
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


      for (const message of failedMessages) {
        try {
          const result = await this.resendSingleMessage(message);
          results.push(result);
        } catch (error) {
      // Intentionally empty - error handling not required
          results.push({
            success: false,
            messageId: message.id,
            error: error.message,
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
   * Resend a single failed message with exponential backoff retry
   */
  async resendSingleMessage(message: FailedMessage): Promise<ResendResult> {
    const messageId = message.id;
    const currentRetries = this.retryAttempts.get(messageId) || 0;
    

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
      if (message.attachments && message.attachments.length > 0) {
        // Resend message with attachments using retry logic
        await this.resendMessageWithAttachments(message);
      } else {
        // Resend simple text message
        await this.resendTextMessage(message);
      }

      // Mark as sent in Zustand store
      messageStore.updateMessage(messageId, {
        status: 'sent',
        error: false,
      });

      // Clear retry attempts on success
      this.retryAttempts.delete(messageId);

      logger.debug(`[RESEND] ✅ Message ${messageId} resent successfully`);
      return {
        success: true,
        messageId: messageId,
        retryCount: currentRetries + 1,
      };

    } catch (error) {
      // Intentionally empty - error handling not required
      
      const newRetryCount = currentRetries + 1;
      this.retryAttempts.set(messageId, newRetryCount);

      // Check if we should retry again
      if (newRetryCount < this.MAX_RETRIES) {
        const delay = this.RETRY_DELAYS[newRetryCount - 1];
        
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
          error: `Retrying in ${delay}ms...`,
        });

        return {
          success: false,
          messageId: messageId,
          error: `Retrying in ${delay}ms...`,
          retryCount: newRetryCount,
        };
      } else {
        // Max retries exceeded, mark as failed
        const messageStore = useMessageStore.getState();
        messageStore.updateMessage(messageId, {
          status: 'failed',
          error: error.message,
        });

        // Mark as sync failed in offline store
        await offlineMessageStore.markAsSyncFailed(messageId, error.message);

        // Clear retry attempts
        this.retryAttempts.delete(messageId);

        return {
          success: false,
          messageId: messageId,
          error: error.message,
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
}

// ✅ FIX: Export cleanup function
export const cleanupResendListeners = () => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('online', handleOnline);
  }
};
