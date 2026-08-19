// Single-file build for the hosted Northstar flow at
// swarm.fenley.ai/projects/prompt-spark-northstar. Sibling of
// vite.singlefile.config.ts, which builds the ORIGINAL generator for
// /projects/prompt-spark — the two pages are hosted side by side, so each
// gets its own entry and its own inlined bundle.
//
// Entry is northstar.html -> src/main.tsx (NorthstarApp), the same entry the
// dev server mounts, so what you see in `npm run dev` is what ships here.
// The dev/test contract stays in vite.config.ts (FROZEN); this file is
// additive, used via:
//   npx vite build --config vite.northstar.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: 'dist-northstar',
    rollupOptions: { input: 'northstar.html' },
  },
})
