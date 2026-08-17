import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' makes the build work on ANY static host path:
// GitHub Pages (user.github.io/repo/), Netlify Drop, Vercel, cPanel, etc.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    target: 'es2019',
    chunkSizeWarningLimit: 1200,
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
})
