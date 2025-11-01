# 🚀 Fly.io Automatic Deployment - Next Steps

**Current Status:** You're on the Fly.io token creation page  
**Next:** Create token → Add to GitHub → Test deployment

---

## 📝 **Step 1: Create Fly.io Token (You're Here!)**

### **On the Fly.io Page:**

1. **Token Type:** Keep "App Deploy Token" selected ✅
2. **Name:** Enter: `atlas-voice-v2-github-actions`
3. **Expiry:** Keep default (`100y` is fine - means 100 years)
4. **App:** Select `atlas-voice-v2` from dropdown
   - ⚠️ If app doesn't exist yet, you'll need to create it first (see below)

5. **Click "Create Token"** button

6. **Copy the token immediately!** 
   - ⚠️ **Important:** You can only see it once
   - Save it somewhere safe (password manager, notes, etc.)

---

## ⚠️ **If App Doesn't Exist Yet:**

If `atlas-voice-v2` doesn't show in the dropdown, create it first:

```bash
cd api/voice-v2
flyctl apps create atlas-voice-v2
```

Then go back to token creation page and select it.

---

## 🔐 **Step 2: Add Token to GitHub Secrets**

### **After you have the token:**

1. **Go to GitHub:**
   ```
   https://github.com/YOUR_USERNAME/atlas/settings/secrets/actions
   ```
   (Replace YOUR_USERNAME with your GitHub username)

2. **Click "New repository secret"**

3. **Fill in:**
   - **Name:** `FLY_API_TOKEN`
   - **Secret:** (paste the token you copied)
   - **Click "Add secret"**

✅ **Done!** GitHub Actions can now deploy to Fly.io automatically.

---

## 🧪 **Step 3: Test Automatic Deployment**

### **Make a small change and push:**

```bash
# 1. Make a small change (add a comment or log)
cd api/voice-v2
echo "# Test deployment" >> server.mjs

# 2. Commit
git add api/voice-v2/server.mjs
git commit -m "test: trigger Fly.io auto-deploy"

# 3. Push (this triggers deployment!)
git push origin main
```

### **Watch it deploy:**

1. **Go to GitHub Actions:**
   ```
   https://github.com/YOUR_USERNAME/atlas/actions
   ```

2. **Click on the workflow run** (should say "Deploy Voice V2 to Fly.io")

3. **Watch it:**
   - ✅ Build Docker image
   - ✅ Deploy to US region
   - ✅ Deploy to EU region
   - ✅ Run health checks
   - ✅ Show deployment summary

**Time:** ~3-5 minutes for first deployment

---

## ✅ **Step 4: Verify Deployment**

### **Check machines:**

```bash
flyctl machines list --app atlas-voice-v2
```

**Should show:**
```
ID              NAME    STATE   REGION  CREATED
abc123...       app     started iad     ...
xyz789...       app     started fra     ...
```

### **Check health:**

```bash
curl https://atlas-voice-v2.fly.dev/health
```

**Should return:**
```json
{
  "status": "healthy",
  "activeSessions": 0,
  "uptime": 123.45,
  "timestamp": "2025-10-31T..."
}
```

---

## 🎯 **Quick Checklist**

- [ ] Create Fly.io token (you're here!)
- [ ] Copy token to safe place
- [ ] Add `FLY_API_TOKEN` to GitHub Secrets
- [ ] Push a test change to trigger deployment
- [ ] Watch GitHub Actions deploy
- [ ] Verify machines are running
- [ ] Test health endpoint

---

## 🚀 **After Setup: Workflow**

**From now on:**

```
1. Make changes locally
   ↓
2. Commit & push
   ↓
3. GitHub Actions automatically deploys
   ↓
4. Changes live on Fly.io! ✅
```

**Zero manual steps!** 🎉

---

## 📊 **Monitor Deployments**

### **GitHub Actions:**
- View: `https://github.com/YOUR_USERNAME/atlas/actions`
- See: Build status, deployment logs, errors

### **Fly.io Dashboard:**
```bash
flyctl dashboard --app atlas-voice-v2
```
- View: Machine status, metrics, logs

---

## 🆘 **Troubleshooting**

### **Token doesn't work:**
- ✅ Make sure it's `FLY_API_TOKEN` (exact name)
- ✅ Make sure token hasn't expired
- ✅ Check GitHub Actions logs for errors

### **App doesn't exist:**
```bash
cd api/voice-v2
flyctl apps create atlas-voice-v2
```

### **Deployment fails:**
- Check GitHub Actions logs
- Verify secrets are set correctly
- Make sure `fly.toml` is correct

---

## ✅ **You're Ready!**

Once you:
1. ✅ Create the token
2. ✅ Add it to GitHub Secrets
3. ✅ Push a test change

**Everything will deploy automatically!** 🚀

