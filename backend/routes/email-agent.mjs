// backend/routes/email-agent.mjs
// Email Agent Route - Gmail API integration, classification, draft generation
// POST /api/agents/email (admin only)
//
// Gmail OAuth Setup Required:
// 1. Place credentials.json in backend/config/ (from Google Cloud Console)
// 2. Run: node backend/scripts/generate-gmail-token.mjs
// 3. This generates token.json in backend/config/
// 4. Set EMAIL_AGENT_ENABLED=true in .env
//
// The Email Agent uses OAuth 2.0 to access the authenticated user's Gmail inbox.

import express from 'express';
import { supabase } from '../config/supabaseClient.mjs';
import { logger } from '../lib/simpleLogger.mjs';
import { requireAdmin } from '../middleware/adminAuth.mjs';
import { emailAgentService } from '../services/emailAgentService.mjs';

const router = express.Router();

// All routes require admin authentication
router.use(requireAdmin);

/**
 * POST /api/agents/email/fetch
 * Fetch new emails from a mailbox and process them
 * 
 * Body:
 * - mailbox: 'info' | 'jason' | 'rima' (required)
 * - since: ISO date string (optional) - fetch emails since this date
 * 
 * Response:
 * - ok: boolean
 * - processed: number - Number of emails processed
 * - threads: Array - Email threads created
 */
router.post('/fetch', async (req, res) => {
  try {
    const { mailbox, since } = req.body;

    if (!mailbox || !['info', 'jason', 'rima'].includes(mailbox)) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid mailbox. Must be "info", "jason", or "rima"'
      });
    }

    const sinceDate = since ? new Date(since) : new Date(Date.now() - 24 * 60 * 60 * 1000); // Default: last 24 hours

    logger.info('[EmailAgent] Fetching emails', {
      mailbox,
      since: sinceDate.toISOString()
    });

    // Fetch emails
    const fetchResult = await emailAgentService.fetchNewEmails(mailbox, sinceDate);

    if (!fetchResult.ok) {
      // Check if it's an OAuth configuration error
      const isConfigError = fetchResult.error?.includes('OAuth not configured') || 
                           fetchResult.error?.includes('credentials.json') ||
                           fetchResult.error?.includes('token.json');
      
      return res.status(isConfigError ? 500 : 500).json({
        ok: false,
        error: fetchResult.error || 'Failed to fetch emails',
        ...(isConfigError && {
          setupRequired: true,
          setupInstructions: 'Place credentials.json in backend/config/ and run: node backend/scripts/generate-gmail-token.mjs'
        })
      });
    }

    const emails = fetchResult.emails || [];
    const processedThreads = [];

    // Process each email
    for (const email of emails) {
      try {
        // Check if thread already exists
        const { data: existingThread } = await supabase
          .from('email_threads')
          .select('id')
          .eq('gmail_thread_id', email.threadId || email.id)
          .maybeSingle();

        if (existingThread) {
          logger.debug('[EmailAgent] Thread already exists, skipping', {
            threadId: email.threadId
          });
          continue;
        }

        // Extract structured data first to get userId for tier-based model selection
        const extractionResult = await emailAgentService.extractStructuredData(email);
        const { userId, tier, extractedData } = extractionResult;

        // Classify email (pass userId for tier-aware model selection)
        const classificationResult = await emailAgentService.classifyEmail(email, userId);
        const classification = classificationResult.classification || 'other';

        // Check if critical
        const criticalCheck = await emailAgentService.isCriticalIssue(email, classification);
        let incidentId = null;

        if (criticalCheck.isCritical) {
          // Create incident via Escalation Agent
          const { escalationAgentService } = await import('../services/escalationAgentService.mjs');
          const incidentResult = await escalationAgentService.createIncident(
            'email',
            null, // source_id will be set after thread creation
            {
              severity: criticalCheck.severity || 'high',
              tags: ['email', classification, 'critical'],
              short_summary: `Critical email: ${email.subject || 'No subject'}`,
              long_summary: `From: ${email.from_email}\nSubject: ${email.subject}\nBody: ${(email.body_text || '').substring(0, 500)}`,
              suggested_actions: ['Review email', 'Respond promptly']
            }
          );
          incidentId = incidentResult.incidentId;
        }

        // Create email thread
        const { data: thread, error: threadError } = await supabase
          .from('email_threads')
          .insert([{
            gmail_thread_id: email.threadId || email.id,
            gmail_message_id: email.messageId || email.id,
            mailbox: mailbox,
            from_email: email.from_email || email.from,
            from_name: email.from_name || email.from,
            subject: email.subject,
            body_text: email.body_text || email.body,
            body_html: email.body_html,
            classification: classification,
            user_id: userId,
            tier: tier,
            extracted_data: extractedData,
            status: 'classified',
            incident_id: incidentId,
            metadata: {
              fetched_at: new Date().toISOString(),
              original_email: email
            }
          }])
          .select('id')
          .single();

        if (threadError) {
          logger.error('[EmailAgent] Error creating thread:', threadError);
          continue;
        }

        // Generate draft reply (pass userId for tier-aware model selection)
        const draftResult = await emailAgentService.generateDraftReply(email, classification, userId);
        if (draftResult.ok && draftResult.draftText) {
          await supabase
            .from('email_draft_replies')
            .insert([{
              thread_id: thread.id,
              draft_text: draftResult.draftText,
              draft_html: draftResult.draftHtml,
              status: 'pending'
            }]);

          // Update thread status
          await supabase
            .from('email_threads')
            .update({ status: 'draft_generated' })
            .eq('id', thread.id);

          // Insert notification for important emails
          try {
            const importantTypes = ['support', 'billing', 'bug_report', 'partnership'];

            if (importantTypes.includes(classification)) {
              const userId = req.user?.id;
              if (userId) {
                await supabase.from('notifications').insert({
                  user_id: userId,
                  title: `New ${classification} email`,
                  body: email.subject,
                  type: `email_agent.${classification}`,
                  metadata: {
                    messageId: email.messageId,
                    subject: email.subject
                  }
                });
              }
            }
          } catch (err) {
            logger.error('[EmailAgent] Notification insert error:', err);
          }
        }

        processedThreads.push({
          threadId: thread.id,
          subject: email.subject,
          classification,
          critical: criticalCheck.isCritical,
          incidentId
        });

      } catch (error) {
        logger.error('[EmailAgent] Error processing email:', error);
        // Continue with next email
      }
    }

    res.json({
      ok: true,
      processed: processedThreads.length,
      threads: processedThreads
    });

  } catch (error) {
    logger.error('[EmailAgent] Error in fetch endpoint:', error);
    res.status(500).json({
      ok: false,
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;


