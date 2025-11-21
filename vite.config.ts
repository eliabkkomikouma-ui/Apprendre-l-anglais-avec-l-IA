import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Charge les variables d'environnement depuis process.env ou .env
  const env = loadEnv(mode, '.', '');
  
  return {
    plugins: [react()],
    define: {
      // Permet d'utiliser process.env.API_KEY dans le code frontend
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    },
    server: {
      host: true
    }
  };
});