import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import NorthstarApp from './ui/ns/NorthstarApp'
import './styles/tokens.css'

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('Prompt Spark: missing #root element in index.html')
}

createRoot(rootEl).render(
  <StrictMode>
    <NorthstarApp />
  </StrictMode>,
)
