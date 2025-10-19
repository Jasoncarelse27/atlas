-- Fix RLS policies for usage_logs table
-- This allows both authenticated users and service role to insert logs

alter table usage_logs enable row level security;

-- Drop existing policies if they exist
drop policy if exists "Users can insert own usage logs" on usage_logs;
drop policy if exists "Service role can insert usage logs" on usage_logs;
drop policy if exists "Users can view own usage logs" on usage_logs;

-- Policy 1: Users can insert their own usage logs
create policy "Users can insert own usage logs"
on usage_logs for insert
with check (auth.uid() = user_id);

-- Policy 2: Service role can insert any usage logs
create policy "Service role can insert usage logs"
on usage_logs for insert
to service_role
with check (true);

-- Policy 3: Users can view their own usage logs
create policy "Users can view own usage logs"
on usage_logs for select
using (auth.uid() = user_id);

-- Verify policies are created
select tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'usage_logs';
