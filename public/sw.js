const CACHE_NAME = 'reliance-pwa-v1';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/images/favicon.ico',
  '/images/logo.jpg'
];

/**
 * Service Worker Install Lifecycle Event
 * Pre-caches essential App Shell assets for offline resilience and PWA installability
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

/**
 * Service Worker Activate Lifecycle Event
 * Purges legacy caches and immediately claims control of clients
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

/**
 * Service Worker Fetch Interceptor
 * - Bypasses backend API & mutation requests
 * - Serves cached App Shell for offline navigation
 * - Implements Stale-While-Revalidate strategy for static resources
 */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Strictly pass-through non-GET requests and dynamic backend APIs
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api') || url.pathname.includes('/socket.io/')) {
    return;
  }

  // SPA Navigation handling: serve cached index.html when offline
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cached = await caches.match('/index.html');
        return cached || caches.match('/');
      })
    );
    return;
  }

  // Static Assets: Stale-While-Revalidate caching pattern
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
