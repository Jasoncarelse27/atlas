-- Apply attachments status migration directly to Supabase
-- Run this in the Supabase SQL Editor

-- Add status and updated_at fields to attachments table for retry functionality
alter table attachments 
add column if not exists status text default 'pending' check (status in ('pending', 'sent', 'failed')),
add column if not exists updated_at timestamptz default now();

-- Create index for efficient querying of pending uploads
create index if not exists idx_attachments_status on attachments(status) where status = 'pending';

-- Update the updated_at timestamp when status changes
create or replace function update_attachments_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Drop trigger if it exists and recreate
drop trigger if exists trigger_update_attachments_updated_at on attachments;
create trigger trigger_update_attachments_updated_at
  before update on attachments
  for each row
  execute function update_attachments_updated_at();

-- Verify the changes
select column_name, data_type, is_nullable, column_default 
from information_schema.columns 
where table_name = 'attachments' 
order by ordinal_position;
