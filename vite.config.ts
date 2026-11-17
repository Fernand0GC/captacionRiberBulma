import { defineConfig, type Connect, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'

// Modo túnel (pnpm tunnel): Supabase local entra por la misma dirección HTTPS del túnel.
const supabaseProxy = {
  '/auth/v1': { target: 'http://127.0.0.1:54321', changeOrigin: true },
  '/rest/v1': { target: 'http://127.0.0.1:54321', changeOrigin: true },
  '/functions/v1': { target: 'http://127.0.0.1:54321', changeOrigin: true },
}

// Solo el propio sitio y el portal pueden mostrar la app en un marco (contrato cuenta-unica v1); sin X-Frame-Options.
// Servidor de desarrollo y preview; en producción lo pone vercel.json.
function frameAncestors(): Plugin {
  let value = "frame-ancestors 'self'"
  const add = (server: { middlewares: Connect.Server }) => {
    server.middlewares.use((_req, res, next) => {
      res.setHeader('Content-Security-Policy', value)
      next()
    })
  }
  return {
    name: 'frame-ancestors',
    configResolved(c) {
      const portal = (c.env.VITE_PORTAL_ORIGEN as string | undefined)?.trim()
      if (portal) value += ` ${portal}`
    },
    configureServer: add,
    configurePreviewServer: add,
  }
}

export default defineConfig({
  server: { proxy: supabaseProxy, allowedHosts: ['.trycloudflare.com'] },
  preview: { proxy: supabaseProxy, allowedHosts: ['.trycloudflare.com'] },
  plugins: [
    frameAncestors(),
    react(),
    tailwindcss(),
    // research R5: precache del app shell para abrir /registrar sin red; actualización con aviso.
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['apple-touch-icon.png', 'logo-rb-96.webp', 'logo-rb-192.webp'],
      manifest: {
        name: 'Riber Captación',
        short_name: 'Captación',
        description: 'Registro de captaciones de clientes',
        lang: 'es-BO',
        start_url: '/registrar',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0b0b0c',
        theme_color: '#0b0b0c',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,webp,woff2}', 'icon-192.png'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/(auth|rest|functions)\/v1\//, /^\/api\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
})
