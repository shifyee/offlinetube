<script setup>
import { ref } from 'vue'
import { useDownloadsStore } from '../stores/downloads'
import { formatBytes } from '../api/piped-client'

const props = defineProps({
  video: { type: Object, required: true }
})
const emit = defineEmits(['close'])
const downloads = useDownloadsStore()

const selectedFormat = ref('mp4') // 'mp4' or 'mp3'

// Sort formats from highest to lowest quality
const formats = (props.video.formatStreams || []).sort((a, b) => {
  const hA = parseInt(a.qualityLabel) || 0;
  const hB = parseInt(b.qualityLabel) || 0;
  return hB - hA;
})

function pick(formatData) {
  if (selectedFormat.value === 'mp3') {
    downloads.start(props.video, null, 'mp3')
  } else {
    downloads.start(props.video, formatData.url, 'mp4')
  }
  emit('close')
}
</script>

<template>
  <div class="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" @click.self="$emit('close')">
    <div class="bg-surface rounded-xl p-5 max-w-md w-full border border-white/5 shadow-2xl">
      <div class="flex items-center justify-between mb-4">
        <h2 class="font-bold text-lg">Save for Offline</h2>
        <button @click="$emit('close')" class="text-muted hover:text-white text-2xl leading-none">×</button>
      </div>
      <p class="text-xs text-muted mb-4 line-clamp-2">{{ video.title }}</p>

      <!-- Format Toggle -->
      <div class="flex gap-2 mb-4 bg-surface-2 p-1 rounded-lg">
        <button 
          @click="selectedFormat = 'mp4'" 
          class="flex-1 py-1.5 text-sm font-medium rounded-md transition-colors"
          :class="selectedFormat === 'mp4' ? 'bg-surface text-white shadow' : 'text-muted hover:text-white'"
        >
          Video (MP4)
        </button>
        <button 
          @click="selectedFormat = 'mp3'" 
          class="flex-1 py-1.5 text-sm font-medium rounded-md transition-colors"
          :class="selectedFormat === 'mp3' ? 'bg-surface text-white shadow' : 'text-muted hover:text-white'"
        >
          Audio (MP3)
        </button>
      </div>
      
      <!-- MP4 Qualities -->
      <div v-if="selectedFormat === 'mp4'">
        <div v-if="!formats.length" class="text-sm text-muted py-8 text-center bg-surface-2 rounded-lg">
          No downloadable streams available.
        </div>
        
        <div class="space-y-2 max-h-64 overflow-y-auto pr-1">
          <button
            v-for="(f, i) in formats"
            :key="i"
            @click="pick(f)"
            class="w-full text-left px-4 py-3 rounded-lg bg-surface-2 hover:bg-surface-3 flex items-center justify-between transition-colors border border-transparent hover:border-white/10"
          >
            <span class="text-sm font-bold">{{ f.qualityLabel || f.quality || 'Standard' }}</span>
            <span class="text-xs text-muted font-mono">
              MP4
              <template v-if="f.contentLength"> · {{ formatBytes(parseInt(f.contentLength, 10)) }}</template>
            </span>
          </button>
        </div>
      </div>

      <!-- MP3 Option -->
      <div v-else>
        <button
          @click="pick()"
          class="w-full text-left px-4 py-4 rounded-lg bg-surface-2 hover:bg-surface-3 flex flex-col items-center justify-center transition-colors border border-transparent hover:border-white/10"
        >
          <svg viewBox="0 0 24 24" class="w-8 h-8 fill-accent mb-2"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
          <span class="text-sm font-bold">Download Audio (MP3)</span>
          <span class="text-xs text-muted mt-1">Best available quality</span>
        </button>
      </div>
    </div>
  </div>
</template>
