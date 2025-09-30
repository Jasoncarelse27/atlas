-- Feature flags table
create table if not exists feature_flags (
  id uuid primary key default gen_random_uuid(),
  tier text not null,
  feature text not null,
  allowed boolean not null,
  created_at timestamp default now()
);

-- Feature attempts table
create table if not exists feature_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  feature text not null,
  attempts int default 0,
  created_at timestamp default now()
);

-- Seed defaults
insert into feature_flags (tier, feature, allowed) values
  ('free', 'text', true),
  ('free', 'audio', false),
  ('free', 'image', false),
  ('core', 'text', true),
  ('core', 'audio', true),
  ('core', 'image', true),
  ('studio', 'text', true),
  ('studio', 'audio', true),
  ('studio', 'image', true)
on conflict do nothing;
