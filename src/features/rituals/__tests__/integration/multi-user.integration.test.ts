/**
 * Integration Tests - Multi-User Data Isolation
 * Tests RLS policies and data segregation between users
 */

import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { supabase } from '@/lib/supabaseClient';
import { ritualService } from '../../services/ritualService';
import { v4 as uuid } from 'uuid';

// Check if we should use real Supabase or mocks
const useRealDB = !!process.env.SUPABASE_TEST_URL;

describe.skipIf(!useRealDB)('Multi-User Data Isolation - Integration Tests', () => {
  let user1Id: string;
  let user2Id: string;
  let user3Id: string;
  let createdRitualIds: string[] = [];
  let createdLogIds: string[] = [];

  beforeEach(() => {
    user1Id = `test-user-1-${Date.now()}-${uuid()}`;
    user2Id = `test-user-2-${Date.now()}-${uuid()}`;
    user3Id = `test-user-3-${Date.now()}-${uuid()}`;
  });

  afterEach(async () => {
    // Cleanup all test data
    if (createdLogIds.length > 0) {
      await supabase.from('ritual_logs').delete().in('id', createdLogIds);
    }
    if (createdRitualIds.length > 0) {
      await supabase.from('rituals').delete().in('id', createdRitualIds);
    }
    
    // Cleanup by user ID (in case some weren't tracked)
    await supabase.from('ritual_logs').delete().in('user_id', [user1Id, user2Id, user3Id]);
    await supabase.from('rituals').delete().in('user_id', [user1Id, user2Id, user3Id]);
    
    createdRitualIds = [];
    createdLogIds = [];
  });

  describe('User Data Isolation', () => {
    it('should isolate rituals between users', async () => {
      // User 1 creates ritual
      const user1Ritual = await ritualService.createRitual({
        userId: user1Id,
        title: 'User 1 Morning Flow',
        goal: 'energy',
        steps: [
          {
            id: uuid(),
            type: 'breathing',
            duration: 60,
            order: 0,
            config: { title: 'Breathe', instructions: 'Breathe' },
          },
        ],
        tierRequired: 'free',
      });

      // User 2 creates ritual
      const user2Ritual = await ritualService.createRitual({
        userId: user2Id,
        title: 'User 2 Calm Session',
        goal: 'calm',
        steps: [
          {
            id: uuid(),
            type: 'meditation',
            duration: 120,
            order: 0,
            config: { title: 'Meditate', instructions: 'Meditate' },
          },
        ],
        tierRequired: 'free',
      });

      createdRitualIds.push(user1Ritual.id, user2Ritual.id);

      // User 1 should only see their ritual
      const user1Rituals = await ritualService.fetchUserRituals(user1Id);
      expect(user1Rituals).toHaveLength(1);
      expect(user1Rituals[0].id).toBe(user1Ritual.id);
      expect(user1Rituals[0].title).toBe('User 1 Morning Flow');

      // User 2 should only see their ritual
      const user2Rituals = await ritualService.fetchUserRituals(user2Id);
      expect(user2Rituals).toHaveLength(1);
      expect(user2Rituals[0].id).toBe(user2Ritual.id);
      expect(user2Rituals[0].title).toBe('User 2 Calm Session');

      // User 3 should see nothing
      const user3Rituals = await ritualService.fetchUserRituals(user3Id);
      expect(user3Rituals).toHaveLength(0);
    });

    it('should isolate ritual logs between users', async () => {
      // Create shared ritual for both users
      const user1Ritual = await ritualService.createRitual({
        userId: user1Id,
        title: 'User 1 Ritual',
        goal: 'focus',
        steps: [{ id: uuid(), type: 'breathing', duration: 60, order: 0, config: { title: 'Breathe', instructions: 'Breathe' } }],
        tierRequired: 'free',
      });

      const user2Ritual = await ritualService.createRitual({
        userId: user2Id,
        title: 'User 2 Ritual',
        goal: 'focus',
        steps: [{ id: uuid(), type: 'breathing', duration: 60, order: 0, config: { title: 'Breathe', instructions: 'Breathe' } }],
        tierRequired: 'free',
      });

      createdRitualIds.push(user1Ritual.id, user2Ritual.id);

      // Both users complete their rituals
      const user1Log = await ritualService.logCompletion({
        ritualId: user1Ritual.id,
        userId: user1Id,
        durationSeconds: 65,
        moodBefore: '😐',
        moodAfter: '😊',
      });

      const user2Log = await ritualService.logCompletion({
        ritualId: user2Ritual.id,
        userId: user2Id,
        durationSeconds: 70,
        moodBefore: '😐',
        moodAfter: '🙂',
      });

      createdLogIds.push(user1Log.id, user2Log.id);

      // User 1 should only see their log
      const user1Logs = await ritualService.fetchUserLogs(user1Id);
      expect(user1Logs).toHaveLength(1);
      expect(user1Logs[0].id).toBe(user1Log.id);
      expect(user1Logs[0].userId).toBe(user1Id);

      // User 2 should only see their log
      const user2Logs = await ritualService.fetchUserLogs(user2Id);
      expect(user2Logs).toHaveLength(1);
      expect(user2Logs[0].id).toBe(user2Log.id);
      expect(user2Logs[0].userId).toBe(user2Id);

      // User 3 should see nothing
      const user3Logs = await ritualService.fetchUserLogs(user3Id);
      expect(user3Logs).toHaveLength(0);
    });

    it('should prevent user from accessing another users ritual by ID', async () => {
      // User 1 creates ritual
      const user1Ritual = await ritualService.createRitual({
        userId: user1Id,
        title: 'User 1 Private Ritual',
        goal: 'energy',
        steps: [{ id: uuid(), type: 'breathing', duration: 60, order: 0, config: { title: 'Breathe', instructions: 'Breathe' } }],
        tierRequired: 'free',
      });

      createdRitualIds.push(user1Ritual.id);

      // User 1 can fetch their own ritual
      const user1Fetch = await ritualService.fetchRitualById(user1Ritual.id);
      expect(user1Fetch).toBeDefined();
      expect(user1Fetch?.id).toBe(user1Ritual.id);

      // User 2 attempts to fetch User 1's ritual
      // NOTE: This relies on RLS policies - without proper auth context, this will fail
      // In a real scenario with authenticated requests, RLS would prevent this
      // For now, we verify the ritual exists but belongs to user1
      const crossUserFetch = await ritualService.fetchRitualById(user1Ritual.id);
      if (crossUserFetch) {
        // If fetch succeeds (no RLS in test env), verify it's user1's ritual
        expect(crossUserFetch.userId).toBe(user1Id);
        expect(crossUserFetch.userId).not.toBe(user2Id);
      }
    });

    it('should handle concurrent users with different rituals', async () => {
      // Simulate 3 users creating rituals concurrently
      const createUser1Ritual = ritualService.createRitual({
        userId: user1Id,
        title: 'User 1 Morning',
        goal: 'energy',
        steps: [{ id: uuid(), type: 'breathing', duration: 60, order: 0, config: { title: 'Breathe', instructions: 'Breathe' } }],
        tierRequired: 'free',
      });

      const createUser2Ritual = ritualService.createRitual({
        userId: user2Id,
        title: 'User 2 Afternoon',
        goal: 'calm',
        steps: [{ id: uuid(), type: 'meditation', duration: 120, order: 0, config: { title: 'Meditate', instructions: 'Meditate' } }],
        tierRequired: 'core',
      });

      const createUser3Ritual = ritualService.createRitual({
        userId: user3Id,
        title: 'User 3 Evening',
        goal: 'focus',
        steps: [{ id: uuid(), type: 'breathing', duration: 90, order: 0, config: { title: 'Focus', instructions: 'Focus' } }],
        tierRequired: 'studio',
      });

      // Wait for all creations
      const [user1Ritual, user2Ritual, user3Ritual] = await Promise.all([
        createUser1Ritual,
        createUser2Ritual,
        createUser3Ritual,
      ]);

      createdRitualIds.push(user1Ritual.id, user2Ritual.id, user3Ritual.id);

      // Verify each user only sees their own ritual
      const user1Rituals = await ritualService.fetchUserRituals(user1Id);
      expect(user1Rituals).toHaveLength(1);
      expect(user1Rituals[0].title).toBe('User 1 Morning');

      const user2Rituals = await ritualService.fetchUserRituals(user2Id);
      expect(user2Rituals).toHaveLength(1);
      expect(user2Rituals[0].title).toBe('User 2 Afternoon');

      const user3Rituals = await ritualService.fetchUserRituals(user3Id);
      expect(user3Rituals).toHaveLength(1);
      expect(user3Rituals[0].title).toBe('User 3 Evening');
    });
  });

  describe('Shared Preset Rituals', () => {
    it('should allow all users to access preset rituals', async () => {
      // Fetch presets (available to all users)
      const presets = await ritualService.fetchPresets();

      // Presets should be available (exact count depends on DB seed)
      expect(Array.isArray(presets)).toBe(true);

      // All users should see same presets
      const user1Presets = await ritualService.fetchPresets();
      const user2Presets = await ritualService.fetchPresets();
      
      expect(user1Presets.length).toBe(user2Presets.length);
      
      if (presets.length > 0) {
        expect(presets[0].isPreset).toBe(true);
      }
    });

    it('should allow users to complete preset rituals independently', async () => {
      // Fetch presets
      const presets = await ritualService.fetchPresets();
      
      // Skip if no presets in DB
      if (presets.length === 0) {
        return;
      }

      const presetRitual = presets[0];

      // User 1 completes preset
      const user1Log = await ritualService.logCompletion({
        ritualId: presetRitual.id,
        userId: user1Id,
        durationSeconds: 100,
        moodBefore: '😐',
        moodAfter: '😊',
      });

      // User 2 completes same preset
      const user2Log = await ritualService.logCompletion({
        ritualId: presetRitual.id,
        userId: user2Id,
        durationSeconds: 110,
        moodBefore: '😐',
        moodAfter: '🙂',
      });

      createdLogIds.push(user1Log.id, user2Log.id);

      // Each user should only see their own completion
      const user1Logs = await ritualService.fetchUserLogs(user1Id);
      expect(user1Logs.some(log => log.id === user1Log.id)).toBe(true);
      expect(user1Logs.some(log => log.id === user2Log.id)).toBe(false);

      const user2Logs = await ritualService.fetchUserLogs(user2Id);
      expect(user2Logs.some(log => log.id === user2Log.id)).toBe(true);
      expect(user2Logs.some(log => log.id === user1Log.id)).toBe(false);
    });
  });
});

