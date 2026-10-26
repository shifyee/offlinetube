<script setup>
import { ref, onMounted } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { useLibraryStore } from './stores/library'
import DownloadToasts from './components/DownloadToasts.vue'
import Sidebar from './components/Sidebar.vue'

const library = useLibraryStore()
const route = useRoute()
const router = useRouter()
const q = ref('')
const isSidebarOpen = ref(true)

onMounted(() => library.refresh())

function doSearch() {
  if (!q.value.trim()) return
  
  // Check if the input is a YouTube URL
  const urlRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/i;
  if (urlRegex.test(q.value)) {
    router.push({ path: '/downloader', query: { url: q.value } })
    q.value = '' // Clear input
    return
  }

  // Otherwise, it's a normal search
  router.push({ path: '/search', query: { q: q.value } })
}
</script>

<template>
  <div class="min-h-screen flex bg-bg text-text">
    <!-- Sidebar with dynamic width based on state -->
    <Sidebar :isOpen="isSidebarOpen" />

    <!-- Main Content Area with dynamic left margin -->
    <div class="flex-1 flex flex-col min-h-screen transition-all duration-300" :class="isSidebarOpen ? 'ml-60' : 'ml-0'">
      <!-- Top Bar -->
      <header class="sticky top-0 z-30 bg-bg/95 backdrop-blur h-14 flex items-center px-4 border-b border-white/5 gap-4">
        <!-- Hamburger Menu Button -->
        <button @click="isSidebarOpen = !isSidebarOpen" class="text-muted hover:text-white p-2">
          <svg viewBox="0 0 24 24" class="w-6 h-6 fill-current"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>
        </button>

        <form @submit.prevent="doSearch" class="flex-1 max-w-2xl">
          <input
            v-model="q"
            type="search"
            placeholder="Search or paste YouTube URL to download..."
            class="w-full h-9 px-4 rounded-full bg-surface border border-white/10 focus:outline-none focus:border-white/30 text-sm"
          />
        </form>
      </header>

      <main class="flex-1 p-6">
        <RouterView />
      </main>
    </div>
    <DownloadToasts />
  </div>
</template>
