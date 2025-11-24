# FastSpring Payment Integration Setup Guide

**Status:** ⏳ Pending 2FA Verification  
**Priority:** High - Blocks Real Revenue  
**Estimated Setup Time:** 15-30 minutes

---

## 📋 Overview

Atlas uses FastSpring for subscription payment processing. This guide will help you complete the setup once you have access to your FastSpring account.

**Current State:**
- ✅ FastSpring integration code implemented
- ✅ Webhook handlers ready
- ✅ Tier enforcement logic in place
- ⏳ **Credentials pending** (blocked by 2FA)
- ⏳ Products need to be created in FastSpring dashboard

---

## 🔑 Step 1: Get Your FastSpring Credentials

### 1.1 Access Your FastSpring Account
1. Log in to [FastSpring Dashboard](https://dashboard.fastspring.com/)
2. Complete 2FA verification if required
3. Navigate to **Settings** → **API Credentials**

### 1.2 Generate API Credentials
You need three pieces of information:

1. **Store ID**
   - Found in: Settings → Store → Store Information
   - Format: `your-store-name`
   
2. **API Key** (Private Key)
   - Found in: Settings → API Credentials → Private Key
   - Click "Create New Private Key" if none exists
   - ⚠️ **Save this immediately - it's only shown once!**
   - Format: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

3. **Webhook Secret**
   - Found in: Settings → Webhooks → Webhook Secret
   - Click "Generate New Secret" if needed
   - Format: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

---

## 🛍️ Step 2: Create Products in FastSpring

### 2.1 Create Atlas Core Product
1. Go to **Products** → **Add Product**
2. Fill in details:
   ```
   Product Name: Atlas Core Monthly
   Product ID: atlas-core-monthly
   Price: $19.99 USD
   Billing Frequency: Monthly
   Trial Period: None (or 7 days if offering trial)
   ```

3. Set fulfillment type: **Subscription**
4. Enable recurring billing

### 2.2 Create Atlas Studio Product
1. Go to **Products** → **Add Product**
2. Fill in details:
   ```
   Product Name: Atlas Studio Monthly
   Product ID: atlas-studio-monthly
   Price: $149.99 USD
   Billing Frequency: Monthly
   Trial Period: None (or 7 days if offering trial)
   ```

3. Set fulfillment type: **Subscription**
4. Enable recurring billing

### 2.3 Product IDs to Use
Make sure your product IDs match these exactly:
- Core: `atlas-core-monthly`
- Studio: `atlas-studio-monthly`

(Or update the env variables to match your chosen IDs)

---

## ⚙️ Step 3: Configure Environment Variables

### 3.1 Update Local .env File
Replace the `__PENDING__` placeholders in your `.env` file:

```bash
# FastSpring Integration (Live API)
VITE_FASTSPRING_ENVIRONMENT=live
VITE_FASTSPRING_STORE_ID=your-actual-store-id
VITE_FASTSPRING_API_KEY=your-actual-api-key
VITE_FASTSPRING_WEBHOOK_SECRET=your-actual-webhook-secret
VITE_FASTSPRING_CORE_PRODUCT_ID=atlas-core-monthly
VITE_FASTSPRING_STUDIO_PRODUCT_ID=atlas-studio-monthly

# Backend FastSpring Configuration
FASTSPRING_API_KEY=your-actual-api-key
FASTSPRING_STORE_ID=your-actual-store-id
FASTSPRING_WEBHOOK_SECRET=your-actual-webhook-secret
```

### 3.2 Update Production Environment
Update your Railway/hosting environment variables with the same values.

**Railway:**
```bash
railway variables set VITE_FASTSPRING_STORE_ID="your-store-id"
railway variables set VITE_FASTSPRING_API_KEY="your-api-key"
railway variables set VITE_FASTSPRING_WEBHOOK_SECRET="your-webhook-secret"
railway variables set FASTSPRING_API_KEY="your-api-key"
railway variables set FASTSPRING_STORE_ID="your-store-id"
railway variables set FASTSPRING_WEBHOOK_SECRET="your-webhook-secret"
```

---

## 🔗 Step 4: Configure Webhooks

### 4.1 Set Webhook URL
1. In FastSpring Dashboard, go to **Settings** → **Webhooks**
2. Add webhook endpoint:
   ```
   URL: https://your-backend-url.railway.app/webhooks/fastspring
   Events: Select all subscription events
   ```

3. Enable these events:
   - `subscription.activated`
   - `subscription.charge.completed`
   - `subscription.charge.failed`
   - `subscription.canceled`
   - `subscription.deactivated`
   - `subscription.trial.ended`

### 4.2 Test Webhook
FastSpring provides a "Test Webhook" button - use it to verify your endpoint is working.

---

## ✅ Step 5: Validation Checklist

Run through this checklist to verify everything works:

### Backend Validation
```bash
# Check if credentials are loaded
npm run backend

# Look for this in logs:
# ✅ FastSpring configured (Live mode)
# ❌ WARNING: FastSpring credentials missing
```

### Frontend Validation
```bash
# Start dev server
npm run dev

# Navigate to Settings → Upgrade
# Click "Upgrade to Core" or "Upgrade to Studio"
# Should redirect to FastSpring checkout
```

### Test Checkout Flow
1. Navigate to upgrade modal
2. Select a tier (Core or Studio)
3. Click "Upgrade Now"
4. Should open FastSpring Popup Checkout
5. Use FastSpring test card (if in test mode):
   ```
   Card: 4111 1111 1111 1111
   Expiry: Any future date
   CVV: Any 3 digits
   ```

### Test Webhook Receipt
1. Complete a test purchase
2. Check backend logs for webhook event:
   ```
   ✅ [FastSpring Webhook] Received: subscription.activated
   ✅ [FastSpring] User tier updated: core
   ```

---

## 🐛 Troubleshooting

### Issue: "FastSpring credentials pending"
**Solution:** Update all `__PENDING__` values in `.env` with real credentials

### Issue: Checkout doesn't open
**Check:**
1. Are environment variables set correctly?
2. Is `VITE_FASTSPRING_STORE_ID` correct?
3. Is `VITE_FASTSPRING_ENVIRONMENT` set to `live` or `test`?

### Issue: Webhook not received
**Check:**
1. Is webhook URL correct in FastSpring dashboard?
2. Is webhook secret matching in `.env` and FastSpring?
3. Are webhook events enabled?
4. Check Railway logs for errors

### Issue: Payment succeeds but tier doesn't update
**Check:**
1. Webhook secret validation
2. Database connection from webhook handler
3. Check `profiles` table for `subscription_tier` column

---

## 🔒 Security Notes

1. **Never commit real credentials to git**
   - Use `.env` (already in `.gitignore`)
   - Use environment variables in production

2. **Webhook Secret Validation**
   - Already implemented in `backend/routes/webhooks.js`
   - Rejects unsigned webhook requests

3. **API Key Protection**
   - Keep FastSpring API key on backend only
   - Never expose in frontend code

---

## 📊 Post-Setup Monitoring

After setup, monitor:

1. **Payment Success Rate**
   - Check FastSpring dashboard analytics
   - Look for failed payments

2. **Webhook Delivery**
   - FastSpring shows webhook delivery status
   - Failed webhooks need manual retry

3. **Tier Sync**
   - Verify users get correct tier after payment
   - Check `profiles.subscription_tier` in database

---

## 📞 Support

**FastSpring Support:**
- Email: support@fastspring.com
- Docs: https://docs.fastspring.com/

**Atlas Team:**
- Check logs in Railway dashboard
- Review `CRITICAL_ISSUES_SCAN_REPORT.md` for known issues

---

## ✨ Success Indicators

You'll know setup is complete when:

- ✅ No "PENDING" warnings in backend logs
- ✅ Upgrade button opens FastSpring checkout
- ✅ Test purchase completes successfully
- ✅ User tier updates in database after payment
- ✅ Webhooks show "200 OK" in FastSpring dashboard

---

**Last Updated:** October 25, 2025  
**Status:** Ready for credentials input

