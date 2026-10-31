<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useLibraryStore } from '../stores/library'
import { formatBytes } from '../api/piped-client'

const library = useLibraryStore()
const storageStats = ref({ usage: 0, quota: 0 })

async function updateStorage() {
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate()
      storageStats.value = {
        usage: estimate.usage || 0,
        quota: estimate.quota || 0
      }
    } catch (e) {
      console.error('Failed to get storage estimate:', e)
    }
  }
}

// Fallback logic: Try hqdefault -> Then show dark SVG
const handleImageError = (e) => {
  // If the thumbnail fails, try swapping mqdefault for hqdefault
  if (e.target.src.includes('mqdefault')) {
    e.target.src = e.target.src.replace('mqdefault', 'hqdefault');
    return;
  }
  
  // If that fails too, show the dark SVG placeholder
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9" style="background:#1a1a1a;width:100%;height:100%;display:block;">
    <rect width="16" height="9" fill="#1a1a1a"/>
    <circle cx="8" cy="4.5" r="1.5" fill="#2a2a2a"/>
    <path d="M7.5 3.5L9.5 4.5L7.5 5.5V3.5Z" fill="#666"/>
  </svg>`;
  e.target.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  e.target.onerror = null; // Prevent infinite loop
}

onMounted(() => {
  library.refresh().then(updateStorage)
})

async function remove(id) {
  if (confirm('Delete this download?')) {
    await library.remove(id)
    updateStorage()
  }
}

let interval = setInterval(updateStorage, 5000)
onUnmounted(() => clearInterval(interval))
</script>

<template>
  <div class="max-w-7xl mx-auto px-3 py-4">
    <!-- Storage Tracker Bar -->
    <div v-if="storageStats.quota > 0" class="mb-6">
      <div class="flex items-center justify-between mb-1">
        <span class="text-xs font-medium text-muted">Storage Usage</span>
        <span class="text-xs text-muted">
          {{ formatBytes(storageStats.usage) }} used of {{ formatBytes(storageStats.quota) }}
        </span>
      </div>
      <div class="h-4 bg-surface rounded-full overflow-hidden border border-white/10">
        <div 
          class="h-full bg-accent transition-all duration-500 ease-out" 
          :style="{ width: `${Math.min((storageStats.usage / storageStats.quota) * 100, 100)}%` }"
        ></div>
      </div>
    </div>

    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-xl font-semibold">Library</h1>
      <span class="text-xs text-muted">{{ library.complete.length }} saved</span>
    </div>

    <div v-if="library.loading" class="text-muted text-sm py-12 text-center">Loading…</div>

    <div v-else-if="!library.complete.length" class="text-muted text-sm py-12 text-center">
      No offline videos yet. Download one to play without internet.
    </div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <div 
        v-for="v in library.complete" 
        :key="v.id" 
        class="group bg-surface rounded-xl overflow-hidden border border-white/5 transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_10px_40px_rgba(255,0,51,0.15)]"
      >
        <RouterLink :to="`/watch/${v.id}`">
          <!-- Changed to relative for the progress bar overlay -->
          <div class="aspect-video bg-surface-2 overflow-hidden relative">
            <!-- Removed crossorigin="anonymous" -->
            <img 
              v-if="v.thumbnail" 
              :src="v.thumbnail" 
              @error="handleImageError"
              class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
              alt="" 
            />
            
            <!-- Watch Progress Bar -->
            <div 
              v-if="v.watchProgress > 0 && v.watchProgress < v.lengthSeconds - 5" 
              class="absolute bottom-0 left-0 right-0 h-1 bg-black/60"
            >
              <div 
                class="h-full bg-red-600" 
                :style="{ width: `${(v.watchProgress / v.lengthSeconds) * 100}%` }"
              ></div>
            </div>
          </div>
        </RouterLink>
        <div class="p-4">
          <div class="font-bold text-sm line-clamp-2">{{ v.title }}</div>
          <div class="text-xs text-muted mt-1">{{ v.author }}</div>
          <div class="flex items-center justify-between mt-3">
            <span class="text-[11px] text-muted font-mono">{{ formatBytes(v.size) }}</span>
            <button
              @click="remove(v.id)"
              class="text-xs text-red-400 hover:text-red-300 transition-colors"
            >Delete</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
