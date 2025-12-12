// backend/services/emailAgentService.mjs
// Email Agent Service - Gmail API integration, classification, draft generation
// Uses OAuth 2.0 for Gmail API access
// Uses tier-based hybrid model selection (Haiku for classification, Sonnet for draft generation)

import Anthropic from '@anthropic-ai/sdk';
import { getGmailClient, isGmailConfigured } from '../config/gmailClient.mjs';
import { selectOptimalModel } from '../config/intelligentTierSystem.mjs';
import { supabase } from '../config/supabaseClient.mjs';
import { logger } from '../lib/simpleLogger.mjs';
import { getUserTier } from '../services/tierService.mjs';

/**
 * Email Agent Service
 * Handles fetching, classifying, and generating draft replies for emails via Gmail API
 * 
 * NOTE: Gmail OAuth must be configured:
 * 1. Place credentials.json in backend/config/ (from Google Cloud Console)
 * 2. Run: node backend/scripts/generate-gmail-token.mjs
 * 3. This will generate token.json in backend/config/
 * 
 * The Email Agent accesses the authenticated user's Gmail inbox directly.
 */
class EmailAgentService {
  constructor() {
    // Feature flag - disabled by default for production safety
    this.enabled = process.env.EMAIL_AGENT_ENABLED === 'true';
    
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
    this.anthropic = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;
    
    // Mailbox mapping (for reference - OAuth uses authenticated user's inbox)
    this.mailboxMap = {
      'info': 'info@otiumcreations.com',
      'jason': 'jason@otiumcreations.com',
      'rima': 'rima@otiumcreations.com',
      'admin': 'admin@otiumcreations.com'
    };

    // Check Gmail OAuth configuration (async check will happen on first use)
    this.gmailConfigured = null; // Will be checked lazily

    if (!this.enabled) {
      logger.info('[EmailAgentService] Email Agent is disabled (EMAIL_AGENT_ENABLED=false). Set to true to enable.');
    }

    if (!this.anthropic) {
      logger.warn('[EmailAgentService] ⚠️ Anthropic API key not found - classification will not work');
    }

    logger.debug('[EmailAgentService] Service initialized', {
      enabled: this.enabled,
      hasAnthropic: !!this.anthropic
    });
  }

  /**
   * Check if Gmail OAuth is configured
   * @private
   * @returns {Promise<boolean>}
   */
  async checkGmailConfigured() {
    if (this.gmailConfigured === null) {
      this.gmailConfigured = await isGmailConfigured();
      if (!this.gmailConfigured) {
        logger.warn('[EmailAgentService] ⚠️ Gmail OAuth not configured - email fetching will not work');
        logger.warn('[EmailAgentService] Setup: Place credentials.json in backend/config/ and run generate-gmail-token.mjs');
      }
    }
    return this.gmailConfigured;
  }


  /**
   * Fetch new emails from a mailbox via Gmail API
   * Uses Service Account (Domain-wide Delegation) or OAuth 2.0 to access Gmail inbox
   * @param {string} mailbox - 'info' | 'jason' | 'rima' | 'admin' (for reference/logging)
   * @param {Date} since - Fetch emails since this date (optional)
   * @returns {Promise<{ok: boolean, emails?: Array, error?: string}>}
   */
  async fetchNewEmails(mailbox, since = null) {
    // Feature flag check - return empty if disabled
    if (!this.enabled) {
      logger.debug('[EmailAgentService] Email Agent disabled - returning empty result');
      return {
        ok: true,
        emails: []
      };
    }

    // Check Gmail configuration (Service Account or OAuth 2.0)
    const isConfigured = await this.checkGmailConfigured();
    if (!isConfigured) {
      return {
        ok: false,
        error: 'Gmail not configured. ' +
          'Service Account: Place atlas-email-agent.json in backend/keys/ or set GMAIL_CLIENT_EMAIL + GMAIL_PRIVATE_KEY env vars. ' +
          'OAuth 2.0: Place credentials.json in backend/config/ and run generate-gmail-token.mjs'
      };
    }

    // Validate mailbox and get email address
    const mailboxEmail = this.mailboxMap[mailbox];
    if (!mailboxEmail) {
      return {
        ok: false,
        error: `Invalid mailbox: ${mailbox}. Must be 'info', 'jason', 'rima', or 'admin'`
      };
    }

    try {
      // Get authenticated Gmail client (Service Account with domain-wide delegation or OAuth 2.0)
      // Pass mailboxEmail to impersonate that user (for service account)
      const gmail = await getGmailClient(mailboxEmail);

      // Build query for unread emails since specified date
      const queryParts = ['is:unread'];
      if (since) {
        const sinceTimestamp = Math.floor(since.getTime() / 1000);
        queryParts.push(`after:${sinceTimestamp}`);
      }
      const query = queryParts.join(' ');

      logger.debug('[EmailAgentService] Fetching emails from Gmail API', {
        mailbox,
        mailboxEmail,
        query,
        since: since?.toISOString()
      });

      // ✅ SAFETY: Add timeout wrapper for Gmail API calls
      const GMAIL_API_TIMEOUT_MS = 30000; // 30 seconds
      const fetchWithTimeout = async (promise, timeoutMs) => {
        return Promise.race([
          promise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Gmail API timeout - request took longer than 30 seconds')), timeoutMs)
          )
        ]);
      };

      // List messages (with timeout)
      const listResponse = await fetchWithTimeout(
        gmail.users.messages.list({
          userId: 'me',
          q: query,
          maxResults: 50 // Limit to 50 emails per fetch
        }),
        GMAIL_API_TIMEOUT_MS
      );

      const messages = listResponse.data.messages || [];
      
      if (messages.length === 0) {
        logger.debug('[EmailAgentService] No new emails found', { mailbox });
        return {
          ok: true,
          emails: []
        };
      }

      logger.info('[EmailAgentService] Found emails to process', {
        mailbox,
        count: messages.length
      });

      // ✅ SAFETY: Fetch full message details with timeout
      // Note: GMAIL_API_TIMEOUT_MS and fetchWithTimeout already declared above (reused)

      const emailPromises = messages.slice(0, 50).map(async (msg) => {
        try {
          const messageResponse = await fetchWithTimeout(
            gmail.users.messages.get({
              userId: 'me',
              id: msg.id,
              format: 'full'
            }),
            GMAIL_API_TIMEOUT_MS
          );

          return this.parseGmailMessage(messageResponse.data);
        } catch (error) {
          // ✅ SAFETY: Handle timeout errors specifically
          if (error.message?.includes('timeout')) {
            logger.warn('[EmailAgentService] Gmail API timeout fetching message:', {
              messageId: msg.id,
              error: error.message
            });
          } else {
            logger.error('[EmailAgentService] Error fetching message details:', {
              messageId: msg.id,
              error: error.message
            });
          }
          return null;
        }
      });

      const emails = (await Promise.all(emailPromises)).filter(email => email !== null);

      logger.info('[EmailAgentService] Successfully fetched and parsed emails', {
        mailbox,
        fetched: emails.length,
        total: messages.length
      });

      return {
        ok: true,
        emails
      };

    } catch (error) {
      // Handle rate limiting
      if (error.code === 429 || error.message?.includes('rate limit')) {
        logger.warn('[EmailAgentService] Gmail API rate limit hit - will retry later', {
          mailbox,
          error: error.message
        });
        return {
          ok: false,
          error: 'Gmail API rate limit exceeded. Please try again later.',
          retryAfter: 60 // Suggest retry after 60 seconds
        };
      }

      logger.error('[EmailAgentService] Error fetching emails:', {
        mailbox,
        error: error.message,
        code: error.code
      });

      return {
        ok: false,
        error: error.message || 'Failed to fetch emails'
      };
    }
  }

  /**
   * Parse Gmail API message response into structured email object
   * @private
   * @param {object} gmailMessage - Gmail API message object
   * @returns {object} Parsed email object
   */
  parseGmailMessage(gmailMessage) {
    const headers = gmailMessage.payload?.headers || [];
    const getHeader = (name) => {
      const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
      return header?.value || '';
    };

    // Extract email parts
    let bodyText = '';
    let bodyHtml = '';
    
    const extractBody = (part) => {
      if (part.body?.data) {
        const decoded = Buffer.from(part.body.data, 'base64').toString('utf-8');
        if (part.mimeType === 'text/plain') {
          bodyText = decoded;
        } else if (part.mimeType === 'text/html') {
          bodyHtml = decoded;
        }
      }
      
      if (part.parts) {
        part.parts.forEach(extractBody);
      }
    };

    if (gmailMessage.payload) {
      extractBody(gmailMessage.payload);
    }

    // Parse From header (format: "Name <email@domain.com>" or "email@domain.com")
    const fromHeader = getHeader('From');
    const fromMatch = fromHeader.match(/^(.+?)\s*<(.+?)>$/) || [null, null, fromHeader];
    const fromName = fromMatch[1]?.trim() || '';
    const fromEmail = fromMatch[2]?.trim() || fromHeader.trim();

    return {
      id: gmailMessage.id,
      threadId: gmailMessage.threadId,
      messageId: gmailMessage.id,
      from: fromHeader,
      from_name: fromName,
      from_email: fromEmail,
      to: getHeader('To'),
      subject: getHeader('Subject'),
      date: getHeader('Date'),
      body_text: bodyText,
      body_html: bodyHtml,
      snippet: gmailMessage.snippet || '',
      labels: gmailMessage.labelIds || []
    };
  }

  /**
   * Classify an email using Anthropic
   * @param {object} email - Email object with subject, body, from, etc.
   * @returns {Promise<{ok: boolean, classification?: string, tags?: Array, error?: string}>}
   */
  async classifyEmail(email, userId = null) {
    if (!this.anthropic) {
      return {
        ok: false,
        error: 'Anthropic API not configured'
      };
    }

    try {
      const classificationPrompt = `Classify the following email into one of these categories:
- support: General support request or question
- billing: Payment, subscription, refund, or billing issue
- bug_report: Technical bug or error report
- partnership: Business partnership or collaboration inquiry
- spam: Spam or irrelevant email
- other: Doesn't fit other categories

Email:
From: ${email.from_email || email.from || 'Unknown'}
Subject: ${email.subject || 'No subject'}
Body: ${(email.body_text || email.body || '').substring(0, 1000)}

Respond with ONLY the category name (e.g., "support", "billing", etc.).`;

      // Classification is a simple task - use Haiku for cost efficiency
      // But still check tier for consistency (though it will likely route to Haiku anyway)
      const userTier = userId ? await getUserTier(userId) : 'free';
      const model = selectOptimalModel(userTier, classificationPrompt, 'classification');
      
      logger.debug('[EmailAgentService] Classification model selection', {
        userId: userId || 'unknown',
        tier: userTier,
        model,
        task: 'classification'
      });

      const response = await this.anthropic.messages.create({
        model: model,
        max_tokens: 50,
        messages: [
          {
            role: 'user',
            content: classificationPrompt
          }
        ]
      });

      // ✅ SAFETY: Track cost for classification
      const inputTokens = response.usage?.input_tokens || 0;
      const outputTokens = response.usage?.output_tokens || 0;
      await this.trackCost('email_classification', model, inputTokens, outputTokens, userId).catch(err => {
        logger.debug('[EmailAgentService] Cost tracking failed (non-critical):', err.message);
      });

      const classification = (response.content[0]?.text || 'other').toLowerCase().trim();
      
      // Validate classification
      const validClassifications = ['support', 'billing', 'bug_report', 'partnership', 'spam', 'other'];
      const finalClassification = validClassifications.includes(classification) ? classification : 'other';

      // Extract tags based on classification
      const tags = [];
      if (finalClassification === 'billing') tags.push('payment', 'subscription');
      if (finalClassification === 'bug_report') tags.push('technical', 'error');
      if (finalClassification === 'support') tags.push('help', 'question');

      return {
        ok: true,
        classification: finalClassification,
        tags
      };

    } catch (error) {
      logger.error('[EmailAgentService] Error classifying email:', error);
      return {
        ok: false,
        error: error.message || 'Failed to classify email',
        classification: 'other',
        tags: []
      };
    }
  }

  /**
   * Extract structured data from an email (user_id, tier, error codes, device info)
   * @param {object} email - Email object
   * @returns {Promise<{ok: boolean, userId?: string, tier?: string, extractedData?: object, error?: string}>}
   */
  async extractStructuredData(email) {
    try {
      const extractedData = {};
      const fromEmail = email.from_email || email.from;

      // Match user by email
      const userMatch = await this.matchUserByEmail(fromEmail);
      const userId = userMatch.userId || null;
      const tier = userMatch.tier || null;

      // Extract error codes (common patterns)
      const bodyText = (email.body_text || email.body || '').toLowerCase();
      const errorCodePatterns = [
        /error\s*(?:code|id)?[:\s]+([a-z0-9-]+)/i,
        /error\s*#?(\d+)/i,
        /\[error[:\s]+([^\]]+)\]/i
      ];

      for (const pattern of errorCodePatterns) {
        const match = bodyText.match(pattern);
        if (match) {
          extractedData.errorCode = match[1];
          break;
        }
      }

      // Extract device info
      const devicePatterns = [
        /(?:device|platform|os)[:\s]+([^\n]+)/i,
        /(?:ios|android|windows|macos|linux)/i
      ];

      for (const pattern of devicePatterns) {
        const match = bodyText.match(pattern);
        if (match) {
          extractedData.deviceInfo = match[0];
          break;
        }
      }

      return {
        ok: true,
        userId,
        tier,
        extractedData
      };

    } catch (error) {
      logger.error('[EmailAgentService] Error extracting structured data:', error);
      return {
        ok: false,
        error: error.message || 'Failed to extract data',
        userId: null,
        tier: null,
        extractedData: {}
      };
    }
  }

  /**
   * Generate a draft reply for an email using Anthropic
   * Uses tier-based model selection: Haiku for simple, Sonnet for complex (Core/Studio)
   * @param {object} email - Email object
   * @param {string} classification - Email classification
   * @param {string|null} userId - Optional user ID for tier-based model selection
   * @returns {Promise<{ok: boolean, draftText?: string, draftHtml?: string, error?: string}>}
   */
  async generateDraftReply(email, classification, userId = null) {
    if (!this.anthropic) {
      return {
        ok: false,
        error: 'Anthropic API not configured'
      };
    }

    try {
      const draftPrompt = `You are writing a professional email reply for Atlas support.

Email to reply to:
From: ${email.from_email || email.from || 'Unknown'}
Subject: ${email.subject || 'No subject'}
Body: ${(email.body_text || email.body || '').substring(0, 2000)}

Classification: ${classification}

Write a helpful, professional reply. Keep it concise (2-3 paragraphs max). Be friendly but not overly casual.
For billing issues, be empathetic and offer to help resolve the issue.
For bug reports, acknowledge the issue and ask for more details if needed.
For support questions, provide clear, helpful answers.

Do NOT include email headers (To:, Subject:, etc.) - just the body text.`;

      // Draft generation is a complex task - use Sonnet for Core/Studio users
      const userTier = userId ? await getUserTier(userId) : 'free';
      const isComplexDraft = classification === 'billing' || classification === 'bug_report' || (email.body_text || email.body || '').length > 500;
      const requestType = isComplexDraft ? 'draft_generation' : 'simple_draft';
      const model = selectOptimalModel(userTier, draftPrompt, requestType);
      
      logger.debug('[EmailAgentService] Draft generation model selection', {
        userId: userId || 'unknown',
        tier: userTier,
        model,
        classification,
        task: 'draft_generation',
        isComplex: isComplexDraft
      });

      const response = await this.anthropic.messages.create({
        model: model,
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: draftPrompt
          }
        ]
      });

      // ✅ SAFETY: Track cost for draft generation
      const inputTokens = response.usage?.input_tokens || 0;
      const outputTokens = response.usage?.output_tokens || 0;
      await this.trackCost('email_draft_generation', model, inputTokens, outputTokens, userId).catch(err => {
        logger.debug('[EmailAgentService] Cost tracking failed (non-critical):', err.message);
      });

      const draftText = response.content[0]?.text || '';

      return {
        ok: true,
        draftText: draftText.trim(),
        draftHtml: draftText.trim().replace(/\n/g, '<br>') // Simple HTML conversion
      };

    } catch (error) {
      logger.error('[EmailAgentService] Error generating draft reply:', error);
      return {
        ok: false,
        error: error.message || 'Failed to generate draft reply'
      };
    }
  }

  /**
   * Check if an email indicates a critical issue that needs escalation
   * @param {object} email - Email object
   * @param {string} classification - Classification result
   * @returns {Promise<{isCritical: boolean, severity?: string}>}
   */
  async isCriticalIssue(email, classification) {
    const subject = (email.subject || '').toLowerCase();
    const body = (email.body_text || email.body || '').toLowerCase();

    // Critical keywords
    const criticalKeywords = [
      'urgent', 'critical', 'emergency', 'hacked', 'security breach',
      'refund immediately', 'chargeback', 'fraud', 'unauthorized',
      'account locked', 'cannot access', 'delete account'
    ];

    // High priority keywords
    const highPriorityKeywords = [
      'not working', 'broken', 'error', 'bug', 'crash', 'frozen',
      'billing issue', 'payment failed', 'charged incorrectly'
    ];

    const combinedText = `${subject} ${body}`;

    // Check for critical issues
    for (const keyword of criticalKeywords) {
      if (combinedText.includes(keyword)) {
        return {
          isCritical: true,
          severity: 'critical'
        };
      }
    }

    // Check for high priority issues
    if (classification === 'billing' || classification === 'bug_report') {
      for (const keyword of highPriorityKeywords) {
        if (combinedText.includes(keyword)) {
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

  /**
   * Match an email sender to a user profile by email
   * @param {string} fromEmail - Sender's email address
   * @returns {Promise<{ok: boolean, userId?: string, tier?: string, error?: string}>}
   */
  async matchUserByEmail(fromEmail) {
    if (!fromEmail) {
      return {
        ok: true,
        userId: null,
        tier: null
      };
    }

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, subscription_tier, email')
        .eq('email', fromEmail.toLowerCase())
        .maybeSingle();

      if (error) {
        logger.error('[EmailAgentService] Error matching user:', error);
        return {
          ok: false,
          error: error.message,
          userId: null,
          tier: null
        };
      }

      if (profile) {
        return {
          ok: true,
          userId: profile.id,
          tier: profile.subscription_tier || 'free'
        };
      }

      return {
        ok: true,
        userId: null,
        tier: null
      };

    } catch (error) {
      logger.error('[EmailAgentService] Error matching user:', error);
      return {
        ok: false,
        error: error.message || 'Failed to match user',
        userId: null,
        tier: null
      };
    }
  }

  /**
   * Track Anthropic API costs for email agent operations
   * @private
   * @param {string} operation - 'email_classification' | 'email_draft_generation'
   * @param {string} model - Model name (e.g., 'claude-3-haiku-20240307')
   * @param {number} inputTokens - Input tokens used
   * @param {number} outputTokens - Output tokens used
   * @param {string|null} userId - User ID (if matched from email)
   */
  async trackCost(operation, model, inputTokens, outputTokens, userId = null) {
    try {
      // Anthropic pricing (per 1M tokens)
      const PRICING = {
        'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
        'claude-3-5-haiku-20241022': { input: 0.25, output: 1.25 },
        'claude-3-sonnet-20240229': { input: 3.0, output: 15.0 },
        'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
        'claude-3-opus-20240229': { input: 15.0, output: 75.0 },
        'claude-3-5-opus-20241022': { input: 15.0, output: 75.0 },
      };

      const modelPricing = PRICING[model] || PRICING['claude-3-haiku-20240307'];
      const cost = (inputTokens / 1_000_000 * modelPricing.input) + (outputTokens / 1_000_000 * modelPricing.output);

      // Log to usage_logs table (non-blocking)
      if (cost > 0) {
        await supabase.from('usage_logs').insert({
          user_id: userId || 'system', // Use 'system' if no user matched
          event: 'email_agent_operation',
          feature: operation,
          tier: null, // Email agent is admin-only, tier not applicable
          tokens_used: inputTokens + outputTokens,
          estimated_cost: cost,
          metadata: {
            operation,
            model,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            source: 'email_agent'
          },
          created_at: new Date().toISOString()
        }).catch(err => {
          logger.debug('[EmailAgentService] Failed to log cost (non-critical):', err.message);
        });

        logger.debug('[EmailAgentService] Cost tracked', {
          operation,
          model,
          inputTokens,
          outputTokens,
          cost: cost.toFixed(6),
          userId: userId || 'system'
        });
      }
    } catch (error) {
      // Non-blocking - don't fail the operation if cost tracking fails
      logger.debug('[EmailAgentService] Cost tracking error (non-critical):', error.message);
    }
  }
}

// Export singleton instance
export const emailAgentService = new EmailAgentService();

// Export class for testing
export { EmailAgentService };

