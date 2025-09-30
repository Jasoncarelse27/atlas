# 💳 **ATLAS PADDLE BILLING TESTING CHECKLIST**

## 🎯 **Subscription System Validation**

**Test Environment:** Paddle Sandbox  
**Production URL:** https://atlas-production-2123.up.railway.app  
**Date:** ___________  
**Tester:** ___________

⚠️ **IMPORTANT:** Run ALL tests in Paddle Sandbox before production deployment!

---

## 🆓 **1. FREE TIER ENFORCEMENT**

### **Message Limit Testing**
- [ ] **New Free User:**
  - [ ] Create new account → confirm starts with `free` tier in database
  - [ ] Send messages 1-14 → confirm all go through normally
  - [ ] Send message 15 → confirm still works (at limit)
  - [ ] Send message 16 → confirm blocked with upgrade prompt

- [ ] **Upgrade Prompt Display:**
  - [ ] Clear "Upgrade to keep chatting" message appears
  - [ ] Upgrade button leads to Paddle checkout
  - [ ] User can still view chat history when blocked
  - [ ] No console errors or crashes when limit reached

### **Daily Reset Functionality**
- [ ] **24-Hour Reset:**
  - [ ] User at 15 message limit → wait for daily reset (or manually trigger)
  - [ ] Confirm message count resets to 0
  - [ ] User can send messages again normally
  - [ ] Reset time aligns with configured schedule

**✅ Success Criteria:** Free tier enforces exactly 15 messages/day with clear upgrade path.

---

## 💠 **2. CORE PLAN TESTING ($19.99/month)**

### **Upgrade Flow**
- [ ] **Paddle Checkout:**
  - [ ] Click "Upgrade to Core" → Paddle overlay opens
  - [ ] Sandbox payment form loads correctly
  - [ ] Price shows $19.99/month accurately
  - [ ] Test card payment processes successfully
  - [ ] Paddle webhook fires to Atlas backend

- [ ] **Tier Activation:**
  - [ ] Supabase `paddle_subscriptions` table updates with Core tier
  - [ ] User profile `subscription_tier` changes to `core`
  - [ ] App UI immediately reflects Core status
  - [ ] Settings page shows "Core" badge

### **Core Features Validation**
- [ ] **Unlimited Messages:**
  - [ ] Send 50+ messages → confirm no daily limit
  - [ ] No upgrade prompts appear
  - [ ] Message history unlimited

- [ ] **Sonnet Model Access:**
  - [ ] Emotional messages → confirm Sonnet responses (higher quality)
  - [ ] Simple messages → confirm still uses Haiku (cost optimization)
  - [ ] Response quality noticeably better than free tier

- [ ] **Advanced Features:**
  - [ ] Voice/audio features enabled (if implemented)
  - [ ] Image analysis available (if implemented)
  - [ ] Persistent memory across sessions
  - [ ] EQ challenges accessible

**✅ Success Criteria:** Core users get unlimited messages with Sonnet access and advanced features.

---

## 💎 **3. STUDIO PLAN TESTING ($179.99 Web / $189.99 In-App)**

### **Premium Upgrade Flow**
- [ ] **Web Checkout ($179.99):**
  - [ ] Upgrade from Core → Studio via web
  - [ ] Paddle processes $179.99 correctly
  - [ ] Webhook updates Atlas backend
  - [ ] Tier changes to `studio` in database

- [ ] **In-App Purchase ($189.99):**
  - [ ] Upgrade via mobile in-app purchase
  - [ ] Price shows $189.99 correctly
  - [ ] Apple/Google payment processes
  - [ ] Backend receives upgrade notification

### **Studio Features Validation**
- [ ] **Opus Model Access:**
  - [ ] Complex analysis requests → confirm Opus responses
  - [ ] Simple messages → confirm still uses Haiku (optimization)
  - [ ] Emotional content → confirm uses Sonnet appropriately
  - [ ] Response quality significantly enhanced for complex queries

- [ ] **Premium Features:**
  - [ ] All Core features remain available
  - [ ] Priority processing during high traffic
  - [ ] Advanced analytics and insights
  - [ ] Premium support access (if implemented)

### **Model Selection Intelligence**
- [ ] **Complexity-Based Routing:**
  - [ ] "Hi" → Haiku (cost efficient)
  - [ ] "I feel anxious" → Sonnet (emotional intelligence)
  - [ ] "Comprehensive analysis of my patterns..." → Opus (deep analysis)
  - [ ] Model selection logged in admin analytics

**✅ Success Criteria:** Studio users get Opus access with intelligent model routing.

---

## 🔄 **4. SUBSCRIPTION LIFECYCLE & EDGE CASES**

### **Downgrade Scenarios**
- [ ] **Core → Free Downgrade:**
  - [ ] Cancel Core subscription in Paddle
  - [ ] Webhook processes cancellation
  - [ ] User tier reverts to `free` in database
  - [ ] 15 message limit immediately enforced
  - [ ] Advanced features disabled gracefully

- [ ] **Studio → Core Downgrade:**
  - [ ] Cancel Studio, keep Core subscription
  - [ ] Opus access removed immediately
  - [ ] Sonnet access remains available
  - [ ] No data loss or feature crashes

- [ ] **Studio → Free Downgrade:**
  - [ ] Cancel all subscriptions
  - [ ] Complete downgrade to free tier
  - [ ] All premium features disabled
  - [ ] Message limit enforced immediately

### **Payment Failure Scenarios**
- [ ] **Expired Credit Card:**
  - [ ] Simulate card expiration in Paddle sandbox
  - [ ] Grace period handling (if implemented)
  - [ ] Eventual downgrade after grace period
  - [ ] User notification of payment failure

- [ ] **Insufficient Funds:**
  - [ ] Test payment failure scenarios
  - [ ] Subscription suspension handling
  - [ ] Recovery flow when payment updated
  - [ ] No service interruption during retry period

### **Refund & Cancellation**
- [ ] **Immediate Refund:**
  - [ ] Process refund in Paddle sandbox
  - [ ] Webhook handles refund notification
  - [ ] User tier downgrades appropriately
  - [ ] Prorated refund calculated correctly

- [ ] **Subscription Cancellation:**
  - [ ] User-initiated cancellation flow
  - [ ] Confirmation dialog prevents accidental cancellation
  - [ ] Service continues until billing period end
  - [ ] Clear communication about when access ends

**✅ Success Criteria:** All subscription changes sync correctly between Paddle and Atlas.

---

## 🔄 **5. CROSS-PLATFORM CONSISTENCY**

### **Web vs Mobile Pricing**
- [ ] **Web Checkout ($179.99):**
  - [ ] Paddle web checkout shows correct price
  - [ ] Payment processing works smoothly
  - [ ] Studio tier activated correctly

- [ ] **In-App Purchase ($189.99):**
  - [ ] Mobile IAP shows correct higher price
  - [ ] Apple/Google payment integration works
  - [ ] Same Studio features activated despite price difference

### **Platform-Specific Features**
- [ ] **Web Features:** All features work in browser
- [ ] **Mobile Features:** Touch-optimized interface
- [ ] **Cross-Device Sync:** Login on different devices shows same tier
- [ ] **Feature Parity:** Core features work consistently across platforms

**✅ Success Criteria:** Consistent experience across all platforms with proper pricing.

---

## ✅ **FINAL END-TO-END SMOKE TEST**

### **Complete User Journey**
- [ ] **Step 1:** Sign up new user → confirm Free tier (15 message limit)
- [ ] **Step 2:** Send 15 messages → hit limit → see upgrade prompt
- [ ] **Step 3:** Upgrade to Core ($19.99) → confirm unlimited messages + Sonnet
- [ ] **Step 4:** Upgrade to Studio ($179.99) → confirm Opus access
- [ ] **Step 5:** Cancel subscription → confirm return to Free tier with limits

### **Database Validation**
- [ ] **User Profile:** `subscription_tier` updates correctly at each step
- [ ] **Paddle Subscriptions:** All subscription changes logged
- [ ] **Usage Tracking:** Message counts and costs tracked accurately
- [ ] **Admin Analytics:** All changes visible in admin dashboard

### **Business Logic Validation**
- [ ] **Tier Enforcement:** Limits enforced immediately upon tier changes
- [ ] **Model Routing:** Correct AI model used for each tier
- [ ] **Cost Tracking:** Budget ceilings respected for each tier
- [ ] **Upgrade Prompts:** Appear at appropriate times with clear value proposition

**✅ Success Criteria:** Complete user journey works flawlessly from signup to premium tier.

---

## 📊 **TESTING COMPLETION SCORECARD**

### **Category Scores:**
- **Login & Onboarding:** _____ / 15 tests passed
- **Chat Experience:** _____ / 20 tests passed  
- **Settings & Preferences:** _____ / 12 tests passed
- **Error Handling:** _____ / 10 tests passed
- **Subscription Lifecycle:** _____ / 18 tests passed
- **End-to-End Testing:** _____ / 10 tests passed

### **Overall Results:**
- **Total Score:** _____ / 85 tests passed
- **Pass Rate:** _____%
- **Critical Issues:** _____ (must be 0 for launch)
- **Minor Issues:** _____ (document for future fixes)

### **Launch Decision Matrix:**

| Pass Rate | Decision | Action Required |
|-----------|----------|-----------------|
| 95-100% | ✅ **LAUNCH READY** | Proceed with soft launch |
| 85-94% | 🟡 **LAUNCH WITH MONITORING** | Launch with close monitoring |
| 70-84% | 🟠 **DELAY LAUNCH** | Fix critical issues first |
| <70% | ❌ **NOT READY** | Major fixes required |

---

## 🎯 **PADDLE SANDBOX TESTING NOTES**

### **Test Cards for Paddle Sandbox:**
- **Successful Payment:** 4000 0000 0000 0002
- **Declined Payment:** 4000 0000 0000 0127
- **Insufficient Funds:** 4000 0000 0000 9995
- **Expired Card:** 4000 0000 0000 0069

### **Webhook Testing:**
- [ ] **Subscription Created:** Webhook fires correctly
- [ ] **Subscription Updated:** Tier changes process
- [ ] **Subscription Cancelled:** Downgrade triggers
- [ ] **Payment Failed:** Grace period handling
- [ ] **Refund Processed:** Immediate tier adjustment

**✅ Success Criteria:** All Paddle events properly sync with Atlas backend.

---

## 🚀 **LAUNCH READINESS CHECKLIST**

- [ ] **UI/UX Score:** 90%+ pass rate
- [ ] **Paddle Integration:** All subscription flows working
- [ ] **Tier Enforcement:** Real user validation complete
- [ ] **Admin Dashboard:** Monitoring and analytics operational
- [ ] **Error Handling:** Graceful failures with user-friendly messages
- [ ] **Performance:** Responsive and reliable under normal load
- [ ] **Security:** Admin access controls and data protection active

**🎊 When all boxes are checked, Atlas is ready for soft launch! 🚀**

---

## 📞 **ISSUE TRACKING**

### **Critical Issues (Must Fix Before Launch):**
1. _________________________________
2. _________________________________
3. _________________________________

### **Minor Issues (Fix Post-Launch):**
1. _________________________________
2. _________________________________
3. _________________________________

### **Enhancement Ideas (Future Versions):**
1. _________________________________
2. _________________________________
3. _________________________________

**📋 Use this section to track any issues discovered during testing.**
