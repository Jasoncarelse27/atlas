-- Trigger Edge Function on new feature_attempts insert
create or replace function notify_feature_attempt()
returns trigger as $$
begin
  perform (
    select
      pg_notify('feature_attempts_channel', row_to_json(NEW)::text)
  );
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists feature_attempts_trigger on feature_attempts;

create trigger feature_attempts_trigger
after insert on feature_attempts
for each row
execute function notify_feature_attempt();
