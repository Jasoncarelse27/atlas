# 📱 Access Atlas on Mobile - Ready Now!

## ✅ Status Check

- **Frontend**: Running on port 5174 ✅
- **Backend**: Running on port 8000 ✅
- **Local IP**: `192.168.0.10`

## 🚀 Quick Access

### **Open on your mobile device:**

```
http://192.168.0.10:5174
```

## 🔧 If Connection Fails

The firewall may be blocking Node.js. Run these commands on your Mac:

```bash
# Allow Node.js through firewall (requires password)
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add $(which node)
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp $(which node)
```

**OR** temporarily disable the firewall:

```bash
# System Settings > Network > Firewall > Turn Off
```

## ✅ Checklist

- [ ] Mac and mobile on same WiFi network
- [ ] Atlas is running (it is! ✅)
- [ ] Node.js allowed through firewall
- [ ] Using URL: `http://192.168.0.10:5174`

## 🎯 Best Practice Alternative

If you need HTTPS for voice features, generate certificates:

```bash
# Install mkcert
brew install mkcert
mkcert -install

# Generate certificates
mkdir -p .cert
mkcert -key-file dev-key.pem -cert-file dev-cert.pem localhost 192.168.0.10

# Restart Atlas
bash atlas-start.sh
```

Then use: `https://192.168.0.10:5174`

---

**Current Configuration:**
- Vite server: `0.0.0.0:5174` (✅ Network accessible)
- Backend server: `0.0.0.0:8000` (✅ Network accessible)
- Firewall: Needs Node.js allowance

