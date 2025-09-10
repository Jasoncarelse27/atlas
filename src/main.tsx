import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AtlasApp from './App'
import './index.css'

// Development diagnostics
if (process.env.NODE_ENV === 'development') {
  // Development-specific code can go here
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AtlasApp />
  </StrictMode>,
)
