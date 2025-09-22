
export interface FeatureAttempt {
  feature: 'mic' | 'image' | 'photo' | 'camera' | 'audio';
  tier: 'free' | 'core' | 'studio';
}

export class FeatureService {
  /**
   * Log a feature attempt via backend API
   */
  async logAttempt(
    userId: string, 
    feature: FeatureAttempt['feature'], 
    tier: FeatureAttempt['tier']
  ): Promise<void> {
    try {
      // Use backend API instead of direct Supabase calls
      const response = await fetch('/api/feature-attempts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          feature,
          tier
        })
      });

      if (!response.ok) {
        console.error('Failed to log feature attempt:', response.statusText);
      } else {
        console.log(`Feature attempt logged: ${feature}, tier: ${tier}`);
      }
    } catch (err) {
      console.error('Error logging feature attempt:', err);
    }
  }

  /**
   * Get feature attempt stats for a user via backend API
   */
  async getUserStats(userId: string): Promise<{
    totalAttempts: number;
    featureCounts: Record<string, number>;
    attempts: Array<{
      id: string;
      feature: string;
      tier: string;
      created_at: string;
    }>;
  }> {
    try {
      // Use backend API instead of direct Supabase calls
      const response = await fetch(`/api/feature-attempts/stats/${userId}`, {
        method: 'GET'
      });

      if (!response.ok) {
        console.error('Failed to fetch user stats:', response.statusText);
        return { 
          totalAttempts: 0, 
          featureCounts: {}, 
          attempts: [] 
        };
      }

      const data = await response.json();
      return data;
    } catch (err) {
      console.error('Error fetching user stats:', err);
      return { 
        totalAttempts: 0, 
        featureCounts: {}, 
        attempts: [] 
      };
    }
  }
}

export const featureService = new FeatureService();