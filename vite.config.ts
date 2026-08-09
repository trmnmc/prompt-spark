import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// FROZEN Layer 1 contract — do not edit after T-001 lands.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5199,
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    passWithNoTests: true,
  },
})
