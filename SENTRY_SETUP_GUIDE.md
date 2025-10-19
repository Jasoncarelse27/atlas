# Atlas Sentry Error Tracking Setup Guide

## Overview

Atlas uses Sentry for unified error tracking across web and mobile platforms with comprehensive PII masking to ensure GDPR compliance.

## Features

- ✅ **Unified DSN**: Same Sentry project for web + mobile
- ✅ **PII Masking**: Automatic redaction of sensitive data
- ✅ **Environment Separation**: dev/staging/prod isolation
- ✅ **Performance Monitoring**: 10% sampling in production
- ✅ **Error Fingerprinting**: Smart grouping of similar errors
- ✅ **Source Maps**: Full stack traces in production

## Quick Setup

### 1. Create Sentry Project

1. Sign up at [sentry.io](https://sentry.io)
2. Create new project → Select "React" for frontend
3. Copy your DSN: `https://YOUR-KEY@sentry.io/PROJECT-ID`

### 2. Add Environment Variables

```bash
# Frontend (.env)
VITE_SENTRY_DSN=https://YOUR-KEY@sentry.io/PROJECT-ID
VITE_APP_ENV=production
VITE_APP_VERSION=1.0.0

# Backend (.env)
SENTRY_DSN=https://YOUR-KEY@sentry.io/PROJECT-ID
APP_VERSION=1.0.0
NODE_ENV=production
```

### 3. Deploy & Test

```bash
# Test error tracking
curl -X POST http://localhost:3000/api/test-sentry-error

# Check Sentry dashboard for the error
```

## PII Protection

Atlas automatically masks:
- Email addresses → `[EMAIL]`
- Phone numbers → `[PHONE]`
- SSNs → `[SSN]`
- Credit cards → `[CREDIT_CARD]`
- UUIDs/User IDs → `[UUID]`
- Auth tokens → `[TOKEN]`
- API keys → `[API_KEY]`

## Environment Configuration

### Development
- Errors NOT sent to Sentry (console only)
- Full stack traces visible
- 100% performance sampling

### Staging
```bash
VITE_APP_ENV=staging
NODE_ENV=staging
```
- Errors sent to Sentry
- Tagged with `environment: staging`
- 100% performance sampling

### Production
```bash
VITE_APP_ENV=production
NODE_ENV=production
```
- Errors sent to Sentry
- Tagged with `environment: production`
- 10% performance sampling
- Source maps uploaded for debugging

## Advanced Configuration

### Custom Error Context

```typescript
// Frontend
import { captureException } from '@/services/sentryService';

captureException(error, {
  userId: user.id,
  tier: user.tier,
  feature: 'voice-recording',
  action: 'upload-failed'
});

// Backend
import { captureException } from './lib/sentryService.mjs';

captureException(error, {
  endpoint: req.path,
  userId: req.user?.id,
  tier: req.user?.tier
});
```

### User Context

```typescript
// Set on login
setUserContext({
  id: user.id,
  tier: user.subscription_tier
});

// Clear on logout
clearUserContext();
```

### Breadcrumbs

```typescript
addBreadcrumb({
  message: 'User upgraded subscription',
  category: 'billing',
  level: 'info',
  data: {
    fromTier: 'free',
    toTier: 'core'
  }
});
```

## Monitoring Dashboard

### Key Metrics
1. **Error Rate**: Should be <0.5% of sessions
2. **Crash Free Rate**: Target >99.5%
3. **Performance**: P95 < 3s page load

### Alerts to Configure
1. Error spike: >100 errors/hour
2. New error type in production
3. Performance regression: P95 > 5s
4. High error rate: >1% of sessions

## Troubleshooting

### Errors Not Appearing
1. Check DSN is correct
2. Verify environment is not 'development'
3. Check browser console for Sentry init errors
4. Ensure not filtered by `ignoreErrors`

### PII Leaked
1. Check `beforeSend` hook is working
2. Add field to `PII_FIELDS` array
3. Update regex patterns for new formats

### High Noise
1. Add error to `ignoreErrors` list
2. Adjust sampling rate
3. Filter by environment tag

## Security Checklist

- [ ] DSN is in environment variables (not hardcoded)
- [ ] PII masking tested with real data
- [ ] Source maps uploaded for production
- [ ] Rate limiting configured
- [ ] Alerts set up for critical errors
- [ ] Regular review of error patterns

## Cost Management

Free tier includes:
- 5,000 errors/month
- 10,000 performance units
- 1GB attachments

To stay within limits:
1. Use 10% sampling in production
2. Filter noisy errors
3. Set rate limits
4. Archive old errors

## Integration Testing

```bash
# Frontend test
npm run test:sentry

# Backend test
npm run test:sentry:backend

# Full integration test
npm run test:sentry:e2e
```

## Next Steps

1. Set up alerts in Sentry dashboard
2. Configure release tracking
3. Add source map uploads to CI/CD
4. Set up performance monitoring
5. Configure issue ownership rules
