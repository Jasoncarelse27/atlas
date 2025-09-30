# Atlas Paddle Integration Setup Guide

## 🔧 Environment Variables Required

Add these to your `.env` file:

```bash
# Paddle Configuration
VITE_PADDLE_ENVIRONMENT=sandbox  # Use 'live' for production
VITE_PADDLE_CLIENT_TOKEN=your_paddle_client_token_here
VITE_PADDLE_CORE_PRICE_ID=pri_your_core_price_id_here
VITE_PADDLE_STUDIO_PRICE_ID=pri_your_studio_price_id_here
```

## 🏪 Getting Paddle Credentials

### 1. Paddle Dashboard Setup
1. Log into [Paddle Dashboard](https://vendors.paddle.com/)
2. Go to **Developer Tools** → **Authentication**
3. Copy your **Client Token**
4. Set environment to **Sandbox** for testing

### 2. Create Products & Prices
1. Go to **Catalog** → **Products**
2. Create two products:
   - **Atlas Core** ($19.99/month)
   - **Atlas Studio** ($179.99/month)
3. Copy the **Price IDs** (format: `pri_01h8xce4qhqc5qx9h1234567`)

### 3. Example Configuration
```bash
# Example values (replace with your actual IDs)
VITE_PADDLE_ENVIRONMENT=sandbox
VITE_PADDLE_CLIENT_TOKEN=live_1234567890abcdef
VITE_PADDLE_CORE_PRICE_ID=pri_01h8xce4qhqc5qx9h1234567
VITE_PADDLE_STUDIO_PRICE_ID=pri_01h8xce4qhqc5qx9h7654321
```

## 🧪 Testing Checklist

### Authentication Tests
- [ ] `/message` without token → 401 UNAUTHORIZED
- [ ] `/admin/verify-subscription` without token → 401 UNAUTHORIZED  
- [ ] `/healthz` without token → 200 OK (unprotected)

### Tier Enforcement Tests
- [ ] Free tier: 15 messages → 16th shows upgrade modal
- [ ] Core tier: Unlimited messages with Claude Sonnet
- [ ] Studio tier: Unlimited messages with Claude Opus

### Paddle Integration Tests
- [ ] Upgrade modal opens with Paddle checkout
- [ ] Checkout success callback triggers
- [ ] Subscription verification endpoint works
- [ ] Tier updates after successful payment

### Analytics Tests
- [ ] `/admin/metrics` shows usage data
- [ ] Model usage logs increment correctly
- [ ] Budget tracking works per tier
- [ ] Cache stats show hit/miss rates

## 🚀 Production Deployment

### 1. Switch to Live Environment
```bash
VITE_PADDLE_ENVIRONMENT=live
# Use live Paddle credentials
```

### 2. Configure Webhooks
Set up Paddle webhooks to sync subscription changes:
- **Webhook URL**: `https://your-domain.com/api/paddle/webhook`
- **Events**: subscription.created, subscription.updated, subscription.cancelled

### 3. Monitor System
- Check `/admin/metrics` for usage analytics
- Monitor Supabase `paddle_subscriptions` table
- Watch budget tracking for cost control

## 🎯 Success Criteria

✅ **Authentication**: All endpoints require valid Supabase JWT  
✅ **Tier Enforcement**: Free users blocked at 15 messages/day  
✅ **Model Selection**: Correct Claude model per tier  
✅ **Budget Protection**: Daily spending limits enforced  
✅ **Upgrade Flow**: Paddle checkout → subscription update → tier refresh  
✅ **Analytics**: Real-time usage tracking and metrics  

## 🔗 Key Endpoints

- `POST /message` - Send message (requires auth + tier)
- `GET /admin/metrics` - Usage analytics (requires auth)
- `GET /admin/verify-subscription?userId=X` - Check subscription (requires auth)
- `GET /healthz` - Health check (public)

Your Atlas tier system is now production-ready! 🚀
