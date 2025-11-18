/**
 * 🧘 Ritual Runner Hook - Timer & Execution Logic
 * Manages ritual playback, timer countdown, and mood tracking
 */

import { logger } from '@/lib/logger';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Ritual, RitualStep } from '../types/rituals';
import { useRitualStore } from './useRitualStore';
// Inline chime sound (base64 encoded gentle bell)
const CHIME_SOUND = 'data:audio/wav;base64,UklGRh4GAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YfoFAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgoKDhISFhoaHiImKi4yNjo+QkZKTlJWWl5iZmpucnZ6foKGio6SlpqeoqaqrrK2ur7CxsrO0tba3uLm6u7y9vr/AwcLDxMXGx8jJysvMzc7P0NHS09TV1tfY2drb3N3e3+Dh4uPk5ebn6Onq6+zt7u/w8fLz9PX29/j5+vv8/f7/AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIjJCUmJygpKissLS4vMDEyMzQ1Njc4OTo7PD0+P0BBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWltcXV5fYGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6e3x9fn+AgYKDhIWGh4iJiouMjY6PkJGSk5SVlpeYmZqbnJ2en6ChoqOkpaanqKmqq6ytrq+wsbKztLW2t7i5uru8vb6/wMHCw8TFxsfIycrLzM3Oz9DR0tPU1dbX2Nna29zd3t/g4eLj5OXm5+jp6uvs7e7v8PHy8/T19vf4+fr7/P3+/wABAgMEBQYHCAkKCwwNDg8QERITFBUWFxgZGhscHR4fICEiIyQlJicoKSorLC0uLzAxMjM0NTY3ODk6Ozw9Pj9AQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVpbXF1eX2BhYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ent8fX5/gIGCg4SFhoeIiYqLjI2Oj5CRkpOUlZaXmJmam5ydnp+goaKjpKWmp6ipqqusra6vsLGys7S1tre4ubq7vL2+v8DBwsPExcbHyMnKy8zNzs/Q0dLT1NXW19jZ2tvc3d7f4OHi4+Tl5ufo6err7O3u7/Dx8vP09fb3+Pn6+/z9/v8AAQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyAhIiMkJSYnKCkqKywtLi8wMTIzNDU2Nzg5Ojs8PT4/QEFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaW1xdXl9gYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXp7fH1+f4CBgoOEhYaHiImKi4yNjo+QkZKTlJWWl5iZmpucnZ6foKGio6SlpqeoqaqrrK2ur7CxsrO0tba3uLm6u7y9vr/AwcLDxMXGx8jJysvMzc7P0NHS09TV1tfY2drb3N3e3+Dh4uPk5ebn6Onq6+zt7u/w8fLz9PX29/j5+vv8/f7/AAECA=';

interface UseRitualRunnerProps {
  ritual: Ritual | undefined;
  userId: string;
}

interface RitualRunnerState {
  // State
  currentStepIndex: number;
  timeRemaining: number; // seconds
  isPaused: boolean;
  isComplete: boolean;
  moodBefore: string | null;
  moodAfter: string | null;
  notes: string;
  startTime: Date | null;

  // Actions
  start: (moodBefore: string) => void;
  pause: () => void;
  resume: () => void;
  nextStep: () => void;
  previousStep: () => void;
  complete: (moodAfter: string, notes?: string) => Promise<void>;
  reset: () => void;

  // Computed
  currentStep: RitualStep | null;
  progress: number; // 0-100
  totalDuration: number; // total seconds
}

export function useRitualRunner({ ritual, userId }: UseRitualRunnerProps): RitualRunnerState {
  const { logCompletion } = useRitualStore();
  
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isPaused, setIsPaused] = useState(true);
  const [isComplete, setIsComplete] = useState(false);
  const [moodBefore, setMoodBefore] = useState<string | null>(null);
  const [moodAfter, setMoodAfter] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [startTime, setStartTime] = useState<Date | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Early return with safe defaults if ritual is undefined
  if (!ritual || !ritual.steps) {
    return {
      currentStepIndex: 0,
      timeRemaining: 0,
      isPaused: true,
      isComplete: false,
      moodBefore: null,
      moodAfter: null,
      notes: '',
      startTime: null,
      start: () => {},
      pause: () => {},
      resume: () => {},
      nextStep: () => {},
      previousStep: () => {},
      complete: async () => {},
      reset: () => {},
      currentStep: null,
      progress: 0,
      totalDuration: 0,
    };
  }

  // Calculate total duration in seconds
  // ✅ FIX: Duration is already in seconds in ritualTemplates.ts, don't multiply by 60
  const totalDuration = ritual.steps.reduce((sum, step) => sum + step.duration, 0);

  // Current step
  const currentStep = ritual.steps[currentStepIndex] || null;

  // Progress percentage
  const elapsedTime = totalDuration - timeRemaining;
  const progress = totalDuration > 0 ? Math.round((elapsedTime / totalDuration) * 100) : 0;

  // Timer logic
  useEffect(() => {
    // ✅ EXPLICIT CLEANUP: Clear interval when paused or when dependencies change
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Only start timer when not paused and time remaining
    if (!isPaused && timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            // ✅ Play completion chime
            try {
              const audio = new Audio(CHIME_SOUND);
              audio.volume = 0.5;
              audio.play().catch(e => logger.debug('[RitualRunner] Audio play failed:', e));
            } catch (e) {
              // Fail silently - audio is a nice-to-have
            }
            
            // Step complete - move to next
            if (currentStepIndex < ritual.steps.length - 1) {
              setCurrentStepIndex((i) => i + 1);
              // ✅ FIX: Duration is already in seconds, don't multiply by 60
              return ritual.steps[currentStepIndex + 1].duration;
            } else {
              // Ritual complete
              setIsComplete(true);
              setIsPaused(true);
              return 0;
            }
          }
          return prev - 1;
        });
      }, 1000);
    }

    // ✅ Cleanup on unmount or when dependencies change
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isPaused, timeRemaining, currentStepIndex, ritual.steps]);

  // Start ritual
  const start = useCallback((mood: string) => {
    setMoodBefore(mood);
    setStartTime(new Date());
    setCurrentStepIndex(0);
    // ✅ FIX: Duration is already in seconds, don't multiply by 60
    setTimeRemaining(ritual.steps[0].duration);
    setIsPaused(false);
    logger.debug('[RitualRunner] Started ritual:', ritual.title);
  }, [ritual]);

  // Pause
  const pause = useCallback(() => {
    setIsPaused(true);
    // ✅ HAPTIC FEEDBACK: Light tap on pause
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
    logger.debug('[RitualRunner] Paused');
  }, []);

  // Resume
  const resume = useCallback(() => {
    setIsPaused(false);
    // ✅ HAPTIC FEEDBACK: Light tap on resume
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
    logger.debug('[RitualRunner] Resumed');
  }, []);

  // Next step
  const nextStep = useCallback(() => {
    if (currentStepIndex < ritual.steps.length - 1) {
      const nextIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextIndex);
      setTimeRemaining(ritual.steps[nextIndex].duration); // ✅ Duration already in seconds
      logger.debug('[RitualRunner] Skipped to next step:', nextIndex);
    } else {
      setIsComplete(true);
      setIsPaused(true);
    }
  }, [currentStepIndex, ritual.steps]);

  // Previous step
  const previousStep = useCallback(() => {
    if (currentStepIndex > 0) {
      const prevIndex = currentStepIndex - 1;
      setCurrentStepIndex(prevIndex);
      setTimeRemaining(ritual.steps[prevIndex].duration); // ✅ Duration already in seconds
      logger.debug('[RitualRunner] Went back to step:', prevIndex);
    }
  }, [currentStepIndex, ritual.steps]);

  // Complete ritual
  const complete = useCallback(async (mood: string, notesText?: string) => {
    setMoodAfter(mood);
    if (notesText) setNotes(notesText);
    
    const endTime = new Date();
    const durationSeconds = startTime 
      ? Math.floor((endTime.getTime() - startTime.getTime()) / 1000)
      : totalDuration;

    try {
      await logCompletion({
        ritualId: ritual.id,
        userId,
        durationSeconds,
        moodBefore: moodBefore || 'neutral',
        moodAfter: mood,
        notes: notesText || '',
      });
      
      logger.info('[RitualRunner] ✅ Ritual completed and logged:', ritual.title);
    } catch (error) {
      logger.error('[RitualRunner] Failed to log completion:', error);
      throw error;
    }
  }, [ritual.id, ritual.title, userId, moodBefore, startTime, totalDuration, logCompletion]);

  // Reset
  const reset = useCallback(() => {
    setCurrentStepIndex(0);
    setTimeRemaining(0);
    setIsPaused(true);
    setIsComplete(false);
    setMoodBefore(null);
    setMoodAfter(null);
    setNotes('');
    setStartTime(null);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    logger.debug('[RitualRunner] Reset');
  }, []);

  return {
    // State
    currentStepIndex,
    timeRemaining,
    isPaused,
    isComplete,
    moodBefore,
    moodAfter,
    notes,
    startTime,

    // Actions
    start,
    pause,
    resume,
    nextStep,
    previousStep,
    complete,
    reset,

    // Computed
    currentStep,
    progress,
    totalDuration,
  };
}

