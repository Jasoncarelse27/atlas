# 🎯 Paddle Product Setup Guide

## **Products to Create in Paddle Dashboard**

### **1. Atlas Core Plan**
- **Name**: `Atlas Core`
- **Price**: `$19.99`
- **Billing**: `Recurring (monthly)`
- **Description**: `Unlimited messages with Claude Sonnet + premium features`
- **Category**: `Software/SaaS`

### **2. Atlas Studio Plan**  
- **Name**: `Atlas Studio`
- **Price**: `$179.99`
- **Billing**: `Recurring (monthly)`
- **Description**: `Unlimited messages with Claude Opus + advanced features`
- **Category**: `Software/SaaS`

## **Credentials to Copy**

After creating products, copy these values:

### **Authentication**
- **Client Token**: From Developer Tools → Authentication → Client-side Token
- **Environment**: `sandbox` (for testing)

### **Price IDs**
- **Core Price ID**: `pri_xxxxx` (from Atlas Core product)
- **Studio Price ID**: `pri_xxxxx` (from Atlas Studio product)

## **Environment Variables to Update**

Add these to `.env` file:
```bash
VITE_PADDLE_ENVIRONMENT=sandbox
VITE_PADDLE_CLIENT_TOKEN=your_client_token_here
VITE_PADDLE_CORE_PRICE_ID=pri_core_id_here
VITE_PADDLE_STUDIO_PRICE_ID=pri_studio_id_here
```

## **Quick Test Commands**

After adding credentials:
```bash
# Test backend
curl -s http://localhost:3000/admin/paddle-test | jq .

# Test frontend
open http://localhost:5174/paddle-test
```

## **Expected Results**

✅ Backend should return:
```json
{
  "ok": true,
  "message": "✅ Paddle sandbox config is active!",
  "environment": "sandbox",
  "clientToken": "clt_xxx...",
  "corePriceId": "pri_xxx...",
  "studioPriceId": "pri_xxx..."
}
```

✅ Frontend should show Paddle checkout buttons that open sandbox checkout modal.
