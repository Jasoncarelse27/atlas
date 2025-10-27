# 🎯 FASTSPRING CREDENTIALS - FINAL UPDATE GUIDE

## ✅ What We Have:
- **Store ID**: otiumcreations_store
- **API Username**: LM9ZFMOCRDILZM-6VRCQ7G
- **API Password**: 8Xg1uWWESCOwZO1X27bThw (NEW - use this one!)
- **Webhook Secret**: ⚠️ STILL NEEDED

## 📝 Manual Update Required:

### Step 1: Update `.env` file

Open `/Users/jasoncarelse/atlas/.env` and replace these lines:

```bash
# OLD (remove these):
VITE_FASTSPRING_API_USERNAME=LM9ZFMOCRDILZM-6VRCQ7G
VITE_FASTSPRING_API_PASSWORD=Ga_yvenaSj-33Uz_WP42sg
FASTSPRING_API_USERNAME=LM9ZFMOCRDILZM-6VRCQ7G
FASTSPRING_API_PASSWORD=Ga_yvenaSj-33Uz_WP42sg

# NEW (add these):
VITE_FASTSPRING_API_KEY=LM9ZFMOCRDILZM-6VRCQ7G:8Xg1uWWESCOwZO1X27bThw
FASTSPRING_API_KEY=LM9ZFMOCRDILZM-6VRCQ7G:8Xg1uWWESCOwZO1X27bThw
```

Also fix product IDs:
```bash
# Change:
VITE_FASTSPRING_CORE_PRODUCT_ID=atlas-core
VITE_FASTSPRING_STUDIO_PRODUCT_ID=atlas-studio

# To:
VITE_FASTSPRING_CORE_PRODUCT_ID=atlas-core-monthly
VITE_FASTSPRING_STUDIO_PRODUCT_ID=atlas-studio-monthly
```

### Step 2: Get Webhook Secret

1. Go to FastSpring: https://app.fastspring.com/app/custom.xml?mRef=BasicStoreSite:F326HWZSERBUU
2. Click **Developer Tools** → **Webhooks**
3. Click **"Edit Webhook Details"** button
4. Look for **"HMAC Secret"** or **"Webhook Secret"**
5. Copy that value

### Step 3: Update Webhook Secret in .env

Replace both occurrences of `PENDING_WEBHOOK_SECRET` with the actual secret:

```bash
VITE_FASTSPRING_WEBHOOK_SECRET=your_actual_webhook_secret_here
FASTSPRING_WEBHOOK_SECRET=your_actual_webhook_secret_here
```

### Step 4: Do the same for `.env.production`

Repeat all changes in `/Users/jasoncarelse/atlas/.env.production`

---

## 🚀 After Updates:

Run this to verify:
```bash
cd /Users/jasoncarelse/atlas
grep "FASTSPRING" .env | grep -v "^#"
```

Then test locally:
```bash
npm run dev
# Click "Upgrade to Core" - should open real FastSpring checkout
```

---

## ⚠️ CRITICAL: Product IDs Must Match

In FastSpring Catalog, create products with these EXACT IDs:
- `atlas-core-monthly` ($19.99/month)
- `atlas-studio-monthly` ($189.99/month)

---

**Next Action:** Go get the webhook secret from FastSpring, then manually update both `.env` files!

