const CACHE_NAME = 'reliance-pwa-v2';
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
 * Service Worker Message Event
 * Allows clients to prompt skip waiting on deployment of fresh assets
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/**
 * Service Worker Fetch Interceptor
 * - Guards against caching non-HTTP schemes (chrome-extension:, moz-extension:, etc.)
 * - Bypasses backend API & mutation requests
 * - Serves cached App Shell for offline navigation
 * - Implements Stale-While-Revalidate strategy for static resources
 */
self.addEventListener('fetch', (event) => {
  // ── Protocol Guard: Only cache standard HTTP/HTTPS GET requests ──
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Reject non-HTTP schemes (chrome-extension:, moz-extension:, data:, blob:, etc.)
  if (!url.protocol.startsWith('http')) return;

  // Strictly pass-through dynamic backend APIs and WebSocket connections
  if (url.pathname.startsWith('/api') || url.pathname.includes('/socket.io/')) {
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

  // Static Assets: Stale-While-Revalidate caching pattern with safe cache.put
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          // Wrap cache.put in try/catch to prevent unhandled rejection on unsupported schemes
          try {
            caches.open(CACHE_NAME).then((cache) => {
              try {
                cache.put(event.request, responseToCache);
              } catch (cacheErr) {
                // Silently handle cache put failures (e.g. opaque responses, scheme issues)
                console.debug('[SW] Cache put skipped:', cacheErr.message);
              }
            }).catch(() => {
              // Cache open failure — non-critical, skip silently
            });
          } catch (outerErr) {
            // Defensive fallthrough
          }
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
