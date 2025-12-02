// backend/routes/social-agent.mjs
// Social Media Agent Route - Fetch, classify, and draft replies
// POST /api/agents/social (admin only)

import express from 'express';
import { logger } from '../lib/simpleLogger.mjs';
import { requireAdmin } from '../middleware/adminAuth.mjs';
import { socialAgentService } from '../services/socialAgentService.mjs';
import { supabase } from '../config/supabaseClient.mjs';
import { escalationAgentService } from '../services/escalationAgentService.mjs';

const router = express.Router();

// All routes require admin authentication
router.use(requireAdmin);

/**
 * POST /api/agents/social/fetch
 * Fetch and process social media comments
 * 
 * Body:
 * - platform: 'facebook' | 'instagram' | 'youtube' (required)
 * - since: ISO date string (optional) - fetch comments since this date
 * 
 * Response:
 * - ok: boolean
 * - processed: number - Number of comments processed
 * - insights: Array - Social insights created
 */
router.post('/fetch', async (req, res) => {
  try {
    const { platform, since } = req.body;

    if (!platform || !['facebook', 'instagram', 'youtube'].includes(platform)) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid platform. Must be "facebook", "instagram", or "youtube"'
      });
    }

    const sinceDate = since ? new Date(since) : new Date(Date.now() - 24 * 60 * 60 * 1000); // Default: last 24 hours

    logger.info('[SocialAgent] Fetching comments', {
      platform,
      since: sinceDate.toISOString()
    });

    // Fetch comments
    const fetchResult = await socialAgentService.fetchRecentComments(platform, sinceDate);

    if (!fetchResult.ok) {
      return res.status(500).json({
        ok: false,
        error: fetchResult.error || 'Failed to fetch comments'
      });
    }

    const comments = fetchResult.comments || [];
    const processedInsights = [];

    // Process each comment
    for (const comment of comments) {
      try {
        // Classify comment
        const classificationResult = await socialAgentService.classifyComment(comment);
        if (!classificationResult.ok) continue;

        const { classification, sentiment } = classificationResult;

        // Check if critical
        const criticalCheck = await socialAgentService.isCriticalIssue(comment, classification);
        let incidentId = null;

        if (criticalCheck.isCritical) {
          // Create incident
          const incidentResult = await escalationAgentService.createIncident(
            'social',
            null, // source_id will be set after insight creation
            {
              severity: criticalCheck.severity || 'high',
              tags: ['social', platform, classification],
              short_summary: `${classification}: ${comment.content.substring(0, 100)}`,
              long_summary: `Platform: ${platform}\nAuthor: ${comment.author_name}\nContent: ${comment.content}`,
              suggested_actions: ['Review comment', 'Draft reply', 'Follow up if needed']
            }
          );
          incidentId = incidentResult.incidentId;
        }

        // Match user by email/name if possible (needed for tier-based model selection)
        let userId = null;
        if (comment.author_email) {
          const { emailAgentService } = await import('../services/emailAgentService.mjs');
          const userMatch = await emailAgentService.matchUserByEmail(comment.author_email);
          userId = userMatch.userId || null;
        }

        // Re-classify with userId for tier-aware model selection (if userId found)
        if (userId) {
          const reclassificationResult = await socialAgentService.classifyComment(comment, userId);
          if (reclassificationResult.ok) {
            // Use updated classification if available
            const { classification: updatedClassification, sentiment: updatedSentiment } = reclassificationResult;
            if (updatedClassification) classification = updatedClassification;
            if (updatedSentiment) sentiment = updatedSentiment;
          }
        }

        // Create social insight
        const { data: insight, error: insightError } = await supabase
          .from('social_insights')
          .insert([{
            platform: platform,
            post_id: comment.postId,
            comment_id: comment.id,
            author_name: comment.author_name,
            author_id: comment.author_id,
            content: comment.content,
            classification: classification,
            sentiment: sentiment,
            user_id: userId,
            incident_id: incidentId,
            metadata: {
              fetched_at: new Date().toISOString(),
              original_comment: comment
            }
          }])
          .select('id')
          .single();

        if (insightError) {
          logger.error('[SocialAgent] Error creating insight:', insightError);
          continue;
        }

        // Update incident with source_id if created
        if (incidentId) {
          await supabase
            .from('support_incidents')
            .update({ source_id: insight.id })
            .eq('id', incidentId);
        }

        // Generate draft reply (pass userId for tier-aware model selection)
        const draftResult = await socialAgentService.generateDraftReply({
          id: insight.id,
          content: comment.content,
          classification,
          sentiment
        }, userId);

        if (draftResult.ok && draftResult.draftText) {
          await supabase
            .from('social_draft_replies')
            .insert([{
              insight_id: insight.id,
              draft_text: draftResult.draftText,
              status: 'pending'
            }]);
        }

        processedInsights.push({
          insightId: insight.id,
          platform,
          classification,
          sentiment,
          critical: criticalCheck.isCritical,
          incidentId
        });

      } catch (error) {
        logger.error('[SocialAgent] Error processing comment:', error);
        // Continue with next comment
      }
    }

    res.json({
      ok: true,
      processed: processedInsights.length,
      insights: processedInsights
    });

  } catch (error) {
    logger.error('[SocialAgent] Error in fetch endpoint:', error);
    res.status(500).json({
      ok: false,
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;


