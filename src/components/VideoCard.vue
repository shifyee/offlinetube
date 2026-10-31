<script setup>
import { computed } from 'vue'
import { bestThumbnail, formatDuration } from '../api/piped-client'

const props = defineProps({
  video: { type: Object, required: true }
})

const thumb = computed(() => bestThumbnail(props.video))
const duration = computed(() => props.video.lengthSeconds ? formatDuration(props.video.lengthSeconds) : null)
const authorName = computed(() => props.video.author || props.video.authorName || '')
const avatar = computed(() => props.video.authorAvatar || null)

// Offline-safe Base64 SVG fallback
const handleImageError = (e) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9" style="background:#1a1a1a;width:100%;height:100%;display:block;">
    <rect width="16" height="9" fill="#1a1a1a"/>
    <circle cx="8" cy="4.5" r="1.5" fill="#2a2a2a"/>
    <path d="M7.5 3.5L9.5 4.5L7.5 5.5V3.5Z" fill="#666"/>
  </svg>`;
  e.target.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  e.target.onerror = null; // Prevent infinite loop
}

// Offline-safe avatar fallback (hides the broken image so the background shows)
const handleAvatarError = (e) => {
  e.target.style.display = 'none'
}
</script>

<template>
  <RouterLink :to="`/watch/${video.videoId}`" class="block group">
    <div class="relative aspect-video bg-surface rounded-xl overflow-hidden">
      <!-- Added crossorigin="anonymous" so the Service Worker can cache it -->
      <img
        v-if="thumb"
        :src="thumb.url"
        :alt="video.title"
        @error="handleImageError"
        crossorigin="anonymous"
        loading="lazy"
        class="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
      />
      <span
        v-if="duration"
        class="absolute bottom-1.5 right-1.5 bg-black/80 text-[11px] px-1.5 py-0.5 rounded"
      >{{ duration }}</span>
    </div>
    <div class="mt-3 flex gap-3">
      <!-- Channel Avatar -->
      <div class="w-9 h-9 rounded-full bg-surface-2 flex-shrink-0 overflow-hidden flex items-center justify-center font-bold text-muted text-sm">
        <img 
          v-if="avatar" 
          :src="avatar" 
          @error="handleAvatarError" 
          crossorigin="anonymous"
          class="w-full h-full object-cover" 
        />
        <template v-else>{{ authorName.charAt(0) }}</template>
      </div>
      
      <div class="min-w-0 flex-1">
        <h3 class="font-bold text-sm line-clamp-2 group-hover:text-white">{{ video.title }}</h3>
        <p class="text-xs text-muted mt-1 truncate">{{ authorName }}</p>
      </div>
    </div>
  </RouterLink>
</template>
