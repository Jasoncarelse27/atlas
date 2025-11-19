import { createClient } from '@supabase/supabase-js';
import { SYSTEM_LIMITS } from '../config/intelligentTierSystem.mjs';

// Lazy initialization like your existing logger
let supabase = null;

function getSupabaseClient() {
  if (!supabase && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  }
  return supabase;
}

export const adminDashboardService = {
  async getMetrics() {
    try {
      const client = getSupabaseClient();
      if (!client) {
        return {
          dailySpend: { total: 0, byTier: {}, budgetUtilization: 0 },
          modelUsage: { haiku: 0, sonnet: 0, opus: 0 },
          cacheEfficiency: { hitRate: 0, costSavings: 0 },
          alerts: [{ type: 'system', severity: 'medium', message: 'Supabase not available' }],
          timestamp: new Date().toISOString()
        };
      }

      const today = new Date().toISOString().slice(0,10);

      const [budget, modelUsage, cache] = await Promise.all([
        client.from('budget_tracking').select('tier,total_spend').eq('date', today),
        client.from('model_usage_logs').select('model,tier,count,cost_estimate').eq('date', today),
        client.from('cache_stats').select('hits,misses,cost_savings').eq('date', today).maybeSingle()
      ]);

      const byTier = (budget.data ?? []).reduce((acc,r) => { 
        acc[r.tier] = (acc[r.tier]||0) + Number(r.total_spend||0); 
        return acc; 
      }, {});
      
      const totalSpend = Object.values(byTier).reduce((s,v)=>s+v,0);
      const budgetUtil = SYSTEM_LIMITS.maxDailySpend ? (totalSpend / SYSTEM_LIMITS.maxDailySpend) * 100 : 0;

      const modelAgg = { haiku:0, sonnet:0, opus:0 };
      (modelUsage.data ?? []).forEach(r => {
        // ✅ FIXED: Handle both old and new model name formats
        // New format: claude-3-5-haiku-latest, claude-3-5-sonnet-latest, claude-3-opus-latest
        // Old format: claude-3-haiku-20240307, claude-sonnet-4-5-20250929
        const modelName = (r.model || '').toLowerCase();
        if (modelName.includes('haiku')) {
          modelAgg.haiku += Number(r.count||0);
        } else if (modelName.includes('sonnet')) {
          modelAgg.sonnet += Number(r.count||0);
        } else if (modelName.includes('opus')) {
          modelAgg.opus += Number(r.count||0);
        }
      });

      const hits = cache.data?.hits ?? 0;
      const misses = cache.data?.misses ?? 0;
      const hitRate = (hits+misses) ? (hits/(hits+misses))*100 : 0;

      const alerts = [];
      if (budgetUtil > 90) alerts.push({ type:'budget', severity:'high', message:`Budget at ${budgetUtil.toFixed(1)}%` });
      else if (budgetUtil > 75) alerts.push({ type:'budget', severity:'medium', message:`Budget at ${budgetUtil.toFixed(1)}%` });

      return {
        dailySpend: { total: totalSpend, byTier, budgetUtilization: budgetUtil },
        modelUsage: modelAgg,
        cacheEfficiency: { hitRate, costSavings: Number(cache.data?.cost_savings||0) },
        alerts,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        dailySpend: { total: 0, byTier: {}, budgetUtilization: 0 },
        modelUsage: { haiku: 0, sonnet: 0, opus: 0 },
        cacheEfficiency: { hitRate: 0, costSavings: 0 },
        alerts: [{ type: 'system', severity: 'high', message: 'Metrics unavailable' }],
        timestamp: new Date().toISOString()
      };
    }
  }
};
