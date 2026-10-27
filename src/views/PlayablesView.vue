<script setup>
import { ref } from 'vue'

const loading = ref(true)
</script>

<template>
  <div class="w-full h-[calc(100vh-3.5rem)] bg-black relative">
    <!-- Loading overlay -->
    <div v-if="loading" class="absolute inset-0 flex items-center justify-center bg-bg z-10 text-muted">
      <div class="flex flex-col items-center gap-3">
        <svg class="animate-spin h-8 w-8 text-accent" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        <span>Loading Offline Games...</span>
      </div>
    </div>

    <!-- 
      THE FIX: Path points to /gams/Gams-main/index.html 
    -->
    <iframe 
      src="/gams/Gams-main/index.html" 
      class="w-full h-full border-0 bg-white"
      @load="loading = false"
      allow="fullscreen; autoplay"
    ></iframe>
  </div>
</template>
