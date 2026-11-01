<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';

const rainCanvas = ref(null);
const containerEl = ref(null);
let animationFrameId = null;
let resizeObserver = null;

onMounted(() => {
  const canvas = rainCanvas.value;
  const ctx = canvas.getContext('2d');

  // Handle resizing based on the container, not the whole window
  const resizeCanvas = () => {
    if (!containerEl.value) return;
    canvas.width = containerEl.value.clientWidth;
    canvas.height = containerEl.value.clientHeight;
  };
  
  resizeCanvas();
  resizeObserver = new ResizeObserver(resizeCanvas);
  resizeObserver.observe(containerEl.value);

  const drops = [];
  const splashes = [];
  const minDrops = 47;
  const maxDrops = 70;
  const windAngle = -0.02; 

  for (let i = 0; i < maxDrops; i++) {
    const layer = Math.random() < 0.6 ? 0 : (Math.random() < 0.85 ? 1 : 2);
    
    drops.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      layer: layer,
      speed: layer === 0 ? Math.random() * 18 + 22 : layer === 1 ? Math.random() * 26 + 28 : Math.random() * 40 + 32,
      length: layer === 0 ? Math.random() * 12 + 10 : layer === 1 ? Math.random() * 25 + 20 : Math.random() * 45 + 35,
      opacity: layer === 0 ? Math.random() * 0.04 + 0.02 : layer === 1 ? Math.random() * 0.12 + 0.08 : Math.random() * 0.28 + 0.15,
      weight: layer === 0 ? 0.6 : layer === 1 ? 1.2 : 1.8,
      active: i < minDrops || Math.random() > 0.3 
    });
  }

  const animate = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < maxDrops; i++) {
      const d = drops[i];
      if (!d.active) continue;

      // Tapered gradient for realistic motion blur
      const gradient = ctx.createLinearGradient(
        d.x, d.y, 
        d.x + (d.speed * windAngle), d.y + d.length
      );
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0)'); 
      gradient.addColorStop(0.7, `rgba(225, 235, 255, ${d.opacity * 0.5})`);
      gradient.addColorStop(1, `rgba(240, 245, 255, ${d.opacity})`);

      ctx.beginPath();
      ctx.strokeStyle = gradient;
      ctx.lineWidth = d.weight;
      ctx.lineCap = 'round';

      if (d.layer === 0) {
        ctx.shadowBlur = 3;
        ctx.shadowColor = `rgba(225, 235, 255, ${d.opacity})`;
      } else {
        ctx.shadowBlur = 0;
      }

      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x + (d.speed * windAngle), d.y + d.length);
      ctx.stroke();

      d.y += d.speed;
      d.x += d.speed * windAngle;

      if (d.y > canvas.height - d.length) {
        if (d.layer > 0 && splashes.length < 50) {
          for (let j = 0; j < 3; j++) {
            splashes.push({
              x: d.x + (d.speed * windAngle),
              y: canvas.height - Math.random() * 4,
              vX: (Math.random() - 0.5) * 4 + (windAngle * 5),
              vY: -Math.random() * 2.5 - 0.5,
              alpha: d.opacity * 0.8,
              size: Math.random() * d.weight * 0.6 + 0.4
            });
          }
        }
        d.y = -d.length;
        d.x = Math.random() * (canvas.width + 100) - 50;
        d.active = Math.random() * maxDrops > (maxDrops - minDrops);
      }
    }

    ctx.shadowBlur = 0; 
    for (let i = splashes.length - 1; i >= 0; i--) {
      const s = splashes[i];
      
      ctx.beginPath();
      ctx.fillStyle = `rgba(230, 240, 255, ${s.alpha})`;
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();

      s.x += s.vX;
      s.y += s.vY;
      s.vY += 0.4; 
      s.alpha -= 0.08; 

      if (s.alpha <= 0 || s.y > canvas.height) {
        splashes.splice(i, 1);
      }
    }

    animationFrameId = requestAnimationFrame(animate);
  };

  animate();
});

onBeforeUnmount(() => {
  cancelAnimationFrame(animationFrameId);
  if (resizeObserver && containerEl.value) {
    resizeObserver.unobserve(containerEl.value);
  }
});
</script>

<template>
  <!-- Main container with relative positioning and dark background -->
  <div ref="containerEl" class="relative w-full h-full min-h-screen bg-[#0f1115] overflow-hidden flex items-center justify-center">
    
    <!-- Your Realistic Rain Canvas -->
    <canvas ref="rainCanvas" class="realistic-rain-canvas"></canvas>

    <!-- Foreground Content (Frosted Glass Card) -->
    <div class="relative z-10 w-full max-w-2xl px-6 py-12">
      <div class="bg-surface/40 backdrop-blur-xl border border-white/10 rounded-3xl p-10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] text-center text-white">
        
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/20 mb-6">
          <svg viewBox="0 0 24 24" class="w-8 h-8 fill-accent"><path d="M8 5v14l11-7z" /></svg>
        </div>

        <h1 class="text-4xl font-bold tracking-tight mb-2">Credits</h1>
        <p class="text-muted text-sm mb-10">The people and tools that made OfflineTube possible.</p>
        
        <div class="space-y-8 text-left">
          <div class="border-b border-white/10 pb-6">
            <h2 class="text-lg font-semibold text-accent mb-3">Core Technologies</h2>
            <ul class="space-y-3 text-sm text-gray-300">
              <li class="flex justify-between">
                <span>Frontend Framework</span>
                <span class="font-mono text-white">Vue 3 + Vite</span>
              </li>
              <li class="flex justify-between">
                <span>Media Player</span>
                <span class="font-mono text-white">Shaka Player</span>
              </li>
              <li class="flex justify-between">
                <span>Offline Storage</span>
                <span class="font-mono text-white">Dexie.js (IndexedDB)</span>
              </li>
            </ul>
          </div>

          <div class="border-b border-white/10 pb-6">
            <h2 class="text-lg font-semibold text-accent mb-3">Backend & APIs</h2>
            <ul class="space-y-3 text-sm text-gray-300">
              <li class="flex justify-between">
                <span>Video Downloading</span>
                <span class="font-mono text-white">yt-dlp</span>
              </li>
              <li class="flex justify-between">
                <span>Metadata & Comments</span>
                <span class="font-mono text-white">Piped API</span>
              </li>
              <li class="flex justify-between">
                <span>PO Token Provider</span>
                <span class="font-mono text-white">bgutil-ytdlp-pot-provider</span>
              </li>
            </ul>
          </div>

          <div>
            <h2 class="text-lg font-semibold text-accent mb-3">Special Thanks</h2>
            <p class="text-sm text-gray-300 leading-relaxed">
              Huge thanks to the open-source community. The background rain animation was custom-built for this project to give the credits page an atmospheric, cinematic feel.
            </p>
          </div>
        </div>

        <div class="mt-12 pt-6 border-t border-white/10 flex items-center justify-between text-xs text-muted">
          <span>OfflineTube</span>
          <span>v0.3.0</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.realistic-rain-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none; 
  z-index: 1; 
  mix-blend-mode: screen; 
  background: transparent !important;
}
</style>
