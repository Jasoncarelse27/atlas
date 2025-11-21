# MagicBell Error Suppression Documentation

## Problem
MagicBell API returns 401 errors when API keys are not configured, which clutters the console even though the app handles it gracefully.

## Solution
We suppress MagicBell errors at multiple levels:

### 1. Console Error Interception (src/main.tsx)
```typescript
// Suppresses these patterns:
- api.magicbell.com
- 401
- Unauthorized
- Failed to load resource
- /v2/notifications
- /v2/channels
```

### 2. Hook Level (src/hooks/useMagicBell.ts)
- Uses `preventRedirect: true` and `showErrorToast: false` in fetchWithAuth
- Returns early with null state when API keys are missing
- Logs only in development mode with logger.debug

### 3. Component Level (src/components/NotificationCenter.tsx)
- Already has error boundary to catch and suppress MagicBell errors

### 4. Sentry Level (src/services/sentryService.ts)
- Ignores errors containing 'api.magicbell.com' and related patterns

## Expected Behavior
When MagicBell API keys are not configured:
- No 401 errors in console
- Notification center silently disabled
- App continues functioning normally
- No impact on user experience

## Configuration
To enable MagicBell:
1. Set `VITE_MAGICBELL_API_KEY` in frontend env
2. Set `MAGICBELL_API_KEY` and `MAGICBELL_API_SECRET` in backend env
3. Restart both frontend and backend servers
