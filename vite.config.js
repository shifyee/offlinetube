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
        const arrayBuffer = await res.arrayBuffer();
        fs.writeFileSync(zipPath, Buffer.from(arrayBuffer));

        console.log('Unzipping gams...');
        const zip = new AdmZip(zipPath);
        const tempDir = path.resolve(__dirname, 'temp_gams');
        zip.extractAllTo(tempDir, true);

        // Find the folder with Gams.html
        let sourceDir = tempDir;
        const findHtml = (dir) => {
            if (fs.readdirSync(dir).includes('Gams.html')) return true;
            for (const file of fs.readdirSync(dir)) {
                const full = path.join(dir, file);
                if (fs.statSync(full).isDirectory() && findHtml(full)) return true;
            }
            return false;
        };
        const findSource = (dir) => {
            if (fs.readdirSync(dir).includes('Gams.html')) return dir;
            for (const file of fs.readdirSync(dir)) {
                const full = path.join(dir, file);
                if (fs.statSync(full).isDirectory()) {
                    const found = findSource(full);
                    if (found) return found;
                }
            }
            return null;
        };
        const actualSource = findSource(tempDir) || tempDir;

        // Copy everything to public/gams
        fs.mkdirSync(targetDir, { recursive: true });
        const copy = (src, dest) => {
            if (fs.statSync(src).isDirectory()) {
                if (!fs.existsSync(dest)) fs.mkdirSync(dest);
                fs.readdirSync(src).forEach(f => copy(path.join(src, f), path.join(dest, f)));
            } else {
                fs.copyFileSync(src, dest);
            }
        };
        copy(actualSource, targetDir);

        fs.rmSync(tempDir, { recursive: true, force: true });
        fs.unlinkSync(zipPath);
        console.log('Gams extracted perfectly to public/gams.');
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
