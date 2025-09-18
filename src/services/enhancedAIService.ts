// Enhanced AI Service with Revenue Protection
// Token limits, context windows, caching, and graceful degradation

import { tierFeatures } from '../config/featureAccess';
import type { Tier } from '../types/tier';
import { responseCacheService } from './responseCacheService';
import { usageTrackingService } from './usageTrackingService';

export interface AIRequest {
  userId: string;
  tier: Tier;
  message: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  conversationId?: string;
}

export interface AIResponse {
  success: boolean;
  response?: string;
  tokensUsed?: number;
  fromCache?: boolean;
  error?: string;
  reason?: 'token_limit' | 'context_limit' | 'conversation_too_long' | 'budget_exceeded' | 'api_error';
  upgradeRequired?: boolean;
  suggestedTier?: Tier;
}

class EnhancedAIService {
  private readonly PRE_WRITTEN_RESPONSES = {
    anxiety: "I understand you're feeling anxious. Here's a quick technique: Try the 4-7-8 breathing method - inhale for 4 counts, hold for 7, exhale for 8. This activates your body's relaxation response. Would you like to explore more anxiety management strategies?",
    
    stress: "Stress can feel overwhelming. A simple way to start: Take 5 deep breaths and name 3 things you're grateful for right now. This helps shift your nervous system from fight-or-flight to rest-and-digest. What's causing the most stress for you today?",
    
    depression: "I hear that you're struggling. Remember that seeking support shows strength, not weakness. Small steps matter - even getting sunlight for 10 minutes or calling a friend can help. Have you been able to maintain any daily routines?",
    
    overwhelm: "When everything feels like too much, try the 'One Thing Rule' - pick just one small task and complete it. This builds momentum and helps your brain feel more in control. What's one small thing you could accomplish right now?",
    
    default: "I'm here to support you with emotional intelligence and wellbeing. While I'm experiencing high demand right now, I want to acknowledge what you're going through. Sometimes just being heard makes a difference. What's the most important thing you'd like to address today?"
  };

  /**
   * Process AI request with all revenue protection measures
   */
  async processRequest(request: AIRequest): Promise<AIResponse> {
    try {
      // 1. Check if user can start conversation
      const usageCheck = await usageTrackingService.checkUsageBeforeConversation(request.userId, request.tier);
      
      if (!usageCheck.canProceed) {
        return {
          success: false,
          error: this.getUsageErrorMessage(usageCheck.reason),
          reason: usageCheck.reason,
          upgradeRequired: usageCheck.upgradeRequired,
          suggestedTier: usageCheck.suggestedTier
        };
      }

      // 2. Check conversation length limits
      const conversationTooLong = this.checkConversationLength(request);
      if (conversationTooLong) {
        return {
          success: false,
          error: "This conversation has reached its maximum length. Please start a fresh conversation to continue.",
          reason: 'conversation_too_long',
          upgradeRequired: request.tier !== 'premium'
        };
      }

      // 3. Try cache first (cost optimization)
      const cachedResponse = await responseCacheService.getCachedResponse(request.message, request.tier);
      if (cachedResponse) {
        // Still record as conversation for usage tracking
        await usageTrackingService.recordConversation(request.userId, request.tier, 50); // Estimated tokens for cached response
        
        return {
          success: true,
          response: cachedResponse,
          tokensUsed: 50,
          fromCache: true
        };
      }

      // 4. Prepare context with tier-based limits
      const context = this.prepareContext(request);
      
      // 5. Make AI API call with token limits
      const aiResponse = await this.callAIAPI(context, request.tier);
      
      if (!aiResponse.success) {
        // Graceful degradation - return pre-written response
        const fallbackResponse = this.getFallbackResponse(request.message);
        return {
          success: true,
          response: fallbackResponse,
          tokensUsed: 30, // Estimated for pre-written response
          fromCache: false
        };
      }

      // 6. Record usage
      await usageTrackingService.recordConversation(request.userId, request.tier, aiResponse.tokensUsed!);

      // 7. Cache response if appropriate
      if (aiResponse.response) {
        await responseCacheService.cacheResponse(request.message, aiResponse.response, request.tier);
      }

      return aiResponse;

    } catch (error) {
      console.error('AI service error:', error);
      
      // Graceful degradation
      const fallbackResponse = this.getFallbackResponse(request.message);
      return {
        success: true,
        response: fallbackResponse,
        tokensUsed: 30,
        fromCache: false
      };
    }
  }

  /**
   * Check if conversation exceeds length limits
   */
  private checkConversationLength(request: AIRequest): boolean {
    const features = tierFeatures[request.tier];
    const maxLength = features.maxConversationLength;
    
    if (maxLength === -1) return false; // Unlimited
    
    const currentLength = (request.conversationHistory?.length || 0) + 1; // +1 for current message
    return currentLength > maxLength;
  }

  /**
   * Prepare context with tier-based context window limits
   */
  private prepareContext(request: AIRequest): string {
    const features = tierFeatures[request.tier];
    const maxContextTokens = features.maxContextWindow;
    
    let context = `You are Atlas, an emotionally intelligent AI assistant. Provide supportive, empathetic responses focused on emotional wellbeing and mental health.\n\nUser: ${request.message}`;
    
    // Add conversation history within context limits
    if (request.conversationHistory && request.conversationHistory.length > 0) {
      let historyContext = "\n\nConversation History:\n";
      let currentTokens = this.estimateTokens(context);
      
      // Add history from most recent, staying within token limits
      for (let i = request.conversationHistory.length - 1; i >= 0; i--) {
        const historyItem = request.conversationHistory[i];
        const historyText = `${historyItem.role}: ${historyItem.content}\n`;
        const historyTokens = this.estimateTokens(historyText);
        
        if (currentTokens + historyTokens > maxContextTokens * 0.8) { // Leave room for response
          break;
        }
        
        historyContext = historyText + historyContext;
        currentTokens += historyTokens;
      }
      
      context += historyContext;
    }
    
    return context;
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough approximation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Call AI API with token limits
   */
  private async callAIAPI(context: string, tier: Tier): Promise<AIResponse> {
    const features = tierFeatures[tier];
    const maxTokens = features.maxTokensPerResponse;
    const model = features.model;

    try {
      // This would be replaced with actual AI API call (Claude, OpenAI, etc.)
      const response = await this.mockAICall(context, model, maxTokens);
      
      return {
        success: true,
        response: response.text,
        tokensUsed: response.tokensUsed
      };
      
    } catch (error) {
      console.error('AI API call failed:', error);
      return {
        success: false,
        error: 'AI service temporarily unavailable',
        reason: 'api_error'
      };
    }
  }

  /**
   * Mock AI call (replace with actual API integration)
   */
  private async mockAICall(context: string, model: string, maxTokens: number): Promise<{ text: string; tokensUsed: number }> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock response based on tier
    const responses = {
      'claude-3-haiku': "I understand you're reaching out for support. That takes courage. Based on what you've shared, here are some gentle strategies that might help...",
      'claude-3-sonnet': "Thank you for trusting me with what you're experiencing. I can sense the complexity of your situation. Let me offer some thoughtful approaches that consider both your immediate needs and long-term wellbeing...",
      'claude-3-opus': "I deeply appreciate you sharing your experience with me. Your feelings are completely valid, and I want to honor the full complexity of what you're going through. Let me provide some comprehensive strategies that address both the emotional and practical aspects of your situation..."
    };
    
    const baseResponse = responses[model as keyof typeof responses] || responses['claude-3-haiku'];
    
    // Truncate to max tokens
    const estimatedTokens = this.estimateTokens(baseResponse);
    const finalResponse = estimatedTokens > maxTokens 
      ? baseResponse.substring(0, maxTokens * 4) + "..." 
      : baseResponse;
    
    return {
      text: finalResponse,
      tokensUsed: Math.min(estimatedTokens, maxTokens)
    };
  }

  /**
   * Get fallback response for graceful degradation
   */
  private getFallbackResponse(message: string): string {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('anxious') || lowerMessage.includes('anxiety')) {
      return this.PRE_WRITTEN_RESPONSES.anxiety;
    }
    
    if (lowerMessage.includes('stress') || lowerMessage.includes('stressed')) {
      return this.PRE_WRITTEN_RESPONSES.stress;
    }
    
    if (lowerMessage.includes('depressed') || lowerMessage.includes('depression') || lowerMessage.includes('sad')) {
      return this.PRE_WRITTEN_RESPONSES.depression;
    }
    
    if (lowerMessage.includes('overwhelmed') || lowerMessage.includes('overwhelm')) {
      return this.PRE_WRITTEN_RESPONSES.overwhelm;
    }
    
    return this.PRE_WRITTEN_RESPONSES.default;
  }

  /**
   * Get user-friendly error messages
   */
  private getUsageErrorMessage(reason?: string): string {
    switch (reason) {
      case 'daily_limit':
        return "You've reached your daily conversation limit. Upgrade to continue chatting with Atlas!";
      case 'budget_exceeded':
        return "Atlas is temporarily in maintenance mode due to high demand. Please try again later.";
      case 'maintenance':
        return "Atlas is currently undergoing maintenance. We'll be back shortly!";
      default:
        return "Unable to process your request right now. Please try again later.";
    }
  }

  /**
   * Get service health status
   */
  async getServiceHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'maintenance';
    cacheHitRate: number;
    dailyBudgetUsed: number;
    activeUsers: number;
  }> {
    try {
      const [cacheStats, budgetHealth] = await Promise.all([
        responseCacheService.getCacheStats(),
        usageTrackingService.checkBudgetHealth()
      ]);

      let status: 'healthy' | 'degraded' | 'maintenance' = 'healthy';
      if (budgetHealth.status === 'critical') status = 'maintenance';
      else if (budgetHealth.status === 'warning') status = 'degraded';

      return {
        status,
        cacheHitRate: cacheStats.hitRate,
        dailyBudgetUsed: (budgetHealth.totalCost / budgetHealth.budget) * 100,
        activeUsers: 0 // Would be calculated from daily_usage table
      };

    } catch (error) {
      console.error('Health check failed:', error);
      return {
        status: 'degraded',
        cacheHitRate: 0,
        dailyBudgetUsed: 0,
        activeUsers: 0
      };
    }
  }
}

export const enhancedAIService = new EnhancedAIService();
