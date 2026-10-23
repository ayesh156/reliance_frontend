import React, { useState, useEffect, useRef, useCallback } from 'react';
import { WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';

export interface OfflineSentinelProps {
  /**
   * Optional props retained for API backwards compatibility.
   * Active polling and pinging have been removed to eliminate false-positives on high-latency 4G.
   */
  pingUrl?: string;
  onlineIntervalMs?: number;
  offlineIntervalMs?: number;
  timeoutMs?: number;
}

/**
 * Universal Hardware Offline Sentinel
 *
 * Strictly relies on native browser hardware connectivity events:
 * - window.addEventListener('offline')
 * - window.addEventListener('online')
 * - navigator.onLine === false
 *
 * Eliminates all active polling, HTTP pinging, and API-failure listeners that falsely
 * declared the application offline on high-latency 4G networks.
 * The modal ONLY appears when Wi-Fi / Mobile Data is genuinely disconnected, and
 * automatically dismisses the instant network connectivity is restored.
 */
export const OfflineSentinel: React.FC<OfflineSentinelProps> = () => {
  const [isOffline, setIsOffline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? !navigator.onLine : false;
  });
  const [showRestoredBanner, setShowRestoredBanner] = useState<boolean>(false);
  const wasOffline = useRef<boolean>(typeof navigator !== 'undefined' ? !navigator.onLine : false);

  useEffect(() => {
    const handleOnline = () => {
      // Hardware network restored
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        setIsOffline(false);
        if (wasOffline.current) {
          wasOffline.current = false;
          setShowRestoredBanner(true);
          const bannerTimer = setTimeout(() => {
            setShowRestoredBanner(false);
          }, 3500);
          return () => clearTimeout(bannerTimer);
        }
      }
    };

    const handleOffline = () => {
      // Hardware connection disconnected
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        wasOffline.current = true;
        setIsOffline(true);
        setShowRestoredBanner(false);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check strictly based on navigator.onLine
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      wasOffline.current = true;
      setIsOffline(true);
    } else {
      setIsOffline(false);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleManualCheck = useCallback(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      setIsOffline(false);
      wasOffline.current = false;
      setShowRestoredBanner(true);
      setTimeout(() => setShowRestoredBanner(false), 3500);
    }
  }, []);

  // Modal must ONLY show when navigator.onLine is genuinely false
  const genuinelyOffline = isOffline && typeof navigator !== 'undefined' && !navigator.onLine;

  return (
    <>
      {/* ── Auto-Recovery Emerald Banner ── */}
      {showRestoredBanner && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-5 left-1/2 -translate-x-1/2 z-[999999] flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-emerald-600 text-white font-semibold text-xs sm:text-sm shadow-2xl shadow-emerald-950/40 border border-emerald-400/40 animate-in slide-in-from-top-4 fade-in-0 duration-300 pointer-events-auto"
        >
          <div className="size-6 rounded-full bg-emerald-500/80 flex items-center justify-center shrink-0">
            <CheckCircle2 className="size-4 text-white" />
          </div>
          <span>Connection Restored. You are back online!</span>
        </div>
      )}

      {/* ── Strict Hardware Disconnection Offline Modal Overlay ── */}
      {genuinelyOffline && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="offline-title"
          aria-describedby="offline-desc"
          className="fixed inset-0 z-[999990] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in-0 duration-200 select-none"
        >
          <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 shadow-2xl p-6 sm:p-8 text-center flex flex-col items-center gap-4 animate-in zoom-in-95 duration-200">
            {/* Animated Disconnected Icon with Radar Ping Circles */}
            <div className="relative flex items-center justify-center size-20 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 my-1">
              <span className="absolute -inset-2 rounded-full border border-rose-500/30 dark:border-rose-400/20 animate-ping opacity-60" />
              <span className="absolute -inset-1 rounded-full border-2 border-rose-500/20 dark:border-rose-400/10 animate-pulse" />
              <WifiOff className="size-9 shrink-0 relative z-10" />
            </div>

            {/* Typography */}
            <div className="space-y-2">
              <h2
                id="offline-title"
                className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight"
              >
                No Internet Connection
              </h2>
              <p
                id="offline-desc"
                className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 leading-relaxed max-w-xs mx-auto"
              >
                Your device appears to be disconnected from Wi-Fi and Mobile Data. Please check your network connection.
              </p>
            </div>

            {/* Actions */}
            <div className="w-full space-y-3 pt-2">
              <button
                type="button"
                onClick={handleManualCheck}
                className="w-full py-3.5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-bold text-sm shadow-lg shadow-emerald-900/20 transition-all flex items-center justify-center gap-2 cursor-pointer select-none"
              >
                <RefreshCw className="size-4" />
                <span>Check Connection</span>
              </button>

              <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 dark:text-zinc-500">
                <span className="size-1.5 rounded-full bg-amber-500 animate-ping" />
                <span>Auto-reconnecting when Wi-Fi / Mobile Data returns...</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
