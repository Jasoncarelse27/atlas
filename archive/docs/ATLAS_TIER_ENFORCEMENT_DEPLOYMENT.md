# 🚀 Atlas V1 Tier Enforcement - Server-Side Deployment Guide

## 📋 **Overview**

This guide deploys **server-side tier enforcement** for Atlas V1, ensuring that even if users bypass the frontend, they cannot abuse the Free tier limits.

## 🎯 **What This Implements**

### **Free Tier ($0/month)**
- ✅ **15 messages per month** (server-enforced)
- ✅ **Claude Haiku** model routing
- ❌ **Voice features** blocked
- ❌ **Image analysis** blocked

### **Core Tier ($19.99/month)**
- ✅ **Unlimited messages**
- ✅ **Claude Sonnet** model routing
- ✅ **Voice features** enabled
- ✅ **Image analysis** enabled

### **Studio Tier ($179.99/month)**
- ✅ **Unlimited messages**
- ✅ **Claude Opus** model routing
- ✅ **All features** enabled
- ✅ **Priority processing**

## 🔧 **Deployment Steps**

### **Step 1: Apply Supabase Migration**

```bash
# Run the migration script
./scripts/apply-tier-enforcement-migration.sh
```

This will:
- ✅ Add `subscription_tier` field to profiles table
- ✅ Create `message_usage` table for monthly tracking
- ✅ Create `feature_attempts` table for analytics
- ✅ Create server-side enforcement functions
- ✅ Set up RLS policies for security

### **Step 2: Update Backend Server**

```bash
# Replace the current server with tier enforcement version
cp backend/server-with-tier-enforcement.mjs backend/server.mjs

# Restart the backend
npm run dev
```

### **Step 3: Test Server-Side Enforcement**

```bash
# Run comprehensive tests
./scripts/test-tier-enforcement.sh
```

Expected results:
- ✅ New users default to 'free' tier
- ✅ Free tier users can send 15 messages
- ✅ 16th message is blocked with proper error
- ✅ Audio/Image access blocked for Free tier
- ✅ Usage tracking works correctly

### **Step 4: Update Frontend (Optional)**

The frontend already has tier enforcement, but you can enhance it to use the server-side API:

```typescript
// Use the new tier enforcement service
import { tierEnforcementService } from './services/tierEnforcementService';

// Get server-side tier info
const tierInfo = await tierEnforcementService.getUserTierInfo(userId);

// Send message with server-side enforcement
const response = await tierEnforcementService.sendMessage(userId, message);
```

## 🧪 **Testing Scenarios**

### **Test 1: Free Tier Message Limits**
1. Send 15 messages → All should succeed
2. Send 16th message → Should be blocked with error
3. Check tier info → Should show 15/15 messages used

### **Test 2: Feature Access Control**
1. Try audio feature as Free tier → Should be blocked
2. Try image feature as Free tier → Should be blocked
3. Text feature → Should always work

### **Test 3: Tier Upgrades**
1. Update user tier in Supabase profiles table
2. Verify new limits take effect immediately
3. Check analytics for tier distribution

## 📊 **Monitoring & Analytics**

### **Tier Analytics View**
```sql
-- View tier distribution and usage
SELECT * FROM tier_analytics;
```

### **Feature Attempt Logs**
```sql
-- View blocked attempts
SELECT * FROM feature_attempts 
WHERE allowed = false 
ORDER BY timestamp DESC;
```

### **Message Usage Tracking**
```sql
-- View current month usage
SELECT * FROM message_usage 
WHERE month_start = date_trunc('month', now());
```

## 🔒 **Security Features**

### **Row Level Security (RLS)**
- ✅ Users can only see their own data
- ✅ Server functions run with elevated privileges
- ✅ All operations are logged for audit

### **Server-Side Enforcement**
- ✅ Message limits enforced at database level
- ✅ Feature access validated server-side
- ✅ Cannot be bypassed by frontend manipulation

### **Analytics & Monitoring**
- ✅ All feature attempts logged
- ✅ Usage patterns tracked
- ✅ Conversion funnel data available

## 🚨 **Troubleshooting**

### **Common Issues**

**1. Migration Fails**
```bash
# Check Supabase connection
supabase status

# Reset and retry
supabase db reset
./scripts/apply-tier-enforcement-migration.sh
```

**2. Backend API Errors**
```bash
# Check server logs
npm run dev

# Verify environment variables
echo $VITE_SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY
```

**3. Frontend Not Updating**
```bash
# Clear browser cache
# Check network tab for API calls
# Verify backend is running on correct port
```

## 📈 **Performance Considerations**

### **Database Optimization**
- ✅ Indexes on user_id and month_start
- ✅ Efficient RLS policies
- ✅ Optimized function queries

### **API Response Times**
- ✅ Tier info cached in frontend
- ✅ Batch operations where possible
- ✅ Async logging for analytics

## 🎉 **Success Criteria**

**Atlas V1 Tier Enforcement is successful when:**

- ✅ **Free tier users** can send exactly 15 messages per month
- ✅ **16th message** is blocked with clear upgrade prompt
- ✅ **Voice/Image features** are locked for Free tier
- ✅ **Core/Studio users** have unlimited access
- ✅ **Server-side enforcement** cannot be bypassed
- ✅ **Analytics** show proper usage tracking
- ✅ **Performance** remains fast and responsive

## 🔮 **Next Steps**

After successful deployment:

1. **Monitor Analytics** - Track conversion rates and usage patterns
2. **A/B Testing** - Test different upgrade prompts and pricing
3. **Paddle Integration** - Connect upgrade flows to payment system
4. **Advanced Features** - Add priority processing for Studio tier
5. **Mobile App** - Extend tier enforcement to mobile clients

---

**🎊 Congratulations! Atlas V1 now has bulletproof server-side tier enforcement! 🎊**

Your Free tier is protected, Core/Studio tiers provide clear value, and the system is ready for production scale.
