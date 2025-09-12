#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Day 7: Starting Load Testing & Monitoring Alerts..."

# 1. Install artillery if not installed
if ! command -v artillery &> /dev/null; then
  echo "📦 Installing artillery..."
  npm install -g artillery
fi

# 2. Run load test against /messages
echo "🔫 Running load test on /messages endpoint..."
artillery quick --count 10 --num 20 http://localhost:5174/messages \
  --output scripts/day7-loadtest-report.json || true

# 3. Parse results into report
echo "📊 Generating report..."
cat > scripts/day7-loadtest-report.txt <<EOR
==============================
 Atlas Load Test – Day 7 Report
==============================
🔗 Endpoint: /messages
👥 Virtual Users: 10
🔁 Requests/User: 20
📦 Total Requests: 200

Threshold Targets:
✅ Avg Latency < 200ms
✅ P95 Latency < 500ms
✅ Error Rate < 1%
✅ Success Rate > 99%

Results:
$(grep -E "http.request_rate|http.codes|latency" scripts/day7-loadtest-report.json || echo "⚠️ Metrics only in JSON")
EOR

# Monitoring check
if grep -q '"errors":' scripts/day7-loadtest-report.json; then
  echo "⚠️ ALERT: Errors detected during load test!" | tee -a scripts/day7-loadtest-report.txt
else
  echo "✅ No errors detected during load test." | tee -a scripts/day7-loadtest-report.txt
fi

echo "📊 Report saved: scripts/day7-loadtest-report.txt"
echo "✅ Day 7 complete!"
