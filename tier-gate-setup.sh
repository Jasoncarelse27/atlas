#!/bin/bash

# ============================
# Atlas Tier Gate System - Complete Implementation
# ============================

echo "🚀 Creating Atlas Enhanced Tier Gate System..."

# 1. Create directories
mkdir -p backend/config
mkdir -p backend/services
echo "✅ Directories created"

# 2. Create database migration
cat > supabase/migrations/20250918_tier_gate_additions.sql << 'EOF'
-- ============================
-- Atlas Enhanced Tier Gate System Tables (ADDITIVE - NO REMOVALS)
-- ============================

-- 1. Prompt Cache (for caching system prompts - 90% cost reduction)
create table if not exists prompt_cache (
  id bigserial primary key,
  hash text not null unique,
  content text not null,
  tokens integer not null,
  created_at timestamptz default now(),
  expires_at timestamptz not null
);

create index if not exists idx_prompt_cache_expires on prompt_cache(expires_at);
create index if not exists idx_prompt_cache_hash on prompt_cache(hash);

-- 2. Model Usage Logs (for intelligent model selection analytics)
create table if not exists model_usage_logs (
  id bigserial primary key,
  date date not null,
  model text not null,
  tier text not null check (tier in ('free', 'core', 'studio')),
  count integer default 1,
  cost_estimate numeric(10,4) default 0,
  created_at timestamptz default now(),
  unique(date, model, tier)
);

create index if not exists idx_model_usage_date on model_usage_logs(date);
create index if not exists idx_model_usage_model on model_usage_logs(model);
create index if not exists idx_model_usage_tier on model_usage_logs(tier);

-- 3. Cache Stats (for tracking cache efficiency)
create table if not exists cache_stats (
  id bigserial primary key,
  date date not null unique,
  hits integer default 0,
  misses integer default 0,
  cost_savings numeric(10,4) default 0,
  created_at timestamptz default now()
);

create index if not exists idx_cache_stats_date on cache_stats(date);

-- 4. Budget Tracking (for daily ceiling enforcement)
create table if not exists budget_tracking (
  id bigserial primary key,
  date date not null,
  tier text not null check (tier in ('free', 'core', 'studio')),
  total_spend numeric(10,4) default 0,
  request_count integer default 0,
  last_updated timestamptz default now(),
  unique(date, tier)
);

create index if not exists idx_budget_tracking_date_tier on budget_tracking(date, tier);

-- RLS Policies (service role access)
alter table prompt_cache enable row level security;
alter table model_usage_logs enable row level security;
alter table cache_stats enable row level security;
alter table budget_tracking enable row level security;

create policy "srv role manage prompt_cache" on prompt_cache for all using (auth.role() = 'service_role');
create policy "srv role manage model_usage" on model_usage_logs for all using (auth.role() = 'service_role');
create policy "srv role manage cache_stats" on cache_stats for all using (auth.role() = 'service_role');
create policy "srv role manage budget" on budget_tracking for all using (auth.role() = 'service_role');

-- Helper functions (atomic operations)
create or replace function log_model_usage(p_date date, p_model text, p_tier text, p_cost numeric)
returns void language plpgsql security definer as $$
begin
  insert into model_usage_logs(date, model, tier, count, cost_estimate)
  values (p_date, p_model, p_tier, 1, p_cost)
  on conflict (date, model, tier) do update
  set count = model_usage_logs.count + 1,
      cost_estimate = model_usage_logs.cost_estimate + excluded.cost_estimate;
end; $$;

create or replace function update_cache_stats(p_date date, p_hit boolean, p_cost_savings numeric default 0)
returns void language plpgsql security definer as $$
begin
  insert into cache_stats(date, hits, misses, cost_savings)
  values (p_date, case when p_hit then 1 else 0 end, case when p_hit then 0 else 1 end, p_cost_savings)
  on conflict (date) do update
  set hits = cache_stats.hits + (case when p_hit then 1 else 0 end),
      misses = cache_stats.misses + (case when p_hit then 0 else 1 end),
      cost_savings = cache_stats.cost_savings + p_cost_savings;
end; $$;

-- Atomic budget increment
create or replace function increment_budget_tracking(p_date date, p_tier text, p_spend_delta numeric, p_req_delta integer default 1)
returns void language plpgsql security definer as $$
begin
  insert into budget_tracking(date, tier, total_spend, request_count)
  values (p_date, p_tier, coalesce(p_spend_delta,0), coalesce(p_req_delta,1))
  on conflict (date, tier) do update
  set total_spend = budget_tracking.total_spend + coalesce(p_spend_delta,0),
      request_count = budget_tracking.request_count + coalesce(p_req_delta,1),
      last_updated = now();
end; $$;

grant usage on schema public to anon, authenticated;
grant execute on function log_model_usage(date,text,text,numeric) to authenticated;
grant execute on function update_cache_stats(date,boolean,numeric) to authenticated;
grant execute on function increment_budget_tracking(date,text,numeric,integer) to authenticated;

-- ============================
-- Atlas Enhanced Tier Gate System Ready!
-- ============================
EOF

# 3. Create rollback migration
cat > supabase/migrations/20250918_tier_gate_additions.down.sql << 'EOF'
-- Rollback for Atlas Enhanced Tier Gate System

-- Drop functions
drop function if exists increment_budget_tracking(date,text,numeric,integer);
drop function if exists update_cache_stats(date,boolean,numeric);
drop function if exists log_model_usage(date,text,text,numeric);

-- Drop tables (in reverse order)
drop table if exists budget_tracking;
drop table if exists cache_stats;
drop table if exists model_usage_logs;
drop table if exists prompt_cache;
EOF

# 4. Create intelligent tier system config
cat > backend/config/intelligentTierSystem.mjs << 'EOF'
// Atlas Enhanced Tier Gate System (backend, ESM, no removals)

export const TIER_DEFINITIONS = {
  free:   { dailyMessages: 15, models: ['haiku'],              features: ['basic_chat','habit_logging'],                     budgetCeiling: 20,  priority: 1, monthlyPrice: 0 },
  core:   { dailyMessages: -1, models: ['haiku','sonnet'],     features: ['all_basic','persistent_memory','eq_challenges'],  budgetCeiling: 100, priority: 2, monthlyPrice: 19.99 },
  studio: { dailyMessages: -1, models: ['haiku','sonnet','opus'], features: ['all_features','priority_processing','advanced_analytics'], budgetCeiling: 80, priority: 3, monthlyPrice: 189.99 }
};

export const FEATURE_GATES = {
  voice_analysis: ['core','studio'],
  advanced_insights: ['studio'],
  priority_processing: ['studio'],
  persistent_memory: ['core','studio']
};

export const MODEL_COSTS = {
  'claude-3-haiku':  { input: 0.00025, output: 0.00125 },
  'claude-3-sonnet': { input: 0.003,   output: 0.015   },
  'claude-3-opus':   { input: 0.015,   output: 0.075   }
};

export const PROMPT_CACHE_CONFIG = {
  systemPersonality: { cacheTTL: 24*60*60*1000, estimatedTokens: 2000 },
  habitFramework:    { cacheTTL: 12*60*60*1000, estimatedTokens: 500  },
  eqChallenges:      { cacheTTL: 24*60*60*1000, estimatedTokens: 800  }
};

export const SYSTEM_LIMITS = {
  maxDailySpend: 200,
  emergencyShutoff: 250,
  highTrafficThreshold: 150
};

export function selectOptimalModel(userTier, messageContent = '', requestType = '') {
  if (userTier === 'free') return 'claude-3-haiku';

  const msg = `${requestType} ${messageContent}`.toLowerCase();
  const wc  = msg.trim().split(/\s+/).filter(Boolean).length;

  const isSimple = wc <= 5 || /^(hi|hello|hey|thanks?|ok|okay)\b/.test(msg);
  if (isSimple) return 'claude-3-haiku';

  const needsEmotional = /(feel|emotion|mood|anxiety|depress|stress|relationship|overwhelmed|mental health)/.test(msg);
  if (needsEmotional) return 'claude-3-sonnet';

  const isComplex = wc > 100 || /(deep dive|comprehensive|detailed breakdown|multiple factors|long-term strategy)/.test(msg) || msg.split('.').length > 5;
  if (userTier === 'studio' && isComplex) return 'claude-3-opus';

  return 'claude-3-sonnet';
}

export function estimateRequestCost(model, inputTokens = 0, outputTokens = 0) {
  const c = MODEL_COSTS[model];
  if (!c) return 0;
  return (inputTokens * c.input / 1000) + (outputTokens * c.output / 1000);
}
EOF

# 5. Create budget ceiling service
cat > backend/services/budgetCeilingService.mjs << 'EOF'
import { SYSTEM_LIMITS, TIER_DEFINITIONS } from '../config/intelligentTierSystem.mjs';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

export const budgetCeilingService = {
  async checkBudgetCeiling(tier) {
    try {
      const [tierSpend, totalSpend] = await Promise.all([this._tierSpend(tier), this._totalSpend()]);
      const ceiling = TIER_DEFINITIONS[tier]?.budgetCeiling ?? 0;

      // Emergency stop
      if (totalSpend >= SYSTEM_LIMITS.emergencyShutoff) {
        await this._log('budget_emergency_shutoff', { totalSpend });
        return { allowed: false, message: 'Atlas is temporarily unavailable. Please try again later.' };
      }
      
      // High traffic: prioritize paying users
      if (totalSpend >= SYSTEM_LIMITS.highTrafficThreshold) {
        if (tier === 'free') {
          await this._log('budget_high_traffic_free_blocked', { totalSpend });
          return { allowed: false, message: 'High traffic. Upgrade to Core for guaranteed access.' };
        }
        await this._log('budget_high_traffic_priority', { totalSpend, tier });
        return { allowed: true, priorityOverride: true };
      }
      
      // Tier ceiling
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
      console.error('Budget check failed:', error);
      await this._log('budget_check_error', { error: error.message, tier });
      return { allowed: true }; // GRACEFUL FALLBACK
    }
  },

  async recordSpend(tier, cost = 0, reqInc = 1) {
    const { error } = await supabase.rpc('increment_budget_tracking', {
      p_date: new Date().toISOString().slice(0,10),
      p_tier: tier,
      p_spend_delta: cost,
      p_req_delta: reqInc
    });
    if (error) console.warn('recordSpend rpc error', error);
  },

  async _tierSpend(tier) {
    const { data } = await supabase.from('budget_tracking')
      .select('total_spend').eq('date', new Date().toISOString().slice(0,10)).eq('tier', tier).single();
    return data?.total_spend ?? 0;
  },

  async _totalSpend() {
    const { data } = await supabase.from('budget_tracking')
      .select('total_spend').eq('date', new Date().toISOString().slice(0,10));
    return (data ?? []).reduce((s, r) => s + (r.total_spend ?? 0), 0);
  },

  async _log(event, payload) {
    await supabase.from('usage_logs').insert({
      event,
      data: { ...payload, ts: new Date().toISOString(), svc: 'budgetCeiling' }
    }).then(({ error }) => { if (error) console.warn('budget log err', error.message); });
  }
};
EOF

# 6. Create prompt cache service
cat > backend/services/promptCacheService.mjs << 'EOF'
import { createClient } from '@supabase/supabase-js';
import { PROMPT_CACHE_CONFIG } from '../config/intelligentTierSystem.mjs';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const memory = new Map(); // { hash: { content, expiresAt } }

function simpleHash(s) {
  let h = 0; for (let i=0;i<s.length;i++){ h=(h<<5)-h + s.charCodeAt(i); h|=0; } return String(h);
}

export const promptCacheService = {
  async get(promptType, userCtx = null, baseContent = '') {
    try {
      const cfg = PROMPT_CACHE_CONFIG[promptType] ?? { cacheTTL: 3600000, estimatedTokens: 0 };
      const keydata = JSON.stringify({ promptType, userCtx });
      const hash = `${promptType}_${simpleHash(keydata)}`;

      // Memory cache first
      const mem = memory.get(hash);
      if (mem && mem.expiresAt > Date.now()) {
        await this._logCacheHit(true);
        return mem.content;
      }

      // Database cache
      const { data: dbHit } = await supabase.from('prompt_cache')
        .select('*').eq('hash', hash).gt('expires_at', new Date().toISOString()).maybeSingle();
      
      if (dbHit) {
        memory.set(hash, { content: dbHit.content, expiresAt: new Date(dbHit.expires_at).getTime() });
        await this._logCacheHit(true);
        return dbHit.content;
      }

      // Build new content
      const content = [baseContent, userCtx ? `User Context:\n${JSON.stringify(userCtx, null, 2)}` : '']
        .filter(Boolean).join('\n\n');

      const expiresAt = new Date(Date.now() + cfg.cacheTTL).toISOString();
      await supabase.from('prompt_cache').upsert({ 
        hash, 
        content, 
        tokens: cfg.estimatedTokens, 
        expires_at: expiresAt 
      });
      
      memory.set(hash, { content, expiresAt: Date.now() + cfg.cacheTTL });
      await this._logCacheHit(false);

      return content;
    } catch (error) {
      console.warn('Prompt cache error:', error);
      // GRACEFUL FALLBACK - return base content
      return baseContent || `You are Atlas, an emotionally intelligent AI assistant.`;
    }
  },

  async _logCacheHit(hit) {
    const costSavings = hit ? 0.02 : 0; // Estimate $0.02 saved per cache hit
    await supabase.rpc('update_cache_stats', { 
      p_date: new Date().toISOString().slice(0,10), 
      p_hit: hit, 
      p_cost_savings: costSavings 
    }).then(({ error }) => { if (error) console.warn('cache stat err', error.message); });
  }
};
EOF

# 7. Create admin dashboard service
cat > backend/services/adminDashboardService.mjs << 'EOF'
import { createClient } from '@supabase/supabase-js';
import { SYSTEM_LIMITS } from '../config/intelligentTierSystem.mjs';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

export const adminDashboardService = {
  async getMetrics() {
    try {
      const today = new Date().toISOString().slice(0,10);

      const [budget, modelUsage, cache] = await Promise.all([
        supabase.from('budget_tracking').select('tier,total_spend').eq('date', today),
        supabase.from('model_usage_logs').select('model,tier,count,cost_estimate').eq('date', today),
        supabase.from('cache_stats').select('hits,misses,cost_savings').eq('date', today).maybeSingle()
      ]);

      // Process budget data
      const byTier = (budget.data ?? []).reduce((acc,r) => { 
        acc[r.tier] = (acc[r.tier]||0) + Number(r.total_spend||0); 
        return acc; 
      }, {});
      
      const totalSpend = Object.values(byTier).reduce((s,v)=>s+v,0);
      const budgetUtil = SYSTEM_LIMITS.maxDailySpend ? (totalSpend / SYSTEM_LIMITS.maxDailySpend) * 100 : 0;

      // Process model usage
      const modelAgg = { haiku:0, sonnet:0, opus:0 };
      (modelUsage.data ?? []).forEach(r => {
        const key = (r.model || '').replace('claude-3-','');
        if (modelAgg[key] != null) modelAgg[key] += Number(r.count||0);
      });

      // Process cache stats
      const hits = cache.data?.hits ?? 0;
      const misses = cache.data?.misses ?? 0;
      const hitRate = (hits+misses) ? (hits/(hits+misses))*100 : 0;

      // Generate alerts
      const alerts = [];
      if (budgetUtil > 90) alerts.push({ type:'budget', severity:'high', message:`Budget at ${budgetUtil.toFixed(1)}%` });
      else if (budgetUtil > 75) alerts.push({ type:'budget', severity:'medium', message:`Budget at ${budgetUtil.toFixed(1)}%` });

      if (modelAgg.opus > modelAgg.sonnet * 2) {
        alerts.push({ type:'model_usage', severity:'medium', message:'Opus usage unusually high - check Studio patterns' });
      }

      return {
        dailySpend: { total: totalSpend, byTier, budgetUtilization: budgetUtil },
        modelUsage: modelAgg,
        cacheEfficiency: { hitRate, costSavings: Number(cache.data?.cost_savings||0) },
        alerts,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Admin metrics error:', error);
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
EOF

# 8. Update admin routes with metrics endpoint
cat > backend/routes/admin.js << 'EOF'
import express from 'express';
import { supabase } from '../lib/supabase.js';

const router = express.Router();

// POST /admin/resetAttempts - Delete all rows from feature_attempts table
router.post('/resetAttempts', async (req, res) => {
  try {
    const { error } = await supabase
      .from('feature_attempts')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows
    
    if (error) {
      console.error('Error resetting attempts:', error);
      return res.json({ success: false, message: error.message });
    }
    
    res.json({ success: true, message: 'Feature attempts table reset' });
  } catch (error) {
    console.error('Error in resetAttempts:', error);
    res.json({ success: false, message: error.message });
  }
});

// GET /admin/featureFlags - Return all feature flags
router.get('/featureFlags', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('feature_flags')
      .select('*')
      .order('tier', { ascending: true });
    
    if (error) {
      console.error('Error fetching feature flags:', error);
      return res.json({ success: false, message: error.message });
    }
    
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in featureFlags:', error);
    res.json({ success: false, message: error.message });
  }
});

// 📊 NEW: GET /admin/metrics - Tier gate system metrics
router.get('/metrics', async (req, res) => {
  try {
    // Import the admin dashboard service
    const { adminDashboardService } = await import('../services/adminDashboardService.mjs');
    
    const metrics = await adminDashboardService.getMetrics();
    
    res.json({
      success: true,
      metrics,
      generatedAt: new Date().toISOString(),
      system: 'Atlas Enhanced Tier Gate System'
    });

  } catch (error) {
    console.error('Error fetching admin metrics:', error);
    res.json({ 
      success: false, 
      status: 'unavailable',
      message: 'Metrics service temporarily unavailable',
      error: error.message 
    });
  }
});

export default router;
EOF

echo "🎯 All tier gate system files created!"
echo ""
echo "📂 Files created:"
echo "  ✅ supabase/migrations/20250918_tier_gate_additions.sql"
echo "  ✅ supabase/migrations/20250918_tier_gate_additions.down.sql"
echo "  ✅ backend/config/intelligentTierSystem.mjs"
echo "  ✅ backend/services/budgetCeilingService.mjs"
echo "  ✅ backend/services/promptCacheService.mjs"
echo "  ✅ backend/services/adminDashboardService.mjs"
echo "  ✅ backend/routes/admin.js (updated with /metrics endpoint)"
echo ""
echo "🚀 Ready for database migration!"
