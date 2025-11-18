/**
 * Step Library - Available Ritual Step Types
 * Users drag these steps into their custom ritual
 * 
 * ✅ PHASE 2: Search/filter, categories, and recently used implemented
 */

import * as Tooltip from '@radix-ui/react-tooltip';
import type { LucideIcon } from 'lucide-react';
import { Activity, BookOpen, Brain, Eye, Heart, Search, Smile, Target, X } from 'lucide-react';
import React, { useMemo, useState, useEffect } from 'react';
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

// ✅ PHASE 2: Step categories
const STEP_CATEGORIES = {
  'Breath & Body': ['breathing', 'stretch'],
  'Mind & Reflection': ['meditation', 'focus', 'reflection', 'journaling'],
  'Emotion & Intention': ['affirmation', 'gratitude', 'visualization'],
} as const;

const RECENTLY_USED_KEY = 'ritual-builder-recently-used';

interface StepLibraryProps {
  onStepSelect: (stepType: RitualStepType) => void;
}

export const StepLibrary: React.FC<StepLibraryProps> = ({ onStepSelect }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [recentlyUsed, setRecentlyUsed] = useState<RitualStepType[]>(() => {
    try {
      const stored = localStorage.getItem(RECENTLY_USED_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // ✅ PHASE 2: Track step usage
  const handleStepSelect = (stepType: RitualStepType) => {
    onStepSelect(stepType);
    setRecentlyUsed(prev => {
      const updated = [stepType, ...prev.filter(t => t !== stepType)].slice(0, 5);
      try {
        localStorage.setItem(RECENTLY_USED_KEY, JSON.stringify(updated));
      } catch {
        // Ignore localStorage errors
      }
      return updated;
    });
  };

  // ✅ PHASE 2: Filter steps by search query
  const filteredSteps = useMemo(() => {
    const allSteps = Object.values(STEP_TYPE_DEFINITIONS);
    if (!searchQuery.trim()) return allSteps;
    
    const query = searchQuery.toLowerCase();
    return allSteps.filter(step =>
      step.label.toLowerCase().includes(query) ||
      step.description.toLowerCase().includes(query) ||
      step.type.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // ✅ PHASE 2: Group steps by category
  const groupedSteps = useMemo(() => {
    const groups: Record<string, typeof STEP_TYPE_DEFINITIONS[keyof typeof STEP_TYPE_DEFINITIONS][]> = {};
    
    filteredSteps.forEach(step => {
      for (const [category, types] of Object.entries(STEP_CATEGORIES)) {
        if (types.includes(step.type as any)) {
          if (!groups[category]) groups[category] = [];
          groups[category].push(step);
          return;
        }
      }
    });
    
    return groups;
  }, [filteredSteps]);

  // ✅ PHASE 2: Recently used steps
  const recentSteps = useMemo(() => {
    return recentlyUsed
      .map(type => STEP_TYPE_DEFINITIONS[type])
      .filter(Boolean);
  }, [recentlyUsed]);

  const renderStepButton = (step: typeof STEP_TYPE_DEFINITIONS[keyof typeof STEP_TYPE_DEFINITIONS]) => {
    const Icon = step.icon;
    return (
      <Tooltip.Provider key={step.type} delayDuration={300}>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <button
              onClick={() => handleStepSelect(step.type)}
              className={`w-full p-3 rounded-lg border-2 ${step.color} transition-all hover:shadow-md cursor-pointer text-left active:scale-95`}
            >
              <div className="flex items-center gap-3">
                <Icon size={20} />
                <div className="flex-1">
                  <div className="font-medium text-sm">{step.label}</div>
                  <div className="text-xs opacity-75">{step.defaultDuration} min</div>
                </div>
              </div>
            </button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              className="data-[state=delayed-open]:data-[side=top]:animate-slideDownAndFade data-[state=delayed-open]:data-[side=right]:animate-slideLeftAndFade data-[state=delayed-open]:data-[side=left]:animate-slideRightAndFade data-[state=delayed-open]:data-[side=bottom]:animate-slideUpAndFade text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-3 py-2 max-w-xs z-50"
              sideOffset={5}
            >
              <div className="font-medium mb-1">{step.label}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">{step.description}</div>
              <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                Default: {step.defaultDuration} min • Range: {step.minDuration}-{step.maxDuration} min
              </div>
              <Tooltip.Arrow className="fill-white dark:fill-gray-800" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
    );
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-[#3B3632] dark:text-white uppercase tracking-wide">
        Step Library
      </h3>
      
      {/* ✅ PHASE 2: Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search steps..."
          className="w-full pl-10 pr-10 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg 
            bg-white dark:bg-gray-700 text-gray-900 dark:text-white
            focus:outline-none focus:ring-2 focus:ring-[#B2BDA3] focus:border-transparent"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label="Clear search"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* ✅ PHASE 2: Recently Used Section */}
      {!searchQuery && recentSteps.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Recently Used
          </h4>
          <div className="space-y-2">
            {recentSteps.map(step => renderStepButton(step))}
          </div>
        </div>
      )}

      {/* ✅ PHASE 2: Grouped Steps by Category */}
      {Object.keys(groupedSteps).length > 0 ? (
        <div className="space-y-4">
          {Object.entries(groupedSteps).map(([category, steps]) => (
            <div key={category} className="space-y-2">
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                {category}
              </h4>
              <div className="space-y-2">
                {steps.map(step => renderStepButton(step))}
              </div>
            </div>
          ))}
        </div>
      ) : searchQuery ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <p className="text-sm">No steps found matching "{searchQuery}"</p>
        </div>
      ) : null}

      <div className="mt-6 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
        <p className="text-xs text-gray-600 dark:text-gray-300">
          💡 <strong>Tip:</strong> A good ritual is 5-15 minutes long with 3-5 steps.
        </p>
      </div>
    </div>
  );
};

