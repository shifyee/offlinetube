<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { useRouter } from 'vue-router'
import shaka from 'shaka-player/dist/shaka-player.compiled.js'

const props = defineProps({
  videoId: { type: String, default: null },
  offlineVideoId: { type: String, default: null },
  poster: { type: String, default: null },
  nextVideoId: { type: String, default: null }
})

const emit = defineEmits(['next'])
const router = useRouter()

const videoEl = ref(null)
const containerEl = ref(null)
const timelineContainerEl = ref(null)
const error = ref(null)
let player = null
let objectUrl = null

const useIframe = computed(() => props.videoId && !props.offlineVideoId)

// --- State (Porting the Vanilla JS to Vue) ---
const isPaused = ref(true)
const volumeLevel = ref('high') // 'high', 'low', 'muted'
const currentTime = ref('0:00')
const totalTime = ref('0:00')
const playbackSpeed = ref('1x')
const isTheater = ref(false)
const isFullscreen = ref(false)
const isScrubbing = ref(false)
const progressPosition = ref(0)
const previewPosition = ref(0)
const showControls = ref(false)

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

// --- Helpers ---
const formatTime = (time) => {
  const minutes = Math.floor(time / 60)
  const seconds = Math.floor(time % 60)
  const hours = Math.floor(time / 3600)
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

const skip = (seconds) => {
  if (videoEl.value) videoEl.value.currentTime += seconds
}

const togglePlayPause = () => {
  if (!videoEl.value) return
  if (videoEl.value.paused) videoEl.value.play()
  else videoEl.value.pause()
}

const toggleMute = () => {
  if (videoEl.value) videoEl.value.muted = !videoEl.value.muted
}

const updateVolume = (e) => {
  if (!videoEl.value) return
  videoEl.value.volume = e.target.value
  videoEl.value.muted = e.target.value === 0
}

const changePlaybackSpeed = () => {
  if (!videoEl.value) return
  let newSpeed = videoEl.value.playbackRate + 0.25
  if (newSpeed > 2) newSpeed = 0.5
  videoEl.value.playbackRate = newSpeed
  playbackSpeed.value = `${newSpeed}x`
}

const toggleTheater = () => { isTheater.value = !isTheater.value }

const toggleFullScreen = () => {
  if (!document.fullscreenElement) containerEl.value?.requestFullscreen()
  else document.exitFullscreen()
}

const toggleMiniPlayer = () => {
  if (document.pictureInPictureElement) document.exitPictureInPicture()
  else videoEl.value?.requestPictureInPicture()
}

// --- Timeline Logic ---
const handleTimelineUpdate = (e) => {
  if (!timelineContainerEl.value || !videoEl.value) return
  const { left, width } = timelineContainerEl.value.getBoundingClientRect()
  const percent = Math.min(1, Math.max(0, (e.clientX - left) / width))
  
  previewPosition.value = percent
  if (isScrubbing.value) {
    e.preventDefault()
    progressPosition.value = percent
    videoEl.value.currentTime = percent * videoEl.value.duration
  }
}

const toggleScrubbing = (e) => {
  if (!timelineContainerEl.value || !videoEl.value) return
  const { left, width } = timelineContainerEl.value.getBoundingClientRect()
  const percent = Math.min(1, Math.max(0, (e.clientX - left) / width))
  
  isScrubbing.value = (e.buttons & 1) === 1
  if (isScrubbing.value) {
    videoEl.value.pause()
  } else {
    videoEl.value.currentTime = percent * videoEl.value.duration
    if (!isPaused.value) videoEl.value.play()
  }
  handleTimelineUpdate(e)
}

// --- Video Events ---
const onTimeUpdate = () => {
  if (!videoEl.value) return
  currentTime.value = formatTime(videoEl.value.currentTime)
  progressPosition.value = videoEl.value.currentTime / videoEl.value.duration
}

const onLoadedMetadata = () => {
  if (videoEl.value) totalTime.value = formatTime(videoEl.value.duration)
}

const onVolumeChange = () => {
  if (!videoEl.value) return
  if (videoEl.value.volume === 0 || videoEl.value.muted) volumeLevel.value = 'muted'
  else if (videoEl.value.volume < 0.5) volumeLevel.value = 'low'
  else volumeLevel.value = 'high'
}

// --- Keyboard Shortcuts ---
const handleKeydown = (e) => {
  if (useIframe.value) return
  const tagName = document.activeElement.tagName.toLowerCase()
  if (tagName === "input" || tagName === "textarea") return

  const key = e.key.toLowerCase()
  switch (key) {
    case " ": case "k": if (tagName === "button") return; togglePlayPause(); break
    case "f": toggleFullScreen(); break
    case "t": toggleTheater(); break
    case "i": toggleMiniPlayer(); break
    case "m": toggleMute(); break
    case "arrowleft": case "j": skip(-5); break
    case "arrowright": case "l": skip(5); break
  }
}

onMounted(() => {
  setupPlayer()
  window.addEventListener('keydown', handleKeydown)
  document.addEventListener('mouseup', (e) => { if (isScrubbing.value) toggleScrubbing(e) })
  document.addEventListener('mousemove', (e) => { if (isScrubbing.value) handleTimelineUpdate(e) })
  document.addEventListener('fullscreenchange', () => { isFullscreen.value = !!document.fullscreenElement })
})

onBeforeUnmount(() => {
  if (player) player.destroy()
  if (objectUrl) URL.revokeObjectURL(objectUrl)
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div 
    ref="containerEl"
    class="video-container group" 
    :class="{ paused: isPaused, theater: isTheater, 'full-screen': isFullscreen }"
    :data-volume-level="volumeLevel"
    @mouseenter="showControls = true"
    @mouseleave="showControls = false"
    @mousemove="showControls = true"
  >
    <iframe 
      v-if="useIframe"
      :src="`https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0`"
      class="w-full h-full border-0 absolute inset-0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen
    ></iframe>

    <template v-else>
      <video
        ref="videoEl"
        :poster="poster || undefined"
        playsinline
        @click="togglePlayPause"
        @timeupdate="onTimeUpdate"
        @loadedmetadata="onLoadedMetadata"
        @volumechange="onVolumeChange"
        @play="isPaused = false"
        @pause="isPaused = true"
      ></video>

      <!-- Controls Overlay -->
      <div class="video-controls-container" :class="{ 'opacity-100': showControls || isPaused }">
        <div class="timeline-container" 
             ref="timelineContainerEl"
             @mousemove="handleTimelineUpdate"
             @mousedown="toggleScrubbing"
        >
          <div class="timeline" :style="{ '--progress-position': progressPosition, '--preview-position': previewPosition }">
            <div class="thumb-indicator"></div>
          </div>
        </div>
        
        <div class="controls">
          <!-- Play/Pause -->
          <button class="play-pause-btn" @click="togglePlayPause">
            <svg class="play-icon" viewBox="0 0 24 24">
              <path fill="currentColor" d="M8,5.14V19.14L19,12.14L8,5.14Z" />
            </svg>
            <svg class="pause-icon" viewBox="0 0 24 24">
              <path fill="currentColor" d="M14,19H18V5H14M6,19H10V5H6V19Z" />
            </svg>
          </button>

          <!-- Next Video (Custom Addition) -->
          <button v-if="nextVideoId" @click="emit('next')" class="hover:text-red-500 transition-colors">
             <svg viewBox="0 0 24 24" class="w-6 h-6 fill-current"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
          </button>

          <!-- Volume -->
          <div class="volume-container">
            <button class="mute-btn" @click="toggleMute">
              <svg class="volume-high-icon" viewBox="0 0 24 24">
                <path fill="currentColor" d="M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.84 14,18.7V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12M3,9V15H7L12,20V4L7,9H3Z" />
              </svg>
              <svg class="volume-low-icon" viewBox="0 0 24 24">
                <path fill="currentColor" d="M5,9V15H9L14,20V4L9,9M18.5,12C18.5,10.23 17.5,8.71 16,7.97V16C17.5,15.29 18.5,13.76 18.5,12Z" />
              </svg>
              <svg class="volume-muted-icon" viewBox="0 0 24 24">
                <path fill="currentColor" d="M12,4L9.91,6.09L12,8.18M4.27,3L3,4.27L7.73,9H3V15H7L12,20V13.27L16.25,17.53C15.58,18.04 14.83,18.46 14,18.7V20.77C15.38,20.45 16.63,19.82 17.68,18.96L19.73,21L21,19.73L12,10.73M19,12C19,12.94 18.8,13.82 18.46,14.64L19.97,16.15C20.62,14.91 21,13.5 21,12C21,7.72 18,4.14 14,3.23V5.29C16.89,6.15 19,8.83 19,12M16.5,12C16.5,10.23 15.5,8.71 14,7.97V10.18L16.45,12.63C16.5,12.43 16.5,12.21 16.5,12Z" />
              </svg>
            </button>
            <input class="volume-slider" type="range" min="0" max="1" step="any" value="1" @input="updateVolume">
          </div>

          <div class="duration-container">
            <span class="current-time">{{ currentTime }}</span>
            <span class="duration-separator">/</span>
            <span class="total-time">{{ totalTime }}</span>
          </div>

          <!-- Speed -->
          <button class="speed-btn wide-btn" @click="changePlaybackSpeed">
            {{ playbackSpeed }}
          </button>

          <!-- Mini Player -->
          <button class="mini-player-btn" @click="toggleMiniPlayer">
            <svg viewBox="0 0 24 24">
              <path fill="currentColor" d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zm-10-7h9v6h-9z" />
            </svg>
          </button>

          <!-- Theater -->
          <button class="theater-btn" @click="toggleTheater">
            <svg class="tall" viewBox="0 0 24 24">
              <path fill="currentColor" d="M19 6H5c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 10H5V8h14v8z" />
            </svg>
            <svg class="wide" viewBox="0 0 24 24">
              <path fill="currentColor" d="M19 7H5c-1.1 0-2 .9-2 2v6c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm0 8H5V9h14v6z" />
            </svg>
          </button>

          <!-- Fullscreen -->
          <button class="full-screen-btn" @click="toggleFullScreen">
            <svg class="open" viewBox="0 0 24 24">
              <path fill="currentColor" d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
            </svg>
            <svg class="close" viewBox="0 0 24 24">
              <path fill="currentColor" d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
            </svg>
          </button>
        </div>
      </div>
    </template>

    <div v-if="error" class="absolute inset-0 flex items-center justify-center text-red-400 p-4 text-center bg-black/80 z-50">
      {{ error }}
    </div>
  </div>
</template>

<style scoped>
/* Copied EXACTLY from the repository CSS */
*, *::before, *::after {
  box-sizing: border-box;
}

.video-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  margin-inline: auto;
  background-color: black;
}

.video-container.theater,
.video-container.full-screen {
  max-width: initial;
  width: 100%;
}

.video-container.theater {
  max-height: 90vh;
}

.video-container.full-screen {
  max-height: 100vh;
}

video {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.video-controls-container {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  color: white;
  z-index: 100;
  opacity: 0;
  transition: opacity 150ms ease-in-out;
}

.video-controls-container::before {
  content: "";
  position: absolute;
  bottom: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, .75), transparent);
  width: 100%;
  aspect-ratio: 6 / 1;
  z-index: -1;
  pointer-events: none;
}

/* We use a class binding instead of hover to allow it to stay open on pause */
.video-container:hover .video-controls-container,
.video-container:focus-within .video-controls-container,
.video-container.paused .video-controls-container {
  opacity: 1;
}

.video-controls-container .controls {
  display: flex;
  gap: .5rem;
  padding: .25rem .5rem;
  align-items: center;
}

.video-controls-container .controls button {
  background: none;
  border: none;
  color: inherit;
  padding: 0;
  height: 30px;
  width: 30px;
  font-size: 1.1rem;
  cursor: pointer;
  opacity: .85;
  transition: opacity 150ms ease-in-out;
}

.video-controls-container .controls button:hover {
  opacity: 1;
}

.video-container.paused .pause-icon {
  display: none;
}

.video-container:not(.paused) .play-icon {
  display: none;
}

.video-container.theater .tall {
  display: none;
}

.video-container:not(.theater) .wide {
  display: none;
}

.video-container.full-screen .open {
  display: none;
}

.video-container:not(.full-screen) .close {
  display: none;
}

.volume-high-icon,
.volume-low-icon,
.volume-muted-icon {
  display: none;
}

.video-container[data-volume-level="high"] .volume-high-icon {
  display: block;
}

.video-container[data-volume-level="low"] .volume-low-icon {
  display: block;
}

.video-container[data-volume-level="muted"] .volume-muted-icon {
  display: block;
}

.volume-container {
  display: flex;
  align-items: center;
}

.volume-slider {
  width: 0;
  transform-origin: left;
  transform: scaleX(0);
  transition: width 150ms ease-in-out, transform 150ms ease-in-out;
  accent-color: red;
  cursor: pointer;
}

.volume-container:hover .volume-slider,
.volume-slider:focus-within {
  width: 100px;
  transform: scaleX(1);
}

.duration-container {
  display: flex;
  align-items: center;
  gap: .25rem;
  flex-grow: 1;
}

.video-controls-container .controls button.wide-btn {
  width: 50px;
}

.timeline-container {
  height: 7px;
  margin-inline: .5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
}

.timeline {
  background-color: rgba(100, 100, 100, .5);
  height: 3px;
  width: 100%;
  position: relative
}

.timeline::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  right: calc(100% - var(--preview-position) * 100%);
  background-color: rgb(150, 150, 150);
  display: none;
}

.timeline::after {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  right: calc(100% - var(--progress-position) * 100%);
  background-color: red;
}

.timeline .thumb-indicator {
  --scale: 0;
  position: absolute;
  transform: translateX(-50%) scale(var(--scale));
  height: 200%;
  top: -50%;
  left: calc(var(--progress-position) * 100%);
  background-color: red;
  border-radius: 50%;
  transition: transform 150ms ease-in-out;
  aspect-ratio: 1 / 1;
}

.video-container.scrubbing .thumb-indicator,
.timeline-container:hover .thumb-indicator {
  --scale: 1;
}

.video-container.scrubbing .timeline,
.timeline-container:hover .timeline {
  height: 100%;
}
</style>
