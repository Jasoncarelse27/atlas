import { tierFeatures } from '@/config/featureAccess';
import { supabase } from '@/lib/supabaseClient';
import type { Tier } from '@/types/tier';

interface AudioUsageCheck {
  canUse: boolean;
  minutesUsed: number;
  minutesRemaining: number;
  dailyUsed: number;
  dailyRemaining: number;
  warning?: string;
}

export class AudioUsageService {
  /**
   * Check if user can use audio features (respects both monthly and daily limits)
   */
  async checkAudioUsage(userId: string, tier: Tier): Promise<AudioUsageCheck> {
    const config = tierFeatures[tier] as any;
    
    // FREE tier: blocked
    if (tier === 'free') {
      return {
        canUse: false,
        minutesUsed: 0,
        minutesRemaining: 0,
        dailyUsed: 0,
        dailyRemaining: 0,
        warning: 'Audio features require Core or Studio tier'
      };
    }
    
    // STUDIO tier: unlimited
    if (tier === 'studio') {
      return {
        canUse: true,
        minutesUsed: 0,
        minutesRemaining: -1,
        dailyUsed: 0,
        dailyRemaining: -1
      };
    }
    
    // CORE tier: temporarily allow all usage (database tables not ready yet)
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('usage_stats')
        .eq('id', userId)
        .single() as { data: any };
      
      const usageStats = profile?.usage_stats || {};
      const audioMinutesUsed = usageStats.audio_minutes_used || 0;
      const lastReset = usageStats.last_daily_audio_reset;
      
      // Check if daily reset needed
      const now = new Date();
      const lastResetDate = lastReset ? new Date(lastReset) : null;
      const needsDailyReset = !lastResetDate || 
        now.toDateString() !== lastResetDate.toDateString();
      
      let dailyUsed = needsDailyReset ? 0 : (usageStats.daily_audio_used || 0);
      
      // Monthly limit check
      const monthlyLimit = config.audioMinutesPerMonth;
      const monthlyRemaining = monthlyLimit - audioMinutesUsed;
      
      // Daily limit check
      const dailyLimit = config.dailyAudioCap;
      const dailyRemaining = dailyLimit - dailyUsed;
      
      // Determine if can use
      const canUse = monthlyRemaining > 0 && dailyRemaining > 0;
      
      // Warning messages
      let warning;
      if (monthlyRemaining <= 0) {
        warning = 'Monthly audio limit reached. Resets on billing cycle.';
      } else if (dailyRemaining <= 0) {
        warning = 'Daily audio limit reached. Resets tomorrow.';
      } else if (monthlyRemaining <= 1) {
        warning = `Only ${monthlyRemaining} minute(s) remaining this month`;
      } else if (dailyRemaining <= 0.5) {
        warning = `Only ${Math.ceil(dailyRemaining * 60)} seconds remaining today`;
      }
      
      return {
        canUse,
        minutesUsed: audioMinutesUsed,
        minutesRemaining: monthlyRemaining,
        dailyUsed,
        dailyRemaining,
        warning
      };
    } catch (error) {
      console.warn('[AudioUsage] Database unavailable, allowing usage:', error);
      // If database is unavailable, allow usage for now
      return {
        canUse: true,
        minutesUsed: 0,
        minutesRemaining: 5,
        dailyUsed: 0,
        dailyRemaining: 2,
        warning: 'Usage tracking temporarily unavailable'
      };
    }
  }
  
  /**
   * Track audio usage (STT or TTS)
   */
  async trackUsage(
    userId: string, 
    tier: Tier, 
    type: 'stt' | 'tts',
    durationSeconds?: number,
    characters?: number
  ): Promise<void> {
    if (tier === 'free') return; // FREE tier blocked anyway
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('usage_stats')
      .eq('id', userId)
      .single() as { data: any };
    
    const usageStats = profile?.usage_stats || {};
    const now = new Date();
    
    // Reset daily usage if new day
    const lastReset = usageStats.last_daily_audio_reset;
    const lastResetDate = lastReset ? new Date(lastReset) : null;
    const needsDailyReset = !lastResetDate || 
      now.toDateString() !== lastResetDate.toDateString();
    
    const updates: any = {
      ...usageStats,
      last_daily_audio_reset: now.toISOString()
    };
    
    if (type === 'stt' && durationSeconds) {
      const minutes = durationSeconds / 60;
      updates.audio_minutes_used = (usageStats.audio_minutes_used || 0) + minutes;
      updates.daily_audio_used = needsDailyReset ? minutes : (usageStats.daily_audio_used || 0) + minutes;
    }
    
    if (type === 'tts' && characters) {
      updates.tts_characters_used = (usageStats.tts_characters_used || 0) + characters;
      
      // Also count TTS toward audio minutes (approximate: 150 chars ≈ 1 min speech)
      const estimatedMinutes = characters / 150;
      updates.audio_minutes_used = (usageStats.audio_minutes_used || 0) + estimatedMinutes;
      updates.daily_audio_used = needsDailyReset ? estimatedMinutes : (usageStats.daily_audio_used || 0) + estimatedMinutes;
    }
    
    // @ts-ignore - Supabase table types not available
    await supabase
      .from('profiles')
      // @ts-ignore
      .update({ usage_stats: updates })
      .eq('id', userId);
  }
  
  /**
   * Check cached TTS audio (avoid re-generating same text)
   */
  async getCachedAudio(text: string, model: string): Promise<string | null> {
    try {
      const textHash = this.hashText(text + model);
      
      const { data } = await supabase
        .from('audio_cache')
        .select('audio_url, expires_at, id, hit_count')
        .eq('text_hash', textHash)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle() as { data: any };
      
      if (data) {
        // Increment hit count
        // @ts-ignore - Supabase table types not available
        await supabase
          .from('audio_cache')
          // @ts-ignore
          .update({ hit_count: (data.hit_count || 0) + 1 })
          .eq('id', data.id);
        
        return data.audio_url;
      }
      
      return null;
    } catch (error) {
      console.warn('[AudioUsage] Cache unavailable:', error);
      return null; // No cache available, will generate new audio
    }
  }
  
  /**
   * Cache TTS audio for reuse
   */
  async cacheAudio(
    text: string, 
    audioDataUrl: string, 
    model: string, 
    voice: string
  ): Promise<void> {
    try {
      const textHash = this.hashText(text + model);
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // Cache for 24 hours
      
      await supabase.from('audio_cache').insert({
        text_hash: textHash,
        text_content: text.slice(0, 500), // Store preview only
        audio_url: audioDataUrl,
        model,
        voice,
        character_count: text.length,
        expires_at: expiresAt.toISOString()
      } as any);
    } catch (error) {
      // Ignore conflicts - cache entry already exists or table doesn't exist
      console.warn('[AudioUsage] Cache insert failed:', error);
    }
  }
  
  private hashText(text: string): string {
    // Simple hash for caching (use crypto in production)
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }
}

export const audioUsageService = new AudioUsageService();

