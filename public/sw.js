const CACHE_NAME = 'offlinetube-thumbnails-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Catch YouTube, Google User Content (avatars), and Piped proxies
  const isThumbnail = 
    url.hostname.includes('ytimg.com') || 
    url.hostname.includes('img.youtube.com') ||
    url.hostname.includes('ggpht.com') ||
    url.pathname.includes('/proxy/') ||
    url.pathname.includes('/thumbnails/');

  if (isThumbnail) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse; // Return instantly offline
          }
          
          return fetch(event.request).then((networkResponse) => {
            if (networkResponse.ok) {
              cache.put(event.request, networkResponse.clone()); 
            }
            return networkResponse;
          }).catch(() => {
            // If offline and not cached, return a transparent 1x1 pixel 
            // (The Vue @error handler will immediately replace it with the sleek SVG)
            const transparentPixel = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
            return new Response(transparentPixel, { headers: { 'Content-Type': 'image/gif' } });
          });
        });
      })
    );
  }
});
