import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const base = mode === 'development' ? '/' : './';

  const FRONTEND_PORT = parseInt(env.VITE_PORT || '3000');
  const BACKEND_PORT = parseInt(env.PORT || '3001');

  return {
    // THIS IS THE CRITICAL ADDITION

    // END OF ADDITION

    server: {
      port: FRONTEND_PORT,
      host: '0.0.0.0',
      proxy: {
        '/socket.io': {
          target: `http://localhost:${BACKEND_PORT}`,
          ws: true,
          changeOrigin: true,
        },
        '/api': {
          target: `http://localhost:${BACKEND_PORT}`,
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