# 🔐 Test Fly.io Secret - Verification Guide

**Question:** Does `FLY_API_TOKEN` work in GitHub Actions?

---

## ✅ **Method 1: Test Secret via Manual Workflow Run**

### **Steps:**

1. **Go to:** `https://github.com/Jasoncarelse27/atlas/actions`
2. **Click:** "Deploy Voice V2 to Fly.io" (left sidebar)
3. **Click:** "Run workflow" button
4. **Select:** `main` branch
5. **Click:** "Run workflow"

### **What to Look For:**

**If secret works:**
- ✅ Workflow starts running
- ✅ Step "Authenticate with Fly.io" succeeds
- ✅ Deployment proceeds

**If secret doesn't work:**
- ❌ Step "Authenticate with Fly.io" fails
- ❌ Error: "Authentication failed" or "Invalid token"

---

## ✅ **Method 2: Test Secret Locally**

### **Test with flyctl:**

```bash
# Export token (replace with your actual token)
export FLY_API_TOKEN="your-token-here"

# Test authentication
echo "$FLY_API_TOKEN" | flyctl auth login --stdin

# Verify it worked
flyctl auth whoami
```

**Expected output:**
```
Successfully logged in as your-email@example.com
```

---

## ✅ **Method 3: Quick GitHub Actions Test**

I can create a simple test workflow that just verifies the secret works (without deploying).

**Would you like me to create a test workflow?**

---

## 🔍 **Check Current Secret:**

### **Verify Secret Exists:**

1. **Go to:** `https://github.com/Jasoncarelse27/atlas/settings/secrets/actions`
2. **Look for:** `FLY_API_TOKEN` in the list
3. **Check:** "Last updated" timestamp

**If it's there:** ✅ Secret exists  
**If it's not there:** ❌ Need to add it

---

## 🎯 **Best Way to Test:**

**Run the Fly.io workflow manually** - it will immediately show if the secret works:

1. Go to Actions → "Deploy Voice V2 to Fly.io"
2. Click "Run workflow"
3. Watch the "Authenticate with Fly.io" step

**If it passes:** ✅ Secret works!  
**If it fails:** ❌ Check token or re-add secret

---

## 📋 **Quick Checklist:**

- [ ] Secret exists in GitHub Secrets
- [ ] Secret name is exactly: `FLY_API_TOKEN`
- [ ] Token copied correctly (no extra spaces)
- [ ] Run workflow manually to test

---

**Easiest test: Run the workflow manually and watch the authentication step!** 🔐

