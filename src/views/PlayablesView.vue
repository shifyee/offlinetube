<script setup>
import { ref } from 'vue'

// We map out the games that we know are inside the Gams folder
const games = [
  { name: 'Cookie Clicker', path: '/gams/index.html', icon: '🍪', color: 'from-blue-900 to-indigo-900' },
  { name: 'Slope', path: '/gams/g/slope.html', icon: '🟢', color: 'from-green-900 to-teal-900' },
  { name: 'Tube Jumpers', path: '/gams/g/tubejumpers.html', icon: '🛟', color: 'from-cyan-900 to-blue-900' },
  { name: 'Hole.io', path: '/gams/g/holeio.html', icon: '🕳️', color: 'from-purple-900 to-pink-900' },
  { name: 'Geometry Dash', path: '/gams/g/geometrydash.html', icon: '🔺', color: 'from-yellow-900 to-orange-900' },
  { name: 'Moto X3M', path: '/gams/g/motox3m.html', icon: '🏍️', color: 'from-red-900 to-rose-900' },
  { name: 'Retro Bowl', path: '/gams/g/retrobowl.html', icon: '🏈', color: 'from-emerald-900 to-green-900' },
  { name: 'Drift Hunters', path: '/gams/g/drifthunters.html', icon: '🚗', color: 'from-slate-900 to-gray-900' },
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
    
    <!-- Launcher View -->
    <div v-if="!selectedGame" class="p-8 max-w-6xl mx-auto">
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <svg viewBox="0 0 24 24" class="w-8 h-8 fill-accent"><path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
          Playables
        </h1>
        <p class="text-muted">Fully offline games. Playable without internet.</p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <button 
          v-for="game in games" 
          :key="game.name"
          @click="openGame(game)"
          class="group relative aspect-square rounded-2xl overflow-hidden border border-white/10 hover:border-white/30 transition-all hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(255,0,51,0.2)] bg-gradient-to-br"
          :class="game.color"
        >
          <div class="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors"></div>
          <div class="relative z-10 flex flex-col items-center justify-center h-full p-4 text-center">
            <span class="text-5xl mb-4 group-hover:scale-110 transition-transform drop-shadow-lg">{{ game.icon }}</span>
            <span class="font-bold text-white text-lg drop-shadow-md">{{ game.name }}</span>
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

      <!-- Floating Back Button -->
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
