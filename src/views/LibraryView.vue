<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useLibraryStore } from '../stores/library'
import { usePlaylistStore } from '../stores/playlists'
import { db } from '../db'
import { formatBytes, formatDuration } from '../api/piped-client'
import CachedImage from '../components/CachedImage.vue'

const library = useLibraryStore()
const playlists = usePlaylistStore()
const storageStats = ref({ usage: 0, quota: 0 })
const openPlaylistMenu = ref(null)
const fileInput = ref(null)
const importing = ref(false)
const importStatus = ref('')

const totalRuntimeSeconds = computed(() =>
  library.complete.reduce((total, video) => total + (Number(video.lengthSeconds) || 0), 0)
)

const totalRuntimeLabel = computed(() => {
  const seconds = totalRuntimeSeconds.value
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  if (hours > 0) {
    return `${hours} hr ${minutes} min${remainingSeconds ? ` ${remainingSeconds} sec` : ''}`
  }
  if (minutes > 0) return `${minutes} min${remainingSeconds ? ` ${remainingSeconds} sec` : ''}`
  return `${remainingSeconds} sec`
})

async function updateStorage() {
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate()
      storageStats.value = {
        usage: estimate.usage || 0,
        quota: estimate.quota || 0
      }
    } catch (e) {
      console.error('Failed to get storage estimate:', e)
    }
  }
}

function getVideoDuration(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? Math.round(video.duration) : 0
      URL.revokeObjectURL(url)
      video.removeAttribute('src')
      video.load()
      resolve(duration)
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      video.removeAttribute('src')
      video.load()
      resolve(0)
    }
    video.src = url
  })
}

async function importFiles(event) {
  const files = Array.from(event.target.files || []).filter(file =>
    file.type.startsWith('video/') || /\.(mp4|m4v|mov|webm|mkv|avi|ogv)$/i.test(file.name)
  )
  event.target.value = ''
  if (!files.length) return

  importing.value = true
  let imported = 0
  const failed = []

  try {
    for (const file of files) {
      const id = `local-${crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(16).slice(2)}`
      try {
        importStatus.value = `Importing ${imported + 1} of ${files.length}: ${file.name}`
        const lengthSeconds = await getVideoDuration(file)
        const now = Date.now()

        await db.transaction('rw', db.videos, db.chunks, async () => {
          await db.videos.put({
            id,
            title: file.name.replace(/\.[^.]+$/, ''),
            author: 'Imported from device',
            lengthSeconds,
            thumbnail: null,
            description: '',
            comments: [],
            format: file.type.split('/')[1] || 'video',
            mimeType: file.type || 'video/mp4',
            status: 'complete',
            progress: 1,
            size: file.size,
            addedAt: now,
            downloadedAt: now,
            watchProgress: 0
          })
          await db.chunks.add({ videoId: id, seq: 0, blob: file })
        })
        imported++
      } catch (error) {
        console.error('Failed to import video:', file.name, error)
        failed.push(file.name)
      }
    }

    await library.refresh()
    await updateStorage()
    importStatus.value = failed.length
      ? `Imported ${imported} of ${files.length}. ${failed.length} could not be imported.`
      : `Successfully imported ${imported} video${imported === 1 ? '' : 's'}.`
  } finally {
    importing.value = false
    if (!importStatus.value) importStatus.value = ''
  }
}

onMounted(() => {
  library.refresh().then(updateStorage)
  playlists.refresh()
})

async function remove(id) {
  if (confirm('Delete this download?')) {
    await library.remove(id)
    await playlists.refresh()
    updateStorage()
  }
}

async function addToPlaylist(playlistId, video) {
  await playlists.addVideo(playlistId, video)
  openPlaylistMenu.value = null
}

const interval = setInterval(updateStorage, 5000)
onUnmounted(() => clearInterval(interval))
</script>

<template>
  <div class="max-w-7xl mx-auto px-3 py-4" @click="openPlaylistMenu = null">
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

    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div>
        <h1 class="text-xl font-semibold">Library</h1>
        <div class="text-xs text-muted mt-1">
          {{ library.complete.length }} saved · {{ totalRuntimeLabel }} total
        </div>
      </div>
      <div class="flex items-center gap-2">
        <input
          ref="fileInput"
          type="file"
          accept="video/*,.mp4,.m4v,.mov,.webm,.mkv,.avi,.ogv"
          multiple
          class="hidden"
          @change="importFiles"
        />
        <button
          @click.stop="fileInput?.click()"
          :disabled="importing"
          class="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:brightness-110 disabled:opacity-50 disabled:cursor-wait transition"
        >
          {{ importing ? 'Importing…' : 'Import Files' }}
        </button>
      </div>
    </div>

    <div v-if="importStatus" class="text-xs text-muted mb-4" aria-live="polite">{{ importStatus }}</div>

    <div v-if="library.loading" class="text-muted text-sm py-12 text-center">Loading…</div>
    <div v-else-if="!library.complete.length" class="text-muted text-sm py-12 text-center">
      No offline videos yet. Download one or import video files to get started.
    </div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <div
        v-for="v in library.complete"
        :key="v.id"
        class="group bg-surface rounded-xl overflow-hidden border border-white/5 transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_10px_40px_rgba(255,0,51,0.15)] relative"
      >
        <RouterLink :to="`/watch/${v.id}`">
          <div class="aspect-video bg-surface-2 overflow-hidden relative">
            <CachedImage
              v-if="v.thumbnail"
              :src="v.thumbnail"
              class="w-full h-full"
              img-class="object-cover transition-transform duration-500 group-hover:scale-110"
            />
            <div v-else class="w-full h-full flex items-center justify-center text-muted text-3xl">
              <svg viewBox="0 0 24 24" class="w-12 h-12 fill-current"><path d="M8 5v14l11-7z"/></svg>
            </div>
            <span
              v-if="v.lengthSeconds"
              class="absolute bottom-1.5 right-1.5 bg-black/80 text-[11px] px-1.5 py-0.5 rounded text-white z-10 font-medium"
            >
              {{ formatDuration(v.lengthSeconds) }}
            </span>
            <div
              v-if="v.watchProgress > 0 && v.watchProgress < v.lengthSeconds - 5"
              class="absolute bottom-0 left-0 right-0 h-1 bg-black/60 z-10"
            >
              <div class="h-full bg-red-600" :style="{ width: `${(v.watchProgress / v.lengthSeconds) * 100}%` }"></div>
            </div>
          </div>
        </RouterLink>
        <div class="p-4">
          <div class="font-bold text-sm line-clamp-2">{{ v.title }}</div>
          <div class="text-xs text-muted mt-1">{{ v.author }}</div>
          <div class="flex items-center justify-between mt-3">
            <span class="text-[11px] text-muted font-mono">{{ formatBytes(v.size) }}</span>
            <button @click="remove(v.id)" class="text-xs text-red-400 hover:text-red-300 transition-colors">Delete</button>
          </div>
        </div>

        <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button
            @click.stop="openPlaylistMenu = openPlaylistMenu === v.id ? null : v.id"
            class="bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-full backdrop-blur-sm transition-colors"
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
