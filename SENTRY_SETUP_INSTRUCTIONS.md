# Sentry Setup Instructions

## ✅ Sentry Integration is Already Implemented

The Atlas codebase already has full Sentry integration ready. You just need to add your Sentry DSN to enable it.

## 🚀 To Enable Sentry Error Tracking:

1. **Get your Sentry DSN:**
   - Go to https://sentry.io/
   - Create a new project (or use existing)
   - Choose "Browser JavaScript" as platform
   - Copy your DSN (looks like: `https://abc123@o12345.ingest.sentry.io/1234567`)

2. **Add to your `.env` file:**
   ```bash
   VITE_SENTRY_DSN=https://your-actual-dsn@sentry.io/your-project-id
   ```

3. **Restart the development server:**
   ```bash
   cd /Users/jasoncarelse/atlas && pkill -9 -f "npm.*dev" && npm run dev
   ```

## 📊 What Gets Tracked:

- ✅ JavaScript errors in production
- ✅ API errors and failures
- ✅ Voice call errors
- ✅ Sync failures
- ✅ Performance metrics
- ✅ User context (tier, userId)

## 🔧 Configuration:

The Sentry integration is configured in:
- `src/services/sentryService.ts` - Main initialization
- `src/lib/sentry.ts` - Custom error logger
- `backend/server.mjs` - Backend error handler

## 🎯 Production Settings:

- **Sample Rate**: 10% of transactions (configurable)
- **Environment**: Automatically detected
- **User Context**: Automatically attached
- **Source Maps**: Enabled for better debugging

## ⚠️ Important Notes:

1. Sentry is **disabled in development** by default (no DSN warning is normal)
2. Add `VITE_SENTRY_DSN` to production environment variables
3. The integration automatically captures:
   - Unhandled errors
   - Promise rejections
   - API failures
   - Performance issues

That's it! Once you add the DSN, Sentry will start tracking errors automatically.
