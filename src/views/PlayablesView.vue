<script setup>
import { ref, computed } from 'vue'

const games = [
  { name: 'Slope', path: '/gams/g/slope.html', icon: '🟢', color: 'from-green-500/20 to-emerald-900/40' },
  { name: 'Tube Jumpers', path: '/gams/g/tubejumpers.html', icon: '🛟', color: 'from-cyan-500/20 to-blue-900/40' },
  { name: 'Geometry Dash', path: '/gams/g/geometrydash.html', icon: '🔺', color: 'from-yellow-500/20 to-amber-900/40' },
  { name: 'Hole.io', path: '/gams/g/holeio.html', icon: '🕳️', color: 'from-purple-500/20 to-fuchsia-900/40' },
  { name: 'Cookie Clicker', path: '/gams/g/g/cookie', icon: '🍪', color: 'from-orange-500/20 to-red-900/40' },
  { name: 'Super Mario 64', path: '/gams/g/supermario64.html', icon: '🍄', color: 'from-red-500/20 to-rose-900/40' },
  { name: 'Tetris', path: '/gams/g/tetris.html', icon: '🧱', color: 'from-blue-500/20 to-indigo-900/40' },
  { name: 'Pac-Man', path: '/gams/g/pacman.html', icon: '🟡', color: 'from-yellow-400/20 to-yellow-900/40' },
  { name: '2048', path: '/gams/g/2048.html', icon: '🔢', color: 'from-teal-500/20 to-green-900/40' },
  { name: 'Duck Life 4', path: '/gams/g/ducklife4.html', icon: '🦆', color: 'from-lime-500/20 to-green-900/40' },
  { name: 'Moto X3M', path: '/gams/g/motox3m.html', icon: '🏍️', color: 'from-red-600/20 to-orange-900/40' },
  { name: 'Retro Bowl', path: '/gams/g/retrobowl.html', icon: '🏈', color: 'from-emerald-600/20 to-green-900/40' },
]

const search = ref('')
const selectedGame = ref(null)
const loading = ref(false)

const filteredGames = computed(() => {
  return games.filter(g => g.name.toLowerCase().includes(search.value.toLowerCase()))
})

function openGame(game) {
  loading.value = true
  selectedGame.value = game
}

function closeGame() {
  selectedGame.value = null
  loading.value = false
}
</script>

<template>
  <div class="w-full h-[calc(100vh-3.5rem)] bg-bg relative overflow-y-auto">
    
    <!-- Game Hub -->
    <div v-if="!selectedGame" class="p-6 max-w-6xl mx-auto">
      
      <!-- Header -->
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="text-3xl font-black text-white mb-1 flex items-center gap-3">
            <svg viewBox="0 0 24 24" class="w-8 h-8 fill-accent"><path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
            Playables
          </h1>
          <p class="text-muted">100% Offline Games</p>
        </div>

        <!-- Search Bar -->
        <div class="relative w-64">
          <svg viewBox="0 0 24 24" class="w-5 h-5 fill-muted absolute left-3 top-1/2 -translate-y-1/2"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
          <input 
            v-model="search"
            type="text" 
            placeholder="Search games..." 
            class="w-full h-10 pl-10 pr-4 rounded-full bg-surface border border-white/10 focus:outline-none focus:border-accent text-sm transition-colors"
          />
        </div>
      </div>

      <!-- Games Grid -->
      <div v-if="filteredGames.length === 0" class="text-center text-muted py-12">
        No games found matching "{{ search }}"
      </div>
      
      <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <button 
          v-for="game in filteredGames" 
          :key="game.name"
          @click="openGame(game)"
          class="group relative aspect-[4/3] rounded-2xl overflow-hidden border border-white/10 hover:border-white/30 transition-all hover:-translate-y-1 hover:shadow-[0_10px_40px_rgba(255,0,51,0.2)] bg-gradient-to-br"
          :class="game.color"
        >
          <div class="absolute inset-0 bg-black/40 group-hover:bg-black/10 transition-colors"></div>
          <div class="relative z-10 flex flex-col items-center justify-center h-full p-4 text-center">
            <span class="text-5xl mb-3 group-hover:scale-110 group-hover:rotate-3 transition-transform drop-shadow-lg">{{ game.icon }}</span>
            <span class="font-bold text-white text-sm drop-shadow-md line-clamp-2">{{ game.name }}</span>
          </div>
        </button>
      </div>
    </div>

    <!-- Game Player -->
    <div v-else class="w-full h-full relative">
      <div v-if="loading" class="absolute inset-0 flex items-center justify-center bg-bg z-10 text-muted">
        <div class="flex flex-col items-center gap-4">
          <svg class="animate-spin h-10 w-10 text-accent" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          <span class="font-medium text-lg">Loading {{ selectedGame.name }}...</span>
        </div>
      </div>

      <!-- Back Button -->
      <button 
        @click="closeGame"
        class="absolute top-4 left-4 z-20 bg-black/60 hover:bg-black/90 text-white px-5 py-2.5 rounded-full backdrop-blur-md border border-white/20 flex items-center gap-2 font-bold transition-all shadow-lg"
      >
        <svg viewBox="0 0 24 24" class="w-5 h-5 fill-current"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
        Back to Games
      </button>

      <!-- The Game -->
      <iframe 
        :src="selectedGame.path" 
        class="w-full h-full border-0 bg-white"
        @load="loading = false"
        allow="fullscreen; autoplay; gamepad; clipboard-write"
      ></iframe>
    </div>
  </div>
</template>
