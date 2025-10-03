import { createClient } from '@supabase/supabase-js';
import { PROMPT_CACHE_CONFIG } from '../config/intelligentTierSystem.mjs';

// Lazy initialization like your existing logger
let supabase = null;
const memory = new Map();

function getSupabaseClient() {
  if (!supabase && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  }
  return supabase;
}

function simpleHash(s) {
  let h = 0; for (let i=0;i<s.length;i++){ h=(h<<5)-h + s.charCodeAt(i); h|=0; } return String(h);
}

export const promptCacheService = {
  async get(promptType, userCtx = null, baseContent = '') {
    try {
      const client = getSupabaseClient();
      const cfg = PROMPT_CACHE_CONFIG[promptType] ?? { cacheTTL: 3600000, estimatedTokens: 0 };
      const keydata = JSON.stringify({ promptType, userCtx });
      const hash = `${promptType}_${simpleHash(keydata)}`;

      // Memory cache first
      const mem = memory.get(hash);
      if (mem && mem.expiresAt > Date.now()) {
        await this._logCacheHit(true);
        return mem.content;
      }

      // Database cache (only if client available)
      if (client) {
        const { data: dbHit } = await client.from('prompt_cache')
          .select('*').eq('hash', hash).gt('expires_at', new Date().toISOString()).maybeSingle();
        
        if (dbHit) {
          memory.set(hash, { content: dbHit.content, expiresAt: new Date(dbHit.expires_at).getTime() });
          await this._logCacheHit(true);
          return dbHit.content;
        }
      }

      // Build new content
      const content = [baseContent, userCtx ? `User Context:\n${JSON.stringify(userCtx, null, 2)}` : '']
        .filter(Boolean).join('\n\n');

      // Store in database if client available
      if (client) {
        const expiresAt = new Date(Date.now() + cfg.cacheTTL).toISOString();
        await client.from('prompt_cache').upsert({ 
          hash, 
          content, 
          tokens: cfg.estimatedTokens, 
          expires_at: expiresAt 
        });
        
        memory.set(hash, { content, expiresAt: Date.now() + cfg.cacheTTL });
        await this._logCacheHit(false);
      }

      return content;
    } catch (error) {
      console.warn('Prompt cache error:', error);
      return baseContent || `You are Atlas, an emotionally intelligent AI guide focused on supporting growth in coding, creativity, and emotional intelligence while maintaining safe boundaries.`;
    }
  },

  async _logCacheHit(hit) {
    try {
      const client = getSupabaseClient();
      if (!client) return;

      const costSavings = hit ? 0.02 : 0;
      await client.rpc('update_cache_stats', { 
        p_date: new Date().toISOString().slice(0,10), 
        p_hit: hit, 
        p_cost_savings: costSavings 
      });
    } catch (error) {
      console.warn('cache stat err', error.message);
    }
  }
};
