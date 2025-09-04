import Dexie from 'dexie';

export interface PendingMessage {
  id?: number;
  content: string;
  conversationId: string;
  role: 'user' | 'assistant';
  user_id: string;
  createdAt: string;
  retryCount: number;
  lastRetry?: string;
}

export const pendingQueueDB = new Dexie('PendingMessages');

pendingQueueDB.version(1).stores({
  messages: '++id, content, conversationId, createdAt, retryCount',
});

/**
 * Add a failed message to the pending queue
 */
export async function addPendingMessage(message: Omit<PendingMessage, 'id' | 'retryCount'>): Promise<number> {
  const pendingMessage: PendingMessage = {
    ...message,
    retryCount: 0,
    createdAt: new Date().toISOString(),
  };
  
  return await pendingQueueDB.table('messages').add(pendingMessage);
}

/**
 * Get all pending messages
 */
export async function getPendingMessages(): Promise<PendingMessage[]> {
  return await pendingQueueDB.table('messages').toArray();
}

/**
 * Update retry count for a message
 */
export async function updateRetryCount(id: number, retryCount: number): Promise<void> {
  await pendingQueueDB.table('messages').update(id, {
    retryCount,
    lastRetry: new Date().toISOString(),
  });
}

/**
 * Remove a successfully sent message from the queue
 */
export async function removePendingMessage(id: number): Promise<void> {
  await pendingQueueDB.table('messages').delete(id);
}

/**
 * Clear all pending messages (useful for logout or reset)
 */
export async function clearPendingQueue(): Promise<void> {
  await pendingQueueDB.table('messages').clear();
}

/**
 * Get messages that are ready for retry (not recently attempted)
 */
export async function getMessagesReadyForRetry(maxRetries: number = 3, retryDelayMinutes: number = 5): Promise<PendingMessage[]> {
  const now = new Date();
  const retryDelayMs = retryDelayMinutes * 60 * 1000;
  
  return await pendingQueueDB.table('messages')
    .where('retryCount')
    .below(maxRetries)
    .filter(message => {
      if (!message.lastRetry) return true;
      const lastRetry = new Date(message.lastRetry);
      return (now.getTime() - lastRetry.getTime()) > retryDelayMs;
    })
    .toArray();
}
