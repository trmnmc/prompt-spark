// Single-file build for the hosted showcase at swarm.fenley.ai/projects/prompt-spark.
// The Northstar slug route serves exactly one HTML file per project, so this
// config inlines every chunk. Entry is showcase.html -> main.showcase.tsx,
// which mounts the ORIGINAL generator (ui/App) rather than the NorthstarApp
// sandbox that main.tsx currently mounts. The dev/test contract stays in
// vite.config.ts (FROZEN) — this file is additive, used via:
//   npx vite build --config vite.singlefile.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: 'dist-single',
    rollupOptions: { input: 'showcase.html' },
  },
})
