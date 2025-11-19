# Atlas Billing System Setup Checklist

## ✅ Step 1: Database Migrations (COMPLETE)

You've successfully run all 4 migrations:
- ✅ `billing_periods` table
- ✅ `usage_snapshots` table  
- ✅ `overage_charges` table
- ✅ `upsert_usage_snapshot()` function

**Verify**: Run the verification query in Supabase SQL Editor:
```sql
-- Copy and paste the contents of: supabase/migrations/20251119_verify_billing_tables.sql
```

---

## 🔧 Step 2: FastSpring Product Setup (REQUIRED)

### Create `atlas-usage-overage` Product

1. **Go to FastSpring Dashboard**: https://app.fastspring.com
2. **Navigate**: Catalog → Products → Add Product
3. **Product Details**:
   ```
   Product Name: Atlas Usage Overage
   Product ID: atlas-usage-overage
   Product Type: One-time (NOT subscription)
   Price: Variable (will be set per order)
   Currency: USD
   ```
4. **Important Settings**:
   - ✅ Enable "Variable Pricing" or "Custom Pricing"
   - ✅ Set fulfillment type: "Digital" or "None" (no physical product)
   - ✅ Enable "Allow custom pricing" if available
5. **Save** the product

**Why**: The billing system creates one-time orders for overages using this product ID.

---

## ⚙️ Step 3: Environment Variables (VERIFY)

### Backend (Railway)

Ensure these are set in Railway environment variables:

```bash
# FastSpring (should already exist)
FASTSPRING_API_USERNAME=your_username
FASTSPRING_API_PASSWORD=your_password
FASTSPRING_STORE_ID=otiumcreations_store

# Internal Secret (NEW - for cron job)
INTERNAL_SECRET=your_random_secret_here
# OR use existing:
RAILWAY_INTERNAL_SECRET=your_existing_secret
```

**Generate INTERNAL_SECRET**:
```bash
# Run this in terminal:
openssl rand -hex 32
```

### Supabase Edge Function

If using Supabase cron, set in Supabase Dashboard → Project Settings → Edge Functions:

```bash
INTERNAL_SECRET=your_random_secret_here
BACKEND_URL=https://atlas-production-2123.up.railway.app
```

---

## 📅 Step 4: Configure Cron Job

### Option A: Supabase Edge Function Cron (Recommended)

1. **Deploy Edge Function**:
   ```bash
   # From project root
   supabase functions deploy billing-cycle
   ```

2. **Set Environment Variables** (see Step 3)

3. **Create Cron Job**:
   - Go to Supabase Dashboard → Database → Cron Jobs
   - Click "New Cron Job"
   - **Name**: `billing-cycle`
   - **Schedule**: `0 2 * * *` (2 AM UTC daily)
   - **Function**: `billing-cycle`
   - **Headers**: Leave empty (cron jobs don't send auth)

### Option B: Railway Cron (Alternative)

1. **Create Railway Cron**:
   - Go to Railway Dashboard → Your Project → New → Cron Job
   - **Schedule**: `0 2 * * *` (2 AM UTC daily)
   - **Command**: 
     ```bash
     curl -X POST https://atlas-production-2123.up.railway.app/internal/billing/run-overage-cycle \
       -H "Authorization: Bearer $INTERNAL_SECRET"
     ```

---

## 🧪 Step 5: Test the System

### Test 1: Verify Usage Logging

1. **Send a test message** in Atlas chat
2. **Check Supabase**:
   ```sql
   -- Check usage_logs (should have new entry)
   SELECT * FROM usage_logs 
   ORDER BY created_at DESC 
   LIMIT 5;
   
   -- Check usage_snapshots (should auto-create)
   SELECT * FROM usage_snapshots 
   ORDER BY created_at DESC 
   LIMIT 5;
   
   -- Check billing_periods (should auto-create)
   SELECT * FROM billing_periods 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```

### Test 2: Test Billing Summary API

```bash
# Get your auth token from browser DevTools → Application → Local Storage → supabase.auth.token
curl https://atlas-production-2123.up.railway.app/api/billing/summary \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

**Expected Response**:
```json
{
  "period": { "start": "...", "end": "..." },
  "tier": "studio",
  "includedCreditsUsd": 149.99,
  "usedCreditsUsd": 0,
  "remainingCreditsUsd": 149.99,
  "models": [],
  "overage": { "totalOverageUsd": 0, "charges": [] }
}
```

### Test 3: Test Billing Dashboard (Frontend)

1. **Navigate**: https://your-frontend-url.com/billing
2. **Verify**: You see the billing dashboard with:
   - Included Usage section
   - On-Demand Usage section
   - Invoices section

### Test 4: Manual Billing Cycle (Optional)

```bash
# Test the billing cycle manually
curl -X POST https://atlas-production-2123.up.railway.app/internal/billing/run-overage-cycle \
  -H "Authorization: Bearer YOUR_INTERNAL_SECRET" \
  -H "Content-Type: application/json"
```

**Expected Response**:
```json
{
  "success": true,
  "results": {
    "processedUsers": 1,
    "chargesCreated": 0,
    "chargesProcessed": 0
  }
}
```

---

## 🚨 Troubleshooting

### Issue: "FastSpring product not found"

**Solution**: 
- Verify `atlas-usage-overage` product exists in FastSpring
- Check product ID matches exactly (case-sensitive)

### Issue: "INTERNAL_SECRET not configured"

**Solution**:
- Set `INTERNAL_SECRET` in Railway environment variables
- Restart Railway service after adding variable

### Issue: "Billing period not created"

**Solution**:
- Check user has `subscription_tier` set in `profiles` table
- Verify RLS policies allow inserts to `billing_periods`

### Issue: "Usage not aggregating"

**Solution**:
- Check `logTokenUsage()` is being called (check backend logs)
- Verify `upsert_usage_snapshot()` function exists and is callable
- Check Postgres logs for function errors

---

## ✅ Completion Checklist

- [ ] All 4 migrations run successfully
- [ ] Verification query confirms tables/functions exist
- [ ] FastSpring `atlas-usage-overage` product created
- [ ] `INTERNAL_SECRET` environment variable set
- [ ] Cron job configured (Supabase or Railway)
- [ ] Test message creates usage log
- [ ] Test message creates usage snapshot
- [ ] Billing summary API returns data
- [ ] Billing dashboard loads at `/billing`
- [ ] Manual billing cycle test succeeds

---

## 📚 Next Steps After Setup

1. **Monitor Usage**: Check `usage_snapshots` daily to verify aggregation
2. **Test Overage**: Create test overage scenario (use >$149.99 for Studio tier)
3. **Verify FastSpring**: Check FastSpring dashboard for test orders
4. **Set Up Alerts**: Monitor billing cycle logs for errors
5. **Add MailerLite**: Implement email notifications (Phase 5 - optional)

---

## 🆘 Need Help?

- Check logs: Railway → Deployments → Logs
- Check Supabase: Dashboard → Logs → Postgres Logs
- Review documentation: `ATLAS_BILLING_CURSOR_STYLE.md`

