# 🚀 Run These Commands in Your Terminal

**Copy and paste these commands one by one:**

---

## ✅ **Step 1: Install Fly.io CLI (if not installed)**

```bash
brew install flyctl
```

**Verify:**
```bash
flyctl version
```

---

## ✅ **Step 2: Login to Fly.io**

```bash
flyctl auth login
```

This opens a browser - complete the login.

---

## ✅ **Step 3: Create the App**

```bash
cd api/voice-v2
flyctl apps create atlas-voice-v2
```

**Expected output:**
```
New app created: atlas-voice-v2
```

---

## ✅ **Step 4: Verify App Exists**

```bash
flyctl apps list
```

**Should show:** `atlas-voice-v2`

---

## ✅ **Step 5: Go Back to Token Page**

1. **Refresh:** `fly.io/tokens/create`
2. **Click "Select app"** dropdown
3. **You should see:** `atlas-voice-v2` ✅
4. **Select it**
5. **Create token**

---

## 🎯 **After App is Created**

Once you see `atlas-voice-v2` in the dropdown:
1. ✅ Select it
2. ✅ Name: `atlas-voice-v2-github-actions`
3. ✅ Expiry: `100y` (default)
4. ✅ Click "Create Token"
5. ✅ Copy token immediately
6. ✅ Add to GitHub Secrets as `FLY_API_TOKEN`

---

## 🚀 **Then Deploy**

After token is set up:

```bash
cd api/voice-v2
./deploy-multi-region.sh
```

**This will:**
- Set secrets
- Deploy to US region
- Clone to EU region
- Run health checks

---

**Run Step 1-3 in your terminal, then refresh the token page!** 🎯

