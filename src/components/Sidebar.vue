<script setup>
import { RouterLink } from 'vue-router'
import { useAuthStore } from '../stores/auth'

defineProps({ isOpen: { type: Boolean, required: true } })
const auth = useAuthStore()

const nav = [
  { to: '/downloader', label: 'Downloader', icon: 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z' }, // Added Downloader
  { to: '/', label: 'Home / Trending', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { to: '/subscriptions', label: 'Subscriptions', icon: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z' },
  { to: '/channels', label: 'Channels', icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z' },
  { to: '/playlists', label: 'Playlists', icon: 'M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z' },
  { to: '/history', label: 'History', icon: 'M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z' },
  { to: '/library', label: 'Library', icon: 'M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 5h-3v5.5c0 1.38-1.12 2.5-2.5 2.5S10 13.88 10 12.5s1.12-2.5 2.5-2.5c.57 0 1.08.19 1.5.51V5h4v2zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6z' }
]
const bottomNav = [
  { to: '/settings', label: 'Settings', icon: 'M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.06-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.06,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.49-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z' }
]
</script>

<template>
  <aside class="w-60 h-screen bg-sidebar flex flex-col fixed left-0 top-0 border-r border-white/5 z-40 transition-transform duration-300" :class="isOpen ? 'translate-x-0' : '-translate-x-full'">
    <RouterLink to="/" class="flex items-center gap-3 px-5 h-14 mb-2 shrink-0">
      <div class="w-8 h-8 rounded-md bg-accent flex items-center justify-center">
        <svg viewBox="0 0 24 24" class="w-5 h-5 text-white" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
      </div>
      <span class="text-lg font-bold tracking-wide">OfflineTube</span>
    </RouterLink>
    
    <nav class="flex-1 overflow-y-auto px-2 space-y-1">
      <RouterLink v-for="item in nav" :key="item.to" :to="item.to" class="flex items-center gap-4 px-3 py-2.5 rounded-md hover:bg-surface text-sm font-medium transition-colors" active-class="bg-surface text-accent">
        <svg viewBox="0 0 24 24" class="w-5 h-5 fill-current" v-html="`<path d='${item.icon}'/>`"></svg>
        {{ item.label }}
      </RouterLink>
    </nav>

    <div class="px-2 pb-4 space-y-1 border-t border-white/5 pt-2 shrink-0">
      <RouterLink v-for="item in bottomNav" :key="item.to" :to="item.to" class="flex items-center gap-4 px-3 py-2.5 rounded-md hover:bg-surface text-sm font-medium transition-colors" active-class="bg-surface text-accent">
        <svg viewBox="0 0 24 24" class="w-5 h-5 fill-current" v-html="`<path d='${item.icon}'/>`"></svg>
        {{ item.label }}
      </RouterLink>
      
      <button @click="auth.login()" class="w-full flex items-center gap-4 px-3 py-2.5 mt-2 rounded-md bg-surface hover:bg-surface-2 text-sm text-accent font-bold transition-colors">
        <svg viewBox="0 0 24 24" class="w-5 h-5 fill-current"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
        Log In to YouTube
      </button>
    </div>
  </aside>
</template>
