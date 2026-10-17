const CACHE_NAME = 'reliance-pwa-v5';
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
            console.log('[SW] Purging outdated cache bucket:', key);
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
 * 
 * 1. Protocol Guard:
 *    Only intercepts standard HTTP/HTTPS GET requests. Dynamic mutations (POST, PUT, DELETE)
 *    are passed directly to the network.
 * 
 * 2. Same-Origin Filter (Cross-Origin Bypass):
 *    Strictly intercepts and handles same-origin requests (url.origin === self.location.origin).
 *    Completely bypasses and ignores all third-party external scripts and origins (such as
 *    Cloudflare Insights / static.cloudflareinsights.com, CDNs, fonts, or tracking scripts)
 *    by returning early without calling event.respondWith(). The browser handles third-party
 *    network requests natively, preventing FetchEvent network error rejections.
 * 
 * 3. Dynamic Backend API & WebSocket Denylist:
 *    Matches Workbox navigateFallbackDenylist. Dynamic backend APIs (/api/*) and realtime
 *    WebSockets (/socket.io/*) must never be intercepted or served cached app shells.
 * 
 * 4. SPA Navigation Fallback (Workbox navigateFallback pattern):
 *    For HTML document navigation requests (mode === 'navigate'), executes a Network-First strategy
 *    pointing to /index.html so that system deep-links (e.g., /system/products, /system/raw-material-shops)
 *    resolve cleanly without network errors, falling back to cached /index.html when offline.
 * 
 * 5. Graceful Error Handling & Fallback Responses:
 *    Ensures every intercepted request safely catches errors and returns a valid fallback Response
 *    object, preventing unhandled promise rejections that trigger 'Failed to convert value to Response'.
 */
self.addEventListener('fetch', (event) => {
  // ── Protocol & Method Guard ──────────────────────────────────────────
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Reject non-HTTP schemes (chrome-extension:, moz-extension:, data:, blob:, etc.)
  if (!url.protocol.startsWith('http')) return;

  // ── Same-Origin Filter ──────────────────────────────────────────────
  // Strictly handle same-origin requests. Completely bypass all third-party
  // external scripts and origins (e.g. static.cloudflareinsights.com).
  // Returning without calling event.respondWith() allows the browser to handle
  // the external request natively without throwing FetchEvent network errors.
  if (url.origin !== self.location.origin) {
    return;
  }

  // ── Dynamic Backend API & WebSocket Denylist ─────────────────────────
  // Denylist backend API endpoints and WebSocket handshakes from Service Worker interception.
  if (url.pathname.startsWith('/api') || url.pathname.includes('/socket.io/')) {
    return;
  }

  // ── SPA Navigation Fallback (Workbox navigateFallback) ───────────────
  // Resolves direct deep-links (e.g., /system/products, /system/raw-material-shops)
  // Network-First with fallback to precached /index.html app shell.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone).catch(() => {});
            }).catch(() => {});
            return networkResponse;
          }

          // If the server returns a 404 for a client-side deep-link route on a host without rewrites,
          // serve /index.html from cache so React Router can mount and resolve the route client-side.
          if (networkResponse && networkResponse.status === 404) {
            const cachedIndex = (await caches.match('/index.html')) || (await caches.match('/'));
            if (cachedIndex) return cachedIndex;
          }

          return networkResponse;
        } catch (networkError) {
          // Network failed (offline / network error) - fallback to cached SPA shell
          try {
            const cached = (await caches.match('/index.html')) || (await caches.match('/'));
            if (cached) return cached;
          } catch (_) {}

          // Graceful Error Handling: Always return a valid Response object to prevent
          // browser "Failed to convert value to Response" unhandled rejection errors.
          return new Response(
            '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Reliance POS - Offline</title></head><body><div id="root" style="font-family:sans-serif;padding:2rem;text-align:center;"><h2>Offline Mode</h2><p>Application shell is currently offline. Please reconnect to the network.</p></div></body></html>',
            {
              status: 200,
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            }
          );
        }
      })()
    );
    return;
  }

  // ── Static Assets & Scripts: Stale-While-Revalidate with Graceful Fallback ──
  event.respondWith(
    (async () => {
      let cachedResponse = null;
      try {
        cachedResponse = await caches.match(event.request);
      } catch (_) {}

      const networkFetch = fetch(event.request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            (networkResponse.type === 'basic' || networkResponse.type === 'default')
          ) {
            const contentType = networkResponse.headers.get('content-type') || '';
            const isScriptAsset = url.pathname.endsWith('.js') || url.pathname.includes('/assets/');

            // CRITICAL: Never cache text/html responses when a JavaScript/CSS chunk was requested.
            // This occurs when a server catch-all route returns index.html for purged/missing chunk hashes.
            if (isScriptAsset && contentType.includes('text/html')) {
              console.warn('[SW] Server returned text/html for script chunk; skipping cache to avoid MIME error:', url.pathname);
              return networkResponse;
            }

            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache).catch(() => {});
            }).catch(() => {});
          }
          return networkResponse;
        })
        .catch(() => {
          // If network fetch fails and we have a cached version, return cached version
          if (cachedResponse) return cachedResponse;

          // Graceful Error Handling: Return a valid fallback Response object
          // instead of undefined or unhandled rejections that trigger "Failed to convert value to Response"
          return new Response('', {
            status: 504,
            statusText: 'Gateway Timeout',
          });
        });

      // If cached response exists, return it immediately (Stale-While-Revalidate)
      // Otherwise wait for network fetch
      return cachedResponse || (await networkFetch);
    })().catch(async () => {
      // Ultimate defensive fallback: guarantee a valid Response instance is always returned
      const fallback = await caches.match(event.request).catch(() => null);
      if (fallback) return fallback;

      return new Response('', {
        status: 504,
        statusText: 'Gateway Timeout',
      });
    })
  );
});
