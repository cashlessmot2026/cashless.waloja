import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const base = process.env.BASE_PATH || '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png', 'favicon.png', 'apple-touch-icon.png'],
      manifest: {
        id: base,
        name: 'Waloja',
        short_name: 'Waloja',
        description: 'Luxury Homes',
        lang: 'es',
        categories: ['finance', 'travel', 'lifestyle'],
        theme_color: '#0b0f2a',
        background_color: '#0b0f2a',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
        orientation: 'any',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        navigateFallback: base + 'index.html',
        cleanupOutdatedCaches: true
      }
    })
  ]
})
