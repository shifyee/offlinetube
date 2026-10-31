<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { useRouter } from 'vue-router'
import shaka from 'shaka-player/dist/shaka-player.compiled.js'
import { db } from '../db'

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
let progressInterval = null

const useIframe = computed(() => props.videoId && !props.offlineVideoId)

// --- State ---
const isPaused = ref(true)
const volumeLevel = ref('high')
const currentTime = ref('0:00')
const totalTime = ref('0:00')
const playbackSpeed = ref('1x')
const isFullscreen = ref(false)
const isScrubbing = ref(false)
const progressPosition = ref(0)
const previewPosition = ref(0)
const showControls = ref(false)

// Feedback Animation State
const feedbackAnim = ref(null) // 'play', 'pause', 'forward', 'backward', 'volume', 'mute'
let animTimeout = null
const triggerFeedback = (type) => {
  feedbackAnim.value = type
  clearTimeout(animTimeout)
  animTimeout = setTimeout(() => { feedbackAnim.value = null }, 600) // Match CSS duration
}

// Next Video State
const showNextOverlay = ref(false)

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
  if (videoEl.value) {
    videoEl.value.currentTime += seconds
    triggerFeedback(seconds > 0 ? 'forward' : 'backward')
  }
}

const togglePlayPause = () => {
  if (!videoEl.value) return
  if (videoEl.value.paused) {
    videoEl.value.play()
    triggerFeedback('play')
  } else {
    videoEl.value.pause()
    triggerFeedback('pause')
  }
}

const toggleMute = () => { 
  if (videoEl.value) {
    videoEl.value.muted = !videoEl.value.muted
    triggerFeedback(videoEl.value.muted ? 'mute' : 'volume')
  }
}

const updateVolume = (e) => {
  if (!videoEl.value) return
  videoEl.value.volume = e.target.value
  videoEl.value.muted = e.target.value === 0
  triggerFeedback('volume')
}

const changePlaybackSpeed = () => {
  if (!videoEl.value) return
  let newSpeed = videoEl.value.playbackRate + 0.25
  if (newSpeed > 2) newSpeed = 0.5
  videoEl.value.playbackRate = newSpeed
  playbackSpeed.value = `${newSpeed}x`
}

const toggleFullScreen = () => {
  if (!document.fullscreenElement) containerEl.value?.requestFullscreen()
  else document.exitFullscreen()
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

const onLoadedMetadata = async () => {
  if (!videoEl.value) return
  totalTime.value = formatTime(videoEl.value.duration)
  
  try {
    const savedVideo = await db.videos.get(props.offlineVideoId || props.videoId)
    if (savedVideo && savedVideo.watchProgress && savedVideo.watchProgress > 0) {
      if (savedVideo.watchProgress >= videoEl.value.duration - 5) {
        videoEl.value.currentTime = 0
      } else {
        videoEl.value.currentTime = savedVideo.watchProgress
      }
    }
  } catch (e) {}

  clearInterval(progressInterval)
  progressInterval = setInterval(saveProgress, 5000)
}

const saveProgress = async () => {
  if (!videoEl.value || videoEl.value.paused || isScrubbing.value) return
  const id = props.offlineVideoId || props.videoId
  if (!id) return
  try {
    await db.videos.update(id, { watchProgress: videoEl.value.currentTime })
  } catch (e) {}
}

const onVolumeChange = () => {
  if (!videoEl.value) return
  if (videoEl.value.volume === 0 || videoEl.value.muted) volumeLevel.value = 'muted'
  else if (videoEl.value.volume < 0.5) volumeLevel.value = 'low'
  else volumeLevel.value = 'high'
}

// --- Next Video Logic ---
const handleNext = () => {
  if (!props.nextVideoId) return
  videoEl.value?.pause()
  showNextOverlay.value = true
  
  // After 2 seconds, emit the next event (which triggers route change in parent)
  setTimeout(() => {
    emit('next')
  }, 2000)
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
    case "i": if (videoEl.value) { if(document.pictureInPictureElement) document.exitPictureInPicture(); else videoEl.value.requestPictureInPicture() }; break
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
  clearInterval(progressInterval)
  clearTimeout(animTimeout)
  saveProgress()
})
</script>

<template>
  <div 
    ref="containerEl"
    class="video-container group" 
    :class="{ paused: isPaused, 'full-screen': isFullscreen }"
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
        @pause="isPaused = true; saveProgress()" 
      ></video>

      <!-- CENTER ANIMATIONS (Play/Pause/Volume/Skip) -->
      <transition name="yt-fade">
        <div v-if="feedbackAnim" class="center-anim-overlay">
          <div class="anim-icon-bg">
            <!-- Play -->
            <svg v-if="feedbackAnim === 'play'" viewBox="0 0 24 24" class="w-12 h-12 fill-white"><path d="M8,5.14V19.14L19,12.14L8,5.14Z" /></svg>
            <!-- Pause -->
            <svg v-else-if="feedbackAnim === 'pause'" viewBox="0 0 24 24" class="w-12 h-12 fill-white"><path d="M14,19H18V5H14M6,19H10V5H6V19Z" /></svg>
            <!-- Forward -->
            <svg v-else-if="feedbackAnim === 'forward'" viewBox="0 0 24 24" class="w-12 h-12 fill-white"><path d="M11.5 12l8.5 6V6l-8.5 6zm-9 0l8.5 6V6l-8.5 6z"/></svg>
            <!-- Backward -->
            <svg v-else-if="feedbackAnim === 'backward'" viewBox="0 0 24 24" class="w-12 h-12 fill-white"><path d="M12.5 12L4 18V6l8.5 6zm9 0L13 18V6l8.5 6z"/></svg>
            <!-- Volume / Mute -->
            <div v-else-if="feedbackAnim === 'volume' || feedbackAnim === 'mute'" class="flex flex-col items-center">
              <svg v-if="volumeLevel === 'muted'" viewBox="0 0 24 24" class="w-10 h-10 fill-white mb-1"><path fill="currentColor" d="M12,4L9.91,6.09L12,8.18M4.27,3L3,4.27L7.73,9H3V15H7L12,20V13.27L16.25,17.53C15.58,18.04 14.83,18.46 14,18.7V20.77C15.38,20.45 16.63,19.82 17.68,18.96L19.73,21L21,19.73L12,10.73M19,12C19,12.94 18.8,13.82 18.46,14.64L19.97,16.15C20.62,14.91 21,13.5 21,12C21,7.72 18,4.14 14,3.23V5.29C16.89,6.15 19,8.83 19,12M16.5,12C16.5,10.23 15.5,8.71 14,7.97V10.18L16.45,12.63C16.5,12.43 16.5,12.21 16.5,12Z" /></svg>
              <svg v-else viewBox="0 0 24 24" class="w-10 h-10 fill-white mb-1"><path fill="currentColor" d="M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.84 14,18.7V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12M3,9V15H7L12,20V4L7,9H3Z" /></svg>
              <div class="w-24 h-1.5 bg-white/30 rounded-full overflow-hidden">
                <div class="h-full bg-white rounded-full" :style="{ width: `${videoEl?.volume * 100 || 0}%` }"></div>
              </div>
            </div>
          </div>
        </div>
      </transition>

      <!-- NEXT VIDEO OVERLAY -->
      <transition name="yt-fade">
        <div v-if="showNextOverlay" class="next-overlay">
          <div class="text-white text-xl font-bold mb-4">Up Next</div>
          <div class="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
            <svg viewBox="0 0 24 24" class="w-8 h-8 fill-white ml-1"><path d="M8,5.14V19.14L19,12.14L8,5.14Z" /></svg>
          </div>
        </div>
      </transition>

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

          <!-- Next Video (Made Larger) -->
          <button v-if="nextVideoId" @click="handleNext" class="next-btn hover:text-red-500 transition-colors">
             <svg viewBox="0 0 24 24" class="w-7 h-7 fill-current"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
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
/* Base CSS (from previous) */
*, *::before, *::after { box-sizing: border-box; }
.video-container { position: relative; width: 100%; height: 100%; display: flex; justify-content: center; margin-inline: auto; background-color: black; }
.video-container.full-screen { max-height: 100vh; }
video { width: 100%; height: 100%; object-fit: contain; }
.video-controls-container { position: absolute; bottom: 0; left: 0; right: 0; color: white; z-index: 100; opacity: 0; transition: opacity 150ms ease-in-out; }
.video-controls-container::before { content: ""; position: absolute; bottom: 0; background: linear-gradient(to top, rgba(0, 0, 0, .75), transparent); width: 100%; aspect-ratio: 6 / 1; z-index: -1; pointer-events: none; }
.video-container:hover .video-controls-container, .video-container:focus-within .video-controls-container, .video-container.paused .video-controls-container { opacity: 1; }
.video-controls-container .controls { display: flex; gap: .5rem; padding: .25rem .5rem; align-items: center; }
.video-controls-container .controls button { background: none; border: none; color: inherit; padding: 0; height: 30px; width: 30px; font-size: 1.1rem; cursor: pointer; opacity: .85; transition: opacity 150ms ease-in-out; }
.video-controls-container .controls button:hover { opacity: 1; }
.video-container.paused .pause-icon { display: none; }
.video-container:not(.paused) .play-icon { display: none; }
.video-container.full-screen .open { display: none; }
.video-container:not(.full-screen) .close { display: none; }
.volume-high-icon, .volume-low-icon, .volume-muted-icon { display: none; }
.video-container[data-volume-level="high"] .volume-high-icon { display: block; }
.video-container[data-volume-level="low"] .volume-low-icon { display: block; }
.video-container[data-volume-level="muted"] .volume-muted-icon { display: block; }
.volume-container { display: flex; align-items: center; }
.volume-slider { width: 0; transform-origin: left; transform: scaleX(0); transition: width 150ms ease-in-out, transform 150ms ease-in-out; accent-color: red; cursor: pointer; }
.volume-container:hover .volume-slider, .volume-slider:focus-within { width: 100px; transform: scaleX(1); }
.duration-container { display: flex; align-items: center; gap: .25rem; flex-grow: 1; }
.video-controls-container .controls button.wide-btn { width: 50px; }
.timeline-container { height: 7px; margin-inline: .5rem; cursor: pointer; display: flex; align-items: center; }
.timeline { background-color: rgba(100, 100, 100, .5); height: 3px; width: 100%; position: relative }
.timeline::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; right: calc(100% - var(--preview-position) * 100%); background-color: rgb(150, 150, 150); display: none; }
.timeline::after { content: ""; position: absolute; left: 0; top: 0; bottom: 0; right: calc(100% - var(--progress-position) * 100%); background-color: red; }
.timeline .thumb-indicator { --scale: 0; position: absolute; transform: translateX(-50%) scale(var(--scale)); height: 200%; top: -50%; left: calc(var(--progress-position) * 100%); background-color: red; border-radius: 50%; transition: transform 150ms ease-in-out; aspect-ratio: 1 / 1; }
.video-container.scrubbing .thumb-indicator, .timeline-container:hover .thumb-indicator { --scale: 1; }
.video-container.scrubbing .timeline, .timeline-container:hover .timeline { height: 100%; }

/* NEW: Next button size fix */
.next-btn { width: 36px !important; height: 36px !important; }

/* NEW: Center Animation Overlay */
.center-anim-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 50;
}
.anim-icon-bg {
  width: 80px;
  height: 80px;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(8px);
  animation: popIn 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
}
@keyframes popIn {
  0% { transform: scale(0.5); opacity: 0; }
  50% { transform: scale(1.1); opacity: 1; }
  100% { transform: scale(1); opacity: 0; }
}

/* NEW: Next Video Overlay */
.next-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 60;
  backdrop-filter: blur(4px);
}

/* Vue Transitions */
.yt-fade-enter-active, .yt-fade-leave-active { transition: opacity 0.3s ease; }
.yt-fade-enter-from, .yt-fade-leave-to { opacity: 0; }
</style>
