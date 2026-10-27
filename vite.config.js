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

      if (fs.existsSync(path.join(targetDir, 'Gams.html'))) {
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
        
        // Extract everything directly into public/gams. No flattening.
        zip.extractAllTo(targetDir, true);

        fs.unlinkSync(zipPath);
        console.log('Gams extracted successfully.');
      } catch (error) {
        console.error('Error extracting Gams:', error);
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
        theme_color: '#0f0f0f',
        background_color: '#0f0f0f',
        display: 'standalone',
        icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2,json,mp3,ogg,wasm}', 'gams/**/*'],
        maximumFileSizeToCacheInBytes: 100 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/gams\//], 
      }
    })
  ]
})
