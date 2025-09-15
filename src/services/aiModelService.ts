import { AI_MODELS, COST_PROTECTION } from '../types/subscription';

export class AIModelService {
  /**
   * Get the appropriate AI model for a user's tier
   */
  static getModelForTier(tier: 'free' | 'core' | 'studio'): string {
    return AI_MODELS[tier];
  }

  /**
   * Get max tokens for a response based on tier
   */
  static getMaxTokens(tier: 'free' | 'core' | 'studio'): number {
    return COST_PROTECTION.max_tokens_per_response[tier];
  }

  /**
   * Get daily spending cap for a tier
   */
  static getDailySpendingCap(tier: 'free' | 'core' | 'studio'): number {
    return COST_PROTECTION.daily_spending_cap[tier];
  }

  /**
   * Check if user can afford a request based on current spending
   */
  static canAffordRequest(
    tier: 'free' | 'core' | 'studio', 
    currentDailySpend: number
  ): boolean {
    const cap = this.getDailySpendingCap(tier);
    return currentDailySpend < cap;
  }

  /**
   * Estimate cost of a request
   */
  static estimateRequestCost(
    tier: 'free' | 'core' | 'studio',
    inputTokens: number,
    outputTokens: number
  ): number {
    // Rough cost estimates per 1K tokens
    const costs = {
      free: { input: 0.00025, output: 0.00125 },    // Haiku
      core: { input: 0.003, output: 0.015 },        // Sonnet
      studio: { input: 0.015, output: 0.075 }       // Opus
    };

    const tierCosts = costs[tier];
    const inputCost = (inputTokens / 1000) * tierCosts.input;
    const outputCost = (outputTokens / 1000) * tierCosts.output;
    
    return inputCost + outputCost;
  }

  /**
   * Get model display name for UI
   */
  static getModelDisplayName(tier: 'free' | 'core' | 'studio'): string {
    const names = {
      free: 'Claude Haiku',
      core: 'Claude Sonnet',
      studio: 'Claude Opus'
    };
    return names[tier];
  }

  /**
   * Get model description for UI
   */
  static getModelDescription(tier: 'free' | 'core' | 'studio'): string {
    const descriptions = {
      free: 'Fast, cost-effective responses for basic conversations',
      core: 'Balanced performance with better reasoning and coaching',
      studio: 'Most advanced emotional intelligence and nuanced responses'
    };
    return descriptions[tier];
  }
}
