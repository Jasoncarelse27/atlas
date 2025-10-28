/**
 * Data Migration Utility for Corrupted Ritual Durations
 * 
 * Background: Some rituals were saved with durations in seconds when they should be in minutes.
 * This utility detects and fixes corrupted data.
 */

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabaseClient';
import type { Ritual } from '../types/rituals';

/**
 * Fix corrupted ritual durations in the database
 * Detects rituals where step durations are < 10 (likely stored as raw seconds instead of proper format)
 */
export async function fixCorruptedRitualDurations(userId: string): Promise<number> {
  try {
    logger.info('[ritualDataMigration] Starting duration fix for user:', userId);

    // Fetch all user's rituals
    const { data: rituals, error } = await supabase
      .from('rituals')
      .select('*')
      .eq('user_id', userId)
      .eq('is_preset', false); // Only fix custom rituals

    if (error) {
      logger.error('[ritualDataMigration] Failed to fetch rituals:', error);
      return 0;
    }

    if (!rituals || rituals.length === 0) {
      logger.info('[ritualDataMigration] No custom rituals found');
      return 0;
    }

    let fixedCount = 0;

    // Cast to any[] to handle snake_case from Supabase
    const ritualsData = rituals as any[];

    for (const ritual of ritualsData) {
      const steps = ritual.steps as any[];

      // Check if any step has suspiciously low duration (< 10 seconds)
      const hasCorruptedDuration = steps.some(step => 
        typeof step.duration === 'number' && step.duration < 10 && step.duration > 0
      );

      if (hasCorruptedDuration) {
        logger.warn('[ritualDataMigration] Found corrupted ritual:', ritual.id, ritual.title);
        
        // Fix: Multiply all durations by 60 (convert "minutes stored as seconds" to actual seconds)
        const fixedSteps = steps.map(step => ({
          ...step,
          duration: step.duration * 60, // Convert to proper seconds
        }));

        // Update in database
        const { error: updateError } = await supabase
          .from('rituals')
          .update({ steps: fixedSteps })
          .eq('id', ritual.id);

        if (updateError) {
          logger.error('[ritualDataMigration] Failed to update ritual:', ritual.id, updateError);
        } else {
          logger.info('[ritualDataMigration] ✅ Fixed ritual:', ritual.id, ritual.title);
          fixedCount++;
        }
      }
    }

    logger.info(`[ritualDataMigration] Migration complete. Fixed ${fixedCount} rituals.`);
    return fixedCount;

  } catch (error) {
    logger.error('[ritualDataMigration] Migration failed:', error);
    return 0;
  }
}

/**
 * Validate that a ritual has correct duration format
 */
export function validateRitualDurations(ritual: Ritual): boolean {
  if (!ritual.steps || ritual.steps.length === 0) return true;

  // All step durations should be >= 10 seconds (even a 1-minute step is 60 seconds)
  return ritual.steps.every(step => 
    typeof step.duration === 'number' && step.duration >= 10
  );
}

/**
 * Format duration for display (handles both corrupted and correct data)
 */
export function safeFormatDuration(seconds: number): string {
  // If suspiciously low, assume it's corrupted (stored in minutes, not seconds)
  if (seconds < 10 && seconds > 0) {
    const mins = Math.round(seconds);
    return `~${mins} min (corrupted data)`;
  }

  // Normal formatting
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  if (mins === 0) return `${secs}s`;
  if (secs === 0) return `${mins} min`;
  return `${mins}m ${secs}s`;
}

