import { supabase } from '../lib/supabase';

export interface FeatureAttempt {
  feature: 'mic' | 'image' | 'photo';
  success: boolean;
  upgradeShown?: boolean;
}

export class FeatureService {
  /**
   * Log a feature attempt to Supabase
   */
  async logAttempt(
    userId: string, 
    feature: FeatureAttempt['feature'], 
    success: boolean,
    upgradeShown: boolean = false
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('feature_attempts')
        .insert({
          user_id: userId,
          feature,
          success,
          upgrade_shown: upgradeShown,
          attempted_at: new Date().toISOString()
        });

      if (error) {
        console.error('Failed to log feature attempt:', error);
      } else {
        console.log(`Feature attempt logged: ${feature}, success: ${success}, upgrade_shown: ${upgradeShown}`);
      }
    } catch (err) {
      console.error('Error logging feature attempt:', err);
    }
  }

  /**
   * Get feature attempt stats for a user
   */
  async getUserStats(userId: string): Promise<{
    total: number;
    successful: number;
    failed: number;
    byFeature: Record<string, { total: number; successful: number }>;
  }> {
    try {
      const { data, error } = await supabase
        .from('feature_attempts')
        .select('feature, success')
        .eq('user_id', userId);

      if (error) {
        console.error('Failed to fetch user stats:', error);
        return { total: 0, successful: 0, failed: 0, byFeature: {} };
      }

      const total = data.length;
      const successful = data.filter(d => d.success).length;
      const failed = total - successful;

      const byFeature = data.reduce((acc, item) => {
        if (!acc[item.feature]) {
          acc[item.feature] = { total: 0, successful: 0 };
        }
        acc[item.feature].total++;
        if (item.success) {
          acc[item.feature].successful++;
        }
        return acc;
      }, {} as Record<string, { total: number; successful: number }>);

      return { total, successful, failed, byFeature };
    } catch (err) {
      console.error('Error fetching user stats:', err);
      return { total: 0, successful: 0, failed: 0, byFeature: {} };
    }
  }
}

export const featureService = new FeatureService();