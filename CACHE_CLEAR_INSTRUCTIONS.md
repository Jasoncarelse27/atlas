# 🔄 Cache Clear Instructions - Mac & iPhone

## **The Problem**
Your browser (Safari/Chrome) has cached the old HTML file that references `ChatPage-CTVt6vUd.js`. Even though Vercel will deploy a new bundle with a different hash, your browser won't load it until the cache is cleared.

---

## **Mac Safari**
1. **Safari → Settings → Advanced**
2. ✅ Check "Show Develop menu in menu bar"
3. **Develop → Empty Caches** (or `Cmd+Option+E`)
4. **Hard refresh:** `Cmd+Shift+R` on the Atlas page

**OR:**

1. Open Safari
2. `Cmd+Option+E` (Empty Caches)
3. Close Safari completely
4. Reopen and visit Atlas

---

## **Mac Chrome**
1. **Chrome → Settings → Privacy and Security → Clear browsing data**
2. Select "Cached images and files"
3. Time range: "Last hour"
4. Click "Clear data"
5. **Hard refresh:** `Cmd+Shift+R` on the Atlas page

**OR (Faster):**
1. Open Atlas in Chrome
2. `Cmd+Shift+Delete` → Clear cached images/files
3. `Cmd+Shift+R` to hard refresh

---

## **iPhone Safari**
1. **Settings → Safari → Clear History and Website Data**
2. **OR** Long-press the refresh button → "Reload Without Content Blockers"
3. **OR** Close Safari completely (swipe up in app switcher, swipe Safari away)
4. Reopen Safari and visit Atlas

**Faster method:**
1. Open Atlas in Safari
2. Tap address bar
3. Long-press the refresh button (bottom right)
4. Select "Reload Without Content Blockers"

---

## **After Clearing Cache**

### **What to Look For:**
1. ✅ New bundle filename in Network tab (should be different from `CTVt6vUd`)
2. ✅ Console shows: `[Atlas] Build: dev | Deployed: ...`
3. ✅ Auth logs appear: `📤 Sending session_start message...`
4. ✅ Voice call starts AFTER authentication completes

### **Expected Log Sequence:**
```
[VoiceV2] ✅ WebSocket connected
[VoiceV2] 📤 Sending session_start message...        ← NEW LOG
[VoiceV2] 🔐 Auth wait: received session_started      ← NEW LOG
[VoiceV2] ✅ Session authenticated, starting audio capture...  ← NEW LOG
[VoiceV2] 🎤 Starting audio capture...
[VoiceV2] ✅ Audio capture started
```

---

## **If Cache Clear Doesn't Work**

### **Option 1: Query Parameter (Nuclear Option)**
Add `?v=2025-11-03-v4` to the URL:
```
https://atlas-xi-tawny.vercel.app/chat?v=2025-11-03-v4
```

### **Option 2: Wait for Vercel CDN TTL**
Vercel's CDN may cache HTML for 1-2 minutes. Wait 2-3 minutes after deployment, then hard refresh.

### **Option 3: Check Vercel Deployment**
1. Go to https://vercel.com/dashboard
2. Check if latest commit `3ecd87e` is deployed
3. If not, wait for deployment to complete
4. Then clear cache and test

---

## **Verification Checklist**
- [ ] Cleared browser cache (Mac/iPhone)
- [ ] Hard refreshed page (`Cmd+Shift+R` or long-press refresh)
- [ ] New bundle filename appears in Network tab
- [ ] Auth logs (`📤`, `🔐`) appear in console
- [ ] Voice call waits for authentication before starting audio

---

**After clearing cache, test voice call and share console logs if issues persist.**

