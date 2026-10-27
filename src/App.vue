<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { RouterView, useRouter, useRoute } from 'vue-router'
import { useLibraryStore } from './stores/library'
import DownloadToasts from './components/DownloadToasts.vue'
import Sidebar from './components/Sidebar.vue'

const library = useLibraryStore()
const router = useRouter()
const route = useRoute()
const q = ref('')
const isSidebarOpen = ref(true)
const isOnline = ref(navigator.onLine)

onMounted(() => {
  library.refresh()
  window.addEventListener('online', () => isOnline.value = true)
  window.addEventListener('offline', () => isOnline.value = false)
})

onUnmounted(() => {
  window.removeEventListener('online', () => isOnline.value = true)
  window.removeEventListener('offline', () => isOnline.value = false)
})

function doSearch() {
  if (!q.value.trim()) return
  
  const urlRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/i;
  if (urlRegex.test(q.value)) {
    router.push({ path: '/', query: { url: q.value } })
    q.value = ''
    return
  }

  router.push({ path: '/' })
}
</script>

<template>
  <div class="min-h-screen flex bg-bg text-text flex-col">
    <div v-if="!isOnline" class="bg-red-900 text-white text-center text-sm py-1 z-50">
      You are currently offline. Playing downloaded videos only.
    </div>

    <div class="flex flex-1">
      <Sidebar :isOpen="isSidebarOpen" />

      <div class="flex-1 flex flex-col min-h-screen transition-all duration-300" :class="isSidebarOpen ? 'ml-60' : 'ml-0'">
        <header class="sticky top-0 z-30 bg-bg/95 backdrop-blur h-14 flex items-center px-4 border-b border-white/5 gap-4">
          <button @click="isSidebarOpen = !isSidebarOpen" class="text-muted hover:text-white p-2">
            <svg viewBox="0 0 24 24" class="w-6 h-6 fill-current"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>
          </button>

          <form @submit.prevent="doSearch" class="flex-1 max-w-2xl">
            <input
              v-model="q"
              type="search"
              placeholder="Search to download or watch a video..."
              class="w-full h-9 px-4 rounded-full bg-surface border border-white/10 focus:outline-none focus:border-white/30 text-sm"
            />
          </form>
        </header>

        <!-- 
          CRITICAL FIX: If the route is 'playables', we remove the padding (p-6) 
          so the games fill the entire screen.
        -->
        <main class="flex-1" :class="route.name === 'playables' ? '' : 'p-6'">
          <RouterView />
        </main>
      </div>
    </div>
    <DownloadToasts />
  </div>
</template>
