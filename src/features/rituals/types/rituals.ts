/**
 * Ritual Builder - TypeScript Type Definitions
 * Created: October 27, 2025
 */

export type RitualGoal = "energy" | "calm" | "focus" | "creativity";

export type RitualStepType =
  | "breathing"
  | "affirmation"
  | "meditation"
  | "focus"
  | "stretch"
  | "journaling"
  | "gratitude"
  | "visualization"
  | "reflection";

export type TierLevel = "free" | "core" | "studio";

export type MoodRating = "happy" | "neutral" | "worried" | "stressed" | "tired";

export interface RitualStep {
  type: RitualStepType;
  duration: number; // in seconds
  order: number;
  config: {
    title: string;
    instructions: string;
  };
}

export interface Ritual {
  id: string;
  userId: string;
  title: string;
  goal: RitualGoal;
  steps: RitualStep[];
  isPreset: boolean;
  tierRequired: TierLevel;
  createdAt: string;
  updatedAt: string;
  synced?: boolean;
}

export interface RitualLog {
  id: string;
  ritualId: string;
  userId: string;
  completedAt: string;
  durationSeconds: number;
  moodBefore: MoodRating;
  moodAfter: MoodRating;
  notes?: string;
  synced?: boolean;
}

export interface RitualTemplate {
  title: string;
  goal: RitualGoal;
  steps: RitualStep[];
  tierRequired: TierLevel;
  description: string;
  estimatedDuration: number; // in seconds
}

export interface RitualAnalytics {
  totalCompleted: number;
  totalDuration: number; // in seconds
  favoriteRitual?: string;
  moodImprovementScore: number; // -1 to 1 scale
  completionStreak: number; // days
  weeklyCompletions: number[];
  moodTrends: {
    date: string;
    moodBefore: MoodRating;
    moodAfter: MoodRating;
  }[];
}

export interface RitualRunState {
  currentStep: number;
  isPaused: boolean;
  timeRemaining: number; // in seconds
  moodBefore?: MoodRating;
  moodAfter?: MoodRating;
  startedAt?: string;
}

export interface StepLibraryItem {
  type: RitualStepType;
  icon: string;
  title: string;
  description: string;
  defaultDuration: number;
  minDuration: number;
  maxDuration: number;
  category: "breathwork" | "mindfulness" | "movement" | "reflection";
}

