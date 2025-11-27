import { defineConfig } from 'vite'

export default defineConfig({
  // For GitHub Pages: use repository name as base
  // For Render.com or custom domain: use '/'
  base: process.env.VITE_BASE_PATH || '/Sentinel/',
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (path) => path,
      },
    },
  },
})