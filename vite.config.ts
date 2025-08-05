import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Load .env files based on current mode (e.g., development, production)
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return {
    define: {
      // This makes the environment variable available in your code as import.meta.env.VITE_GEMINI_API_KEY
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});