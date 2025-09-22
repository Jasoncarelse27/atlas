// Feature Attempt Logging Service
// Tracks feature usage attempts for analytics and upgrade funnel analysis

import { supabase } from '../lib/supabase';

export interface FeatureAttempt {
  user_id: string;
  feature: string;
  tier: string;
  allowed: boolean;
  upgrade_shown: boolean;
  timestamp: string;
}

class FeatureService {
  /**
   * Log a feature attempt for analytics
   */
  async logFeatureAttempt(
    feature: string, 
    allowed: boolean, 
    upgradeShown: boolean = false
  ): Promise<void> {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn('No user found for feature attempt logging');
        return;
      }

      // Get user's current tier
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', user.id)
        .single();

      const tier = profile?.subscription_tier || 'free';

      // Log the attempt
      const { error } = await supabase
        .from('feature_attempts')
        .insert({
          user_id: user.id,
          feature,
          tier,
          allowed,
          upgrade_shown: upgradeShown,
          timestamp: new Date().toISOString()
        });

      if (error) {
        console.error('Failed to log feature attempt:', error);
      } else {
        console.log(`[FeatureService] Logged ${feature} attempt: allowed=${allowed}, upgrade_shown=${upgradeShown}`);
      }
    } catch (error) {
      console.error('Error in logFeatureAttempt:', error);
    }
  }

  /**
   * Get feature attempt statistics
   */
  async getFeatureStats(feature?: string): Promise<FeatureAttempt[]> {
    try {
      const { data, error } = await supabase
        .from('feature_attempts')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error) {
        console.error('Failed to fetch feature stats:', error);
        return [];
      }

      return feature ? data.filter(attempt => attempt.feature === feature) : data;
    } catch (error) {
      console.error('Error fetching feature stats:', error);
      return [];
    }
  }
}

export const featureService = new FeatureService();

// Convenience function for logging feature attempts
export const logFeatureAttempt = async (
  feature: string, 
  allowed: boolean = false, 
  upgradeShown: boolean = false
): Promise<void> => {
  await featureService.logFeatureAttempt(feature, allowed, upgradeShown);
};
