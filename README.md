# Atlas AI - Intelligent Chat Application

A modern, scalable AI chat application with support for multiple AI models (Claude, Groq, Opus), voice input, image processing, and real-time insights.

## 🔐 Security Status
[![Secret Scan](https://github.com/Jasoncarelse27/atlas/actions/workflows/secret-scan.yml/badge.svg)](https://github.com/Jasoncarelse27/atlas/actions/workflows/secret-scan.yml)

## 🚀 Features

- **Multi-Model AI Support**: Switch between Claude, Groq, and Opus models
- **Voice Input**: Speech-to-text functionality with real-time transcription
- **Image Processing**: Upload and analyze images with AI
- **Real-time Insights**: Conversation analytics and usage statistics
- **Subscription Management**: Free tier with upgrade options
- **Supabase Integration**: Secure authentication and data storage
- **Railway Deployment**: Production-ready backend deployment
- **Modular Architecture**: Clean, maintainable component structure
- **Unified Auth System**: Automatic token handling with centralized error management
- **Usage Indicator**: Real-time message count and tier status display
- **Tier Enforcement**: Automatic daily limits and upgrade prompts

## 💎 Development Workflow

**Ultra-Tier Development Guide**

Atlas is developed using ChatGPT Pro + Cursor Ultra for maximum velocity and quality.

- 📖 **[Cursor Workflow Guide](./CURSOR_WORKFLOW.md)** - Complete guide for model switching and best practices
- ⚡ **[Quick Reference Card](./CURSOR_QUICK_REFERENCE.md)** - Pin this for daily development
- 🎯 **[Production Readiness Plan](./atlas-production-readiness.plan.md)** - Deployment checklist
- 📊 **[Clean Implementation Status](./CLEAN_IMPLEMENTATION_TODO.md)** - ✅ 100% Complete

### Quick Start Commands
```bash
# Daily standup
git pull origin main && npm install

# Model control
/set-model auto                    # Balanced (default)
/set-model claude-3-opus          # Deep reasoning
/set-model claude-3.5-sonnet      # Fast iteration

# Verification
npm run typecheck && npm run build && npm test
```

## 🏗️ Architecture

### Frontend Components
- **MessageRenderer**: Displays chat messages with proper formatting
- **VoiceInput**: Handles voice recording and transcription
- **SubscriptionGate**: Manages subscription limits and upgrades
- **QuickStartSuggestions**: Provides helpful prompt suggestions
- **InsightsDashboard**: Shows conversation analytics
- **RailwayPingTest**: Tests backend connectivity

### Backend Services
- **JWT Authentication**: Supabase token verification
- **Message API**: Secure message storage and retrieval
- **AI Model Routing**: Support for multiple AI providers
- **Health Monitoring**: Comprehensive health checks
- **Tier Enforcement**: Daily limits and budget tracking
- **Usage Analytics**: Real-time usage statistics and monitoring

### Auth & Tier System
- **authFetch.ts**: Unified API client with automatic token handling
- **useUsageIndicator**: React hook for real-time usage tracking
- **ChatFooter**: Usage display component with upgrade prompts
- **Centralized Error Handling**: 401/429 response management

## 🔐 Auth + Tier Handling System

Atlas now includes a comprehensive authentication and tier management system that provides seamless user experience with automatic error handling and usage tracking.

### Key Components

#### 1. **authFetch.ts** - Unified API Client
- **Automatic Token Handling**: Detects environment and uses appropriate Supabase keys
- **Smart Retry Logic**: Automatically retries on 401 with token refresh
- **Centralized Error Handling**: 401 → session expired, 429 → tier limits
- **Toast Notifications**: User-friendly error messages
- **Debug Logging**: Development mode with `VITE_DEBUG_AUTH=1`

#### 2. **useUsageIndicator** - Real-time Usage Tracking
- **Live Updates**: Fetches usage stats from `/admin/usage` endpoint
- **Tier Display**: Shows appropriate messaging for Free/Core/Studio tiers
- **Upgrade Prompts**: Automatically suggests upgrades when limits are reached
- **Periodic Refresh**: Updates every 5 minutes automatically

#### 3. **ChatFooter** - Usage Display Component
- **Free Tier**: "⚠️ 3 messages remaining today"
- **Core Tier**: "🌱 Core (unlimited messages)"
- **Studio Tier**: "🚀 Studio (unlimited messages)"
- **Upgrade Button**: Appears when user has ≤3 messages remaining
- **Refresh Control**: Manual refresh button for immediate updates

### Error Handling Flow

```
401 Unauthorized → Retry once → Toast + Redirect to Login
429 Daily Limit → Toast + Auto-trigger Upgrade Modal
429 Budget Limit → Toast + Auto-trigger Upgrade Modal
Network Error → Toast + Retry suggestion
```

### Environment Variables Required

```bash
# Supabase (Required)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

# Debug (Optional)
VITE_DEBUG_AUTH=1  # Enable verbose auth logging
```

### Usage in Components

```typescript
// Replace fetch calls with authApi
import { authApi } from '../services/authFetch';

const data = await authApi.post('/message', { message: 'Hello' });

// Add usage indicator to chat
import ChatFooter from '../components/ChatFooter';

<ChatFooter onUpgradeClick={() => showUpgradeModal()} />
```

### Testing with Supabase User Sessions

To test the auth system locally, you'll need a valid Supabase user session token:

#### 1. Create a Test User
```bash
# Using Supabase CLI (if available)
supabase auth signup --email test@atlas.com --password password123

# Or create directly in Supabase Dashboard:
# 1. Go to Authentication → Users
# 2. Click "Add User"
# 3. Email: test@atlas.com, Password: password123
```

#### 2. Get Session Token
```typescript
// In browser console on your Atlas app
import { supabase } from './src/config/supabase';

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'test@atlas.com',
  password: 'password123'
});

// Get token
const token = data.session?.access_token;
console.log('Token:', token);
```

#### 3. Test API Endpoints
```bash
# Test message endpoint with token
curl -X POST http://localhost:3000/message \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello Atlas"}'

# Test usage endpoint
curl -X GET http://localhost:3000/admin/usage \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

#### 4. Frontend Testing
- Open Atlas at `http://localhost:5173`
- Sign in with test user credentials
- Check browser console for auth debug logs (if `VITE_DEBUG_AUTH=1`)
- Verify ChatFooter shows correct usage information
- Test sending messages and observe usage updates

## 🛡️ Production Hardening + Automation

Atlas includes comprehensive production security and automation features:

### Security Middleware
- **Helmet**: Security headers (CSP, XSS protection, etc.)
- **CORS Allowlist**: Restricted origins for localhost, Vercel, and Railway domains
- **Rate Limiting**: 
  - Global: 100 requests per 15 minutes per IP
  - Messages: 20 requests per minute per IP
- **JSON Limit**: 2MB request body limit
- **Request Logging**: Morgan logging (dev format in development, combined in production)

### Error Handling
- **Global Error Handler**: Returns `{"error":"INTERNAL_ERROR","message":"Something went wrong"}` in production
- **Unhandled Rejection Handling**: Logs but doesn't crash the process
- **Uncaught Exception Handling**: Logs but doesn't crash the process

### Automated Test User Creation
- **Non-blocking Railway Post-Deploy**: Automatically creates test user after deployment
- **Manual Creation**: Run `npm run create-test-user` to create test user locally
- **Safe Operation**: Won't create duplicates if user already exists

### Database Cleanup Automation
- **Daily Cleanup Job**: Automatically removes old records to keep database lean
- **Cleanup Schedule**: Runs nightly at 00:10 server time
- **Retention Periods**:
  - Daily usage: 35 days
  - Budget tracking: 60 days  
  - Prompt cache: 30 days
- **Graceful Fallback**: If pg_cron isn't available, cleanup can be run manually

### Manual Cleanup Commands
```bash
# Create test user manually
npm run create-test-user

# Run database cleanup manually (if pg_cron not available)
# Connect to Supabase SQL Editor and run:
# SELECT rotate_daily_usage();
# SELECT compact_budget_tracking();
# SELECT cleanup_old_cache_entries();
```

## 🚦 Staging Environment

Railway staging uses the same Supabase project as production.

### Environment Variables
Ensure you copy the following keys into Railway → Staging → Variables:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

**Note**: For staging you can safely use the `default` secret key.

### Staging Configuration
- **Environment**: `NODE_ENV=staging`
- **API URL**: `https://atlas-staging.up.railway.app`
- **Paddle**: Uses sandbox environment
- **Database**: Same Supabase project as production
- **Test User**: Automatically created via post-deploy hook

### Setting Up Staging
1. Copy `.env.staging.example` to `.env.staging`
2. Add environment variables to Railway → Staging → Variables
3. Trigger redeploy
4. Verify health endpoint: `https://atlas-staging.up.railway.app/healthz`

## 🛠️ Setup Instructions

### Prerequisites
- Node.js 20+ (see Node.js Version section below)
- npm 8+
- Supabase account
- Railway account (for deployment)
- MailerLite account (for email automation)

## MailerLite Integration

- **Local Dev:** Defaults to mock (no API calls).
- **CI/CD:** Always mock (safe for pipelines).
- **Production:** Real MailerLite enabled when MAILERLITE_API_KEY is set.

### Production Safety
⚠️ **Important:** The app will refuse to boot if `MAILERLITE_API_KEY` is missing in production environment. This prevents silent email failures in production.

## Email Failures

All failed email attempts are automatically logged to Supabase for visibility and debugging:

- **Database Table**: `email_failures` in Supabase
- **Logged Data**: recipient email, template name, error message, timestamp
- **Automatic Logging**: Real service logs API failures, mock service logs simulated failures
- **Developer Tools**: Use `npm run check:failures` to view recent failures

### Checking Email Failures

```bash
# View recent email failures (requires Supabase credentials)
npm run check:failures

# Simulate failures for testing
SIMULATE_FAILURE=true npm run test
```

**CLI Command**: `npm run check:failures`
- Uses TypeScript with ts-node for better type safety
- Supports both service role key and anon key
- Shows last 10 email failures with full context
- Graceful error handling and credential detection

### Database Schema

```sql
-- View all email failures
select * from email_failures order by created_at desc;

-- View failures by template
select * from email_failures where template = 'welcome';

-- View recent failures (last 24 hours)
select * from email_failures where created_at >= now() - interval '24 hours';
```

## Node.js Version

Atlas requires Node.js v20 or later.
- **Recommended**: Node.js v22 (for alignment with future Supabase/Vite updates)
- **Supported**: Node.js v20 (current Mac setup works fine)

You can use [nvm](https://github.com/nvm-sh/nvm) to switch between versions easily.

### 1. Clone and Install Dependencies

```bash
git clone https://github.com/Jasoncarelse27/atlas-ai-app.git
cd atlas-ai-app

# Install backend dependencies
npm install

# Install frontend dependencies
cd deploy
npm install
cd ..
```

### 2. Environment Configuration

Create `.env` file in the root directory:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Backend Configuration
VITE_BACKEND_URL=http://localhost:8000
PORT=8000
NODE_ENV=development

# AI Model API Keys (add as needed)
CLAUDE_API_KEY=your_claude_api_key
GROQ_API_KEY=your_groq_api_key
OPUS_API_KEY=your_opus_api_key
```

### 3. Supabase Setup

1. Create a new Supabase project
2. Run the following SQL to create the messages table:

```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content JSONB NOT NULL,
  model TEXT DEFAULT 'claude',
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own messages" ON messages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own messages" ON messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own messages" ON messages
  FOR UPDATE USING (auth.uid() = user_id);
```

### 4. Development

#### Start Backend Server
```bash
npm run dev
# Backend runs on http://localhost:8000
```

#### Start Frontend Development Server
```bash
cd deploy
npm run dev
# Frontend runs on http://localhost:5173
```

### 5. Railway Deployment

1. Connect your GitHub repository to Railway
2. Set environment variables in Railway dashboard
3. Deploy using the provided `Dockerfile.railway`

```bash
# Railway will automatically detect and deploy the backend
# The Dockerfile.railway is configured for backend-only deployment
```

## 🗄️ Database Migrations

### Running Supabase Migrations

1. **Apply Base Schema** (run first):
   ```bash
   # In Supabase Studio SQL Editor, run:
   # Copy contents from: supabase/migrations/20250115_atlas_v1_schema.sql
   ```

2. **Apply Phase 5 Triggers** (run after base schema):
   ```bash
   # In Supabase Studio SQL Editor, run:
   # Copy contents from: supabase/migrations/20250916_phase5_triggers.sql
   ```

3. **Test Triggers** (optional verification):
   ```bash
   # In Supabase Studio SQL Editor, run:
   # Copy contents from: supabase/tests/phase5.test.sql
   ```

### Migration Order
1. ✅ Base schema (messages, conversations, profiles tables)
2. ✅ Phase 5 triggers (auto-update timestamps, auto-generate titles)
3. ✅ Test automation (verify triggers work)

## 🧪 Testing

### Test Types

**Mock Tests** (always run):
```bash
npm run test src/__tests__/e2e-automation.test.ts
```
- Tests email flow configuration
- Tests retry logic with mock failures
- Tests graceful handling without API keys
- Fast, no network calls

**Integration Tests** (require API key):
```bash
# Set API key in .env.local
VITE_MAILERLITE_API_KEY=your_api_key_here

# Run integration tests
npm run test src/__tests__/mailer.integration.test.ts
```
- Tests real MailerLite API calls
- Tests retry logic with real network failures
- Tests complete email automation pipeline
- Requires valid MailerLite API key

### CI/CD Testing
- **Mock tests**: Always run in CI/CD (fast, reliable)
- **Integration tests**: Skip if no API key provided
- **Retry logic**: Tested with mock failures in all environments

### Email Automation Testing
```bash
# Test email flows without sending real emails
npm run test src/__tests__/e2e-automation.test.ts

# Test with real MailerLite API (requires API key)
VITE_MAILERLITE_API_KEY=your_key npm run test src/__tests__/mailer.integration.test.ts
```

## 📁 Project Structure

```
atlas-ai-app/
├── backend/
│   └── server.mjs          # Express backend server
├── deploy/                 # Frontend application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── features/
│   │   │   └── chat/       # Chat feature components
│   │   │       ├── components/
│   │   │       ├── services/
│   │   │       └── hooks/
│   │   └── types/          # TypeScript type definitions
│   └── package.json
├── src/                    # Legacy frontend (being migrated)
├── Dockerfile.railway      # Railway deployment configuration
├── package.json           # Backend dependencies
└── README.md
```

## 🔧 API Endpoints

### Backend API
- `GET /healthz` - Health check
- `GET /ping` - Ping test
- `GET /api/health` - API health status
- `GET /api/status` - API status information
- `POST /api/message` - Send message (requires JWT)
- `GET /api/conversations/:id/messages` - Get conversation messages (requires JWT)

### Authentication
All protected endpoints require a valid Supabase JWT token in the Authorization header:
```
Authorization: Bearer <supabase_jwt_token>
```

## 🎯 Usage

### Basic Chat
1. Open the application in your browser
2. Type a message in the input field
3. Select your preferred AI model (Claude, Groq, or Opus)
4. Press Enter or click Send

### Voice Input
1. Click the microphone button
2. Allow microphone permissions
3. Speak your message
4. Click the stop button when finished

### Insights Dashboard
1. Click the analytics icon in the header
2. View conversation statistics and usage metrics
3. Monitor performance and activity patterns

## 🚀 Production Deployment

### Railway Backend
1. Push code to GitHub
2. Connect repository to Railway
3. Set environment variables
4. Deploy automatically

### Frontend Deployment
1. Build the frontend: `cd deploy && npm run build`
2. Deploy to Vercel, Netlify, or your preferred platform
3. Set environment variables for production

## 🔒 Security Features

- JWT token verification for all API requests
- Row Level Security (RLS) in Supabase
- CORS configuration for production
- Rate limiting on API endpoints
- Input validation and sanitization

## 📊 Monitoring

- Health check endpoints for uptime monitoring
- RailwayPingTest component for connectivity testing
- Comprehensive error logging
- Performance metrics tracking

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Check the documentation
- Review the troubleshooting guide

---

**Atlas AI** - Your intelligent conversation companion
# Trigger new workflow run
# Test Gitleaks license - run 2
# Force Vercel deployment with latest fixes
# Force new Vercel deployment
