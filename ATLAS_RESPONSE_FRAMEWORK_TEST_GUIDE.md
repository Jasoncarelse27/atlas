# 🧪 Atlas Response Framework - Test Guide

## 🎯 **What to Test**

The new Emotion → Action Framework should automatically trigger when users express certain emotions or needs. Test these 4 scenarios to verify it works.

---

## 📋 **TEST SCENARIOS**

### **✅ Test 1: Emotional Overwhelm**
**User Message:**
```
"I'm feeling overwhelmed with my work project. The deadline is next week and I don't know where to start."
```

**Expected Atlas Response:**
Should include an **Emotion → Action Table** like:

| Feeling | Root Cause | Action Step |
|---------|------------|-------------|
| Overwhelmed | Task feels too big | Break into 10-min chunks |
| Anxious | Deadline pressure | List the 3 most critical pieces |

**Your next 3 steps:**
1. **Set timer for 10 minutes** — Just start, no pressure
2. **Write one bad paragraph** — Permission to suck
3. **Celebrate starting** — This is the hardest part ✨

**What to verify:**
- ✅ Table renders correctly
- ✅ Bold text works (`**word**`)
- ✅ Italic text works (`*word*`)
- ✅ Emoji appears (✨)
- ✅ Mobile responsive (table scrolls horizontally if needed)

---

### **✅ Test 2: Procrastination**
**User Message:**
```
"I keep procrastinating on my project. Every time I sit down to work, I end up doing something else."
```

**Expected Atlas Response:**
Should include:
1. **Emotion → Action Table** (identifying the feeling)
2. **Priority List** (breaking down next steps)

Example:
**Your top 3 focus areas:**
1. **Identify the block** — What makes you avoid it? (5 mins)
2. **Start tiny** — Just open the file, no pressure (2 mins)
3. **Reward yourself** — Coffee after 15 mins of work ☕

Which one feels doable right now?

**What to verify:**
- ✅ Numbered list renders
- ✅ Bold actions stand out
- ✅ Time estimates in parentheses
- ✅ Conversational tone maintained

---

### **✅ Test 3: Progress Tracking**
**User Message:**
```
"What did I accomplish this week? I feel like I'm not making progress."
```

**Expected Atlas Response:**
Should include **Progress Reflection**:

**This week's wins:** 🎯
- ✅ Completed project proposal
- ✅ Had difficult conversation with manager
- 🔄 Started meditation habit (3/7 days)

**Pattern noticed:** You complete tasks when you block time in the morning. Afternoons are harder.

**Next action:** Block 9-10am tomorrow for your highest priority task.

**What to verify:**
- ✅ Checkmarks render (✅)
- ✅ In-progress indicator (🔄)
- ✅ Pattern insights are personalized
- ✅ Specific next action provided

---

### **✅ Test 4: Decision Making**
**User Message:**
```
"I'm torn between taking a promotion (more money but more stress) or staying in my current role (comfortable but stagnant). What should I do?"
```

**Expected Atlas Response:**
Should include **Decision Clarity Table**:

| Option | Emotional Cost | Productivity Gain | Alignment |
|--------|----------------|-------------------|-----------|
| Take promotion | High stress, fear of failure | Career growth, new skills | ⭐⭐⭐ Ambition |
| Stay in role | Low stress, comfort | Stagnation risk | ⭐⭐ Security |

**Atlas insight:** Your anxiety isn't saying "no" - it's asking "am I ready?"

**Action:** List 3 skills you'd need to feel confident in the new role. This will clarify if it's fear or genuine misalignment.

**What to verify:**
- ✅ Comparison table renders
- ✅ Star ratings show (⭐⭐⭐)
- ✅ Atlas provides insight (not just data)
- ✅ Actionable next step provided

---

## 🔍 **HOW TO TEST**

### **Step 1: Open Atlas**
```bash
# Frontend should already be running on:
https://localhost:5175/

# Backend should be running on:
http://localhost:8000/
```

### **Step 2: Start a Conversation**
1. Click "New Conversation" or use existing one
2. Send **Test 1** message (overwhelm)
3. Wait for Atlas response
4. Screenshot the response

### **Step 3: Verify Rendering**
**Desktop:**
- Tables should render with borders
- Bold/italic text should be styled
- Emojis should display
- Responsive to window width

**Mobile (Responsive Mode):**
- Tables should scroll horizontally if wide
- Text should wrap properly
- No horizontal overflow
- Touch-friendly spacing

### **Step 4: Test All 4 Scenarios**
Run through each test message above and verify:
- ✅ Correct format used
- ✅ Renders properly
- ✅ Actionable advice given
- ✅ Warm, empathetic tone

---

## 📊 **SUCCESS CRITERIA**

### **✅ Framework is Working If:**
1. Atlas uses structured formats (tables, lists) appropriately
2. Emotion → Action connection is clear
3. Specific, actionable steps are provided
4. Maintains warm, empathetic tone
5. Mobile rendering works (no broken layouts)

### **❌ Needs Adjustment If:**
1. Tables don't render (show as plain text)
2. Too verbose or robotic
3. Doesn't match emotion to action
4. Generic advice without personalization
5. Mobile layout breaks

---

## 🐛 **TROUBLESHOOTING**

### **Issue: Tables show as plain text**
**Solution:** Frontend already supports tables via `react-markdown` + `remark-gfm`. Check that Atlas is formatting tables correctly with `|` pipes.

### **Issue: No structured response**
**Solution:** Backend might not have restarted. Check:
```bash
# Verify backend is running
curl http://localhost:8000/healthz

# If needed, restart:
pkill -f "npm run backend" && npm run backend
```

### **Issue: Response too generic**
**Solution:** This is a prompt tuning issue. Atlas might need more specific examples in the system prompt.

### **Issue: Mobile layout breaks**
**Solution:** Check `MessageRenderer.tsx` - tables should have `overflow-x-auto` for horizontal scroll.

---

## 📸 **WHAT TO SCREENSHOT**

For each test, capture:
1. ✅ User message
2. ✅ Atlas response (full)
3. ✅ Mobile view (if testing responsive)
4. ✅ Table rendering quality

---

## ✅ **EXPECTED OUTCOME**

After testing all 4 scenarios, you should see:
- ✅ Atlas provides structured, actionable responses
- ✅ Emotion → Action connection is clear
- ✅ Tables/lists render beautifully
- ✅ Mobile experience is smooth
- ✅ Competitive advantage is obvious

**This is your differentiator.** No other AI does this. 🚀

---

## 🎯 **NEXT STEPS AFTER TESTING**

1. ✅ If all tests pass → Commit changes
2. ⚠️ If issues found → Document and adjust prompt
3. 🚀 Once stable → Update marketing copy to highlight this
4. 📊 Post-launch → Track which formats users engage with most

