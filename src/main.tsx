import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AtlasApp from './App'
import './index.css'
import { initSentry, SentryErrorBoundary } from './services/sentryService'

// ✅ CRITICAL: Force include zustand-wrapper export chain to prevent tree-shaking
// This ensures 'create' export is never stripped by Vercel/Rollup build
import './lib/vercel-rebuild'
import './lib/cache-buster' // ✅ Force cache invalidation

// ✅ DEPLOYMENT VERIFICATION: Log build version to verify deployment
const buildVersion = import.meta.env.VITE_BUILD_VERSION || import.meta.env.VITE_APP_VERSION || 'dev';
const deployTime = import.meta.env.VITE_DEPLOY_TIME || new Date().toISOString();
console.log(`[Atlas] Build: ${buildVersion} | Deployed: ${deployTime}`);
console.log(`[Atlas] 🔄 Cache Check: If you see this, new bundle loaded!`);
console.log(`[Atlas] 🔍 VoiceV2 Auth Fix: Active (waiting for session_started before audio)`);

// Initialize Sentry before rendering app
initSentry()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SentryErrorBoundary fallback={({ error, resetError }) => (
      <div className="min-h-screen flex items-center justify-center p-4">
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
