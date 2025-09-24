# 🧪 Atlas QA Test Script – Tier Gating Validation

## 🎯 Objective
Ensure Free, Core, and Studio tiers enforce feature access exactly according to Atlas V1 rules:
- **Free** → text only
- **Core** → text + audio + image  
- **Studio** → text + audio + image + camera

---

## 🔹 Step 1: Prepare Test Accounts

### 1.1 Create Test Users in Supabase
```sql
-- Create test users in Supabase dashboard or via SQL
INSERT INTO profiles (id, email, subscription_tier, subscription_status) VALUES
  ('test-free-uuid', 'free_tester@atlas.app', 'free', 'active'),
  ('test-core-uuid', 'core_tester@atlas.app', 'core', 'active'),
  ('test-studio-uuid', 'studio_tester@atlas.app', 'studio', 'active');
```

### 1.2 Verify Test Accounts
```bash
# Check test accounts exist
curl -s "http://localhost:3000/admin/subscriptions/overview" | jq '.users[] | select(.email | contains("tester"))'
```

### 1.3 Login to Atlas App
- **Web**: Open `http://localhost:5173` (dev) or `https://atlas.app` (prod)
- **Mobile**: Use React Native app
- Login with each test account

---

## 🔹 Step 2: Free Tier Validation

### Test Account: `free_tester@atlas.app`
**Expected**: Only text features work, all others show upgrade modal

#### ✅ Text Input Test
1. Type a message in chat input
2. Send message
3. **Expected**: AI responds normally
4. **Result**: ✅ PASS / ❌ FAIL

#### 🚫 Audio Input Test  
1. Tap microphone icon in attachment menu
2. **Expected**: Upgrade modal appears with "Audio recording features are available in Core & Studio plans"
3. **Result**: ✅ PASS / ❌ FAIL

#### 🚫 Image Upload Test
1. Tap image icon in attachment menu
2. **Expected**: Upgrade modal appears with "Image features are available in Core & Studio plans"
3. **Result**: ✅ PASS / ❌ FAIL

#### 🚫 Camera Access Test
1. Tap camera icon in attachment menu
2. **Expected**: Upgrade modal appears with "Camera features are available in Studio plans only"
3. **Result**: ✅ PASS / ❌ FAIL

#### 🔍 Console Validation
1. Open browser dev tools (F12)
2. Check console for any "🔓 DEV MODE: Bypassing feature access" messages
3. **Expected**: No bypass messages
4. **Result**: ✅ PASS / ❌ FAIL

---

## 🔹 Step 3: Core Tier Validation

### Test Account: `core_tester@atlas.app`
**Expected**: Text, audio, and image work. Camera blocked.

#### ✅ Text Input Test
1. Type and send a message
2. **Expected**: AI responds normally
3. **Result**: ✅ PASS / ❌ FAIL

#### ✅ Audio Input Test
1. Tap microphone icon
2. Grant microphone permission
3. Record a short audio message
4. **Expected**: Audio is processed and sent to AI
5. **Result**: ✅ PASS / ❌ FAIL

#### ✅ Image Upload Test
1. Tap image icon
2. Select an image file
3. **Expected**: Image uploads and AI processes it
4. **Result**: ✅ PASS / ❌ FAIL

#### 🚫 Camera Access Test
1. Tap camera icon
2. **Expected**: Upgrade modal appears with "Camera features are available in Studio plans only"
3. **Result**: ✅ PASS / ❌ FAIL

---

## 🔹 Step 4: Studio Tier Validation

### Test Account: `studio_tester@atlas.app`
**Expected**: All features work without restrictions

#### ✅ Text Input Test
1. Type and send a message
2. **Expected**: AI responds normally
3. **Result**: ✅ PASS / ❌ FAIL

#### ✅ Audio Input Test
1. Tap microphone icon
2. Record audio message
3. **Expected**: Audio is processed and sent to AI
4. **Result**: ✅ PASS / ❌ FAIL

#### ✅ Image Upload Test
1. Tap image icon
2. Upload image
3. **Expected**: Image is processed by AI
4. **Result**: ✅ PASS / ❌ FAIL

#### ✅ Camera Access Test
1. Tap camera icon
2. Grant camera permission
3. Take a photo
4. **Expected**: Photo is captured and processed by AI
5. **Result**: ✅ PASS / ❌ FAIL

---

## 🔹 Step 5: Edge Case Validation

### 5.1 Logout/Login Flow
1. Login as Free tier user
2. Verify restrictions
3. Logout
4. Login as Studio tier user
5. **Expected**: All features now work
6. **Result**: ✅ PASS / ❌ FAIL

### 5.2 Offline Mode
1. Enable airplane mode
2. Try to access locked features (audio, image, camera)
3. **Expected**: Gating still blocks access (no network needed for UI restrictions)
4. **Result**: ✅ PASS / ❌ FAIL

### 5.3 Upgrade Path Testing
1. **Free → Core**: Click upgrade modal → confirm redirect to Core plan checkout
2. **Core → Studio**: Click upgrade modal → confirm redirect to Studio plan checkout
3. **Result**: ✅ PASS / ❌ FAIL

---

## 🔹 Step 6: Admin API Verification

### 6.1 Check Subscription Overview
```bash
curl -s "http://localhost:3000/admin/subscriptions/overview" | jq .
```
**Expected**: All test accounts show correct tier and status
**Result**: ✅ PASS / ❌ FAIL

### 6.2 Test Tier Changes
```bash
# Change a test user's tier
curl -X PATCH "http://localhost:3000/v1/user_profiles/test-free-uuid/tier" \
  -H "Content-Type: application/json" \
  -H "x-admin-key: $ADMIN_API_KEY" \
  -d '{"tier": "core"}'
```
**Expected**: Tier change is logged in subscription_audit table
**Result**: ✅ PASS / ❌ FAIL

### 6.3 Verify Feature Attempts Logging
```bash
# Check feature attempts are being logged
curl -s "http://localhost:3000/admin/metrics" | jq '.feature_attempts'
```
**Expected**: Shows attempts from blocked features
**Result**: ✅ PASS / ❌ FAIL

---

## 🔹 Step 7: Production Deployment Validation

### 7.1 Pre-Deployment Checklist
- [ ] All tests pass in development
- [ ] No "DEV MODE" bypass messages in console
- [ ] Build passes: `npm run build`
- [ ] Tests pass: `npm run test`

### 7.2 Post-Deployment Validation
1. Test on production URLs:
   - `https://atlas.app`
   - `https://atlas-xi-tawny.vercel.app`
2. Verify tier gating works on production
3. Test upgrade flows with real Paddle integration

---

## ✅ Expected Results Summary

| Feature | Free | Core | Studio |
|---------|------|------|--------|
| Text Chat | ✅ | ✅ | ✅ |
| Audio Recording | ❌ (Modal) | ✅ | ✅ |
| Image Upload | ❌ (Modal) | ✅ | ✅ |
| Camera Access | ❌ (Modal) | ❌ (Modal) | ✅ |

### Upgrade Modal Messages
- **Free → Audio/Image**: "Audio/Image features are available in Core & Studio plans. Upgrade to unlock!"
- **Free → Camera**: "Camera features are available in Studio plans only. Upgrade to unlock!"
- **Core → Camera**: "Camera features are available in Studio plans only. Upgrade to unlock!"

---

## 🚨 Failure Scenarios

### If Free Tier Can Access Premium Features
1. Check `useSubscription.ts` for DEV MODE bypass
2. Verify `featureAccess.ts` tier configuration
3. Check browser console for bypass messages

### If Upgrade Modals Don't Appear
1. Verify `showUpgradeModal()` is called
2. Check toast notifications are working
3. Verify tier detection is correct

### If Admin API Shows Wrong Tiers
1. Check Supabase profiles table
2. Verify JWT token contains correct user ID
3. Check subscription_audit logs

---

## 📊 Test Results Template

```
ATLAS TIER GATING QA RESULTS
============================
Date: ___________
Tester: ___________
Environment: dev/prod

FREE TIER (free_tester@atlas.app)
- Text Input: ✅/❌
- Audio Blocked: ✅/❌  
- Image Blocked: ✅/❌
- Camera Blocked: ✅/❌
- Console Clean: ✅/❌

CORE TIER (core_tester@atlas.app)
- Text Input: ✅/❌
- Audio Works: ✅/❌
- Image Works: ✅/❌
- Camera Blocked: ✅/❌

STUDIO TIER (studio_tester@atlas.app)
- Text Input: ✅/❌
- Audio Works: ✅/❌
- Image Works: ✅/❌
- Camera Works: ✅/❌

EDGE CASES
- Logout/Login: ✅/❌
- Offline Mode: ✅/❌
- Upgrade Flows: ✅/❌

ADMIN API
- Overview Endpoint: ✅/❌
- Tier Changes: ✅/❌
- Feature Logging: ✅/❌

OVERALL RESULT: ✅ PASS / ❌ FAIL
```

---

## 🚀 Ready for Production?

- [ ] All tests pass
- [ ] No bypass messages in console
- [ ] Upgrade modals work correctly
- [ ] Admin API reflects real-time state
- [ ] Production deployment successful

**With this checklist, you'll have 100% confidence that tier gating is working before pushing to production! 🎯**
