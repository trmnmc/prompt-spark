// Showcase entry: mounts the ORIGINAL Prompt Spark generator (ui/App), which
// main.tsx stopped mounting when this repo doubled as the Northstar UI sandbox
// (83cd2d1 swapped in NorthstarApp). Built only by vite.singlefile.config.ts
// for the hosted page at swarm.fenley.ai/projects/prompt-spark.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './ui/App'
import './styles/tokens.css'

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('Prompt Spark: missing #root element in showcase.html')
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
