<script setup>
import { ref, watch, onMounted } from 'vue'
import { getCachedThumbnail } from '../utils/thumbnail'

const props = defineProps({
  src: { type: String, required: true },
  alt: { type: String, default: '' },
  class: { type: String, default: '' },
  imgClass: { type: String, default: 'w-full h-full object-cover' }
})

const actualSrc = ref(null)
const isLoading = ref(true)

async function loadImage() {
  if (!props.src) return
  isLoading.value = true
  actualSrc.value = await getCachedThumbnail(props.src)
  isLoading.value = false
}

onMounted(loadImage)
watch(() => props.src, loadImage)
</script>

<template>
  <img 
    v-if="actualSrc && !isLoading" 
    :src="actualSrc" 
    :alt="alt" 
    :class="[class, imgClass]"
    loading="lazy"
  />
  <!-- A subtle loading skeleton instead of a broken image icon -->
  <div v-else :class="[class, 'bg-surface-2 flex items-center justify-center']">
    <div v-if="isLoading" class="w-5 h-5 border-2 border-white/20 border-t-white/80 rounded-full animate-spin"></div>
  </div>
</template>
