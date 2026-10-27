<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useRoute } from 'vue-router'
import { api, bestThumbnail, formatDuration, formatBytes } from '../api/piped-client'
import { useDownloadsStore } from '../stores/downloads'
import { useLibraryStore } from '../stores/library'
import { db } from '../db'
import Player from '../components/Player.vue'
import DownloadModal from '../components/DownloadModal.vue'

const route = useRoute()
const downloads = useDownloadsStore()
const library = useLibraryStore()

const video = ref(null)
const upNext = ref([])
const comments = ref([])
const loading = ref(true)
const error = ref(null)
const showComments = ref(false)
const showModal = ref(false)
const isExpanded = ref(false)

// Interaction states
const isLiked = ref(false)
const isCopied = ref(false)

const isOffline = computed(() => library.videos.some(v => v.id === route.params.id && v.status === 'complete'))
const stream = computed(() => video.value?.formatStreams?.[0])
const poster = computed(() => video.value ? (bestThumbnail(video.value)?.url || null) : null)

async function load(id) {
  loading.value = true
  error.value = null
  video.value = null
  upNext.value = []
  comments.value = []
  showComments.value = false
  
  // Reset interaction states on new video load
  isLiked.value = false
  isCopied.value = false
  
  const localVideo = await db.videos.get(id)
  
  if (localVideo && localVideo.status === 'complete') {
    video.value = {
      videoId: localVideo.id,
      title: localVideo.title,
      author: localVideo.author,
      authorId: localVideo.authorId,
      authorAvatar: null,
      lengthSeconds: localVideo.lengthSeconds,
      description: localVideo.description || 'This video is saved in your offline library.',
      comments: localVideo.comments || [],
      videoThumbnails: localVideo.thumbnail ? [{ url: localVideo.thumbnail }] : [],
      formatStreams: [{ url: 'offline' }]
    }
    
    upNext.value = library.complete.filter(v => v.id !== id).slice(0, 10)
    loading.value = false
    return
  }

  try {
    video.value = await api.video(id)
    if (video.value.related && video.value.related.length > 0) {
      upNext.value = video.value.related.filter(v => v.videoId !== id).slice(0, 8)
    }
  } catch (e) {
    error.value = String(e.message || e)
  } finally {
    loading.value = false
  }
}

async function loadComments() {
  if (showComments.value) { showComments.value = false; return }
  showComments.value = true
  
  if (isOffline.value) return 
  
  if (comments.value.length) return
  try { 
    const data = await api.comments(route.params.id)
    comments.value = data || []
  }
  catch (e) { comments.value = [{ commentId: '_e', author: 'Error', content: String(e.message || e) }] }
}

// Interaction functions
function toggleLike() {
  isLiked.value = !isLiked.value
}

async function shareVideo() {
  try {
    // Get the current page URL (e.g., https://offlinetube.pages.dev/watch/VIDEO_ID)
    const shareUrl = window.location.href
    await navigator.clipboard.writeText(shareUrl)
    
    isCopied.value = true
    setTimeout(() => {
      isCopied.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy text: ', err)
  }
}

onMounted(() => {
  library.refresh().then(() => load(route.params.id))
})
watch(() => route.params.id, (id) => { if (id) load(id) })

const handleImageError = (e) => { e.target.src = 'https://placehold.co/400x225/1f1f1f/aaaaaa?text=No+Thumbnail' }
const handleAvatarError = (e) => { e.target.src = `https://ui-avatars.com/api/?name=${video.value?.author?.charAt(0)}&background=282828&color=fff` }
</script>

<template>
  <div class="max-w-[1800px] mx-auto px-4 py-4 flex gap-6">
    <div class="flex-1 min-w-0">
      <div v-if="loading" class="text-muted text-sm py-12 text-center">Loading…</div>
      <div v-else-if="error && !video" class="text-red-400 text-sm py-12 text-center">{{ error }}</div>

      <div v-else-if="video">
        <div class="aspect-video bg-black rounded-xl overflow-hidden shadow-lg">
          <Player :video-id="isOffline ? null : route.params.id" :offline-video-id="isOffline ? route.params.id : null" :poster="poster" />
        </div>

        <h1 class="text-xl font-bold mt-3">{{ video.title }}</h1>
        
        <div class="flex flex-wrap items-center justify-between gap-4 mt-3 border-b border-white/10 pb-4">
          <div class="flex items-center gap-3">
            <component :is="video.authorId ? 'RouterLink' : 'div'" :to="video.authorId ? `/channel/${video.authorId}` : null" class="w-11 h-11 rounded-full bg-surface-2 flex items-center justify-center text-lg font-bold text-muted shrink-0 overflow-hidden">
              <img v-if="video.authorAvatar" :src="video.authorAvatar" @error="handleAvatarError" class="w-full h-full object-cover" />
              <span v-else>{{ video.author?.charAt(0) || '?' }}</span>
            </component>
            <div>
              <component :is="video.authorId ? 'RouterLink' : 'span'" :to="video.authorId ? `/channel/${video.authorId}` : null" class="font-bold hover:text-white block">{{ video.author }}</component>
              <span class="text-xs text-muted">{{ isOffline ? 'Saved Offline' : 'Visit Channel' }}</span>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <!-- Like / Dislike Buttons -->
            <div class="flex items-center bg-surface rounded-full overflow-hidden border border-white/10">
              <button 
                @click="toggleLike"
                class="flex items-center gap-2 px-4 py-1.5 transition-all border-r border-white/10"
                :class="isLiked ? 'bg-blue-500/10 text-blue-400' : 'hover:bg-surface-2 text-muted hover:text-white'"
              >
                <svg viewBox="0 0 24 24" class="w-5 h-5" :class="isLiked ? 'fill-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]' : 'fill-current'">
                  <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/>
                </svg>
                <span class="text-sm font-medium">Like</span>
              </button>
              
              <button class="px-4 py-1.5 hover:bg-surface-2 text-muted hover:text-white transition-colors">
                <svg viewBox="0 0 24 24" class="w-5 h-5 fill-current"><path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z"/></svg>
              </button>
            </div>
            
            <!-- Share Button -->
            <button 
              @click="shareVideo"
              class="flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all border"
              :class="isCopied ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-surface border-white/10 hover:bg-surface-2 text-white'"
            >
              <svg v-if="!isCopied" viewBox="0 0 24 24" class="w-5 h-5 fill-current"><path d="M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z"/></svg>
              <svg v-else viewBox="0 0 24 24" class="w-5 h-5 fill-current"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>
              
              {{ isCopied ? 'Copied!' : 'Share' }}
            </button>

            <button v-if="!isOffline && video.formatStreams?.length" @click="showModal = true" class="flex items-center gap-2 bg-surface hover:bg-surface-2 px-4 py-1.5 rounded-full text-sm font-medium transition-colors border border-white/10">
              <svg viewBox="0 0 24 24" class="w-5 h-5 fill-current"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
              Download
            </button>
          </div>
        </div>

        <div class="mt-4 bg-surface rounded-xl p-4 text-sm cursor-pointer hover:bg-surface-2 transition-colors" @click="isExpanded = !isExpanded">
          <div class="font-bold text-xs text-muted mb-1">
            {{ video.lengthSeconds ? formatDuration(video.lengthSeconds) : 'Unknown length' }} · {{ isOffline ? 'Offline Library' : 'Streamed on ' + new Date().toLocaleDateString() }}
          </div>
          <div :class="isExpanded ? 'whitespace-pre-wrap' : 'line-clamp-2'">
            {{ video.description || 'No description provided.' }}
          </div>
        </div>

        <button @click="loadComments" class="mt-6 font-bold text-sm text-accent hover:text-red-400">
          {{ showComments ? 'Hide comments' : 'Show comments' }}
        </button>

        <div v-if="showComments" class="mt-4 space-y-4">
          <div v-if="!video.comments?.length && !comments.length" class="text-muted text-sm">No comments.</div>
          
          <!-- Offline Comments -->
          <template v-if="isOffline && video.comments?.length">
            <div v-for="c in video.comments" :key="c.commentId" class="flex gap-3">
              <div class="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center font-bold text-muted shrink-0">{{ c.author.charAt(0) }}</div>
              <div>
                <div class="text-sm font-bold">{{ c.author }}</div>
                <div class="text-sm text-gray-300 mt-1 whitespace-pre-wrap">{{ c.content }}</div>
              </div>
            </div>
          </template>

          <!-- Online Comments -->
          <template v-else-if="!isOffline">
            <div v-for="c in comments" :key="c.commentId" class="flex gap-3">
              <div class="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center font-bold text-muted shrink-0">{{ c.author.charAt(0) }}</div>
              <div>
                <div class="text-sm font-bold">{{ c.author }}</div>
                <div class="text-sm text-gray-300 mt-1 whitespace-pre-wrap">{{ c.content }}</div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <div class="w-96 shrink-0 hidden lg:block">
      <h2 class="font-bold text-lg mb-4">{{ isOffline ? 'Up Next (Offline)' : 'Up Next' }}</h2>
      <div class="space-y-3">
        <RouterLink v-for="v in upNext" :key="v.videoId || v.id" :to="`/watch/${v.videoId || v.id}`" class="flex gap-2 group">
          <div class="relative w-40 aspect-video bg-surface rounded-lg overflow-hidden shrink-0">
            <img v-if="bestThumbnail(v) || v.thumbnail" :src="bestThumbnail(v)?.url || v.thumbnail" @error="handleImageError" class="w-full h-full object-cover group-hover:scale-105 transition-transform" />
            <span v-if="v.lengthSeconds" class="absolute bottom-1 right-1 bg-black/80 text-[11px] px-1 rounded">{{ formatDuration(v.lengthSeconds) }}</span>
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="text-sm font-bold line-clamp-2 group-hover:text-white">{{ v.title }}</h3>
            <p class="text-xs text-muted mt-1 truncate">{{ v.author }}</p>
          </div>
        </RouterLink>
      </div>
    </div>

    <DownloadModal v-if="showModal && video" :video="video" @close="showModal = false" />
  </div>
</template>
