import { createChatError } from '../features/chat/lib/errorHandler';
import db from '../lib/db';
import { offlineMessageStore } from '../services/offlineMessageStore';
import { generateUUID } from "../utils/uuid";

export interface PendingOperation {
  id: string;
  type: 'send_message' | 'delete_message' | 'create_conversation' | 'update_subscription' | 'voice_transcription' | 'image_upload';
  data: any;
  priority: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  retry_count: number;
  created_at: string;
  updated_at: string;
  next_retry?: string;
}

export interface QueueStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  byType: Record<string, number>;
}

export class PendingQueueManager {
  private isProcessing = false;
  private retryDelay = 1000;
  private maxRetryDelay = 30000;
  private maxRetries = 5;

  /**
   * Add operation to pending queue
   */
  async addToQueue(type: PendingOperation['type'], data: any, priority: number = 1): Promise<string> {
    try {
      const operation: PendingOperation = {
        id: generateUUID(),
        type,
        data,
        priority,
        status: 'pending',
        retry_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await db.pending_operations.put(operation);
      return operation.id;
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'addToQueue',
        type,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  }

  /**
   * Process all pending operations
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing) return;

    this.isProcessing = true;
    try {
      // Get pending operations sorted by priority and creation time
      const pendingOperations = await db.pending_operations
        .where('status')
        .equals('pending')
        .and(op => op.retry_count < this.maxRetries)
        .toArray();

      // Sort by priority (higher first) then by creation time (older first)
      const sortedOperations = pendingOperations.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority; // Higher priority first
        }
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      // Process each operation
      for (const operation of sortedOperations) {
        try {
          await this.processOperation(operation);
        } catch (error) {
          console.error(`Failed to process operation ${operation.id}:`, error);
          await this.updateOperationStatus(operation.id, 'failed', { error: error instanceof Error ? error.message : 'Unknown error' });
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single operation
   */
  private async processOperation(operation: PendingOperation): Promise<void> {
    // Mark as processing
    await this.updateOperationStatus(operation.id, 'processing');

    try {
      switch (operation.type) {
        case 'send_message':
          await this.processSendMessage(operation);
          break;
        case 'delete_message':
          await this.processDeleteMessage(operation);
          break;
        case 'create_conversation':
          await this.processCreateConversation(operation);
          break;
        case 'update_subscription':
          await this.processUpdateSubscription(operation);
          break;
        case 'voice_transcription':
          await this.processVoiceTranscription(operation);
          break;
        case 'image_upload':
          await this.processImageUpload(operation);
          break;
        default:
          throw new Error(`Unknown operation type: ${operation.type}`);
      }

      // Mark as completed
      await this.updateOperationStatus(operation.id, 'completed');
    } catch (error) {
      // Handle retry logic
      if (operation.retry_count < this.maxRetries) {
        const nextRetry = new Date(Date.now() + this.calculateRetryDelay(operation.retry_count));
        await this.updateOperationStatus(operation.id, 'pending', {
          retry_count: operation.retry_count + 1,
          next_retry: nextRetry.toISOString(),
        });
      } else {
        // Max retries exceeded
        await this.updateOperationStatus(operation.id, 'failed', {
          error: error instanceof Error ? error.message : 'Max retries exceeded',
        });
      }
      throw error;
    }
  }

  /**
   * Process send message operation
   */
  private async processSendMessage(operation: PendingOperation): Promise<void> {
    const { message, request } = operation.data;
    
    // Import messageService dynamically to avoid circular dependencies
    const { messageService } = await import('../features/chat/services/messageService');
    
    const response = await messageService.sendMessage({
      content: request.content,
      conversationId: request.conversationId,
      userId: request.userId,
      messageType: request.messageType,
      metadata: request.metadata,
    });

    // Update offline store with response
    if (response && response.id) {
      await offlineMessageStore.updateMessage(message.id, {
        id: response.id,
        sync_status: 'synced',
        sync_error: null,
      });
    }
  }

  /**
   * Process delete message operation
   */
  private async processDeleteMessage(operation: PendingOperation): Promise<void> {
    const { messageId, conversationId } = operation.data;
    
    // Import messageService dynamically to avoid circular dependencies
    const { messageService } = await import('../features/chat/services/messageService');
    
    await messageService.deleteMessage(messageId, conversationId);
    
    // Remove from offline store
    await offlineMessageStore.deleteMessage(messageId);
  }

  /**
   * Process create conversation operation
   */
  private async processCreateConversation(operation: PendingOperation): Promise<void> {
    const { conversationData } = operation.data;
    
    // Import conversationService dynamically to avoid circular dependencies
    const { conversationService } = await import('../features/chat/services/conversationService');
    
    const response = await conversationService.createConversation(conversationData);
    
    // Update offline store with response
    // This would require conversation offline store implementation
    console.log('Conversation created:', response);
  }

  /**
   * Process update subscription operation
   */
  private async processUpdateSubscription(operation: PendingOperation): Promise<void> {
    const { subscriptionData } = operation.data;
    
    // Import subscriptionApi dynamically to avoid circular dependencies
    const { subscriptionApi } = await import('../services/subscriptionApi');
    
    // This would depend on the specific subscription update method
    console.log('Subscription update:', subscriptionData);
  }

  /**
   * Process voice transcription operation
   */
  private async processVoiceTranscription(operation: PendingOperation): Promise<void> {
    const { audioBlob, userId } = operation.data;
    
    // Import voiceService dynamically to avoid circular dependencies
    const { voiceService } = await import('../services/voiceService');
    
    const transcript = await voiceService.recordAndTranscribe(audioBlob);
    
    // Update the message with transcript
    // This would require finding the associated message and updating it
    console.log('Voice transcribed:', transcript);
  }

  /**
   * Process image upload operation
   */
  private async processImageUpload(operation: PendingOperation): Promise<void> {
    const { imageFile, userId } = operation.data;
    
    // Import imageService dynamically to avoid circular dependencies
    const { imageService } = await import('../services/imageService');
    
    const result = await imageService.uploadImage(imageFile);
    
    // Update the message with image metadata
    // This would require finding the associated message and updating it
    console.log('Image uploaded:', result);
  }

  /**
   * Update operation status
   */
  private async updateOperationStatus(operationId: string, status: PendingOperation['status'], updates: Partial<PendingOperation> = {}): Promise<void> {
    try {
      await db.pending_operations.update(operationId, {
        status,
        updated_at: new Date().toISOString(),
        ...updates,
      });
    } catch (error) {
      console.error('Failed to update operation status:', error);
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(retryCount: number): number {
    const delay = this.retryDelay * Math.pow(2, retryCount);
    return Math.min(delay, this.maxRetryDelay);
  }

  /**
   * Retry failed operations
   */
  async retryFailedOperations(): Promise<void> {
    try {
      const failedOperations = await db.pending_operations
        .where('status')
        .equals('failed')
        .toArray();

      for (const operation of failedOperations) {
        await this.updateOperationStatus(operation.id, 'pending', {
          retry_count: 0,
          error: undefined,
          next_retry: undefined,
        });
      }

      // Process queue again
      await this.processQueue();
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'retryFailedOperations',
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  }

  /**
   * Clear all operations from queue
   */
  async clearQueue(): Promise<void> {
    try {
      await db.pending_operations.clear();
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'clearQueue',
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<QueueStats> {
    try {
      const allOperations = await db.pending_operations.toArray();
      
      const stats: QueueStats = {
        total: allOperations.length,
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        byType: {},
      };

      allOperations.forEach(op => {
        stats[op.status]++;
        stats.byType[op.type] = (stats.byType[op.type] || 0) + 1;
      });

      return stats;
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'getQueueStats',
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  }

  /**
   * Get operations by type
   */
  async getOperationsByType(type: PendingOperation['type']): Promise<PendingOperation[]> {
    try {
      return await db.pending_operations
        .where('type')
        .equals(type)
        .toArray();
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'getOperationsByType',
        type,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  }

  /**
   * Remove specific operation from queue
   */
  async removeOperation(operationId: string): Promise<void> {
    try {
      await db.pending_operations.delete(operationId);
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'removeOperation',
        operationId,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  }
}

export const pendingQueueManager = new PendingQueueManager();
export type { PendingOperation, QueueStats };
export default pendingQueueManager;
