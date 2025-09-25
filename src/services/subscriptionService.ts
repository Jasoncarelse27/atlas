import { supabase } from '../lib/supabase';

export const getUserTier = async (): Promise<string> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 'free';
    
    const { data, error } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .single();
    
    if (error) {
      console.warn('Could not get user tier, defaulting to free:', error.message);
      return 'free';
    }
    
    return data.subscription_tier || 'free';
  } catch (error) {
    console.warn('Error getting user tier, defaulting to free:', error);
    return 'free';
  }
};
