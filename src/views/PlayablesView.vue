<script setup>
import { ref } from 'vue'

const loading = ref(true)
</script>

<template>
  <div class="h-screen w-full flex flex-col bg-bg">
    <div class="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
      <h1 class="text-xl font-bold flex items-center gap-2">
        <svg viewBox="0 0 24 24" class="w-6 h-6 fill-accent"><path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
        Playables
      </h1>
      <span class="text-xs text-muted">Fully Offline Games</span>
    </div>
    
    <div class="flex-1 relative">
      <div v-if="loading" class="absolute inset-0 flex items-center justify-center text-muted">
        Loading games...
      </div>
      <!-- 
        Place the Gams files in public/gams/ 
        This iframe runs them completely locally.
      -->
      <iframe 
        src="/gams/index.html" 
        class="w-full h-full border-0"
        @load="loading = false"
      ></iframe>
    </div>
  </div>
</template>
