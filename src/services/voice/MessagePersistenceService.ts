/**
 * Message Persistence Service
 * 
 * Handles saving voice messages and tracking call metering.
 * Extracted from voiceCallService.ts for better separation of concerns.
 * 
 * Created: 2025-01-01
 */

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabaseClient';
import { ensureConversationExists } from '@/services/conversationGuard';
import type {
  MessagePersistenceService as IMessagePersistenceService,
} from './interfaces';

// 🔒 BRANDING FILTER: Rewrite any mentions of Claude/Anthropic to maintain Atlas identity
// 🎭 STAGE DIRECTION FILTER: Remove stage directions like "*speaks in a friendly voice*"
function filterResponse(text: string): string {
  if (!text) return text;
  
  let filtered = text;
  
  // ✅ CRITICAL FIX: Remove stage directions (text in asterisks OR square brackets)
  // Examples: "*speaks in a friendly voice*", "*responds warmly*", "[In a clear, conversational voice]", "*clears voice*", "*clears throat*"
  // This prevents stage directions from appearing in transcripts or being spoken
  filtered = filtered.replace(/\*[^*]+\*/g, ''); // Remove text between asterisks (includes "*clears voice*", "*clears throat*")
  filtered = filtered.replace(/\[[^\]]+\]/g, ''); // Remove text between square brackets
  filtered = filtered.replace(/\s{2,}/g, ' '); // Collapse multiple spaces (but preserve single spaces)
  
  // Direct identity reveals
  filtered = filtered.replace(/I am Claude/gi, "I'm Atlas");
  filtered = filtered.replace(/I'm Claude/gi, "I'm Atlas");
  filtered = filtered.replace(/called Claude/gi, "called Atlas");
  filtered = filtered.replace(/named Claude/gi, "named Atlas");
  
  // Company mentions
  filtered = filtered.replace(/created by Anthropic/gi, "built by the Atlas team");
  filtered = filtered.replace(/made by Anthropic/gi, "built by the Atlas team");
  filtered = filtered.replace(/Anthropic/gi, "the Atlas development team");
  
  // Model mentions
  filtered = filtered.replace(/Claude Opus/gi, "Atlas Studio");
  filtered = filtered.replace(/Claude Sonnet/gi, "Atlas Core");
  filtered = filtered.replace(/Claude Haiku/gi, "Atlas Free");
  
  // Generic AI mentions that reveal architecture
  filtered = filtered.replace(/as an AI assistant created by/gi, "as your AI companion built by");
  filtered = filtered.replace(/I aim to be direct and honest in my responses\./gi, "I'm here to support your growth with honesty and care.");
  
  return filtered.trim();
}

export class MessagePersistenceService implements IMessagePersistenceService {
  /**
   * Save voice message to database
   */
  async saveMessage(
    text: string,
    role: 'user' | 'assistant',
    conversationId: string,
    userId: string
  ): Promise<void> {
    try {
      // ✅ CRITICAL FIX: Ensure conversation exists before creating message
      const conversationExists = await ensureConversationExists(conversationId, userId);
      if (!conversationExists) {
        logger.error('[MessagePersistence] ❌ Cannot save message - conversation creation failed:', {
          conversationId,
          userId
        });
        throw new Error('Conversation creation failed');
      }

      // ✅ CRITICAL FIX: Filter stage directions before saving (especially for assistant messages)
      const filteredText = role === 'assistant' ? filterResponse(text) : text;
      
      const messageData = {
        conversation_id: conversationId,
        user_id: userId,
        role: role,
        content: filteredText,
      };
      
      const { error } = await supabase.from('messages').insert([messageData] as any);
      
      if (!error) {
        logger.debug(`[MessagePersistence] ✅ Saved ${role} voice message`);
      } else {
        logger.error('[MessagePersistence] Error saving message:', error);
        throw error;
      }
    } catch (error) {
      logger.error('[MessagePersistence] Error saving message:', error);
      throw error;
    }
  }

  /**
   * Track call metering/usage
   */
  async trackCallMetering(
    userId: string,
    durationSeconds: number,
    tier: string
  ): Promise<void> {
    try {
      const sttCost = (durationSeconds / 60) * 0.006;
      const estimatedTTSChars = durationSeconds * 25;
      const ttsCost = (estimatedTTSChars / 1000) * 0.015;
      const totalCost = sttCost + ttsCost;
      
      const { error } = await supabase.from('usage_logs').insert({
        user_id: userId,
        event: 'voice_call_completed',
        data: {
          feature: 'voice_call',
          tier: tier,
          duration_seconds: durationSeconds,
          tokens_used: 0,
          estimated_cost: totalCost,
          cost_breakdown: { stt: sttCost, tts: ttsCost, total: totalCost }
        },
        timestamp: new Date().toISOString(),
        created_at: new Date().toISOString(),
      } as any);
      
      if (!error) {
        logger.info('[MessagePersistence] ✅ Usage logged successfully');
      } else {
        logger.error('[MessagePersistence] Metering failed:', error);
        throw error;
      }
    } catch (error) {
      logger.error('[MessagePersistence] Metering failed:', error);
      throw error;
    }
  }
}

