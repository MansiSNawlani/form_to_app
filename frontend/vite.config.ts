import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

/* The form definition extracted from the legacy PDF lives outside frontend/,
   because the backend seeds the FormVersion table from the same files. Aliased
   rather than copied, so there is one source for the option lists and no second
   retyped copy to drift. */
const formularDefinition = fileURLToPath(
  new URL('../database/seed/form_version_20260609', import.meta.url),
)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@formular': formularDefinition },
  },
  test: {
    /* Node, not a simulated browser. The only unit-tested logic so far is the
       draft store, which takes its storage as an argument precisely so it needs
       no DOM. Add an environment here when a test genuinely needs one. */
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  server: {
    // The alias above points outside the project root, which the dev server
    // refuses to serve unless the parent directory is allowed.
    fs: { allow: ['..'] },
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
