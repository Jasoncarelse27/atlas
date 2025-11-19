// Atlas Ritual Builder Engine
// Specialized instructions for ritual building mode

import { logger } from '../lib/simpleLogger.mjs';

/**
 * Builds extra instructions when Atlas is in "ritual" mode.
 * This doesn't *force* the model, but gently shapes output structure.
 */
export function buildRitualInstructions({ intel }) {
  try {
    const { goal } = intel || {};

    let focusText = 'a short, sustainable ritual that fits into 5–15 minutes, with 3–5 simple steps.';

    if (goal === 'morning_focus') {
      focusText =
        'a short, sustainable *morning* focus ritual (5–15 minutes, 3–5 simple steps) that helps the user clear mental fog and feel grounded and focused.';
    }

    const instructions = [
      'You are currently in RITUAL BUILDER mode.',
      'Your role is to help the user design a realistic, flexible ritual that adapts to their energy and emotional state.',
      `Design ${focusText}`,
      'For each step, briefly explain *why* it helps (1 short sentence).',
      'End with 1 gentle check-in question like: "How does this feel for you?" or "Want to adjust duration or energy level?"',
      'Avoid sounding robotic or prescriptive. Sound like a warm, emotionally intelligent coach.',
    ];

    logger.debug('[RitualBuilder] Instructions generated', { goal });

    return instructions.join(' ');
  } catch (error) {
    logger.warn('[RitualBuilder] Error building instructions, using defaults:', error.message);
    return 'You are in RITUAL BUILDER mode. Help the user design a short, sustainable ritual (5–15 minutes, 3–5 steps).';
  }
}

