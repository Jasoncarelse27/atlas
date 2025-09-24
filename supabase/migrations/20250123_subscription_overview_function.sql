-- Migration: Create subscription_overview function for admin analytics
-- This function provides aggregated subscription statistics per user with audit events

create or replace function subscription_overview()
returns table (
  email text,
  current_tier text,
  activations int,
  cancellations int,
  upgrades int,
  downgrades int,
  last_change timestamptz
) as $$
begin
  return query
  select 
    p.email,
    p.subscription_tier,
    coalesce(count(*) filter (where sa.event_type = 'activation'), 0) as activations,
    coalesce(count(*) filter (where sa.event_type = 'cancellation'), 0) as cancellations,
    coalesce(count(*) filter (where sa.event_type = 'upgrade'), 0) as upgrades,
    coalesce(count(*) filter (where sa.event_type = 'downgrade'), 0) as downgrades,
    max(sa.created_at) as last_change
  from profiles p
  left join subscription_audit sa on sa.user_id = p.id
  group by p.email, p.subscription_tier
  order by last_change desc nulls last, p.email;
end;
$$ language plpgsql;
