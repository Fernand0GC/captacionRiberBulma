import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [
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
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
})
