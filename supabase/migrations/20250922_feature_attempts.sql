-- Migration: Create feature_attempts table
-- This table tracks when users attempt to use features beyond their tier
-- Used for analytics and conversion funnel tracking

create table if not exists feature_attempts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  feature text not null,
  tier text not null,
  created_at timestamptz default now()
);

-- Enable RLS
alter table feature_attempts enable row level security;

-- Create policies
create policy "Users can view own feature attempts" on feature_attempts
  for select using (auth.uid() = user_id);

create policy "Service role can manage all feature attempts" on feature_attempts
  for all using (auth.role() = 'service_role');

-- Grant permissions
grant all on feature_attempts to authenticated;
grant all on feature_attempts to service_role;

-- Create index for performance
create index if not exists idx_feature_attempts_user_id on feature_attempts(user_id);
create index if not exists idx_feature_attempts_created_at on feature_attempts(created_at);
create index if not exists idx_feature_attempts_tier on feature_attempts(tier);
create index if not exists idx_feature_attempts_feature on feature_attempts(feature);
