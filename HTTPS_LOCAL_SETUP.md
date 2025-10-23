# 🔒 HTTPS Local Development Setup

## ✅ What Was Done

Self-signed SSL certificates have been generated for local HTTPS development, enabling voice calls on iOS Safari.

### Files Created
- `dev-cert.pem` - SSL certificate (expires in 365 days)
- `dev-key.pem` - Private key

### Files Updated
- `vite.config.ts` - Now loads HTTPS certificates if present
- `backend/server.mjs` - Added HTTPS origins to CORS whitelist

---

## 🚀 How to Use

### Step 1: Restart Frontend with HTTPS
```bash
# Stop current frontend (Ctrl+C in the terminal running it)
npm run dev
```

Your frontend will now run on:
- **Desktop:** `https://localhost:5174`
- **Mobile:** `https://192.168.0.10:5174`

### Step 2: Accept Certificate on iOS
1. Open Safari on your iPhone
2. Navigate to `https://192.168.0.10:5174`
3. You'll see "This Connection Is Not Private"
4. Tap **"Show Details"**
5. Tap **"visit this website"**
6. Tap **"Visit Website"** again to confirm
7. ✅ Done! Certificate accepted

### Step 3: Test Voice Call
1. Log in to Atlas
2. Click the voice call button (phone icon)
3. Allow microphone access when prompted
4. ✅ Voice call should now work!

---

## 🔧 Troubleshooting

### "This Connection Is Not Private" keeps appearing
- This is normal for self-signed certificates
- You'll need to accept it once per device/browser
- In production, Atlas will use a real certificate (no warnings)

### CORS errors when calling backend
- Make sure backend is running: `cd backend && node server.mjs`
- Backend should show: `CORS origins include: https://192.168.0.10:5174`

### Certificate expired (after 365 days)
```bash
# Regenerate certificate
cd /Users/jasoncarelse/atlas
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout dev-key.pem \
  -out dev-cert.pem \
  -days 365 \
  -subj "/CN=192.168.0.10/O=Atlas Development/C=US"

# Restart frontend
npm run dev
```

---

## 🎯 Why This Works

| Issue | Solution |
|-------|----------|
| iOS Safari blocks mic on HTTP | HTTPS enables `getUserMedia()` API |
| Self-signed cert warning | One-time acceptance per device |
| Backend CORS | HTTPS origins added to whitelist |
| Certificate security | Private key never committed (in `.gitignore`) |

---

## 🚀 Next Steps

1. **Restart frontend** to enable HTTPS
2. **Accept certificate** on your iPhone
3. **Test voice call** feature
4. **Deploy to production** with real HTTPS (Let's Encrypt, Cloudflare, etc.)

---

**Note:** These certificates are for **local development only**. Production will use proper SSL certificates from a trusted Certificate Authority.

