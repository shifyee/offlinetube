import { defineStore } from 'pinia'
import { db } from '../db'

export const useHistoryStore = defineStore('history', {
  state: () => ({ items: [], loading: false }),
  actions: {
    async refresh() {
      this.loading = true
      try {
        this.items = await db.history.orderBy('watchedAt').reverse().toArray()
      } finally {
        this.loading = false
      }
    },
    async add(video) {
      if (!video) return
      const id = video.videoId || video.id
      
      // Remove existing entry to push it to the top
      await db.history.where('videoId').equals(id).delete()
      
      await db.history.add({
        videoId: id,
        title: video.title,
        author: video.author,
        thumbnail: video.thumbnail || video.videoThumbnails?.[0]?.url || null,
        lengthSeconds: video.lengthSeconds || 0,
        watchedAt: Date.now()
      })
      this.refresh()
    },
    async remove(id) {
      await db.history.delete(id)
      this.refresh()
    },
    async clearAll() {
      await db.history.clear()
      this.refresh()
    }
  }
})
