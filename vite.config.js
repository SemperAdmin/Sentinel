import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  // Load environment variables
  const env = loadEnv(mode, process.cwd(), '')

  return {
    base: process.env.VITE_BASE_PATH || '/',
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:4000',
          changeOrigin: true,
          rewrite: (path) => path,
        },
      },
    },
    define: {
      // Explicitly define environment variables for production build
      'import.meta.env.VITE_ADMIN_PASSWORD': JSON.stringify(env.VITE_ADMIN_PASSWORD || ''),
      'import.meta.env.VITE_GITHUB_TOKEN': JSON.stringify(env.VITE_GITHUB_TOKEN || ''),
    },
  }
})