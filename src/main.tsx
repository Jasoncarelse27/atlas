import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AtlasApp from '../atlas_ai_brain_app'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AtlasApp />
  </StrictMode>,
)
