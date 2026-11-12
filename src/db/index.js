import Dexie from 'dexie'

export const db = new Dexie('offline-tube')

db.version(4).stores({
  videos: 'id, title, author, status, downloadedAt, addedAt',
  chunks: '++id, videoId, seq, [videoId+seq]',
  history: '++id, videoId, watchedAt',
  playlists: '++id, name, createdAt',
  thumbnails: 'url' 
})

export async function assembleBlob(videoId, mimeType = 'video/mp4') {
  const chunks = await db.chunks.where('videoId').equals(videoId).toArray()
  chunks.sort((a, b) => a.seq - b.seq)
  return new Blob(chunks.map(c => c.blob), { type: mimeType || 'video/mp4' })
}

export async function clearChunks(videoId) {
  await db.chunks.where('videoId').equals(videoId).delete()
}

export async function deleteVideo(id) {
  await db.transaction('rw', db.videos, db.chunks, db.playlists, db.history, async () => {
    // 1. Delete video and chunks
    await db.chunks.where('videoId').equals(id).delete()
    await db.videos.delete(id)
    
    // 2. Remove from all playlists
    const allPlaylists = await db.playlists.toArray()
    for (const p of allPlaylists) {
      if (p.videos.some(v => v.videoId === id)) {
        p.videos = p.videos.filter(v => v.videoId !== id)
        await db.playlists.put(p)
      }
    }

    // 3. Mark history entries as deleted
    await db.history.where('videoId').equals(id).modify({ isDeleted: true })
  })
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      console.log('Thumbnail Cache ServiceWorker registered');
    }).catch((err) => {
      console.log('ServiceWorker registration failed: ', err);
    });
  });
}
