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

onMounted(() => {
  library.refresh().then(updateStorage)
})

async function remove(id) {
  if (confirm('Delete this download?')) {
    await library.remove(id)
    updateStorage()
  }
}

// Update storage stats every 5 seconds to keep it fresh
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
          <div class="aspect-video bg-surface-2 overflow-hidden">
            <img 
              v-if="v.thumbnail" 
              :src="v.thumbnail" 
              class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
              alt="" 
            />
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
