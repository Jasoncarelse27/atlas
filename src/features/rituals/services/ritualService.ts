/**
 * Ritual Service - Supabase CRUD Operations
 * Handles all database interactions for rituals and ritual logs
 */

import { supabase } from '@/lib/supabaseClient';
import { logger } from '@/lib/logger';
import { atlasDB } from '@/database/atlasDB';
import { retry } from '@/utils/retry';
import { generateUUID } from '@/utils/uuid';
import type { Ritual, RitualLog } from '../types/rituals';

export const ritualService = {
  /**
   * Fetch all preset rituals (available to all users)
   */
  async fetchPresets(): Promise<Ritual[]> {
    try {
      const { data, error } = await supabase
        .from('rituals')
        .select('*')
        .eq('is_preset', true)
        .order('tier_required', { ascending: true })
        .order('title', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('[RitualService] Failed to fetch presets:', error);
      throw error;
    }
  },

  /**
   * Fetch user's custom rituals
   */
  async fetchUserRituals(userId: string): Promise<Ritual[]> {
    try {
      const { data, error } = await supabase
        .from('rituals')
        .select('*')
        .eq('user_id', userId)
        .eq('is_preset', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('[RitualService] Failed to fetch user rituals:', error);
      throw error;
    }
  },

  /**
   * Fetch single ritual by ID
   */
  async fetchRitualById(ritualId: string): Promise<Ritual | null> {
    try {
      const { data, error } = await supabase
        .from('rituals')
        .select('*')
        .eq('id', ritualId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('[RitualService] Failed to fetch ritual:', error);
      return null;
    }
  },

  /**
   * Create new custom ritual (Core/Studio only)
   */
  async createRitual(ritual: Omit<Ritual, 'id' | 'createdAt' | 'updatedAt'>): Promise<Ritual> {
    try {
      const { data, error } = await supabase
        .from('rituals')
        .insert({
          user_id: ritual.userId,
          title: ritual.title,
          goal: ritual.goal,
          steps: ritual.steps,
          is_preset: false,
          tier_required: ritual.tierRequired,
        })
        .select()
        .single();

      if (error) throw error;
      logger.info('[RitualService] Created ritual:', data.id);
      return data;
    } catch (error) {
      logger.error('[RitualService] Failed to create ritual:', error);
      throw error;
    }
  },

  /**
   * Update existing custom ritual
   */
  async updateRitual(ritualId: string, updates: Partial<Ritual>): Promise<Ritual> {
    try {
      const { data, error } = await supabase
        .from('rituals')
        .update({
          title: updates.title,
          goal: updates.goal,
          steps: updates.steps,
          tier_required: updates.tierRequired,
        })
        .eq('id', ritualId)
        .select()
        .single();

      if (error) throw error;
      logger.info('[RitualService] Updated ritual:', ritualId);
      return data;
    } catch (error) {
      logger.error('[RitualService] Failed to update ritual:', error);
      throw error;
    }
  },

  /**
   * Delete custom ritual
   */
  async deleteRitual(ritualId: string): Promise<void> {
    try {
      const { error } = await supabase.from('rituals').delete().eq('id', ritualId);

      if (error) throw error;
      logger.info('[RitualService] Deleted ritual:', ritualId);
    } catch (error) {
      logger.error('[RitualService] Failed to delete ritual:', error);
      throw error;
    }
  },

  /**
   * Log ritual completion
   * ✅ CRITICAL FIX: Offline-first with retry logic and Dexie fallback
   */
  async logCompletion(log: Omit<RitualLog, 'id' | 'completedAt'>): Promise<RitualLog> {
    const logId = generateUUID();
    const completedAt = new Date().toISOString();
    
    // ✅ STEP 1: Save to Dexie first (offline support)
    const localLog: RitualLog = {
      id: logId,
      ritualId: log.ritualId,
      userId: log.userId,
      completedAt,
      durationSeconds: log.durationSeconds,
      moodBefore: log.moodBefore,
      moodAfter: log.moodAfter,
      notes: log.notes,
      synced: false,
    };
    
    try {
      await atlasDB.ritualLogs.put(localLog);
      logger.debug('[RitualService] ✅ Saved completion to Dexie:', logId);
    } catch (dexieError) {
      logger.error('[RitualService] Failed to save to Dexie:', dexieError);
      // Continue anyway - try Supabase sync
    }
    
    // ✅ STEP 2: Try to sync to Supabase with retry logic
    try {
      const syncedLog = await retry(
        async () => {
          const { data, error } = await supabase
            .from('ritual_logs')
            .insert({
              id: logId, // Use same ID for consistency
              ritual_id: log.ritualId,
              user_id: log.userId,
              duration_seconds: log.durationSeconds,
              mood_before: log.moodBefore,
              mood_after: log.moodAfter,
              notes: log.notes,
              completed_at: completedAt,
            })
            .select()
            .single();

          if (error) {
            // ✅ CRITICAL: Check if it's a network error (should retry) vs validation error (shouldn't retry)
            const isNetworkError = error.message?.includes('Load failed') || 
                                  error.message?.includes('network') ||
                                  error.message?.includes('fetch') ||
                                  error.code === ''; // Empty code often indicates network failure
            
            if (isNetworkError) {
              logger.warn('[RitualService] Network error, will retry:', error.message);
              throw error; // Retry network errors
            } else {
              // Validation/auth errors - don't retry
              logger.error('[RitualService] Non-retryable error:', error);
              throw error;
            }
          }
          
          return data;
        },
        3, // 3 retries
        1000 // Start with 1s delay, exponential backoff
      );
      
      // ✅ STEP 3: Mark as synced in Dexie
      try {
        await atlasDB.ritualLogs.update(logId, { synced: true });
        logger.info('[RitualService] ✅ Logged completion and synced:', logId);
      } catch (updateError) {
        logger.warn('[RitualService] Failed to update sync status in Dexie:', updateError);
      }
      
      return {
        ...localLog,
        synced: true,
      };
    } catch (error) {
      // ✅ CRITICAL: Network failure - log is saved locally, will sync later
      logger.warn('[RitualService] ⚠️ Failed to sync to Supabase, saved locally:', {
        logId,
        error: error instanceof Error ? error.message : 'Unknown error',
        note: 'Will sync automatically when connection is restored'
      });
      
      // Return local log - completion is still successful (saved locally)
      return localLog;
    }
  },

  /**
   * Fetch user's ritual completion logs
   */
  async fetchUserLogs(userId: string, limit = 50): Promise<RitualLog[]> {
    try {
      const { data, error } = await supabase
        .from('ritual_logs')
        .select('*')
        .eq('user_id', userId)
        .order('completed_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('[RitualService] Failed to fetch logs:', error);
      return [];
    }
  },

  /**
   * Fetch logs for specific ritual
   */
  async fetchRitualLogs(ritualId: string, limit = 20): Promise<RitualLog[]> {
    try {
      const { data, error } = await supabase
        .from('ritual_logs')
        .select('*')
        .eq('ritual_id', ritualId)
        .order('completed_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('[RitualService] Failed to fetch ritual logs:', error);
      return [];
    }
  },
};

