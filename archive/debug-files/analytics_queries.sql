-- Atlas Feature Attempt Analytics Queries
-- Save these as "Saved Queries" in Supabase SQL Editor for dashboard analytics

-- 1. Count Attempts by Tier
-- Shows which tier users are attempting features most
select 
  tier, 
  count(*) as total_attempts,
  count(distinct user_id) as unique_users
from feature_attempts
group by tier
order by total_attempts desc;

-- 2. Most Popular Features Tried
-- Identifies which features users want most (upgrade opportunities)
select 
  feature, 
  count(*) as attempts,
  count(distinct user_id) as unique_users,
  round(count(*) * 100.0 / sum(count(*)) over (), 2) as percentage
from feature_attempts
group by feature
order by attempts desc;

-- 3. Free Users Trying Premium Features
-- Shows conversion funnel opportunities
select 
  feature, 
  count(*) as free_attempts,
  count(distinct user_id) as free_users,
  round(avg(count(*)) over (partition by feature), 2) as avg_attempts_per_user
from feature_attempts
where tier = 'free'
group by feature
order by free_attempts desc;

-- 4. Weekly Trends
-- Track feature attempt trends over time
select 
  date_trunc('week', created_at) as week, 
  feature, 
  count(*) as attempts,
  count(distinct user_id) as unique_users
from feature_attempts
where created_at >= now() - interval '12 weeks'
group by week, feature
order by week desc, attempts desc;

-- 5. Conversion Funnel Analysis
-- See which free users eventually upgrade
select 
  f.user_id, 
  min(f.created_at) as first_attempt, 
  p.subscription_tier as current_tier,
  count(f.id) as total_attempts,
  array_agg(distinct f.feature) as attempted_features
from feature_attempts f
join profiles p on p.id = f.user_id
where f.tier = 'free'
group by f.user_id, p.subscription_tier
order by first_attempt desc;

-- 6. Top Users by Attempts
-- Identify power users and engagement patterns
select 
  user_id, 
  count(*) as attempts, 
  max(created_at) as last_attempt,
  count(distinct feature) as features_tried,
  array_agg(distinct feature) as features_list
from feature_attempts
group by user_id
order by attempts desc
limit 20;

-- 7. Feature Success Rate by Tier
-- Shows which features are most desired vs accessible
select 
  f.feature,
  f.tier,
  count(*) as attempts,
  case 
    when p.subscription_tier = f.tier then 'allowed'
    when p.subscription_tier > f.tier then 'upgraded'
    else 'blocked'
  end as access_status,
  count(distinct f.user_id) as unique_users
from feature_attempts f
join profiles p on p.id = f.user_id
group by f.feature, f.tier, p.subscription_tier
order by f.feature, attempts desc;

-- 8. Daily Feature Attempt Trends
-- Monitor daily engagement and feature usage
select 
  date_trunc('day', created_at) as day,
  feature,
  tier,
  count(*) as attempts,
  count(distinct user_id) as unique_users
from feature_attempts
where created_at >= now() - interval '30 days'
group by day, feature, tier
order by day desc, attempts desc;

-- 9. Upgrade Intent Analysis
-- Track users who attempt premium features multiple times
select 
  user_id,
  feature,
  count(*) as attempts,
  min(created_at) as first_attempt,
  max(created_at) as last_attempt,
  extract(day from (max(created_at) - min(created_at))) as days_between_attempts
from feature_attempts
where tier = 'free'
group by user_id, feature
having count(*) > 1
order by attempts desc, days_between_attempts asc;

-- 10. Feature Attempt Conversion Dashboard
-- Complete view for upgrade funnel analysis
select 
  'Total Feature Attempts' as metric,
  count(*) as value,
  'count' as type
from feature_attempts
union all
select 
  'Unique Users Attempting Features',
  count(distinct user_id),
  'count'
from feature_attempts
union all
select 
  'Free Tier Attempts',
  count(*),
  'count'
from feature_attempts
where tier = 'free'
union all
select 
  'Most Attempted Feature',
  (select count(*) from feature_attempts group by feature order by count(*) desc limit 1),
  'count'
from feature_attempts
limit 1;
