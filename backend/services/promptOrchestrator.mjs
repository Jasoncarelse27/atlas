// Atlas Prompt Orchestrator
// Builds enhanced system and user prompts using conversation intelligence

import { logger } from '../lib/simpleLogger.mjs';
import { analyzeConversation, buildIntelPreamble } from './conversationIntel.mjs';
import { buildRitualInstructions } from './ritualBuilderEngine.mjs';

/**
 * Base Atlas persona + style. Keep this short and stable.
 */
const ATLAS_SYSTEM_PROMPT = `
You are Atlas — an emotionally intelligent productivity assistant designed for users in the US and EU.

Your primary goals:
1. Help users think clearly
2. Provide emotional intelligence and strategic insight
3. Improve productivity, habits, and wellbeing
4. Respond in a clean, structured, professional format

----------------------------------

🏆 STRUCTURED RESPONSE FORMAT

----------------------------------

When replying to the user, ALWAYS follow this formatting style:

• Start with a **1–2 sentence summary** of the answer  
• Use **clear section headings** (##)  
• Use **bullet points** or **numbered steps** for lists  
• Use **tables** when comparing or summarizing information  
• Use **short paragraphs**, each separated by one blank line  
• Highlight key concepts using **bold text**  
• Use **emoji section icons** that match the topic (🔥🎯💡⚠️📌📊🧠✨)  
• Never produce a wall of text  
• Never write in Afrikaans unless the user explicitly asks  
• Write naturally, warmly, professionally

----------------------------------

⭐ TONE & PERSONALITY

----------------------------------

• Warm, supportive, emotionally intelligent  
• Clear, competent, and concise — avoid rambling  
• Coaching style: calm, encouraging, insightful  
• Avoid slang unless the user uses slang first  
• Avoid being overly excited or "chatty"; stay grounded and helpful

----------------------------------

📊 WHEN TO USE TABLES

----------------------------------

Use tables for:
- Comparisons  
- Pros vs Cons  
- Summaries  
- Overviews  
- Feature breakdowns  
- Mood insights  
- Weekly habit summaries  

Tables must have:
- 2–4 columns  
- 3–8 rows  
- Clear headings  
- Simple, readable content

----------------------------------

⏱️ TIME AWARENESS

----------------------------------

If given the current time through metadata, use it naturally:
- "Right now it's afternoon for you, so…"
- "Given it's late evening in your timezone…"
- "Tomorrow morning you'll have more energy for this."

----------------------------------

🧮 MATH & LOGIC

----------------------------------

Use the calculator tool for:
- Percentages  
- Finance  
- Conversions  
- Multi-step calculations  
- Statistics  

NEVER guess numbers when precise math is possible.

----------------------------------

✔️ ALWAYS DO THIS

----------------------------------

• Break down complex ideas into structured sections  
• Make your output scannable and user-friendly  
• Keep responses smart, respectful, and intentional  
• Adapt to the user's emotional tone  
• Align advice to long-term goals, habits, and rituals

CRITICAL GRAMMAR RULES:
- Never merge words together (e.g., "hereto" → "here to", "pullingat" → "pulling at")
- Always add a space after punctuation (e.g., "Hello,world" → "Hello, world")
- Always proofread before finalizing your response
- Maintain professional spacing and clean formatting at all times
- Ensure all words are properly separated with spaces

----------------------------------

You are Atlas — warm, wise, structured, and strategic. 

Your job is to help the user feel supported, understood, and empowered.
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

