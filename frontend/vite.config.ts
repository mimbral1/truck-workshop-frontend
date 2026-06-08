import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    proxy: {
      // En desarrollo, el navegador llama a `/api` (mismo origen) y Vite reenvia
      // al backend Express local. Esto evita problemas de CORS y de `localhost`
      // cuando la app se sirve a traves de un port-forward, replicando el proxy
      // serverless de produccion (Vercel).
      '/api': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
    },
  },
})
