# 🧪 Testing API Cost Protection - Quick Guide

**Date:** January 8, 2025  
**Status:** Ready to Test

---

## 🚀 **QUICK START**

### **1. Start Your Development Server**

```bash
# Option 1: Use your script
./atlas-start.sh

# Option 2: Use npm
npm run start:dev

# Option 3: Separate terminals
npm run backend:dev  # Terminal 1 (port 8000)
npm run dev          # Terminal 2 (port 5174)
```

**Backend URL:** `http://localhost:8000`  
**Frontend URL:** `http://localhost:5174`

---

## ✅ **TEST 1: Budget Ceiling Enforcement**

### **Test Emergency Kill Switch ($250/day)**

**Method 1: Manual Database Update (Quick Test)**
```sql
-- In Supabase SQL Editor:
-- Set today's total spend to $250+ to trigger kill switch
UPDATE budget_tracking 
SET total_spend = 250.00 
WHERE date = CURRENT_DATE;
```

**Then try sending a message:**
```bash
curl -X POST http://localhost:8000/api/message \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "test"}'
```

**Expected Result:**
```json
{
  "error": "BUDGET_LIMIT_EXCEEDED",
  "message": "Atlas is temporarily unavailable. Please try again later.",
  "tier": "free"
}
```

**Status Code:** `429 Too Many Requests`

---

### **Test Tier Budget Ceiling**

**Free Tier ($20/day):**
```sql
-- Set free tier spend to $20+
UPDATE budget_tracking 
SET total_spend = 20.00 
WHERE date = CURRENT_DATE AND tier = 'free';
```

**Then send message as free tier user:**
```bash
curl -X POST http://localhost:8000/api/message \
  -H "Authorization: Bearer FREE_USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"message": "test"}'
```

**Expected Result:**
```json
{
  "error": "BUDGET_LIMIT_EXCEEDED",
  "message": "Daily usage reached. Upgrade to Core for extended access.",
  "tier": "free"
}
```

---

## ✅ **TEST 2: Crisis Bypass Rate Limiting**

### **Test Crisis Bypass (10/day limit)**

**Step 1: Send 10 crisis messages:**
```bash
# Send 10 messages with crisis keywords
for i in {1..10}; do
  curl -X POST http://localhost:8000/api/message \
    -H "Authorization: Bearer YOUR_JWT_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"message\": \"I am in crisis and need help immediately\"}"
  echo "Message $i sent"
done
```

**Step 2: Try 11th crisis message:**
```bash
curl -X POST http://localhost:8000/api/message \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "I am in crisis emergency help"}'
```

**Expected Result:**
```json
{
  "canProceed": false,
  "reason": "crisis_limit_exceeded",
  "message": "Crisis bypass limit reached. Please contact emergency services: 988 or text HOME to 741741"
}
```

**Check Logs:**
```bash
# Check backend logs for:
grep "crisis_bypass_limit_exceeded" backend/logs/*.log
```

---

## ✅ **TEST 3: Fail-Closed Behavior**

### **Test Database Outage Scenario**

**Method: Temporarily break Supabase connection:**
```javascript
// In backend/services/budgetCeilingService.mjs (temporary test)
function getSupabaseClient() {
  return null; // Force failure
}
```

**Then send message:**
```bash
curl -X POST http://localhost:8000/api/message \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "test"}'
```

**Expected Result:**
```json
{
  "error": "BUDGET_LIMIT_EXCEEDED",
  "message": "Service temporarily unavailable. Please try again later.",
  "tier": "free"
}
```

**Status Code:** `429 Too Many Requests`

**✅ PASS:** Blocks access instead of allowing unlimited spending

---

## ✅ **TEST 4: Cost Tracking**

### **Verify Spend Recording**

**Step 1: Send a message:**
```bash
curl -X POST http://localhost:8000/api/message \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, this is a test message"}'
```

**Step 2: Check budget_tracking table:**
```sql
-- In Supabase SQL Editor:
SELECT * FROM budget_tracking 
WHERE date = CURRENT_DATE 
ORDER BY updated_at DESC 
LIMIT 5;
```

**Expected Result:**
- `total_spend` should increase
- `request_count` should increment
- `tier` should match user's tier

**Step 3: Check logs:**
```bash
# Backend should log:
grep "recording spend" backend/logs/*.log
# Should see: [BudgetCeiling] Recorded spend for tier: free, cost: 0.00XX
```

---

## 🎯 **QUICK TEST CHECKLIST**

### **5-Minute Smoke Test:**

- [ ] **Budget Ceiling:** Set spend to $250, try message → Should block
- [ ] **Crisis Bypass:** Send 11 crisis messages → 11th should block
- [ ] **Cost Tracking:** Send message → Check `budget_tracking` table
- [ ] **Fail-Closed:** Break Supabase → Should block, not allow

---

## 🔍 **MONITORING & VERIFICATION**

### **Check Backend Logs:**

```bash
# Watch logs in real-time
tail -f backend/logs/*.log | grep -E "BudgetCeiling|BUDGET_LIMIT|recording spend"

# Or check Railway logs (if deployed)
railway logs
```

### **Check Database:**

```sql
-- View today's budget tracking
SELECT tier, total_spend, request_count, updated_at 
FROM budget_tracking 
WHERE date = CURRENT_DATE;

-- View crisis bypass logs
SELECT * FROM usage_logs 
WHERE event = 'crisis_bypass_activated' 
AND timestamp >= CURRENT_DATE
ORDER BY timestamp DESC;
```

### **Check Frontend:**

1. Open `http://localhost:5174`
2. Try sending message when budget exceeded
3. Should see error toast: "Daily usage limit reached..."
4. Check browser console for error details

---

## 🧪 **AUTOMATED TEST SCRIPT**

**Create `test-cost-protection.sh`:**

```bash
#!/bin/bash

# Test Budget Ceiling Enforcement
echo "🧪 Testing Budget Ceiling..."

# Set budget to exceeded
curl -X POST http://localhost:8000/api/test/set-budget \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"tier": "free", "spend": 25.00}'

# Try to send message
RESPONSE=$(curl -s -X POST http://localhost:8000/api/message \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "test"}')

if echo "$RESPONSE" | grep -q "BUDGET_LIMIT_EXCEEDED"; then
  echo "✅ PASS: Budget ceiling enforced"
else
  echo "❌ FAIL: Budget ceiling not enforced"
fi

# Reset budget
curl -X POST http://localhost:8000/api/test/reset-budget \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## 📍 **WHERE TO TEST**

### **Local Development:**
- **Backend:** `http://localhost:8000`
- **Frontend:** `http://localhost:5174`
- **Supabase:** Your project dashboard

### **Staging (if deployed):**
- **Backend:** `https://your-app.railway.app`
- **Frontend:** `https://your-app.vercel.app`
- **Supabase:** Production database

### **Production (after launch):**
- Monitor via:
  - Supabase dashboard (budget_tracking table)
  - Railway logs
  - Sentry alerts (if configured)

---

## 🚨 **QUICK VERIFICATION COMMANDS**

### **Check if Budget Service is Active:**
```bash
# Should see budget check in logs
curl -X POST http://localhost:8000/api/message \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message": "test"}' \
  -v 2>&1 | grep -i "budget"
```

### **Check Crisis Bypass Count:**
```sql
SELECT COUNT(*) as crisis_count
FROM usage_logs
WHERE event = 'crisis_bypass_activated'
AND data->>'userId' = 'YOUR_USER_ID'
AND timestamp >= CURRENT_DATE;
```

### **Check Current Budget Status:**
```sql
SELECT tier, total_spend, 
       CASE 
         WHEN total_spend >= 250 THEN 'EMERGENCY'
         WHEN total_spend >= 150 THEN 'HIGH_TRAFFIC'
         ELSE 'NORMAL'
       END as status
FROM budget_tracking
WHERE date = CURRENT_DATE;
```

---

## ✅ **EXPECTED BEHAVIOR SUMMARY**

| Test | Expected Behavior | Status Code |
|------|------------------|-------------|
| Budget Exceeded | Block request | 429 |
| Crisis Limit (11th) | Block request | 400/429 |
| Database Error | Block request | 429 |
| Normal Message | Allow + Record cost | 200 |

---

**Ready to test?** Start with the 5-minute smoke test above! 🚀

