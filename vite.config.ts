import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const base = mode === 'development' ? '/' : './';
    return {
      server: {
        port: 3000,      // Frontend stays on 3000
        host: '0.0.0.0',
        proxy: {
          '/socket.io': {
            target: 'http://localhost:3001', // <--- Point Proxy to Backend 3001
            ws: true,
            changeOrigin: true,
          },
          '/api': {
            target: 'http://localhost:3001', // <--- Point Proxy to Backend 3001
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