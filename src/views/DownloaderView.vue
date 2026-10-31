<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { api, bestThumbnail, formatDuration, formatBytes } from '../api/piped-client'
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
const showComments = ref(false)
const isExpanded = ref(false)

const isAlreadyDownloaded = computed(() => 
  video.value ? library.videos.some(v => v.id === video.value.videoId && v.status === 'complete') : false
)

async function processUrl() {
  if (!urlInput.value.trim()) return
  loading.value = true
  error.value = null
  video.value = null
  showComments.value = false

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
  }
}

function goToOfflinePlayer() {
  if (video.value) {
    router.push(`/watch/${video.value.videoId}`)
  }
}
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 py-8 flex flex-col items-center">
    
    <!-- Input Area -->
    <div class="w-full max-w-2xl text-center mb-8">
      <h1 class="text-3xl font-bold mb-3">Watch & Download</h1>
      <p class="text-muted mb-6">Paste a YouTube link to watch online or save it for offline viewing.</p>
      
      <div class="flex gap-2">
        <input
          v-model="urlInput"
          @keyup.enter="processUrl"
          type="text"
          placeholder="Search to download or watch a video..."
          class="flex-1 h-14 px-5 rounded-xl bg-surface border border-white/10 focus:outline-none focus:border-accent text-lg transition-all duration-300"
        />
        <button 
          @click="processUrl" 
          :disabled="loading || !urlInput.trim()"
          class="h-14 px-8 rounded-xl bg-accent hover:bg-red-700 text-white font-bold text-lg transition-all duration-300 disabled:opacity-50 flex items-center gap-2 hover:scale-[1.02] active:scale-95"
        >
          <svg v-if="loading" class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          {{ loading ? 'Fetching...' : 'Fetch' }}
        </button>
      </div>
      
      <Transition name="scale-fade">
        <div v-if="error" class="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-left">
          {{ error }}
        </div>
      </Transition>
    </div>

    <!-- Unified Video Experience (Animated) -->
    <Transition name="scale-fade">
      <div v-if="video" class="w-full max-w-4xl bg-surface rounded-2xl overflow-hidden shadow-2xl border border-white/5">
        
        <!-- Player -->
        <div class="aspect-video bg-black">
          <iframe 
            :src="`https://www.youtube.com/embed/${video.videoId}?autoplay=0&rel=0`"
            class="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
          ></iframe>
        </div>

        <div class="p-6">
          <h2 class="font-bold text-xl mb-2">{{ video.title }}</h2>
          <p class="text-sm text-muted mb-4">By {{ video.author }}</p>

          <!-- Action Row -->
          <div class="flex items-center gap-3 mb-6">
            <button 
              @click="startDownload"
              class="h-10 px-6 rounded-lg bg-accent hover:bg-red-700 text-white font-bold text-sm transition-all hover:scale-[1.02] active:scale-95 flex items-center gap-2"
            >
              <svg viewBox="0 0 24 24" class="w-4 h-4 fill-current"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
              Download Options
            </button>
            
            <button 
              v-if="isAlreadyDownloaded"
              @click="goToOfflinePlayer"
              class="h-10 px-6 rounded-lg bg-surface-2 hover:bg-surface-3 text-white font-bold text-sm transition-all hover:scale-[1.02] active:scale-95 flex items-center gap-2 border border-white/10"
            >
              <svg viewBox="0 0 24 24" class="w-4 h-4 fill-current"><path d="M8 5v14l11-7z"/></svg>
              Play Offline
            </button>
          </div>

          <!-- Description -->
          <div 
            v-if="video.description"
            class="bg-surface-2 rounded-xl p-4 text-sm cursor-pointer hover:bg-surface-3 transition-colors mb-4"
            @click="isExpanded = !isExpanded"
          >
            <div :class="isExpanded ? 'whitespace-pre-wrap' : 'line-clamp-2 text-muted'">
              {{ video.description }}
            </div>
          </div>

          <!-- Comments Toggle -->
          <button 
            v-if="video.comments?.length"
            @click="showComments = !showComments" 
            class="text-sm font-bold text-accent hover:text-red-400 transition-colors"
          >
            {{ showComments ? 'Hide comments' : `Show ${video.comments.length} comments` }}
          </button>

          <!-- Comments List -->
          <Transition name="fade-slide">
            <div v-if="showComments && video.comments?.length" class="mt-4 space-y-3">
              <div v-for="c in video.comments" :key="c.commentId" class="bg-surface-2 p-3 rounded-lg flex gap-3">
                <div class="w-8 h-8 rounded-full bg-surface-3 flex items-center justify-center font-bold text-muted shrink-0">{{ c.author.charAt(0) }}</div>
                <div>
                  <div class="text-xs font-bold">{{ c.author }}</div>
                  <div class="text-sm text-gray-300 mt-1 whitespace-pre-wrap">{{ c.content }}</div>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </Transition>

    <DownloadModal v-if="showModal && video" :video="video" @close="showModal = false" />
  </div>
</template>
