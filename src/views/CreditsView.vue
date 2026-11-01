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
  <div ref="containerEl" class="relative w-full h-full min-h-screen bg-[#0a0a0a] overflow-hidden flex items-center justify-center">
    
    <!-- Your New Realistic Rain Canvas -->
    <canvas ref="rainCanvas" class="absolute inset-0 pointer-events-none z-0 mix-blend-screen"></canvas>

    <!-- Foreground Content -->
    <div class="relative z-10 w-full max-w-lg mx-4">
      <!-- Dark Card Container -->
      <div class="bg-[#0f0f0f]/90 backdrop-blur-sm border border-white/10 rounded-3xl p-10 flex flex-col items-center text-center shadow-[0_0_50px_rgba(0,0,0,0.8)]">
        
        <!-- Bear Logo with Blue Glow -->
        <div class="w-28 h-28 rounded-full border-2 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.6)] overflow-hidden mb-6">
          <!-- Using the profile picture path from your screenshot -->
          <img src="/pfp.png" alt="shifyee" class="w-full h-full object-cover" />
        </div>

        <h1 class="text-3xl font-bold text-white mb-2">shifyee</h1>
        <p class="text-blue-400 text-xs font-bold tracking-[0.2em] uppercase mb-6">Full Stack Web Developer</p>

        <p class="text-gray-300 italic text-sm leading-relaxed mb-8">
          "I built OfflineTube to be a fast, private, and resilient way to enjoy YouTube. No ads, no tracking, and your favorite videos available even when the internet isn't."
        </p>

        <!-- Links Row -->
        <div class="flex w-full gap-3 mb-8">
          <a href="https://youtube.com" target="_blank" class="flex-1 flex flex-col items-center justify-center gap-2 bg-[#1a1a1a] hover:bg-[#2a2a2a] border border-white/5 py-4 rounded-xl transition-all duration-300 hover:scale-105">
            <svg viewBox="0 0 24 24" class="w-6 h-6 fill-red-600"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>
            <span class="text-xs font-bold text-white">YouTube</span>
          </a>
          
          <a href="https://github.com/shifyee/offlinetube" target="_blank" class="flex-1 flex flex-col items-center justify-center gap-2 bg-[#1a1a1a] hover:bg-[#2a2a2a] border border-white/5 py-4 rounded-xl transition-all duration-300 hover:scale-105">
            <svg viewBox="0 0 24 24" class="w-6 h-6 fill-white"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            <span class="text-xs font-bold text-white">GitHub</span>
          </a>

          <a href="/gams/Gams.html" class="flex-1 flex flex-col items-center justify-center gap-2 bg-[#1a1a1a] hover:bg-[#2a2a2a] border border-white/5 py-4 rounded-xl transition-all duration-300 hover:scale-105">
            <svg viewBox="0 0 24 24" class="w-6 h-6 fill-green-500"><path d="M21.58 16.09l-1.09-7.66C20.21 6.46 18.52 5 16.53 5H7.47C5.48 5 3.79 6.46 3.51 8.43l-1.09 7.66C2.2 17.63 3.39 19 4.94 19c.68 0 1.32-.27 1.8-.75L9 16h6l2.25 2.25c.48.48 1.13.75 1.8.75 1.56 0 2.75-1.37 2.53-2.91zM11 11H9v2H8v-2H6v-1h2V8h1v2h2v1zm4-1c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm2 3c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/></svg>
            <span class="text-xs font-bold text-white">Gams</span>
          </a>
        </div>

        <p class="text-[11px] text-gray-500">
          built cause chromebooks are useless offline, unless you've met me...
        </p>
      </div>
    </div>
  </div>
</template>
