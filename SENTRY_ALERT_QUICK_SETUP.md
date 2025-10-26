# 🔔 SENTRY ALERT QUICK SETUP GUIDE

## ✅ Alert 1: High Error Rate (CRITICAL)

**Purpose:** Get notified when errors spike

**Settings:**
- **Alert Name:** `High Error Rate - Production`
- **When:** An event is seen
- **Frequency:** At least 10 times in 1 hour
- **Environment:** production
- **Action:** Send email notification
- **Priority:** Critical

**Why:** Catches major issues affecting users

---

## ⚠️ Alert 2: New Error Type (WARNING)

**Purpose:** Know when new bugs appear

**Settings:**
- **Alert Name:** `New Error Detected - Production`
- **When:** An issue is first seen
- **Environment:** production
- **Action:** Send email notification
- **Priority:** Warning

**Why:** Catches new bugs from recent deploys

---

## 🐌 Alert 3: Slow Performance (INFO)

**Purpose:** Track performance degradation

**Settings:**
- **Alert Name:** `Slow API Performance`
- **When:** Transaction duration exceeds 5 seconds
- **Frequency:** At least 5 times in 10 minutes
- **Environment:** production
- **Action:** Send email notification
- **Priority:** Info

**Why:** Prevents user experience degradation

---

## 🎯 QUICK SETUP STEPS:

1. Go to: https://otium-creations.sentry.io/alerts/rules/
2. Click "Create Alert"
3. Select "Issues"
4. Copy settings from Alert 1 above
5. Click "Save Rule"
6. Repeat for Alerts 2 & 3

---

## 📧 EMAIL vs SLACK:

### Email (Easiest):
- No setup required
- Automatically uses your Sentry account email
- Good for solo developers

### Slack (Better for Teams):
- Requires Slack workspace integration
- Real-time notifications in channel
- Better for team collaboration

**Setup Slack (Optional):**
1. Go to: https://otium-creations.sentry.io/settings/integrations/
2. Find "Slack"
3. Click "Add to Slack"
4. Choose channel (e.g., #alerts)
5. Update alert actions to use Slack

---

## ✅ VERIFY ALERTS WORK:

### Test Alert:
1. Deploy a test error to production
2. Wait 2-3 minutes
3. Check email/Slack for notification
4. Verify alert fired correctly

### Or Use Sentry Test:
1. In alert settings, click "Send Test Alert"
2. Check email immediately
3. Confirm you received it

---

## 🎉 SUCCESS CRITERIA:

You're done when:
- ✅ At least 1 alert rule created
- ✅ Email notifications configured
- ✅ Test alert received
- ✅ You feel confident you'll be notified

---

## 💡 PRO TIPS:

1. **Start Conservative:** 10 errors/hour prevents noise
2. **Adjust After Launch:** Lower threshold if too quiet
3. **Use Filters:** Only production environment
4. **Test First:** Send test alerts before going live

---

## 🚨 COMMON MISTAKES TO AVOID:

❌ Setting threshold too low (1 error = spam)
❌ Alerting on development environment
❌ Not testing alerts before launch
❌ Forgetting to add yourself as recipient

✅ Use recommended settings above
✅ Only monitor production
✅ Test with "Send Test Alert"
✅ Confirm email in alert settings

---

**Time to complete: 5 minutes for all 3 alerts**

