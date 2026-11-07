// Reliance Storefront & ERP - Fallback Service Worker Lifecycle
// Listen for SKIP_WAITING to activate deferred new builds on natural user reloads
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('install', () => {
  // Defer takeover until explicit SKIP_WAITING on natural user reload
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

