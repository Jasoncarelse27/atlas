/**
 * Smart Ritual Suggestions - AI-powered ritual building assistance
 * Helps users create effective rituals with intelligent recommendations
 */

import type { RitualGoal, RitualStep, RitualStepType } from '../types/rituals';

export interface RitualSuggestion {
  type: 'add_step' | 'reorder' | 'duration' | 'balance' | 'goal_alignment';
  severity: 'info' | 'warning' | 'suggestion';
  message: string;
  action?: {
    label: string;
    stepType?: RitualStepType;
    newOrder?: number[];
  };
}

/**
 * Analyze ritual and provide intelligent suggestions
 */
export function analyzeRitual(
  steps: RitualStep[],
  goal: RitualGoal
): RitualSuggestion[] {
  const suggestions: RitualSuggestion[] = [];
  
  if (steps.length === 0) {
    return [{
      type: 'add_step',
      severity: 'info',
      message: `Start by adding steps! For ${goal} rituals, try starting with breathing exercises.`,
      action: {
        label: 'Add Breathing Step',
        stepType: 'breathing'
      }
    }];
  }

  // 1. Check ritual length
  const totalDuration = steps.reduce((sum, step) => sum + step.duration, 0);
  if (totalDuration < 300) { // Less than 5 minutes
    suggestions.push({
      type: 'duration',
      severity: 'warning',
      message: `Your ritual is only ${Math.round(totalDuration / 60)} minutes. Research shows 5-15 minute rituals are most effective.`,
    });
  } else if (totalDuration > 1200) { // More than 20 minutes
    suggestions.push({
      type: 'duration',
      severity: 'warning',
      message: `Your ritual is ${Math.round(totalDuration / 60)} minutes. Longer rituals are harder to maintain daily.`,
    });
  }

  // 2. Check for breathing exercise (should be in every ritual)
  const hasBreathing = steps.some(s => s.type === 'breathing');
  if (!hasBreathing) {
    suggestions.push({
      type: 'add_step',
      severity: 'suggestion',
      message: 'Consider adding breathing exercises. They help transition your mind into the ritual.',
      action: {
        label: 'Add Breathing',
        stepType: 'breathing'
      }
    });
  }

  // 3. Goal-specific recommendations
  const goalRecommendations = getGoalRecommendations(goal, steps);
  suggestions.push(...goalRecommendations);

  // 4. Check step balance
  if (steps.length > 0) {
    const avgDuration = totalDuration / steps.length;
    const hasImbalancedSteps = steps.some(
      s => s.duration > avgDuration * 2 || s.duration < avgDuration * 0.5
    );
    
    if (hasImbalancedSteps && steps.length > 2) {
      suggestions.push({
        type: 'balance',
        severity: 'info',
        message: 'Some steps are much longer/shorter than others. Balance helps maintain rhythm.',
      });
    }
  }

  // 5. Check for proper ending
  if (steps.length > 0) {
    const lastStep = steps[steps.length - 1];
    const goodEndings: RitualStepType[] = ['gratitude', 'affirmation', 'reflection', 'visualization'];
    
    if (!goodEndings.includes(lastStep.type)) {
      suggestions.push({
        type: 'reorder',
        severity: 'suggestion',
        message: 'End with a positive note! Try finishing with gratitude, affirmation, or reflection.',
      });
    }
  }

  return suggestions;
}

function getGoalRecommendations(
  goal: RitualGoal,
  currentSteps: RitualStep[]
): RitualSuggestion[] {
  const suggestions: RitualSuggestion[] = [];
  const stepTypes = currentSteps.map(s => s.type);

  const goalStepRecommendations: Record<RitualGoal, {
    recommended: RitualStepType[];
    message: string;
  }> = {
    energy: {
      recommended: ['breathing', 'affirmation', 'stretch', 'visualization'],
      message: 'Energy rituals work best with breathing, affirmations, and movement.'
    },
    calm: {
      recommended: ['breathing', 'meditation', 'gratitude', 'reflection'],
      message: 'Calming rituals benefit from breathing, meditation, and reflection.'
    },
    focus: {
      recommended: ['breathing', 'meditation', 'focus', 'affirmation'],
      message: 'Focus rituals need breathing, meditation, and clear intention-setting.'
    },
    creativity: {
      recommended: ['breathing', 'visualization', 'journaling', 'affirmation'],
      message: 'Creative rituals thrive with visualization, journaling, and affirmations.'
    }
  };

  const recommendation = goalStepRecommendations[goal];
  const missingRecommended = recommendation.recommended.filter(
    type => !stepTypes.includes(type)
  );

  if (missingRecommended.length > 0 && currentSteps.length > 0) {
    suggestions.push({
      type: 'goal_alignment',
      severity: 'suggestion',
      message: `${recommendation.message} Consider adding: ${missingRecommended[0]}.`,
      action: {
        label: `Add ${missingRecommended[0]}`,
        stepType: missingRecommended[0]
      }
    });
  }

  return suggestions;
}

/**
 * Get quick-start templates based on goal and time available
 */
export function getQuickStartTemplate(
  goal: RitualGoal,
  timeAvailable: number // in minutes
): { title: string; steps: Omit<RitualStep, 'id' | 'order'>[] } {
  const templates: Record<RitualGoal, Record<number, any>> = {
    energy: {
      5: {
        title: 'Quick Energy Boost',
        steps: [
          { type: 'breathing', duration: 120, config: { 
            title: 'Power Breathing',
            instructions: 'Box breathing: 4-4-4-4. Feel energy building.'
          }},
          { type: 'affirmation', duration: 60, config: {
            title: 'Energy Affirmation',
            instructions: 'I am energized and ready for anything today brings.'
          }},
          { type: 'stretch', duration: 120, config: {
            title: 'Morning Stretch',
            instructions: 'Shake out your body. Reach for the sky. Feel alive!'
          }}
        ]
      },
      10: {
        title: 'Morning Power Ritual',
        steps: [
          { type: 'breathing', duration: 180, config: { 
            title: 'Energizing Breath',
            instructions: 'Deep belly breaths. Feel oxygen flowing.'
          }},
          { type: 'visualization', duration: 180, config: {
            title: 'Visualize Success',
            instructions: 'See yourself crushing your goals today.'
          }},
          { type: 'affirmation', duration: 120, config: {
            title: 'Power Affirmations',
            instructions: 'I am powerful. I am capable. I am unstoppable.'
          }},
          { type: 'stretch', duration: 120, config: {
            title: 'Full Body Wake-Up',
            instructions: 'Dynamic stretches. Get blood flowing!'
          }}
        ]
      }
    },
    calm: {
      5: {
        title: 'Quick Calm Down',
        steps: [
          { type: 'breathing', duration: 180, config: {
            title: '4-7-8 Breathing',
            instructions: 'Inhale 4, hold 7, exhale 8. Repeat 4 times.'
          }},
          { type: 'gratitude', duration: 120, config: {
            title: 'Quick Gratitude',
            instructions: 'Name 3 things you\'re grateful for right now.'
          }}
        ]
      },
      10: {
        title: 'Evening Wind Down',
        steps: [
          { type: 'breathing', duration: 240, config: {
            title: 'Deep Relaxation Breath',
            instructions: 'Slow, deep breaths. Release tension with each exhale.'
          }},
          { type: 'reflection', duration: 180, config: {
            title: 'Day Review',
            instructions: 'What went well today? What did you learn?'
          }},
          { type: 'gratitude', duration: 180, config: {
            title: 'Evening Gratitude',
            instructions: 'Appreciate the good moments from today.'
          }}
        ]
      }
    },
    focus: {
      5: {
        title: 'Quick Focus Primer',
        steps: [
          { type: 'breathing', duration: 120, config: {
            title: 'Centering Breath',
            instructions: 'Clear your mind. Breathe deeply. Get present.'
          }},
          { type: 'focus', duration: 180, config: {
            title: 'Set Intention',
            instructions: 'What ONE thing matters most right now?'
          }}
        ]
      },
      10: {
        title: 'Deep Work Prep',
        steps: [
          { type: 'breathing', duration: 180, config: {
            title: 'Focus Breathing',
            instructions: 'Calm the mind. Release distractions.'
          }},
          { type: 'meditation', duration: 240, config: {
            title: 'Mindfulness',
            instructions: 'Sit quietly. Notice thoughts passing. Return to breath.'
          }},
          { type: 'focus', duration: 180, config: {
            title: 'Task Planning',
            instructions: 'Define your focus goal. Break it into clear steps.'
          }}
        ]
      }
    },
    creativity: {
      5: {
        title: 'Creative Spark',
        steps: [
          { type: 'breathing', duration: 120, config: {
            title: 'Inspiration Breath',
            instructions: 'Breathe in possibility. Exhale limitations.'
          }},
          { type: 'visualization', duration: 180, config: {
            title: 'Creative Vision',
            instructions: 'See yourself creating freely. Ideas flowing.'
          }}
        ]
      },
      10: {
        title: 'Creative Flow Ritual',
        steps: [
          { type: 'breathing', duration: 120, config: {
            title: 'Open Mind Breath',
            instructions: 'Release judgment. Welcome all ideas.'
          }},
          { type: 'visualization', duration: 240, config: {
            title: 'Imagine Success',
            instructions: 'See your creative work complete and beautiful.'
          }},
          { type: 'affirmation', duration: 120, config: {
            title: 'Creative Confidence',
            instructions: 'Ideas flow through me. I trust my creativity.'
          }},
          { type: 'journaling', duration: 120, config: {
            title: 'Free Writing',
            instructions: 'Write whatever comes to mind. No judgment.'
          }}
        ]
      }
    }
  };

  // Round to nearest 5 minutes
  const roundedTime = Math.round(timeAvailable / 5) * 5;
  const template = templates[goal][roundedTime] || templates[goal][5];
  
  return template;
}

/**
 * Suggest next step based on current ritual flow
 */
export function suggestNextStep(
  currentSteps: RitualStep[],
  goal: RitualGoal
): { stepType: RitualStepType; reason: string } | null {
  if (currentSteps.length === 0) {
    return {
      stepType: 'breathing',
      reason: 'Breathing exercises are the perfect way to begin any ritual.'
    };
  }

  const lastStep = currentSteps[currentSteps.length - 1];
  const stepTypes = currentSteps.map(s => s.type);

  // Logical flow patterns
  const flowPatterns: Record<RitualStepType, RitualStepType[]> = {
    breathing: ['meditation', 'affirmation', 'visualization', 'focus'],
    meditation: ['journaling', 'reflection', 'affirmation', 'gratitude'],
    affirmation: ['visualization', 'focus', 'stretch'],
    visualization: ['affirmation', 'journaling', 'focus'],
    focus: ['affirmation', 'stretch', 'gratitude'],
    stretch: ['breathing', 'affirmation', 'gratitude'],
    journaling: ['reflection', 'gratitude', 'affirmation'],
    gratitude: ['affirmation', 'reflection'], // Good ending
    reflection: ['gratitude', 'affirmation'], // Good ending
  };

  const possibleNext = flowPatterns[lastStep.type] || [];
  const unusedNext = possibleNext.filter(type => !stepTypes.includes(type));

  if (unusedNext.length > 0) {
    return {
      stepType: unusedNext[0],
      reason: `Flows naturally after ${lastStep.type}`
    };
  }

  // If all flow options used, suggest based on goal
  const goalDefaults: Record<RitualGoal, RitualStepType> = {
    energy: 'affirmation',
    calm: 'gratitude',
    focus: 'meditation',
    creativity: 'journaling'
  };

  return {
    stepType: goalDefaults[goal],
    reason: `Recommended for ${goal} rituals`
  };
}

