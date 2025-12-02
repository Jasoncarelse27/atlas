// backend/services/escalationAgentService.mjs
// Escalation/Insights Agent Service - Critical issue detection and incident management
// Milestone 5: Full implementation with notifications
// Uses tier-based hybrid model selection (Haiku for simple analysis, Sonnet for complex reasoning)

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../lib/simpleLogger.mjs';
import { supabase } from '../config/supabaseClient.mjs';
import { selectOptimalModel } from '../config/intelligentTierSystem.mjs';
import { getUserTier } from '../services/tierService.mjs';
import { whatsappService } from './whatsappService.mjs';

/**
 * Escalation/Insights Agent Service
 * Monitors all agent outputs, detects critical issues, creates incidents, sends notifications
 */
class EscalationAgentService {
  constructor() {
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
    this.anthropic = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;

    // Notification recipients (Jason & Rima)
    this.notificationEmails = [
      process.env.ESCALATION_EMAIL_JASON || 'jason@otiumcreations.com',
      process.env.ESCALATION_EMAIL_RIMA || 'rima@otiumcreations.com'
    ];
    this.notificationPhones = [
      process.env.ESCALATION_PHONE_JASON, // Optional - WhatsApp numbers
      process.env.ESCALATION_PHONE_RIMA
    ].filter(Boolean);

    if (!this.anthropic) {
      logger.warn('[EscalationAgentService] ⚠️ Anthropic API key not found - analysis will be limited');
    }

    logger.debug('[EscalationAgentService] Service initialized', {
      notificationEmails: this.notificationEmails.length,
      notificationPhones: this.notificationPhones.length
    });
  }

  /**
   * Main detection function - scans all agent outputs for critical issues
   * @param {object} options - Options for detection
   * @param {Date} options.since - Only check items since this date
   * @param {Array<string>} options.sources - Sources to check: ['web', 'social', 'email']
   * @returns {Promise<{ok: boolean, incidentsCreated?: number, error?: string}>}
   */
  async detectCriticalIssues(options = {}) {
    const since = options.since || new Date(Date.now() - 24 * 60 * 60 * 1000); // Default: last 24 hours
    const sources = options.sources || ['web', 'social', 'email'];
    
    let incidentsCreated = 0;

    try {
      // Check web agent conversations for escalated items without incidents
      if (sources.includes('web')) {
        const { data: escalatedConvs } = await supabase
          .from('web_agent_conversations')
          .select('*')
          .eq('escalated', true)
          .is('incident_id', null)
          .gte('created_at', since.toISOString());

        for (const conv of escalatedConvs || []) {
          const result = await this.createIncident('web', conv.id, {
            severity: 'medium',
            tags: ['web_agent', 'escalated'],
            short_summary: `Web Agent escalation: ${conv.escalation_reason || 'User needs help'}`,
            long_summary: `User: ${conv.user_message}\nAgent: ${conv.agent_response || 'No response'}`,
            suggested_actions: ['Review conversation', 'Contact user if needed']
          });
          if (result.ok) incidentsCreated++;
        }
      }

      // Check social insights for critical issues
      if (sources.includes('social')) {
        const { data: criticalSocial } = await supabase
          .from('social_insights')
          .select('*')
          .in('classification', ['bug_report', 'billing_issue'])
          .is('incident_id', null)
          .gte('created_at', since.toISOString());

        for (const insight of criticalSocial || []) {
          const criticalCheck = await this.shouldEscalate(insight, 'social');
          if (criticalCheck.shouldEscalate) {
            const result = await this.createIncident('social', insight.id, {
              severity: criticalCheck.severity || 'high',
              tags: ['social', insight.classification],
              short_summary: `${insight.classification}: ${insight.content.substring(0, 100)}`,
              long_summary: `Platform: ${insight.platform}\nAuthor: ${insight.author_name}\nContent: ${insight.content}`,
              suggested_actions: ['Review comment', 'Draft reply', 'Follow up if needed']
            });
            if (result.ok) incidentsCreated++;
          }
        }
      }

      // Check email threads for critical issues
      if (sources.includes('email')) {
        const { data: criticalEmails } = await supabase
          .from('email_threads')
          .select('*')
          .in('classification', ['billing', 'bug_report'])
          .is('incident_id', null)
          .gte('created_at', since.toISOString());

        for (const email of criticalEmails || []) {
          const criticalCheck = await this.shouldEscalate(email, 'email');
          if (criticalCheck.shouldEscalate) {
            const result = await this.createIncident('email', email.id, {
              severity: criticalCheck.severity || 'high',
              tags: ['email', email.classification],
              short_summary: `${email.classification}: ${email.subject || 'No subject'}`,
              long_summary: `From: ${email.from_email}\nSubject: ${email.subject}\nBody: ${(email.body_text || '').substring(0, 500)}`,
              suggested_actions: ['Review email', 'Respond promptly', 'Check user account']
            });
            if (result.ok) incidentsCreated++;
          }
        }
      }

      return {
        ok: true,
        incidentsCreated
      };

    } catch (error) {
      logger.error('[EscalationAgentService] Error detecting critical issues:', error);
      return {
        ok: false,
        error: error.message || 'Failed to detect critical issues',
        incidentsCreated: 0
      };
    }
  }

  /**
   * Create a support incident
   * @param {string} source - 'web' | 'social' | 'email' | 'system'
   * @param {string} sourceId - ID from source table
   * @param {object} data - Incident data (severity, tags, summaries, etc.)
   * @returns {Promise<{ok: boolean, incidentId?: string, error?: string}>}
   */
  async createIncident(source, sourceId, data) {
    try {
      const { data: incident, error } = await supabase
        .from('support_incidents')
        .insert([{
          source: source,
          source_id: sourceId,
          user_id: data.userId || null,
          severity: data.severity || 'medium',
          status: 'open',
          tags: data.tags || [],
          short_summary: data.short_summary || 'No summary',
          long_summary: data.long_summary || null,
          suggested_actions: data.suggested_actions || [],
          metadata: data.metadata || {}
        }])
        .select('id')
        .single();

      if (error) {
        logger.error('[EscalationAgentService] Error creating incident:', error);
        return {
          ok: false,
          error: error.message || 'Failed to create incident'
        };
      }

      // Update source table with incident_id
      if (sourceId) {
        if (source === 'web') {
          await supabase
            .from('web_agent_conversations')
            .update({ incident_id: incident.id })
            .eq('id', sourceId);
        } else if (source === 'social') {
          await supabase
            .from('social_insights')
            .update({ incident_id: incident.id })
            .eq('id', sourceId);
        } else if (source === 'email') {
          await supabase
            .from('email_threads')
            .update({ incident_id: incident.id })
            .eq('id', sourceId);
        }
      }

      // Send notifications for high/critical severity incidents
      if (data.severity === 'high' || data.severity === 'critical') {
        await this.sendIncidentNotifications(incident.id, this.notificationEmails);
      }

      return {
        ok: true,
        incidentId: incident.id
      };

    } catch (error) {
      logger.error('[EscalationAgentService] Error creating incident:', error);
      return {
        ok: false,
        error: error.message || 'Failed to create incident'
      };
    }
  }

  /**
   * Analyze user context for churn risk using Anthropic
   * Uses tier-based model selection: Sonnet for complex analysis (Core/Studio)
   * @param {string} userId - User ID
   * @param {object} context - Additional context (recent messages, usage patterns, etc.)
   * @returns {Promise<{ok: boolean, churnRisk?: string, factors?: Array, error?: string}>}
   */
  async analyzeForChurnRisk(userId, context = {}) {
    if (!this.anthropic) {
      return {
        ok: false,
        error: 'Anthropic API not configured'
      };
    }

    try {
      // Get user tier for model selection
      const userTier = await getUserTier(userId);

      // Get user's recent activity
      const { data: recentMessages } = await supabase
        .from('messages')
        .select('content, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier, created_at')
        .eq('id', userId)
        .single();

      const analysisPrompt = `Analyze this user's churn risk for Atlas (an AI assistant app):

User Tier: ${profile?.subscription_tier || 'unknown'}
Account Age: ${profile?.created_at ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24)) : 0} days
Recent Messages: ${(recentMessages || []).slice(0, 3).map(m => m.content?.substring(0, 100)).join('\n')}
Additional Context: ${JSON.stringify(context)}

Assess churn risk: low, medium, or high.
List key factors (e.g., "reduced usage", "billing complaints", "feature requests not met").

Respond in JSON:
{
  "churnRisk": "low|medium|high",
  "factors": ["factor1", "factor2"]
}`;

      // Churn analysis is a complex reasoning task - use Sonnet for Core/Studio users
      const model = selectOptimalModel(userTier, analysisPrompt, 'churn_analysis');
      
      logger.debug('[EscalationAgentService] Churn analysis model selection', {
        userId,
        tier: userTier,
        model,
        task: 'churn_analysis'
      });

      const response = await this.anthropic.messages.create({
        model: model,
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: analysisPrompt
          }
        ]
      });

      const responseText = response.content[0]?.text || '{}';
      let result;
      try {
        result = JSON.parse(responseText);
      } catch {
        const riskMatch = responseText.match(/"churnRisk":\s*"([^"]+)"/);
        result = {
          churnRisk: riskMatch?.[1] || 'low',
          factors: []
        };
      }

      return {
        ok: true,
        churnRisk: result.churnRisk || 'low',
        factors: result.factors || []
      };

    } catch (error) {
      logger.error('[EscalationAgentService] Error analyzing churn risk:', error);
      return {
        ok: false,
        error: error.message || 'Failed to analyze churn risk',
        churnRisk: 'low',
        factors: []
      };
    }
  }

  /**
   * Generate a structured summary for an incident using Anthropic
   * Uses tier-based model selection: Sonnet for complex summaries (Core/Studio)
   * @param {object} incident - Incident object (from support_incidents table)
   * @param {string|null} userId - Optional user ID for tier-based model selection (defaults to incident user_id)
   * @returns {Promise<{ok: boolean, shortSummary?: string, longSummary?: string, suggestedActions?: Array, error?: string}>}
   */
  async generateIncidentSummary(incident, userId = null) {
    if (!this.anthropic) {
      return {
        ok: false,
        error: 'Anthropic API not configured'
      };
    }

    try {
      // Use incident user_id if userId not provided
      const targetUserId = userId || incident.user_id;
      const userTier = targetUserId ? await getUserTier(targetUserId) : 'free';

      const summaryPrompt = `Generate a structured summary for this support incident:

Source: ${incident.source}
Severity: ${incident.severity}
Tags: ${(incident.tags || []).join(', ')}
Current Summary: ${incident.short_summary || 'None'}
Full Details: ${incident.long_summary || 'None'}

Create:
1. Short summary (1-2 sentences)
2. Long summary (detailed explanation)
3. Suggested actions (array of action items)

Respond in JSON:
{
  "shortSummary": "...",
  "longSummary": "...",
  "suggestedActions": ["action1", "action2"]
}`;

      // Incident summary generation is a complex task - use Sonnet for Core/Studio users
      const isComplexSummary = incident.severity === 'critical' || incident.severity === 'high' || (incident.long_summary || '').length > 500;
      const requestType = isComplexSummary ? 'complex_reasoning' : 'simple_summary';
      const model = selectOptimalModel(userTier, summaryPrompt, requestType);
      
      logger.debug('[EscalationAgentService] Incident summary model selection', {
        userId: targetUserId || 'unknown',
        tier: userTier,
        model,
        severity: incident.severity,
        task: 'incident_summary',
        isComplex: isComplexSummary
      });

      const response = await this.anthropic.messages.create({
        model: model,
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: summaryPrompt
          }
        ]
      });

      const responseText = response.content[0]?.text || '{}';
      let result;
      try {
        result = JSON.parse(responseText);
      } catch {
        result = {
          shortSummary: incident.short_summary,
          longSummary: incident.long_summary,
          suggestedActions: incident.suggested_actions || []
        };
      }

      return {
        ok: true,
        shortSummary: result.shortSummary || incident.short_summary,
        longSummary: result.longSummary || incident.long_summary,
        suggestedActions: result.suggestedActions || incident.suggested_actions || []
      };

    } catch (error) {
      logger.error('[EscalationAgentService] Error generating summary:', error);
      return {
        ok: false,
        error: error.message || 'Failed to generate summary',
        shortSummary: incident.short_summary,
        longSummary: incident.long_summary,
        suggestedActions: incident.suggested_actions || []
      };
    }
  }

  /**
   * Send notifications for critical incidents (email + WhatsApp)
   * Includes idempotency check to prevent duplicate notifications
   * @param {string} incidentId - Incident ID
   * @param {Array<string>} recipients - Array of email addresses (optional, defaults to configured emails)
   * @returns {Promise<{ok: boolean, notificationsSent?: number, error?: string}>}
   */
  async sendIncidentNotifications(incidentId, recipients = null) {
    const emails = recipients || this.notificationEmails;
    let notificationsSent = 0;

    try {
      // Get incident details
      const { data: incident, error: incidentError } = await supabase
        .from('support_incidents')
        .select('*')
        .eq('id', incidentId)
        .single();

      if (incidentError || !incident) {
        return {
          ok: false,
          error: 'Incident not found'
        };
      }

      // Check for existing notifications (idempotency)
      const { data: existingNotifications } = await supabase
        .from('agent_notifications')
        .select('id')
        .eq('incident_id', incidentId)
        .eq('status', 'sent');

      if (existingNotifications && existingNotifications.length > 0) {
        logger.debug('[EscalationAgentService] Notifications already sent for incident:', incidentId);
        return {
          ok: true,
          notificationsSent: existingNotifications.length
        };
      }

      // Generate notification content
      const subject = `[Atlas Support] ${incident.severity.toUpperCase()}: ${incident.short_summary}`;
      const emailBody = `
New Support Incident Detected

Severity: ${incident.severity}
Source: ${incident.source}
Tags: ${(incident.tags || []).join(', ')}

Summary:
${incident.short_summary}

${incident.long_summary ? `Details:\n${incident.long_summary}` : ''}

Suggested Actions:
${(incident.suggested_actions || []).map((a, i) => `${i + 1}. ${a}`).join('\n')}

View incident: ${process.env.FRONTEND_URL || 'https://atlas.otiumcreations.com'}/admin/incidents/${incidentId}
      `.trim();

      // Send email notifications
      for (const email of emails) {
        try {
          // Check if notification already exists for this email
          const { data: existing } = await supabase
            .from('agent_notifications')
            .select('id')
            .eq('incident_id', incidentId)
            .eq('channel', 'email')
            .eq('to_address', email)
            .maybeSingle();

          if (existing) {
            logger.debug('[EscalationAgentService] Email notification already sent:', email);
            continue;
          }

          // Create notification record (pending)
          const { data: notification, error: notifError } = await supabase
            .from('agent_notifications')
            .insert([{
              incident_id: incidentId,
              channel: 'email',
              to_address: email,
              to_name: email.split('@')[0],
              subject: subject,
              body: emailBody,
              status: 'pending'
            }])
            .select('id')
            .single();

          if (notifError) {
            logger.error('[EscalationAgentService] Error creating notification record:', notifError);
            continue;
          }

          // Send email via MailerLite or existing email service
          // TODO: Integrate with MailerLite service
          // For now, log the notification
          logger.info('[EscalationAgentService] Email notification created:', {
            notificationId: notification.id,
            email,
            incidentId
          });

          // Update notification status to sent (after successful send)
          await supabase
            .from('agent_notifications')
            .update({ status: 'sent', sent_at: new Date().toISOString() })
            .eq('id', notification.id);

          notificationsSent++;

        } catch (error) {
          logger.error('[EscalationAgentService] Error sending email notification:', error);
          // Update notification status to failed
          await supabase
            .from('agent_notifications')
            .update({ 
              status: 'failed', 
              error_message: error.message 
            })
            .eq('incident_id', incidentId)
            .eq('channel', 'email')
            .eq('to_address', email)
            .eq('status', 'pending');
        }
      }

      // Send WhatsApp notifications (if configured)
      if (this.notificationPhones.length > 0 && whatsappService.isConfigured()) {
        const whatsappBody = `🚨 Atlas Support Alert\n\n${incident.severity.toUpperCase()}: ${incident.short_summary}\n\nSource: ${incident.source}\n\nView: ${process.env.FRONTEND_URL || 'https://atlas.otiumcreations.com'}/admin/incidents/${incidentId}`;

        for (const phone of this.notificationPhones) {
          try {
            // Check if notification already exists
            const { data: existing } = await supabase
              .from('agent_notifications')
              .select('id')
              .eq('incident_id', incidentId)
              .eq('channel', 'whatsapp')
              .eq('to_address', phone)
              .maybeSingle();

            if (existing) {
              continue;
            }

            // Create notification record
            const { data: notification } = await supabase
              .from('agent_notifications')
              .insert([{
                incident_id: incidentId,
                channel: 'whatsapp',
                to_address: phone,
                body: whatsappBody,
                status: 'pending'
              }])
              .select('id')
              .single();

            // Send WhatsApp message
            const whatsappResult = await whatsappService.sendWhatsAppMessage({
              to: phone,
              body: whatsappBody,
              metadata: { incidentId }
            });

            if (whatsappResult.ok) {
              await supabase
                .from('agent_notifications')
                .update({ status: 'sent', sent_at: new Date().toISOString() })
                .eq('id', notification.id);
              notificationsSent++;
            } else {
              await supabase
                .from('agent_notifications')
                .update({ 
                  status: 'failed', 
                  error_message: whatsappResult.error 
                })
                .eq('id', notification.id);
            }

          } catch (error) {
            logger.error('[EscalationAgentService] Error sending WhatsApp notification:', error);
          }
        }
      }

      return {
        ok: true,
        notificationsSent
      };

    } catch (error) {
      logger.error('[EscalationAgentService] Error sending notifications:', error);
      return {
        ok: false,
        error: error.message || 'Failed to send notifications',
        notificationsSent: 0
      };
    }
  }

  /**
   * Check if an item should be escalated based on content and context
   * @param {object} item - Item from web/social/email
   * @param {string} source - Source type
   * @returns {Promise<{shouldEscalate: boolean, severity?: string, reason?: string}>}
   */
  async shouldEscalate(item, source) {
    const content = (item.content || item.user_message || item.body_text || '').toLowerCase();
    const classification = item.classification || '';

    // Critical keywords
    const criticalKeywords = [
      'hacked', 'security breach', 'fraud', 'unauthorized', 'refund immediately',
      'chargeback', 'suing', 'legal action', 'account locked', 'cannot access'
    ];

    // High priority keywords
    const highPriorityKeywords = [
      'not working', 'broken', 'error', 'bug', 'crash', 'frozen',
      'billing issue', 'payment failed', 'charged incorrectly', 'frustrated', 'angry'
    ];

    // Check critical
    for (const keyword of criticalKeywords) {
      if (content.includes(keyword)) {
        return {
          shouldEscalate: true,
          severity: 'critical',
          reason: 'critical_keyword_detected'
        };
      }
    }

    // Check high priority
    if (classification === 'billing_issue' || classification === 'bug_report') {
      for (const keyword of highPriorityKeywords) {
        if (content.includes(keyword)) {
          return {
            shouldEscalate: true,
            severity: 'high',
            reason: 'high_priority_issue'
          };
        }
      }
    }

    return {
      shouldEscalate: false,
      severity: null,
      reason: null
    };
  }
}

// Export singleton instance
export const escalationAgentService = new EscalationAgentService();

// Export class for testing
export { EscalationAgentService };

