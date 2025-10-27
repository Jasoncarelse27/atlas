# 🧪 FastSpring Integration Testing Guide

## ✅ Setup Complete!
- Products created: `atlas-core` ($19.99), `atlas-studio` ($189.99)
- Environment configured with live credentials
- Dev server starting...

---

## 🎯 TEST PLAN (10 minutes)

### **Test 1: Upgrade Flow** (5 minutes)

1. **Open app**: http://localhost:5174
2. **Login**: Use any test user
3. **Find upgrade button**: Should be in sidebar or settings
4. **Click "Upgrade to Core"**
5. **Expected**: Redirects to FastSpring checkout page
6. **Verify**: Shows $19.99/month for Atlas Core

### **Test 2: FastSpring Checkout** (3 minutes)

Use FastSpring test card:
```
Card: 4242 4242 4242 4242
Expiry: Any future date
CVV: Any 3 digits
```

1. **Fill checkout form** with test data
2. **Complete purchase**
3. **Expected**: Redirects back to Atlas
4. **Verify**: User tier updated to "Core"

### **Test 3: Verify Tier Update** (2 minutes)

1. **Check user profile**: Should show "Core" tier
2. **Test Core features**: 
   - Unlimited messages (no 15/month limit)
   - Audio/voice features enabled
   - Image upload enabled
3. **Check database**: `profiles` table should show `subscription_tier = 'core'`

---

## 🐛 IF ISSUES OCCUR

### "Cannot find module" or Build Error
```bash
npm install
npm run dev
```

### Redirects to Mock Checkout Instead of Real FastSpring
Check console for errors. Verify:
```bash
grep "FASTSPRING_API_KEY" .env
# Should NOT be empty or __PENDING__
```

### Checkout Shows Wrong Price
- Verify product IDs match: `atlas-core` and `atlas-studio`
- Check FastSpring dashboard that prices are correct

### User Tier Doesn't Update After Payment
1. Check webhook fired: FastSpring Dashboard → Developer Tools → Webhooks → Log
2. Check Supabase Edge Function logs
3. Manually verify webhook URL: `https://rbwabemtucdkytvvpzvk.supabase.co/functions/v1/fastspring-webhook`

---

## ✅ SUCCESS CRITERIA

- [ ] Upgrade button redirects to real FastSpring (not mock)
- [ ] Checkout shows correct product and price
- [ ] After payment, user tier updates to "Core" or "Studio"
- [ ] Core/Studio features are unlocked
- [ ] Webhook successfully updates database

---

## 📊 NEXT AFTER TESTING

If all tests pass:
1. **Commit changes**: Product ID updates
2. **Deploy to production**: Railway auto-deploys
3. **Test in production**: Real payment flow
4. **Monitor**: First real payment received! 💰

---

**Server should be running at:** http://localhost:5174

**Go test it now!** 🚀

