<script setup>
import { ref } from 'vue'

const loading = ref(true)
</script>

<template>
  <div class="w-full h-[calc(100vh-3.5rem)] bg-bg flex flex-col relative">
    
    <!-- Custom OfflineTube Header for Playables -->
    <div class="h-16 border-b border-white/5 bg-surface flex items-center justify-between px-6 shrink-0 z-10 shadow-md">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
          <svg viewBox="0 0 24 24" class="w-6 h-6 fill-accent"><path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
        </div>
        <div>
          <h1 class="text-lg font-bold text-white leading-tight">Playables</h1>
          <p class="text-xs text-muted">100% Offline Games</p>
        </div>
      </div>
      
      <a 
        href="/gams/Gams.html" 
        target="_blank" 
        class="text-xs font-medium text-muted hover:text-white flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-surface-2 transition-colors"
      >
        Open in New Tab
        <svg viewBox="0 0 24 24" class="w-4 h-4 fill-current"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>
      </a>
    </div>

    <!-- Game Frame -->
    <div class="flex-1 relative bg-black">
      <div v-if="loading" class="absolute inset-0 flex items-center justify-center bg-bg z-10 text-muted">
        <div class="flex flex-col items-center gap-4">
          <svg class="animate-spin h-10 w-10 text-accent" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          <span class="font-medium">Loading Game Library...</span>
        </div>
      </div>

      <!-- 
        THE FIX: Pointing directly to the Gams hub.
        The cache buster (?v=...) forces it to ignore any broken cached pages.
      -->
      <iframe 
        :src="`/gams/Gams.html?v=${Date.now()}`" 
        class="w-full h-full border-0 bg-white"
        @load="loading = false"
        allow="fullscreen; autoplay; gamepad; clipboard-write"
      ></iframe>
    </div>
  </div>
</template>
