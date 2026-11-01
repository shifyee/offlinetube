<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';

const rainCanvas = ref(null);
const containerEl = ref(null);
let animationFrameId = null;
let resizeObserver = null;

onMounted(() => {
  const canvas = rainCanvas.value;
  const ctx = canvas.getContext('2d');

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
  <!-- The container to hold the rain and the original content -->
  <div ref="containerEl" class="relative w-full h-full min-h-screen bg-[#0f1115] overflow-hidden">
    
    <!-- The Rain Canvas -->
    <canvas ref="rainCanvas" class="absolute inset-0 pointer-events-none z-0 mix-blend-screen bg-transparent"></canvas>

    <!-- YOUR ORIGINAL CREDITS CONTENT (Z-10 so it's on top of the rain) -->
    <div class="relative z-10 w-full h-full flex items-center justify-center">
      
      <div class="max-w-4xl mx-auto px-4 py-12 flex flex-col items-center text-center">
        <img src="/pfp.png" alt="Profile" class="w-24 h-24 rounded-full mb-6 shadow-lg border-2 border-accent" />
        <h1 class="text-3xl font-bold mb-2">OfflineTube</h1>
        <p class="text-muted mb-8 max-w-lg">A private, offline-first media server built for the web. Download videos, play them offline, and never lose your progress.</p>
        
        <!-- Exact links from your original file (adjust if you had others) -->
        <div class="flex gap-4 mb-12">
          <a href="https://github.com/shifyee/offlinetube" target="_blank" class="px-6 py-2 rounded-full bg-surface-2 hover:bg-surface-3 transition-colors font-medium text-sm">GitHub Repo</a>
          <a href="https://github.com/yt-dlp/yt-dlp" target="_blank" class="px-6 py-2 rounded-full bg-surface-2 hover:bg-surface-3 transition-colors font-medium text-sm">yt-dlp</a>
        </div>

        <div class="text-xs text-muted">
          <p>Offline Tube · v0.3.0</p>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* No CSS needed here, everything is handled by Tailwind classes and your canvas logic */
</style>
