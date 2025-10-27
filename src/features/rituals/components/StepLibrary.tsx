/**
 * Step Library - Available Ritual Step Types
 * Users drag these steps into their custom ritual
 */

import type { LucideIcon } from 'lucide-react';
import { Activity, BookOpen, Brain, Eye, Heart, Smile, Target } from 'lucide-react';
import React from 'react';
import type { RitualStepType } from '../types/rituals';

export interface StepTypeDefinition {
  type: RitualStepType;
  icon: LucideIcon;
  label: string;
  description: string;
  defaultDuration: number; // minutes
  minDuration: number;
  maxDuration: number;
  color: string; // Tailwind color class
  defaultInstructions: string;
}

export const STEP_TYPE_DEFINITIONS: Record<RitualStepType, StepTypeDefinition> = {
  breathing: {
    type: 'breathing',
    icon: Activity,
    label: 'Breathing Exercise',
    description: 'Calm your mind and body with intentional breathing',
    defaultDuration: 3,
    minDuration: 1,
    maxDuration: 10,
    color: 'bg-blue-50 text-blue-600 border-blue-200',
    defaultInstructions: 'Breathe in deeply for 4 counts, hold for 4, exhale for 6. Repeat.',
  },
  affirmation: {
    type: 'affirmation',
    icon: Heart,
    label: 'Affirmation',
    description: 'Reinforce positive beliefs and self-talk',
    defaultDuration: 2,
    minDuration: 1,
    maxDuration: 5,
    color: 'bg-pink-50 text-pink-600 border-pink-200',
    defaultInstructions: 'Repeat your chosen affirmation with intention and belief.',
  },
  meditation: {
    type: 'meditation',
    icon: Brain,
    label: 'Meditation',
    description: 'Cultivate awareness and inner peace',
    defaultDuration: 5,
    minDuration: 3,
    maxDuration: 20,
    color: 'bg-purple-50 text-purple-600 border-purple-200',
    defaultInstructions: 'Sit comfortably, close your eyes, and focus on your breath.',
  },
  focus: {
    type: 'focus',
    icon: Target,
    label: 'Focus Exercise',
    description: 'Sharpen your concentration and attention',
    defaultDuration: 5,
    minDuration: 3,
    maxDuration: 15,
    color: 'bg-orange-50 text-orange-600 border-orange-200',
    defaultInstructions: 'Focus on one task without distraction. Stay present.',
  },
  stretch: {
    type: 'stretch',
    icon: Activity,
    label: 'Stretch',
    description: 'Release physical tension and improve circulation',
    defaultDuration: 3,
    minDuration: 2,
    maxDuration: 10,
    color: 'bg-green-50 text-green-600 border-green-200',
    defaultInstructions: 'Gentle stretches to release tension. Move slowly and breathe.',
  },
  journaling: {
    type: 'journaling',
    icon: BookOpen,
    label: 'Journaling',
    description: 'Process thoughts and emotions through writing',
    defaultDuration: 5,
    minDuration: 3,
    maxDuration: 20,
    color: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    defaultInstructions: 'Write freely without judgment. Let your thoughts flow.',
  },
  gratitude: {
    type: 'gratitude',
    icon: Smile,
    label: 'Gratitude Practice',
    description: 'Cultivate appreciation and positive emotions',
    defaultDuration: 3,
    minDuration: 2,
    maxDuration: 5,
    color: 'bg-amber-50 text-amber-600 border-amber-200',
    defaultInstructions: 'List 3 things you are grateful for. Feel the appreciation.',
  },
  visualization: {
    type: 'visualization',
    icon: Eye,
    label: 'Visualization',
    description: 'Imagine success and desired outcomes',
    defaultDuration: 5,
    minDuration: 3,
    maxDuration: 10,
    color: 'bg-indigo-50 text-indigo-600 border-indigo-200',
    defaultInstructions: 'Visualize your goal as already achieved. Engage all senses.',
  },
  reflection: {
    type: 'reflection',
    icon: BookOpen,
    label: 'Reflection',
    description: 'Review your day or recent experiences',
    defaultDuration: 3,
    minDuration: 2,
    maxDuration: 10,
    color: 'bg-teal-50 text-teal-600 border-teal-200',
    defaultInstructions: 'Think about your day. What went well? What can you improve?',
  },
};

interface StepLibraryProps {
  onStepSelect: (stepType: RitualStepType) => void;
}

export const StepLibrary: React.FC<StepLibraryProps> = ({ onStepSelect }) => {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-[#3B3632] uppercase tracking-wide">
        Step Library
      </h3>
      <p className="text-xs text-gray-600 mb-4">
        Click to add steps to your ritual
      </p>

      <div className="space-y-2">
        {Object.values(STEP_TYPE_DEFINITIONS).map((step) => {
          const Icon = step.icon;
          return (
            <button
              key={step.type}
              onClick={() => onStepSelect(step.type)}
              className={`w-full p-3 rounded-lg border-2 ${step.color} transition-all hover:shadow-md cursor-pointer text-left`}
            >
              <div className="flex items-center gap-3">
                <Icon size={20} />
                <div className="flex-1">
                  <div className="font-medium text-sm">{step.label}</div>
                  <div className="text-xs opacity-75">{step.defaultDuration} min</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6 p-3 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-xs text-gray-600">
          💡 <strong>Tip:</strong> A good ritual is 5-15 minutes long with 3-5 steps.
        </p>
      </div>
    </div>
  );
};

