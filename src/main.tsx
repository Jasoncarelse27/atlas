import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AtlasApp from './App'
import './index.css'

// Development diagnostics
if (process.env.NODE_ENV === 'development') {
  import('./dev/whyDidYouRender');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AtlasApp />
  </StrictMode>,
)
