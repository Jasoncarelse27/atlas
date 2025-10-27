/**
 * Ritual Service - Supabase CRUD Operations
 * Handles all database interactions for rituals and ritual logs
 */

import { supabase } from '@/lib/supabaseClient';
import { logger } from '@/lib/logger';
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
   */
  async logCompletion(log: Omit<RitualLog, 'id' | 'completedAt'>): Promise<RitualLog> {
    try {
      const { data, error } = await supabase
        .from('ritual_logs')
        .insert({
          ritual_id: log.ritualId,
          user_id: log.userId,
          duration_seconds: log.durationSeconds,
          mood_before: log.moodBefore,
          mood_after: log.moodAfter,
          notes: log.notes,
        })
        .select()
        .single();

      if (error) throw error;
      logger.info('[RitualService] Logged completion:', data.id);
      return data;
    } catch (error) {
      logger.error('[RitualService] Failed to log completion:', error);
      throw error;
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

