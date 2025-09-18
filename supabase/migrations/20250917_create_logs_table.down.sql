-- Rollback for logs table

-- Drop policies
drop policy if exists "Allow inserts with service role" on logs;

-- Drop table
drop table if exists logs;
