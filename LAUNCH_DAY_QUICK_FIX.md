# 🚀 Launch Day Quick Fix Guide

**Date:** Launch Day  
**Status:** Atlas Not Responding - Quick Diagnosis

---

## ⚡ **QUICK DIAGNOSIS (2 minutes)**

### **Step 1: Run Health Check**
Open browser console and run:
```javascript
await window.atlasHealthCheck()
```

This will tell you:
- ✅ Backend reachable?
- ✅ Auth working?
- ✅ API key configured?
- ✅ Message endpoint working?

### **Step 2: Check Backend Logs**
1. Go to Railway dashboard
2. Check backend logs for errors
3. Look for: `ANTHROPIC_API_KEY is missing` or `503` errors

### **Step 3: Verify Environment Variables**

**Railway Backend:**
- `ANTHROPIC_API_KEY` or `CLAUDE_API_KEY` - MUST be set
- `SUPABASE_URL` - Must be set
- `SUPABASE_SERVICE_ROLE_KEY` - Must be set

**Vercel Frontend:**
- `VITE_API_URL` - Your Railway backend URL
- `VITE_SUPABASE_URL` - Your Supabase URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anon key

---

## 🔧 **COMMON FIXES**

### **Issue: "AI service unavailable" (503)**
**Fix:** Backend missing `ANTHROPIC_API_KEY`
1. Go to Railway → Variables
2. Add `ANTHROPIC_API_KEY=sk-ant-...`
3. Redeploy backend

### **Issue: "Backend unreachable"**
**Fix:** Backend not running or wrong URL
1. Check Railway deployment status
2. Verify `VITE_API_URL` in Vercel matches Railway URL
3. Test: `curl https://your-backend.railway.app/api/healthz`

### **Issue: "Authentication required" (401)**
**Fix:** Frontend auth issue
1. Clear browser cache
2. Sign out and sign back in
3. Check browser console for auth errors

### **Issue: Messages send but no response**
**Fix:** Streaming broken or API key invalid
1. Check backend logs for Anthropic API errors
2. Verify API key format: `sk-ant-...`
3. Test API key: `curl https://api.anthropic.com/v1/messages` with your key

---

## ✅ **VERIFICATION CHECKLIST**

- [ ] Backend health endpoint responds: `/api/healthz`
- [ ] Backend has `ANTHROPIC_API_KEY` set
- [ ] Frontend has `VITE_API_URL` pointing to backend
- [ ] User can sign in
- [ ] Health check passes: `window.atlasHealthCheck()`
- [ ] Test message sends and receives response

---

## 🆘 **IF STILL NOT WORKING**

1. **Check Browser Console** - Look for red errors
2. **Check Network Tab** - See if `/api/message` request is being made
3. **Check Backend Logs** - Railway dashboard → Logs
4. **Run Health Check** - `window.atlasHealthCheck()` in console

---

**Last Updated:** Launch Day  
**Status:** Ready for quick diagnosis

