-- Create email_failures table for tracking failed email sends
create table if not exists email_failures (
  id uuid primary key default gen_random_uuid(),
  recipient text not null,
  template text not null,
  error_message text not null,
  created_at timestamptz default now()
);

-- Index for faster lookups by recipient
create index if not exists idx_email_failures_recipient on email_failures(recipient);

-- Index for faster lookups by template
create index if not exists idx_email_failures_template on email_failures(template);

-- Index for faster lookups by date
create index if not exists idx_email_failures_created_at on email_failures(created_at);
