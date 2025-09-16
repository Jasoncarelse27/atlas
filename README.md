# Atlas AI - Intelligent Chat Application

A modern, scalable AI chat application with support for multiple AI models (Claude, Groq, Opus), voice input, image processing, and real-time insights.

## 🚀 Features

- **Multi-Model AI Support**: Switch between Claude, Groq, and Opus models
- **Voice Input**: Speech-to-text functionality with real-time transcription
- **Image Processing**: Upload and analyze images with AI
- **Real-time Insights**: Conversation analytics and usage statistics
- **Subscription Management**: Free tier with upgrade options
- **Supabase Integration**: Secure authentication and data storage
- **Railway Deployment**: Production-ready backend deployment
- **Modular Architecture**: Clean, maintainable component structure

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
