import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const BACKEND = 'http://localhost:8001';
const proxyTo = { target: BACKEND, changeOrigin: true };

export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            '/api': proxyTo,
            '/registry': proxyTo,
            '/servers': proxyTo,
            '/skills': proxyTo,
            '/workflows': proxyTo,
            '/agents': proxyTo,
            '/llm-providers': proxyTo,
            '/sync': proxyTo,
            '/projects': proxyTo,
            '/targets': proxyTo,
            '/mcp-registry': proxyTo,
        },
    },
});
