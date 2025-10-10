# 📱 Atlas Mobile Access - Future-Proof Setup Guide

## 🎯 Overview

This guide provides the **safest, most future-proof approach** for accessing Atlas on mobile devices during development and production.

---

## 🏆 Recommended Approach: Proper Network Configuration

### ✅ **Why This Approach?**

1. **Security First**: Keeps firewall enabled, only allows necessary traffic
2. **Production Ready**: Works in both development and production environments
3. **No External Dependencies**: No need for ngrok, tunnels, or third-party services
4. **Network Agnostic**: Works on any local network (home, office, etc.)
5. **Future-Proof**: Survives system updates, network changes, and IP changes

---

## 🚀 Quick Start

### **Step 1: Run Setup Script (One-Time)**

```bash
bash setup-mobile-access.sh
```

This script:
- ✅ Checks firewall status
- ✅ Adds Node.js to firewall allow list
- ✅ Detects your local IP address
- ✅ Provides mobile access URL

### **Step 2: Start Atlas**

```bash
bash atlas-start.sh
```

### **Step 3: Access from Mobile**

Open Safari on your iPhone/iPad:
```
http://192.168.0.10:5174
```

*(IP address will be shown by the setup script)*

---

## 🔒 Security Configuration

### **Firewall Settings (Recommended)**

```bash
# Enable firewall (if disabled)
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate on

# Allow Node.js through firewall
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add $(which node)
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp $(which node)

# Verify Node.js is allowed
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --listapps | grep node
```

### **Network Security Best Practices**

1. **Local Network Only**: Atlas is only accessible on your local network (192.168.x.x)
2. **No Public Exposure**: Not accessible from the internet
3. **Firewall Enabled**: macOS firewall remains active for other services
4. **HTTPS Ready**: Vite config supports HTTPS with local certificates

---

## 🌐 Network Configuration

### **Vite Server Settings** (`vite.config.ts`)

```typescript
server: {
  host: '0.0.0.0',  // ✅ Listen on all network interfaces
  port: 5174,        // ✅ Consistent port for mobile access
  https: fs.existsSync('.cert/localhost+1.pem') ? {
    key: fs.readFileSync('.cert/localhost+1-key.pem'),
    cert: fs.readFileSync('.cert/localhost+1.pem'),
  } : undefined,
  proxy: {
    '/v1': { target: 'http://localhost:8000', changeOrigin: true },
    '/api': { target: 'http://localhost:8000', changeOrigin: true },
    '/message': { target: 'http://localhost:8000', changeOrigin: true }
  }
}
```

### **Backend Server Settings** (`backend/server.mjs`)

```javascript
const PORT = process.env.PORT || 8000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Atlas backend running on port ${PORT}`);
});
```

---

## 🔧 Troubleshooting

### **Issue: Mobile Can't Connect**

**Check 1: Verify Services are Running**
```bash
# Check Vite is running
lsof -i :5174 | grep LISTEN

# Check Backend is running
lsof -i :8000 | grep LISTEN
```

**Check 2: Verify Network IP**
```bash
# Get your local IP
ipconfig getifaddr en0  # WiFi
ipconfig getifaddr en1  # Ethernet
```

**Check 3: Test Connection from Mac**
```bash
# Test frontend
curl -I http://192.168.0.10:5174

# Test backend
curl http://192.168.0.10:8000/health
```

**Check 4: Firewall Status**
```bash
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate
```

### **Issue: IP Address Changed**

Your local IP may change when:
- Switching networks (home → office → café)
- Router restarts
- DHCP lease expires

**Solution**: Re-run the setup script
```bash
bash setup-mobile-access.sh
```

### **Issue: Connection Refused**

**Possible Causes:**
1. Services not running → Run `bash atlas-start.sh`
2. Wrong IP address → Check with `ipconfig getifaddr en0`
3. Firewall blocking → Run `bash setup-mobile-access.sh`
4. Different network → Ensure mobile and Mac are on same WiFi

---

## 🚀 Production Deployment

### **For Production (Vercel/Railway/etc.)**

1. **Environment Variables**:
   ```bash
   VITE_API_URL=https://your-backend.railway.app
   ```

2. **Backend CORS**:
   ```javascript
   app.use(cors({
     origin: ['https://your-frontend.vercel.app'],
     credentials: true
   }));
   ```

3. **HTTPS Only**: Always use HTTPS in production

### **For Staging/Testing**

Use the same local network approach, but with:
- Static IP assignment on your router
- DNS entry (e.g., `atlas.local`)
- mDNS/Bonjour for automatic discovery

---

## 📊 Network Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Local Network                       │
│                  (192.168.0.x)                       │
│                                                      │
│  ┌──────────────┐         ┌──────────────┐         │
│  │   Mac/PC     │         │   Mobile     │         │
│  │              │         │   Device     │         │
│  │ Frontend     │◄────────┤   Safari     │         │
│  │ :5174        │  WiFi   │              │         │
│  │              │         └──────────────┘         │
│  │ Backend      │                                   │
│  │ :8000        │                                   │
│  └──────────────┘                                   │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## ✅ Checklist for Future-Proof Setup

- [ ] Firewall configured to allow Node.js
- [ ] Vite configured with `host: '0.0.0.0'`
- [ ] Backend listening on `0.0.0.0`
- [ ] Local IP address documented
- [ ] Mobile device on same WiFi network
- [ ] HTTPS certificates generated (optional, for iOS microphone)
- [ ] Environment variables properly set
- [ ] Proxy configuration for API routes
- [ ] CORS configured for mobile access

---

## 🎓 Additional Resources

### **Generate HTTPS Certificates (for iOS microphone access)**

```bash
# Install mkcert
brew install mkcert

# Create local CA
mkcert -install

# Generate certificates
mkdir -p .cert
mkcert -key-file .cert/localhost+1-key.pem -cert-file .cert/localhost+1.pem localhost 192.168.0.10
```

### **Alternative: ngrok (for external testing)**

```bash
# Install ngrok
brew install ngrok

# Create tunnel
ngrok http 5174

# Use the ngrok URL on any device
```

---

## 🎯 Summary

**Safest Future-Proof Approach:**

1. ✅ Keep firewall enabled
2. ✅ Allow Node.js through firewall
3. ✅ Use `0.0.0.0` for network binding
4. ✅ Access via local IP on same network
5. ✅ Use HTTPS for production
6. ✅ Document network configuration

**Benefits:**
- 🔒 Secure (firewall enabled)
- 🚀 Fast (local network)
- 💰 Free (no external services)
- 🔧 Maintainable (no complex setup)
- 📱 Mobile-friendly (works on all devices)

---

**Last Updated**: October 9, 2025  
**Atlas Version**: 1.0.0  
**Maintained By**: Atlas Development Team

