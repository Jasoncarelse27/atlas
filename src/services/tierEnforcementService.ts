// Atlas V1 Tier Enforcement Service
// Handles server-side tier enforcement API calls with middleware integration

interface TierInfo {
  tier: string;
  messages_used: number;
  messages_limit: number;
  can_use_audio: boolean;
  can_use_image: boolean;
  model: string;
}

// Custom error class for tier limit violations
export class TierLimitError extends Error {
  public readonly type: 'daily_limit' | 'budget_limit' | 'unknown';
  public readonly metadata?: any;

  constructor(type: 'daily_limit' | 'budget_limit' | 'unknown', message: string, metadata?: any) {
    super(message);
    this.name = 'TierLimitError';
    this.type = type;
    this.metadata = metadata;
  }
}

interface MessageResponse {
  success: boolean;
  response: {
    id: string;
    role: string;
    content: {
      text: string;
    };
    timestamp: string;
    model: string;
    tier: string;
  };
  tierInfo: TierInfo;
}

interface FeatureCheckResponse {
  success: boolean;
  feature: string;
  allowed: boolean;
}

class TierEnforcementService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  }

  /**
   * Get user tier information from server
   */
  async getUserTierInfo(userId: string): Promise<TierInfo> {
    try {
      const response = await fetch(`${this.baseUrl}/api/user/tier-info?userId=${userId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to get tier info: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error('Failed to get tier info from server');
      }

      return data.tierInfo;
    } catch (error) {
      // Fallback to default free tier info
      return {
        tier: 'free',
        messages_used: 0,
        messages_limit: 15,
        can_use_audio: false,
        can_use_image: false,
        model: 'claude-3-haiku-20240307'
      };
    }
  }

  /**
   * Send message with server-side tier enforcement and middleware
   */
  async sendMessage(userId: string, message: string, tier: string = 'free', conversationId?: string, promptType?: string): Promise<MessageResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          message,
          tier,
          conversationId,
          promptType
        })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          // Handle different types of 429 errors from middleware
          const errorType = data.error || 'UNKNOWN_LIMIT';
          
          if (errorType === 'DAILY_LIMIT_EXCEEDED') {
            throw new TierLimitError('daily_limit', data.message, {
              limit: data.limit,
              used: data.used,
              upgradeUrl: data.upgradeUrl
            });
          }
          
          if (errorType === 'BUDGET_LIMIT_EXCEEDED') {
            throw new TierLimitError('budget_limit', data.message, {
              budgetUsed: data.budgetUsed,
              budgetLimit: data.budgetLimit,
              upgradeUrl: data.upgradeUrl
            });
          }
          
          throw new TierLimitError('unknown', data.message || 'Rate limit exceeded');
        }
        throw new Error(data.error || 'Failed to send message');
      }

      if (!data.success) {
        throw new Error('Failed to send message to server');
      }

      // Transform middleware response to expected format
      const transformedResponse: MessageResponse = {
        success: true,
        response: {
          id: `msg_${Date.now()}`, // Generate ID since middleware doesn't return one
          role: 'assistant',
          content: {
            text: data.response
          },
          timestamp: data.metadata?.timestamp || new Date().toISOString(),
          model: data.metadata?.model || 'claude-3-haiku-20240307',
          tier: data.metadata?.tier || 'free'
        },
        tierInfo: {
          tier: data.metadata?.tier || 'free',
          messages_used: data.metadata?.dailyUsage?.count || 0,
          messages_limit: data.metadata?.dailyUsage?.limit || 15,
          can_use_audio: data.metadata?.tier !== 'free',
          can_use_image: data.metadata?.tier === 'studio',
          model: data.metadata?.model || 'claude-3-haiku-20240307'
        }
      };

      // Check for priority processing notification
      if (data.metadata?.budgetStatus?.used && data.metadata?.budgetStatus?.limit) {
        const usagePercent = (data.metadata.budgetStatus.used / data.metadata.budgetStatus.limit) * 100;
        if (usagePercent > 80) {
          // Could trigger a toast notification here
          console.info(`High usage detected: ${usagePercent.toFixed(1)}% of daily budget used`);
        }
      }

      return transformedResponse;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check feature access with server-side validation
   */
  async checkFeatureAccess(userId: string, feature: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/feature/check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          feature
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to check feature access: ${response.status}`);
      }

      const data: FeatureCheckResponse = await response.json();
      
      if (!data.success) {
        throw new Error('Failed to check feature access from server');
      }

      return data.allowed;
    } catch (error) {
      // Fallback to client-side check
      return this.getClientSideFeatureAccess(feature);
    }
  }

  /**
   * Fallback client-side feature access check
   */
  private getClientSideFeatureAccess(feature: string): boolean {
    // This is a fallback - in production, always use server-side checks
    switch (feature) {
      case 'text':
        return true;
      case 'audio':
      case 'image':
        return false; // Default to blocked for Free tier
      default:
        return false;
    }
  }

  /**
   * Get tier analytics (for admin/monitoring)
   */
  async getTierAnalytics(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/admin/tier-analytics`);
      
      if (!response.ok) {
        throw new Error(`Failed to get analytics: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error('Failed to get analytics from server');
      }

      return data.analytics;
    } catch (error) {
      return null;
    }
  }
}

// Export singleton instance
export const tierEnforcementService = new TierEnforcementService();
export default tierEnforcementService;
