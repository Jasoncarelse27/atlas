# 🚨 URGENT: Claude Model Retired on Oct 29, 2025!

## The Problem
Atlas was broken because **`claude-3-5-sonnet-20240620` was retired YESTERDAY** (October 29, 2025).

## What I Fixed

### 1. **Token Limit Issue**
- ❌ `max_tokens: 512` (too low, causing errors)
- ✅ `max_tokens: 2000` (fixed in `messageService.js`)

### 2. **Model Names Updated**
All backend files updated to use the NEW model:

| Tier | OLD (Broken) | NEW (Working) |
|------|--------------|---------------|
| **Free** | `claude-3-haiku-20240307` | `claude-3-haiku-20240307` ✅ (still works) |
| **Core** | `claude-3-5-sonnet-20240620` ❌ | `claude-sonnet-4-5-20250929` ✅ |
| **Studio** | `claude-3-5-sonnet-20240620` ❌ | `claude-sonnet-4-5-20250929` ✅ |

### Files Updated:
1. ✅ `backend/services/messageService.js` - MODEL_MAP
2. ✅ `backend/server.mjs` - All model references  
3. ✅ `backend/config/intelligentTierSystem.mjs` - Cost tracking

## Current Status
- **Backend Running**: PID `82975`
- **Using Model**: `claude-sonnet-4-5-20250929`
- **Health**: ✅ Working

## Test It Now!
Go to `https://192.168.0.10:5174` and send a message - it should work!

## Important Note
Anthropic retired the old Sonnet model on **October 29, 2025** (yesterday).
Always check for model deprecations at: https://docs.anthropic.com/en/docs/resources/model-deprecations
