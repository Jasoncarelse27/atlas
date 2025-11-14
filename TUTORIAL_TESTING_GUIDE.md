# 🧪 TUTORIAL TESTING GUIDE

## ✅ **STEP 1: Get Your User ID**

**In Browser Console (F12):**
```javascript
// Get your user ID from Supabase auth token
const session = JSON.parse(localStorage.getItem('supabase_session') || '{}');
console.log('Your User ID:', session.user?.id);
```

**OR in Supabase SQL Editor:**
```sql
-- List all users with their IDs
SELECT id, email, tutorial_completed_at 
FROM public.profiles 
ORDER BY created_at DESC 
LIMIT 10;
```

---

## ✅ **STEP 2: Reset Tutorial for Testing**

### **Option A: Reset via SQL (Recommended)**

**In Supabase SQL Editor:**
```sql
-- Replace 'YOUR-USER-ID-HERE' with your actual UUID from Step 1
UPDATE public.profiles 
SET tutorial_completed_at = NULL 
WHERE id = 'YOUR-USER-ID-HERE';
```

**Verify it worked:**
```sql
-- Check your tutorial status
SELECT id, email, tutorial_completed_at 
FROM public.profiles 
WHERE id = 'YOUR-USER-ID-HERE';
```

### **Option B: Reset via Browser Console**

**In Browser Console (F12):**
```javascript
// Clear localStorage
localStorage.removeItem('atlas:tutorial_completed');

// Verify it's cleared
console.log('Tutorial cleared:', localStorage.getItem('atlas:tutorial_completed')); // Should be null
```

**Note:** This only clears localStorage. You still need to reset the database column if you want a full reset.

---

## ✅ **STEP 3: Test the Tutorial**

1. **Hard refresh** your browser: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
2. Navigate to `/chat` page
3. Tutorial should appear automatically after 1 second

---

## 🔍 **TROUBLESHOOTING**

### **Tutorial Not Appearing?**

**Check Console Logs:**
```javascript
// In browser console, look for:
[TutorialContext] 🚀 TutorialProvider mounted
[TutorialContext] 🔍 Checking tutorial completion...
[TutorialContext] ✅ Tutorial NOT completed, ready to show
[ChatPage] 🎓 TRIGGERING TUTORIAL NOW
```

**Common Issues:**

1. **User not authenticated:**
   - Make sure you're logged in
   - Check: `localStorage.getItem('supabase_session')`

2. **Tutorial already completed:**
   - Check database: `SELECT tutorial_completed_at FROM profiles WHERE id = 'YOUR-ID';`
   - Should be `NULL` for tutorial to show

3. **Database column missing:**
   - Run migration: `supabase/migrations/20251214_add_tutorial_completion.sql`

---

## 📊 **VERIFY TUTORIAL COMPLETION**

**After completing tutorial, verify:**

**In Browser Console:**
```javascript
// Check localStorage
console.log('Tutorial completed:', localStorage.getItem('atlas:tutorial_completed'));
```

**In Supabase SQL:**
```sql
-- Check database
SELECT id, email, tutorial_completed_at 
FROM public.profiles 
WHERE id = 'YOUR-USER-ID-HERE';
```

---

## 🎯 **QUICK TEST COMMANDS**

**Full Reset (Database + localStorage):**
```sql
-- SQL: Reset database
UPDATE public.profiles SET tutorial_completed_at = NULL WHERE id = 'YOUR-ID';
```

```javascript
// Browser Console: Reset localStorage
localStorage.removeItem('atlas:tutorial_completed');
```

Then hard refresh (`Cmd+Shift+R`) and tutorial should appear!

