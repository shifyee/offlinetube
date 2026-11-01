import { defineStore } from 'pinia'
import { db } from '../db'

export const usePlaylistStore = defineStore('playlists', {
  state: () => ({ lists: [], loading: false }),
  actions: {
    async refresh() {
      this.loading = true
      try {
        this.lists = await db.playlists.orderBy('createdAt').reverse().toArray()
      } finally {
        this.loading = false
      }
    },
    async create(name) {
      if (!name.trim()) return
      await db.playlists.add({ name: name.trim(), createdAt: Date.now(), videos: [] })
      await this.refresh()
    },
    async delete(id) {
      await db.playlists.delete(id)
      await this.refresh()
    },
    async addVideo(playlistId, video) {
      const playlist = await db.playlists.get(playlistId)
      if (!playlist) return
      
      const videoId = video.videoId || video.id
      if (!playlist.videos.find(v => v.videoId === videoId)) {
        playlist.videos.push({
          videoId,
          title: video.title,
          author: video.author,
          thumbnail: video.thumbnail || video.videoThumbnails?.[0]?.url || null,
          lengthSeconds: video.lengthSeconds || 0
        })
        await db.playlists.put(playlist)
        await this.refresh()
      }
    },
    async removeVideo(playlistId, videoId) {
      const playlist = await db.playlists.get(playlistId)
      if (!playlist) return
      playlist.videos = playlist.videos.filter(v => v.videoId !== videoId)
      await db.playlists.put(playlist)
      await this.refresh()
    }
  }
})
