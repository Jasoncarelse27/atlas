# 🔍 Anthropic API Key Usage Diagnostic

## Issue
API key shows "Never" used in Anthropic console, but you expect it to be used.

## Analysis

Looking at your Anthropic console screenshot, I can see:

### ✅ Keys WITH Usage:
1. **`atlas-anthropic-api`** (sk-ant-api03-QN9...PAAA)
   - Last Used: Nov 1, 2025
   - Cost: USD 0.68
   - ✅ **This key IS being used**

2. **`atlas-production...`** (sk-ant-api03-XYT...QAAA)
   - Last Used: Nov 7, 2025
   - Cost: USD 0.01
   - ✅ **This key IS being used**

### ❌ Keys WITHOUT Usage:
3. **`atlas-production...`** (sk-ant-api03-5yF...UwAA)
   - Last Used: Never
   - Cost: - (dash)
   - ⚠️ **This key is NOT being used**

## 🔍 How to Check Which Key is Configured

### Step 1: Check Railway Logs

1. Go to Railway Dashboard: https://railway.app/project/atlas-production-2123/logs
2. Look for this log message on server startup:
   ```
   [Server] API Keys loaded: ANTHROPIC_API_KEY: ✅ Set (sk-ant-...)
   ```
3. The first 8 characters after `sk-ant-` will tell you which key is configured

### Step 2: Match Key Prefix

Based on your screenshot, here are the key prefixes:

| Key Name | Prefix | Last Used | Status |
|----------|--------|-----------|--------|
| `atlas-anthropic-api` | `sk-ant-QN` | Nov 1 | ✅ Active |
| `atlas-production...` (used) | `sk-ant-XY` | Nov 7 | ✅ Active |
| `atlas-production...` (unused) | `sk-ant-5y` | Never | ❌ Not used |

### Step 3: Verify API Calls Are Being Made

Check Railway logs for API call evidence:

```bash
# Look for these log messages:
[streamAnthropicResponse] 🚀 Sending request to Anthropic API
[Message] ✅ Response generated successfully
```

If you DON'T see these logs, API calls aren't reaching Anthropic (might be failing earlier).

## 🔧 Possible Issues

### Issue 1: Wrong Key Configured
If Railway shows `sk-ant-5y...` (the unused key), you need to switch to the active key.

**Fix:**
1. Railway → Variables → `ANTHROPIC_API_KEY`
2. Update to: `sk-ant-api03-XYT...QAAA` (the one with Nov 7 usage)
3. Save → Railway auto-redeploys

### Issue 2: API Calls Failing Before Anthropic
If the key is correct but shows "Never", API calls might be failing before reaching Anthropic.

**Check:**
- Railway logs for 401/403 errors
- Backend health: `curl https://atlas-production-2123.up.railway.app/healthz`
- Authentication errors in logs

### Issue 3: Key Not Attached to Service
If the key exists in Railway Shared Variables but not attached to the service.

**Fix:**
1. Railway → `atlas` service → Variables
2. Add `ANTHROPIC_API_KEY` → Reference Shared Variable
3. Or directly paste the key value

## ✅ Quick Diagnostic Script

Run this locally to check which key you have:

```bash
node scripts/check-anthropic-usage.mjs
```

This will show:
- Key prefix (first 8 chars)
- Which key it matches
- Instructions to verify usage

## 🎯 Next Steps

1. **Check Railway logs** for the key prefix
2. **Match it** to your Anthropic console
3. **If wrong key**: Update Railway variable
4. **If correct key but "Never"**: Check for API call failures in logs
5. **If no API calls**: Verify backend is receiving requests

## 📊 Expected Usage Pattern

If Atlas is working correctly, you should see:
- ✅ API calls in Railway logs
- ✅ Usage in Anthropic console (updates within minutes)
- ✅ Cost accumulating in Anthropic console

If you see usage in Anthropic but key shows "Never", it might be a display delay (check again in a few minutes).

