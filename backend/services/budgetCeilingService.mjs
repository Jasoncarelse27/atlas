import { logger } from '../lib/simpleLogger.mjs';
import { SYSTEM_LIMITS, TIER_DEFINITIONS } from '../config/intelligentTierSystem.mjs';

// ✅ Use centralized Supabase client with IPv4 fix
let supabaseClient = null;

async function getSupabaseClient() {
  if (!supabaseClient) {
    try {
      const { supabase } = await import('../config/supabaseClient.mjs');
      supabaseClient = supabase;
    } catch (error) {
      logger.error('[BudgetCeiling] Failed to import Supabase client:', error.message || error);
      return null;
    }
  }
  return supabaseClient;
}

export const budgetCeilingService = {
  async checkBudgetCeiling(tier) {
    try {
      const client = await getSupabaseClient();
      if (!client) {
        // ✅ FAIL-CLOSED: Block access if service unavailable (prevents financial loss)
        logger.error('[BudgetCeiling] Supabase client unavailable - blocking access for safety');
        return { allowed: false, message: 'Service temporarily unavailable. Please try again later.' };
      }

      const [tierSpend, totalSpend] = await Promise.all([this._tierSpend(tier), this._totalSpend()]);
      const ceiling = TIER_DEFINITIONS[tier]?.budgetCeiling ?? 0;
      
      logger.debug(`[BudgetCeiling] Check for ${tier}: tierSpend=${tierSpend}, totalSpend=${totalSpend}, ceiling=${ceiling}`);

      // ✅ EMERGENCY KILL SWITCH: Block all requests if system-wide limit exceeded
      if (totalSpend >= SYSTEM_LIMITS.emergencyShutoff) {
        await this._log('budget_emergency_shutoff', { totalSpend });
        return { allowed: false, message: 'Atlas is temporarily unavailable. Please try again later.' };
      }
      
      // ✅ HIGH TRAFFIC: Prioritize paid users, block free tier
      if (totalSpend >= SYSTEM_LIMITS.highTrafficThreshold) {
        if (tier === 'free') {
          await this._log('budget_high_traffic_free_blocked', { totalSpend });
          return { allowed: false, message: 'High traffic. Upgrade to Core for guaranteed access.' };
        }
        await this._log('budget_high_traffic_priority', { totalSpend, tier });
        return { allowed: true, priorityOverride: true };
      }
      
      // ✅ TIER BUDGET CEILING: Enforce per-tier daily limits
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
      // ✅ FAIL-CLOSED: Block access on error (prevents financial loss during outages)
      logger.error('[BudgetCeiling] Error checking budget:', error.message || error);
      return { allowed: false, message: 'Service temporarily unavailable. Please try again later.' };
    }
  },

  async recordSpend(tier, cost = 0, reqInc = 1) {
    try {
      const client = await getSupabaseClient();
      if (!client) return;

      const { error } = await client.rpc('increment_budget_tracking', {
        p_date: new Date().toISOString().slice(0,10),
        p_tier: tier,
        p_spend_delta: cost,
        p_req_delta: reqInc
      });
    } catch (error) {
      logger.error('[BudgetCeiling] Error incrementing usage:', error.message || error);
    }
  },

  async _tierSpend(tier) {
    try {
      const client = await getSupabaseClient();
      if (!client) return 0;

      const { data, error } = await client.from('budget_tracking')
        .select('total_spend')
        .eq('date', new Date().toISOString().slice(0,10))
        .eq('tier', tier)
        .maybeSingle(); // ✅ Use maybeSingle() instead of single() to handle missing rows
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found (expected)
        logger.warn(`[BudgetCeiling] Error fetching tier spend for ${tier}:`, error.message);
      }
      
      return data?.total_spend ?? 0;
    } catch (error) {
      logger.warn(`[BudgetCeiling] Exception fetching tier spend for ${tier}:`, error.message);
      return 0;
    }
  },

  async _totalSpend() {
    try {
      const client = await getSupabaseClient();
      if (!client) return 0;

      const { data, error } = await client.from('budget_tracking')
        .select('total_spend')
        .eq('date', new Date().toISOString().slice(0,10));
      
      if (error) {
        logger.warn('[BudgetCeiling] Error fetching total spend:', error.message);
        return 0;
      }
      
      return (data ?? []).reduce((s, r) => s + (Number(r.total_spend) || 0), 0);
    } catch (error) {
      logger.warn('[BudgetCeiling] Exception fetching total spend:', error.message);
      return 0;
    }
  },

  async _log(event, payload) {
    try {
      const client = await getSupabaseClient();
      if (!client) return;

      // Extract tier from payload if available
      const tier = payload?.tier || null; // NULL allowed for unknown tiers
      const { tier: _, ...restPayload } = payload || {};

      await client.from('usage_logs').insert({
        event,
        tier: tier, // ✅ Explicit column (best practice)
        feature: 'budget_ceiling',
        metadata: { ...restPayload, ts: new Date().toISOString(), svc: 'budgetCeiling' }
      });
    } catch (error) {
      logger.error('[BudgetCeiling] Error logging event:', error.message || error);
    }
  }
};
