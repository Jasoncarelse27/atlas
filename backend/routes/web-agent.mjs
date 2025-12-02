// backend/routes/web-agent.mjs
// Web Agent Route - FAQ, Onboarding, Tech Support endpoint
// POST /api/agents/web-support

import express from 'express';
import { logger } from '../lib/simpleLogger.mjs';
import { webAgentService } from '../services/webAgentService.mjs';

const router = express.Router();

/**
 * POST /api/agents/web-support
 * Web Agent endpoint for FAQ, onboarding, and tech support
 * 
 * Body:
 * - message: string (required) - User's question/message
 * - source: 'rima_site' | 'atlas_app' (optional, defaults to 'atlas_app')
 * 
 * Headers:
 * - Authorization: Bearer <token> (optional - for logged-in users)
 * 
 * Response:
 * - ok: boolean
 * - response: string - Agent's response
 * - escalated: boolean - Whether conversation was escalated
 * - conversationId: string - Conversation ID for tracking
 */
router.post('/web-support', async (req, res) => {
  try {
    const { message, source = 'atlas_app' } = req.body;
    const userId = req.user?.id || null; // Optional - from auth middleware if present

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'Message is required'
      });
    }

    // Validate source
    if (source !== 'rima_site' && source !== 'atlas_app') {
      return res.status(400).json({
        ok: false,
        error: 'Invalid source. Must be "rima_site" or "atlas_app"'
      });
    }

    logger.debug('[WebAgent] Processing request', {
      userId: userId || 'anonymous',
      source,
      messageLength: message.length
    });

    // Process message through Web Agent
    const result = await webAgentService.processWebAgentMessage(message, userId, source);

    if (!result.ok) {
      return res.status(500).json({
        ok: false,
        error: result.error || 'Failed to process message'
      });
    }

    // Return response
    res.json({
      ok: true,
      response: result.response,
      escalated: result.escalated || false,
      conversationId: result.conversationId,
      incidentId: result.incidentId || null
    });

  } catch (error) {
    logger.error('[WebAgent] Error in web-support endpoint:', error);
    res.status(500).json({
      ok: false,
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;


