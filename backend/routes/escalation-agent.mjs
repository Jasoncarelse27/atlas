// backend/routes/escalation-agent.mjs
// Escalation Agent Route - Critical issue detection and notifications
// POST /api/agents/escalation (cron-safe, admin or service role)

import express from 'express';
import { logger } from '../lib/simpleLogger.mjs';
import { escalationAgentService } from '../services/escalationAgentService.mjs';
import { supabase } from '../config/supabaseClient.mjs';

const router = express.Router();

/**
 * POST /api/agents/escalation/detect
 * Scan all agent outputs for critical issues and create incidents
 * Designed to be cron-safe (idempotent)
 * 
 * Body (optional):
 * - since: ISO date string - Only check items since this date
 * - sources: Array<string> - Sources to check: ['web', 'social', 'email']
 * 
 * Response:
 * - ok: boolean
 * - incidentsCreated: number
 */
router.post('/detect', async (req, res) => {
  try {
    const { since, sources } = req.body;

    const sinceDate = since ? new Date(since) : new Date(Date.now() - 24 * 60 * 60 * 1000); // Default: last 24 hours

    logger.info('[EscalationAgent] Running critical issue detection', {
      since: sinceDate.toISOString(),
      sources: sources || ['web', 'social', 'email']
    });

    const result = await escalationAgentService.detectCriticalIssues({
      since: sinceDate,
      sources: sources || ['web', 'social', 'email']
    });

    if (!result.ok) {
      return res.status(500).json({
        ok: false,
        error: result.error || 'Failed to detect critical issues'
      });
    }

    res.json({
      ok: true,
      incidentsCreated: result.incidentsCreated || 0
    });

  } catch (error) {
    logger.error('[EscalationAgent] Error in detect endpoint:', error);
    res.status(500).json({
      ok: false,
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/agents/escalation/notify
 * Send notifications for a specific incident
 * Includes idempotency check
 * 
 * Body:
 * - incidentId: string (required)
 * 
 * Response:
 * - ok: boolean
 * - notificationsSent: number
 */
router.post('/notify', async (req, res) => {
  try {
    const { incidentId } = req.body;

    if (!incidentId) {
      return res.status(400).json({
        ok: false,
        error: 'incidentId is required'
      });
    }

    logger.info('[EscalationAgent] Sending notifications for incident:', incidentId);

    const result = await escalationAgentService.sendIncidentNotifications(incidentId);

    if (!result.ok) {
      return res.status(500).json({
        ok: false,
        error: result.error || 'Failed to send notifications'
      });
    }

    res.json({
      ok: true,
      notificationsSent: result.notificationsSent || 0
    });

  } catch (error) {
    logger.error('[EscalationAgent] Error in notify endpoint:', error);
    res.status(500).json({
      ok: false,
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;


