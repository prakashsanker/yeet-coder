import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Backend port - can be overridden with VITE_BACKEND_PORT env var
const backendPort = process.env.VITE_BACKEND_PORT || '3001'
const backendUrl = `http://localhost:${backendPort}`
const backendWsUrl = `ws://localhost:${backendPort}`

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: backendUrl,
        changeOrigin: true,
      },
      '/ws': {
        target: backendWsUrl,
        ws: true,
      },
    },
  },
})
