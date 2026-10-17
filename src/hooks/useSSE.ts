import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { sseManager, type SseEventHandler, type ConnectionStatus } from '../lib/sse';

export interface UseSSEOptions {
  channel?: string;
  events?: Record<string, SseEventHandler>;
}

/**
 * Reusable React hook for real-time Server-Sent Events (SSE) synchronization.
 *
 * Capabilities:
 * - Automatically initializes stream connection upon authenticated session.
 * - Suppresses console noise (like ERR_QUIC_PROTOCOL_ERROR or HTTP/3 transport drops)
 *   during native EventSource automatic background reconnection cycles.
 * - Manages event listeners and unsubscription upon component unmount.
 * - Tightly coupled with auth state; disconnects immediately when session expires
 *   to eliminate ghost connections or memory leaks.
 */
export function useSSE(options: UseSSEOptions = {}) {
  const { token, isAuthenticated } = useAuth();
  const [status, setStatus] = useState<ConnectionStatus>(sseManager.getStatus());
  const eventsRef = useRef(options.events);
  eventsRef.current = options.events;

  // Manage connection lifecycle with authentication state
  useEffect(() => {
    if (isAuthenticated && token) {
      sseManager.connect(token, options.channel || 'global');
      setStatus(sseManager.getStatus());
    } else {
      sseManager.disconnect();
      setStatus('disconnected');
    }
  }, [isAuthenticated, token, options.channel]);

  // Register event subscriptions
  useEffect(() => {
    const events = eventsRef.current;
    if (!events) return;

    const unsubs: Array<() => void> = [];

    Object.entries(events).forEach(([eventName, handler]) => {
      const unsub = sseManager.subscribe(eventName, (payload) => {
        if (eventsRef.current?.[eventName]) {
          eventsRef.current[eventName](payload);
        }
      });
      unsubs.push(unsub);
    });

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [options.events]);

  return {
    status,
    isConnected: status === 'connected',
    clientId: sseManager.getClientId(),
    subscribe: (event: string, handler: SseEventHandler) => sseManager.subscribe(event, handler),
    reconnect: () => sseManager.connect(token, options.channel || 'global'),
  };
}

export default useSSE;
