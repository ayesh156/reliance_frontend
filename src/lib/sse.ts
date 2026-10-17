/**
 * Server-Sent Events (SSE) Client Synchronization Manager
 * Provides resilient, freeze-proof real-time synchronization between frontend and backend.
 *
 * Built with:
 * - Direct EventSource.close() binding for instantaneous ghost-free disconnection on logout
 * - Automatic exponential-backoff reconnection on network interruptions
 * - Event-based subscription registry
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export type SseEventHandler = (payload: any) => void;

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export class SseSyncManager {
  private eventSource: EventSource | null = null;
  private listeners = new Map<string, Set<SseEventHandler>>();
  private status: ConnectionStatus = 'disconnected';
  private reconnectTimer: any = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 16000;
  private currentToken: string | null = null;
  private currentChannel = 'global';
  private clientId: string;

  constructor() {
    this.clientId = typeof window !== 'undefined'
      ? (localStorage.getItem('reliance_sse_client_id') || Math.random().toString(36).slice(2) + Date.now().toString(36))
      : 'server-client';
    if (typeof window !== 'undefined') {
      localStorage.setItem('reliance_sse_client_id', this.clientId);
    }
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

    // If already connected with identical credentials and open socket, retain connection
    if (
      this.eventSource &&
      this.eventSource.readyState === EventSource.OPEN &&
      this.currentToken === authToken &&
      this.currentChannel === channel
    ) {
      return;
    }

    // Close any previous or stale connection cleanly
    this.disconnect();

    this.currentToken = authToken;
    this.currentChannel = channel;
    this.status = 'connecting';

    try {
      const sseUrl = new URL(`${API_BASE}/sync/stream`);
      sseUrl.searchParams.set('token', authToken);
      sseUrl.searchParams.set('clientId', this.clientId);
      sseUrl.searchParams.set('channel', channel);

      this.eventSource = new EventSource(sseUrl.toString());

      this.eventSource.onopen = () => {
        this.status = 'connected';
        this.reconnectDelay = 1000;
        console.log(`[SSE] Real-time connection established (Client: ${this.clientId}, Channel: ${channel})`);
      };

      this.eventSource.onmessage = (event) => {
        try {
          if (!event.data || event.data === ':') return; // Heartbeat ping
          const parsed = JSON.parse(event.data);
          if (parsed && parsed.event) {
            this.dispatch(parsed.event, parsed.payload);
          }
        } catch (err) {
          console.warn('[SSE] Failed to parse SSE message frame:', err);
        }
      };

      this.eventSource.onerror = (err) => {
        console.warn('[SSE] Connection interrupted or dropped:', err);
        this.status = 'error';
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }
        this.scheduleReconnect();
      };
    } catch (err) {
      console.error('[SSE] Failed to construct EventSource instance:', err);
      this.status = 'error';
      this.scheduleReconnect();
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

    if (this.eventSource) {
      try {
        this.eventSource.close();
        console.log('[SSE] EventSource closed safely. Ghost connection eliminated.');
      } catch (err) {
        console.error('[SSE] Error closing EventSource:', err);
      }
      this.eventSource = null;
    }

    this.status = 'disconnected';
    this.currentToken = null;
  }

  /**
   * Schedule automatic reconnection with exponential backoff on dropped connections
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer || !this.currentToken) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.currentToken) {
        this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, this.maxReconnectDelay);
        this.connect(this.currentToken, this.currentChannel);
      }
    }, this.reconnectDelay);
  }

  /**
   * Subscribe a callback handler to a specific SSE event
   */
  public subscribe(eventName: string, handler: SseEventHandler): () => void {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
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
