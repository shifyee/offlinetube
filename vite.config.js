import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'fs'
import path from 'path'
import AdmZip from 'adm-zip'

function downloadGams() {
  return {
    name: 'download-gams',
    async buildStart() {
      const zipUrl = 'https://github.com/shifyee/offlinetube/releases/download/v1.0/gams.zip';
      const zipPath = path.resolve(__dirname, 'gams.zip');
      const targetDir = path.resolve(__dirname, 'public/gams');
      
      if (fs.existsSync(path.join(targetDir, 'index.html'))) {
        console.log('Gams already extracted.');
        return;
      }

      console.log('Downloading gams.zip...');
      try {
        const res = await fetch(zipUrl);
        if (!res.ok) throw new Error(`Failed to download: ${res.statusText}`);
        
        const arrayBuffer = await res.arrayBuffer();
        fs.writeFileSync(zipPath, Buffer.from(arrayBuffer));

        console.log('Unzipping gams with adm-zip...');
        const zip = new AdmZip(zipPath);
        // Extract everything to a temp directory first
        const tempDir = path.resolve(__dirname, 'temp_gams');
        zip.extractAllTo(tempDir, true);

        // Find the actual folder (usually Gams-main)
        const contents = fs.readdirSync(tempDir);
        let sourceDir = tempDir;
        if (contents.length === 1 && fs.statSync(path.join(tempDir, contents[0])).isDirectory()) {
          sourceDir = path.join(tempDir, contents[0]);
        }

        // Move everything to public/gams
        fs.mkdirSync(targetDir, { recursive: true });
        for (const file of fs.readdirSync(sourceDir)) {
          fs.renameSync(path.join(sourceDir, file), path.join(targetDir, file));
        }

        // Cleanup
        fs.rmSync(tempDir, { recursive: true, force: true });
        fs.unlinkSync(zipPath);
        console.log('Gams extracted successfully.');
      } catch (error) {
        console.error('Error setting up Gams:', error);
      }
    }
  }
}

export default defineConfig({
  plugins: [
    downloadGams(),
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Offline Tube',
        short_name: 'OfflineTube',
        description: 'Self-hosted YouTube frontend',
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
        globPatterns: [
          '**/*.{js,css,html,svg,png,ico,woff,woff2,json,mp3,ogg,wasm}',
          'gams/**/*' 
        ],
        maximumFileSizeToCacheInBytes: 100 * 1024 * 1024, 
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/gams\//], 
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/i\.ytimg\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'youtube-thumbnails',
              expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      }
    })
  ]
})
