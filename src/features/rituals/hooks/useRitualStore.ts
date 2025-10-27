/**
 * Ritual Store - Zustand State Management
 * Manages rituals (presets + custom) with Supabase sync
 */

import { create } from 'zustand';
import { atlasDB } from '@/database/atlasDB';
import { ritualService } from '../services/ritualService';
import { logger } from '@/lib/logger';
import type { Ritual, RitualLog } from '../types/rituals';

interface RitualStore {
  // State
  presets: Ritual[];
  userRituals: Ritual[];
  logs: RitualLog[];
  loading: boolean;
  error: string | null;

  // Actions
  loadPresets: () => Promise<void>;
  loadUserRituals: (userId: string) => Promise<void>;
  loadLogs: (userId: string) => Promise<void>;
  createRitual: (ritual: Omit<Ritual, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Ritual>;
  updateRitual: (ritualId: string, updates: Partial<Ritual>) => Promise<void>;
  deleteRitual: (ritualId: string) => Promise<void>;
  logCompletion: (log: Omit<RitualLog, 'id' | 'completedAt'>) => Promise<void>;
  syncWithDexie: (userId: string) => Promise<void>;
}

export const useRitualStore = create<RitualStore>((set, get) => ({
  // Initial state
  presets: [],
  userRituals: [],
  logs: [],
  loading: false,
  error: null,

  // Load preset rituals (all users)
  loadPresets: async () => {
    set({ loading: true, error: null });
    try {
      // Try Dexie first (offline-first)
      const localPresets = await atlasDB.rituals
        .where('isPreset')
        .equals(true)
        .toArray();

      if (localPresets.length > 0) {
        set({ presets: localPresets, loading: false });
        logger.debug('[RitualStore] Loaded presets from Dexie:', localPresets.length);
      }

      // Fetch from Supabase (always refresh)
      const remotePresets = await ritualService.fetchPresets();

      // Update Dexie cache
      await atlasDB.rituals.bulkPut(remotePresets.map(r => ({
        ...r,
        synced: true,
      })));

      set({ presets: remotePresets, loading: false });
      logger.debug('[RitualStore] Loaded presets from Supabase:', remotePresets.length);
    } catch (error) {
      logger.error('[RitualStore] Failed to load presets:', error);
      set({ error: 'Failed to load rituals', loading: false });
    }
  },

  // Load user's custom rituals
  loadUserRituals: async (userId: string) => {
    set({ loading: true, error: null });
    try {
      // Try Dexie first
      const localRituals = await atlasDB.rituals
        .where('userId')
        .equals(userId)
        .and(r => !r.isPreset)
        .toArray();

      if (localRituals.length > 0) {
        set({ userRituals: localRituals, loading: false });
      }

      // Fetch from Supabase
      const remoteRituals = await ritualService.fetchUserRituals(userId);

      // Update Dexie cache
      await atlasDB.rituals.bulkPut(remoteRituals.map(r => ({
        ...r,
        synced: true,
      })));

      set({ userRituals: remoteRituals, loading: false });
      logger.debug('[RitualStore] Loaded user rituals:', remoteRituals.length);
    } catch (error) {
      logger.error('[RitualStore] Failed to load user rituals:', error);
      set({ error: 'Failed to load your rituals', loading: false });
    }
  },

  // Load user's ritual logs
  loadLogs: async (userId: string) => {
    try {
      // Try Dexie first
      const localLogs = await atlasDB.ritualLogs
        .where('userId')
        .equals(userId)
        .reverse()
        .limit(50)
        .toArray();

      if (localLogs.length > 0) {
        set({ logs: localLogs });
      }

      // Fetch from Supabase
      const remoteLogs = await ritualService.fetchUserLogs(userId);

      // Update Dexie cache
      await atlasDB.ritualLogs.bulkPut(remoteLogs.map(l => ({
        ...l,
        synced: true,
      })));

      set({ logs: remoteLogs });
      logger.debug('[RitualStore] Loaded logs:', remoteLogs.length);
    } catch (error) {
      logger.error('[RitualStore] Failed to load logs:', error);
    }
  },

  // Create new custom ritual
  createRitual: async (ritual) => {
    try {
      // Create in Supabase
      const created = await ritualService.createRitual(ritual);

      // Update Dexie
      await atlasDB.rituals.put({
        ...created,
        synced: true,
      });

      // Update state
      set((state) => ({
        userRituals: [created, ...state.userRituals],
      }));

      logger.info('[RitualStore] Created ritual:', created.id);
      return created;
    } catch (error) {
      logger.error('[RitualStore] Failed to create ritual:', error);
      throw error;
    }
  },

  // Update existing ritual
  updateRitual: async (ritualId, updates) => {
    try {
      const updated = await ritualService.updateRitual(ritualId, updates);

      // Update Dexie
      await atlasDB.rituals.put({
        ...updated,
        synced: true,
      });

      // Update state
      set((state) => ({
        userRituals: state.userRituals.map((r) => (r.id === ritualId ? updated : r)),
      }));

      logger.info('[RitualStore] Updated ritual:', ritualId);
    } catch (error) {
      logger.error('[RitualStore] Failed to update ritual:', error);
      throw error;
    }
  },

  // Delete ritual
  deleteRitual: async (ritualId) => {
    try {
      await ritualService.deleteRitual(ritualId);

      // Delete from Dexie
      await atlasDB.rituals.delete(ritualId);

      // Update state
      set((state) => ({
        userRituals: state.userRituals.filter((r) => r.id !== ritualId),
      }));

      logger.info('[RitualStore] Deleted ritual:', ritualId);
    } catch (error) {
      logger.error('[RitualStore] Failed to delete ritual:', error);
      throw error;
    }
  },

  // Log ritual completion
  logCompletion: async (log) => {
    try {
      const created = await ritualService.logCompletion(log);

      // Update Dexie
      await atlasDB.ritualLogs.put({
        ...created,
        synced: true,
      });

      // Update state
      set((state) => ({
        logs: [created, ...state.logs],
      }));

      logger.info('[RitualStore] Logged completion:', created.id);
    } catch (error) {
      logger.error('[RitualStore] Failed to log completion:', error);
      throw error;
    }
  },

  // Sync offline changes with Supabase
  syncWithDexie: async (userId) => {
    try {
      // Find unsynced rituals
      const unsynced = await atlasDB.rituals
        .where('userId')
        .equals(userId)
        .and(r => !r.synced)
        .toArray();

      for (const ritual of unsynced) {
        try {
          await ritualService.createRitual(ritual);
          await atlasDB.rituals.update(ritual.id, { synced: true });
        } catch (error) {
          logger.error('[RitualStore] Failed to sync ritual:', ritual.id, error);
        }
      }

      // Find unsynced logs
      const unsyncedLogs = await atlasDB.ritualLogs
        .where('userId')
        .equals(userId)
        .and(l => !l.synced)
        .toArray();

      for (const log of unsyncedLogs) {
        try {
          await ritualService.logCompletion(log);
          await atlasDB.ritualLogs.update(log.id, { synced: true });
        } catch (error) {
          logger.error('[RitualStore] Failed to sync log:', log.id, error);
        }
      }

      logger.info('[RitualStore] Sync complete:', { rituals: unsynced.length, logs: unsyncedLogs.length });
    } catch (error) {
      logger.error('[RitualStore] Sync failed:', error);
    }
  },
}));

