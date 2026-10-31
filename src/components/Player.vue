<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import shaka from 'shaka-player/dist/shaka-player.compiled.js'

const props = defineProps({
  videoId: { type: String, default: null },
  offlineVideoId: { type: String, default: null },
  poster: { type: String, default: null },
  nextVideoId: { type: String, default: null }
})

const emit = defineEmits(['next'])

const videoEl = ref(null)
const containerEl = ref(null)
const error = ref(null)
let player = null
let objectUrl = null

const useIframe = computed(() => props.videoId && !props.offlineVideoId)

// Custom Player State
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const volume = ref(1)
const isMuted = ref(false)
const playbackRate = ref(1)
const isFullscreen = ref(false)
const controlsVisible = ref(true)
const showSettings = ref(false)
const buffered = ref(0)
let hideControlsTimeout = null

// Format time (e.g., 1:05)
const formatTime = (s) => {
  if (!s || isNaN(s)) return '0:00'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = Math.floor(s % 60)
  return (h ? `${h}:` : '') + `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

// --- Video Controls ---
const togglePlay = () => { if (videoEl.value.paused) videoEl.value.play(); else videoEl.value.pause() }
const seek = (amount) => { videoEl.value.currentTime += amount }
const skip = (time) => { videoEl.value.currentTime = time }
const toggleMute = () => { videoEl.value.muted = !videoEl.value.muted }
const toggleFullscreen = () => {
  if (!document.fullscreenElement) containerEl.value.requestFullscreen()
  else document.exitFullscreen()
}
const changeSpeed = (rate) => { videoEl.value.playbackRate = rate; playbackRate.value = rate; showSettings.value = false }

// --- UI Events ---
const showControls = () => {
  controlsVisible.value = true
  clearTimeout(hideControlsTimeout)
  if (isPlaying.value && !showSettings.value) {
    hideControlsTimeout = setTimeout(() => { controlsVisible.value = false }, 3000)
  }
}

const handleKeydown = (e) => {
  if (useIframe.value) return // Ignore shortcuts if using YouTube iframe
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
  
  switch(e.code) {
    case 'Space': case 'KeyK': e.preventDefault(); togglePlay(); break
    case 'ArrowRight': e.preventDefault(); seek(5); break
    case 'ArrowLeft': e.preventDefault(); seek(-5); break
    case 'KeyL': e.preventDefault(); seek(10); break
    case 'KeyJ': e.preventDefault(); seek(-10); break
    case 'ArrowUp': e.preventDefault(); volume.value = Math.min(1, volume.value + 0.1); break
    case 'ArrowDown': e.preventDefault(); volume.value = Math.max(0, volume.value - 0.1); break
    case 'KeyM': toggleMute(); break
    case 'KeyF': toggleFullscreen(); break
    case 'Period': changeSpeed(Math.min(2, playbackRate.value + 0.25)); break
    case 'Comma': changeSpeed(Math.max(0.25, playbackRate.value - 0.25)); break
  }
  showControls()
}

// --- Shaka Setup ---
async function setupPlayer() {
  if (useIframe.value) return
  if (!videoEl.value) return
  
  shaka.polyfill.installAll()
  player = new shaka.Player()
  
  player.addEventListener('error', (e) => { error.value = `Player error: ${e.detail}` })
  
  await player.attach(videoEl.value)

  if (props.offlineVideoId) {
    try {
      const { assembleBlob } = await import('../db')
      const blob = await assembleBlob(props.offlineVideoId)
      objectUrl = URL.createObjectURL(blob)
      await player.load(objectUrl, undefined, 'video/mp4')
    } catch (e) {
      error.value = `Offline load failed: ${e.message}`
    }
  }
}

// --- Sync State ---
const onTimeUpdate = () => {
  currentTime.value = videoEl.value.currentTime
  if (videoEl.value.buffered.length > 0) {
    buffered.value = videoEl.value.buffered.end(videoEl.value.buffered.length - 1)
  }
}
const onLoadedMetadata = () => { duration.value = videoEl.value.duration }
const onPlay = () => { isPlaying.value = true; showControls() }
const onPause = () => { isPlaying.value = false; controlsVisible.value = true }
const onVolumeChange = () => { volume.value = videoEl.value.volume; isMuted.value = videoEl.value.muted }

onMounted(() => {
  setupPlayer()
  window.addEventListener('keydown', handleKeydown)
  document.addEventListener('fullscreenchange', () => { isFullscreen.value = !!document.fullscreenElement })
  document.addEventListener('mousemove', showControls)
})

onBeforeUnmount(() => {
  if (player) player.destroy()
  if (objectUrl) URL.revokeObjectURL(objectUrl)
  window.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('fullscreenchange', () => {})
  document.removeEventListener('mousemove', showControls)
  clearTimeout(hideControlsTimeout)
})
</script>

<template>
  <div ref="containerEl" class="relative w-full h-full bg-black flex items-center justify-center group overflow-hidden" @mousemove="showControls" @click="if(!useIframe) togglePlay()">
    
    <!-- YouTube Iframe (Online) -->
    <iframe 
      v-if="useIframe"
      :src="`https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0`"
      class="w-full h-full border-0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen
    ></iframe>

    <!-- Custom Player (Offline) -->
    <template v-else>
      <video
        ref="videoEl"
        playsinline
        :poster="poster || undefined"
        class="w-full h-full object-contain"
        @timeupdate="onTimeUpdate"
        @loadedmetadata="onLoadedMetadata"
        @play="onPlay"
        @pause="onPause"
        @volumechange="onVolumeChange"
        @click.stop="togglePlay"
      ></video>

      <!-- Center Play Button (if paused) -->
      <div v-if="!isPlaying && !error" class="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div class="w-20 h-20 bg-black/60 rounded-full flex items-center justify-center backdrop-blur-sm">
          <svg viewBox="0 0 24 24" class="w-10 h-10 fill-white ml-1"><path d="M8 5v14l11-7z"/></svg>
        </div>
      </div>

      <!-- Custom Controls Overlay -->
      <div 
        class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pt-16 pb-2 px-3 transition-opacity duration-300 pointer-events-auto"
        :class="controlsVisible ? 'opacity-100' : 'opacity-0'"
        @click.stop
      >
        <!-- Progress Bar -->
        <div class="relative h-1.5 bg-white/20 rounded cursor-pointer group/progress mb-3" @click="(e) => { const rect = e.target.getBoundingClientRect(); skip(((e.clientX - rect.left) / rect.width) * duration) }">
          <!-- Buffered -->
          <div class="absolute top-0 left-0 h-full bg-white/30 rounded" :style="{ width: `${(buffered / duration) * 100}%` }"></div>
          <!-- Progress -->
          <div class="absolute top-0 left-0 h-full bg-red-600 rounded" :style="{ width: `${(currentTime / duration) * 100}%` }">
            <div class="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-red-600 rounded-full scale-0 group-hover/progress:scale-100 transition-transform shadow-lg"></div>
          </div>
        </div>

        <!-- Bottom Controls -->
        <div class="flex items-center justify-between text-white text-sm">
          <div class="flex items-center gap-4">
            <!-- Play/Pause -->
            <button @click="togglePlay" class="hover:text-red-500 transition-colors">
              <svg v-if="!isPlaying" viewBox="0 0 24 24" class="w-7 h-7 fill-current"><path d="M8 5v14l11-7z"/></svg>
              <svg v-else viewBox="0 0 24 24" class="w-7 h-7 fill-current"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            </button>
            
            <!-- Next Video -->
            <button v-if="nextVideoId" @click="emit('next')" class="hover:text-red-500 transition-colors">
              <svg viewBox="0 0 24 24" class="w-7 h-7 fill-current"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
            </button>

            <!-- Volume -->
            <div class="flex items-center gap-2 group/volume relative">
              <button @click="toggleMute" class="hover:text-red-500 transition-colors">
                <svg v-if="isMuted || volume === 0" viewBox="0 0 24 24" class="w-6 h-6 fill-current"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
                <svg v-else-if="volume < 0.5" viewBox="0 0 24 24" class="w-6 h-6 fill-current"><path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/></svg>
                <svg v-else viewBox="0 0 24 24" class="w-6 h-6 fill-current"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
              </button>
              <input type="range" min="0" max="1" step="0.05" v-model.number="volume" @input="videoEl.volume = volume" class="w-0 group-hover/volume:w-20 transition-all duration-300 accent-red-600 cursor-pointer" />
            </div>

            <!-- Time -->
            <span class="font-medium text-xs tracking-wide">{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</span>
          </div>

          <div class="flex items-center gap-4">
            <!-- Playback Speed -->
            <div class="relative">
              <button @click="showSettings = !showSettings" class="hover:text-red-500 transition-colors font-medium text-xs px-2 py-1 bg-white/10 rounded">
                {{ playbackRate }}x
              </button>
              <div v-if="showSettings" class="absolute bottom-full right-0 mb-2 bg-surface border border-white/10 rounded shadow-xl py-1 w-24">
                <button v-for="rate in [0.5, 0.75, 1, 1.25, 1.5, 2]" :key="rate" @click="changeSpeed(rate)" class="block w-full text-left px-4 py-1.5 hover:bg-white/10 text-xs" :class="{'text-red-500': playbackRate === rate}">
                  {{ rate }}x
                </button>
              </div>
            </div>

            <!-- Fullscreen -->
            <button @click="toggleFullscreen" class="hover:text-red-500 transition-colors">
              <svg v-if="!isFullscreen" viewBox="0 0 24 24" class="w-6 h-6 fill-current"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
              <svg v-else viewBox="0 0 24 24" class="w-6 h-6 fill-current"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>
            </button>
          </div>
        </div>
      </div>
    </template>

    <div v-if="error" class="absolute inset-0 flex items-center justify-center text-red-400 p-4 text-center bg-black/80 z-50">
      {{ error }}
    </div>
  </div>
</template>
