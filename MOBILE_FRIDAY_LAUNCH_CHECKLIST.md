# 📱 **MOBILE TESTING CHECKLIST - FRIDAY LAUNCH**

**Date**: October 28, 2025  
**Target Launch**: Friday, November 1, 2025  
**Time Estimate**: 10 minutes

---

## 🎯 **QUICK MOBILE TEST (5 min)**

### **Test on Multiple Devices:**

**iPhone (Safari):**
```
https://localhost:5174
```

**Android (Chrome):**
```
https://localhost:5174
```

**iPad (Safari):**
```
https://localhost:5174
```

---

## ✅ **CRITICAL PATH CHECKLIST**

### **1. Authentication Flow** ⚡
- [ ] Login page responsive
- [ ] Email/password fields accessible
- [ ] Keyboard doesn't cover inputs
- [ ] "Sign In" button reachable
- [ ] Error messages visible

### **2. Chat Interface** 💬
- [ ] Messages display correctly
- [ ] Input bar at bottom (not hidden)
- [ ] Send button accessible
- [ ] Keyboard opens properly
- [ ] Can scroll through history

### **3. Upgrade Flow** 💳
- [ ] Upgrade button visible
- [ ] Modal displays correctly
- [ ] Tier options selectable
- [ ] FastSpring checkout loads
- [ ] Back navigation works

### **4. Voice Features** 🎙️
- [ ] Microphone button visible
- [ ] Permission prompt appears
- [ ] Recording indicator shows
- [ ] Stop button accessible
- [ ] Transcription displays

### **5. Sidebar Navigation** 📱
- [ ] Hamburger menu works
- [ ] Sidebar slides smoothly
- [ ] All menu items clickable
- [ ] Close button/swipe works
- [ ] Rituals button visible

### **6. Ritual Features** 🧘
- [ ] Ritual library responsive
- [ ] Cards display correctly
- [ ] Start button accessible
- [ ] Timer displays properly
- [ ] Exit button reachable

---

## 🔍 **RESPONSIVE BREAKPOINTS**

### **Mobile Portrait (320px - 768px)**
```css
/* Key elements to check */
- Chat input bar
- Send button
- Sidebar toggle
- Message bubbles
- Upgrade button
```

### **Mobile Landscape (568px - 1024px)**
```css
/* Often problematic */
- Input bar position
- Keyboard overlap
- Sidebar width
- Modal sizing
```

### **Tablet (768px - 1200px)**
```css
/* Should feel native */
- Two-column layouts
- Modal centering
- Button sizes
- Font scaling
```

---

## 🚀 **QUICK FIX REFERENCE**

### **If Input Bar Hidden:**
```css
.chat-footer {
  position: fixed;
  bottom: 0;
  bottom: env(safe-area-inset-bottom);
}
```

### **If Buttons Too Small:**
```css
.button {
  min-height: 44px; /* iOS minimum */
  min-width: 44px;
}
```

### **If Text Too Small:**
```css
html {
  -webkit-text-size-adjust: 100%;
}
```

### **If Sidebar Broken:**
```css
.sidebar {
  transform: translateX(-100%);
  transition: transform 0.3s;
}
.sidebar.open {
  transform: translateX(0);
}
```

---

## 📊 **PERFORMANCE TARGETS**

| Metric | Target | Mobile Reality |
|--------|--------|----------------|
| First Paint | < 1s | < 2s acceptable |
| Interactive | < 3s | < 5s acceptable |
| Chat Load | < 2s | < 3s acceptable |
| Message Send | < 1s | < 2s acceptable |

---

## 🎯 **TEST URLS**

**Local Development:**
```
https://localhost:5174
```

**Network Testing (same WiFi):**
```
https://[your-local-ip]:5174
```

**To find local IP:**
```bash
ipconfig getifaddr en0
```

---

## ✅ **SIGN-OFF CRITERIA**

**MUST WORK:**
1. ✅ Can sign in
2. ✅ Can send messages
3. ✅ Can upgrade tier
4. ✅ Can navigate app
5. ✅ No broken layouts

**NICE TO HAVE:**
1. ⭐ Smooth animations
2. ⭐ Perfect spacing
3. ⭐ Native feel
4. ⭐ Fast performance

---

## 🚨 **LAUNCH DAY FIXES**

If users report mobile issues on Friday:

1. **Check Safari iOS** first (most problematic)
2. **Test landscape mode** (often forgotten)
3. **Verify keyboard behavior** (biggest pain point)
4. **Check safe areas** (iPhone notch/island)

**Emergency CSS:**
```css
/* Fix all mobile issues */
* {
  -webkit-tap-highlight-color: transparent;
  -webkit-touch-callout: none;
  user-select: none;
}

input, textarea {
  user-select: text;
  font-size: 16px; /* Prevent zoom */
}
```

---

## 💡 **PRO TIPS**

1. **Test on REAL devices** (not just Chrome DevTools)
2. **Test in PRIVATE/INCOGNITO** mode
3. **Test with SLOW 3G** throttling
4. **Test with KEYBOARD OPEN**
5. **Test ROTATE device** mid-action

---

**Ready for Friday? Run through this checklist in 10 minutes!** 🚀
