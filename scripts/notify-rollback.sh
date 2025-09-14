#!/usr/bin/env bash
set -euo pipefail

# Inputs (env)
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
CICD_ALERT_URL="${CICD_ALERT_URL:-}"
CICD_ALERT_TOKEN="${CICD_ALERT_TOKEN:-}"
RECIPIENTS="${RECIPIENTS:-admin@otiumcreations.com,rima@otiumcreations.com}"

STATUS="${1:-}"            # STARTED | SUCCEEDED | FAILED
ENV_NAME="${2:-production}" # production | staging
REASON="${3:-N/A}"

# GitHub context (optional)
REPO="${GITHUB_REPOSITORY:-unknown}"
RUN_ID="${GITHUB_RUN_ID:-0}"
SHA="${GITHUB_SHA:-unknown}"
ACTOR="${GITHUB_ACTOR:-unknown}"
WF_URL="https://github.com/${REPO}/actions/runs/${RUN_ID}"

ts() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

payload_text="🛑 *Atlas Rollback ${STATUS}*\n• *Env:* ${ENV_NAME}\n• *By:* ${ACTOR}\n• *Reason:* ${REASON}\n• *SHA:* ${SHA}\n• *Workflow:* ${WF_URL}\n• *Time (UTC):* $(ts)"

json_escape() {
  python - <<'PY' "$1"
import json,sys; print(json.dumps(sys.argv[1]))
PY
}

# --- Slack notification ---
if [[ -n "${SLACK_WEBHOOK_URL}" ]]; then
  curl -sS -X POST "$SLACK_WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "{\"text\": $(json_escape "$payload_text")}" >/dev/null || echo "Slack notify failed (non-blocking)"
fi

# --- Email via Supabase Edge Function (cicd-alert) ---
# Expects CICD_ALERT_URL (https://.../functions/v1/cicd-alert) and CICD_ALERT_TOKEN (Bearer)
if [[ -n "${CICD_ALERT_URL}" && -n "${CICD_ALERT_TOKEN}" ]]; then
  curl -sS -X POST "$CICD_ALERT_URL" \
    -H "Authorization: Bearer ${CICD_ALERT_TOKEN}" \
    -H "Content-Type: application/json" \
    -d @- >/dev/null <<JSON || echo "Email alert failed (non-blocking)"
{
  "subject": "Atlas DB ROLLBACK ${STATUS} (${ENV_NAME})",
  "message": ${payload_text@Q},
  "recipients": ${RECIPIENTS@Q}
}
JSON
fi

echo "Notifications dispatched for status=${STATUS}, env=${ENV_NAME}"
