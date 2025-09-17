-- Test email_failures table functionality
-- Run this in Supabase SQL Editor after applying the migration

-- Insert a fake email failure
insert into email_failures (recipient, template, error_message)
values (
  'testuser@example.com',
  'welcome',
  'Simulated error: API timeout'
);

-- Insert another test failure
insert into email_failures (recipient, template, error_message)
values (
  'another@example.com',
  'upgrade',
  'Simulated error: Invalid template ID'
);

-- Verify the rows were inserted
select * from email_failures
order by created_at desc
limit 5;

-- Test query by recipient
select * from email_failures
where recipient = 'testuser@example.com';

-- Test query by template
select * from email_failures
where template = 'welcome';

-- Test query by date range (last 24 hours)
select * from email_failures
where created_at >= now() - interval '24 hours';
