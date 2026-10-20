/**
 * @file imagePreloader.ts
 * @description Enterprise Image Asset Preloader & Hardware Decode Orchestrator.
 * Eliminates visual flash for critical hero background imagery during application initialization
 * by leveraging the native HTML Image constructor and the asynchronous decode() API.
 */

/**
 * Preloads and hardware-decodes a critical image asset off the main thread.
 *
 * This mechanism prevents the "hero background flash" by keeping the initial
 * loading screen visible until both enterprise state initialization and the critical
 * image bitmap download/rasterization have concluded.
 *
 * Features:
 * - Native HTML `new Image()` constructor.
 * - Hardware-accelerated `img.decode()` API off the main UI thread.
 * - Strict 2.5-second safety timeout so slow networks or 404s never block app initialization.
 * - Graceful fallback to `onload`/`onerror` if `decode()` is not supported or rejects.
 *
 * @param src - Relative or absolute URL of the image asset to preload.
 * @param timeoutMs - Maximum duration in milliseconds before forcing resolution (default: 2500ms).
 * @returns Promise that resolves when the image is decoded or safety timeout elapses.
 */
export function preloadCriticalImageAsset(
  src: string,
  timeoutMs = 2500
): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !src) {
      resolve();
      return;
    }

    let isSettled = false;
    const finalize = () => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timeoutId);
        resolve();
      }
    };

    // Strict 2.5-second safety timeout: guarantees app renders even on high-latency networks or failed fetches
    const timeoutId = setTimeout(() => {
      finalize();
    }, timeoutMs);

    try {
      const img = new Image();
      img.src = src;

      // Use native HTML Image decode API for asynchronous hardware-accelerated rasterization
      if ('decode' in img && typeof img.decode === 'function') {
        img
          .decode()
          .then(() => {
            finalize();
          })
          .catch(() => {
            // If decode rejects (e.g. format decode issue), fallback to load event or complete status
            if (img.complete) {
              finalize();
            } else {
              img.onload = finalize;
              img.onerror = finalize;
            }
          });
      } else {
        // Fallback for browsers without decode() support
        if (img.complete) {
          finalize();
        } else {
          img.onload = finalize;
          img.onerror = finalize;
        }
      }
    } catch {
      finalize();
    }
  });
}
