# Vercel Frontend Deployment Guide

This guide walks you through deploying the Atlas frontend to Vercel, separate from the Railway backend.

## 🎯 Why Separate Deployment?

- **Avoid Railway caching issues** - Vercel's CDN handles frontend deployments perfectly
- **Better performance** - Edge network for faster global access
- **Easier debugging** - Frontend and backend logs are separate
- **Independent scaling** - Scale frontend and backend independently

## 📋 Prerequisites

1. Vercel account (sign up at https://vercel.com)
2. GitHub repository connected to Vercel
3. Railway backend deployed and running

## 🚀 Step 1: Connect Repository to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New Project"**
3. Import your `atlas` GitHub repository
4. Select the repository

## ⚙️ Step 2: Configure Build Settings

Vercel should auto-detect Vite, but verify these settings:

- **Framework Preset:** Vite
- **Root Directory:** `./` (root)
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Install Command:** `npm install --legacy-peer-deps`

## 🔐 Step 3: Set Environment Variables

In Vercel Dashboard → Your Project → Settings → Environment Variables, add:

### Required Variables

```bash
# Backend API URL (Railway)
VITE_API_URL=https://atlas-production-2123.up.railway.app

# Supabase Configuration
VITE_SUPABASE_URL=https://rbwabemtucdkytvvpzvk.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# Frontend URL (will be set automatically, but you can override)
VITE_FRONTEND_URL=https://your-project.vercel.app
```

### FastSpring Configuration (if available)

```bash
VITE_FASTSPRING_ENVIRONMENT=live
VITE_FASTSPRING_STORE_ID=your-store-id
VITE_FASTSPRING_API_KEY=your-api-key
VITE_FASTSPRING_WEBHOOK_SECRET=your-webhook-secret
VITE_FASTSPRING_CORE_PRODUCT_ID=atlas-core-monthly
VITE_FASTSPRING_STUDIO_PRODUCT_ID=atlas-studio-monthly
```

### Sentry (Optional)

```bash
VITE_SENTRY_DSN=https://your-dsn@sentry.io/project-id
VITE_APP_ENV=production
VITE_APP_VERSION=1.0.0
```

### Voice V2 (if using)

```bash
VITE_VOICE_V2_URL=wss://atlas-voice-v2.fly.dev
VITE_VOICE_V2_ENABLED=true
```

**Important:** Set these for **Production**, **Preview**, and **Development** environments.

## 🔄 Step 4: Update Railway Backend CORS

The backend already allows Vercel domains, but if you have a custom domain, add it:

**Railway Dashboard → atlas service → Variables:**

```bash
ALLOWED_ORIGINS=https://your-project.vercel.app,https://your-custom-domain.com
```

Or use `FRONTEND_URL`:
```bash
FRONTEND_URL=https://your-project.vercel.app
```

## 🚀 Step 5: Deploy

1. Click **"Deploy"** in Vercel
2. Wait for build to complete (~2-3 minutes)
3. Your frontend will be live at `https://your-project.vercel.app`

## ✅ Step 6: Verify Deployment

1. **Check build logs** - Should show successful Vite build
2. **Visit your Vercel URL** - App should load
3. **Check browser console** - No zustand errors!
4. **Test API connection** - Should connect to Railway backend

## 🔍 Troubleshooting

### Build Fails

- **Error:** `Cannot find module 'zustand'`
  - **Fix:** Ensure `npm install --legacy-peer-deps` is used

- **Error:** `Export 'create' is not defined`
  - **Fix:** This shouldn't happen on Vercel - their build is different from Railway
  - Verify `vite.config.ts` has correct zustand configuration

### CORS Errors

- **Error:** `Access-Control-Allow-Origin` blocked
  - **Fix:** Add your Vercel URL to Railway's `ALLOWED_ORIGINS` env var
  - Or add to backend CORS whitelist in `backend/server.mjs`

### API Connection Fails

- **Error:** `Failed to fetch` or `Network error`
  - **Fix:** Verify `VITE_API_URL` is set correctly in Vercel
  - Check Railway backend is running and accessible

### Old Bundle Still Loading

- **Clear browser cache** - Hard refresh (Cmd+Shift+R / Ctrl+Shift+R)
- **Check Vercel deployment** - Ensure latest commit is deployed
- **Verify build output** - Check Vercel build logs for correct bundle hash

## 📊 Monitoring

- **Vercel Analytics** - Enable in project settings
- **Vercel Logs** - View real-time function logs
- **Build Logs** - Check each deployment's build output

## 🔄 Continuous Deployment

Vercel automatically deploys on:
- **Push to main** → Production deployment
- **Push to other branches** → Preview deployment
- **Pull requests** → Preview deployment with PR URL

## 🎯 Next Steps

1. ✅ Deploy to Vercel
2. ✅ Test production URL
3. ✅ Update any hardcoded frontend URLs
4. ✅ Set up custom domain (optional)
5. ✅ Configure monitoring/alerts

## 📝 Notes

- Vercel handles cache invalidation automatically
- Preview deployments are perfect for testing
- Each deployment gets a unique URL
- Vercel's edge network provides global CDN

---

**Backend remains on Railway** - Only frontend is on Vercel. This separation solves Railway's caching issues while keeping backend infrastructure stable.

