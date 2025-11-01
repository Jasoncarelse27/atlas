# 🚀 Create Fly.io App First

**Issue:** No dropdown for "Select app" means the app doesn't exist yet  
**Solution:** Create the app first, then create the token

---

## 📝 **Step 1: Create the App**

### **Run this command:**

```bash
cd api/voice-v2
flyctl apps create atlas-voice-v2
```

**What happens:**
- Creates app `atlas-voice-v2` in Fly.io
- Sets primary region to `iad` (from your `fly.toml`)
- App is now ready for tokens

---

## 🔐 **Step 2: Go Back to Token Page**

After creating the app:

1. **Refresh the token page** (or go back to `fly.io/tokens/create`)
2. **Click "Select app"** dropdown
3. **You should now see:** `atlas-voice-v2` in the list ✅
4. **Select it**
5. **Click "Create Token"**

---

## ✅ **Quick Commands**

```bash
# 1. Navigate to voice-v2 directory
cd api/voice-v2

# 2. Create the app
flyctl apps create atlas-voice-v2

# 3. Verify it was created
flyctl apps list
```

**Then:** Go back to token page and select `atlas-voice-v2` from dropdown.

---

## 🎯 **After App is Created**

Once you create the app:
- ✅ It will appear in the dropdown
- ✅ You can create the token
- ✅ You can deploy to it

**Note:** Creating the app doesn't deploy anything yet - it just creates the "container" for your app.

---

## 📋 **Full Flow**

```
1. Create app: flyctl apps create atlas-voice-v2
   ↓
2. Go to token page: fly.io/tokens/create
   ↓
3. Select app: atlas-voice-v2 (now in dropdown!)
   ↓
4. Create token
   ↓
5. Add to GitHub Secrets
   ↓
6. Deploy!
```

---

**Run the command above, then refresh the token page!** 🚀

