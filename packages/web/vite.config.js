import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
// Backend port - can be overridden with VITE_BACKEND_PORT env var
var backendPort = process.env.VITE_BACKEND_PORT || '3001';
var backendUrl = "http://localhost:".concat(backendPort);
var backendWsUrl = "ws://localhost:".concat(backendPort);
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
});
