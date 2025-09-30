# 🧪 Paddle Integration Test Setup

## 🎯 **Step 1: Environment Variables**

Add these to your `.env` file:

```bash
# Paddle Sandbox Configuration
VITE_PADDLE_ENVIRONMENT=sandbox
VITE_PADDLE_CLIENT_TOKEN=your_paddle_client_token
VITE_PADDLE_CORE_PRICE_ID=pri_your_core_price_id  
VITE_PADDLE_STUDIO_PRICE_ID=pri_your_studio_price_id
```

## 🔑 **Getting Your Paddle Credentials**

### 1. Login to Paddle Dashboard
- Go to [Paddle Vendor Dashboard](https://vendors.paddle.com/)
- Switch to **Sandbox** environment for testing

### 2. Get Client Token
- Navigate to **Developer Tools** → **Authentication**
- Copy your **Client-side Token**
- This goes in `VITE_PADDLE_CLIENT_TOKEN`

### 3. Create Test Products
- Go to **Catalog** → **Products** → **Create Product**
- Create:
  - **Atlas Core** - $19.99/month recurring
  - **Atlas Studio** - $179.99/month recurring
- Copy the **Price IDs** (format: `pri_01h8xce4qhqc5qx9h1234567`)

## 🧪 **Testing Steps**

### 1. Access Test Page
1. Start your Atlas app: `npm run dev` (frontend) + `npm run dev:backend`
2. Log into Atlas with your account
3. Navigate to: `http://localhost:5174/paddle-test`

### 2. Verify Environment
The test page will show:
- ✅ Paddle Environment: sandbox
- ✅ Client Token: Set  
- ✅ Core Price ID: pri_xxxxx
- ✅ Studio Price ID: pri_xxxxx
- ✅ Current User: your@email.com
- ✅ Paddle Ready: Ready

### 3. Test Checkout Flow
1. Click **"Test Core Upgrade"** or **"Test Studio Upgrade"**
2. Paddle checkout modal should open
3. Use test card: **4000 0000 0000 0002**
4. Any CVV, future expiry date
5. Complete checkout
6. Verify success callback in browser console

## 🎯 **Expected Results**

### ✅ **Success Indicators:**
- Paddle modal opens smoothly
- Test payment processes without errors
- Success callback fires: `✅ Payment successful for core tier!`
- Browser console shows: `Paddle success callback: {...}`

### ❌ **Common Issues:**
- **"Paddle not loaded"** → Check client token
- **"Missing price ID"** → Verify price IDs in .env
- **"Payment failed"** → Check Paddle dashboard for errors
- **Modal doesn't open** → Check browser console for errors

## 🔧 **Troubleshooting**

### Issue: Environment Variables Not Loading
```bash
# Restart frontend after adding .env variables
npm run dev
```

### Issue: Paddle Script Not Loading
- Check browser dev tools → Network tab
- Verify `https://cdn.paddle.com/paddle/v2/paddle.js` loads
- Check for Content Security Policy blocking

### Issue: Invalid Price IDs
- Verify price IDs start with `pri_`
- Ensure they're from the correct Paddle environment (sandbox/live)
- Check Paddle dashboard → Catalog → Prices

## ⏭️ **Next Steps After Paddle Works**

Once checkout is working:
1. Add subscription verification call in success callback
2. Wire upgrade modal into main chat flow  
3. Test complete free → upgrade → unlimited flow
4. Deploy to production with live Paddle credentials

## 📞 **Support**

If Paddle checkout isn't working:
1. Check Paddle dashboard for transaction logs
2. Verify all environment variables are set
3. Test with different browsers/incognito mode
4. Check Paddle documentation for latest integration changes

**Goal**: Get Paddle checkout opening and processing test payments successfully! 🎯
