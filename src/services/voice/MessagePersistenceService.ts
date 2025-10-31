/**
 * Message Persistence Service
 * 
 * Handles saving voice messages and tracking call metering.
 * Extracted from voiceCallService.ts for better separation of concerns.
 * 
 * Created: 2025-01-01
 */

import { supabase } from '@/lib/supabaseClient';
import { logger } from '@/lib/logger';
import type {
  MessagePersistenceService as IMessagePersistenceService,
} from './interfaces';

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
      const messageData = {
        conversation_id: conversationId,
        user_id: userId,
        role: role,
        content: text,
      };
      
      const { error } = await supabase.from('messages').insert([messageData]);
      
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
      });
      
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

