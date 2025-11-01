# 🔧 Fly.io Commands - What to Expect

**Issue:** Commands need to be run in your terminal (not via tool)

---

## ✅ **Run These in Your Terminal:**

### **1. Install Fly.io CLI**

```bash
brew install flyctl
```

**Expected output:**
```
==> Installing flyctl
...
flyctl: stable 0.x.x
```

---

### **2. Login to Fly.io**

```bash
flyctl auth login
```

**What happens:**
- Opens browser automatically
- Shows Fly.io login page
- After login, terminal shows: `Successfully logged in as your-email@example.com`

---

### **3. Create the App**

```bash
cd api/voice-v2
flyctl apps create atlas-voice-v2
```

**Expected output:**
```
New app created: atlas-voice-v2
```

**Or if app already exists:**
```
Error: App 'atlas-voice-v2' already exists
```

---

## 🎯 **After Running Commands**

### **Check if app was created:**

```bash
flyctl apps list
```

**Should show:**
```
atlas-voice-v2
```

---

## ✅ **Then Go Back to Token Page**

1. **Refresh:** `fly.io/tokens/create`
2. **Click "Select app"** dropdown
3. **You should see:** `atlas-voice-v2` ✅
4. **Select it**
5. **Fill in:**
   - Name: `atlas-voice-v2-github-actions`
   - Expiry: `100y` (default)
6. **Click "Create Token"**

---

## 🆘 **If Commands Fail**

### **flyctl not found:**
```bash
# Install Homebrew first (if needed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Then install flyctl
brew install flyctl
```

### **Not logged in:**
```bash
flyctl auth login
# Follow browser prompts
```

### **App already exists:**
```bash
# That's fine! Just continue to token creation
flyctl apps list  # Verify it exists
```

---

**Run these commands in your terminal, then refresh the Fly.io token page!** 🚀

