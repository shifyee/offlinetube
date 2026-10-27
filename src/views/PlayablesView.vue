<script setup>
import { ref } from 'vue'

const games = [
  { name: 'Slope', path: '/gams/g/slope.html', icon: '🟢', gradient: 'from-green-500/20 to-emerald-900/40' },
  { name: 'Tube Jumpers', path: '/gams/g/tubejumpers.html', icon: '🛟', gradient: 'from-blue-500/20 to-cyan-900/40' },
  { name: 'Geometry Dash', path: '/gams/g/geometrydash.html', icon: '🔺', gradient: 'from-yellow-500/20 to-amber-900/40' },
  { name: 'Hole.io', path: '/gams/g/holeio.html', icon: '🕳️', gradient: 'from-purple-500/20 to-fuchsia-900/40' },
  { name: 'Cookie Clicker', path: '/gams/g/g/cookie', icon: '🍪', gradient: 'from-orange-500/20 to-red-900/40' },
  { name: 'Super Mario 64', path: '/gams/g/supermario64.html', icon: '🍄', gradient: 'from-red-500/20 to-rose-900/40' },
  { name: 'Tetris', path: '/gams/g/tetris.html', icon: '🧱', gradient: 'from-cyan-500/20 to-blue-900/40' },
  { name: 'Pac-Man', path: '/gams/g/pacman.html', icon: '🟡', gradient: 'from-yellow-400/20 to-yellow-900/40' },
  { name: '2048', path: '/gams/g/2048.html', icon: '🔢', gradient: 'from-teal-500/20 to-green-900/40' },
  { name: 'Duck Life 4', path: '/gams/g/ducklife4.html', icon: '🦆', gradient: 'from-lime-500/20 to-green-900/40' },
  { name: 'Wordle', path: '/gams/g/wordle.html', icon: '📝', gradient: 'from-slate-500/20 to-gray-900/40' },
  { name: 'Stickman Hook', path: '/gams/g/stickmanhook.html', icon: '🪝', gradient: 'from-indigo-500/20 to-purple-900/40' },
]

const selectedGame = ref(null)
const loading = ref(false)

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
    <div v-if="!selectedGame" class="p-8 max-w-6xl mx-auto">
      <div class="mb-10 text-center">
        <h1 class="text-4xl font-black text-white mb-3 tracking-tight flex items-center justify-center gap-3">
          <svg viewBox="0 0 24 24" class="w-10 h-10 fill-accent"><path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
          Playables
        </h1>
        <p class="text-muted text-lg">Fully offline games. No internet required.</p>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        <button 
          v-for="game in games" 
          :key="game.name"
          @click="openGame(game)"
          class="group relative aspect-[4/3] rounded-2xl overflow-hidden border border-white/10 hover:border-white/30 transition-all hover:-translate-y-1 hover:shadow-[0_10px_40px_rgba(255,0,51,0.2)] bg-gradient-to-br"
          :class="game.gradient"
        >
          <div class="absolute inset-0 bg-black/40 group-hover:bg-black/10 transition-colors"></div>
          <div class="relative z-10 flex flex-col items-center justify-center h-full p-4 text-center">
            <span class="text-5xl mb-4 group-hover:scale-110 group-hover:rotate-3 transition-transform drop-shadow-lg">{{ game.icon }}</span>
            <span class="font-bold text-white text-sm drop-shadow-md">{{ game.name }}</span>
          </div>
        </button>
      </div>
    </div>

    <!-- Game View -->
    <div v-else class="w-full h-full relative">
      <div v-if="loading" class="absolute inset-0 flex items-center justify-center bg-bg z-10 text-muted">
        <div class="flex flex-col items-center gap-3">
          <svg class="animate-spin h-8 w-8 text-accent" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          <span>Loading {{ selectedGame.name }}...</span>
        </div>
      </div>

      <button 
        @click="closeGame"
        class="absolute top-4 left-4 z-20 bg-black/60 hover:bg-black/90 text-white px-4 py-2 rounded-full backdrop-blur-md border border-white/20 flex items-center gap-2 font-bold transition-all shadow-lg"
      >
        <svg viewBox="0 0 24 24" class="w-5 h-5 fill-current"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
        Back to Games
      </button>

      <iframe 
        :src="selectedGame.path" 
        class="w-full h-full border-0 bg-white"
        @load="loading = false"
        allow="fullscreen; autoplay"
      ></iframe>
    </div>
  </div>
</template>
