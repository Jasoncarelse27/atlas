# 🧪 RITUAL SIDEBAR - VISUAL TEST GUIDE

**Quick Test URL:** https://localhost:5174/

---

## ✅ **TEST 1: SIDEBAR NAVIGATION**

### Steps:
1. Open Atlas (https://localhost:5174/)
2. Click **hamburger menu** (≡) in top-left
3. Sidebar should slide open from left

### Expected Result:
```
✓ Quick Actions (History button)
✓ Usage Counter (Messages: X/Y)
✓ Insights Widget (EQ insights)
✓ ✨ Rituals Button ← NEW!
  - Bronze sparkle icon
  - "Rituals" title
  - "Mindfulness & Focus" subtitle
✓ Privacy Toggle
---
✓ Sign Out button
```

**Pass Criteria:**
- [ ] Rituals button appears between Insights and Privacy
- [ ] Bronze sparkle icon visible
- [ ] Text readable and properly styled

---

## ✅ **TEST 2: CLICK RITUALS BUTTON**

### Steps:
1. With sidebar open, click **"Rituals"** button
2. Watch navigation and sidebar behavior

### Expected Result:
- ✓ URL changes to `/rituals`
- ✓ Sidebar **auto-closes**
- ✓ Ritual Library page loads with ritual cards

**Pass Criteria:**
- [ ] Navigation works instantly
- [ ] Sidebar closes automatically
- [ ] No console errors

---

## ✅ **TEST 3: RITUAL LIBRARY VIEW**

### Expected on `/rituals` page:

#### **Free Tier Users:**
```
✓ 2 unlocked presets (Morning Boost, Evening Wind Down)
✓ 6 locked presets (with lock icon 🔒)
✓ "Create Ritual" button shows upgrade modal
```

#### **Core/Studio Users:**
```
✓ 8 unlocked presets (all accessible)
✓ "Create Ritual" button works (navigates to builder)
```

**Pass Criteria:**
- [ ] Correct presets visible based on tier
- [ ] Lock icons on premium rituals (Free tier only)
- [ ] Click any ritual card → preview or run

---

## ✅ **TEST 4: TOOLBAR SIMPLIFICATION**

### Steps:
1. Navigate back to `/chat`
2. Look at bottom chat toolbar
3. Verify buttons present

### Expected Result (when input is empty):
```
[+] [🎤 Mic] [📞 Phone] [Send]
```

**Missing:**
- ✗ ✨ Rituals button (moved to sidebar!)

**Pass Criteria:**
- [ ] NO Rituals button in toolbar
- [ ] Only Phone button when empty
- [ ] Toolbar looks cleaner

---

## ✅ **TEST 5: MOBILE RESPONSIVENESS**

### Mobile Test URL:
```
https://192.168.0.10:5174/
```

### Steps:
1. Open on phone/tablet
2. Tap hamburger menu
3. Tap Rituals button

### Expected Result:
- ✓ Sidebar opens smoothly
- ✓ Rituals button is **touch-friendly** (large target)
- ✓ Navigation works on mobile
- ✓ Sidebar closes after navigation

**Pass Criteria:**
- [ ] Button easy to tap (no mis-clicks)
- [ ] Text readable on small screen
- [ ] Navigation smooth

---

## ✅ **TEST 6: RITUAL BUILDER**

### Steps:
1. Click "Create Ritual" (Core/Studio only)
2. Should navigate to `/rituals/builder`

### Expected Result:
- ✓ Drag-and-drop interface loads
- ✓ Step library on left
- ✓ Ritual canvas in center
- ✓ Can add/reorder steps

**Pass Criteria:**
- [ ] Builder loads without errors
- [ ] Can drag steps from library
- [ ] Can reorder steps
- [ ] Save button works

---

## ✅ **TEST 7: RITUAL RUNNER**

### Steps:
1. From Ritual Library, click any preset
2. Should navigate to `/rituals/run/:ritualId`

### Expected Result:
- ✓ Mood selector (before starting)
- ✓ Click "Begin Ritual" → Timer starts
- ✓ Step instructions display
- ✓ Timer counts down
- ✓ Progress bar updates
- ✓ After completion → Mood selector (after)

**Pass Criteria:**
- [ ] Timer accurate (counts down correctly)
- [ ] Can pause/resume
- [ ] Can skip steps
- [ ] Completion saves to database

---

## 🐛 **KNOWN ISSUES (NOT BLOCKERS):**

### Pre-Existing Lint Warnings:
```
⚠️ voiceModalVisible unused
⚠️ hideVoiceUpgrade unused
⚠️ upgradeReason unused
⚠️ Message type errors (existing codebase)
```

**Status:** These are **pre-existing** and NOT related to Rituals feature.

---

## 📊 **CONSOLE LOG EXPECTATIONS:**

### Normal Logs (Not Errors):
```
✓ [RitualStore] Loaded presets from Supabase: 8
✓ [RitualStore] Loaded user rituals: X
✓ [useTierQuery] ✅ Tier loaded: [tier]
✓ [ChatPage] ✅ User authenticated
```

### Logs to Ignore:
```
⚠️ [useTierQuery] 📡 Realtime active (normal)
⚠️ Model deprecation warning (backend, non-critical)
```

**No NEW errors expected.**

---

## 🎯 **SUCCESS CRITERIA:**

### **PASS if ALL true:**
- ✅ Rituals button visible in sidebar
- ✅ Clicking button navigates to `/rituals`
- ✅ Sidebar auto-closes after navigation
- ✅ Ritual Library loads correctly
- ✅ Tier-based filtering works (Free: 2, Core/Studio: 8)
- ✅ Create Ritual works (Core/Studio only)
- ✅ Run Ritual works (timer, mood tracking)
- ✅ Mobile sidebar works smoothly
- ✅ NO new console errors

### **FAIL if ANY true:**
- ❌ Button not visible in sidebar
- ❌ Click does nothing
- ❌ Console errors on navigation
- ❌ Ritual pages crash/404
- ❌ Tier gating broken

---

## 🚀 **QUICK TEST SCRIPT:**

```bash
# 1. Open Atlas
open https://localhost:5174/

# 2. Open browser console (F12)
# 3. Follow tests above in order
# 4. Check console for errors
# 5. Test on mobile URL:
open https://192.168.0.10:5174/
```

---

## 📝 **BUG REPORT TEMPLATE:**

If you find an issue:

```
**Issue:** [Brief description]
**Steps:**
1. [What you did]
2. [What happened]
**Expected:** [What should happen]
**Console Errors:** [Paste any red errors]
**Tier:** [Free/Core/Studio]
**Platform:** [Web/iOS/Android]
```

---

**✨ Happy Testing!**
