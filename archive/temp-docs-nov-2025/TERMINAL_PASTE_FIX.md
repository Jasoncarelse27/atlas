# 🔧 Terminal Paste Issue - Fixed Commands

**Issue:** Terminal paste added escape sequences (`[200~` and `~`)  
**Solution:** Type commands manually or use clean copy-paste

---

## ✅ **Clean Commands to Run:**

### **1. Navigate to directory:**

```bash
cd api/voice-v2
```

### **2. Create the app:**

```bash
flyctl apps create atlas-voice-v2
```

**Expected output:**
```
New app created: atlas-voice-v2
```

### **3. Verify:**

```bash
flyctl apps list
```

**Should show:**
```
atlas-voice-v2
```

---

## 🎯 **Quick Copy-Paste (Clean):**

Copy these one at a time:

```bash
cd api/voice-v2
```

```bash
flyctl apps create atlas-voice-v2
```

```bash
flyctl apps list
```

---

## ⚠️ **If You See Errors:**

**Error: "App already exists"**
- ✅ That's fine! App is created
- ✅ Continue to token page

**Error: "Not logged in"**
- Run: `flyctl auth login`
- Complete browser login
- Then try creating app again

**Error: "Bad pattern" or escape sequences**
- Don't paste - type commands manually
- Or copy line by line (not all at once)

---

## 🔄 **After App is Created:**

1. **Wait 10-30 seconds** (Fly.io sync delay)
2. **Refresh token page:** Cmd+Shift+R
3. **Click "Select app"** dropdown
4. **Should see:** `atlas-voice-v2` ✅

---

**Type these commands manually (don't paste) to avoid formatting issues!** 🚀

