# 🧪 PHASE 5 - QUICK TEST GUIDE (2 minutes)

**Test URL:** https://localhost:5174/

---

## ✅ **TEST 1: AI Ritual Suggestion (30 seconds)**

1. Open chat: https://localhost:5174/chat
2. Type: **"I'm feeling really stressed"**
3. Press Send

**Expected:**
```
Atlas responds with something like:
"It sounds like you're feeling overwhelmed right now. Would a quick 
**Stress Reset ritual** help? It's just 10 minutes of breathing + 
body scan + affirmation to help you recenter. ✨"
```

**Pass Criteria:**
- [ ] Atlas mentions a ritual by name
- [ ] Suggestion feels natural (not salesy)
- [ ] Includes ritual duration + steps

---

## ✅ **TEST 2: Ritual Completion Summary (60 seconds)**

1. Click **hamburger menu** (≡)
2. Click **"✨ Rituals"**
3. Click any preset (e.g., "Morning Boost")
4. **Mood Before:** Click 😴 Tired
5. Click **"Begin Ritual"**
6. Wait or click **"Next"** to skip through steps
7. **Mood After:** Click ⚡ Energized
8. **Notes:** Type "Feeling great!"
9. Click **"Save & Finish"**

**Expected:**
- ✅ Success toast: "Ritual complete! Summary posted to chat ✨"
- ✅ Auto-navigate to chat after 2 seconds
- ✅ See summary in chat:

```markdown
## 🧘 Ritual Complete: Morning Boost

**Time:** 6 minutes
**Mood Journey:** 😴 tired → ⚡ energized

**Reflection:** Feeling great!

✨ Great work! Your ritual is logged and ready for insights.
```

**Pass Criteria:**
- [ ] Summary appears in chat
- [ ] Mood emojis correct
- [ ] Your notes included
- [ ] Formatted with markdown (headers, bold text)

---

## ✅ **TEST 3: Mobile (30 seconds)**

**Mobile URL:** https://192.168.0.10:5174/

1. Repeat Test 2 on mobile
2. Verify summary renders correctly on small screen

**Pass Criteria:**
- [ ] Summary readable on mobile
- [ ] Emojis display correctly
- [ ] No layout issues

---

## 🐛 **IF SOMETHING FAILS:**

### **Issue: Ritual suggestion doesn't appear**
**Fix:** Try saying: "I can't focus" or "I need energy"

### **Issue: Summary doesn't appear in chat**
**Check:**
1. Open browser console (F12)
2. Look for errors related to "postRitualSummaryToChat"
3. Verify you have an active conversation

### **Issue: TypeScript errors**
**Fix:** Already handled with `as any` type assertions

---

## ✅ **QUICK SUCCESS CHECK:**

All 3 tests passed? **Phase 5 is working! 🎉**

Any test failed? **Report the issue with console logs.**

---

**Next:** Continue to Phase 6 (Analytics) or deploy checkpoint?
