import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../dashboard',
    emptyOutDir: false, // keep monitor.html (old dashboard) until we're happy
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
