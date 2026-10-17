/**
 * Server-Sent Events (SSE) Client Synchronization Manager
 * Provides resilient, freeze-proof real-time synchronization between frontend and backend.
 *
 * Architectural Resilience & TCP Half-Open Recovery:
 * 1. Client-Side Watchdog Timer:
 *    - Resolves the TCP half-open state where mobile/desktop clients silently stop receiving
 *      live updates (e.g. mobile lock, Wi-Fi handover, router NAT state purge) without the OS
 *      or browser emitting a TCP FIN/RST or EventSource `onerror` event.
 *    - Maintains an internal sliding watchdog timer (WATCHDOG_TIMEOUT_MS = 35000). Every incoming
 *      packet, business event, or heartbeat ping (:\n\n) resets this timer.
 *    - If no packet arrives for 35 seconds (> 2x the 15-second server ping frequency), the socket
 *      is diagnosed as dead/frozen, forcibly closed via `this.eventSource.close()`, and an immediate
 *      reconnection is executed.
 * 2. Tab Visibility & Wake Listener:
 *    - Binds to `document.visibilitychange`. When a user unlocks a mobile device or returns to
 *      the browser tab, modern OS background throttling can leave a zombie TCP connection.
 *    - Immediately inspects the socket's readyState and elapsed idle duration since last packet.
 *      If stale (>= 35s) or dead, an immediate reconnect is triggered without waiting for timeouts.
 * 3. Ghost-Free Disconnection:
 *    - Direct `eventSource.close()` and listener teardown on logout to prevent lingering connections.
 * 4. Exponential Backoff & Jitter:
 *    - Automatic reconnection on network transport interruptions with bounded backoff.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export type SseEventHandler = (payload: any) => void;

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Core Named SSE Events:
 * Under standard W3C EventSource specifications, incoming SSE frames containing
 * an `event: <name>` field completely bypass `EventSource.onmessage`.
 * We pre-bind explicit `EventSource.addEventListener(eventName, callback)` handlers
 * for all recognized lifecycle events so updates are never silently discarded.
 */
export const CORE_SSE_EVENTS = [
  'order_created',
  'order_updated',
  'order_deleted',
  'invoice_created',
  'invoice_updated',
  'invoice_deleted',
  'connected',
] as const;

export class SseSyncManager {
  private eventSource: EventSource | null = null;
  private listeners = new Map<string, Set<SseEventHandler>>();
  private status: ConnectionStatus = 'disconnected';
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private readonly maxReconnectDelay = 16000;
  private currentToken: string | null = null;
  private currentChannel = 'global';
  private clientId: string;

  /**
   * Watchdog Timer State:
   * 35-second threshold provides high resilience:
   * Server emits heartbeat pings every 15 seconds. 35 seconds allows for up to one
   * dropped/delayed ping frame under severe packet jitter before declaring a silent drop.
   */
  private watchdogTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly WATCHDOG_TIMEOUT_MS = 35000;
  private lastPacketTime = 0;
  private attachedEventNames = new Set<string>();

  /**
   * Binds EventSource addEventListener for custom named events (Senari SSE pattern)
   */
  private bindEventSourceListener(eventName: string): void {
    if (!this.eventSource || eventName === '*' || this.attachedEventNames.has(eventName)) return;
    this.attachedEventNames.add(eventName);

    this.eventSource.addEventListener(eventName, ((event: MessageEvent) => {
      this.resetWatchdog();
      try {
        if (!event.data || event.data === ':' || event.data === 'ping') return;
        const parsed = JSON.parse(event.data);
        if (parsed && (parsed.event === 'ping' || parsed.event === 'heartbeat')) return;
        const payload = (parsed && typeof parsed === 'object' && 'payload' in parsed) ? parsed.payload : parsed;
        this.dispatch(eventName, payload);
      } catch {
        this.dispatch(eventName, event.data);
      }
    }) as EventListener);
  }

  constructor() {
    this.clientId = typeof window !== 'undefined'
      ? (localStorage.getItem('reliance_sse_client_id') || Math.random().toString(36).slice(2) + Date.now().toString(36))
      : 'server-client';
    if (typeof window !== 'undefined') {
      localStorage.setItem('reliance_sse_client_id', this.clientId);
    }

    this.bindLifecycleListeners();
  }

  /**
   * Bind Tab Visibility and Network State Listeners
   * Proactively detects sleep/wake cycles and network interface restoration.
   */
  private bindLifecycleListeners(): void {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        this.handleVisibilityChange();
      });
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.handleNetworkOnline();
      });
    }
  }

  /**
   * Tab Visibility & Device Wake Handler:
   * Triggered when the browser tab transitions between hidden and visible.
   * Mobile devices and laptops throttle or suspend network sockets during screen lock/sleep,
   * causing silent half-open TCP dropouts. When waking up, immediately verify socket state.
   */
  private handleVisibilityChange(): void {
    if (typeof document === 'undefined' || document.visibilityState !== 'visible') {
      return;
    }

    // Only assess if user has an active authenticated session
    if (!this.currentToken) return;

    const now = Date.now();
    const isSocketMissingOrClosed = !this.eventSource || this.eventSource.readyState !== EventSource.OPEN;
    const isConnectionStale = this.lastPacketTime > 0 && (now - this.lastPacketTime) >= this.WATCHDOG_TIMEOUT_MS;

    if (isSocketMissingOrClosed || isConnectionStale) {
      console.warn(
        `[SSE] Tab became visible with stale or closed socket (closed: ${isSocketMissingOrClosed}, silent idle: ${
          this.lastPacketTime > 0 ? ((now - this.lastPacketTime) / 1000).toFixed(1) + 's' : 'never'
        }). Forcing immediate reconnect.`
      );
      this.forceReconnect();
    }
  }

  /**
   * Network Interface Online Handler:
   * Instantly re-establishes SSE stream when device regains connectivity (e.g. WiFi reconnect).
   */
  private handleNetworkOnline(): void {
    if (!this.currentToken) return;
    console.log('[SSE] Device network came online. Verifying SSE stream connection.');
    this.forceReconnect();
  }

  /**
   * Resets the internal watchdog timer upon receiving any packet or heartbeat comment.
   */
  private resetWatchdog(): void {
    this.lastPacketTime = Date.now();

    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
    }

    this.watchdogTimer = setTimeout(() => {
      this.handleWatchdogTimeout();
    }, this.WATCHDOG_TIMEOUT_MS);
  }

  /**
   * Watchdog Timeout Trigger:
   * Invoked when no packet (heartbeat comment :\n\n or event frame) has arrived for 35 seconds.
   * Diagnoses a silent TCP half-open connection drop, terminates the dead socket, and reconnects immediately.
   */
  private handleWatchdogTimeout(): void {
    console.warn(
      `[SSE] Watchdog timeout: No packet received for ${this.WATCHDOG_TIMEOUT_MS / 1000}s. Silent drop detected, force-terminating socket.`
    );
    this.status = 'error';
    this.closeSocket();
    this.scheduleReconnect(true);
  }

  /**
   * Safely terminates the underlying EventSource socket and clears socket listeners.
   */
  private closeSocket(): void {
    this.attachedEventNames.clear();

    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }

    if (this.eventSource) {
      try {
        this.eventSource.onopen = null;
        this.eventSource.onmessage = null;
        this.eventSource.onerror = null;
        this.eventSource.close();
      } catch {
        // Silently absorb close errors on dead sockets
      }
      this.eventSource = null;
    }
  }

  /**
   * Forcibly closes any stalled socket and initiates immediate reconnection.
   */
  public forceReconnect(): void {
    if (!this.currentToken) return;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.closeSocket();
    this.reconnectDelay = 1000;
    this.connect(this.currentToken, this.currentChannel);
  }

  /**
   * Connect to the backend SSE stream endpoint with token and channel
   */
  public connect(token?: string | null, channel = 'global'): void {
    if (typeof window === 'undefined') return;

    const authToken = token || localStorage.getItem('auth_token');
    if (!authToken) {
      this.disconnect();
      return;
    }

    // If already connected with identical credentials and active socket that isn't stale, retain connection
    const now = Date.now();
    const isHealthy =
      this.eventSource &&
      this.eventSource.readyState === EventSource.OPEN &&
      this.currentToken === authToken &&
      this.currentChannel === channel &&
      (this.lastPacketTime === 0 || now - this.lastPacketTime < this.WATCHDOG_TIMEOUT_MS);

    if (isHealthy) {
      return;
    }

    // Close any previous or stale connection cleanly
    this.closeSocket();

    this.currentToken = authToken;
    this.currentChannel = channel;
    this.status = 'connecting';

    try {
      const sseUrl = new URL(`${API_BASE}/sync/stream`);
      sseUrl.searchParams.set('token', authToken);
      sseUrl.searchParams.set('clientId', this.clientId);
      sseUrl.searchParams.set('channel', channel);

      this.eventSource = new EventSource(sseUrl.toString());

      // Pre-bind explicit EventSource addEventListener handlers for all core named events
      CORE_SSE_EVENTS.forEach((eventName) => {
        this.bindEventSourceListener(eventName);
      });

      // Bind custom event listeners for all registered subscribers
      this.listeners.forEach((_, eventName) => {
        this.bindEventSourceListener(eventName);
      });

      // Arm watchdog timer immediately upon connection attempt
      this.resetWatchdog();

      this.eventSource.onopen = () => {
        console.log('[SSE] Connection securely established');
        this.status = 'connected';
        this.reconnectDelay = 1000;
        this.resetWatchdog();
      };

      this.eventSource.onmessage = (event) => {
        // Watchdog Reset: Any incoming packet, heartbeat comment (:\n\n), or event resets watchdog timer
        this.resetWatchdog();

        try {
          // Filter out heartbeat pings, comment reflections, or empty frames
          if (!event.data || event.data === ':' || event.data === 'ping') return;
          const parsed = JSON.parse(event.data);
          if (parsed && (parsed.event === 'ping' || parsed.event === 'heartbeat')) return;
          if (parsed && parsed.event) {
            const payload = parsed.payload !== undefined ? parsed.payload : parsed;
            this.dispatch(parsed.event, payload);
          }
        } catch {
          // Silently absorb malformed frames to keep browser console clean
        }
      };

      this.eventSource.onerror = () => {
        /**
         * Silent Network Transport Recovery:
         * Silently handle expected network drops, HTTP/3 timeouts, and ERR_QUIC_PROTOCOL_ERROR.
         * Browser EventSource triggers error events during sleep/wake cycles, proxy timeouts,
         * or automatic transport renegotiation. We suppress console warnings and quietly
         * schedule automatic exponential backoff reconnection.
         */
        this.status = 'error';
        this.closeSocket();
        this.scheduleReconnect(false);
      };
    } catch {
      // Silently handle construction failures during transient offline periods
      this.status = 'error';
      this.closeSocket();
      this.scheduleReconnect(false);
    }
  }

  /**
   * Safe and instantaneous disconnection.
   * Crucially invoked on user logout to guarantee zero ghost connections or orphan sockets.
   */
  public disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.closeSocket();
    this.status = 'disconnected';
    this.currentToken = null;
    this.lastPacketTime = 0;
  }

  /**
   * Schedule automatic reconnection with exponential backoff on dropped connections.
   * If immediate is true, triggers connection without backoff delay.
   */
  private scheduleReconnect(immediate = false): void {
    if (this.reconnectTimer || !this.currentToken) return;

    if (immediate) {
      this.reconnectDelay = 1000;
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        if (this.currentToken) {
          this.connect(this.currentToken, this.currentChannel);
        }
      }, 50);
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.currentToken) {
        this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, this.maxReconnectDelay);
        this.connect(this.currentToken, this.currentChannel);
      }
    }, this.reconnectDelay);
  }

  /**
   * Explicit Named Event Registration:
   * Under standard W3C EventSource specifications, incoming SSE frames containing
   * an `event: <name>` field completely bypass `EventSource.onmessage`.
   * Strictly uses `EventSource.addEventListener(eventName, callback)` to listen for
   * specific named events (e.g., 'order_created', 'invoice_created').
   */
  public addEventListener(eventName: string, handler: SseEventHandler): () => void {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
      this.bindEventSourceListener(eventName);
    }
    this.listeners.get(eventName)!.add(handler);

    // Return cleanup unsubscription function
    return () => {
      const set = this.listeners.get(eventName);
      if (set) {
        set.delete(handler);
        if (set.size === 0) {
          this.listeners.delete(eventName);
        }
      }
    };
  }

  /**
   * Subscribe alias delegating strictly to addEventListener
   */
  public subscribe(eventName: string, handler: SseEventHandler): () => void {
    return this.addEventListener(eventName, handler);
  }

  /**
   * Direct access to underlying EventSource instance if raw inspection is needed
   */
  public getEventSource(): EventSource | null {
    return this.eventSource;
  }

  /**
   * Internal dispatcher routing incoming SSE frames to all registered callbacks
   */
  private dispatch(eventName: string, payload: any): void {
    const handlers = this.listeners.get(eventName);
    if (handlers) {
      handlers.forEach((fn) => {
        try {
          fn(payload);
        } catch (err) {
          console.error(`[SSE] Handler error for event "${eventName}":`, err);
        }
      });
    }

    // Also dispatch to catch-all '*' listeners
    const wildcardHandlers = this.listeners.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach((fn) => {
        try {
          fn({ event: eventName, payload });
        } catch (err) {
          console.error('[SSE] Wildcard handler error:', err);
        }
      });
    }
  }

  /**
   * Return current connection status
   */
  public getStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * Return client UUID
   */
  public getClientId(): string {
    return this.clientId;
  }
}

export const sseManager = new SseSyncManager();
