/**
 * Integration Tests - Complete Ritual Flow
 * Tests full lifecycle: Create → Run → Complete → Analytics
 */

import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { supabase } from '@/lib/supabaseClient';
import { ritualService } from '../../services/ritualService';
import type { Ritual, RitualLog } from '../../types/rituals';
import { v4 as uuid } from 'uuid';

// Check if we should use real Supabase or mocks
const useRealDB = !!process.env.SUPABASE_TEST_URL;

describe.skipIf(!useRealDB)('Ritual Complete Flow - Integration Tests', () => {
  let testUserId: string;
  let createdRitualIds: string[] = [];
  let createdLogIds: string[] = [];

  beforeEach(() => {
    testUserId = `test-user-${Date.now()}-${uuid()}`;
  });

  afterEach(async () => {
    // Cleanup: Delete all test data in reverse order (logs first, then rituals)
    if (createdLogIds.length > 0) {
      await supabase.from('ritual_logs').delete().in('id', createdLogIds);
    }
    if (createdRitualIds.length > 0) {
      await supabase.from('rituals').delete().in('id', createdRitualIds);
    }
    await supabase.from('rituals').delete().eq('user_id', testUserId);
    await supabase.from('ritual_logs').delete().eq('user_id', testUserId);
    
    createdRitualIds = [];
    createdLogIds = [];
  });

  describe('Complete Ritual Lifecycle', () => {
    it('should complete full ritual journey: create → complete → fetch stats', async () => {
      // 1. CREATE RITUAL
      const ritual = await ritualService.createRitual({
        userId: testUserId,
        title: 'Integration Test Morning Flow',
        goal: 'energy',
        steps: [
          {
            id: uuid(),
            type: 'breathing',
            duration: 60,
            order: 0,
            config: {
              title: 'Deep Breathing',
              instructions: 'Breathe deeply for 1 minute',
            },
          },
          {
            id: uuid(),
            type: 'movement',
            duration: 120,
            order: 1,
            config: {
              title: 'Gentle Stretches',
              instructions: 'Stretch your body for 2 minutes',
            },
          },
        ],
        tierRequired: 'free',
      });

      createdRitualIds.push(ritual.id);

      expect(ritual.id).toBeDefined();
      expect(ritual.title).toBe('Integration Test Morning Flow');
      expect(ritual.steps).toHaveLength(2);

      // 2. FETCH CREATED RITUAL
      const fetchedRitual = await ritualService.fetchRitualById(ritual.id);
      expect(fetchedRitual).toBeDefined();
      expect(fetchedRitual?.id).toBe(ritual.id);

      // 3. COMPLETE RITUAL (log completion)
      const completionLog = await ritualService.logCompletion({
        ritualId: ritual.id,
        userId: testUserId,
        durationSeconds: 180, // 3 minutes total
        moodBefore: '😐',
        moodAfter: '😊',
        notes: 'Felt energized and focused after completing this ritual!',
      });

      createdLogIds.push(completionLog.id);

      expect(completionLog.id).toBeDefined();
      expect(completionLog.ritualId).toBe(ritual.id);
      expect(completionLog.moodBefore).toBe('😐');
      expect(completionLog.moodAfter).toBe('😊');

      // 4. FETCH USER LOGS
      const userLogs = await ritualService.fetchUserLogs(testUserId);
      expect(userLogs).toHaveLength(1);
      expect(userLogs[0].id).toBe(completionLog.id);
      expect(userLogs[0].ritualId).toBe(ritual.id);

      // 5. FETCH RITUAL-SPECIFIC LOGS
      const ritualLogs = await ritualService.fetchRitualLogs(ritual.id);
      expect(ritualLogs).toHaveLength(1);
      expect(ritualLogs[0].id).toBe(completionLog.id);
    });

    it('should handle multiple completions of same ritual', async () => {
      // Create ritual
      const ritual = await ritualService.createRitual({
        userId: testUserId,
        title: 'Daily Meditation',
        goal: 'calm',
        steps: [
          {
            id: uuid(),
            type: 'meditation',
            duration: 300,
            order: 0,
            config: {
              title: '5-Minute Meditation',
              instructions: 'Sit quietly and focus on your breath',
            },
          },
        ],
        tierRequired: 'free',
      });

      createdRitualIds.push(ritual.id);

      // Complete ritual 3 times
      const completion1 = await ritualService.logCompletion({
        ritualId: ritual.id,
        userId: testUserId,
        durationSeconds: 305,
        moodBefore: '😰',
        moodAfter: '😌',
        notes: 'First session',
      });

      const completion2 = await ritualService.logCompletion({
        ritualId: ritual.id,
        userId: testUserId,
        durationSeconds: 300,
        moodBefore: '😐',
        moodAfter: '😌',
        notes: 'Second session',
      });

      const completion3 = await ritualService.logCompletion({
        ritualId: ritual.id,
        userId: testUserId,
        durationSeconds: 310,
        moodBefore: '😔',
        moodAfter: '🙂',
        notes: 'Third session',
      });

      createdLogIds.push(completion1.id, completion2.id, completion3.id);

      // Verify all logs exist
      const ritualLogs = await ritualService.fetchRitualLogs(ritual.id);
      expect(ritualLogs).toHaveLength(3);

      // Verify logs are ordered by completion time (most recent first)
      const userLogs = await ritualService.fetchUserLogs(testUserId);
      expect(userLogs).toHaveLength(3);
      expect(userLogs[0].id).toBe(completion3.id); // Most recent
    });

    it('should handle ritual updates and re-completion', async () => {
      // Create initial ritual
      const ritual = await ritualService.createRitual({
        userId: testUserId,
        title: 'Original Title',
        goal: 'focus',
        steps: [
          {
            id: uuid(),
            type: 'breathing',
            duration: 60,
            order: 0,
            config: {
              title: 'Breathing',
              instructions: 'Breathe',
            },
          },
        ],
        tierRequired: 'free',
      });

      createdRitualIds.push(ritual.id);

      // Complete ritual with original version
      const log1 = await ritualService.logCompletion({
        ritualId: ritual.id,
        userId: testUserId,
        durationSeconds: 65,
        moodBefore: '😐',
        moodAfter: '🙂',
      });

      createdLogIds.push(log1.id);

      // Update ritual
      const updatedRitual = await ritualService.updateRitual(ritual.id, {
        title: 'Updated Title',
        goal: 'creativity',
        steps: [
          {
            id: uuid(),
            type: 'breathing',
            duration: 120,
            order: 0,
            config: {
              title: 'Extended Breathing',
              instructions: 'Breathe longer',
            },
          },
        ],
      });

      expect(updatedRitual.title).toBe('Updated Title');
      expect(updatedRitual.goal).toBe('creativity');

      // Complete updated ritual
      const log2 = await ritualService.logCompletion({
        ritualId: ritual.id,
        userId: testUserId,
        durationSeconds: 125,
        moodBefore: '😐',
        moodAfter: '😊',
      });

      createdLogIds.push(log2.id);

      // Verify both completions exist
      const ritualLogs = await ritualService.fetchRitualLogs(ritual.id);
      expect(ritualLogs).toHaveLength(2);
    });

    it('should handle ritual deletion with existing logs', async () => {
      // Create ritual
      const ritual = await ritualService.createRitual({
        userId: testUserId,
        title: 'To Be Deleted',
        goal: 'energy',
        steps: [
          {
            id: uuid(),
            type: 'movement',
            duration: 60,
            order: 0,
            config: {
              title: 'Movement',
              instructions: 'Move',
            },
          },
        ],
        tierRequired: 'free',
      });

      // Complete ritual
      const log = await ritualService.logCompletion({
        ritualId: ritual.id,
        userId: testUserId,
        durationSeconds: 65,
        moodBefore: '😐',
        moodAfter: '🙂',
      });

      createdLogIds.push(log.id);

      // Delete ritual
      await ritualService.deleteRitual(ritual.id);

      // Verify ritual is deleted
      const fetchedRitual = await ritualService.fetchRitualById(ritual.id);
      expect(fetchedRitual).toBeNull();

      // Logs may still exist (depending on DB cascade rules)
      // This is a business decision - some apps keep logs, others cascade delete
    });
  });

  describe('Multi-Ritual Scenarios', () => {
    it('should handle user with multiple rituals', async () => {
      // Create 3 different rituals
      const ritual1 = await ritualService.createRitual({
        userId: testUserId,
        title: 'Morning Energy',
        goal: 'energy',
        steps: [{ id: uuid(), type: 'breathing', duration: 60, order: 0, config: { title: 'Breathe', instructions: 'Breathe' } }],
        tierRequired: 'free',
      });

      const ritual2 = await ritualService.createRitual({
        userId: testUserId,
        title: 'Afternoon Calm',
        goal: 'calm',
        steps: [{ id: uuid(), type: 'meditation', duration: 120, order: 0, config: { title: 'Meditate', instructions: 'Meditate' } }],
        tierRequired: 'free',
      });

      const ritual3 = await ritualService.createRitual({
        userId: testUserId,
        title: 'Evening Focus',
        goal: 'focus',
        steps: [{ id: uuid(), type: 'breathing', duration: 90, order: 0, config: { title: 'Focus Breathing', instructions: 'Focus' } }],
        tierRequired: 'core',
      });

      createdRitualIds.push(ritual1.id, ritual2.id, ritual3.id);

      // Complete each ritual
      const log1 = await ritualService.logCompletion({
        ritualId: ritual1.id,
        userId: testUserId,
        durationSeconds: 65,
        moodBefore: '😐',
        moodAfter: '😊',
      });

      const log2 = await ritualService.logCompletion({
        ritualId: ritual2.id,
        userId: testUserId,
        durationSeconds: 125,
        moodBefore: '😰',
        moodAfter: '😌',
      });

      const log3 = await ritualService.logCompletion({
        ritualId: ritual3.id,
        userId: testUserId,
        durationSeconds: 95,
        moodBefore: '😐',
        moodAfter: '🙂',
      });

      createdLogIds.push(log1.id, log2.id, log3.id);

      // Fetch user's rituals
      const userRituals = await ritualService.fetchUserRituals(testUserId);
      expect(userRituals).toHaveLength(3);

      // Fetch user's logs
      const userLogs = await ritualService.fetchUserLogs(testUserId);
      expect(userLogs).toHaveLength(3);

      // Verify logs for each ritual
      const ritual1Logs = await ritualService.fetchRitualLogs(ritual1.id);
      expect(ritual1Logs).toHaveLength(1);

      const ritual2Logs = await ritualService.fetchRitualLogs(ritual2.id);
      expect(ritual2Logs).toHaveLength(1);

      const ritual3Logs = await ritualService.fetchRitualLogs(ritual3.id);
      expect(ritual3Logs).toHaveLength(1);
    });
  });
});

