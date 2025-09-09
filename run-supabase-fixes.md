# 🚀 Atlas Supabase Fixes - Manual Steps

## The Problem
Your conversation service is failing because:
1. Missing database tables (`messages`, `webhook_logs`)
2. Missing RLS (Row Level Security) policies
3. Incorrect import paths (now fixed)

## ✅ What We've Fixed
- ✅ Fixed import path from `../config/supabase` to `../lib/supabase`
- ✅ Removed expo-crypto dependency, using `crypto.randomUUID()` instead
- ✅ Updated tier configurations with AI provider information
- ✅ Fixed conversation service to use correct tier structure

## 🔧 Manual Steps to Complete the Fix

### Step 1: Run the SQL Script
1. Go to your Supabase dashboard
2. Open the SQL Editor
3. Copy and paste the entire contents of `SUPABASE_RLS_FIXES.sql`
4. Click "Run" to execute the script

### Step 2: Verify Tables Created
After running the script, you should see these tables:
- `conversations`
- `messages` 
- `webhook_logs`
- `user_profiles`

### Step 3: Test in Your App
1. Start your development server: `npm run dev`
2. Try creating a conversation
3. Send a message
4. Check the browser console for any errors

## 🎯 Expected Results
- ✅ Conversations can be created
- ✅ Messages can be sent and saved
- ✅ AI responses work based on user tier
- ✅ No more "Failed to create conversation" errors

## 🔍 If Issues Persist
Check the browser console for specific error messages. The most common issues are:
1. **Authentication errors**: Make sure user is logged in
2. **RLS policy errors**: Verify the SQL script ran successfully
3. **Missing environment variables**: Check your `.env` file

## 📋 Environment Variables Needed
Make sure you have these in your `.env` file:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_OPENAI_API_KEY=your_openai_key
EXPO_PUBLIC_ANTHROPIC_API_KEY=your_anthropic_key
```

The conversation service should now work correctly! 🎉
