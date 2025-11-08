# 🧪 Tier Testing Guide - API Cost Protection

**Date:** January 8, 2025  
**Environment:** Production (Vercel)  
**What to Test:** Tier enforcement, budget limits, crisis bypass, cost tracking

---

## 🎯 **What We're Testing**

After the API cost protection updates, you need to verify:

1. ✅ **Budget Ceilings** - Each tier has spending limits that block access when exceeded
2. ✅ **Crisis Bypass Limits** - Emergency messages limited to 10/day per user
3. ✅ **Fail-Closed Design** - System blocks access on errors (not allow unlimited spending)
4. ✅ **Cost Tracking** - API spend is recorded accurately per tier
5. ✅ **Message Length Limits** - Tier-aware character limits enforced

---

## 📋 **TEST 1: Free Tier Budget Ceiling ($20/day)**

### **Setup:**
1. Set Free tier budget to exceeded in Supabase:
```sql
UPDATE budget_tracking 
SET total_spend = 20.00 
WHERE date = CURRENT_DATE AND tier = 'free';
```

### **Test:**
1. Open `https://atlas-xi-tawny.vercel.app`
2. Sign in as a **Free tier** user
3. Try sending a normal message

### **Expected Result:**
- ❌ **Message blocked** with error toast
- Error: "Daily usage limit reached. Upgrade to Core for extended access."
- Network tab shows: `429 Too Many Requests`
- Response: `{"error": "BUDGET_LIMIT_EXCEEDED", ...}`

### **Verify in Logs:**
```bash
# Railway backend logs should show:
railway logs | grep -i "budget\|BUDGET_LIMIT"
# Expected: "Budget limit exceeded for free tier user..."
```

### **Reset After Test:**
```sql
UPDATE budget_tracking 
SET total_spend = 0 
WHERE date = CURRENT_DATE AND tier = 'free';
```

---

## 📋 **TEST 2: Core Tier Budget Ceiling ($50/day)**

### **Setup:**
```sql
UPDATE budget_tracking 
SET total_spend = 50.00 
WHERE date = CURRENT_DATE AND tier = 'core';
```

### **Test:**
1. Sign in as a **Core tier** user
2. Try sending a message

### **Expected Result:**
- ❌ **Message blocked** (Core tier also has limits)
- Error: "Daily usage limit reached. Upgrade to Studio for extended access."

### **Reset:**
```sql
UPDATE budget_tracking 
SET total_spend = 0 
WHERE date = CURRENT_DATE AND tier = 'core';
```

---

## 📋 **TEST 3: Studio Tier Budget Ceiling ($200/day)**

### **Setup:**
```sql
UPDATE budget_tracking 
SET total_spend = 200.00 
WHERE date = CURRENT_DATE AND tier = 'studio';
```

### **Test:**
1. Sign in as a **Studio tier** user
2. Try sending a message

### **Expected Result:**
- ❌ **Message blocked** (even Studio has limits)
- Error: "Daily usage limit reached. Please try again tomorrow."

### **Reset:**
```sql
UPDATE budget_tracking 
SET total_spend = 0 
WHERE date = CURRENT_DATE AND tier = 'studio';
```

---

## 📋 **TEST 4: Emergency Kill Switch ($250/day total)**

### **Setup:**
```sql
-- Set total daily spend to $250+ (blocks ALL users)
UPDATE budget_tracking 
SET total_spend = 250.00 
WHERE date = CURRENT_DATE;
```

### **Test:**
1. Try signing in as **any tier** user
2. Try sending a message

### **Expected Result:**
- ❌ **ALL users blocked** (emergency kill switch)
- Error: "Service temporarily unavailable. Please try again later."

### **Reset:**
```sql
UPDATE budget_tracking 
SET total_spend = 0 
WHERE date = CURRENT_DATE;
```

---

## 📋 **TEST 5: Crisis Bypass Rate Limiting (10/day)**

### **Setup:**
No setup needed - test with real user

### **Test:**
1. Sign in as **any tier** user
2. Send **11 messages** with crisis keywords:
   - "I am in crisis"
   - "This is an emergency"
   - "I need help immediately"
   - "I'm having a mental health emergency"
   - (repeat 11 times)

### **Expected Result:**
- Messages 1-10: ✅ **Sent successfully** (crisis bypass works)
- Message 11: ❌ **Blocked** (rate limit exceeded)

### **Verify in Database:**
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

## 📋 **TEST 6: Cost Tracking (Real Production)**

### **Setup:**
Reset budget tracking:
```sql
UPDATE budget_tracking 
SET total_spend = 0, request_count = 0
WHERE date = CURRENT_DATE;
```

### **Test:**
1. Sign in as **Free tier** user
2. Send **5 normal messages** (not crisis keywords)
3. Wait 30 seconds for processing

### **Verify Cost Tracking:**
```sql
-- Check today's spend
SELECT tier, total_spend, request_count, updated_at 
FROM budget_tracking 
WHERE date = CURRENT_DATE
ORDER BY updated_at DESC;
```

### **Expected Result:**
- `total_spend` should **increase** with each message
- `request_count` should **increment**
- `updated_at` should show **recent timestamps**

### **Verify Cost Calculation:**
```sql
-- Check average cost per message
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

## 📋 **TEST 7: Message Length Limits (Tier-Aware)**

### **Test Free Tier (2000 char limit):**
1. Sign in as **Free tier** user
2. Try sending a message with **2001+ characters**

### **Expected Result:**
- ❌ **Message blocked** client-side
- Error toast: "Message too long (X characters). Limit for your free tier is 2,000."

### **Test Core Tier (4000 char limit):**
1. Sign in as **Core tier** user
2. Try sending a message with **4001+ characters**

### **Expected Result:**
- ❌ **Message blocked**
- Error: "Limit for your core tier is 4,000."

### **Test Studio Tier (8000 char limit):**
1. Sign in as **Studio tier** user
2. Try sending a message with **8001+ characters**

### **Expected Result:**
- ❌ **Message blocked**
- Error: "Limit for your studio tier is 8,000."

---

## 📋 **TEST 8: Fail-Closed Behavior (Database Outage)**

### **Setup:**
Temporarily break Supabase connection in Railway:
1. Railway Dashboard → Your Service → Variables
2. Change `SUPABASE_URL` to invalid value:
   ```
   SUPABASE_URL=https://invalid-url.supabase.co
   ```
3. Railway will auto-restart

### **Test:**
1. Open `https://atlas-xi-tawny.vercel.app`
2. Try sending a message

### **Expected Result:**
- ❌ **Request blocked** (not allowed)
- Error: "Service temporarily unavailable. Please try again later."
- Status: `429 Too Many Requests`

### **✅ PASS:** Blocks access instead of allowing unlimited spending

### **Restore:**
- Change `SUPABASE_URL` back to correct value
- Railway will auto-restart

---

## 📋 **TEST 9: High Traffic Threshold ($150/day)**

### **Setup:**
```sql
-- Set total spend to $150+ (blocks Free tier, allows paid)
UPDATE budget_tracking 
SET total_spend = 150.00 
WHERE date = CURRENT_DATE;
```

### **Test:**
1. Sign in as **Free tier** user → Try sending message
2. Sign in as **Core/Studio tier** user → Try sending message

### **Expected Result:**
- Free tier: ❌ **Blocked** (high traffic, upgrade prompt)
- Core/Studio: ✅ **Allowed** (paid tier priority)

### **Reset:**
```sql
UPDATE budget_tracking 
SET total_spend = 0 
WHERE date = CURRENT_DATE;
```

---

## ✅ **Quick Test Checklist**

### **Before Testing:**
- [ ] Deploy fixes to Vercel (`npm run deploy`)
- [ ] Verify backend deployed on Railway
- [ ] Confirm production Supabase database access

### **Budget Protection Tests:**
- [ ] Free tier limit ($20/day) - Blocks Free users
- [ ] Core tier limit ($50/day) - Blocks Core users
- [ ] Studio tier limit ($200/day) - Blocks Studio users
- [ ] Emergency kill switch ($250/day) - Blocks ALL users
- [ ] High traffic threshold ($150/day) - Blocks Free, allows paid

### **Crisis Bypass Tests:**
- [ ] First 10 crisis messages - ✅ Allowed
- [ ] 11th crisis message - ❌ Blocked
- [ ] Crisis logs recorded in `usage_logs` table

### **Cost Tracking Tests:**
- [ ] Send message → `budget_tracking` updates
- [ ] Cost calculated correctly (tokens × model cost)
- [ ] Spend recorded per tier

### **Message Length Tests:**
- [ ] Free tier: 2000 char limit enforced
- [ ] Core tier: 4000 char limit enforced
- [ ] Studio tier: 8000 char limit enforced

### **Fail-Closed Tests:**
- [ ] Database error → Blocks access (not allow)
- [ ] Budget service error → Blocks access (not allow)

---

## 🎯 **Priority Tests (Must Pass)**

1. **Free Tier Budget Ceiling** - Most important (prevents financial loss)
2. **Crisis Bypass Limit** - Prevents abuse
3. **Cost Tracking** - Ensures accurate billing
4. **Fail-Closed Behavior** - Prevents unlimited spending during outages

---

## 📊 **Monitoring During Tests**

### **Railway Backend Logs:**
```bash
railway logs --tail | grep -i "budget\|BUDGET_LIMIT\|crisis\|spend"
```

**Watch for:**
- `Budget limit exceeded` - Budget ceiling triggered ✅
- `recording spend` - Cost tracking working ✅
- `crisis_bypass_limit_exceeded` - Crisis abuse prevented ✅

### **Supabase Dashboard:**
- **Table:** `budget_tracking` - Real-time spend tracking
- **Table:** `usage_logs` - Crisis bypass logs
- **Table:** `daily_usage` - Per-user usage tracking

---

## 🚨 **Safety Notes**

⚠️ **WARNING:** Setting budget to $250 will block ALL users temporarily!

**Safe Testing Approach:**
1. Test **tier-specific limits** first (Free: $20)
2. Test **crisis bypass** (doesn't affect normal users)
3. Test **emergency kill switch** last (blocks everyone)

**Always reset after testing:**
```sql
UPDATE budget_tracking 
SET total_spend = 0, request_count = 0
WHERE date = CURRENT_DATE;
```

---

**Your Production URLs:**
- **Frontend:** `https://atlas-xi-tawny.vercel.app`
- **Backend:** `https://atlas-production-2123.up.railway.app`
- **Supabase:** Your project dashboard

**Ready to test!** 🚀

