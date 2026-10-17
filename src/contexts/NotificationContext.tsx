import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { sseManager } from '../lib/sse';
import { useAuth } from './AuthContext';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'order' | 'invoice' | 'system' | 'info';
  timestamp: string;
  read: boolean;
  link?: string;
  metadata?: any;
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  removeNotification: (id: string) => void;
  addNotification: (data: Omit<AppNotification, 'id' | 'timestamp' | 'read'> & { id?: string }) => void;
}

const STORAGE_KEY = 'reliance_realtime_notifications';
const MAX_NOTIFICATIONS = 50;
const DEDUP_WINDOW_MS = 5000; // 5-second deduplication threshold for incoming SSE bursts

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

/**
 * Global Real-Time Notification Provider
 *
 * Architectural Features & Deduplication Safeguards:
 * 1. SSE Event Ingestion with Cleanup: Listens to real-time events (order_created, order_updated,
 *    order_deleted, invoice_created, invoice_updated, invoice_deleted). All subscriber callbacks are
 *    strictly unregistered in the useEffect cleanup return function to eliminate dangling memory leaks.
 * 2. Multi-Tier Deduplication Mechanism:
 *    - In-Memory Signature Cache: Maintains a Ref Map tracking recent `event:entityId` keys with timestamps.
 *      Any incoming SSE payload identical to one received within DEDUP_WINDOW_MS is quietly ignored.
 *      This absorbs React StrictMode double-mount invocations and network transport micro-reconnect bursts.
 *    - State-Level Deduplication: In `addNotification`, verifies whether an alert with identical ID or
 *      title/message was already appended recently before updating React state.
 * 3. Persistence: Synchronizes the most recent notifications with localStorage for seamless UX across reloads.
 */
export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, isAuthenticated } = useAuth();

  // In-memory event deduplication cache: stores unique event keys mapped to arrival timestamps
  const processedEventsRef = useRef<Map<string, number>>(new Map());

  // Tracks recent direct invoices for cross-event conversion deduplication
  const recentInvoicesRef = useRef<Array<{ id: any; amount: number; customer: string; time: number }>>([]);

  // Load initial persisted notifications safely
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Ignore local storage parse errors
    }
    return [];
  });

  // Keep localStorage synchronized whenever notifications change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, MAX_NOTIFICATIONS)));
    } catch {
      // Storage quota or privacy restriction safeguard
    }
  }, [notifications]);

  // Derived unread count
  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  /**
   * Evaluates whether an incoming event signature was recently processed.
   * If processed within DEDUP_WINDOW_MS, returns true (should skip).
   * Automatically prunes stale entries (> 30s) to keep memory footprint minimal.
   */
  const isDuplicateEvent = useCallback((eventKey: string): boolean => {
    const now = Date.now();
    const lastProcessed = processedEventsRef.current.get(eventKey);

    if (lastProcessed && now - lastProcessed < DEDUP_WINDOW_MS) {
      return true;
    }

    processedEventsRef.current.set(eventKey, now);

    // Prune stale keys to prevent memory leak
    if (processedEventsRef.current.size > 80) {
      for (const [k, timestamp] of processedEventsRef.current.entries()) {
        if (now - timestamp > 30000) {
          processedEventsRef.current.delete(k);
        }
      }
    }

    return false;
  }, []);

  /**
   * Prepend a new alert to the notification feed with state-level deduplication
   */
  const addNotification = useCallback((data: Omit<AppNotification, 'id' | 'timestamp' | 'read'> & { id?: string }) => {
    const alertId = data.id || `${data.type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const nowIso = new Date().toISOString();

    const newAlert: AppNotification = {
      ...data,
      id: alertId,
      timestamp: nowIso,
      read: false,
    };

    setNotifications((prev) => {
      // Check if alert with same ID or identical title and message was already appended within last 4s
      const isDuplicate = prev.some((n) => {
        if (n.id === newAlert.id) return true;
        if (n.title === newAlert.title && n.message === newAlert.message) {
          const timeDiff = Math.abs(new Date(n.timestamp).getTime() - new Date(newAlert.timestamp).getTime());
          return timeDiff < 4000;
        }
        return false;
      });

      if (isDuplicate) {
        return prev;
      }

      return [newAlert, ...prev.slice(0, MAX_NOTIFICATIONS - 1)];
    });
  }, []);

  /**
   * Mark a specific alert as read
   */
  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  /**
   * Mark all alerts as read
   */
  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  /**
   * Clear all notification history
   */
  const clearNotifications = useCallback(() => {
    setNotifications([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }, []);

  /**
   * Remove a single notification
   */
  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // Global SSE Stream Subscription: Listen to critical system events with strict cleanup
  useEffect(() => {
    if (!isAuthenticated || !token) return;

    // Ensure SSE stream is active
    sseManager.connect(token, 'global');

    const unsubs: Array<() => void> = [];

    // 1. Order Created (with direct invoice cross-event deduplication)
    const unsubOrderCreated = sseManager.subscribe('order_created', (payload: any) => {
      const entityId = payload?.id || payload?.orderNumber || 'unknown';
      if (isDuplicateEvent(`order_created:${entityId}`)) return;

      const orderRef = payload?.orderNumber ? `#${payload.orderNumber}` : (payload?.id ? `#ORD-${payload.id}` : '');
      const custName = payload?.customerName || payload?.customer?.name || 'Customer';
      const amount = Number(payload?.totalAmount || 0);
      const custNorm = custName.trim().toLowerCase();

      /**
       * Direct Invoice Cross-Event Suppression:
       * When a cashier creates a direct invoice via POS/Quick Invoice, an order entity
       * is generated under the hood. If a matching invoice was generated within the last 6 seconds
       * for the same customer/amount, suppress this presales order alert.
       */
      const isDirectInvoiceOrder = recentInvoicesRef.current.some((inv) => {
        const isRecent = Date.now() - inv.time < 6000;
        const matchesAmount = amount > 0 && Math.abs(inv.amount - amount) < 0.01;
        const matchesCustomer = custNorm && inv.customer && inv.customer === custNorm;
        return isRecent && (matchesAmount || matchesCustomer);
      });

      if (isDirectInvoiceOrder) {
        return;
      }

      addNotification({
        id: `order-created-${entityId}`,
        title: `New Presales Order ${orderRef} Added`,
        message: `Presales order created for ${custName}${amount > 0 ? ` • LKR ${amount.toLocaleString()}` : ''}`,
        type: 'order',
        link: '/system/orders',
        metadata: payload,
      });
    });
    unsubs.push(unsubOrderCreated);

    // 2. Order Updated
    const unsubOrderUpdated = sseManager.subscribe('order_updated', (payload: any) => {
      const entityId = payload?.id || payload?.orderNumber || 'unknown';
      const status = payload?.status || '';
      if (isDuplicateEvent(`order_updated:${entityId}:${status}`)) return;

      const orderRef = payload?.orderNumber ? `#${payload.orderNumber}` : (payload?.id ? `#ORD-${payload.id}` : '');
      const statusLabel = status ? `(${status})` : '';

      addNotification({
        id: `order-updated-${entityId}-${Date.now()}`,
        title: `Presales Order ${orderRef} Updated ${statusLabel}`.trim(),
        message: `Order status or item specifications modified in system.`,
        type: 'order',
        link: '/system/orders',
        metadata: payload,
      });
    });
    unsubs.push(unsubOrderUpdated);

    // 3. Order Deleted
    const unsubOrderDeleted = sseManager.subscribe('order_deleted', (payload: any) => {
      const id = payload?.orderNumber || payload?.id || payload?.orderId || 'unknown';
      if (isDuplicateEvent(`order_deleted:${id}`)) return;

      addNotification({
        id: `order-deleted-${id}-${Date.now()}`,
        title: `Presales Order #${id} Removed`,
        message: `Order record was permanently removed from active pipeline.`,
        type: 'order',
        link: '/system/orders',
      });
    });
    unsubs.push(unsubOrderDeleted);

    // 4. Invoice Created (with retroactive order notification purge)
    const unsubInvoiceCreated = sseManager.subscribe('invoice_created', (payload: any) => {
      const entityId = payload?.id || payload?.invoiceNumber || 'unknown';
      if (isDuplicateEvent(`invoice_created:${entityId}`)) return;

      const invRef = payload?.invoiceNumber ? `#${payload.invoiceNumber}` : (payload?.id ? `#INV-${payload.id}` : '');
      const custName = payload?.customerName || payload?.customer?.name || 'Walk-in Customer';
      const amount = Number(payload?.totalAmount || 0);
      const custNorm = custName.trim().toLowerCase();

      // Register in recentInvoicesRef to block simultaneous order_created broadcasts
      recentInvoicesRef.current.push({
        id: entityId,
        amount,
        customer: custNorm,
        time: Date.now(),
      });

      // Prune stale invoices from tracking cache
      if (recentInvoicesRef.current.length > 50) {
        recentInvoicesRef.current = recentInvoicesRef.current.filter((i) => Date.now() - i.time < 20000);
      }

      /**
       * Retroactive Order Alert Purge:
       * If an order_created alert slipped in moments before this invoice_created frame arrived,
       * immediately prune that order alert from state to eliminate dual notifications.
       */
      setNotifications((prev) =>
        prev.filter((n) => {
          if (n.type === 'order') {
            const isRecent = Math.abs(Date.now() - new Date(n.timestamp).getTime()) < 6000;
            const orderAmt = Number(n.metadata?.totalAmount || 0);
            const orderCust = (n.metadata?.customerName || n.metadata?.customer?.name || '').trim().toLowerCase();
            const matchesAmount = amount > 0 && Math.abs(orderAmt - amount) < 0.01;
            const matchesCustomer = custNorm && orderCust && orderCust === custNorm;

            if (isRecent && (matchesAmount || matchesCustomer)) {
              return false;
            }
          }
          return true;
        })
      );

      addNotification({
        id: `invoice-created-${entityId}`,
        title: `New Invoice ${invRef} Generated`,
        message: `Bill created for ${custName}${amount > 0 ? ` • LKR ${amount.toLocaleString()}` : ''}`,
        type: 'invoice',
        link: '/system/invoices',
        metadata: payload,
      });
    });
    unsubs.push(unsubInvoiceCreated);

    // 5. Invoice Updated
    const unsubInvoiceUpdated = sseManager.subscribe('invoice_updated', (payload: any) => {
      const entityId = payload?.id || payload?.invoiceNumber || 'unknown';
      const stateSig = `${payload?.paidAmount || ''}:${payload?.isDispatched || ''}`;
      if (isDuplicateEvent(`invoice_updated:${entityId}:${stateSig}`)) return;

      const invRef = payload?.invoiceNumber ? `#${payload.invoiceNumber}` : (payload?.id ? `#INV-${payload.id}` : '');

      addNotification({
        id: `invoice-updated-${entityId}-${Date.now()}`,
        title: `Invoice ${invRef} Updated`,
        message: `Payment settlement or dispatch status synchronized.`,
        type: 'invoice',
        link: '/system/invoices',
        metadata: payload,
      });
    });
    unsubs.push(unsubInvoiceUpdated);

    // 6. Invoice Deleted
    const unsubInvoiceDeleted = sseManager.subscribe('invoice_deleted', (payload: any) => {
      const id = payload?.invoiceNumber || payload?.id || payload?.invoiceId || 'unknown';
      if (isDuplicateEvent(`invoice_deleted:${id}`)) return;

      addNotification({
        id: `invoice-deleted-${id}-${Date.now()}`,
        title: `Invoice #${id} Removed`,
        message: `Invoice record was deleted from the system.`,
        type: 'invoice',
        link: '/system/invoices',
      });
    });
    unsubs.push(unsubInvoiceDeleted);

    // STRICT CLEANUP: Guarantee all event subscriptions are cleanly removed upon unmount or auth state change
    return () => {
      unsubs.forEach((unsub) => {
        try {
          unsub();
        } catch {
          // Silently absorb unsubscription edge errors
        }
      });
    };
  }, [isAuthenticated, token, addNotification, isDuplicateEvent]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        clearNotifications,
        removeNotification,
        addNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

/**
 * Reusable Hook to access global notifications
 */
export const useNotification = (): NotificationContextType => {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return ctx;
};
