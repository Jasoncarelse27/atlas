# Atlas Testing Checklist

## ✅ Pre-Testing Setup

- [ ] Run SQL script to fix missing profile (`scripts/fix-missing-profile.sql`)
- [ ] Wait 2 minutes for Railway backend to restart
- [ ] Clear browser cache/localStorage (optional but recommended)

## 🔍 Frontend Console Tests

Open browser console (F12) and check:

- [ ] **No 406 errors** - Profile queries should work
- [ ] **No 409 errors** - No conflict errors
- [ ] **No 403 errors** - Authentication working
- [ ] **No React #310/#300 errors** - Hooks working correctly
- [ ] **No MailerLite 422 errors** - Group ID precision fixed
- [ ] **No "No authenticated user found"** warnings

## 🎯 App Functionality Tests

- [ ] **Profile loads** - User profile displays correctly
- [ ] **Tutorial works** - Can complete or skip tutorial
- [ ] **Tier displays** - Shows correct tier (Free/Core/Studio)
- [ ] **Can send messages** - Chat functionality works
- [ ] **No blank screens** - UI renders correctly
- [ ] **No crashes** - App remains stable

## 📧 MailerLite Integration Tests

- [ ] **Welcome email** - Check if welcome email was sent after signup
- [ ] **Group assignment** - User added to correct MailerLite group
- [ ] **No 422 errors** - Group ID precision working
- [ ] **No 500 errors** - Backend handling errors gracefully

## 🗄️ Database Verification

Run in Supabase SQL Editor:

```sql
-- Check profile exists
SELECT * FROM profiles WHERE id = '20ec1aba-67cd-4b33-ad02-5950b5f6f6f6';

-- Check no orphaned users
SELECT COUNT(*) FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE p.id IS NULL;
```

Expected: Profile exists, 0 orphaned users

## 🚨 If Tests Fail

1. **406 errors persist** → Profile still missing, re-run SQL script
2. **MailerLite 422 errors** → Railway hasn't restarted, wait 2 more minutes
3. **React errors** → Clear cache and hard refresh (Cmd+Shift+R)
4. **Profile missing** → Check trigger is active: `SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';`

## ✅ Success Criteria

All tests pass = **100% Fixed** ✅
