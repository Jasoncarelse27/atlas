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
