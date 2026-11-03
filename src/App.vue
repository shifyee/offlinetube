<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { RouterView, useRouter, useRoute } from 'vue-router'
import { useLibraryStore } from './stores/library'
import { useSettingsStore } from './stores/settings'
import DownloadToasts from './components/DownloadToasts.vue'
import Sidebar from './components/Sidebar.vue'

const library = useLibraryStore()
const settings = useSettingsStore()
const router = useRouter()
const route = useRoute()
const q = ref('')
const isSidebarOpen = ref(true)
const isOnline = ref(navigator.onLine)

// Offline Toast State
const showOfflineToast = ref(false)
const toastMessage = ref('')
let toastTimeout = null

function triggerToast(msg) {
  toastMessage.value = msg
  showOfflineToast.value = true
  clearTimeout(toastTimeout)
  toastTimeout = setTimeout(() => { showOfflineToast.value = false }, 4000)
}

onMounted(() => {
  settings.applyTheme()
  library.refresh()
  
  window.addEventListener('online', () => {
    isOnline.value = true
    triggerToast('You are back online.')
  })
  
  window.addEventListener('offline', () => {
    isOnline.value = false
    triggerToast('You are offline. Playing downloaded videos only.')
  })
})

onUnmounted(() => {
  window.removeEventListener('online', () => {})
  window.removeEventListener('offline', () => {})
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
    
    <!-- Offline Toast Popup -->
    <Transition name="toast">
      <div v-if="showOfflineToast" class="fixed top-16 left-1/2 -translate-x-1/2 z-[100] bg-surface/90 backdrop-blur-md text-white px-6 py-3 rounded-xl shadow-2xl border border-white/10 flex items-center gap-3 text-sm font-medium">
        <svg v-if="!isOnline" viewBox="0 0 24 24" class="w-5 h-5 fill-red-500"><path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/></svg>
        <svg v-else viewBox="0 0 24 24" class="w-5 h-5 fill-green-500"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
        {{ toastMessage }}
      </div>
    </Transition>

    <div class="flex flex-1 overflow-hidden">
      <Sidebar :isOpen="isSidebarOpen" />

      <div class="flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out" :class="isSidebarOpen ? 'ml-60' : 'ml-0'">
        <header class="sticky top-0 z-30 bg-bg/95 backdrop-blur h-14 flex items-center px-4 border-b border-white/5 gap-4">
          <button @click="isSidebarOpen = !isSidebarOpen" class="text-muted hover:text-white p-2 transition-colors">
            <svg viewBox="0 0 24 24" class="w-6 h-6 fill-current"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>
          </button>

          <form @submit.prevent="doSearch" class="flex-1 max-w-2xl">
            <input
              v-model="q"
              type="search"
              placeholder="Search to download or watch a video..."
              class="w-full h-9 px-4 rounded-full bg-surface border border-white/10 focus:outline-none focus:border-white/30 text-sm transition-colors"
            />
          </form>
        </header>

        <main class="flex-1 overflow-y-auto" :class="route.name === 'playables' ? '' : 'p-6'">
          <RouterView v-slot="{ Component }">
            <Transition name="fade-slide" mode="out-in">
              <component :is="Component" />
            </Transition>
          </RouterView>
        </main>
      </div>
    </div>
    <DownloadToasts />
  </div>
</template>
