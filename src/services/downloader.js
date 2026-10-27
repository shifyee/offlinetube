import { db, clearChunks } from '../db'

const CHUNK_SIZE = 2 * 1024 * 1024

function aborted(signal) {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
}

export async function downloadVideo(video, streamUrl, { onProgress, signal } = {}) {
  // THE FIX: Strip Vue's reactivity (Proxy) by cloning to a plain object
  const plainVideo = JSON.parse(JSON.stringify(video))
  const id = plainVideo.videoId || plainVideo.id
  
  await clearChunks(id)
  await db.videos.put({
    id, 
    title: plainVideo.title, 
    author: plainVideo.author, 
    authorId: plainVideo.authorId,
    lengthSeconds: plainVideo.lengthSeconds, 
    thumbnail: plainVideo.videoThumbnails?.[0]?.url || null,
    description: plainVideo.description || '',
    comments: plainVideo.comments || [],
    status: 'downloading', 
    progress: 0, 
    size: 0, 
    addedAt: Date.now(), 
    downloadedAt: null
  })

  let supportsRange = false
  let total = 0

  try {
    const probe = await fetch(streamUrl, { method: 'GET', headers: { Range: 'bytes=0-0' }, signal })
    if (probe.status === 206) {
      const cr = probe.headers.get('content-range') || ''
      const m = cr.match(/\/(\d+)/)
      if (m) total = parseInt(m[1], 10)
      supportsRange = total > 0
    } else if (probe.status === 200) {
      total = parseInt(probe.headers.get('content-length') || '0', 10)
    }
    probe.body?.cancel?.().catch(() => {})
  } catch (e) { if (e.name === 'AbortError') throw e }

  if (supportsRange && total > 0) {
    try {
      const numChunks = Math.ceil(total / CHUNK_SIZE)
      let downloaded = 0
      for (let seq = 0; seq < numChunks; seq++) {
        aborted(signal)
        const start = seq * CHUNK_SIZE
        const end = Math.min(start + CHUNK_SIZE - 1, total - 1)
        
        const res = await fetch(streamUrl, { headers: { Range: `bytes=${start}-${end}` }, signal })
        if (!res.ok) throw new Error(`Chunk failed: ${res.status}`)
        
        const blob = await res.blob()
        await db.chunks.add({ videoId: id, seq, blob })
        downloaded += blob.size
        onProgress?.({ progress: downloaded / total, downloaded, total })
      }
      await db.videos.update(id, { status: 'complete', progress: 1, size: total, downloadedAt: Date.now() })
      return { success: true, size: total }
    } catch (e) {
      if (e.name === 'AbortError') { await db.videos.update(id, { status: 'cancelled' }); throw e }
      await clearChunks(id)
    }
  }

  const res = await fetch(streamUrl, { signal })
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
  const contentLength = parseInt(res.headers.get('content-length') || '0', 10)
  const reader = res.body.getReader()
  const parts = []
  let loaded = 0
  while (true) {
    aborted(signal)
    const { done, value } = await reader.read()
    if (done) break
    parts.push(value)
    loaded += value.byteLength
    if (contentLength) onProgress?.({ progress: loaded / contentLength, downloaded: loaded, total: contentLength })
  }

  const blob = new Blob(parts, { type: 'video/mp4' })
  let seq = 0
  for (let off = 0; off < blob.size; off += CHUNK_SIZE) {
    const slice = blob.slice(off, Math.min(off + CHUNK_SIZE, blob.size))
    await db.chunks.add({ videoId: id, seq: seq++, blob: slice })
  }

  await db.videos.update(id, { status: 'complete', progress: 1, size: blob.size, downloadedAt: Date.now() })
  return { success: true, size: blob.size }
}
