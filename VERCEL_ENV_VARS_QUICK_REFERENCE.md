# 🚀 Vercel Environment Variables - Quick Reference

## ✅ **FastSpring Variables** (Add to Vercel → Settings → Environment Variables)

### **From FastSpring Dashboard:**

1. **`VITE_FASTSPRING_STORE_ID`**
   - Value: `otiumcreations_store` ✅ (visible in your dashboard)
   - Location: FastSpring Dashboard → Top-right corner

2. **`VITE_FASTSPRING_API_KEY`**
   - Value: Get from FastSpring Dashboard → Settings → API Credentials → Private Key
   - Format: `username:password` (e.g., `LM9ZFMOCRDILZM-6VRCQ7G:8Xg1uWWESCOwZO1X27bThw`)
   - ⚠️ **Save immediately - only shown once!**

3. **`VITE_FASTSPRING_WEBHOOK_SECRET`**
   - Value: Get from FastSpring Dashboard → Settings → Webhooks → Webhook Secret
   - Format: Long random string

4. **`VITE_FASTSPRING_ENVIRONMENT`**
   - Value: `live` (for production)
   - Set manually (not from dashboard)

### **Product IDs** (Already configured in code, but verify):
- `VITE_FASTSPRING_CORE_PRODUCT_ID=atlas-core-monthly`
- `VITE_FASTSPRING_STUDIO_PRODUCT_ID=atlas-studio-monthly`

---

## 🌐 **Frontend URL**

**`VITE_FRONTEND_URL`**
- Value: Your Vercel production URL
- Example: `https://atlas-xi-tawny.vercel.app`
- Or your custom domain if configured

---

## 🎤 **Voice V2 Variables** (If using voice features)

**`VITE_VOICE_V2_ENABLED`**
- Value: `true` (if using voice features)
- Set manually

**`VITE_VOICE_V2_URL`**
- Value: Your WebSocket server URL
- Example: `wss://atlas-voice-v2.fly.dev`
- Or your deployed WebSocket server URL

---

## 📝 **Step-by-Step: Add to Vercel**

1. Go to: https://vercel.com/dashboard
2. Click your **Atlas project**
3. Go to **Settings** → **Environment Variables**
4. Click **"+ Add"** for each variable above
5. Select **"Production"** environment
6. Paste the value
7. Click **"Save"**
8. **Redeploy** your project (Vercel will auto-redeploy, or manually trigger)

---

## ✅ **Verification**

After adding all variables, check:
- Vercel Dashboard → Settings → Environment Variables
- Should see all `VITE_FASTSPRING_*` variables listed
- Values should be hidden (showing `*******`)

---

## 🔍 **Where to Find Each Value**

| Variable | Where to Find |
|----------|---------------|
| `VITE_FASTSPRING_STORE_ID` | ✅ FastSpring Dashboard → Top-right: `otiumcreations_store` |
| `VITE_FASTSPRING_API_KEY` | FastSpring Dashboard → Settings → API Credentials → Private Key |
| `VITE_FASTSPRING_WEBHOOK_SECRET` | FastSpring Dashboard → Settings → Webhooks → Webhook Secret |
| `VITE_FASTSPRING_ENVIRONMENT` | Set manually: `live` |
| `VITE_FRONTEND_URL` | Your Vercel URL (e.g., `https://atlas-xi-tawny.vercel.app`) |
| `VITE_VOICE_V2_ENABLED` | Set manually: `true` (if using voice) |
| `VITE_VOICE_V2_URL` | Your WebSocket server URL (if deployed) |

---

**Note:** All these variables start with `VITE_` which means they're **frontend variables** and go in **Vercel**, not Railway.

