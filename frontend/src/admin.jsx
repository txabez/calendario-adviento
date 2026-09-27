import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@theme'
import './styles/base.css'
import Admin from './pages/Admin.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Admin />
  </StrictMode>,
)
