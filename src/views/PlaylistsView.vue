<script setup>
import { ref, onMounted, computed } from 'vue'
import { usePlaylistStore } from '../stores/playlists'
import { formatDuration } from '../api/piped-client'

const playlists = usePlaylistStore()
const newListName = ref('')
const activeListId = ref(null) // Store the ID instead of the whole object

onMounted(() => {
  playlists.refresh()
})

// Always get the freshest version of the active list from the store
const activeList = computed(() => {
  return playlists.lists.find(l => l.id === activeListId.value)
})

async function createList() {
  if (!newListName.value.trim()) return
  await playlists.create(newListName.value)
  newListName.value = ''
}

async function deleteList(id) {
  if (!confirm('Delete this playlist?')) return
  await playlists.delete(id)
  if (activeListId.value === id) activeListId.value = null
}

const handleImageError = (e) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9" style="background:#1a1a1a;width:100%;height:100%;display:block;"><rect width="16" height="9" fill="#1a1a1a"/><path d="M7.5 3.5L9.5 4.5L7.5 5.5V3.5Z" fill="#666"/></svg>`;
  e.target.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
</script>

<template>
  <div class="max-w-7xl mx-auto px-3 py-4 flex gap-6">
    
    <!-- Sidebar for Playlists -->
    <div class="w-64 shrink-0 space-y-4">
      <h1 class="text-xl font-semibold mb-4">Playlists</h1>
      
      <div class="flex gap-2">
        <input 
          v-model="newListName" 
          @keyup.enter="createList"
          type="text" 
          placeholder="New playlist name..." 
          class="flex-1 bg-surface border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-accent"
        />
        <button @click="createList" class="bg-accent text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-red-700 transition-colors">
          +
        </button>
      </div>

      <div class="space-y-1">
        <button 
          v-for="list in playlists.lists" 
          :key="list.id"
          @click="activeListId = list.id"
          class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors text-left"
          :class="activeListId === list.id ? 'bg-surface text-accent font-medium' : 'hover:bg-surface text-muted hover:text-white'"
        >
          <span class="truncate">{{ list.name }}</span>
          <span class="text-xs bg-black/20 px-2 py-0.5 rounded-full">{{ list.videos.length }}</span>
        </button>
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex-1 min-w-0">
      <div v-if="!activeList" class="h-64 flex items-center justify-center text-muted text-sm border border-dashed border-white/10 rounded-xl">
        Select a playlist to view its videos.
      </div>
      
      <div v-else>
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-2xl font-bold">{{ activeList.name }}</h2>
          <button @click="deleteList(activeList.id)" class="text-sm text-red-400 hover:text-red-300 transition-colors">
            Delete Playlist
          </button>
        </div>

        <div v-if="!activeList.videos.length" class="text-muted text-sm py-12 text-center bg-surface rounded-xl border border-white/5">
          This playlist is empty. Go to your Library and add some videos!
        </div>

        <div v-else class="space-y-2">
          <div 
            v-for="(v, index) in activeList.videos" 
            :key="v.videoId"
            class="flex items-center gap-4 bg-surface hover:bg-surface-2 p-3 rounded-xl border border-white/5 transition-all group"
          >
            <span class="text-muted text-sm font-mono w-4">{{ index + 1 }}</span>
            <RouterLink :to="`/watch/${v.videoId}`" class="flex flex-1 items-center gap-4 min-w-0">
              <div class="relative w-32 aspect-video bg-surface-2 rounded-lg overflow-hidden shrink-0">
                <img :src="v.thumbnail" @error="handleImageError" class="w-full h-full object-cover" />
                <span class="absolute bottom-1 right-1 bg-black/80 text-[10px] px-1 rounded text-white">{{ formatDuration(v.lengthSeconds) }}</span>
              </div>
              <div class="flex-1 min-w-0">
                <h3 class="font-bold text-sm line-clamp-1 group-hover:text-white">{{ v.title }}</h3>
                <p class="text-xs text-muted mt-1">{{ v.author }}</p>
              </div>
            </RouterLink>
            <button 
              @click.stop="playlists.removeVideo(activeList.id, v.videoId)"
              class="text-muted hover:text-red-400 p-2 opacity-0 group-hover:opacity-100 transition-all"
              title="Remove from playlist"
            >
              <svg viewBox="0 0 24 24" class="w-5 h-5 fill-current"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>
