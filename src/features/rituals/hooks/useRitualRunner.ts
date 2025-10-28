/**
 * 🧘 Ritual Runner Hook - Timer & Execution Logic
 * Manages ritual playback, timer countdown, and mood tracking
 */

import { logger } from '@/lib/logger';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Ritual, RitualStep } from '../types/rituals';
import { useRitualStore } from './useRitualStore';

interface UseRitualRunnerProps {
  ritual: Ritual;
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

  // Calculate total duration in seconds
  const totalDuration = ritual.steps.reduce((sum, step) => sum + (step.duration * 60), 0);

  // Current step
  const currentStep = ritual.steps[currentStepIndex] || null;

  // Progress percentage
  const elapsedTime = totalDuration - timeRemaining;
  const progress = totalDuration > 0 ? Math.round((elapsedTime / totalDuration) * 100) : 0;

  // Timer logic
  useEffect(() => {
    if (!isPaused && timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            // Step complete - move to next
            if (currentStepIndex < ritual.steps.length - 1) {
              setCurrentStepIndex((i) => i + 1);
              return ritual.steps[currentStepIndex + 1].duration * 60;
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

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isPaused, timeRemaining, currentStepIndex, ritual.steps]);

  // Start ritual
  const start = useCallback((mood: string) => {
    setMoodBefore(mood);
    setStartTime(new Date());
    setCurrentStepIndex(0);
    setTimeRemaining(ritual.steps[0].duration * 60);
    setIsPaused(false);
    logger.debug('[RitualRunner] Started ritual:', ritual.title);
  }, [ritual]);

  // Pause
  const pause = useCallback(() => {
    setIsPaused(true);
    logger.debug('[RitualRunner] Paused');
  }, []);

  // Resume
  const resume = useCallback(() => {
    setIsPaused(false);
    logger.debug('[RitualRunner] Resumed');
  }, []);

  // Next step
  const nextStep = useCallback(() => {
    if (currentStepIndex < ritual.steps.length - 1) {
      const nextIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextIndex);
      setTimeRemaining(ritual.steps[nextIndex].duration * 60);
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
      setTimeRemaining(ritual.steps[prevIndex].duration * 60);
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

