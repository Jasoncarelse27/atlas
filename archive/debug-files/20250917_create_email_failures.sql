-- Migration: Create email_failures table
-- Description: Stores permanent log of all failed email delivery attempts

create table if not exists public.email_failures (
  id uuid primary key default gen_random_uuid(),
  recipient text not null,
  template text not null,
  error_message text not null,
  created_at timestamptz default now()
);

-- Indexes for faster queries
create index if not exists idx_email_failures_recipient
  on public.email_failures (recipient);

create index if not exists idx_email_failures_template
  on public.email_failures (template);

create index if not exists idx_email_failures_created_at
  on public.email_failures (created_at desc);
