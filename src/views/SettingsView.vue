<script setup>
import { ref } from 'vue'
import { useSettingsStore } from '../stores/settings'
import { db } from '../db'
import { useLibraryStore } from '../stores/library'
import { useHistoryStore } from '../stores/history'
import { usePlaylistStore } from '../stores/playlists'

const settings = useSettingsStore()
const library = useLibraryStore()
const history = useHistoryStore()
const playlists = usePlaylistStore()

const deleteConfirmText = ref('')
const isDeleting = ref(false)

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
    // 1. Clear IndexedDB
    await db.videos.clear()
    await db.chunks.clear()
    await db.history.clear()
    await db.playlists.clear()
    
    // 2. Refresh stores
    await library.refresh()
    await history.refresh()
    await playlists.refresh()

    // 3. Clear Service Worker Cache (Thumbnails)
    if ('caches' in window) {
      const cacheNames = await caches.keys()
      await Promise.all(cacheNames.map(name => caches.delete(name)))
    }

    // 4. Hard reload the app
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
      Offline Tube · v0.2.0
    </div>
  </div>
</template>
