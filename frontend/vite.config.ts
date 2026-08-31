import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      /* Forwards /api to the backend so the browser only ever sees one origin.
         That keeps the frontend calling relative URLs, which is what it will do
         in production behind the reverse proxy, and it means no CORS
         configuration exists to be got wrong or loosened later.

         The target is the host port that docker-compose.yml publishes for the
         backend service. Development only: `vite build` ignores this entirely. */
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
