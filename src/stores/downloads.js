import { defineStore } from 'pinia'
import { useLibraryStore } from './library'
import { db, clearChunks } from '../db'
import { bestThumbnail } from '../api/piped-client'

const BACKEND = 'https://offlinetube-production.up.railway.app';
const CHUNK_SIZE = 2 * 1024 * 1024;

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
      
      // Extract height from the URL (e.g. "height=1080" -> 1080)
      const match = streamUrl.match(/height=(\d+)/);
      const height = match ? parseInt(match[1], 10) : 1080;

      this.active[id] = {
        id,
        title: video.title,
        thumbnail: bestThumbnail(video)?.url || video.thumbnail || null,
        progress: 0,
        status: 'starting',
      }

      try {
        // 1. Tell backend to start downloading
        const res = await fetch(`${BACKEND}/api/download`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, height })
        });
        const { jobId } = await res.json();
        if (!jobId) throw new Error('No job ID returned');

        this.active[id].status = 'downloading';

        // 2. Poll for progress
        let isDone = false;
        while (!isDone) {
          await new Promise(r => setTimeout(r, 1500));
          const statusRes = await fetch(`${BACKEND}/api/status/${jobId}`);
          const statusData = await statusRes.json();
          
          this.active[id].progress = statusData.progress;

          if (statusData.status === 'done') {
            isDone = true;
          } else if (statusData.status === 'error') {
            throw new Error(statusData.error || 'Download failed');
          }
        }

        // 3. Save the file to IndexedDB
        this.active[id].status = 'saving';
        await clearChunks(id);
        await db.videos.put({
          id, title: video.title, author: video.author, authorId: video.authorId,
          lengthSeconds: video.lengthSeconds, thumbnail: this.active[id].thumbnail,
          description: video.description || '',
          comments: video.comments || [],
          status: 'complete', progress: 1, size: 0, addedAt: Date.now(), downloadedAt: Date.now()
        });

        const fileRes = await fetch(`${BACKEND}/api/file/${jobId}`);
        const reader = fileRes.body.getReader();
        const parts = [];
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          parts.push(value);
        }

        const blob = new Blob(parts, { type: 'video/mp4' });
        let seq = 0;
        for (let off = 0; off < blob.size; off += CHUNK_SIZE) {
          const slice = blob.slice(off, Math.min(off + CHUNK_SIZE, blob.size));
          await db.chunks.add({ videoId: id, seq: seq++, blob: slice });
        }
        
        await db.videos.update(id, { size: blob.size });
        this.active[id].status = 'complete';

      } catch (e) {
        if (this.active[id]) {
          this.active[id].status = 'error';
          this.active[id].error = String(e.message || e);
        }
      } finally {
        useLibraryStore().refresh()
        setTimeout(() => { delete this.active[id] }, 3500)
      }
    },
    cancel(id) {
      // Not fully implemented for job queue, but prevents crashes
      if (this.active[id]) delete this.active[id];
    }
  }
})
