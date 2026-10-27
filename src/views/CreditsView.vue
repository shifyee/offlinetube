<script setup>
</script>

<template>
  <div class="min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-6 relative overflow-hidden">
    <!-- Background Glow Effects -->
    <div class="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/20 rounded-full blur-[100px] pointer-events-none"></div>
    <div class="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-[100px] pointer-events-none"></div>

    <div class="max-w-2xl w-full bg-surface/50 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-12 shadow-2xl relative z-10 text-center">
      
      <!-- Profile Picture -->
      <div class="w-32 h-32 mx-auto mb-6 rounded-full p-1 bg-gradient-to-tr from-accent to-blue-500 shadow-lg">
        <div class="w-full h-full rounded-full bg-bg flex items-center justify-center overflow-hidden">
          <!-- Replace src with your actual profile picture URL if you have one -->
          <img src="https://ui-avatars.com/api/?name=Shifyee&size=128&background=0f0f0f&color=ff0033" alt="Profile" class="w-full h-full object-cover" />
        </div>
      </div>

      <h1 class="text-3xl font-bold mb-2">Shifyee</h1>
      <p class="text-accent font-medium mb-8">Full Stack Web Developer</p>

      <p class="text-gray-300 mb-10 leading-relaxed">
        I built OfflineTube to be a fast, private, and resilient way to enjoy YouTube. 
        No ads, no tracking, and your favorite videos available even when the internet isn't.
      </p>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <!-- YouTube Link -->
        <a href="https://youtube.com/shifyee" target="_blank" class="flex flex-col items-center justify-center p-4 bg-surface-2 hover:bg-surface-3 rounded-2xl border border-white/5 transition-all hover:-translate-y-1 hover:shadow-lg group">
          <svg viewBox="0 0 24 24" class="w-8 h-8 fill-red-500 mb-2 group-hover:scale-110 transition-transform"><path d="M21.58 7.19c-.23-.86-.91-1.54-1.77-1.77C18.25 5 12 5 12 5s-6.25 0-7.81.42c-.86.23-1.54.91-1.77 1.77C2 8.75 2 12 2 12s0 3.25.42 4.81c.23.86.91 1.54 1.77 1.77C5.75 19 12 19 12 19s6.25 0 7.81-.42c.86-.23 1.54-.91 1.77-1.77C22 15.25 22 12 22 12s0-3.25-.42-4.81zM10 15V9l5.2 3-5.2 3z"/></svg>
          <span class="font-bold text-sm">YouTube</span>
        </a>

        <!-- GitHub Link -->
        <a href="https://github.com/shifyee" target="_blank" class="flex flex-col items-center justify-center p-4 bg-surface-2 hover:bg-surface-3 rounded-2xl border border-white/5 transition-all hover:-translate-y-1 hover:shadow-lg group">
          <svg viewBox="0 0 24 24" class="w-8 h-8 fill-white mb-2 group-hover:scale-110 transition-transform"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.418 22 12c0-5.523-4.477-10-10-10z"/></svg>
          <span class="font-bold text-sm">GitHub</span>
        </a>

        <!-- Gams Link -->
        <a href="https://github.com/Gams-Offline/Gams" target="_blank" class="flex flex-col items-center justify-center p-4 bg-surface-2 hover:bg-surface-3 rounded-2xl border border-white/5 transition-all hover:-translate-y-1 hover:shadow-lg group">
          <svg viewBox="0 0 24 24" class="w-8 h-8 fill-green-400 mb-2 group-hover:scale-110 transition-transform"><path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
          <span class="font-bold text-sm">Gams</span>
        </a>
      </div>
      
      <div class="mt-10 text-xs text-muted">
        Built with ❤️ for the offline web.
      </div>
    </div>
  </div>
</template>
