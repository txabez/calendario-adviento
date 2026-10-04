import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@theme'
import './styles/index.css'
import Admin from './pages/Admin.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Admin />
  </StrictMode>,
)
