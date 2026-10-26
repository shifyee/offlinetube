<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { api, bestThumbnail, formatDuration } from '../api/piped-client'
import { useDownloadsStore } from '../stores/downloads'
import { useLibraryStore } from '../stores/library'
import DownloadModal from '../components/DownloadModal.vue'

const router = useRouter()
const downloads = useDownloadsStore()
const library = useLibraryStore()

const urlInput = ref('')
const loading = ref(false)
const error = ref(null)
const video = ref(null)
const showModal = ref(false)

const isAlreadyDownloaded = computed(() => 
  video.value ? library.videos.some(v => v.id === video.value.videoId && v.status === 'complete') : false
)

async function processUrl() {
  if (!urlInput.value.trim()) return
  loading.value = true
  error.value = null
  video.value = null

  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/i;
  const match = urlInput.value.match(regex);

  if (!match || !match[1]) {
    error.value = 'Invalid YouTube URL. Please paste a valid link.'
    loading.value = false
    return
  }

  const videoId = match[1]

  try {
    video.value = await api.video(videoId)
    if (!video.value.formatStreams || video.value.formatStreams.length === 0) {
      error.value = "No downloadable streams found. The backend might have failed to extract them."
    }
  } catch (e) {
    error.value = String(e.message || e)
  } finally {
    loading.value = false
  }
}

function startDownload() {
  if (video.value && video.value.formatStreams?.length > 0) {
    showModal.value = true
  } else {
    alert("No downloadable streams found.")
  }
}

function goToPlayer() {
  if (video.value) {
    router.push(`/watch/${video.value.videoId}`)
  }
}
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 py-12 flex flex-col items-center">
    <div class="text-center mb-10">
      <div class="w-20 h-20 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <svg viewBox="0 0 24 24" class="w-10 h-10 fill-accent"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
      </div>
      <h1 class="text-3xl font-bold mb-3">YouTube Downloader</h1>
      <p class="text-muted">Paste a YouTube link below to save it directly to your offline library.</p>
    </div>

    <div class="w-full max-w-2xl flex gap-2 mb-8">
      <input
        v-model="urlInput"
        @keyup.enter="processUrl"
        type="text"
        placeholder="https://www.youtube.com/watch?v=..."
        class="flex-1 h-14 px-5 rounded-xl bg-surface border border-white/10 focus:outline-none focus:border-accent text-lg transition-colors"
      />
      <button 
        @click="processUrl" 
        :disabled="loading || !urlInput.trim()"
        class="h-14 px-8 rounded-xl bg-accent hover:bg-red-700 text-white font-bold text-lg transition-colors disabled:opacity-50 flex items-center gap-2"
      >
        <svg v-if="loading" class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        {{ loading ? 'Fetching...' : 'Fetch' }}
      </button>
    </div>

    <div v-if="error" class="w-full max-w-2xl p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-center mb-8">
      {{ error }}
    </div>

    <div v-if="video" class="w-full max-w-2xl bg-surface rounded-2xl overflow-hidden shadow-2xl border border-white/5">
      <div class="flex flex-col sm:flex-row gap-4 p-4">
        <div class="relative w-full sm:w-64 aspect-video bg-black rounded-lg overflow-hidden shrink-0">
          <img v-if="bestThumbnail(video)" :src="bestThumbnail(video).url" class="w-full h-full object-cover" />
          <span v-if="video.lengthSeconds" class="absolute bottom-2 right-2 bg-black/80 text-xs px-2 py-1 rounded font-mono">
            {{ formatDuration(video.lengthSeconds) }}
          </span>
        </div>

        <div class="flex flex-col justify-between flex-1 min-w-0">
          <div>
            <h2 class="font-bold text-lg line-clamp-2 leading-tight mb-2">{{ video.title }}</h2>
            <p class="text-sm text-muted mb-1 flex items-center gap-2">
              {{ video.author }}
            </p>
          </div>
          
          <div class="flex items-center gap-3 mt-4">
            <button 
              @click="startDownload"
              class="flex-1 h-10 rounded-lg bg-accent hover:bg-red-700 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
            >
              <svg viewBox="0 0 24 24" class="w-4 h-4 fill-current"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
              Download
            </button>
            <button 
              @click="goToPlayer"
              class="flex-1 h-10 rounded-lg bg-surface-2 hover:bg-surface-3 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
            >
              <svg viewBox="0 0 24 24" class="w-4 h-4 fill-current"><path d="M8 5v14l11-7z"/></svg>
              Watch Online
            </button>
          </div>
        </div>
      </div>
      
      <div v-if="isAlreadyDownloaded" class="bg-green-500/10 text-green-400 text-sm p-3 text-center border-t border-green-500/20">
        ✓ This video is already saved in your offline library.
      </div>
    </div>

    <DownloadModal v-if="showModal && video" :video="video" @close="showModal = false" />
  </div>
</template>
