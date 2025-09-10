#!/usr/bin/env bash
set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="supabase/backups/atlas-ai_${TIMESTAMP}.sql"

# --- Backup section ---
echo "📥 Dumping remote database directly..."
pg_dump $SUPABASE_DB_URL --no-owner --no-privileges > "$BACKUP_FILE"

echo "☁️ Uploading to Supabase Storage..."
supabase storage upload backups/$(basename "$BACKUP_FILE") "$BACKUP_FILE" --project-ref $SUPABASE_PROJECT_REF --public || true

# --- Cost monitoring section ---
echo "📊 Checking usage spend..."
MONTHLY_SPEND=$(supabase db query "select coalesce(sum(cost),0) from usage_log where date_trunc('month', created_at) = date_trunc('month', now());" --project-ref $SUPABASE_PROJECT_REF | grep -Eo '[0-9]+(\.[0-9]+)?' | head -n 1)

echo "💰 Current spend this month: \$${MONTHLY_SPEND}"

# Hard cap (example: $400)
HARD_CAP=400
if (( $(echo "$MONTHLY_SPEND > $HARD_CAP" | bc -l) )); then
  echo "⛔ Spend cap exceeded (\$${MONTHLY_SPEND} > \$${HARD_CAP}). Cutting off Studio tier..."
  supabase db query "update users set subscription_tier = 'core' where subscription_tier = 'studio';" --project-ref $SUPABASE_PROJECT_REF
  echo "✅ Studio users downgraded to Core to protect budget."
else
  echo "✅ Spend under control. No cutoff required."
fi

echo "🎉 Remote backup + cost monitoring completed: $BACKUP_FILE"