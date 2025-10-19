-- Voice Call + Supabase RLS Final Fix
-- This fixes the schema cache issue causing "Could not find 'created_at' column"

-- ✅ Enable RLS for safety
alter table usage_logs enable row level security;

-- ✅ Allow authenticated users to write their own logs
drop policy if exists "Users can insert own usage logs" on usage_logs;
create policy "Users can insert own usage logs"
on usage_logs for insert
with check (auth.uid() = user_id);

-- ✅ Allow service key inserts (for backend proxy)
drop policy if exists "Service role can insert usage logs" on usage_logs;
create policy "Service role can insert usage logs"
on usage_logs for insert
to service_role
with check (true);

-- ✅ Read access for user's own data
drop policy if exists "Users can view own usage logs" on usage_logs;
create policy "Users can view own usage logs"
on usage_logs for select
using (auth.uid() = user_id);

-- ✅ CRITICAL: Force schema cache refresh to fix "missing created_at" error
comment on table usage_logs is 'force schema refresh v2';

-- Verify the fix worked
select column_name, data_type 
from information_schema.columns 
where table_name = 'usage_logs' 
and table_schema = 'public'
order by ordinal_position;
