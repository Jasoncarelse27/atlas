# 📱 Atlas Mobile Keyboard Testing Checklist

**Testing Date:** September 21, 2025  
**Testers:** Jason & Rima  
**URLs:** 
- Desktop: `http://localhost:5174`
- Mobile: `http://192.168.0.229:5174`

---

## 🎯 **Pre-Test Setup**

### **Desktop Testing (Jason)**
1. ✅ Open `http://localhost:5174` in Chrome/Firefox
2. ✅ Login with test account
3. ✅ Navigate to chat interface
4. ✅ Verify input bar is visible at bottom

### **Mobile Testing (Rima)**
1. ✅ Connect iPhone/Android to same WiFi network
2. ✅ Open browser and navigate to `http://192.168.0.229:5174`
3. ✅ Login with test account
4. ✅ Navigate to chat interface
5. ✅ Verify input bar is visible at bottom

---

## 🖥️ **Desktop Tests**

### **Test 1: Input Bar Positioning**
- [ ] **Expected:** Input bar sticks to bottom of screen
- [ ] **Expected:** Input bar doesn't move when scrolling
- [ ] **Expected:** Input bar has dark background (#0F172A)
- [ ] **Expected:** Input bar has rounded input field

### **Test 2: + Button Menu**
- [ ] **Click + button** → Menu slides up above input
- [ ] **Hover over mic button** → Button grows slightly (1.05x)
- [ ] **Hover over image button** → Button grows slightly (1.05x)
- [ ] **Click mic button** → Button shrinks briefly (0.9x)
- [ ] **Click image button** → Button shrinks briefly (0.9x)
- [ ] **Start typing** → Menu auto-closes
- [ ] **Click outside menu** → Menu closes

### **Test 3: Tier Gating (Free User)**
- [ ] **Click mic button** → Alert: "Voice recording is available for Core and Studio subscribers"
- [ ] **Click image button** → Alert: "Image upload is available for Core and Studio subscribers"
- [ ] **Buttons appear dimmed** (opacity-50)

---

## 📱 **Mobile Tests**

### **Test 4: Keyboard Detection**
- [ ] **Tap input field** → Keyboard opens
- [ ] **Input bar moves up** → Stays above keyboard (no jumping!)
- [ ] **Smooth transition** → 0.2s ease-out animation
- [ ] **Tap outside** → Keyboard closes, input bar returns to bottom

### **Test 5: Mobile + Button Menu**
- [ ] **Tap + button** → Menu appears above input bar
- [ ] **Menu doesn't overlap keyboard** → Stays visible above input
- [ ] **Tap mic button** → Alert + menu closes
- [ ] **Tap image button** → Alert + menu closes
- [ ] **Start typing** → Menu auto-closes

### **Test 6: Safe Area (iPhone)**
- [ ] **iPhone with notch/Dynamic Island** → Input bar respects safe area
- [ ] **Landscape mode** → Input bar adjusts properly
- [ ] **Portrait mode** → Input bar at bottom with safe area padding

### **Test 7: Input Zoom Prevention (iOS)**
- [ ] **Tap input field** → No zoom occurs
- [ ] **Font size remains 16px** → Prevents iOS zoom
- [ ] **Input field stays readable** → No tiny text

---

## 🐛 **Bug Report Template**

### **If Issues Found:**
```
Device: [iPhone 14 Pro / Samsung Galaxy S21 / Desktop Chrome]
Browser: [Safari 17.0 / Chrome 118 / Firefox 119]
Issue: [Description of what went wrong]
Expected: [What should have happened]
Actual: [What actually happened]
Screenshot: [If applicable]
```

### **Console Errors:**
```
Open browser DevTools → Console tab
Look for any red errors
Copy/paste error messages here:
```

---

## ✅ **Success Criteria**

### **Desktop Must Pass:**
- [ ] Input bar stays fixed at bottom
- [ ] + menu slides up smoothly
- [ ] Hover animations work
- [ ] Tier gating shows upgrade alerts

### **Mobile Must Pass:**
- [ ] **NO input bar jumping** when keyboard opens
- [ ] Input bar stays above keyboard
- [ ] Smooth transitions (no flicker)
- [ ] Safe area respected on iPhone
- [ ] No zoom on input focus

---

## 🚨 **Critical Issues to Report**

1. **Input bar jumps/moves** when keyboard opens
2. **Menu overlaps keyboard** on mobile
3. **No smooth transitions** (flickering)
4. **Input zoom occurs** on iOS
5. **Safe area not respected** on iPhone
6. **Desktop layout broken** by mobile changes

---

## 📊 **Test Results Summary**

### **Desktop Results:**
- [ ] ✅ All tests passed
- [ ] ❌ Issues found (see bug report above)

### **Mobile Results:**
- [ ] ✅ All tests passed  
- [ ] ❌ Issues found (see bug report above)

### **Overall Status:**
- [ ] ✅ **READY FOR PRODUCTION**
- [ ] ❌ **NEEDS FIXES** (list issues below)

---

## 🔧 **Next Steps**

### **If All Tests Pass:**
- [ ] Mark keyboard-safe foundation as complete
- [ ] Proceed with audio/image integration
- [ ] Update launch readiness checklist

### **If Issues Found:**
- [ ] Document specific problems
- [ ] Prioritize fixes (critical vs nice-to-have)
- [ ] Re-test after fixes applied

---

**Test Completed By:** ________________  
**Date:** ________________  
**Time:** ________________  
**Notes:** ________________
