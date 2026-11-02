<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const pfpUrl = 'https://i.ibb.co/7xbtg4Ck/pfp.png' 
const bgUrl = 'https://i.ibb.co/xt26gF4d/780f40e1-e80f-4c5e-902a-75ec4d4c3ee7.png'

const rainCanvas = ref(null);
let animationFrameId = null;

onMounted(() => {
  const canvas = rainCanvas.value;
  const ctx = canvas.getContext('2d');

  const resizeCanvas = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Slight delay to ensure Vue transitions are done before starting rain
  setTimeout(() => {
    resizeCanvas();
  }, 350);

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
  window.removeEventListener('resize', resizeCanvas);
});
</script>

<template>
  <div class="min-h-[calc(100vh-3.5rem)] relative flex items-center justify-center overflow-hidden bg-[#0a0a0a]">

    <!-- Background Image -->
    <div 
      class="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-60 z-0"
      :style="{ backgroundImage: `url(${bgUrl})` }"
    ></div>

    <!-- The New Realistic Rain Canvas -->
    <canvas ref="rainCanvas" class="absolute inset-0 pointer-events-none z-0 mix-blend-screen"></canvas>

    <!-- Content Card (Glassmorphism) -->
    <div class="relative z-10 max-w-2xl w-full mx-4 bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-12 shadow-[0_0_50px_rgba(0,0,0,0.5)] text-center">

      <!-- Profile Picture with Glow -->
      <div class="w-32 h-32 mx-auto mb-6 rounded-full p-1 bg-gradient-to-b from-blue-400 to-indigo-600 shadow-[0_0_30px_rgba(59,130,246,0.6)]">
        <div class="w-full h-full rounded-full bg-[#0f0f0f] flex items-center justify-center overflow-hidden">
          <img :src="pfpUrl" alt="shifyee" class="w-full h-full object-cover" />
        </div>
      </div>

      <h1 class="text-3xl font-bold mb-2 text-white">shifyee</h1>
      <p class="text-blue-400 font-medium mb-8 tracking-widest uppercase text-xs">Full Stack Web Developer</p>

      <p class="text-gray-300 mb-10 leading-relaxed italic">
        "I built OfflineTube to be a fast, private, and resilient way to enjoy YouTube. 
        No ads, no tracking, and your favorite videos available even when the internet isn't."
      </p>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <!-- YouTube -->
        <a href="https://youtube.com/@shifyee" target="_blank" class="flex flex-col items-center justify-center p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 transition-all hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(255,0,0,0.3)] group">
          <svg viewBox="0 0 24 24" class="w-8 h-8 fill-red-500 mb-2 group-hover:scale-110 transition-transform"><path d="M21.58 7.19c-.23-.86-.91-1.54-1.77-1.77C18.25 5 12 5 12 5s-6.25 0-7.81.42c-.86.23-1.54.91-1.77 1.77C2 8.75 2 12 2 12s0 3.25.42 4.81c.23.86.91 1.54 1.77 1.77C5.75 19 12 19 12 19s6.25 0 7.81-.42c.86-.23 1.54-.91 1.77-1.77C22 15.25 22 12 22 12s0-3.25-.42-4.81zM10 15V9l5.2 3-5.2 3z"/></svg>
          <span class="font-bold text-sm text-gray-300 group-hover:text-white">YouTube</span>
        </a>

        <!-- GitHub Repo -->
        <a href="https://github.com/shifyee/offlinetube" target="_blank" class="flex flex-col items-center justify-center p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 transition-all hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(255,255,255,0.2)] group">
          <svg viewBox="0 0 24 24" class="w-8 h-8 fill-white mb-2 group-hover:scale-110 transition-transform"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.418 22 12c0-5.523-4.477-10-10-10z"/></svg>
          <span class="font-bold text-sm text-gray-300 group-hover:text-white">GitHub</span>
        </a>

        <!-- Gams -->
        <a href="https://github.com/Gams-Offline/Gams" target="_blank" class="flex flex-col items-center justify-center p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 transition-all hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(74,222,128,0.3)] group">
          <svg viewBox="0 0 24 24" class="w-8 h-8 fill-green-400 mb-2 group-hover:scale-110 transition-transform"><path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
          <span class="font-bold text-sm text-gray-300 group-hover:text-white">Gams</span>
        </a>
      </div>

      <div class="mt-10 text-xs text-gray-500">
        built cause chromeblacks are useless offline, unless you've met me...
      </div>
    </div>
  </div>
</template>
