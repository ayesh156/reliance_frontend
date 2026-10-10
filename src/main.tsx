import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

/**
 * Enterprise PWA Service Worker Auto-Update & App Shell Lifecycle
 * - Automatically registers and polls for new version deployments on app focus and visibility changes
 * - Takes immediate controller takeover via skipWaiting() + clients.claim()
 * - Performs seamless client auto-reload without requiring manual PWA re-installation
 */
if ('serviceWorker' in navigator) {
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
      .register('/sw.js')
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