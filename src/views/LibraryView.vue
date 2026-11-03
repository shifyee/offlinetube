<!-- Just the template part, add the import at the top -->
<script setup>
// ... existing imports ...
import CachedImage from '../components/CachedImage.vue' // <--- Import
// ... existing logic ...
</script>

<template>
  <div class="max-w-7xl mx-auto px-3 py-4" @click="openPlaylistMenu = null">
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
        class="group bg-surface rounded-xl overflow-hidden border border-white/5 transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_10px_40px_rgba(255,0,51,0.15)] relative"
      >
        <RouterLink :to="`/watch/${v.id}`">
          <div class="aspect-video bg-surface-2 overflow-hidden relative">
            <!-- THE FIX: Use CachedImage -->
            <CachedImage 
              v-if="v.thumbnail" 
              :src="v.thumbnail" 
              class="w-full h-full" 
              img-class="object-cover transition-transform duration-500 group-hover:scale-110"
            />
            
            <!-- Watch Progress Bar -->
            <div 
              v-if="v.watchProgress > 0 && v.watchProgress < v.lengthSeconds - 5" 
              class="absolute bottom-0 left-0 right-0 h-1 bg-black/60 z-10"
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
        
        <!-- Playlist Add Button -->
        <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button 
            @click.stop="openPlaylistMenu = openPlaylistMenu === v.id ? null : v.id"
            class="bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-full backdrop-blur-sm transition-colors"
            title="Add to Playlist"
          >
            <svg viewBox="0 0 24 24" class="w-5 h-5 fill-current"><path d="M14 10H2v2h12v-2zm0-4H2v2h12V6zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM2 16h8v-2H2v2z"/></svg>
          </button>
          
          <div v-if="openPlaylistMenu === v.id" class="absolute top-full right-0 mt-2 w-48 bg-[#212121] border border-white/10 rounded-lg shadow-xl py-1 z-50">
            <div class="px-3 py-2 text-xs font-bold text-muted uppercase border-b border-white/10 mb-1">Add to...</div>
            <button 
              v-for="list in playlists.lists" 
              :key="list.id"
              @click.stop="addToPlaylist(list.id, v)"
              class="w-full text-left px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors truncate"
            >
              {{ list.name }}
            </button>
            <div v-if="!playlists.lists.length" class="px-4 py-2 text-xs text-muted text-center">No playlists yet.</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
