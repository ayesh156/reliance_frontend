import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

/**
 * Global dynamic import & chunk preload failure interceptor:
 * Automatically triggers a clean page reload when Vite detects a missing or outdated
 * JS chunk (e.g. after a new build deployment or stale cache).
 */
window.addEventListener('vite:preloadError', (event) => {
  console.warn('[Vite] Chunk preload failure detected, refreshing page for latest assets...', event);
  const reloadKey = 'vite_preload_reload_ts';
  const lastReload = sessionStorage.getItem(reloadKey);
  const now = Date.now();
  // Prevent infinite refresh loop (minimum 10s cooldown)
  if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
    sessionStorage.setItem(reloadKey, String(now));
    window.location.reload();
  }
});

// Intercept unhandled module script MIME-type error on SPA navigations
window.addEventListener('error', (event) => {
  const msg = event?.message || '';
  if (
    msg.includes('Failed to load module script') ||
    msg.includes('Expected a JavaScript module script') ||
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Loading chunk')
  ) {
    console.warn('[App] Dynamic chunk MIME/loading error detected, reloading...', msg);
    const reloadKey = 'chunk_mime_reload_ts';
    const lastReload = sessionStorage.getItem(reloadKey);
    const now = Date.now();
    if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
      sessionStorage.setItem(reloadKey, String(now));
      window.location.reload();
    }
  }
});

/**
 * Enterprise PWA Service Worker Auto-Update & App Shell Lifecycle
 * - Service Worker registration is strictly restricted to PRODUCTION environments
 *   (import.meta.env.PROD && 'serviceWorker' in navigator).
 * - During local development (`npm run dev`), Service Worker registration is completely disabled
 *   to prevent `Failed to execute 'importScripts' on 'WorkerGlobalScope'` and dev-sw.js errors.
 * - In development mode, existing active workers are cleanly unregistered.
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  let isRefreshing = false;

  // Reload window once the active Service Worker controller changes to new deployment
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (isRefreshing) return;
    isRefreshing = true;
    console.log('[PWA] New version activated. Reloading application...');
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((registration) => {
        console.log('[PWA] Service Worker registered with scope:', registration.scope);

        // Check immediately if an updated worker is already waiting
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        // Detect new versions downloaded in the background
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[PWA] New update installed; activating immediately...');
                newWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          }
        });

        // Auto-check for updates on App Focus (tab switch / standalone app open)
        window.addEventListener('focus', () => {
          registration.update().catch(() => {});
        });

        // Auto-check for updates when document becomes visible
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            registration.update().catch(() => {});
          }
        });

        // Periodic background update check every 30 minutes
        setInterval(() => {
          registration.update().catch(() => {});
        }, 30 * 60 * 1000);
      })
      .catch((error) => {
        console.error('[PWA] Service Worker registration failed:', error);
      });
  });
}

// In local development, proactively unregister any previously registered service workers
if (!import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister().catch(() => {});
    }
  }).catch(() => {});
}

// Fallback safeguard to fade out startup splash screen if network/auth delays
if (typeof window !== 'undefined') {
  setTimeout(() => {
    const splash = document.getElementById('pwa-splash-screen');
    if (splash && !splash.classList.contains('pointer-events-none')) {
      splash.style.opacity = '0';
      splash.style.pointerEvents = 'none';
      setTimeout(() => splash.remove(), 550);
    }
  }, 3000);
}

const rootElement = document.getElementById('root');

if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}