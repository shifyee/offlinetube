import Dexie from 'dexie'

export const db = new Dexie('offline-tube')

db.version(2).stores({
  videos: 'id, title, author, status, downloadedAt, addedAt',
  chunks: '++id, videoId, seq, [videoId+seq]'
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
  await db.transaction('rw', db.videos, db.chunks, async () => {
    await db.chunks.where('videoId').equals(id).delete()
    await db.videos.delete(id)
  })
}
