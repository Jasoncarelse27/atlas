/**
 * Duration Utilities for Ritual Builder
 * Handles conversion between minutes (UI) and seconds (database)
 */

// Constants for duration validation
export const MIN_DURATION_SECONDS = 10; // Minimum step duration in seconds
export const MIN_DURATION_MINUTES = 0.17; // ~10 seconds in minutes
export const MAX_DURATION_MINUTES = 20; // Maximum step duration in minutes

/**
 * Convert seconds to minutes (for UI display)
 * Handles corrupted data where durations < 10 are already in minutes
 */
export function secondsToMinutes(seconds: number): number {
  // If duration is suspiciously low (< 10), assume it's already in minutes
  if (seconds < MIN_DURATION_SECONDS && seconds > 0) {
    return seconds; // Already in minutes, return as-is
  }
  // Normal conversion: seconds to minutes
  return seconds / 60;
}

/**
 * Convert minutes to seconds (for database storage)
 */
export function minutesToSeconds(minutes: number): number {
  return minutes * 60;
}

/**
 * Normalize step durations when loading from database
 * Handles both old corrupted data and new correct data
 */
export function normalizeStepDurations(steps: Array<{ duration: number }>): Array<{ duration: number }> {
  return steps.map(step => ({
    ...step,
    duration: secondsToMinutes(step.duration),
  }));
}

/**
 * Prepare steps for database storage (convert minutes to seconds)
 */
export function prepareStepsForStorage(steps: Array<{ duration: number }>): Array<{ duration: number }> {
  return steps.map(step => ({
    ...step,
    duration: minutesToSeconds(step.duration),
  }));
}

/**
 * Validate step duration is within acceptable range
 */
export function validateStepDuration(minutes: number): boolean {
  return minutes >= MIN_DURATION_MINUTES && minutes <= MAX_DURATION_MINUTES;
}

