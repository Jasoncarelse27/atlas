// backend/services/socialAgentService.mjs
// Social Media Agent Service - Fetch, classify, and draft replies for social media
// Milestone 4: Full implementation with abstracted interfaces
// Uses tier-based hybrid model selection (Haiku for classification, Sonnet for draft generation)

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../lib/simpleLogger.mjs';
import { supabase } from '../config/supabaseClient.mjs';
import { selectOptimalModel } from '../config/intelligentTierSystem.mjs';
import { getUserTier } from '../services/tierService.mjs';

/**
 * Social Media Agent Service
 * Handles fetching and analyzing social media comments from Facebook, Instagram, YouTube
 * 
 * NOTE: Platform-specific API credentials must be configured:
 * - FACEBOOK_ACCESS_TOKEN: Facebook Graph API token
 * - INSTAGRAM_ACCESS_TOKEN: Instagram Graph API token
 * - YOUTUBE_API_KEY: YouTube Data API key
 */
class SocialAgentService {
  constructor() {
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
    this.anthropic = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;

    // Platform API credentials (abstracted - can be swapped)
    this.facebookToken = process.env.FACEBOOK_ACCESS_TOKEN;
    this.instagramToken = process.env.INSTAGRAM_ACCESS_TOKEN;
    this.youtubeApiKey = process.env.YOUTUBE_API_KEY;

    if (!this.anthropic) {
      logger.warn('[SocialAgentService] ⚠️ Anthropic API key not found - classification will not work');
    }

    logger.debug('[SocialAgentService] Service initialized', {
      facebookConfigured: !!this.facebookToken,
      instagramConfigured: !!this.instagramToken,
      youtubeConfigured: !!this.youtubeApiKey
    });
  }

  /**
   * Fetch recent comments from a social media platform (abstracted interface)
   * @param {string} platform - 'facebook' | 'instagram' | 'youtube'
   * @param {Date} since - Fetch comments since this date
   * @returns {Promise<{ok: boolean, comments?: Array, error?: string}>}
   */
  async fetchRecentComments(platform, since) {
    try {
      if (platform === 'facebook') {
        return await this._fetchFacebookComments(since);
      } else if (platform === 'instagram') {
        return await this._fetchInstagramComments(since);
      } else if (platform === 'youtube') {
        return await this._fetchYouTubeComments(since);
      } else {
        return {
          ok: false,
          error: `Unsupported platform: ${platform}`
        };
      }
    } catch (error) {
      logger.error('[SocialAgentService] Error fetching comments:', error);
      return {
        ok: false,
        error: error.message || 'Failed to fetch comments'
      };
    }
  }

  /**
   * Fetch Facebook comments (abstracted - can be swapped with different provider)
   * @private
   */
  async _fetchFacebookComments(since) {
    if (!this.facebookToken) {
      return {
        ok: false,
        error: 'Facebook API token not configured'
      };
    }

    // TODO: Implement Facebook Graph API call
    // GET /{page-id}/comments?since={timestamp}
    logger.debug('[SocialAgentService] Facebook API fetch not yet fully implemented');
    
    return {
      ok: true,
      comments: []
    };
  }

  /**
   * Fetch Instagram comments (abstracted - can be swapped with different provider)
   * @private
   */
  async _fetchInstagramComments(since) {
    if (!this.instagramToken) {
      return {
        ok: false,
        error: 'Instagram API token not configured'
      };
    }

    // TODO: Implement Instagram Graph API call
    logger.debug('[SocialAgentService] Instagram API fetch not yet fully implemented');
    
    return {
      ok: true,
      comments: []
    };
  }

  /**
   * Fetch YouTube comments (abstracted - can be swapped with different provider)
   * @private
   */
  async _fetchYouTubeComments(since) {
    if (!this.youtubeApiKey) {
      return {
        ok: false,
        error: 'YouTube API key not configured'
      };
    }

    // TODO: Implement YouTube Data API call
    // GET /youtube/v3/commentThreads?part=snippet&videoId={videoId}
    logger.debug('[SocialAgentService] YouTube API fetch not yet fully implemented');
    
    return {
      ok: true,
      comments: []
    };
  }

  /**
   * Classify a social media comment using Anthropic
   * Uses Haiku for classification (simple task) - cost-optimized
   * @param {object} comment - Comment object with content, author, etc.
   * @param {string|null} userId - Optional user ID for tier-based model selection
   * @returns {Promise<{ok: boolean, classification?: string, sentiment?: string, error?: string}>}
   */
  async classifyComment(comment, userId = null) {
    if (!this.anthropic) {
      return {
        ok: false,
        error: 'Anthropic API not configured'
      };
    }

    try {
      const classificationPrompt = `Classify this social media comment about Atlas:

Comment: "${comment.content || ''}"
Author: ${comment.author_name || 'Unknown'}

Categories:
- bug_report: Reports a bug or technical issue
- billing_issue: Payment, subscription, or billing problem
- feature_request: Request for a new feature
- praise: Positive feedback or compliment
- spam: Spam or irrelevant comment
- other: Doesn't fit other categories

Also determine sentiment: positive, neutral, or negative.

Respond in JSON format:
{
  "classification": "category_name",
  "sentiment": "positive|neutral|negative"
}`;

      // Classification is a simple task - use Haiku for cost efficiency
      const userTier = userId ? await getUserTier(userId) : 'free';
      const model = selectOptimalModel(userTier, classificationPrompt, 'classification');
      
      logger.debug('[SocialAgentService] Classification model selection', {
        userId: userId || 'unknown',
        tier: userTier,
        model,
        task: 'classification'
      });

      const response = await this.anthropic.messages.create({
        model: model,
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: classificationPrompt
          }
        ]
      });

      const responseText = response.content[0]?.text || '{}';
      let result;
      try {
        result = JSON.parse(responseText);
      } catch {
        // Fallback parsing
        const classificationMatch = responseText.match(/"classification":\s*"([^"]+)"/);
        const sentimentMatch = responseText.match(/"sentiment":\s*"([^"]+)"/);
        result = {
          classification: classificationMatch?.[1] || 'other',
          sentiment: sentimentMatch?.[1] || 'neutral'
        };
      }

      const validClassifications = ['bug_report', 'billing_issue', 'feature_request', 'praise', 'spam', 'other'];
      const classification = validClassifications.includes(result.classification) ? result.classification : 'other';
      
      const validSentiments = ['positive', 'neutral', 'negative'];
      const sentiment = validSentiments.includes(result.sentiment) ? result.sentiment : 'neutral';

      return {
        ok: true,
        classification,
        sentiment
      };

    } catch (error) {
      logger.error('[SocialAgentService] Error classifying comment:', error);
      return {
        ok: false,
        error: error.message || 'Failed to classify comment',
        classification: 'other',
        sentiment: 'neutral'
      };
    }
  }

  /**
   * Generate a draft reply for a social media comment using Anthropic
   * @param {object} insight - Social insight object (from social_insights table)
   * @returns {Promise<{ok: boolean, draftText?: string, error?: string}>}
   */
  async generateDraftReply(insight) {
    if (!this.anthropic) {
      return {
        ok: false,
        error: 'Anthropic API not configured'
      };
    }

    try {
      const draftPrompt = `Write a friendly, professional reply to this social media comment about Atlas.

Comment: "${insight.content}"
Classification: ${insight.classification}
Sentiment: ${insight.sentiment}

Guidelines:
- Keep it concise (1-2 sentences max for social media)
- Be friendly and helpful
- For bug reports: Acknowledge and ask for details
- For billing issues: Offer to help via email/DM
- For feature requests: Thank them and note we'll consider it
- For praise: Thank them warmly
- Match the platform tone (casual but professional)

Do NOT include hashtags or @mentions unless appropriate.`;

      // Draft generation is a complex task - use Sonnet for Core/Studio users
      const userTier = userId ? await getUserTier(userId) : 'free';
      const isComplexDraft = insight.classification === 'billing_issue' || insight.classification === 'bug_report' || insight.sentiment === 'negative';
      const requestType = isComplexDraft ? 'draft_generation' : 'simple_draft';
      const model = selectOptimalModel(userTier, draftPrompt, requestType);
      
      logger.debug('[SocialAgentService] Draft generation model selection', {
        userId: userId || 'unknown',
        tier: userTier,
        model,
        classification: insight.classification,
        task: 'draft_generation',
        isComplex: isComplexDraft
      });

      const response = await this.anthropic.messages.create({
        model: model,
        max_tokens: 150,
        messages: [
          {
            role: 'user',
            content: draftPrompt
          }
        ]
      });

      const draftText = response.content[0]?.text || '';

      return {
        ok: true,
        draftText: draftText.trim()
      };

    } catch (error) {
      logger.error('[SocialAgentService] Error generating draft reply:', error);
      return {
        ok: false,
        error: error.message || 'Failed to generate draft reply'
      };
    }
  }

  /**
   * Analyze a batch of comments and classify them
   * @param {Array} comments - Array of comment objects
   * @returns {Promise<{ok: boolean, summaries?: Array, criticalIssues?: Array, error?: string}>}
   */
  async analyzeComments(comments) {
    if (!comments || comments.length === 0) {
      return {
        ok: true,
        summaries: [],
        criticalIssues: []
      };
    }

    const summaries = [];
    const criticalIssues = [];

    for (const comment of comments) {
      try {
        const classificationResult = await this.classifyComment(comment);
        if (!classificationResult.ok) continue;

        const { classification, sentiment } = classificationResult;
        const criticalCheck = await this.isCriticalIssue(comment, classification);

        summaries.push({
          commentId: comment.id,
          author: comment.author_name,
          content: comment.content.substring(0, 100),
          classification,
          sentiment,
          critical: criticalCheck.isCritical
        });

        if (criticalCheck.isCritical) {
          criticalIssues.push({
            commentId: comment.id,
            severity: criticalCheck.severity,
            classification,
            content: comment.content
          });
        }

      } catch (error) {
        logger.error('[SocialAgentService] Error analyzing comment:', error);
      }
    }

    return {
      ok: true,
      summaries,
      criticalIssues
    };
  }

  /**
   * Check if a comment indicates a critical issue that needs escalation
   * @param {object} comment - Comment object
   * @param {string} classification - Classification result
   * @returns {Promise<{isCritical: boolean, severity?: string}>}
   */
  async isCriticalIssue(comment, classification) {
    const content = (comment.content || '').toLowerCase();

    // Critical keywords
    const criticalKeywords = [
      'hacked', 'security breach', 'fraud', 'unauthorized',
      'refund immediately', 'chargeback', 'suing', 'legal action'
    ];

    // High priority
    const highPriorityKeywords = [
      'not working', 'broken', 'error', 'bug', 'crash', 'frozen',
      'billing issue', 'payment failed', 'charged incorrectly'
    ];

    // Check critical
    for (const keyword of criticalKeywords) {
      if (content.includes(keyword)) {
        return {
          isCritical: true,
          severity: 'critical'
        };
      }
    }

    // Check high priority
    if (classification === 'billing_issue' || classification === 'bug_report') {
      for (const keyword of highPriorityKeywords) {
        if (content.includes(keyword)) {
          return {
            isCritical: true,
            severity: 'high'
          };
        }
      }
    }

    return {
      isCritical: false,
      severity: null
    };
  }
}

// Export singleton instance
export const socialAgentService = new SocialAgentService();

// Export class for testing
export { SocialAgentService };

