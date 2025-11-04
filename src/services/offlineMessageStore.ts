// Minimal stub for offlineMessageStore to unblock build
// TODO: Implement full offline message storage functionality

interface FailedMessage {
  id: string;
  content: string;
  conversationId: string;
  timestamp: string;
}

class OfflineMessageStore {
  async getFailedMessages(): Promise<FailedMessage[]> {
    // Return empty array for now - functionality can be implemented later
    return [];
  }

  async markAsRetried(messageId: string): Promise<void> {
    // Stub implementation
  }

  async markAsSyncFailed(messageId: string, error: string): Promise<void> {
    // Stub implementation
  }

  async updateMessage(messageId: string, updates: Partial<FailedMessage>): Promise<void> {
    // Stub implementation
  }

  async getMessage(messageId: string): Promise<FailedMessage | null> {
    return null;
  }

  async deleteMessage(messageId: string): Promise<void> {
    // Stub implementation
  }
}

export const offlineMessageStore = new OfflineMessageStore();

