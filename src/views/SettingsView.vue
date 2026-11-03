<script setup>
import { ref } from 'vue'
import { useSettingsStore } from '../stores/settings'
import { db } from '../db'
import { useLibraryStore } from '../stores/library'
import { useHistoryStore } from '../stores/history'
import { usePlaylistStore } from '../stores/playlists'
import { getCachedThumbnail } from '../utils/thumbnail' // Import the cache utility

const settings = useSettingsStore()
const library = useLibraryStore()
const history = useHistoryStore()
const playlists = usePlaylistStore()

const deleteConfirmText = ref('')
const isDeleting = ref(false)

// --- NEW: Cache All Logic ---
const isCaching = ref(false)
const cacheProgress = ref(0)

async function cacheAllThumbnails() {
  isCaching.value = true
  cacheProgress.value = 0

  const urls = new Set()

  // 1. Gather all URLs from Videos, History, and Playlists
  library.videos.forEach(v => { if (v.thumbnail) urls.add(v.thumbnail) })
  history.items.forEach(h => { if (h.thumbnail) urls.add(h.thumbnail) })
  playlists.lists.forEach(p => {
    p.videos.forEach(v => { if (v.thumbnail) urls.add(v.thumbnail) })
  })

  const urlArray = Array.from(urls)
  if (urlArray.length === 0) {
    alert('No thumbnails found to cache.')
    isCaching.value = false
    return
  }

  // 2. Loop through and cache them
  let count = 0
  for (const url of urlArray) {
    // We don't check if it exists here, getCachedThumbnail handles that instantly
    await getCachedThumbnail(url)
    count++
    cacheProgress.value = Math.round((count / urlArray.length) * 100)
  }

  setTimeout(() => {
    isCaching.value = false
    alert(`Successfully cached ${urlArray.length} thumbnails for offline use!`)
  }, 500)
}

const colors = [
  { name: 'Red', value: 'red', hex: '#ff0033' },
  { name: 'Blue', value: 'blue', hex: '#3b82f6' },
  { name: 'Purple', value: 'purple', hex: '#a855f7' },
  { name: 'Green', value: 'green', hex: '#22c55e' }
]

async function wipeAllData() {
  if (deleteConfirmText.value !== 'DELETE ALL DATA') return
  isDeleting.value = true

  try {
    await db.videos.clear()
    await db.chunks.clear()
    await db.history.clear()
    await db.playlists.clear()
    await db.thumbnails.clear() // Clear thumbnail cache too
    
    await library.refresh()
    await history.refresh()
    await playlists.refresh()

    if ('caches' in window) {
      const cacheNames = await caches.keys()
      await Promise.all(cacheNames.map(name => caches.delete(name)))
    }

    window.location.reload()
  } catch (e) {
    alert('Failed to clear data: ' + e.message)
    isDeleting.value = false
  }
}
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 py-8">
    <h1 class="text-2xl font-bold mb-8">Settings</h1>

    <!-- APPEARANCE -->
    <section class="mb-10">
      <h2 class="text-lg font-semibold border-b border-white/10 pb-2 mb-4">Appearance</h2>
      
      <div class="flex items-center justify-between mb-6">
        <div>
          <div class="font-medium">Accent Color</div>
          <div class="text-sm text-muted">Personalize the buttons and progress bars.</div>
        </div>
        <div class="flex gap-2">
          <button 
            v-for="c in colors" 
            :key="c.value"
            @click="settings.setAccent(c.value)"
            class="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
            :style="{ backgroundColor: c.hex }"
            :class="settings.accentColor === c.value ? 'border-white scale-110' : 'border-transparent'"
            :title="c.name"
          ></button>
        </div>
      </div>

      <div class="flex items-center justify-between">
        <div>
          <div class="font-medium">UI Animations</div>
          <div class="text-sm text-muted">Turn off to save battery or on low-end devices.</div>
        </div>
        <button 
          @click="settings.toggleAnimations()"
          class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
          :class="settings.animations ? 'bg-accent' : 'bg-surface-3'"
        >
          <span 
            class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
            :class="settings.animations ? 'translate-x-6' : 'translate-x-1'"
          />
        </button>
      </div>
    </section>

    <!-- OFFLINE CACHE -->
    <section class="mb-10">
      <h2 class="text-lg font-semibold border-b border-white/10 pb-2 mb-4">Offline Cache</h2>
      
      <div class="flex items-center justify-between">
        <div>
          <div class="font-medium">Cache All Thumbnails</div>
          <div class="text-sm text-muted">Force download every thumbnail in your Library, History, and Playlists for offline use.</div>
        </div>
        <button 
          @click="cacheAllThumbnails" 
          :disabled="isCaching"
          class="h-10 px-6 rounded-lg bg-surface-2 hover:bg-surface-3 text-white font-bold transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <svg v-if="isCaching" class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          {{ isCaching ? `Caching... ${cacheProgress}%` : 'Cache All' }}
        </button>
      </div>
    </section>

    <!-- DOWNLOADS -->
    <section class="mb-10">
      <h2 class="text-lg font-semibold border-b border-white/10 pb-2 mb-4">Downloads</h2>
      
      <div class="flex items-center justify-between">
        <div>
          <div class="font-medium">Default Video Quality</div>
          <div class="text-sm text-muted">Used for single-click downloads.</div>
        </div>
        <select
          :value="settings.defaultQuality"
          @change="settings.setQuality($event.target.value)"
          class="h-10 px-3 rounded-lg bg-surface border border-white/10 focus:outline-none focus:border-accent"
        >
          <option value="highest">Highest (4K/1080p)</option>
          <option value="1080">1080p</option>
          <option value="720">720p</option>
          <option value="480">480p</option>
        </select>
      </div>
    </section>

    <!-- DANGER ZONE -->
    <section class="mb-10 border border-red-500/30 rounded-xl p-5 bg-red-500/5">
      <h2 class="text-lg font-semibold text-red-400 mb-2">Danger Zone</h2>
      <p class="text-sm text-muted mb-4">
        This will permanently delete all your downloaded videos, watch history, playlists, and clear the thumbnail cache.
      </p>
      
      <div class="flex flex-col gap-3">
        <label class="text-sm font-medium">Type <span class="font-mono text-red-400 bg-red-500/10 px-1 rounded">DELETE ALL DATA</span> to confirm:</label>
        <input 
          v-model="deleteConfirmText"
          type="text" 
          class="w-full h-10 px-3 rounded-lg bg-surface border border-red-500/30 focus:outline-none focus:border-red-500 text-white"
          placeholder="DELETE ALL DATA"
        />
        <button 
          @click="wipeAllData"
          :disabled="deleteConfirmText !== 'DELETE ALL DATA' || isDeleting"
          class="h-10 px-6 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto self-start"
        >
          {{ isDeleting ? 'Wiping Data...' : 'Wipe All Data' }}
        </button>
      </div>
    </section>

    <div class="text-xs text-muted text-center mt-12">
      Offline Tube · v0.4.0
    </div>
  </div>
</template>
