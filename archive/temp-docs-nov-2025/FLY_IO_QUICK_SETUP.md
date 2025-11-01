# 🚀 Fly.io Quick Setup Guide

**Issue:** No app dropdown = App doesn't exist yet  
**Solution:** Create app via command line (or web UI)

---

## 🎯 **Option 1: Create App via Command Line (Recommended)**

### **Step 1: Install Fly.io CLI (if not installed)**

```bash
# macOS
brew install flyctl

# Or download from: https://fly.io/docs/hands-on/install-flyctl/
```

### **Step 2: Login to Fly.io**

```bash
flyctl auth login
```

This opens a browser to authenticate.

### **Step 3: Create the App**

```bash
cd api/voice-v2
flyctl apps create atlas-voice-v2
```

**Output should show:**
```
New app created: atlas-voice-v2
```

### **Step 4: Go Back to Token Page**

1. **Refresh** `fly.io/tokens/create` page
2. **Click "Select app"** dropdown
3. **You should see:** `atlas-voice-v2` ✅
4. **Select it** and create token

---

## 🌐 **Option 2: Create App via Web UI**

### **If you prefer not to use command line:**

1. **Go to:** `https://fly.io/apps`
2. **Click:** "Create New App" button
3. **Fill in:**
   - **App Name:** `atlas-voice-v2`
   - **Region:** `iad` (Washington DC)
   - **Organization:** (select your org)
4. **Click:** "Create App"
5. **Go back to token page** and refresh
6. **App should now appear** in dropdown ✅

---

## ✅ **Quick Checklist**

- [ ] Install flyctl: `brew install flyctl`
- [ ] Login: `flyctl auth login`
- [ ] Create app: `flyctl apps create atlas-voice-v2`
- [ ] Refresh token page
- [ ] Select app from dropdown
- [ ] Create token
- [ ] Add to GitHub Secrets

---

## 🔍 **Verify App Was Created**

```bash
flyctl apps list
```

**Should show:**
```
atlas-voice-v2
```

---

## 🎯 **After App is Created**

Once `atlas-voice-v2` exists:
- ✅ It appears in token page dropdown
- ✅ You can create deploy token
- ✅ You can deploy to it

**Then continue with token creation!** 🚀

