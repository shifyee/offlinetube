import Dexie from 'dexie'

// Kept the exact same database name so your old videos are preserved
export const db = new Dexie('offline-tube')

// Bumped to version 3 to add history and playlists
db.version(3).stores({
  videos: 'id, title, author, status, downloadedAt, addedAt',
  chunks: '++id, videoId, seq, [videoId+seq]',
  history: '++id, videoId, watchedAt', // NEW
  playlists: '++id, name, createdAt'    // NEW
})

export async function assembleBlob(videoId) {
  const chunks = await db.chunks.where('videoId').equals(videoId).toArray()
  chunks.sort((a, b) => a.seq - b.seq)
  return new Blob(chunks.map(c => c.blob), { type: 'video/mp4' })
}

export async function clearChunks(videoId) {
  await db.chunks.where('videoId').equals(videoId).delete()
}

export async function deleteVideo(id) {
  // Restored your transaction logic
  await db.transaction('rw', db.videos, db.chunks, async () => {
    await db.chunks.where('videoId').equals(id).delete()
    await db.videos.delete(id)
  })
}

// Restored the Service Worker registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      console.log('Thumbnail Cache ServiceWorker registered');
    }).catch((err) => {
      console.log('ServiceWorker registration failed: ', err);
    });
  });
}
