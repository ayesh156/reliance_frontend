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
 * Deferred Hard-Refresh on Natural User Reload
 * When a new build lands on the server, we never interrupt an active cashier/sales rep session.
 * Instead, the new worker is downloaded in the background and flagged in localStorage.
 * On the user's NEXT natural browser refresh (F5 / pull-to-refresh / app launch), we:
 * 1. Detect pending update or waiting worker.
 * 2. Purge all browser caches (caches.keys()).
 * 3. Instruct the waiting Service Worker to SKIP_WAITING.
 * 4. Perform a single clean hard reload so the newest assets mount with zero stale cache.
 */
const PENDING_UPDATE_KEY = 'reliance_pending_build_update';
const RELOAD_GUARD_KEY = 'reliance_deferred_reload_executed';

if (typeof window !== 'undefined' && import.meta.env.PROD) {
  const pendingUpdate = localStorage.getItem(PENDING_UPDATE_KEY);
  const alreadyReloaded = sessionStorage.getItem(RELOAD_GUARD_KEY);

  if (pendingUpdate && !alreadyReloaded) {
    sessionStorage.setItem(RELOAD_GUARD_KEY, 'true');
    localStorage.removeItem(PENDING_UPDATE_KEY);

    if ('caches' in window) {
      caches.keys().then((cacheNames) => {
        Promise.all(cacheNames.map((name) => caches.delete(name))).finally(() => {
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then((registrations) => {
              for (const reg of registrations) {
                if (reg.waiting) {
                  reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                }
              }
              window.location.reload();
            }).catch(() => {
              window.location.reload();
            });
          } else {
            window.location.reload();
          }
        });
      }).catch(() => {
        window.location.reload();
      });
    }
  } else if (alreadyReloaded) {
    sessionStorage.removeItem(RELOAD_GUARD_KEY);
  }
}

/**
 * Enterprise PWA Service Worker Background Update & App Shell Lifecycle
 * - Service Worker registration is strictly restricted to PRODUCTION environments.
 * - During active user sessions, updates are deferred to avoid discarding unsaved POS bills.
 * - New builds are activated seamlessly on the next natural user reload.
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((registration) => {
        console.log('[PWA] Service Worker registered with scope:', registration.scope);

        // If an updated worker is waiting in the background, mark pending update WITHOUT reloading
        if (registration.waiting) {
          localStorage.setItem(PENDING_UPDATE_KEY, String(Date.now()));
          console.log('[PWA] New build waiting in background. Update deferred until next reload.');
        }

        // Detect new versions downloaded in the background
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New build ready in background: flag for next reload without reloading now
                localStorage.setItem(PENDING_UPDATE_KEY, String(Date.now()));
                console.log('[PWA] New build downloaded in background. Update deferred until next natural reload.');
              }
            });
          }
        });

        // Background update checks on tab focus / document visibility
        const checkForUpdates = () => {
          registration.update().catch(() => {});
          fetch(`/version.json?_t=${Date.now()}`, { cache: 'no-store' })
            .then((r) => r.json())
            .then((data) => {
              const currentVersion = localStorage.getItem('reliance_app_version');
              if (currentVersion && data?.version && String(data.version) !== currentVersion) {
                localStorage.setItem(PENDING_UPDATE_KEY, String(data.version));
              } else if (data?.version) {
                localStorage.setItem('reliance_app_version', String(data.version));
              }
            })
            .catch(() => {});
        };

        window.addEventListener('focus', checkForUpdates);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            checkForUpdates();
          }
        });

        // Periodic background update check every 30 minutes
        setInterval(checkForUpdates, 30 * 60 * 1000);
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
      splash.classList.add('pointer-events-none');
      splash.style.transition = 'opacity 300ms cubic-bezier(0.4, 0, 0.2, 1)';
      splash.style.opacity = '0';
      splash.style.pointerEvents = 'none';
      setTimeout(() => splash.remove(), 350);
    }
  }, 1200);
}

const rootElement = document.getElementById('root');

if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}