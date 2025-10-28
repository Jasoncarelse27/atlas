// 🧘 Ritual Builder - TypeScript Interfaces

export type RitualGoal = "energy" | "calm" | "focus" | "creativity";
export type RitualStepType = "breathing" | "affirmation" | "meditation" | "focus" | "stretch" | "journaling" | "gratitude" | "visualization" | "reflection";
export type TierLevel = "free" | "core" | "studio";

export interface RitualStepConfig {
  title: string;
  instructions: string;
  // Add more step-specific configurations here (e.g., sound, image, specific breathing pattern)
}

export interface RitualStep {
  id: string; // Client-side generated UUID for ordering/editing
  type: RitualStepType;
  duration: number; // Duration in minutes
  order: number; // Order in the ritual
  config: RitualStepConfig;
}

export interface Ritual {
  id: string;
  userId: string;
  title: string;
  goal: RitualGoal;
  steps: RitualStep[];
  isPreset: boolean; // True if it's a system-defined ritual
  tierRequired: TierLevel;
  createdAt: string;
  updatedAt: string;
  synced?: boolean; // For Dexie offline sync
}

export interface RitualLog {
  id: string;
  ritualId: string;
  userId: string;
  completedAt: string;
  durationSeconds: number;
  moodBefore: string; // e.g., "stressed", "tired", "neutral"
  moodAfter: string;  // e.g., "calm", "focused", "energized"
  notes?: string;
  synced?: boolean; // For Dexie offline sync
}

// 😊 Mood Options for Pre/Post Ritual Tracking
export interface MoodOption {
  emoji: string;
  label: string;
  value: string;
  color: string; // Tailwind color class
}

export const MOOD_OPTIONS: MoodOption[] = [
  { emoji: "😰", label: "Stressed", value: "stressed", color: "bg-red-100 hover:bg-red-200" },
  { emoji: "😟", label: "Anxious", value: "anxious", color: "bg-orange-100 hover:bg-orange-200" },
  { emoji: "😐", label: "Neutral", value: "neutral", color: "bg-gray-100 hover:bg-gray-200" },
  { emoji: "😴", label: "Tired", value: "tired", color: "bg-blue-100 hover:bg-blue-200" },
  { emoji: "😊", label: "Calm", value: "calm", color: "bg-green-100 hover:bg-green-200" },
  { emoji: "😌", label: "Relaxed", value: "relaxed", color: "bg-teal-100 hover:bg-teal-200" },
  { emoji: "🎯", label: "Focused", value: "focused", color: "bg-purple-100 hover:bg-purple-200" },
  { emoji: "✨", label: "Energized", value: "energized", color: "bg-yellow-100 hover:bg-yellow-200" },
];

// Personal Insights Type
export interface PersonalInsight {
  type: 'mood' | 'consistency' | 'preference' | 'achievement';
  message: string;
  icon: string;
  value?: number;
}
