# 🔒 HTTPS Setup for Audio & Image Testing

## ✅ **STATUS: HTTPS CONFIGURED & RUNNING**

### **Certificate Details**
- ✅ Certificate includes: `localhost`, `127.0.0.1`, `::1`, `192.168.0.229`
- ✅ Valid until: February 18, 2028
- ✅ Generated with mkcert (trusted certificates)

### **Server URLs**

**Desktop (Mac):**
```
https://localhost:5174
```

**Mobile/Network:**
```
https://192.168.0.229:5174
```

## 🎯 **Why HTTPS is Required**

### **Audio Features**
- ✅ iOS Safari requires HTTPS for `getUserMedia()` API
- ✅ Microphone access only works on HTTPS
- ✅ Voice notes and voice calls need HTTPS

### **Image Features**
- ✅ Some browsers require HTTPS for camera access
- ✅ Image uploads work better on HTTPS
- ✅ Better security for file uploads

## 📱 **Mobile Setup (iOS/Android)**

### **Step 1: Accept Certificate on Mobile**

**iOS Safari:**
1. Open Safari on iPhone/iPad
2. Navigate to `https://192.168.0.229:5174`
3. You'll see "This Connection Is Not Private"
4. Tap **"Show Details"**
5. Tap **"visit this website"**
6. Tap **"Visit Website"** to confirm
7. ✅ Certificate accepted!

**Android Chrome:**
1. Open Chrome on Android
2. Navigate to `https://192.168.0.229:5174`
3. You'll see "Your connection is not private"
4. Tap **"Advanced"**
5. Tap **"Proceed to 192.168.0.229 (unsafe)"**
6. ✅ Certificate accepted!

### **Step 2: Test Audio**
1. Log in to Atlas
2. Click microphone button
3. Allow microphone access when prompted
4. ✅ Voice recording should work!

### **Step 3: Test Image Upload**
1. Click attachment button
2. Select "Camera" or "Photo Library"
3. Allow camera/photo access when prompted
4. ✅ Image upload should work!

## 🔧 **Troubleshooting**

### **"Certificate Not Trusted" Warning**
- ✅ This is **normal** for local development
- ✅ Accept it once per device/browser
- ✅ Production will use real certificates (no warnings)

### **Can't Access from Mobile**
1. **Check Mac and mobile are on same WiFi**
   ```bash
   # On Mac, check IP
   ipconfig getifaddr en0
   ```

2. **Check firewall allows Node.js**
   ```bash
   # Allow Node.js through firewall
   sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add $(which node)
   sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp $(which node)
   ```

3. **Verify server is running**
   ```bash
   lsof -i :5174 | grep LISTEN
   ```

### **IP Address Changed**
If your Mac's IP changes, regenerate certificate:
```bash
cd /Users/jasoncarelse/atlas
CURRENT_IP=$(ipconfig getifaddr en0)
mkcert -key-file localhost+1-key.pem -cert-file localhost+1.pem localhost 127.0.0.1 ::1 $CURRENT_IP
# Restart server
npm run dev
```

## ✅ **Verification**

Test HTTPS is working:
```bash
# Test localhost
curl -k https://localhost:5174 | head -5

# Test network IP
curl -k https://192.168.0.229:5174 | head -5
```

Both should return HTML content.

## 🚀 **Current Status**

- ✅ HTTPS server running on port 5174
- ✅ Certificate includes current IP (192.168.0.229)
- ✅ Certificate valid until 2028
- ✅ Ready for audio/image testing

**Access Atlas at:**
- Desktop: `https://localhost:5174`
- Mobile: `https://192.168.0.229:5174`

---

**Note:** These are development certificates. Production will use proper SSL certificates from a trusted CA.

