<script setup>
import { ref, onMounted, computed } from 'vue'
import { useHistoryStore } from '../stores/history'
import { formatDuration } from '../api/piped-client'
import { useRouter } from 'vue-router'
import CachedImage from '../components/CachedImage.vue' // <--- Import

const history = useHistoryStore()
const router = useRouter()
const selected = ref([])

onMounted(() => {
  history.refresh()
})

const allSelected = computed(() => {
  return history.items.length > 0 && selected.value.length === history.items.length
})

function toggleSelectAll() {
  if (allSelected.value) selected.value = []
  else selected.value = history.items.map(i => i.id)
}

function toggleSelect(id) {
  if (selected.value.includes(id)) selected.value = selected.value.filter(i => i !== id)
  else selected.value.push(id)
}

async function deleteSelected() {
  if (!confirm(`Delete ${selected.value.length} items from history?`)) return
  for (const id of selected.value) {
    await history.remove(id)
  }
  selected.value = []
}

async function clearAll() {
  if (!confirm('Are you sure you want to clear your entire watch history?')) return
  await history.clearAll()
  selected.value = []
}
</script>

<template>
  <div class="max-w-7xl mx-auto px-3 py-4">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-xl font-semibold">Watch History</h1>
      <div class="flex gap-3">
        <button v-if="selected.length" @click="deleteSelected" class="text-sm text-red-400 hover:text-red-300 transition-colors">
          Delete Selected ({{ selected.length }})
        </button>
        <button @click="clearAll" class="text-sm text-muted hover:text-white transition-colors">
          Clear All
        </button>
      </div>
    </div>

    <div v-if="history.loading" class="text-muted text-sm py-12 text-center">Loading…</div>
    
    <div v-else-if="!history.items.length" class="text-muted text-sm py-12 text-center">
      Your watch history is empty.
    </div>

    <div v-else class="space-y-2">
      <div class="flex items-center gap-3 px-3 py-2 bg-surface rounded-lg mb-4 border border-white/5">
        <input type="checkbox" :checked="allSelected" @change="toggleSelectAll" class="w-4 h-4 accent-red-600 cursor-pointer" />
        <span class="text-sm font-medium">Select All</span>
      </div>

      <div 
        v-for="item in history.items" 
        :key="item.id" 
        class="group flex items-center gap-4 bg-surface hover:bg-surface-2 p-3 rounded-xl border border-white/5 transition-all cursor-pointer"
        @click="router.push(`/watch/${item.videoId}`)"
      >
        <input 
          type="checkbox" 
          :checked="selected.includes(item.id)" 
          @change.stop="toggleSelect(item.id)" 
          @click.stop
          class="w-4 h-4 accent-red-600 cursor-pointer"
        />
        
        <div class="relative w-32 aspect-video bg-surface-2 rounded-lg overflow-hidden shrink-0">
          <!-- THE FIX: Use CachedImage -->
          <CachedImage :src="item.thumbnail" class="w-full h-full" img-class="object-cover" />
          <span class="absolute bottom-1 right-1 bg-black/80 text-[10px] px-1 rounded text-white z-10">{{ formatDuration(item.lengthSeconds) }}</span>
        </div>
        
        <div class="flex-1 min-w-0">
          <h3 class="font-bold text-sm line-clamp-1 group-hover:text-white">{{ item.title }}</h3>
          <p class="text-xs text-muted mt-1">{{ item.author }}</p>
          <p class="text-[11px] text-muted mt-2">Watched {{ new Date(item.watchedAt).toLocaleDateString() }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
