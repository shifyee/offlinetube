import { db } from '../db'

export async function getCachedThumbnail(url) {
  if (!url) return null;
  
  // If it's already a Base64 string (like from the downloader), just return it
  if (url.startsWith('data:image')) return url;

  // 1. Check if we already have it in IndexedDB
  const cached = await db.thumbnails.get(url);
  if (cached) return cached.base64;

  // 2. If not, fetch it and save it
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error('Failed');
    const blob = await res.blob();
    
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    
    // Save to DB for next time
    await db.thumbnails.put({ url, base64 });
    return base64;
  } catch (e) {
    // If fetch fails (e.g., completely offline and not cached), return the URL as a last resort
    return url; 
  }
}
