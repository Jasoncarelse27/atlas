/**
 * 🧭 MESSAGE DEDUPLICATION MIDDLEWARE
 * 
 * Lightweight deduplication layer that sits between Dexie and UI
 * - Does NOT store messages (Dexie is single source of truth)
 * - Does NOT replace sync services (they keep working)
 * - Only prevents duplicate renders during async race conditions
 * 
 * Architecture: Dexie → Registry (dedup check) → React State
 */

import type { Message } from '../types/chat';

class MessageDeduplicationMiddleware {
  private static instance: MessageDeduplicationMiddleware;
  
  // Lightweight tracking - only recent message IDs (last 5 minutes)
  private recentMessageIds = new Map<string, number>();
  
  // Content hash tracking for duplicate detection
  private recentContentHashes = new Map<string, number>();
  
  // 5-minute cleanup window
  private readonly CLEANUP_WINDOW = 5 * 60 * 1000; // 5 minutes
  
  private constructor() {
    console.log('[MessageRegistry] 🧭 Initialized deduplication middleware');
    
    // Cleanup old entries every minute
    setInterval(() => this.cleanupOldEntries(), 60 * 1000);
  }
  
  static getInstance(): MessageDeduplicationMiddleware {
    if (!MessageDeduplicationMiddleware.instance) {
      MessageDeduplicationMiddleware.instance = new MessageDeduplicationMiddleware();
    }
    return MessageDeduplicationMiddleware.instance;
  }
  
  /**
   * Generate content hash for duplicate detection (5-second window)
   */
  private generateContentHash(message: Message): string {
    const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
    const timestamp = new Date(message.timestamp).getTime();
    const timeWindow = Math.floor(timestamp / 5000); // 5-second window
    
    const hashInput = `${message.role}:${content}:${timeWindow}`;
    
    // Simple hash function (good enough for deduplication)
    let hash = 0;
    for (let i = 0; i < hashInput.length; i++) {
      const char = hashInput.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return hash.toString(36);
  }
  
  /**
   * Clean up old tracking entries (older than 5 minutes)
   */
  private cleanupOldEntries(): void {
    const now = Date.now();
    
    // Clean up old message IDs
    for (const [id, timestamp] of this.recentMessageIds.entries()) {
      if (now - timestamp > this.CLEANUP_WINDOW) {
        this.recentMessageIds.delete(id);
      }
    }
    
    // Clean up old content hashes
    for (const [hash, timestamp] of this.recentContentHashes.entries()) {
      if (now - timestamp > this.CLEANUP_WINDOW) {
        this.recentContentHashes.delete(hash);
      }
    }
  }
  
  /**
   * Check if message is a duplicate (lightweight check only)
   */
  isDuplicate(message: Message): boolean {
    // Check by ID first (fastest)
    if (this.recentMessageIds.has(message.id)) {
      console.log('[MessageRegistry] ⚠️ Duplicate detected by ID:', message.id);
      return true;
    }
    
    // Check by content hash (catches duplicates with different IDs)
    const contentHash = this.generateContentHash(message);
    if (this.recentContentHashes.has(contentHash)) {
      console.log('[MessageRegistry] ⚠️ Duplicate detected by content hash:', {
        newId: message.id,
        content: typeof message.content === 'string' ? message.content.slice(0, 50) : 'non-string'
      });
      return true;
    }
    
    return false;
  }
  
  /**
   * Track message for deduplication (lightweight tracking only)
   * Returns true if not duplicate, false if duplicate
   */
  trackMessage(message: Message): boolean {
    // Check for duplicates first
    if (this.isDuplicate(message)) {
      return false;
    }
    
    // Track the message (lightweight - no storage)
    const now = Date.now();
    const contentHash = this.generateContentHash(message);
    
    this.recentMessageIds.set(message.id, now);
    this.recentContentHashes.set(contentHash, now);
    
    console.log('[MessageRegistry] ✅ Message tracked for deduplication:', {
      id: message.id,
      role: message.role,
      contentPreview: typeof message.content === 'string' ? message.content.slice(0, 30) : 'non-string'
    });
    
    return true;
  }
  
  /**
   * Track multiple messages (for bulk operations)
   */
  trackMessages(newMessages: Message[]): number {
    let trackedCount = 0;
    
    for (const message of newMessages) {
      if (this.trackMessage(message)) {
        trackedCount++;
      }
    }
    
    return trackedCount;
  }
  
  /**
   * Clear tracking (for conversation switches)
   */
  clearTracking(): void {
    this.recentMessageIds.clear();
    this.recentContentHashes.clear();
    console.log('[MessageRegistry] 🧹 Cleared deduplication tracking');
  }
  
  /**
   * Get tracking stats (for debugging)
   */
  getStats(): { trackedIds: number; trackedHashes: number } {
    return {
      trackedIds: this.recentMessageIds.size,
      trackedHashes: this.recentContentHashes.size
    };
  }
}

// Export singleton instance
export const messageRegistry = MessageDeduplicationMiddleware.getInstance();

