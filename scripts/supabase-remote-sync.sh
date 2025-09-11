#!/usr/bin/env bash
set -euo pipefail

# === CONFIG ===
BACKUP_DIR="supabase/backups"
BACKUP_FILE="$BACKUP_DIR/atlas-ai_$(date +%Y%m%d_%H%M%S).sql"
COST_CAP=400   # Hard cutoff USD
ALERT_THRESHOLD=300  # Alert level before cutoff

mkdir -p "$BACKUP_DIR"

mode="${1:-sync}"

# === FUNCTIONS ===

send_alert () {
  local message="$1"
  echo "⚠️ ALERT: $message"
  # Optionally send via webhook/email
  # curl -X POST -H "Content-Type: application/json" -d "{\"text\":\"$message\"}" $ALERT_WEBHOOK
}

do_sync () {
  echo "🔄 Running remote Supabase sync..."

  # 1. Dump remote schema
  PGPASSWORD=$(echo $SUPABASE_DB_URL | sed -E 's/.*:([a-zA-Z0-9]+)@.*/\1/') \
  pg_dump "$SUPABASE_DB_URL" > "$BACKUP_FILE"

  echo "✅ Backup created at $BACKUP_FILE"

  # 2. Upload to Supabase Storage
  supabase storage upload backups/$(basename "$BACKUP_FILE") "$BACKUP_FILE" --public \
    --project-ref "$SUPABASE_PROJECT_REF" || echo "⚠️ Upload skipped or failed."

  echo "✅ Uploaded to Supabase Storage (if available)."

  # 3. Pull latest schema
  supabase db pull --project-ref "$SUPABASE_PROJECT_REF" || {
    echo "❌ Failed to pull schema"
    exit 1
  }

  echo "✅ Schema pulled successfully"
}

do_monitor () {
  echo "📊 Checking usage costs..."

  # Fetch total usage for this month
  COST=$(psql "$SUPABASE_DB_URL" -t -c \
    "select coalesce(sum(cost),0) from usage_log where date_trunc('month', created_at) = date_trunc('month', now());")

  COST=$(echo $COST | xargs) # trim spaces
  echo "💵 Current spend this month: $COST"

  # Alerts
  if (( $(echo "$COST > $ALERT_THRESHOLD" | bc -l) )); then
    send_alert "Spend has exceeded $ALERT_THRESHOLD USD. Current: $COST"
  fi

  # Hard cutoff
  if (( $(echo "$COST > $COST_CAP" | bc -l) )); then
    echo "🚨 Spend exceeds $COST_CAP. Downgrading Studio users to Core."
    supabase db query "update users set subscription_tier = 'core' where subscription_tier = 'studio';" \
      --project-ref "$SUPABASE_PROJECT_REF"
    send_alert "Studio tier disabled due to hard cap. Current spend: $COST"
  fi
}

# === MAIN ===
case "$mode" in
  sync)
    do_sync
    ;;
  monitor)
    do_monitor
    ;;
  *)
    echo "Usage: $0 [sync|monitor]"
    exit 1
    ;;
esac