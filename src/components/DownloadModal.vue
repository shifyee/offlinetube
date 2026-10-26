<script setup>
import { useDownloadsStore } from '../stores/downloads'
import { formatBytes } from '../api/piped-client'

const props = defineProps({
  video: { type: Object, required: true }
})
const emit = defineEmits(['close'])
const downloads = useDownloadsStore()

// Sort formats from highest to lowest quality
const formats = (props.video.formatStreams || []).sort((a, b) => {
  const hA = parseInt(a.qualityLabel) || 0;
  const hB = parseInt(b.qualityLabel) || 0;
  return hB - hA;
})

function pick(format) {
  downloads.start(props.video, format.url)
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
      
      <div v-if="!formats.length" class="text-sm text-muted py-8 text-center bg-surface-2 rounded-lg">
        No downloadable streams available.
      </div>
      
      <div class="space-y-2 max-h-80 overflow-y-auto pr-1">
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
  </div>
</template>
