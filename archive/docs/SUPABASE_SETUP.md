# 🔧 Supabase Setup Guide - Fix Network Error

## **Problem Identified:**
Your current Supabase URL `https://sxxfwwehrnczhgudwutq.supabase.co` is invalid and causing `net::ERR_NAME_NOT_RESOLVED` errors.

## **Solution: Create a New Supabase Project**

### **Step 1: Go to Supabase Dashboard**
1. Open your browser
2. Go to [https://supabase.com](https://supabase.com)
3. Sign in to your account

### **Step 2: Create New Project**
1. Click **"New Project"**
2. Choose your organization
3. Enter project name: `atlas-ai-app`
4. Enter database password (save this!)
5. Choose region closest to you
6. Click **"Create new project"**

### **Step 3: Get Your Project Credentials**
1. Wait for project to finish setting up (2-3 minutes)
2. Go to **Settings** → **API**
3. Copy the **Project URL** (should look like `https://abc123.supabase.co`)
4. Copy the **anon public** key (starts with `eyJ...`)

### **Step 4: Update Your .env File**
Replace your current `.env` file with:

```env
PORT=3001
NODE_ENV=development
VITE_SUPABASE_URL=https://your-new-project-url.supabase.co
VITE_SUPABASE_ANON_KEY=your-new-anon-key
ANTHROPIC_API_KEY=sk-ant-api03-7kvow7Ggd8iCHZXLQA7IPQJO_AIoTMCdUdLFAtMTaJBgbkcnoG9EixuPMsHHlB0uw3DZkmGhwe_pN
Za-ik9sIg-E4hIYQAA
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,http://localhost:5175
```

### **Step 5: Test the Connection**
1. Save the `.env` file
2. Restart your development server
3. Try signing up again

## **Alternative: Use Local Development Mode**

If you want to continue developing without Supabase for now:

1. The app will automatically fall back to offline mode
2. You can still test the UI and functionality
3. Authentication will be simulated locally

## **Quick Fix Commands:**

```bash
# Restart your development server
npm run dev

# Or if using Vite directly
npx vite --port 5173
```

## **Need Help?**
- Check Supabase status: [https://status.supabase.com](https://status.supabase.com)
- Supabase documentation: [https://supabase.com/docs](https://supabase.com/docs) 