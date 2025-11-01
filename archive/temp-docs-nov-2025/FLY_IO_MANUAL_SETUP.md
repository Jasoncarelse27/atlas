# 🚀 Fly.io Manual Setup Steps

**Status:** Script ready, but needs flyctl installed first

---

## ✅ **Step 1: Install Fly.io CLI**

```bash
# macOS
brew install flyctl

# Verify installation
flyctl version
```

---

## ✅ **Step 2: Login to Fly.io**

```bash
flyctl auth login
```

This opens a browser to authenticate.

---

## ✅ **Step 3: Create the App**

```bash
cd api/voice-v2
flyctl apps create atlas-voice-v2
```

**Output should show:**
```
New app created: atlas-voice-v2
```

---

## ✅ **Step 4: Set Secrets**

**You'll need these environment variables:**
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DEEPGRAM_API_KEY`
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`

**Set them:**

```bash
# Option A: Export from .env.local
source .env.local

# Option B: Set manually
export SUPABASE_URL="your-url"
export SUPABASE_ANON_KEY="your-key"
# ... etc
```

**Then run:**
```bash
cd api/voice-v2
flyctl secrets set \
  SUPABASE_URL="$SUPABASE_URL" \
  SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" \
  SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  DEEPGRAM_API_KEY="$DEEPGRAM_API_KEY" \
  ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  OPENAI_API_KEY="$OPENAI_API_KEY" \
  --app atlas-voice-v2
```

---

## ✅ **Step 5: Deploy**

```bash
cd api/voice-v2
./deploy-multi-region.sh
```

**Or manually:**

```bash
# Deploy to US
flyctl deploy --app atlas-voice-v2 --region iad

# Clone to EU
US_MACHINE=$(flyctl machines list --app atlas-voice-v2 --json | jq -r '.[0].id')
flyctl machine clone $US_MACHINE --region fra --app atlas-voice-v2
```

---

## 🎯 **Quick Start (All Commands)**

```bash
# 1. Install
brew install flyctl

# 2. Login
flyctl auth login

# 3. Create app
cd api/voice-v2
flyctl apps create atlas-voice-v2

# 4. Set secrets (replace with your values)
flyctl secrets set \
  SUPABASE_URL="your-url" \
  SUPABASE_ANON_KEY="your-key" \
  SUPABASE_SERVICE_ROLE_KEY="your-key" \
  DEEPGRAM_API_KEY="your-key" \
  ANTHROPIC_API_KEY="your-key" \
  OPENAI_API_KEY="your-key" \
  --app atlas-voice-v2

# 5. Deploy
./deploy-multi-region.sh
```

---

## 📋 **After Setup**

1. ✅ App created: `atlas-voice-v2`
2. ✅ Go to token page → app will be in dropdown
3. ✅ Create token
4. ✅ Add to GitHub Secrets
5. ✅ Auto-deploy will work!

---

**Run these commands in your terminal!** 🚀

