// Atlas V1 Tier Enforcement Service
// Handles server-side tier enforcement API calls

interface TierInfo {
  tier: string;
  messages_used: number;
  messages_limit: number;
  can_use_audio: boolean;
  can_use_image: boolean;
  model: string;
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
    this.baseUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
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
      console.error('Error getting tier info:', error);
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
   * Send message with server-side tier enforcement
   */
  async sendMessage(userId: string, message: string, conversationId?: string): Promise<MessageResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          message,
          conversationId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          // Message limit exceeded
          throw new Error(data.error || 'Message limit exceeded');
        }
        throw new Error(data.error || 'Failed to send message');
      }

      if (!data.success) {
        throw new Error('Failed to send message to server');
      }

      return data;
    } catch (error) {
      console.error('Error sending message:', error);
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
      console.error('Error checking feature access:', error);
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
      console.error('Error getting analytics:', error);
      return null;
    }
  }
}

// Export singleton instance
export const tierEnforcementService = new TierEnforcementService();
export default tierEnforcementService;
