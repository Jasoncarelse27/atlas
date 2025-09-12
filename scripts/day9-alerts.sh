#!/usr/bin/env bash
set -euo pipefail

echo "📧 Day 9: Starting Email & Engagement Alerts..."

# 1. Parse monitoring + loadtest logs
LOADTEST_LOG="scripts/day7-loadtest-report.txt"
MONITOR_LOG="scripts/day8-monitoring-alerts.log"
ALERT_LOG="scripts/day9-alerts.log"

echo "🔎 Checking logs for threshold breaches..."
{
  echo "==============================="
  echo " Day 9 – Email & Engagement Alerts"
  echo "==============================="
  date
  echo
} > "$ALERT_LOG"

# 2. Threshold checks
LATENCY_BREACH=$(grep -E "latency.*[2-9][0-9]{2,}" "$LOADTEST_LOG" || true)
ERRORS=$(grep -i "error" "$MONITOR_LOG" || true)

if [[ -n "$LATENCY_BREACH" ]] || [[ -n "$ERRORS" ]]; then
  echo "⚠️ Threshold breach detected!" | tee -a "$ALERT_LOG"
  ALERT_BODY="Atlas Alert: Thresholds breached. Review logs."
else
  echo "✅ No threshold breaches detected." | tee -a "$ALERT_LOG"
  ALERT_BODY="Atlas is healthy. No issues detected."
fi

# 3. Send MailerLite alert (stub – replace with API if needed)
echo "📤 Sending MailerLite email alert (simulated)..." | tee -a "$ALERT_LOG"
echo "EMAIL BODY: $ALERT_BODY" | tee -a "$ALERT_LOG"

# 4. Wrap up
echo "📊 Logs written to $ALERT_LOG"
echo "✅ Day 9: Email & Engagement Alerts complete!"
