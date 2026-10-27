import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

function downloadGams() {
  return {
    name: 'download-gams',
    async buildStart() {
      const zipUrl = 'https://github.com/shifyee/offlinetube/releases/download/v1.0/gams.zip';
      const zipPath = path.resolve(__dirname, 'gams.zip');
      const targetDir = path.resolve(__dirname, 'public/gams');

      if (fs.existsSync(path.join(targetDir, 'index.html'))) {
        console.log('Games already extracted correctly.');
        return;
      }

      console.log('Downloading gams.zip...');
      try {
        const res = await fetch(zipUrl);
        if (!res.ok) throw new Error(`Failed to download: ${res.statusText}`);
        
        const arrayBuffer = await res.arrayBuffer();
        fs.writeFileSync(zipPath, Buffer.from(arrayBuffer));

        console.log('Unzipping gams...');
        fs.mkdirSync(targetDir, { recursive: true });
        execSync(`unzip -o "${zipPath}" -d "${targetDir}"`);
        
        // Flatten the folder if it extracted to Gams-main
        const files = fs.readdirSync(targetDir);
        if (files.length === 1 && fs.statSync(path.join(targetDir, files[0])).isDirectory()) {
          const subfolder = path.join(targetDir, files[0]);
          fs.readdirSync(subfolder).forEach(f => {
            fs.renameSync(path.join(subfolder, f), path.join(targetDir, f));
          });
          fs.rmdirSync(subfolder);
        }

        fs.unlinkSync(zipPath);
        console.log('Gams downloaded and extracted successfully.');
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
        // CRITICAL FIX: Deny fallback for /gams/ so the Service Worker doesn't loop
        navigateFallbackDenylist: [/^\/api\//, /^\/gams\//], 
        runtimeCaching: []
      }
    })
  ]
})
