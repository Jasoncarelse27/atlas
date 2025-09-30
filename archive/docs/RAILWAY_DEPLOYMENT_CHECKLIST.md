# 🚀 Railway Deployment Checklist

## **Environment Variables to Add to Railway**

Go to Railway Dashboard → Your Project → Variables and add these placeholders:

### **Paddle Configuration (Sandbox)**
```
VITE_PADDLE_ENVIRONMENT=sandbox
VITE_PADDLE_CLIENT_TOKEN=your_token_here
VITE_PADDLE_CORE_PRICE_ID=pri_core_here
VITE_PADDLE_STUDIO_PRICE_ID=pri_studio_here
```

### **Existing Variables (Verify These Exist)**
```
NODE_ENV=production
VITE_API_URL=https://atlas-production-2123.up.railway.app
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## **Steps to Add Variables**

1. **Go to Railway Dashboard**
2. **Select your Atlas project**
3. **Click "Variables" tab**
4. **Add each variable** (key = value)
5. **Click "Deploy"** to trigger rebuild

## **After Paddle Verification**

1. **Replace placeholders** with real values from Paddle
2. **Redeploy** (Railway auto-deploys when variables change)
3. **Run sanity test**: `./sanity-test.sh`

## **Sanity Test Script**

Your `sanity-test.sh` will test:
- ✅ `/healthz` endpoint
- ✅ `/message` endpoint (401 without token, 200 with token)
- ✅ `/admin/paddle-test` endpoint
- ✅ Paddle environment variables loaded

## **Expected Results After Deployment**

✅ **Health Check**: `{"status":"ok","tierGateSystem":"active"}`
✅ **Paddle Test**: `{"ok":true,"message":"✅ Paddle sandbox config is active!"}`
✅ **Auth Test**: 401 without token, 200 with valid Supabase JWT

## **Troubleshooting**

If deployment fails:
1. Check Railway logs for missing environment variables
2. Verify all required variables are set
3. Ensure no typos in variable names
4. Redeploy after fixing issues

## **Timeline**

- **Add placeholders**: 2 minutes
- **Wait for Paddle verification**: 5-15 minutes  
- **Update with real values**: 1 minute
- **Deploy and test**: 5 minutes
- **Total**: ~20 minutes from Paddle ready
