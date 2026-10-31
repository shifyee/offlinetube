import { db, clearChunks } from '../db'

const CHUNK_SIZE = 2 * 1024 * 1024

function aborted(signal) {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
}

// Helper to convert any image URL to Base64
async function fetchImageAsBase64(url) {
  if (!url) return null;
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) throw new Error('Failed to fetch image');
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn('Could not cache image to Base64, falling back to URL:', err);
    return url; 
  }
}

export async function downloadVideo(video, streamUrl, expectedSize, { onProgress, signal } = {}) {
  const plainVideo = JSON.parse(JSON.stringify(video))
  const id = plainVideo.videoId || plainVideo.id
  
  await clearChunks(id)

  // 1. Cache BOTH Thumbnail and Avatar as Base64
  const rawThumbUrl = plainVideo.videoThumbnails?.[0]?.url || plainVideo.thumbnail;
  const rawAvatarUrl = plainVideo.authorAvatar; // <-- Get the PFP
  
  const cachedThumbnail = await fetchImageAsBase64(rawThumbUrl);
  const cachedAvatar = await fetchImageAsBase64(rawAvatarUrl); // <-- Convert PFP

  // 2. Save the video metadata
  await db.videos.put({
    id, 
    title: plainVideo.title, 
    author: plainVideo.author, 
    authorId: plainVideo.authorId,
    lengthSeconds: plainVideo.lengthSeconds, 
    thumbnail: cachedThumbnail, 
    authorAvatar: cachedAvatar, // <-- Save the Base64 PFP
    description: plainVideo.description || '',
    comments: plainVideo.comments || [],
    status: 'downloading', 
    progress: 0, 
    size: 0, 
    addedAt: Date.now(), 
    downloadedAt: null,
    watchProgress: 0 
  })

  // 3. Download video data
  const res = await fetch(streamUrl, { signal })
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
  
  const contentLength = parseInt(res.headers.get('content-length') || '0', 10) || expectedSize
  const reader = res.body.getReader()
  const parts = []
  let loaded = 0
  
  while (true) {
    aborted(signal)
    const { done, value } = await reader.read()
    if (done) break
    parts.push(value)
    loaded += value.byteLength
    
    if (contentLength) {
      onProgress?.({ progress: Math.min(loaded / contentLength, 1), downloaded: loaded, total: contentLength })
    }
  }

  // 4. Save video chunks
  const blob = new Blob(parts, { type: 'video/mp4' })
  let seq = 0
  for (let off = 0; off < blob.size; off += CHUNK_SIZE) {
    const slice = blob.slice(off, Math.min(off + CHUNK_SIZE, blob.size))
    await db.chunks.add({ videoId: id, seq: seq++, blob: slice })
  }

  // 5. Mark complete
  await db.videos.update(id, { 
    status: 'complete', 
    progress: 1, 
    size: blob.size, 
    downloadedAt: Date.now() 
  })
  
  return { success: true, size: blob.size }
}
