// backend/services/moderationService.mjs
/**
 * Content Moderation Service
 * 
 * Implements OpenAI Moderation API for NSFW content filtering
 * Part of multi-layer defense strategy:
 * 1. OpenAI Moderation API (user input screening)
 * 2. Anthropic Claude safety filters (AI response filtering - built-in)
 * 3. Response filtering (post-processing - already implemented)
 * 4. User reporting (community-driven - to be added)
 * 
 * Created: 2025-11-14
 */

import OpenAI from 'openai';
import { logger } from '../lib/simpleLogger.mjs';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

/**
 * Moderation result type (JSDoc for .mjs compatibility)
 * @typedef {Object} ModerationResult
 * @property {boolean} flagged
 * @property {Object} categories
 * @property {boolean} categories.sexual
 * @property {boolean} categories.hate
 * @property {boolean} categories.harassment
 * @property {boolean} categories['self-harm']
 * @property {boolean} categories.violence
 * @property {boolean} categories['sexual/minors']
 * @property {boolean} categories['hate/threatening']
 * @property {boolean} categories['violence/graphic']
 * @property {Object} categoryScores
 * @property {number} categoryScores.sexual
 * @property {number} categoryScores.hate
 * @property {number} categoryScores.harassment
 * @property {number} categoryScores['self-harm']
 * @property {number} categoryScores.violence
 * @property {number} categoryScores['sexual/minors']
 * @property {number} categoryScores['hate/threatening']
 * @property {number} categoryScores['violence/graphic']
 * @property {number} highestScore
 * @property {string|null} highestCategory
 */

/**
 * Check if content violates moderation policies
 * @param {string} content - Content to check
 * @returns {Promise<ModerationResult>} Moderation result with flags and scores
 */
export async function checkContentModeration(content) {
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return {
      flagged: false,
      categories: {},
      categoryScores: {},
      highestScore: 0,
      highestCategory: null,
    };
  }

  // If OpenAI client not available, log warning but allow (fail-open for availability)
  if (!openai) {
    logger.warn('[ModerationService] OpenAI client not available - skipping moderation check');
    return {
      flagged: false,
      categories: {},
      categoryScores: {},
      highestScore: 0,
      highestCategory: null,
      warning: 'Moderation service unavailable',
    };
  }

  try {
    const moderation = await openai.moderations.create({
      input: content,
    });

    const result = moderation.results[0];
    
    if (!result) {
      logger.warn('[ModerationService] No moderation result returned');
      return {
        flagged: false,
        categories: {},
        categoryScores: {},
        highestScore: 0,
        highestCategory: null,
      };
    }

    const categories = {
      sexual: result.categories.sexual || false,
      hate: result.categories.hate || false,
      harassment: result.categories.harassment || false,
      'self-harm': result.categories['self-harm'] || false,
      violence: result.categories.violence || false,
      'sexual/minors': result.categories['sexual/minors'] || false,
      'hate/threatening': result.categories['hate/threatening'] || false,
      'violence/graphic': result.categories['violence/graphic'] || false,
    };

    const categoryScores = {
      sexual: result.category_scores.sexual || 0,
      hate: result.category_scores.hate || 0,
      harassment: result.category_scores.harassment || 0,
      'self-harm': result.category_scores['self-harm'] || 0,
      violence: result.category_scores.violence || 0,
      'sexual/minors': result.category_scores['sexual/minors'] || 0,
      'hate/threatening': result.category_scores['hate/threatening'] || 0,
      'violence/graphic': result.category_scores['violence/graphic'] || 0,
    };

    // Find highest score and category
    const scores = Object.entries(categoryScores);
    const [highestCategory, highestScore] = scores.reduce(
      (max, [category, score]) => (score > max[1] ? [category, score] : max),
      [null, 0]
    );

    const flagged = result.flagged || false;

    // Log moderation decisions for audit
    if (flagged) {
      logger.warn('[ModerationService] Content flagged:', {
        flagged,
        highestCategory,
        highestScore: highestScore.toFixed(4),
        categories: Object.entries(categories)
          .filter(([, value]) => value)
          .map(([key]) => key),
      });
    } else {
      logger.debug('[ModerationService] Content passed moderation check');
    }

    return {
      flagged,
      categories,
      categoryScores,
      highestScore,
      highestCategory,
    };
  } catch (error) {
    // Fail-open: If moderation service fails, log error but allow content
    // This prevents moderation service outages from blocking legitimate users
    logger.error('[ModerationService] Error checking content:', {
      error: error.message,
      stack: error.stack,
    });

    return {
      flagged: false,
      categories: {},
      categoryScores: {},
      highestScore: 0,
      highestCategory: null,
      error: 'Moderation service unavailable',
    };
  }
}

/**
 * Determine if content should be blocked based on moderation result
 * Uses confidence threshold: high-confidence violations (>0.9) are blocked
 * @param {ModerationResult} moderationResult - Result from checkContentModeration
 * @returns {boolean} True if content should be blocked
 */
export function shouldBlockContent(moderationResult) {
  if (!moderationResult.flagged) {
    return false;
  }

  // Block high-confidence violations (>0.9)
  // Medium-confidence (0.5-0.9) are logged but allowed (for manual review)
  // Low-confidence (<0.5) are allowed with monitoring
  const BLOCK_THRESHOLD = 0.9;
  
  return moderationResult.highestScore >= BLOCK_THRESHOLD;
}

/**
 * Get user-friendly error message for blocked content
 * Does not reveal moderation details to prevent gaming
 * @returns {string} User-friendly error message
 */
export function getModerationErrorMessage() {
  return "Your message couldn't be processed. Please rephrase your message to continue.";
}

