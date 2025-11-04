# Atlas Environment Variables Guide

## Required Environment Variables

### Frontend Variables (.env)

```bash
# API Configuration
VITE_API_URL=https://your-backend-url.com  # Backend API URL (leave empty for relative URLs)
VITE_FRONTEND_URL=https://your-frontend-url.com  # Frontend URL for callbacks

# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# FastSpring Configuration
VITE_FASTSPRING_ENVIRONMENT=live  # 'test' or 'live'
VITE_FASTSPRING_STORE_ID=your-store-id
VITE_FASTSPRING_API_KEY=your-api-key
VITE_FASTSPRING_WEBHOOK_SECRET=your-webhook-secret
VITE_FASTSPRING_CORE_PRODUCT_ID=atlas-core-monthly
VITE_FASTSPRING_STUDIO_PRODUCT_ID=atlas-studio-monthly

# AI Configuration
VITE_CLAUDE_API_KEY=your-claude-key  # Optional - backend handles AI

# Sentry Error Tracking
VITE_SENTRY_DSN=https://your-dsn@sentry.io/project-id
VITE_APP_ENV=production  # 'development', 'staging', or 'production'
VITE_APP_VERSION=1.0.0  # Your app version
```

### Backend Variables (.env)

```bash
# Server Configuration
PORT=3000
NODE_ENV=production  # 'development' or 'production'
HOST_IP=0.0.0.0  # Network interface to bind to

# CORS Configuration
FRONTEND_URL=https://your-frontend-url.com
BACKEND_URL=https://your-backend-url.com

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI API Keys
CLAUDE_API_KEY=your-claude-key
ANTHROPIC_API_KEY=your-anthropic-key  # Alternative to CLAUDE_API_KEY
OPENAI_API_KEY=your-openai-key  # For embeddings
GROQ_API_KEY=your-groq-key  # Optional alternative AI

# Speech-to-Text (Deepgram) - Required for voice calls
DEEPGRAM_API_KEY=your-deepgram-api-key  # Get from https://console.deepgram.com/

# FastSpring Backend Configuration
FASTSPRING_API_KEY=your-api-key
FASTSPRING_WEBHOOK_SECRET=your-webhook-secret

# Monitoring & Error Tracking
SENTRY_DSN=https://your-dsn@sentry.io/project-id  # Same DSN as frontend
LOG_LEVEL=info  # 'debug', 'info', 'warn', 'error'
APP_VERSION=1.0.0  # Match frontend version
```

## Environment-Specific Configurations

### Development (.env.local)

```bash
# Development overrides
VITE_API_URL=  # Leave empty for proxy to work
NODE_ENV=development
LOG_LEVEL=debug
```

### Staging (.env.staging)

```bash
# Staging environment
NODE_ENV=staging
VITE_API_URL=https://atlas-staging.up.railway.app
FRONTEND_URL=https://atlas-staging.netlify.app
VITE_FASTSPRING_ENVIRONMENT=test
```

### Production (.env.production)

```bash
# Production environment
NODE_ENV=production
VITE_API_URL=https://api.atlas.ai
FRONTEND_URL=https://atlas.ai
VITE_FASTSPRING_ENVIRONMENT=live
LOG_LEVEL=warn
```

## Mobile Development Configuration

For mobile development, ensure these are set correctly:

```bash
# Backend should bind to all interfaces
HOST_IP=0.0.0.0

# Frontend should use relative URLs
VITE_API_URL=  # Empty for relative URLs

# Or specify your local network IP
VITE_API_URL=http://192.168.1.100:3000
```

## Security Notes

1. **Never commit .env files** - Use .env.example as templates
2. **Service Role Keys** - Only use in backend, never expose to frontend
3. **API Keys** - Rotate regularly and use different keys per environment
4. **Webhook Secrets** - Generate strong random strings

## Validation Script

Run this to validate your environment:

```bash
node scripts/validate-env.js
```

## Common Issues

### CORS Errors
- Ensure `FRONTEND_URL` matches your actual frontend URL
- Include protocol (http:// or https://)

### Mobile Can't Connect
- Backend must listen on `0.0.0.0`, not `localhost`
- Use your machine's network IP in `VITE_API_URL`

### FastSpring Not Working
- Verify all FastSpring env vars are set
- Check webhook secret matches FastSpring dashboard
- Ensure product IDs exist in FastSpring

### Missing Environment Variables
- Check logs for "Missing environment variable" warnings
- Use the validation script to find missing vars
