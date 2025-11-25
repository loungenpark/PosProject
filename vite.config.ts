import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const base = mode === 'development' ? '/' : './';

    // NEW LOGIC: Read ports from .env.local
    // If VITE_PORT is in .env (e.g. 4000), use it. Otherwise, default to 3000.
    const FRONTEND_PORT = parseInt(env.VITE_PORT || '3000');
    // If PORT is in .env (e.g. 4001), use it. Otherwise, default to 3001.
    const BACKEND_PORT = parseInt(env.PORT || '3001');

    return {
      server: {
        port: FRONTEND_PORT,      // Uses variable instead of hardcoded 3000
        host: '0.0.0.0',
        proxy: {
          '/socket.io': {
            target: `http://localhost:${BACKEND_PORT}`, // Uses variable instead of 3001
            ws: true,
            changeOrigin: true,
          },
          '/api': {
            target: `http://localhost:${BACKEND_PORT}`, // Uses variable instead of 3001
            changeOrigin: true,
          }
        }
      },
      plugins: [react()],
      base: base, 
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});