import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AtlasApp from './App'
import './index.css'
import { initSentry, SentryErrorBoundary } from './services/sentryService'

// ✅ CRITICAL: Force include zustand-wrapper export chain to prevent tree-shaking
// This ensures 'create' export is never stripped by Vercel/Rollup build
import './lib/cache-buster'; // ✅ Force cache invalidation
import './lib/vercel-rebuild'

// ✅ DEPLOYMENT VERIFICATION: Log build version to verify deployment
const buildVersion = import.meta.env.VITE_BUILD_VERSION || import.meta.env.VITE_APP_VERSION || Date.now().toString();
const deployTime = import.meta.env.VITE_DEPLOY_TIME || new Date().toISOString();
const CACHE_BUSTER_VERSION = 'magicbell-fix-v1'; // ✅ Force cache clear for MagicBell fix

// ✅ CRITICAL: Check if cached version matches current version
const CACHE_KEY = 'atlas-app-version';
const cachedVersion = localStorage.getItem(CACHE_KEY);
if (cachedVersion && cachedVersion !== CACHE_BUSTER_VERSION) {
  // Note: Using console.log here for critical cache clear message (pre-logger init)
  if (import.meta.env.DEV) {
    console.log(`[Atlas] 🔄 New version detected! Clearing cache and reloading...`);
  }
  localStorage.clear();
  sessionStorage.clear();
  // Force hard reload
  window.location.reload();
} else {
  localStorage.setItem(CACHE_KEY, CACHE_BUSTER_VERSION);
}

// Note: Keep DEV-only console.log for build info (pre-logger init, non-critical)
if (import.meta.env.DEV) {
  console.log(`[Atlas] Build: ${buildVersion} | Deployed: ${deployTime}`);
  console.log(`[Atlas] 🔄 Cache Check: If you see this, new bundle loaded!`);
  console.log(`[Atlas] 🔍 VoiceV2 Auth Fix: Active (waiting for session_started before audio)`);
  console.log(`[Atlas] ✅ Call Button Removed - Version: ${CACHE_BUSTER_VERSION}`);
}

// ✅ MOBILE FIX: Detect mobile and log environment for debugging
if (typeof window !== 'undefined') {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const isProduction = import.meta.env.PROD;
  const apiUrl = import.meta.env.VITE_API_URL || 'NOT SET';
  
  // Note: Keep DEV-only console.log for environment info (pre-logger init)
  if (import.meta.env.DEV) {
    console.log(`[Atlas] 📱 Mobile: ${isMobile ? 'YES' : 'NO'} | Production: ${isProduction ? 'YES' : 'NO'}`);
    console.log(`[Atlas] 🔗 API URL: ${apiUrl}`);
    console.log(`[Atlas] 🌐 Origin: ${window.location.origin}`);
  }
  
  // Note: Keep console.error for critical production errors (pre-logger init)
  if (isMobile && isProduction && !apiUrl) {
    console.error('[Atlas] ❌ MOBILE PRODUCTION ERROR: VITE_API_URL not set! API calls will fail.');
  }
}

// ✅ CRITICAL FIX: Global MagicBell error handler (must be BEFORE Sentry init)
// This catches unhandled promise rejections from MagicBell library before Sentry sees them
if (typeof window !== 'undefined') {
  // Suppress console errors for MagicBell 401 errors
  const originalError = console.error;
  console.error = (...args: any[]) => {
    const errorString = args.map(arg => String(arg)).join(' ');
    if (
      errorString.includes('api.magicbell.com') ||
      errorString.includes('401') ||
      errorString.includes('Unauthorized') ||
      errorString.includes('magicbell') ||
      errorString.includes('MagicBell')
    ) {
      // Suppress MagicBell errors silently
      if (import.meta.env.DEV) {
        console.debug('[MagicBell] Suppressed console error:', args);
      }
      return;
    }
    originalError.apply(console, args);
  };

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message = reason?.message || String(reason || '').toLowerCase();
    const errorString = JSON.stringify(reason || {}).toLowerCase();
    const stack = reason?.stack || '';
    
    // Check if this is a MagicBell-related error
    const isMagicBellError = 
      message.includes('magicbell') ||
      message.includes('MagicBell') ||
      message.includes('api.magicbell.com') ||
      message.includes('jwt_auth_failed') ||
      message.includes('Unable to authenticate') ||
      message.includes('Unexpected response body for error status') ||
      errorString.includes('magicbell') ||
      errorString.includes('jwt_auth_failed') ||
      stack.includes('magicbell') ||
      (typeof reason === 'object' && reason !== null && 'errors' in reason && 
       Array.isArray((reason as any).errors) &&
       (reason as any).errors.some((e: any) => 
         e.code === 'jwt_auth_failed' || 
         e.message?.toLowerCase().includes('magicbell') ||
         e.message?.toLowerCase().includes('unable to authenticate')
       ));
    
    if (isMagicBellError) {
      // Prevent error from reaching Sentry
      event.preventDefault();
      // Silent suppression - MagicBell is non-critical
      // Note: Keep console.debug for MagicBell suppression (pre-logger init, non-critical)
      if (import.meta.env.DEV) {
        console.debug('[MagicBell] Suppressed unhandled rejection:', reason);
      }
    }
  });
}

// Initialize Sentry before rendering app
initSentry()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SentryErrorBoundary fallback={({ error: _error, resetError: _resetError }) => (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#F9F6F3]">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Application Error</h1>
          <p className="text-gray-600 mb-4">Something went wrong. Please reload the page.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-atlas-sage text-white rounded hover:bg-atlas-sage"
          >
            Reload Page
          </button>
        </div>
      </div>
    )}>
      <AtlasApp />
    </SentryErrorBoundary>
  </StrictMode>,
)
