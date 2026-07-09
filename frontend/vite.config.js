import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// El CSP de index.html (connect-src) solo permite mi-negocio.app y Mercado Pago —
// correcto para producción (nginx además refuerza los headers ahí), pero bloquea
// cualquier fetch a un backend local en dev. Este plugin solo corre con `vite dev`
// (apply: 'serve'), nunca en `vite build`, así que el HTML de producción no cambia.
const relaxCspForDev = {
  name: 'relax-csp-for-dev',
  apply: 'serve',
  transformIndexHtml(html) {
    return html.replace(
      /(connect-src[^;]*)(;)/,
      "$1 http://localhost:8005 http://127.0.0.1:8005$2"
    )
  },
}

export default defineConfig({
  plugins: [react(), relaxCspForDev],
  server: {
    port: 5175,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/tests/setup.js',
  },
})
