// backend/services/emailAgentService.mjs
// Email Agent Service - Gmail API integration, classification, draft generation
// Milestone 3: Full implementation

import Anthropic from '@anthropic-ai/sdk';
import { google } from 'googleapis';
import { logger } from '../lib/simpleLogger.mjs';
import { supabase } from '../config/supabaseClient.mjs';

/**
 * Email Agent Service
 * Handles fetching, classifying, and generating draft replies for emails via Gmail API
 * 
 * NOTE: Gmail API credentials must be configured via environment variables:
 * - GMAIL_CLIENT_EMAIL: Service account email
 * - GMAIL_PRIVATE_KEY: Service account private key (base64 or raw)
 * - GMAIL_DELEGATED_USER: Email to impersonate (info@otiumcreations.com, etc.)
 */
class EmailAgentService {
  constructor() {
    // Feature flag - disabled by default for production safety
    this.enabled = process.env.EMAIL_AGENT_ENABLED === 'true';
    
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
    this.anthropic = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;
    
    // Gmail API configuration
    this.gmailClientEmail = process.env.GMAIL_CLIENT_EMAIL;
    // Convert \n escape sequences to actual newlines for private key
    this.gmailPrivateKey = process.env.GMAIL_PRIVATE_KEY?.replace(/\\n/g, '\n');
    this.gmailDelegatedUser = process.env.GMAIL_DELEGATED_USER;
    
    // Mailbox mapping
    this.mailboxMap = {
      'info': 'info@otiumcreations.com',
      'jason': 'jason@otiumcreations.com',
      'rima': 'rima@otiumcreations.com'
    };

    // Token cache for Gmail API (tokens valid for 1 hour)
    this.accessTokenCache = {
      token: null,
      expiresAt: null
    };

    if (!this.enabled) {
      logger.info('[EmailAgentService] Email Agent is disabled (EMAIL_AGENT_ENABLED=false). Set to true to enable.');
    }

    if (!this.anthropic) {
      logger.warn('[EmailAgentService] ⚠️ Anthropic API key not found - classification will not work');
    }

    if (!this.gmailClientEmail || !this.gmailPrivateKey) {
      logger.warn('[EmailAgentService] ⚠️ Gmail API credentials not configured - email fetching will not work');
    }

    logger.debug('[EmailAgentService] Service initialized', {
      enabled: this.enabled,
      hasGmailCreds: !!(this.gmailClientEmail && this.gmailPrivateKey),
      hasAnthropic: !!this.anthropic
    });
  }

  /**
   * Get Gmail API access token using service account with domain-wide delegation
   * @private
   * @param {string} delegatedUser - Email address to impersonate
   * @returns {Promise<string>} Access token
   */
  async getGmailAccessToken(delegatedUser) {
    if (!this.enabled) {
      throw new Error('Email Agent is disabled (EMAIL_AGENT_ENABLED=false)');
    }

    if (!this.gmailClientEmail || !this.gmailPrivateKey) {
      throw new Error('Gmail API credentials not configured');
    }

    if (!delegatedUser) {
      throw new Error('Delegated user email is required');
    }

    // Check if we have a valid cached token
    if (this.accessTokenCache.token && this.accessTokenCache.expiresAt) {
      const now = Date.now();
      // Refresh token 5 minutes before expiration
      if (now < this.accessTokenCache.expiresAt - 5 * 60 * 1000) {
        logger.debug('[EmailAgentService] Using cached access token');
        return this.accessTokenCache.token;
      }
    }

    try {
      // Create JWT for service account authentication
      const jwtClient = new google.auth.JWT(
        this.gmailClientEmail,
        null,
        this.gmailPrivateKey,
        ['https://www.googleapis.com/auth/gmail.readonly'],
        delegatedUser // Subject (user to impersonate)
      );

      // Request access token
      const tokens = await jwtClient.authorize();
      
      if (!tokens.access_token) {
        throw new Error('Failed to obtain access token from Google OAuth2');
      }

      // Cache the token (tokens typically valid for 1 hour)
      this.accessTokenCache.token = tokens.access_token;
      this.accessTokenCache.expiresAt = Date.now() + ((tokens.expiry_date || 3600000) - Date.now());

      logger.debug('[EmailAgentService] Successfully obtained Gmail API access token', {
        delegatedUser,
        expiresIn: Math.round((this.accessTokenCache.expiresAt - Date.now()) / 1000) + 's'
      });

      return tokens.access_token;

    } catch (error) {
      logger.error('[EmailAgentService] Error obtaining Gmail API access token:', {
        error: error.message,
        delegatedUser,
        hasCredentials: !!(this.gmailClientEmail && this.gmailPrivateKey)
      });
      throw new Error(`Gmail API authentication failed: ${error.message}`);
    }
  }

  /**
   * Fetch new emails from a mailbox via Gmail API
   * @param {string} mailbox - 'info' | 'jason' | 'rima'
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

    if (!this.gmailClientEmail || !this.gmailPrivateKey) {
      return {
        ok: false,
        error: 'Gmail API credentials not configured'
      };
    }

    const delegatedUser = this.mailboxMap[mailbox];
    if (!delegatedUser) {
      return {
        ok: false,
        error: `Invalid mailbox: ${mailbox}. Must be 'info', 'jason', or 'rima'`
      };
    }

    try {
      // Get access token
      const accessToken = await this.getGmailAccessToken(delegatedUser);

      // Create OAuth2 client with access token
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: accessToken });

      // Create Gmail API client
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      // Build query for unread emails since specified date
      const queryParts = ['is:unread'];
      if (since) {
        const sinceTimestamp = Math.floor(since.getTime() / 1000);
        queryParts.push(`after:${sinceTimestamp}`);
      }
      const query = queryParts.join(' ');

      logger.debug('[EmailAgentService] Fetching emails from Gmail API', {
        mailbox,
        delegatedUser,
        query,
        since: since?.toISOString()
      });

      // List messages
      const listResponse = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 50 // Limit to 50 emails per fetch
      });

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

      // Fetch full message details
      const emailPromises = messages.slice(0, 50).map(async (msg) => {
        try {
          const messageResponse = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id,
            format: 'full'
          });

          return this.parseGmailMessage(messageResponse.data);
        } catch (error) {
          logger.error('[EmailAgentService] Error fetching message details:', {
            messageId: msg.id,
            error: error.message
          });
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
  async classifyEmail(email) {
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

      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 50,
        messages: [
          {
            role: 'user',
            content: classificationPrompt
          }
        ]
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
   * @param {object} email - Email object
   * @param {string} classification - Email classification
   * @returns {Promise<{ok: boolean, draftText?: string, draftHtml?: string, error?: string}>}
   */
  async generateDraftReply(email, classification) {
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

      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 500,
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
}

// Export singleton instance
export const emailAgentService = new EmailAgentService();

// Export class for testing
export { EmailAgentService };

