import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AtlasApp from './App'
import './index.css'
import { initSentry, SentryErrorBoundary } from './services/sentryService'

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
