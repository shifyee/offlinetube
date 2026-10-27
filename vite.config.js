import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Offline Tube',
        short_name: 'OfflineTube',
        description: 'Self-hosted YouTube frontend with offline playback',
        theme_color: '#0f0f0f',
        background_color: '#0f0f0f',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' }
        ]
      },
      workbox: {
        // Cache EVERYTHING inside the gams folder, plus standard assets
        globPatterns: [
          '**/*.{js,css,html,svg,png,ico,woff,woff2,json,mp3,ogg,wasm}',
          'gams/**/*' 
        ],
        // Increase the maximum file size to cache to 10MB just in case a game has a big asset
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: []
      }
    })
  ]
})
