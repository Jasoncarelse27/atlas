# 🧪 Testing API Cost Protection on Vercel Production

**Date:** January 8, 2025  
**Environment:** Production (Real Scenarios)  
**Frontend:** `https://atlas-xi-tawny.vercel.app`  
**Backend:** `https://atlas-production-2123.up.railway.app`

---

## 🚀 **QUICK START**

### **1. Deploy Fixes to Production**

```bash
# Commit your changes
git add .
git commit -m "feat: Add API cost protection (budget ceilings, crisis bypass limits, fail-closed)"

# Deploy to Vercel (frontend)
npm run deploy

# Backend auto-deploys via Railway (on git push)
git push origin main
```

**Wait 2-3 minutes** for deployments to complete.

---

## ✅ **TEST 1: Budget Ceiling (Production Database)**

### **Step 1: Access Production Supabase**

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Open **SQL Editor**

### **Step 2: Set Budget to Exceeded**

```sql
-- Trigger emergency kill switch ($250/day)
UPDATE budget_tracking 
SET total_spend = 250.00 
WHERE date = CURRENT_DATE;

-- Or trigger tier budget ceiling (Free: $20/day)
UPDATE budget_tracking 
SET total_spend = 20.00 
WHERE date = CURRENT_DATE AND tier = 'free';
```

### **Step 3: Test on Production**

1. Open `https://atlas-xi-tawny.vercel.app`
2. Sign in with a test account
3. Try sending a message

**Expected Result:**
- Error toast: "Daily usage limit reached. Upgrade to Core for extended access."
- Network tab shows: `429 Too Many Requests`
- Response: `{"error": "BUDGET_LIMIT_EXCEEDED", ...}`

### **Step 4: Verify in Logs**

**Railway Backend Logs:**
```bash
# Via Railway Dashboard → Logs
# Or via CLI:
railway logs | grep -i "budget\|BUDGET_LIMIT"
```

**Expected Log:**
```
[Message] Budget limit exceeded for free tier user abc-123
```

---

## ✅ **TEST 2: Crisis Bypass Rate Limiting**

### **Step 1: Test on Production Frontend**

1. Open `https://atlas-xi-tawny.vercel.app`
2. Sign in
3. Send 11 messages with crisis keywords:
   - "I am in crisis"
   - "This is an emergency"
   - "I need help immediately"
   - (repeat 11 times)

### **Step 2: Verify 11th Message is Blocked**

**Expected Behavior:**
- Messages 1-10: ✅ Sent successfully
- Message 11: ❌ Blocked with error

**Check Browser Console:**
```javascript
// Should see error:
{
  canProceed: false,
  reason: "crisis_limit_exceeded",
  message: "Crisis bypass limit reached. Please contact emergency services: 988..."
}
```

### **Step 3: Verify in Database**

```sql
-- Check crisis bypass count for your user
SELECT COUNT(*) as crisis_count
FROM usage_logs
WHERE event = 'crisis_bypass_activated'
AND data->>'userId' = 'YOUR_USER_ID'
AND timestamp >= CURRENT_DATE;
```

**Expected:** Should show 10 (11th was blocked)

---

## ✅ **TEST 3: Cost Tracking (Real Production)**

### **Step 1: Send Normal Messages**

1. Open `https://atlas-xi-tawny.vercel.app`
2. Send 5-10 normal messages
3. Wait 30 seconds for processing

### **Step 2: Check Budget Tracking**

```sql
-- View today's spend
SELECT tier, total_spend, request_count, updated_at 
FROM budget_tracking 
WHERE date = CURRENT_DATE
ORDER BY updated_at DESC;
```

**Expected:**
- `total_spend` should increase with each message
- `request_count` should increment
- `updated_at` should show recent timestamps

### **Step 3: Verify Cost Calculation**

```sql
-- Check estimated costs match
SELECT 
  tier,
  total_spend,
  request_count,
  ROUND(total_spend / NULLIF(request_count, 0), 4) as avg_cost_per_request
FROM budget_tracking 
WHERE date = CURRENT_DATE;
```

**Expected Average Costs:**
- Free (Haiku): ~$0.0001-0.0003 per message
- Core (Sonnet): ~$0.003-0.01 per message
- Studio (Opus): ~$0.03-0.10 per message

---

## ✅ **TEST 4: Fail-Closed Behavior**

### **Test Database Outage Scenario**

**Method: Temporarily break Supabase connection in Railway:**

1. Go to Railway Dashboard → Your Service → Variables
2. Temporarily change `SUPABASE_URL` to invalid value:
   ```
   SUPABASE_URL=https://invalid-url.supabase.co
   ```
3. Railway will auto-restart

**Then test:**
1. Open `https://atlas-xi-tawny.vercel.app`
2. Try sending a message

**Expected Result:**
- ❌ Request blocked (not allowed)
- Error: "Service temporarily unavailable. Please try again later."
- Status: `429 Too Many Requests`

**✅ PASS:** Blocks access instead of allowing unlimited spending

**Restore:**
- Change `SUPABASE_URL` back to correct value
- Railway will auto-restart

---

## 🎯 **PRODUCTION TEST CHECKLIST**

### **Before Testing:**
- [ ] Deploy fixes to Vercel (`npm run deploy`)
- [ ] Verify backend deployed on Railway (check logs)
- [ ] Confirm production Supabase database access

### **Budget Protection Tests:**
- [ ] Emergency kill switch ($250/day) - Blocks all requests
- [ ] Tier budget ceiling (Free $20/day) - Blocks free tier
- [ ] High traffic threshold ($150/day) - Blocks free, allows paid

### **Crisis Bypass Tests:**
- [ ] First 10 crisis messages - ✅ Allowed
- [ ] 11th crisis message - ❌ Blocked
- [ ] Crisis logs recorded in `usage_logs` table

### **Cost Tracking Tests:**
- [ ] Send message → `budget_tracking` updates
- [ ] Cost calculated correctly (tokens × model cost)
- [ ] Spend recorded per tier

### **Fail-Closed Tests:**
- [ ] Database error → Blocks access (not allow)
- [ ] Budget service error → Blocks access (not allow)

---

## 🔍 **MONITORING PRODUCTION**

### **Real-Time Monitoring:**

**1. Railway Backend Logs:**
```bash
# Via Railway Dashboard → Logs
# Or CLI:
railway logs --tail
```

**Watch for:**
- `Budget limit exceeded` - Budget ceiling triggered
- `recording spend` - Cost tracking working
- `crisis_bypass_limit_exceeded` - Crisis abuse prevented

**2. Supabase Dashboard:**
- **Table:** `budget_tracking` - Real-time spend tracking
- **Table:** `usage_logs` - Crisis bypass logs
- **Table:** `daily_usage` - Per-user usage tracking

**3. Vercel Analytics:**
- Check deployment status
- Monitor error rates
- Check build logs

---

## 🧪 **PRODUCTION TEST SCENARIOS**

### **Scenario 1: Normal Usage**
1. Sign in as Free tier user
2. Send 5 messages
3. **Verify:** All messages sent, costs tracked, no blocks

### **Scenario 2: Budget Exceeded**
1. Set budget to $20 in Supabase (Free tier)
2. Sign in as Free tier user
3. Try sending message
4. **Verify:** Blocked with upgrade prompt

### **Scenario 3: Crisis Abuse Prevention**
1. Sign in as any tier user
2. Send 11 messages with "emergency" keyword
3. **Verify:** 11th message blocked, first 10 allowed

### **Scenario 4: High Traffic**
1. Set total spend to $150+ in Supabase
2. Sign in as Free tier user
3. Try sending message
4. **Verify:** Blocked (high traffic, upgrade prompt)
5. Sign in as Core/Studio tier user
6. Try sending message
7. **Verify:** Allowed (paid tier priority)

---

## 📊 **VERIFICATION QUERIES**

### **Check Current Budget Status:**
```sql
SELECT 
  tier,
  total_spend,
  request_count,
  CASE 
    WHEN total_spend >= 250 THEN 'EMERGENCY_SHUTOFF'
    WHEN total_spend >= 150 THEN 'HIGH_TRAFFIC'
    WHEN total_spend >= 20 AND tier = 'free' THEN 'TIER_LIMIT'
    ELSE 'NORMAL'
  END as status
FROM budget_tracking
WHERE date = CURRENT_DATE
ORDER BY total_spend DESC;
```

### **Check Crisis Bypass Usage:**
```sql
SELECT 
  data->>'userId' as user_id,
  COUNT(*) as crisis_count,
  MAX(timestamp) as last_crisis
FROM usage_logs
WHERE event = 'crisis_bypass_activated'
AND timestamp >= CURRENT_DATE
GROUP BY data->>'userId'
HAVING COUNT(*) >= 10
ORDER BY crisis_count DESC;
```

### **Check Cost Per User:**
```sql
SELECT 
  user_id,
  tier,
  conversations_count,
  total_tokens_used,
  api_cost_estimate,
  ROUND(api_cost_estimate / NULLIF(conversations_count, 0), 4) as cost_per_message
FROM daily_usage
WHERE date = CURRENT_DATE
ORDER BY api_cost_estimate DESC
LIMIT 20;
```

---

## 🚨 **SAFETY NOTES**

### **Before Testing Budget Limits:**

⚠️ **WARNING:** Setting budget to $250 will block ALL users temporarily!

**Safe Testing Approach:**
1. Test with **tier-specific limits** first (Free: $20)
2. Test **crisis bypass** (doesn't affect normal users)
3. Test **emergency kill switch** last (blocks everyone)

### **Reset After Testing:**

```sql
-- Reset budget tracking after tests
UPDATE budget_tracking 
SET total_spend = 0, request_count = 0
WHERE date = CURRENT_DATE;

-- Or reset specific tier
UPDATE budget_tracking 
SET total_spend = 0, request_count = 0
WHERE date = CURRENT_DATE AND tier = 'free';
```

---

## ✅ **QUICK PRODUCTION TEST**

**5-Minute Real-World Test:**

1. **Deploy:** `npm run deploy` (wait 2 min)
2. **Set Budget:** Update `budget_tracking` in Supabase (Free: $20)
3. **Test:** Open Vercel URL → Send message → Should block
4. **Verify:** Check Railway logs for "Budget limit exceeded"
5. **Reset:** Set budget back to $0

**Expected:** All protections working in production! 🚀

---

**Your Production URLs:**
- **Frontend:** `https://atlas-xi-tawny.vercel.app`
- **Backend:** `https://atlas-production-2123.up.railway.app`
- **Supabase:** Your project dashboard

**Ready to test in production!** 🎯

