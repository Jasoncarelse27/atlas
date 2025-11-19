// Atlas Prompt Orchestrator
// Builds enhanced system and user prompts using conversation intelligence

import { logger } from '../lib/simpleLogger.mjs';
import { analyzeConversation, buildIntelPreamble } from './conversationIntel.mjs';
import { buildRitualInstructions } from './ritualBuilderEngine.mjs';

/**
 * Base Atlas persona + style. Keep this short and stable.
 */
const ATLAS_SYSTEM_PROMPT = `
You are Atlas AI, an emotionally intelligent productivity assistant.

Core traits:
- Warm, grounded, non-judgmental
- Brief but thoughtful (no rambling)
- Emotionally validating but not cheesy
- Clear, practical, and context-aware

Always:
- Acknowledge the user's emotional state
- Reflect back your understanding in 1–2 short sentences
- Offer 1–3 concrete, realistic suggestions
- End with 1 concise, relevant follow-up question (unless the user explicitly says "no questions")
`;

/**
 * Build the "smarter" system & user prompts.
 *
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.userName
 * @param {string} params.latestUserText - raw user message
 * @param {Array}  params.recentMessages - last N messages (objects with role/content)
 * @param {Array}  params.conversationTags - optional tags (e.g., ['ritual'])
 */
export function buildSmarterPrompt({
  userId,
  userName,
  latestUserText,
  recentMessages = [],
  conversationTags = [],
}) {
  try {
    // 1) Build intel snapshot
    const intel = analyzeConversation({ latestUserText, recentMessages, conversationTags });

    // 2) Build intel preamble
    const intelPreamble = buildIntelPreamble({ userName, intel });

    // 3) Build mode-specific extras
    let modeInstructions = '';
    if (intel.mode === 'ritual') {
      modeInstructions = buildRitualInstructions({ intel });
    }

    // 4) Build strategy hints
    const { strategy } = intel;
    const strategyLines = [];

    if (strategy.includeMiniPsychoeducation) {
      strategyLines.push(
        '- Include a tiny bit of psychoeducation (1–2 sentences) only if it genuinely helps the user feel less alone or confused.'
      );
    }

    if (strategy.includeActionSteps) {
      strategyLines.push('- Offer 2–3 *very practical* steps the user can try soon.');
    }

    if (strategy.keepShort) {
      strategyLines.push('- Keep the answer compact (4–7 short paragraphs max).');
    }

    if (strategy.askClarifyingQuestion) {
      strategyLines.push(
        `- End with **exactly** ${strategy.maxQuestions || 1} clarifying question that helps you refine support next.`
      );
    }

    const strategyText = strategyLines.join('\n');

    // 5) Final system prompt
    const systemPrompt = [
      ATLAS_SYSTEM_PROMPT.trim(),
      '',
      '---',
      'CONVERSATION INTEL:',
      intelPreamble,
      '',
      modeInstructions ? `MODE-SPECIFIC GUIDANCE:\n${modeInstructions}` : '',
      strategyText ? `REPLY STRATEGY:\n${strategyText}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    // 6) Final user prompt: we keep the raw text, but can stitch in a brief instruction
    const userPrompt = latestUserText;

    logger.debug('[PromptOrchestrator] Built smarter prompt', {
      userId,
      mode: intel.mode,
      goal: intel.goal,
      emotion: intel.emotion,
    });

    return {
      systemPrompt,
      userPrompt,
      intel, // might be useful for logging or analytics later
    };
  } catch (error) {
    logger.warn('[PromptOrchestrator] Error building smarter prompt, returning null:', error.message);
    // Return null to signal fallback to existing prompt logic
    return null;
  }
}

