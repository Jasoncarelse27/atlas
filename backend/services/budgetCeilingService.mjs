import { SYSTEM_LIMITS, TIER_DEFINITIONS } from '../config/intelligentTierSystem.mjs';
import { createClient } from '@supabase/supabase-js';

// Lazy initialization like your existing logger
let supabase = null;

function getSupabaseClient() {
  if (!supabase && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  }
  return supabase;
}

export const budgetCeilingService = {
  async checkBudgetCeiling(tier) {
    try {
      const client = getSupabaseClient();
      if (!client) {
        return { allowed: true };
      }

      const [tierSpend, totalSpend] = await Promise.all([this._tierSpend(tier), this._totalSpend()]);
      const ceiling = TIER_DEFINITIONS[tier]?.budgetCeiling ?? 0;

      if (totalSpend >= SYSTEM_LIMITS.emergencyShutoff) {
        await this._log('budget_emergency_shutoff', { totalSpend });
        return { allowed: false, message: 'Atlas is temporarily unavailable. Please try again later.' };
      }
      
      if (totalSpend >= SYSTEM_LIMITS.highTrafficThreshold) {
        if (tier === 'free') {
          await this._log('budget_high_traffic_free_blocked', { totalSpend });
          return { allowed: false, message: 'High traffic. Upgrade to Core for guaranteed access.' };
        }
        await this._log('budget_high_traffic_priority', { totalSpend, tier });
        return { allowed: true, priorityOverride: true };
      }
      
      if (tierSpend >= ceiling) {
        if (tier === 'free') {
          await this._log('budget_tier_ceiling_free', { tierSpend, ceiling });
          return { allowed: false, message: 'Daily usage reached. Upgrade to Core for extended access.' };
        }
        await this._log('budget_tier_ceiling_paid', { tierSpend, ceiling, tier });
        return { allowed: true, priorityOverride: true };
      }
      
      return { allowed: true };
    } catch (error) {
      return { allowed: true }; // GRACEFUL FALLBACK
    }
  },

  async recordSpend(tier, cost = 0, reqInc = 1) {
    try {
      const client = getSupabaseClient();
      if (!client) return;

      const { error } = await client.rpc('increment_budget_tracking', {
        p_date: new Date().toISOString().slice(0,10),
        p_tier: tier,
        p_spend_delta: cost,
        p_req_delta: reqInc
      });
    } catch (error) {
    }
  },

  async _tierSpend(tier) {
    try {
      const client = getSupabaseClient();
      if (!client) return 0;

      const { data } = await client.from('budget_tracking')
        .select('total_spend').eq('date', new Date().toISOString().slice(0,10)).eq('tier', tier).single();
      return data?.total_spend ?? 0;
    } catch (error) {
      return 0;
    }
  },

  async _totalSpend() {
    try {
      const client = getSupabaseClient();
      if (!client) return 0;

      const { data } = await client.from('budget_tracking')
        .select('total_spend').eq('date', new Date().toISOString().slice(0,10));
      return (data ?? []).reduce((s, r) => s + (r.total_spend ?? 0), 0);
    } catch (error) {
      return 0;
    }
  },

  async _log(event, payload) {
    try {
      const client = getSupabaseClient();
      if (!client) return;

      await client.from('usage_logs').insert({
        event,
        data: { ...payload, ts: new Date().toISOString(), svc: 'budgetCeiling' }
      });
    } catch (error) {
    }
  }
};
