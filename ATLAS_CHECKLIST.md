# ✅ Atlas Tier Gating + FastSpring Integration Checklist

## Phase 0a: Quick Testing (Dev Tier Switcher) ⚡
- [ ] **Log in with normal account** (jasonc.jpg@gmail.com)
- [ ] **Open Dev Tier Switcher** (top-right corner)
- [ ] **Switch to Free tier** → confirm:
  - [ ] Text works ✅
  - [ ] Audio → Upgrade modal ❌
  - [ ] Image → Upgrade modal ❌
  - [ ] Camera → Upgrade modal ❌
- [ ] **Switch to Core tier** → confirm:
  - [ ] Text works ✅
  - [ ] Audio works ✅
  - [ ] Image works ✅
  - [ ] Camera → Upgrade modal ❌
- [ ] **Switch to Studio tier** → confirm:
  - [ ] Text works ✅
  - [ ] Audio works ✅
  - [ ] Image works ✅
  - [ ] Camera works ✅

👉 **This validates gating without needing extra accounts**

---

## Phase 0b: Optional Real Test Accounts (Later) 🧪
- [ ] **Go to Supabase → Auth → Users**
- [ ] **Create 3 users manually:**
  - free_tester@atlas.app (password: Test1234!)
  - core_tester@atlas.app (password: Test1234!)
  - studio_tester@atlas.app (password: Test1234!)
- [ ] **Go to Supabase → Database → profiles**
- [ ] **Set subscription_tier:**
  - Free → `free`
  - Core → `core`
  - Studio → `studio`
- [ ] **Log in via Atlas app with each tester account**
- [ ] **Confirm feature restrictions match expected gating**

👉 **This gives real logins for QA, but is optional**

---

## Phase 1: Tier Gating Validation
- [ ] Verify **Free tier**:
  - [ ] Text works
  - [ ] Audio → Upgrade modal
  - [ ] Image → Upgrade modal
  - [ ] Camera → Upgrade modal
- [ ] Verify **Core tier**:
  - [ ] Text works
  - [ ] Audio works
  - [ ] Image works
  - [ ] Camera → Upgrade modal
- [ ] Verify **Studio tier**:
  - [ ] Text works
  - [ ] Audio works
  - [ ] Image works
  - [ ] Camera works
- [ ] Check console logs → confirm **no "🔓 DEV MODE" bypass**

---

## Phase 2: FastSpring Integration
- [ ] Deploy `subscription_audit` migration (`supabase db push`)
- [ ] Deploy `fastspring-webhook` function (`supabase functions deploy fastspring-webhook`)
- [ ] Configure FastSpring Webhook → point to Edge Function URL
- [ ] Enable FastSpring events:
  - [ ] `subscription.activated`
  - [ ] `subscription.trial.converted`
  - [ ] `subscription.updated`
  - [ ] `subscription.canceled`
  - [ ] `subscription.deactivated`
- [ ] Run **test harness script** (`scripts/test-fastspring-webhook.ts`)
- [ ] Query `subscription_audit` table → confirm logs
- [ ] Query `subscription_overview()` → confirm analytics

---

## Phase 3: QA & CI/CD
- [ ] Run **Vitest tests** locally (`npm run test`)
- [ ] Confirm **GitHub Actions CI** workflow runs on push/PR
- [ ] Check uploaded artifacts:
  - [ ] `vitest-coverage` report
  - [ ] `migration.log`
- [ ] Confirm Slack/Discord notifications fire on success/failure
- [ ] Validate Admin API endpoint:
  ```bash
  curl -s "http://localhost:3000/admin/subscriptions/overview" | jq .
  ```

---

## Phase 4: Production Readiness
- [ ] Perform end-to-end test:
  - [ ] Free user tries audio → sees modal
  - [ ] Core user uploads image → succeeds
  - [ ] Studio user uses camera → succeeds
- [ ] Validate upgrade flow → Free/Core redirect to FastSpring checkout
- [ ] Confirm Supabase profile sync → correct tier in profiles table
- [ ] Confirm subscription_audit logs upgrades/downgrades
- [ ] Final sign-off ✅

---

## Phase 5: Cleanup
- [ ] **Delete Test Users**
  - Run:
    ```bash
    export SUPABASE_URL="https://your-project-id.supabase.co"
    export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
    node scripts/delete-test-users.js
    ```
  - Expected: test accounts removed from auth.users + profiles

---

## 🎯 Current Status
**✅ COMPLETED:**
- [x] Build error fixed (chatPreview import)
- [x] DEV MODE bypass removed from useSubscription.ts
- [x] Tier gating enforced (Free/Core/Studio rules)
- [x] Backend running and responding
- [x] User currently on Studio tier (all features accessible)
- [x] Test scripts created (seed, delete, validate)
- [x] Admin API accessible and working
- [x] Database connection verified

**🔄 IN PROGRESS:**
- [ ] Phase 0a: Quick testing with Dev Tier Switcher

**📋 NEXT:**
- [ ] Run Phase 0a: Test all three tiers with Dev Tier Switcher
- [ ] Use Expected Results Matrix to validate each tier
- [ ] Check console for any "🔓 DEV MODE" bypass messages
- [ ] Test upgrade modals appear correctly
- [ ] Phase 0b: Manual test user creation (optional, for later)
