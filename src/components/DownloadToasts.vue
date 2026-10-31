<script setup>
import { useDownloadsStore } from '../stores/downloads'
const downloads = useDownloadsStore()

const statusColor = {
  downloading: 'text-accent',
  complete: 'text-green-400',
  cancelled: 'text-muted',
  error: 'text-red-400'
}
</script>

<template>
  <TransitionGroup 
    name="toast" 
    tag="div" 
    class="fixed bottom-4 right-4 space-y-2 w-80 max-w-[calc(100vw-2rem)] z-40"
  >
    <div
      v-for="d in downloads.activeList"
      :key="d.id"
      class="bg-surface border border-white/5 rounded-lg p-3 shadow-xl backdrop-blur-sm"
    >
      <div class="flex items-center gap-2">
        <img v-if="d.thumbnail" :src="d.thumbnail" class="w-14 h-9 rounded object-cover shrink-0" alt="" />
        <div class="flex-1 min-w-0">
          <div class="text-xs font-medium truncate">{{ d.title }}</div>
          
          <!-- Normal Download Status -->
          <div v-if="d.status !== 'prompt_delete'" class="text-[11px] mt-0.5 flex items-center gap-1">
            <span :class="statusColor[d.status] || 'text-muted'">{{ d.status }}</span>
            <span v-if="d.status === 'downloading'" class="text-muted">· {{ Math.round(d.progress * 100) }}%</span>
            <span v-if="d.error" class="text-red-400 truncate">· {{ d.error }}</span>
          </div>
          
          <!-- Delete Prompt Status -->
          <div v-else class="text-[11px] mt-0.5 text-white">Video finished! Delete it?</div>
        </div>
        
        <button
          v-if="d.status === 'downloading'"
          @click="downloads.cancel(d.id)"
          class="text-muted hover:text-white text-lg leading-none shrink-0 transition-colors"
          aria-label="Cancel"
        >×</button>
      </div>
      
      <!-- Progress Bar for Downloads -->
      <div v-if="d.status !== 'prompt_delete'" class="mt-2 h-1 bg-surface-3 rounded overflow-hidden">
        <div
          class="h-full bg-accent transition-all duration-200 ease-out"
          :style="{ width: `${Math.max(2, d.progress * 100)}%` }"
        ></div>
      </div>
      
      <!-- Action Buttons for Delete Prompt -->
      <div v-if="d.status === 'prompt_delete'" class="flex items-center justify-between mt-3">
        <button @click="downloads.dismissDelete(d.id)" class="text-muted hover:text-white text-xs transition-colors">Keep</button>
        <button @click="downloads.confirmDelete(d.id)" class="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1 rounded transition-colors">Delete</button>
      </div>
    </div>
  </TransitionGroup>
</template>
