drop table if exists webhook_logs cascade;

create table webhook_logs (
  id serial primary key,
  event_type text not null,
  payload jsonb not null,
  received_at timestamp default now()
);

-- Index for faster filtering by event_type
create index if not exists idx_webhook_logs_event_type 
  on webhook_logs(event_type);

-- Index for ordering queries by received_at
create index if not exists idx_webhook_logs_received_at 
  on webhook_logs(received_at desc);
