# 🧪 Agents Dashboard Backend - Complete Testing Guide

## ✅ What I've Verified (Automated)

### 1. Code Implementation ✅
- ✅ All 5 routes correctly implemented in `backend/server.mjs`
- ✅ Email agent notification hook added to `backend/routes/email-agent.mjs`
- ✅ No linting errors
- ✅ All routes use `verifyJWT` middleware correctly
- ✅ Dynamic supabase imports match Atlas patterns
- ✅ Anthropic SDK correctly imported and used

### 2. Routes Verified ✅
- ✅ `GET /api/notifications` - Line 1853
- ✅ `POST /api/notifications/mark-read` - Line 1877
- ✅ `GET /api/business-notes` - Line 1901
- ✅ `POST /api/business-notes` - Line 1925
- ✅ `POST /api/business-chat` - Line 1954

### 3. Test Scripts Created ✅
- ✅ `scripts/test-agents-dashboard.sh` - Bash test script
- ✅ `scripts/test-agents-dashboard.mjs` - Node.js test script
- ✅ `supabase/migrations/verify_agents_tables.sql` - Database verification

---

## 🚀 What You Need to Do (Manual Steps)

### Step 1: Start Backend Server

```bash
cd /Users/jasoncarelse/atlas
npm run backend:dev
```

**Expected:** Server starts on `http://localhost:3000`

---

### Step 2: Get JWT Token

**Option A: Browser Console (Easiest)**
1. Open your Atlas app: `http://localhost:5173` (or your dev URL)
2. Open DevTools (F12) → Console tab
3. Run:
```javascript
const { data: { session } } = await supabase.auth.getSession();
console.log('JWT:', session?.access_token);
```
4. Copy the token

**Option B: Create Test User**
1. Supabase Dashboard → Authentication → Users → Add User
2. Email: `test@atlas.com`, Password: `password123`
3. Sign in via your app, then use Option A to get token

---

### Step 3: Run Tests

**Option A: Bash Script (Recommended)**
```bash
export SUPABASE_JWT="your_token_here"
./scripts/test-agents-dashboard.sh
```

**Option B: Node.js Script**
```bash
# Set in .env or export:
export TEST_EMAIL="test@atlas.com"
export TEST_PASSWORD="password123"
node scripts/test-agents-dashboard.mjs
```

**Option C: Manual curl Commands**
```bash
export JWT="your_token_here"

# Test 1: Get notifications
curl -X GET http://localhost:3000/api/notifications \
  -H "Authorization: Bearer $JWT" | jq

# Test 2: Create business note
curl -X POST http://localhost:3000/api/business-notes \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"content": "Test note: Meeting tomorrow at 2pm"}' | jq

# Test 3: Get business notes
curl -X GET http://localhost:3000/api/business-notes \
  -H "Authorization: Bearer $JWT" | jq

# Test 4: Business chat (memory + LLM)
curl -X POST http://localhost:3000/api/business-chat \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"content": "Reminder: Follow up with Sarah about proposal"}' | jq
```

---

### Step 4: Verify Database

**Run in Supabase SQL Editor:**
```sql
-- Use the verification script I created:
-- supabase/migrations/verify_agents_tables.sql

-- Or manually check:
SELECT * FROM notifications LIMIT 5;
SELECT * FROM business_notes LIMIT 5;
SELECT * FROM memory_auto_summaries LIMIT 5;
```

**Expected Results:**
- ✅ All 3 tables exist
- ✅ RLS enabled on all tables
- ✅ Policies created correctly
- ✅ Indexes created

---

## 🧪 Test Checklist

### Basic Functionality Tests
- [ ] Backend server starts without errors
- [ ] Health check endpoint works: `curl http://localhost:3000/healthz`
- [ ] All 5 endpoints return 401 without JWT (auth working)
- [ ] All 5 endpoints return 200 with valid JWT

### Endpoint-Specific Tests
- [ ] `GET /api/notifications` returns empty array initially
- [ ] `POST /api/business-notes` creates note successfully
- [ ] `GET /api/business-notes` returns created notes
- [ ] `POST /api/business-chat` generates LLM response
- [ ] `POST /api/notifications/mark-read` marks notification as read

### Database Tests
- [ ] Notes appear in `business_notes` table
- [ ] Summaries appear in `memory_auto_summaries` table
- [ ] Notifications appear in `notifications` table (if email agent creates them)
- [ ] RLS policies prevent cross-user data access

### Email Agent Integration
- [ ] Email agent creates notifications for important emails
- [ ] Notifications have correct `type` field (`email_agent.support`, etc.)
- [ ] Notifications include metadata (messageId, subject)

---

## 🔍 Troubleshooting

### Backend Won't Start
```bash
# Check if port 3000 is in use
lsof -i :3000

# Check .env file has required variables
cat .env | grep SUPABASE
cat .env | grep ANTHROPIC
```

### 401 Unauthorized Errors
- ✅ **Expected** if no JWT token provided
- ❌ **Problem** if token provided but still 401:
  - Token expired? Get a new one
  - Token format wrong? Should start with `eyJ...`
  - Backend can't verify? Check SUPABASE_ANON_KEY in .env

### 500 Internal Server Error
- Check backend logs for error details
- Verify Supabase connection: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set
- Check Anthropic API key for `/api/business-chat` endpoint

### Empty Results
- ✅ **Normal** if you haven't created data yet
- Create a note first, then check GET endpoints

### RLS Policy Errors
- Verify migration ran: Check Supabase Dashboard → Table Editor
- Run verification script: `supabase/migrations/verify_agents_tables.sql`
- Check policies exist: `SELECT * FROM pg_policies WHERE tablename = 'notifications';`

---

## 📊 Expected Test Results

### Without JWT Token
```
✅ GET /api/notifications → 401 Unauthorized
✅ POST /api/business-notes → 401 Unauthorized
✅ GET /api/business-notes → 401 Unauthorized
✅ POST /api/business-chat → 401 Unauthorized
✅ POST /api/notifications/mark-read → 401 Unauthorized
```

### With Valid JWT Token
```
✅ GET /api/notifications → 200 OK, {"notifications": []}
✅ POST /api/business-notes → 200 OK, {"note": {...}}
✅ GET /api/business-notes → 200 OK, {"notes": [...]}
✅ POST /api/business-chat → 200 OK, {"reply": "...", "summary": "..."}
✅ POST /api/notifications/mark-read → 200 OK, {"success": true}
```

---

## 🎯 Quick Start (Copy-Paste)

```bash
# 1. Start backend
npm run backend:dev

# 2. In another terminal, get token from browser console:
# const { data: { session } } = await supabase.auth.getSession();
# console.log(session?.access_token);

# 3. Run tests
export SUPABASE_JWT="your_token_here"
./scripts/test-agents-dashboard.sh
```

---

## ✅ What's Already Done

- ✅ Migration file created (`20251202_agents_memory_notifications.sql`)
- ✅ All backend routes implemented
- ✅ Email agent hook added
- ✅ Test scripts created
- ✅ Verification SQL script created
- ✅ Code verified (no linting errors)
- ✅ Routes registered correctly

## 🎉 You're Ready!

Everything is implemented and ready to test. Just:
1. Start backend
2. Get JWT token
3. Run test script

That's it! 🚀

