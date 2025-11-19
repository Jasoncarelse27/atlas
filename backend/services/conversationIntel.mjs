// Atlas Conversation Intelligence Service
// Lightweight heuristics for emotion, goal, and mode detection
// No external dependencies - pure JavaScript logic

import { logger } from '../lib/simpleLogger.mjs';

/**
 * Cheap sentiment/emotion heuristic – no extra API cost.
 */
function inferEmotionFromText(text = '') {
  const t = text.toLowerCase();

  if (!t.trim()) return 'neutral';

  if (t.match(/\b(anxious|worried|nervous|panic|overwhelmed)\b/)) return 'anxious';
  if (t.match(/\b(sad|down|depressed|low|heavy)\b/)) return 'low';
  if (t.match(/\b(tired|exhausted|drained|burnt|burned out|fog|foggy)\b/)) return 'tired';
  if (t.match(/\b(excited|pumped|hyped|energized|motivated)\b/)) return 'energized';
  if (t.match(/\b(angry|frustrated|irritated|annoyed)\b/)) return 'frustrated';

  // Soft positive indicators
  if (t.match(/\b(grateful|thankful|calm|peaceful|okay|fine)\b/)) return 'calm';

  return 'neutral';
}

/**
 * Try to infer high-level goal from the latest user message.
 */
function inferGoalFromText(text = '') {
  const t = text.toLowerCase();

  if (t.includes('morning') && t.includes('focus')) return 'morning_focus';
  if (t.includes('ritual') || t.includes('routine')) return 'ritual_design';
  if (t.includes('sleep') || t.includes('insomnia')) return 'sleep_support';
  if (t.includes('anxious') || t.includes('anxiety')) return 'anxiety_support';
  if (t.includes('burnout') || t.includes('burnt')) return 'burnout_support';
  if (t.includes('productivity') || t.includes('deep work')) return 'productivity_support';

  return 'general_support';
}

/**
 * Mode detection – tells the orchestrator whether we're in "ritual builder"
 * or normal emotional-support mode.
 */
function detectMode({ latestUserText = '', conversationTags = [] } = {}) {
  const t = latestUserText.toLowerCase();
  const tags = (conversationTags || []).map((x) => x.toLowerCase());

  const ritualKeywords = [
    'ritual builder',
    'ritual',
    'routine',
    'habit',
    'morning focus',
    'evening wind-down',
    'transition between tasks',
  ];

  const ritualHit =
    ritualKeywords.some((kw) => t.includes(kw)) ||
    tags.includes('ritual') ||
    tags.includes('rituals');

  if (ritualHit) return 'ritual';

  return 'default';
}

/**
 * Build a "reply strategy" – how Atlas should respond *this* turn.
 */
function buildReplyStrategy({ emotion, goal, mode }) {
  const base = {
    askClarifyingQuestion: true,
    maxQuestions: 1,
    includeMiniPsychoeducation: false,
    includeActionSteps: false,
    keepShort: false,
  };

  if (mode === 'ritual') {
    return {
      ...base,
      includeActionSteps: true,
      askClarifyingQuestion: true,
      maxQuestions: 1,
    };
  }

  if (emotion === 'tired' || emotion === 'low') {
    return {
      ...base,
      includeMiniPsychoeducation: true,
      includeActionSteps: true,
      keepShort: true,
    };
  }

  if (goal === 'productivity_support' || goal === 'morning_focus') {
    return {
      ...base,
      includeActionSteps: true,
    };
  }

  return base;
}

/**
 * Core entrypoint – returns a structured "intel snapshot" the orchestrator can use.
 */
export function analyzeConversation({ latestUserText, recentMessages = [], conversationTags = [] }) {
  try {
    const emotion = inferEmotionFromText(latestUserText);
    const goal = inferGoalFromText(latestUserText);
    const mode = detectMode({ latestUserText, conversationTags });
    const strategy = buildReplyStrategy({ emotion, goal, mode });

    const snapshot = {
      emotion,
      goal,
      mode,
      strategy,
      // We *can* include more later (e.g., energy level, time of day hints, etc.)
    };

    logger.debug('[ConversationIntel] Snapshot built', snapshot);
    return snapshot;
  } catch (error) {
    logger.warn('[ConversationIntel] Error analyzing conversation, using defaults:', error.message);
    // Return safe defaults on error
    return {
      emotion: 'neutral',
      goal: 'general_support',
      mode: 'default',
      strategy: {
        askClarifyingQuestion: true,
        maxQuestions: 1,
        includeMiniPsychoeducation: false,
        includeActionSteps: false,
        keepShort: false,
      },
    };
  }
}

/**
 * Generates a human-readable "context preamble" that we prepend to the user prompt.
 * This is what actually makes Atlas feel more aware and consistent.
 */
export function buildIntelPreamble({ userName, intel }) {
  try {
    const { emotion, goal, mode } = intel;

    const lines = [];

    if (userName) {
      lines.push(`User name: ${userName}.`);
    }

    lines.push(`User emotional state (approx): ${emotion}.`);
    lines.push(`User high-level goal: ${goal}.`);
    lines.push(`Active Atlas mode: ${mode}.`);

    return lines.join(' ');
  } catch (error) {
    logger.warn('[ConversationIntel] Error building preamble, using empty:', error.message);
    return '';
  }
}

