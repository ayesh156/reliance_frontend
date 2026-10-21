import { useEffect, useRef } from 'react';

const VERSION_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const STORAGE_KEY = 'app_version';

/**
 * Enterprise Cache-Busting & Background Version Checker Hook
 * 
 * Periodically and on window focus checks `/version.json?t=${Date.now()}`.
 * If the fetched version differs from `localStorage.getItem('app_version')`:
 * 1. Unregisters all Service Workers
 * 2. Clears CacheStorage
 * 3. Updates localStorage with the new version
 * 4. Forces a hard reload to ensure clients receive fresh deployment assets
 */
export function useVersionCheck() {
  const isUpdatingRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const performVersionCheck = async () => {
      // Prevent overlapping updates / reload races
      if (isUpdatingRef.current) return;

      try {
        const response = await fetch(`/version.json?t=${Date.now()}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
          },
        });

        if (!response.ok) return;

        const data = await response.json();
        const serverVersion = data?.version ? String(data.version) : null;
        if (!serverVersion || !isMounted) return;

        const currentVersion = localStorage.getItem(STORAGE_KEY);

        // If the server version differs from stored local app_version
        if (currentVersion !== serverVersion) {
          isUpdatingRef.current = true;
          console.log(
            `[VersionCheck] Stale build detected. Server: ${serverVersion}, Local: ${currentVersion}. Purging caches & reloading...`
          );

          // 1. Unregister all Service Workers
          if ('serviceWorker' in navigator) {
            try {
              const registrations = await navigator.serviceWorker.getRegistrations();
              await Promise.all(registrations.map((reg) => reg.unregister().catch(() => {})));
            } catch (swErr) {
              console.warn('[VersionCheck] Failed to unregister service workers:', swErr);
            }
          }

          // 2. Clear the CacheStorage
          if ('caches' in window) {
            try {
              const cacheKeys = await caches.keys();
              await Promise.all(cacheKeys.map((key) => caches.delete(key).catch(() => {})));
            } catch (cacheErr) {
              console.warn('[VersionCheck] Failed to clear CacheStorage:', cacheErr);
            }
          }

          // 3. Update localStorage
          try {
            localStorage.setItem(STORAGE_KEY, serverVersion);
          } catch (storageErr) {
            console.warn('[VersionCheck] Failed to update localStorage:', storageErr);
          }

          // 4. Force a hard reload
          try {
            (window.location as unknown as { reload: (force?: boolean) => void }).reload(true);
          } catch {
            window.location.href = window.location.href;
          }
        }
      } catch (err) {
        console.warn('[VersionCheck] Error checking app version:', err);
      }
    };

    // Check on window focus (user switches to/from tablet or tab)
    const handleFocus = () => {
      performVersionCheck();
    };

    // Check on visibility change (when tab becomes active)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        performVersionCheck();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Periodic check every 5 minutes
    const intervalId = setInterval(performVersionCheck, VERSION_CHECK_INTERVAL_MS);

    // Initial check on mount
    performVersionCheck();

    return () => {
      isMounted = false;
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(intervalId);
    };
  }, []);
}

export default useVersionCheck;
