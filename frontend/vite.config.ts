import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
//
// For the single-domain deployment the React app is built directly into the
// Laravel app's `public/` directory, so it is served from the same origin as
// the API (which lives under `/api`). Assets are emitted under `public/app`
// to avoid clobbering Laravel's own files (index.php, .htaccess, etc.).
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: '../backend/public',
    emptyOutDir: false,
    assetsDir: 'app',
  },
})
