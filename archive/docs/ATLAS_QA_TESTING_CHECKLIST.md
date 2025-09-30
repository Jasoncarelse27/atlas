# Atlas V1 Golden Standard QA Testing Checklist

## 🎯 **Pre-Testing Setup**

### **1. Apply Database Migration**
```bash
# Run the tier enforcement migration
supabase db push

# Verify tables created
supabase db reset --linked
```

### **2. Environment Check**
- [x] Claude API key configured
- [x] Supabase connection working
- [ ] Paddle integration functional (waiting for verification)
- [x] Development server running

## 🧪 **Tier Enforcement Testing**

### **Free Tier ($0/month) Testing**

#### **Text Chat Limits**
- [ ] Can send exactly 15 messages
- [ ] 16th message shows upgrade toast
- [ ] Upgrade toast has "Upgrade" button
- [ ] Uses Claude Haiku model (fastest responses)
- [ ] Message count resets monthly

#### **Feature Restrictions**
- [ ] Audio button shows lock icon 🔒
- [ ] Clicking audio shows upgrade toast
- [ ] Image button shows lock icon 🔒
- [ ] Clicking image shows upgrade toast
- [ ] Toast messages are tier-appropriate

#### **UI Indicators**
- [ ] Tier badge shows "Atlas Free"
- [ ] Feature buttons are visually disabled
- [ ] Upgrade prompts are clear and actionable

### **Core Tier ($19.99/month) Testing**

#### **Unlimited Text**
- [ ] Can send unlimited messages
- [ ] No message limit warnings
- [ ] Uses Claude Sonnet model (better quality)
- [ ] Responses are more detailed/helpful

#### **Feature Access**
- [ ] Audio button works (no lock icon)
- [ ] Voice input functionality works
- [ ] Image button works (no lock icon)
- [ ] Image upload/analysis works
- [ ] No upgrade prompts for core features

#### **UI Indicators**
- [ ] Tier badge shows "Atlas Core"
- [ ] All feature buttons are enabled
- [ ] No restriction indicators

### **Studio Tier ($179.99/month) Testing**

#### **Premium Features**
- [ ] All features work without restrictions
- [ ] Uses Claude Opus model (highest quality)
- [ ] Responses are most sophisticated
- [ ] Priority processing (if implemented)

#### **UI Indicators**
- [ ] Tier badge shows "Atlas Studio"
- [ ] All features fully enabled
- [ ] Premium indicators visible

## 🔄 **Upgrade Flow Testing**

### **Free → Core Upgrade**
- [x] Click upgrade button opens Paddle checkout (EnhancedUpgradeModal ready)
- [ ] Paddle checkout shows $19.99/month (waiting for Paddle credentials)
- [ ] Successful payment updates tier to "core"
- [ ] All core features immediately available
- [ ] No more message limits

### **Core → Studio Upgrade**
- [x] Upgrade button opens Paddle checkout (EnhancedUpgradeModal ready)
- [ ] Paddle checkout shows $179.99/month (waiting for Paddle credentials)
- [ ] Successful payment updates tier to "studio"
- [ ] Claude Opus model immediately active
- [ ] Premium features unlocked

## 📊 **Analytics & Telemetry Testing**

### **Feature Attempt Logging**
- [ ] Free user audio attempt logged as `allowed: false`
- [ ] Core user audio attempt logged as `allowed: true`
- [ ] Message limit hits logged correctly
- [ ] All feature attempts appear in `feature_attempts` table

### **Conversion Tracking**
- [ ] Upgrade button clicks tracked
- [ ] Feature restriction hits tracked
- [ ] Tier changes logged
- [ ] Analytics queries work in Supabase

## 🐛 **Error Handling Testing**

### **Network Issues**
- [ ] Offline mode gracefully degrades
- [ ] Failed API calls show appropriate errors
- [ ] Tier enforcement works without network
- [ ] Local state updates correctly

### **Edge Cases**
- [ ] User with no tier defaults to "free"
- [ ] Invalid tier values handled gracefully
- [ ] Missing profile data doesn't crash app
- [ ] Database connection issues handled

## 🎨 **UI/UX Testing**

### **Visual Consistency**
- [ ] Lock icons consistent across components
- [ ] Disabled states clearly visible
- [ ] Upgrade prompts are prominent but not intrusive
- [ ] Tier badges are clear and accurate

### **User Experience**
- [ ] Upgrade prompts are helpful, not annoying
- [ ] Feature restrictions are clearly explained
- [ ] Upgrade flow is smooth and intuitive
- [ ] No confusing or misleading UI elements

## 🚀 **Performance Testing**

### **Response Times**
- [ ] Claude Haiku responses are fast (< 3 seconds)
- [ ] Claude Sonnet responses are reasonable (< 5 seconds)
- [ ] Claude Opus responses are acceptable (< 8 seconds)
- [ ] Tier checks don't slow down UI

### **Resource Usage**
- [ ] No memory leaks from tier enforcement
- [ ] Database queries are efficient
- [ ] Feature attempt logging doesn't impact performance
- [ ] App remains responsive during tier checks

## 📱 **Cross-Platform Testing**

### **Desktop Browser**
- [ ] Chrome: All features work
- [ ] Safari: All features work
- [ ] Firefox: All features work
- [ ] Edge: All features work

### **Mobile Browser**
- [ ] iOS Safari: Touch interactions work
- [ ] Android Chrome: Touch interactions work
- [ ] Responsive design works
- [ ] Mobile upgrade flow works

## ✅ **Final Validation**

### **Launch Readiness**
- [ ] All tier restrictions work correctly
- [ ] Upgrade flows are functional
- [ ] Analytics are tracking properly
- [ ] No critical bugs or crashes
- [ ] Performance is acceptable
- [ ] UI/UX is polished

### **Business Logic**
- [ ] Free tier drives upgrades (15 message limit)
- [ ] Core tier provides clear value ($19.99)
- [ ] Studio tier justifies premium pricing ($179.99)
- [ ] API costs are controlled per tier
- [ ] Conversion funnel is optimized

## 🎯 **Success Criteria**

**Atlas V1 is ready for launch when:**
- ✅ All tier enforcement works flawlessly
- ✅ Upgrade flows convert users effectively
- ✅ API costs stay within budget per tier
- ✅ User experience is smooth and intuitive
- ✅ Analytics provide actionable insights

---

**Test each tier thoroughly before launch. The tier enforcement system is critical to Atlas's business model and user experience.**
