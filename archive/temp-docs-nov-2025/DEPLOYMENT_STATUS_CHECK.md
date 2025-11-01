# 🔍 Fly.io Deployment Status Check

**Date:** October 31, 2025  
**Checking:** Voice V2 deployment to Fly.io

---

## ✅ **How to Check Deployment Status:**

### **1. Check GitHub Actions:**

**Go to:** `https://github.com/Jasoncarelse27/atlas/actions`

**Look for workflow:** "Deploy Voice V2 to Fly.io"

**Status:**
- ✅ **Green checkmark** = Deployment succeeded
- ❌ **Red X** = Deployment failed
- ⏳ **Yellow circle** = In progress
- ⚪ **No workflow** = Not triggered yet

---

### **2. Check Health Endpoint:**

```bash
curl https://atlas-voice-v2.fly.dev/health
```

**Expected (if deployed):**
```json
{
  "status": "healthy",
  "activeSessions": 0,
  "uptime": 123.45,
  "timestamp": "2025-10-31T..."
}
```

**If not deployed:**
- Connection refused
- 404 Not Found
- Timeout

---

### **3. Check Machines (via CLI):**

```bash
flyctl machines list --app atlas-voice-v2
```

**Expected (if deployed):**
```
ID              NAME    STATE   REGION  CREATED
abc123...       app     started iad     ...
xyz789...       app     started fra     ...
```

---

## 🎯 **What to Look For:**

### **✅ Success Indicators:**
- GitHub Actions workflow shows ✅ success
- Health endpoint returns JSON with "healthy"
- 2 machines listed (US + EU)
- WebSocket URL accessible: `wss://atlas-voice-v2.fly.dev`

### **❌ Failure Indicators:**
- GitHub Actions workflow shows ❌ failure
- Health endpoint doesn't respond
- No machines listed
- Connection errors

---

## 🚀 **If Not Deployed Yet:**

### **Option 1: Trigger Manually**

1. Go to: `https://github.com/Jasoncarelse27/atlas/actions`
2. Click: "Deploy Voice V2 to Fly.io"
3. Click: "Run workflow"
4. Select: `main` branch
5. Click: "Run workflow"

### **Option 2: Make a Change**

```bash
cd api/voice-v2
echo "# Deployment test" >> server.mjs
git add api/voice-v2/server.mjs
git commit -m "chore: trigger Fly.io deployment"
git push origin main
```

---

## 📊 **Quick Status Check:**

**Run this command:**
```bash
curl -s https://atlas-voice-v2.fly.dev/health | jq . || echo "Not deployed or health check failed"
```

**Or check GitHub Actions:**
- URL: `https://github.com/Jasoncarelse27/atlas/actions`
- Workflow: "Deploy Voice V2 to Fly.io"

---

**Check GitHub Actions first - that will tell you if deployment ran!** 🎯

