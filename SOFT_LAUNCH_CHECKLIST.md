# 🚀 **ATLAS SOFT LAUNCH CHECKLIST**

## 🎯 **Pre-Launch Setup**

### **1. 📊 Database Migration**
```bash
# Apply the report runs migration
cd /Users/jasoncarelse/atlas
psql "$DATABASE_URL" -f supabase/migrations/20250920_report_runs_table.sql
```

### **2. 🔧 Environment Configuration**
Add to Railway production environment:
```bash
# Weekly Reports
ENABLE_WEEKLY_REPORTS=true
REPORT_TO=jasonc.jpg@gmail.com,admin@atlas.app

# SMTP Configuration (if using email reports)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Admin Security (already configured)
ADMIN_EMAIL_ALLOWLIST=jasonc.jpg@gmail.com,admin@atlas.app
```

### **3. 🧪 Create Test Users**
```bash
cd /Users/jasoncarelse/atlas
node scripts/create-test-users.mjs
```
**Expected Result:** 11 test users created (8 free, 2 core, 1 studio)

---

## 🧪 **SOFT LAUNCH TESTING SEQUENCE**

### **Step 1: Verify Free Tier Enforcement (15-message cap)**

**Test Users:** `test-free-1@atlas-demo.com` through `test-free-8@atlas-demo.com`

**Test Process:**
1. **Simulate 14 messages** for a free user:
```sql
-- Run in Supabase SQL Editor
SELECT increment_usage(
  (SELECT id FROM auth.users WHERE email = 'test-free-1@atlas-demo.com'),
  'free',
  0.05
);
-- Repeat 14 times or use a loop
```

2. **Verify enforcement at 15 messages:**
```sql
-- This should PASS (at limit)
SELECT enforce_tier_budget(
  (SELECT id FROM auth.users WHERE email = 'test-free-1@atlas-demo.com'),
  'free'
);

-- Add one more message
SELECT increment_usage(
  (SELECT id FROM auth.users WHERE email = 'test-free-1@atlas-demo.com'),
  'free',
  0.05
);

-- This should FAIL with "Daily message limit reached"
SELECT enforce_tier_budget(
  (SELECT id FROM auth.users WHERE email = 'test-free-1@atlas-demo.com'),
  'free'
);
```

**✅ Success Criteria:**
- Free users blocked exactly at 16th message
- Error message: "Daily message limit reached for tier free"
- Cost tracking accurate (15 × $0.05 = $0.75)

---

### **Step 2: Validate Core Tier (Unlimited + Sonnet routing)**

**Test Users:** `test-core-1@atlas-demo.com`, `test-core-2@atlas-demo.com`

**Test Process:**
1. **Simulate high usage** (50+ messages):
```sql
-- Run multiple increments for core user
DO $$
BEGIN
  FOR i IN 1..50 LOOP
    PERFORM increment_usage(
      (SELECT id FROM auth.users WHERE email = 'test-core-1@atlas-demo.com'),
      'core',
      0.15  -- Higher cost for Sonnet
    );
  END LOOP;
END $$;
```

2. **Verify no message limits:**
```sql
-- Should always PASS for core tier (no daily message limit)
SELECT enforce_tier_budget(
  (SELECT id FROM auth.users WHERE email = 'test-core-1@atlas-demo.com'),
  'core'
);
```

**✅ Success Criteria:**
- Core users can send unlimited messages
- Only blocked when approaching $100 budget ceiling
- Model selection: Haiku for simple, Sonnet for emotional content

---

### **Step 3: Validate Studio Tier (Opus routing for complex prompts)**

**Test User:** `test-studio-1@atlas-demo.com`

**Test Process:**
1. **Test complex message routing:**
```bash
# Test via API (if available)
curl -X POST "https://atlas-production-2123.up.railway.app/message" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <STUDIO_USER_TOKEN>" \
  -d '{
    "message": "I need a comprehensive analysis of my emotional patterns and long-term strategy for improving my mental health with detailed breakdown of multiple factors",
    "tier": "studio",
    "userId": "<STUDIO_USER_ID>"
  }'
```

2. **Verify Opus model selection:**
- Complex messages (>100 words, contains "comprehensive", "analysis", "detailed") should route to Claude Opus
- Simple messages should still use Haiku for cost efficiency

**✅ Success Criteria:**
- Studio users get Opus for complex analysis
- Budget ceiling at $80 (optimized for quality)
- All model types available (Haiku/Sonnet/Opus)

---

### **Step 4: Export CSV for Last 7 Days**

**Admin Test:**
```bash
# Export all snapshots from last 7 days
curl -H "Authorization: Bearer <ADMIN_TOKEN>" \
  "https://atlas-production-2123.up.railway.app/api/admin/snapshots/export.csv?startDate=2025-09-13&endDate=2025-09-20" \
  -o soft_launch_test.csv

# Verify CSV content
head -20 soft_launch_test.csv
```

**✅ Success Criteria:**
- CSV contains all test users with their usage data
- Headers: `snapshot_date,email,tier,message_count,cost_accumulated,daily_limit,budget_ceiling,status,created_at`
- Free users show "BLOCKED - Daily Limit" status when over 15 messages
- Core/Studio users show "ACTIVE" status under budget ceilings

---

### **Step 5: Force Weekly Report (Manual Trigger)**

**Admin Test:**
```bash
# Trigger manual weekly report
curl -X POST "https://atlas-production-2123.up.railway.app/api/admin/reports/weekly/run" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"startDate": "2025-09-13", "endDate": "2025-09-20"}'
```

**✅ Success Criteria:**
- Report generated successfully
- CSV stored in Supabase Storage at `reports/weekly/atlas_weekly_report_2025-09-13_to_2025-09-20.csv`
- Email sent to configured recipients (if SMTP configured)
- Entry logged in `report_runs` table

---

## 📊 **VALIDATION QUERIES**

### **Check All Test Users:**
```sql
SELECT 
  u.email,
  p.subscription_tier,
  tu.message_count,
  tu.cost_accumulated,
  CASE 
    WHEN tu.message_count >= 15 AND p.subscription_tier = 'free' THEN 'BLOCKED'
    ELSE 'ACTIVE'
  END as expected_status
FROM auth.users u
JOIN user_profiles p ON u.id = p.id
LEFT JOIN tier_usage tu ON u.id = tu.user_id
WHERE u.email LIKE '%atlas-demo.com%'
ORDER BY p.subscription_tier, u.email;
```

### **Check Tier Distribution:**
```sql
SELECT 
  subscription_tier,
  COUNT(*) as user_count
FROM user_profiles 
WHERE email LIKE '%atlas-demo.com%'
GROUP BY subscription_tier;
```

### **Check Recent Snapshots:**
```sql
SELECT 
  snapshot_date,
  tier,
  COUNT(*) as users,
  AVG(message_count) as avg_messages,
  SUM(cost_accumulated) as total_cost
FROM tier_usage_snapshots
WHERE email LIKE '%atlas-demo.com%'
  AND snapshot_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY snapshot_date, tier
ORDER BY snapshot_date DESC, tier;
```

---

## 🎯 **SUCCESS CRITERIA SUMMARY**

### **✅ Tier Enforcement Working:**
- [ ] Free users blocked at exactly 15 messages
- [ ] Core users unlimited messages, $100 budget ceiling
- [ ] Studio users unlimited messages, $80 budget ceiling

### **✅ Model Routing Working:**
- [ ] Free tier: Haiku only
- [ ] Core tier: Haiku + Sonnet (intelligent selection)
- [ ] Studio tier: Haiku + Sonnet + Opus (complexity-based)

### **✅ Monitoring & Reporting:**
- [ ] CSV export with date range filtering
- [ ] Weekly reports generated and stored
- [ ] Admin analytics dashboard functional
- [ ] Usage snapshots capturing data correctly

### **✅ Security & Access:**
- [ ] Admin endpoints protected by email allowlist
- [ ] Only authorized emails can access admin features
- [ ] Test users cannot access admin endpoints

---

## 🚀 **POST-LAUNCH MONITORING**

### **Daily Checks:**
1. **Monitor tier usage** via admin dashboard
2. **Check for budget ceiling breaches**
3. **Verify weekly reports are running** (Mondays 08:00 UTC)
4. **Review cost accumulation trends**

### **Weekly Reviews:**
1. **Analyze upgrade conversion** (Free → Core → Studio)
2. **Review cost optimization** (cache hit rates, model selection)
3. **Check system performance** (response times, error rates)
4. **Validate data integrity** (snapshots, usage tracking)

---

## 🎉 **LAUNCH READY CRITERIA**

**Atlas is ready for soft launch when:**
- ✅ All 5 test steps pass completely
- ✅ Tier enforcement working for all tiers
- ✅ CSV exports and reports functional
- ✅ Admin security properly configured
- ✅ Monitoring and analytics operational

**🚀 Once validated, Atlas can safely onboard real users with confidence in the tier system!**
