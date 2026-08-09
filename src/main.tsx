import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './ui/App'
import './styles/tokens.css'

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('Prompt Spark: missing #root element in index.html')
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
