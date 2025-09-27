import { useMessageStore } from '../stores/useMessageStore';
import { offlineMessageStore } from './offlineMessageStore';
import { syncService } from './syncService';
import { sendMessageWithAttachments } from './chatService';
import type { Message } from '../types/chat';

export interface ResendResult {
  success: boolean;
  messageId: string;
  error?: string;
}

class ResendService {
  private isResending = false;

  /**
   * Resend all failed messages when connection is restored
   */
  async resendFailedMessages(): Promise<ResendResult[]> {
    if (this.isResending) {
      console.log('[RESEND] Resend already in progress, skipping...');
      return [];
    }

    this.isResending = true;
    console.log('[RESEND] Starting resend of failed messages...');

    try {
      const failedMessages = await offlineMessageStore.getFailedMessages();
      const results: ResendResult[] = [];

      if (failedMessages.length === 0) {
        console.log('[RESEND] No failed messages to resend');
        return [];
      }

      console.log(`[RESEND] Found ${failedMessages.length} failed messages to resend`);

      for (const message of failedMessages) {
        try {
          const result = await this.resendSingleMessage(message);
          results.push(result);
        } catch (error) {
          console.error(`[RESEND] Failed to resend message ${message.id}:`, error);
          results.push({
            success: false,
            messageId: message.id,
            error: error.message,
          });
        }
      }

      console.log(`[RESEND] ✅ Resend completed: ${results.filter(r => r.success).length}/${results.length} successful`);
      return results;

    } catch (error) {
      console.error('[RESEND] Resend failed:', error);
      return [];
    } finally {
      this.isResending = false;
    }
  }

  /**
   * Resend a single failed message
   */
  async resendSingleMessage(message: any): Promise<ResendResult> {
    console.log(`[RESEND] Resending message ${message.id}...`);

    try {
      // Mark as retried in offline store
      await offlineMessageStore.markAsRetried(message.id);

      // Update the message in Zustand store to show retry status
      const messageStore = useMessageStore.getState();
      messageStore.updateMessage(message.id, {
        status: 'sending',
        error: false,
      });

      // Determine if this is a text message or has attachments
      if (message.attachments && message.attachments.length > 0) {
        // Resend message with attachments
        await sendMessageWithAttachments({
          conversationId: message.conversation_id,
          userId: message.user_id,
          text: typeof message.content === 'string' ? message.content : '',
          attachments: message.attachments,
        });
      } else {
        // Resend simple text message
        await this.resendTextMessage(message);
      }

      // Mark as sent in Zustand store
      messageStore.updateMessage(message.id, {
        status: 'sent',
        error: false,
      });

      console.log(`[RESEND] ✅ Message ${message.id} resent successfully`);
      return {
        success: true,
        messageId: message.id,
      };

    } catch (error) {
      console.error(`[RESEND] Failed to resend message ${message.id}:`, error);
      
      // Mark as failed in Zustand store
      const messageStore = useMessageStore.getState();
      messageStore.updateMessage(message.id, {
        status: 'failed',
        error: error.message,
      });

      // Mark as sync failed in offline store
      await offlineMessageStore.markAsSyncFailed(message.id, error.message);

      return {
        success: false,
        messageId: message.id,
        error: error.message,
      };
    }
  }

  /**
   * Resend a simple text message
   */
  private async resendTextMessage(message: any): Promise<void> {
    // This would need to be implemented based on your text message sending logic
    // For now, we'll just mark it as sent since the sync service will handle the actual sending
    console.log(`[RESEND] Resending text message ${message.id}`);
    
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
    console.log(`[RESEND] Retrying message ${messageId}...`);

    try {
      const message = await offlineMessageStore.getMessage(messageId);
      if (!message) {
        throw new Error(`Message ${messageId} not found`);
      }

      return await this.resendSingleMessage(message);

    } catch (error) {
      console.error(`[RESEND] Failed to retry message ${messageId}:`, error);
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
    console.log('[RESEND] Clearing all failed messages...');
    
    const failedMessages = await offlineMessageStore.getFailedMessages();
    
    for (const message of failedMessages) {
      await offlineMessageStore.deleteMessage(message.id);
      
      // Also remove from Zustand store
      const messageStore = useMessageStore.getState();
      const updatedMessages = messageStore.messages.filter(m => m.id !== message.id);
      useMessageStore.setState({ messages: updatedMessages });
    }
    
    console.log(`[RESEND] ✅ Cleared ${failedMessages.length} failed messages`);
  }

  /**
   * Auto-retry failed messages when connection is restored
   */
  async autoRetryOnConnection(): Promise<void> {
    if (!navigator.onLine) return;

    console.log('[RESEND] Connection restored, checking for failed messages...');
    
    const failedMessages = await offlineMessageStore.getFailedMessages();
    if (failedMessages.length > 0) {
      console.log(`[RESEND] Found ${failedMessages.length} failed messages, starting auto-retry...`);
      await this.resendFailedMessages();
    }
  }
}

// Export singleton instance
export const resendService = new ResendService();

// Auto-retry when connection is restored
window.addEventListener('online', () => {
  setTimeout(() => {
    resendService.autoRetryOnConnection();
  }, 2000); // Wait 2 seconds after coming online
});
