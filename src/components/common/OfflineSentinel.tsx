import React, { useState, useEffect, useCallback, useRef } from 'react';
import { WifiOff, RefreshCw, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

export interface OfflineSentinelProps {
  /**
   * Optional custom ping endpoint. Defaults to /api/health with fallback to /favicon.ico
   */
  pingUrl?: string;
  /**
   * Health check interval in ms when online (default: 30000ms / 30s)
   */
  onlineIntervalMs?: number;
  /**
   * Aggressive retry check interval in ms when offline (default: 6000ms / 6s)
   */
  offlineIntervalMs?: number;
  /**
   * Request timeout in ms for heartbeat checks (default: 4000ms)
   */
  timeoutMs?: number;
}

/**
 * Universal Offline Connection Sentinel (Poruwa.lk-Inspired Architecture)
 *
 * Provides non-destructive, zero-state-loss network monitoring across the application.
 * Listens to browser online/offline events and performs proactive lightweight heartbeat pings
 * against `/api/health` and static assets.
 *
 * When offline:
 * - Renders a high-contrast, modern blurred modal overlay with radar-pulsing disconnected icon.
 * - Leaves user form entries, active POS checkout carts, and URL history completely preserved.
 * - Provides a "Retry Connection" button with real-time feedback.
 *
 * When recovered:
 * - Displays a temporary emerald "Connection Restored" banner.
 * - Auto-dismisses seamlessly without requiring page reload.
 */
export const OfflineSentinel: React.FC<OfflineSentinelProps> = ({
  pingUrl,
  onlineIntervalMs = 30000,
  offlineIntervalMs = 6000,
  timeoutMs = 4000,
}) => {
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [showRestoredBanner, setShowRestoredBanner] = useState<boolean>(false);
  const [retryFeedback, setRetryFeedback] = useState<string | null>(null);

  const wasOffline = useRef<boolean>(!navigator.onLine);
  const isCheckingRef = useRef<boolean>(false);

  /**
   * Resolve target health check URL based on environment or default endpoints
   */
  const getHeartbeatUrl = useCallback((): string => {
    if (pingUrl) return pingUrl;
    const apiHost = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    return `${apiHost.replace(/\/+$/, '')}/health`;
  }, [pingUrl]);

  /**
   * Perform an isolated network heartbeat test with aggressive timeout and cache bypassing
   */
  const testConnectivity = useCallback(async (): Promise<boolean> => {
    if (!navigator.onLine) {
      return false;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const target = `${getHeartbeatUrl()}?_t=${Date.now()}`;
      const res = await fetch(target, {
        method: 'GET',
        cache: 'no-store',
        mode: 'cors',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      // Valid HTTP status from backend indicates server & network are active
      return res.status >= 200 && res.status < 500;
    } catch {
      clearTimeout(timeoutId);
      return false;
    }
  }, [getHeartbeatUrl, timeoutMs]);

  /**
   * Synchronize online status with state transition and recovery notifications
   */
  const updateStatus = useCallback((connected: boolean) => {
    if (connected) {
      if (wasOffline.current) {
        // State transition: Offline -> Online
        setIsOffline(false);
        wasOffline.current = false;
        setRetryFeedback(null);
        setShowRestoredBanner(true);

        const bannerTimer = setTimeout(() => {
          setShowRestoredBanner(false);
        }, 3500);

        return () => clearTimeout(bannerTimer);
      } else {
        setIsOffline(false);
      }
    } else {
      wasOffline.current = true;
      setIsOffline(true);
      setShowRestoredBanner(false);
    }
  }, []);

  /**
   * Core checker handler invoked on events, timers, or user retry clicks
   */
  const checkConnection = useCallback(
    async (isManualRetry = false) => {
      if (isCheckingRef.current) return;
      isCheckingRef.current = true;
      if (isManualRetry) {
        setIsChecking(true);
        setRetryFeedback(null);
      }

      try {
        const alive = await testConnectivity();
        updateStatus(alive);
        if (isManualRetry && !alive) {
          setRetryFeedback('Unable to reconnect to server. Please verify your network or ensure backend services are active.');
        }
      } finally {
        isCheckingRef.current = false;
        if (isManualRetry) {
          setIsChecking(false);
        }
      }
    },
    [testConnectivity, updateStatus]
  );

  /**
   * Event listeners for browser online / offline hardware triggers and API interceptor failures
   */
  useEffect(() => {
    const handleOnlineEvent = () => {
      // Re-verify with server ping before declaring fully restored
      checkConnection(false);
    };

    const handleOfflineEvent = () => {
      updateStatus(false);
    };

    const handleAppNetworkOfflineEvent = () => {
      // Immediate trigger from api.ts fetch failure (ERR_CONNECTION_REFUSED, failed to fetch)
      updateStatus(false);
    };

    window.addEventListener('online', handleOnlineEvent);
    window.addEventListener('offline', handleOfflineEvent);
    window.addEventListener('app:network-offline', handleAppNetworkOfflineEvent);

    // Initial check on mount
    checkConnection(false);

    return () => {
      window.removeEventListener('online', handleOnlineEvent);
      window.removeEventListener('offline', handleOfflineEvent);
      window.removeEventListener('app:network-offline', handleAppNetworkOfflineEvent);
    };
  }, [checkConnection, updateStatus]);

  /**
   * Recurring heartbeat timer:
   * Fast frequency when offline (auto-recovery), relaxed when healthy
   */
  useEffect(() => {
    const interval = isOffline ? offlineIntervalMs : onlineIntervalMs;
    const timer = setInterval(() => {
      checkConnection(false);
    }, interval);

    return () => clearInterval(timer);
  }, [isOffline, offlineIntervalMs, onlineIntervalMs, checkConnection]);

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

      {/* ── Poruwa.lk-Style High-Contrast Offline Modal Overlay ── */}
      {isOffline && (
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
                Unable to establish a connection with the server. Please verify your network connection and try again.
              </p>
            </div>

            {/* Error Feedback if user clicked retry while still disconnected */}
            {retryFeedback && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs text-left w-full">
                <AlertCircle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span className="leading-snug">{retryFeedback}</span>
              </div>
            )}

            {/* Actions */}
            <div className="w-full space-y-3 pt-2">
              <button
                type="button"
                disabled={isChecking}
                onClick={() => checkConnection(true)}
                className="w-full py-3.5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 disabled:opacity-60 text-white font-bold text-sm shadow-lg shadow-emerald-900/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed select-none"
              >
                {isChecking ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Verifying Network...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="size-4" />
                    <span>Retry Connection</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 dark:text-zinc-500">
                <span className="size-1.5 rounded-full bg-amber-500 animate-ping" />
                <span>Auto-reconnecting when network returns...</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
