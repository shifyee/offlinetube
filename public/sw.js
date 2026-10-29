const CACHE_NAME = 'offlinetube-thumbnails-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Intercept requests for YouTube thumbnails
  if (url.hostname.includes('ytimg.com') || url.hostname.includes('img.youtube.com')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          // If we have it in the cache, return it instantly (works offline!)
          if (cachedResponse) {
            return cachedResponse; 
          }
          
          // If not in cache, try to fetch it from the internet
          return fetch(event.request).then((networkResponse) => {
            if (networkResponse.ok) {
              // Save it to the cache for next time
              cache.put(event.request, networkResponse.clone()); 
            }
            return networkResponse;
          }).catch(() => {
            // IF OFFLINE AND NOT CACHED: Return a sleek SVG placeholder
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 16 9" style="background:#1a1a1a;display:flex;align-items:center;justify-content:center;"><rect width="16" height="9" fill="#1a1a1a"/><path d="M6 3l4 1.5-4 1.5V3z" fill="#555"/></svg>`;
            return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml' } });
          });
        });
      })
    );
  }
});
