# 🔧 STT Deepgram Configuration Fix

**Issue:** Voice calls failing with `STT service not configured` error  
**Status:** ✅ Code fix applied - Requires Railway environment variable

---

## 🔴 **Critical Issue**

Voice calls are failing because `DEEPGRAM_API_KEY` is not configured in Railway production environment.

**Error:** `POST /api/stt-deepgram 500 (Internal Server Error)`  
**Message:** `{"error":"STT service not configured"}`

---

## ✅ **Fix Applied**

1. **Improved error handling** - Changed status code from 500 → 503 (Service Unavailable)
2. **Better error messages** - Clear indication that configuration is needed
3. **Enhanced logging** - More detailed error logs for debugging

---

## 🚀 **Required Action: Add Deepgram API Key to Railway**

### **Step 1: Get Deepgram API Key**

1. Go to [Deepgram Console](https://console.deepgram.com/)
2. Sign up or log in
3. Navigate to **API Keys** section
4. Create a new API key (or copy existing one)
5. Copy the API key

### **Step 2: Add to Railway**

1. Go to [Railway Dashboard](https://railway.app)
2. Select your `atlas-production` project
3. Go to **Variables** tab
4. Click **+ New Variable**
5. Add:
   ```
   Name: DEEPGRAM_API_KEY
   Value: [paste your Deepgram API key]
   ```
6. Click **Add**
7. Railway will automatically redeploy

---

## ✅ **Verification**

After adding the environment variable:

1. Wait for Railway redeploy (~1-2 minutes)
2. Test voice call in production
3. Check that STT requests succeed (no more 500 errors)
4. Verify audio transcription works

---

## 📝 **Expected Behavior After Fix**

**Before:**
- ❌ `500 Internal Server Error`
- ❌ `STT service not configured`
- ❌ Voice calls fail completely

**After:**
- ✅ `200 OK` responses
- ✅ Audio transcribed successfully
- ✅ Voice calls work end-to-end

---

## 🔗 **Deepgram Pricing**

- **Free Tier:** 12,000 minutes/month
- **Pay-as-you-go:** $0.0043 per minute after free tier
- **Perfect for Atlas:** Voice calls use Deepgram for fast, accurate transcription

---

## 📊 **Current Status**

- ✅ Code fix committed
- ⏳ **ACTION REQUIRED:** Add `DEEPGRAM_API_KEY` to Railway environment variables
- ⏳ Wait for Railway redeploy
- ⏳ Test voice calls

---

**Last Updated:** November 4, 2025  
**Priority:** 🔴 Critical - Blocks voice call functionality

