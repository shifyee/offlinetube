const CACHE_NAME = 'offlinetube-thumbnails-v3';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  const isThumbnail = 
    url.hostname.includes('ytimg.com') || 
    url.hostname.includes('img.youtube.com') ||
    url.hostname.includes('ggpht.com') ||
    url.hostname.includes('placehold.co') ||
    url.pathname.includes('/proxy/') ||
    url.pathname.includes('/thumbnails/');

  if (isThumbnail) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse; // Return instantly from cache
          }
          
          return fetch(event.request).then((networkResponse) => {
            if (networkResponse.ok) {
              cache.put(event.request, networkResponse.clone()); 
            }
            return networkResponse;
          }).catch(() => {
            // OFFLINE & NOT CACHED: Return a professional dark SVG placeholder
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9" style="background:#1a1a1a;width:100%;height:100%;display:block;">
              <rect width="16" height="9" fill="#1a1a1a"/>
              <circle cx="8" cy="4.5" r="1.5" fill="#2a2a2a"/>
              <path d="M7.5 3.5L9.5 4.5L7.5 5.5V3.5Z" fill="#666"/>
            </svg>`;
            return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml' } });
          });
        });
      })
    );
  }
});
