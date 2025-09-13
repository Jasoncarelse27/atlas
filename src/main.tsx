import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AtlasApp from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AtlasApp />
  </StrictMode>,
)
