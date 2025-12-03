// Atlas Text Cleaner v2.0 (MINIMAL - No Text Corruption)
// ✅ FIXED: Removed all aggressive regex patterns that were corrupting Claude's output
// The AI sends properly formatted text - we just collapse multiple spaces and do branding

import { logger } from '../lib/simpleLogger.mjs';

/**
 * Minimal text cleaner — DO NOT modify model output.
 * Only collapse multiple spaces.
 * 
 * ✅ FIXED: All aggressive regex patterns removed.
 * Claude sends clean text, we just display it.
 */
export function fixPunctuationSpacing(text) {
  if (!text) return text;
  
  // ✅ ONLY collapse multiple spaces - nothing else
  return text.replace(/\s{2,}/g, ' ').trim();
}

/**
 * Main export: cleans all AI responses
 * ✅ MINIMAL: Only collapses multiple spaces
 */
export function cleanAIResponse(text) {
  if (!text) return text;
  
  try {
    // ✅ ONLY collapse multiple spaces - nothing else
    return text.replace(/\s{2,}/g, ' ').trim();
  } catch (e) {
    logger.warn('[TextCleaner] Failed to clean text:', e.message);
    return text; // fail safe - never break the response
  }
}
