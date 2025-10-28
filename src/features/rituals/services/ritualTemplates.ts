/**
 * Ritual Templates - Preset Rituals for All Tiers
 * Created: October 27, 2025
 */

import type { RitualTemplate } from '../types/rituals';

export const RITUAL_TEMPLATES: Record<string, RitualTemplate> = {
  // Free Tier Presets (2 rituals)
  'morning-boost': {
    title: 'Morning Boost',
    goal: 'energy',
    tierRequired: 'free',
    description: 'Start your day with energy and intention. Perfect for building momentum.',
    estimatedDuration: 360, // 6 minutes
    steps: [
      {
        type: 'breathing',
        duration: 120,
        order: 1,
        config: {
          title: 'Breathing Exercise',
          instructions:
            'Box breathing: Inhale for 4 counts, hold for 4, exhale for 4, hold for 4. Repeat.',
        },
      },
      {
        type: 'affirmation',
        duration: 60,
        order: 2,
        config: {
          title: 'Affirmations',
          instructions:
            "Repeat: 'I am energized and ready for today. I handle challenges with calm confidence.'",
        },
      },
      {
        type: 'focus',
        duration: 180,
        order: 3,
        config: {
          title: 'Focus Exercise',
          instructions:
            'Set your top 3 intentions for the day. Write them down or say them aloud.',
        },
      },
    ],
  },

  'evening-wind-down': {
    title: 'Evening Wind Down',
    goal: 'calm',
    tierRequired: 'free',
    description: 'Release the day and prepare for restful sleep. Calm your mind and body.',
    estimatedDuration: 420, // 7 minutes
    steps: [
      {
        type: 'breathing',
        duration: 180,
        order: 1,
        config: {
          title: 'Breathing Exercise',
          instructions:
            '4-7-8 breathing: Inhale for 4, hold for 7, exhale for 8. Repeat 4 times.',
        },
      },
      {
        type: 'reflection',
        duration: 120,
        order: 2,
        config: {
          title: 'Reflection',
          instructions:
            "Think about 3 things that went well today. What did you learn?",
        },
      },
      {
        type: 'gratitude',
        duration: 120,
        order: 3,
        config: {
          title: 'Gratitude Practice',
          instructions:
            "Name 3 things you're grateful for today. Feel the appreciation.",
        },
      },
    ],
  },

  // Core/Studio Tier Presets (6 rituals)
  'stress-reset': {
    title: 'Stress Reset',
    goal: 'calm',
    tierRequired: 'core',
    description:
      'Quick stress relief when overwhelm hits. Calm your nervous system in 7 minutes.',
    estimatedDuration: 420, // 7 minutes
    steps: [
      {
        type: 'breathing',
        duration: 180,
        order: 1,
        config: {
          title: 'Deep Breathing',
          instructions:
            'Focus on your breath. Inhale calm, exhale tension. Let your shoulders drop.',
        },
      },
      {
        type: 'affirmation',
        duration: 120,
        order: 2,
        config: {
          title: 'Calming Affirmations',
          instructions:
            "Repeat: 'I am safe. I am capable. I release what I cannot control.'",
        },
      },
      {
        type: 'stretch',
        duration: 120,
        order: 3,
        config: {
          title: 'Gentle Stretch',
          instructions:
            'Roll your shoulders back. Stretch your neck gently side to side. Release tension.',
        },
      },
    ],
  },

  'creative-flow': {
    title: 'Creative Flow',
    goal: 'creativity',
    tierRequired: 'core',
    description: 'Unlock your creative potential. Get into a state of inspired flow.',
    estimatedDuration: 480, // 8 minutes
    steps: [
      {
        type: 'breathing',
        duration: 120,
        order: 1,
        config: {
          title: 'Energizing Breath',
          instructions:
            'Take 3 deep breaths. Imagine breathing in creative energy and possibility.',
        },
      },
      {
        type: 'visualization',
        duration: 180,
        order: 2,
        config: {
          title: 'Creative Visualization',
          instructions:
            'Visualize yourself creating effortlessly. See ideas flowing freely.',
        },
      },
      {
        type: 'affirmation',
        duration: 120,
        order: 3,
        config: {
          title: 'Creative Affirmations',
          instructions:
            "Repeat: 'Ideas flow through me easily. I trust my creative instincts.'",
        },
      },
      {
        type: 'focus',
        duration: 180,
        order: 4,
        config: {
          title: 'Set Creative Intention',
          instructions:
            'What do you want to create today? Set a clear, exciting intention.',
        },
      },
    ],
  },

  'productivity-sprint': {
    title: 'Productivity Sprint',
    goal: 'focus',
    tierRequired: 'core',
    description: 'Get laser-focused before deep work. Prime your mind for maximum productivity.',
    estimatedDuration: 600, // 10 minutes
    steps: [
      {
        type: 'breathing',
        duration: 120,
        order: 1,
        config: {
          title: 'Clearing Breath',
          instructions: '3 deep breaths. Clear your mind of distractions.',
        },
      },
      {
        type: 'focus',
        duration: 300,
        order: 2,
        config: {
          title: 'Priority Setting',
          instructions:
            'What ONE thing matters most right now? Write it down.',
        },
      },
      {
        type: 'affirmation',
        duration: 60,
        order: 3,
        config: {
          title: 'Focus Affirmation',
          instructions:
            "Repeat: 'I am focused. I complete what I start. Distractions fade away.'",
        },
      },
      {
        type: 'visualization',
        duration: 120,
        order: 4,
        config: {
          title: 'Success Visualization',
          instructions:
            'See yourself completing your priority task. Feel the satisfaction.',
        },
      },
    ],
  },

  'confidence-builder': {
    title: 'Confidence Builder',
    goal: 'energy',
    tierRequired: 'core',
    description:
      'Build unshakeable confidence before important moments. Feel powerful and prepared.',
    estimatedDuration: 300, // 5 minutes
    steps: [
      {
        type: 'breathing',
        duration: 120,
        order: 1,
        config: {
          title: 'Power Breathing',
          instructions:
            'Stand tall. Take 3 deep, powerful breaths. Fill your chest.',
        },
      },
      {
        type: 'affirmation',
        duration: 180,
        order: 2,
        config: {
          title: 'Confidence Affirmations',
          instructions:
            "Repeat: 'I am capable. I am prepared. I trust myself completely.'",
        },
      },
      {
        type: 'visualization',
        duration: 120,
        order: 3,
        config: {
          title: 'Success Visualization',
          instructions:
            'See yourself succeeding. Hear the positive feedback. Feel the confidence.',
        },
      },
    ],
  },

  'deep-work-prep': {
    title: 'Deep Work Prep',
    goal: 'focus',
    tierRequired: 'core',
    description:
      'Enter a state of deep, uninterrupted focus. Perfect before important work sessions.',
    estimatedDuration: 660, // 11 minutes
    steps: [
      {
        type: 'breathing',
        duration: 180,
        order: 1,
        config: {
          title: 'Centering Breath',
          instructions:
            'Box breathing for 3 minutes. Calm your nervous system.',
        },
      },
      {
        type: 'focus',
        duration: 240,
        order: 2,
        config: {
          title: 'Work Block Planning',
          instructions:
            'What will you accomplish in the next 90 minutes? Be specific.',
        },
      },
      {
        type: 'visualization',
        duration: 180,
        order: 3,
        config: {
          title: 'Flow State Visualization',
          instructions:
            "Imagine working with total focus. Time disappears. You're in the zone.",
        },
      },
      {
        type: 'affirmation',
        duration: 60,
        order: 4,
        config: {
          title: 'Deep Work Affirmation',
          instructions:
            "Repeat: 'I work with laser focus. Interruptions bounce off me. I am unstoppable.'",
        },
      },
    ],
  },

  'sleep-preparation': {
    title: 'Sleep Preparation',
    goal: 'calm',
    tierRequired: 'core',
    description: 'Release the day and drift into peaceful sleep. Perfect bedtime ritual.',
    estimatedDuration: 600, // 10 minutes
    steps: [
      {
        type: 'breathing',
        duration: 240,
        order: 1,
        config: {
          title: 'Sleep Breathing',
          instructions:
            '4-7-8 breathing: Inhale 4, hold 7, exhale 8. Repeat until deeply relaxed.',
        },
      },
      {
        type: 'reflection',
        duration: 120,
        order: 2,
        config: {
          title: 'Day Reflection',
          instructions:
            "Acknowledge today without judgment. Let go of what wasn't perfect.",
        },
      },
      {
        type: 'gratitude',
        duration: 120,
        order: 3,
        config: {
          title: 'Gratitude',
          instructions:
            "Name 3 things from today you're grateful for. Feel the warmth.",
        },
      },
      {
        type: 'visualization',
        duration: 120,
        order: 4,
        config: {
          title: 'Peaceful Visualization',
          instructions:
            'Imagine a peaceful place. Safe, calm, comfortable. You are at ease.',
        },
      },
    ],
  },
};

// Helper to get rituals by tier
export const getRitualsByTier = (tier: 'free' | 'core' | 'studio'): RitualTemplate[] => {
  const rituals = Object.values(RITUAL_TEMPLATES);

  if (tier === 'free') {
    return rituals.filter((r) => r.tierRequired === 'free');
  }

  if (tier === 'core') {
    return rituals.filter((r) => r.tierRequired === 'free' || r.tierRequired === 'core');
  }

  // Studio gets all rituals
  return rituals;
};

// Helper to format duration
export const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  
  // Always show minutes for clarity (e.g., "5 min" not "0:05")
  if (mins === 0 && secs > 0) {
    return `${secs}s`; // Less than 1 minute
  }
  if (secs === 0) {
    return `${mins} min`;
  }
  // Only show mm:ss format for in-progress timers, not for duration display
  return `${mins} min`;
};

