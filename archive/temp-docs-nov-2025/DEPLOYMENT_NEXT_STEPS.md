# 🚀 What's Next - Voice V2 Deployment

**Status:** ✅ Token added to GitHub Secrets  
**Next:** Test automatic deployment

---

## ✅ **What's Complete:**

- ✅ flyctl installed
- ✅ Logged in to Fly.io
- ✅ App created: `atlas-voice-v2`
- ✅ Token created
- ✅ Token added to GitHub Secrets (`FLY_API_TOKEN`)

---

## 🚀 **Next Steps:**

### **Option 1: Test Automatic Deployment (Recommended)**

Make a small change and push to trigger deployment:

```bash
# 1. Make a small test change
cd api/voice-v2
echo "# Auto-deploy test" >> server.mjs

# 2. Commit
git add api/voice-v2/server.mjs
git commit -m "test: trigger Fly.io auto-deploy"

# 3. Push (this triggers GitHub Actions!)
git push origin main
```

**What happens:**
- ✅ GitHub Actions detects changes in `api/voice-v2/`
- ✅ Automatically deploys to Fly.io (both US and EU)
- ✅ Runs health checks
- ✅ Shows deployment status

**Watch it:**
- Go to: `https://github.com/Jasoncarelse27/atlas/actions`
- Click on "Deploy Voice V2 to Fly.io" workflow
- Watch it deploy! 🎉

---

### **Option 2: Manual First Deployment**

If you want to deploy manually first:

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

## 🔧 **After Deployment:**

### **1. Verify Machines:**

```bash
flyctl machines list --app atlas-voice-v2
```

**Should show:**
```
2 machines:
- Machine 1: iad (Washington DC)
- Machine 2: fra (Frankfurt)
```

### **2. Test Health:**

```bash
curl https://atlas-voice-v2.fly.dev/health
```

**Should return:**
```json
{
  "status": "healthy",
  "activeSessions": 0,
  ...
}
```

### **3. Set Frontend Environment Variable:**

Add to `.env.local` (or Vercel environment variables):

```bash
VITE_VOICE_V2_URL=wss://atlas-voice-v2.fly.dev
VITE_VOICE_V2_ENABLED=true
```

---

## 📊 **Monitor Deployment:**

### **GitHub Actions:**
- View: `https://github.com/Jasoncarelse27/atlas/actions`
- See: Build logs, deployment status

### **Fly.io Dashboard:**
```bash
flyctl dashboard --app atlas-voice-v2
```
- View: Machine status, metrics, logs

---

## ✅ **Checklist:**

- [x] Token added to GitHub Secrets
- [ ] Test automatic deployment (push a change)
- [ ] Verify machines are running
- [ ] Test health endpoint
- [ ] Set frontend environment variable
- [ ] Test voice call in app

---

## 🎯 **Recommended Next Action:**

**Push a test change to trigger automatic deployment:**

```bash
cd api/voice-v2
echo "# Auto-deploy enabled" >> server.mjs
git add .
git commit -m "test: trigger Fly.io auto-deploy"
git push origin main
```

**Then watch it deploy automatically!** 🚀

---

**You're all set! Push a change and watch GitHub Actions deploy automatically!** ✅

