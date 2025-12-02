// backend/services/webAgentService.mjs
// Web Agent Service - FAQ, Onboarding, Tech Support Chatbot
// Milestone 2: Full implementation with Anthropic integration
// Uses tier-based hybrid model selection (Haiku for simple, Sonnet for complex)

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../lib/simpleLogger.mjs';
import { supabase } from '../config/supabaseClient.mjs';
import { selectOptimalModel } from '../config/intelligentTierSystem.mjs';
import { getUserTier } from '../services/tierService.mjs';
import { escalationAgentService } from './escalationAgentService.mjs';

/**
 * Web Agent Service
 * Handles FAQ, onboarding, and tech support conversations
 * Uses Anthropic Claude for responses, logs to web_agent_conversations table
 */
class WebAgentService {
  constructor() {
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
    this.anthropic = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;
    
    if (!this.anthropic) {
      logger.warn('[WebAgentService] ⚠️ Anthropic API key not found - Web Agent will not function');
    }
    
    // Web Agent system prompt - focused on FAQ, onboarding, tech support
    this.systemPrompt = `You are Atlas Support, a helpful FAQ and onboarding assistant for Atlas (an emotionally intelligent AI assistant).

Your role:
- Answer questions about Atlas features, pricing, tiers, and usage
- Guide new users through onboarding and first steps
- Provide technical support for common issues (password reset, account access, etc.)
- Help users understand billing and subscription management
- Escalate complex or sensitive issues when you're uncertain

IMPORTANT GUIDELINES:
1. Be friendly, clear, and concise
2. If you're unsure about something or detect frustration/billing panic/technical failures, escalate the conversation
3. Do NOT provide medical, legal, or financial advice
4. For billing issues, always escalate to human support
5. For account lockouts or security concerns, escalate immediately
6. Keep responses focused on Atlas-related topics

When to escalate:
- User expresses frustration or anger
- Billing or payment issues
- Account access problems
- Technical failures or bugs
- Questions you cannot confidently answer
- Requests for features not yet available

Tone: Professional but warm, helpful, patient.`;

    logger.debug('[WebAgentService] Service initialized');
  }

  /**
   * Process a user message through the Web Agent
   * @param {string} userMessage - User's question/message
   * @param {string|null} userId - Optional user ID (for logged-in users)
   * @param {string} source - 'rima_site' or 'atlas_app'
   * @returns {Promise<{ok: boolean, response?: string, escalated?: boolean, conversationId?: string, error?: string}>}
   */
  async processWebAgentMessage(userMessage, userId = null, source = 'atlas_app') {
    if (!this.anthropic) {
      return {
        ok: false,
        error: 'Web Agent service not configured - missing Anthropic API key'
      };
    }

    if (!userMessage || typeof userMessage !== 'string' || userMessage.trim().length === 0) {
      return {
        ok: false,
        error: 'Invalid user message'
      };
    }

    try {
      // Check if message should be escalated
      const escalationCheck = await this.shouldEscalate(userMessage);
      let escalated = false;
      let incidentId = null;

      if (escalationCheck.shouldEscalate) {
        logger.info('[WebAgentService] Escalating conversation due to:', escalationCheck.reason);
        escalated = true;
        
        // Log conversation first, then escalate
        const logResult = await this.logConversation(userId, source, userMessage, null, true);
        const conversationId = logResult.conversationId;

        if (conversationId) {
          // Create incident via Escalation Agent
          const escalationResult = await escalationAgentService.createIncident(
            'web',
            conversationId,
            {
              severity: escalationCheck.severity || 'medium',
              tags: ['web_agent', escalationCheck.reason || 'uncertain'],
              short_summary: `Web Agent escalation: ${escalationCheck.reason}`,
              long_summary: `User message: ${userMessage.substring(0, 500)}`,
              suggested_actions: ['Review conversation', 'Contact user if needed']
            }
          );
          incidentId = escalationResult.incidentId;

          // Update conversation with incident_id
          if (incidentId) {
            await supabase
              .from('web_agent_conversations')
              .update({ incident_id: incidentId })
              .eq('id', conversationId);
          }
        }

        return {
          ok: true,
          response: "I understand this is important. I've escalated your question to our support team, and someone will follow up with you soon. Is there anything else I can help you with in the meantime?",
          escalated: true,
          conversationId: logResult.conversationId,
          incidentId
        };
      }

      // Get user tier for model selection (default to 'free' if no userId)
      const userTier = userId ? await getUserTier(userId) : 'free';
      
      // Determine task complexity: FAQ responses are typically simple, but longer messages may need Sonnet
      const isComplexQuery = userMessage.length > 200 || userMessage.includes('?') && userMessage.split('?').length > 2;
      const requestType = isComplexQuery ? 'complex_reasoning' : 'simple_faq';
      
      // Select optimal model based on tier and complexity
      const model = selectOptimalModel(userTier, userMessage, requestType);
      
      logger.debug('[WebAgentService] Model selection', {
        userId: userId || 'anonymous',
        tier: userTier,
        model,
        requestType,
        messageLength: userMessage.length
      });

      // Generate response using Anthropic
      const response = await this.anthropic.messages.create({
        model: model,
        max_tokens: 1000,
        system: this.systemPrompt,
        messages: [
          {
            role: 'user',
            content: userMessage
          }
        ]
      });

      const agentResponse = response.content[0]?.text || 'I apologize, but I encountered an error processing your request. Please try again.';

      // Log conversation
      const logResult = await this.logConversation(userId, source, userMessage, agentResponse, false);

      return {
        ok: true,
        response: agentResponse,
        escalated: false,
        conversationId: logResult.conversationId
      };

    } catch (error) {
      logger.error('[WebAgentService] Error processing message:', error);
      return {
        ok: false,
        error: error.message || 'Failed to process message'
      };
    }
  }

  /**
   * Escalate a conversation to the Escalation/Insights Agent
   * @param {string} conversationId - Web agent conversation ID
   * @param {string} reason - Reason for escalation
   * @returns {Promise<{ok: boolean, incidentId?: string, error?: string}>}
   */
  async escalateToSupportAgent(conversationId, reason) {
    try {
      // Get conversation details
      const { data: conversation, error } = await supabase
        .from('web_agent_conversations')
        .select('*')
        .eq('id', conversationId)
        .single();

      if (error || !conversation) {
        return {
          ok: false,
          error: 'Conversation not found'
        };
      }

      // Create incident
      const result = await escalationAgentService.createIncident(
        'web',
        conversationId,
        {
          severity: 'medium',
          tags: ['web_agent', reason],
          short_summary: `Web Agent escalation: ${reason}`,
          long_summary: `User: ${conversation.user_message}\nAgent: ${conversation.agent_response || 'No response yet'}`,
          suggested_actions: ['Review conversation', 'Contact user if needed']
        }
      );

      if (result.ok && result.incidentId) {
        // Update conversation
        await supabase
          .from('web_agent_conversations')
          .update({ 
            escalated: true,
            escalation_reason: reason,
            incident_id: result.incidentId
          })
          .eq('id', conversationId);
      }

      return result;

    } catch (error) {
      logger.error('[WebAgentService] Error escalating:', error);
      return {
        ok: false,
        error: error.message || 'Failed to escalate'
      };
    }
  }

  /**
   * Log a Web Agent conversation to the database
   * @param {string|null} userId - User ID (nullable for anonymous users)
   * @param {string} source - 'rima_site' or 'atlas_app'
   * @param {string} userMessage - User's message
   * @param {string|null} agentResponse - Agent's response (nullable if escalated before response)
   * @param {boolean} escalated - Whether conversation was escalated
   * @returns {Promise<{ok: boolean, conversationId?: string, error?: string}>}
   */
  async logConversation(userId, source, userMessage, agentResponse, escalated = false) {
    try {
      const { data, error } = await supabase
        .from('web_agent_conversations')
        .insert([{
          user_id: userId || null,
          source: source,
          user_message: userMessage,
          agent_response: agentResponse || null,
          escalated: escalated,
          metadata: {}
        }])
        .select('id')
        .single();

      if (error) {
        logger.error('[WebAgentService] Error logging conversation:', error);
        return {
          ok: false,
          error: error.message || 'Failed to log conversation'
        };
      }

      return {
        ok: true,
        conversationId: data.id
      };

    } catch (error) {
      logger.error('[WebAgentService] Error logging conversation:', error);
      return {
        ok: false,
        error: error.message || 'Failed to log conversation'
      };
    }
  }

  /**
   * Check if a message should be escalated based on content
   * Uses simple keyword detection - can be enhanced with Anthropic in future
   * @param {string} message - User message to analyze
   * @returns {Promise<{shouldEscalate: boolean, reason?: string, severity?: string}>}
   */
  async shouldEscalate(message) {
    const lowerMessage = message.toLowerCase();

    // Critical keywords - immediate escalation
    const criticalKeywords = [
      'locked out', 'can\'t login', 'can\'t access', 'hacked', 'security breach',
      'refund', 'chargeback', 'fraud', 'unauthorized charge',
      'delete my account', 'cancel everything', 'never using this again'
    ];

    // High priority keywords
    const highPriorityKeywords = [
      'not working', 'broken', 'bug', 'error', 'crash', 'frozen',
      'billing issue', 'payment problem', 'charged incorrectly', 'subscription issue',
      'frustrated', 'angry', 'disappointed', 'terrible', 'awful'
    ];

    // Medium priority - uncertainty or complex questions
    const mediumPriorityKeywords = [
      'how do i', 'can you help me', 'i don\'t understand', 'confused',
      'not sure', 'need help', 'support'
    ];

    // Check for critical issues
    for (const keyword of criticalKeywords) {
      if (lowerMessage.includes(keyword)) {
        return {
          shouldEscalate: true,
          reason: 'critical_issue',
          severity: 'critical'
        };
      }
    }

    // Check for high priority issues
    for (const keyword of highPriorityKeywords) {
      if (lowerMessage.includes(keyword)) {
        return {
          shouldEscalate: true,
          reason: 'high_priority_issue',
          severity: 'high'
        };
      }
    }

    // Check for medium priority (uncertainty)
    // Only escalate if message is longer (complex question) or contains multiple medium keywords
    const mediumMatches = mediumPriorityKeywords.filter(kw => lowerMessage.includes(kw)).length;
    if (mediumMatches >= 2 || (message.length > 200 && mediumMatches >= 1)) {
      return {
        shouldEscalate: true,
        reason: 'complex_or_uncertain',
        severity: 'medium'
      };
    }

    return {
      shouldEscalate: false,
      reason: null,
      severity: null
    };
  }
}

// Export singleton instance
export const webAgentService = new WebAgentService();

// Export class for testing
export { WebAgentService };

