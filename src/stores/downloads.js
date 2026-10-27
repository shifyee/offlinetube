import { defineStore } from 'pinia'
import { downloadVideo } from '../services/downloader'
import { useLibraryStore } from './library'
import { bestThumbnail } from '../api/piped-client'

export const useDownloadsStore = defineStore('downloads', {
  state: () => ({ active: {} }),
  getters: {
    activeList: (s) => Object.values(s.active),
    count:      (s) => Object.keys(s.active).length
  },
  actions: {
    isActive(id) {
      return !!this.active[id]
    },
    async start(video, streamUrl) {
      const id = video.videoId || video.id
      if (!id || this.active[id]) return
      const controller = new AbortController()
      
      // Find the size from the selected stream if available
      const expectedSize = video.formatStreams?.find(f => f.url === streamUrl)?.contentLength || 0

      this.active[id] = {
        id,
        title: video.title,
        thumbnail: bestThumbnail(video)?.url || video.thumbnail || null,
        progress: 0,
        status: 'downloading',
        controller
      }
      try {
        await downloadVideo(video, streamUrl, expectedSize, {
          signal: controller.signal,
          onProgress: ({ progress }) => {
            if (this.active[id]) this.active[id].progress = progress
          }
        })
        if (this.active[id]) this.active[id].status = 'complete'
      } catch (e) {
        if (this.active[id]) {
          this.active[id].status = e.name === 'AbortError' ? 'cancelled' : 'error'
          if (e.name !== 'AbortError') this.active[id].error = String(e.message || e)
        }
      } finally {
        useLibraryStore().refresh()
        setTimeout(() => { delete this.active[id] }, 3500)
      }
    },
    cancel(id) {
      this.active[id]?.controller?.abort()
    }
  }
})
