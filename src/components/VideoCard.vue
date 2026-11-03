<script setup>
import { computed } from 'vue'
import { bestThumbnail, formatDuration } from '../api/piped-client'
import CachedImage from './CachedImage.vue' // <--- Import

const props = defineProps({
  video: { type: Object, required: true }
})

const thumb = computed(() => bestThumbnail(props.video))
const duration = computed(() => props.video.lengthSeconds ? formatDuration(props.video.lengthSeconds) : null)
const authorName = computed(() => props.video.author || props.video.authorName || '')
const avatar = computed(() => props.video.authorAvatar || null)

const handleAvatarError = (e) => { e.target.style.display = 'none' }
</script>

<template>
  <RouterLink :to="`/watch/${video.videoId}`" class="block group">
    <div class="relative aspect-video bg-surface rounded-xl overflow-hidden">
      <!-- THE FIX -->
      <CachedImage
        v-if="thumb"
        :src="thumb.url"
        :alt="video.title"
        class="group-hover:scale-[1.02] transition-transform duration-300"
        img-class="w-full h-full object-cover"
      />
      <span
        v-if="duration"
        class="absolute bottom-1.5 right-1.5 bg-black/80 text-[11px] px-1.5 py-0.5 rounded text-white z-10"
      >{{ duration }}</span>
    </div>
    <div class="mt-3 flex gap-3">
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
