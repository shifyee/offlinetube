import { db, clearChunks } from '../db'

const CHUNK_SIZE = 2 * 1024 * 1024

function aborted(signal) {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
}

// Helper function to fetch an image and convert it to a Base64 string
async function fetchThumbnailAsBase64(url) {
  if (!url) return null;
  try {
    // Added { mode: 'cors' } so the browser actually downloads the image data
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) throw new Error('Failed to fetch thumbnail');
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn('Could not cache thumbnail to Base64, falling back to URL:', err);
    return url; // Fallback to the URL if fetching fails
  }
}

export async function downloadVideo(video, streamUrl, expectedSize, { onProgress, signal } = {}) {
  const plainVideo = JSON.parse(JSON.stringify(video))
  const id = plainVideo.videoId || plainVideo.id
  
  await clearChunks(id)

  // 1. Fetch and cache the thumbnail as a Base64 string
  const rawThumbUrl = plainVideo.videoThumbnails?.[0]?.url || plainVideo.thumbnail;
  const cachedThumbnail = await fetchThumbnailAsBase64(rawThumbUrl);

  // 2. Save the video metadata, storing the Base64 image in the `thumbnail` field
  await db.videos.put({
    id, 
    title: plainVideo.title, 
    author: plainVideo.author, 
    authorId: plainVideo.authorId,
    lengthSeconds: plainVideo.lengthSeconds, 
    thumbnail: cachedThumbnail, // Base64 string or fallback URL
    description: plainVideo.description || '',
    comments: plainVideo.comments || [],
    status: 'downloading', 
    progress: 0, 
    size: 0, 
    addedAt: Date.now(), 
    downloadedAt: null
  })

  // 3. Download the video data (UNCHANGED)
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

  // 4. Save the video in chunks (UNCHANGED)
  const blob = new Blob(parts, { type: 'video/mp4' })
  let seq = 0
  for (let off = 0; off < blob.size; off += CHUNK_SIZE) {
    const slice = blob.slice(off, Math.min(off + CHUNK_SIZE, blob.size))
    await db.chunks.add({ videoId: id, seq: seq++, blob: slice })
  }

  // 5. Mark as complete (UNCHANGED)
  await db.videos.update(id, { 
    status: 'complete', 
    progress: 1, 
    size: blob.size, 
    downloadedAt: Date.now() 
  })
  
  return { success: true, size: blob.size }
}
