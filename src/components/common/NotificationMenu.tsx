import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotification, type AppNotification } from '../../contexts/NotificationContext';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuSeparator,
} from '../ui/dropdown-menu';
import {
  Bell,
  CheckCheck,
  Trash2,
  ClipboardList,
  FileText,
  AlertCircle,
  Clock,
  Radio,
} from 'lucide-react';

interface NotificationMenuProps {
  className?: string;
  isMobile?: boolean;
}

/**
 * Helper to compute human-readable relative time string
 */
function getRelativeTimeString(isoDate: string): string {
  try {
    const diffSeconds = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
    if (diffSeconds < 30) return 'Just now';
    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return 'Recent';
  }
}

/**
 * Modern Shadcn UI Notification Menu
 *
 * Positioning & Responsive Architecture:
 * 1. Strict Downward Rendering: Configured with `side="bottom"`, `align="end"`, and `sideOffset={8}`.
 *    This ensures the notification popover/dropdown always drops downward cleanly below the topbar/navbar,
 *    preventing accidental upward-flipping or header overlap on mobile and desktop viewports.
 * 2. Mobile Responsive Overflow Protection: Constrained with `w-80 max-w-[95vw] sm:max-w-md` and
 *    `collisionPadding={12}` so the panel never breaches viewport edges or causes horizontal scrollbars.
 * 3. Real-Time Alert Synchronization: Ingests live SSE alerts with one-click navigation and mark-as-read state.
 */
export const NotificationMenu: React.FC<NotificationMenuProps> = ({
  className = '',
  isMobile = false,
}) => {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotifications,
  } = useNotification();
  const navigate = useNavigate();

  const handleSelectNotification = (item: AppNotification) => {
    markAsRead(item.id);
    if (item.link) {
      navigate(item.link);
    }
  };

  const getAlertIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'order':
        return (
          <div className="size-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <ClipboardList className="size-3.5" />
          </div>
        );
      case 'invoice':
        return (
          <div className="size-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <FileText className="size-3.5" />
          </div>
        );
      default:
        return (
          <div className="size-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <AlertCircle className="size-3.5" />
          </div>
        );
    }
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="View notifications"
          className={`relative flex items-center justify-center rounded-lg border transition-all duration-200 outline-none select-none shrink-0 ${
            isMobile
              ? 'size-8 border-slate-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200'
              : 'size-8 sm:size-9 border-slate-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white'
          } ${className}`}
        >
          <Bell className={isMobile ? 'size-3.5' : 'size-4'} />

          {/* Unread Badge Counter */}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex min-w-4 h-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9.5px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-zinc-950 animate-in zoom-in-75">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      {/* 
        Strict Downward Rendering & Scroll-Anchored Collision Handling:
        - side="bottom", align="end", sideOffset={8}
        - avoidCollisions={true}, collisionPadding={16}, preventScroll={false}
        - w-80 max-w-[95vw] sm:max-w-md prevents horizontal clipping on narrow mobile screens
      */}
      <DropdownMenuContent
        side="bottom"
        align="end"
        sideOffset={8}
        avoidCollisions={true}
        collisionPadding={16}
        preventScroll={false}
        className="w-80 max-w-[95vw] sm:max-w-md sm:w-96 p-0 rounded-2xl border border-slate-200/90 dark:border-zinc-800 shadow-2xl bg-white dark:bg-zinc-950 text-slate-900 dark:text-white overflow-hidden z-[99999]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-zinc-800/80 bg-slate-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-zinc-100">
              Notifications
            </span>
            {unreadCount > 0 && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400">
                {unreadCount} new
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100 px-2 py-1 rounded-md hover:bg-slate-200/60 dark:hover:bg-zinc-800 transition-colors"
                title="Mark all as read"
              >
                <CheckCheck className="size-3.5" />
                <span>Read all</span>
              </button>
            )}

            {notifications.length > 0 && (
              <button
                type="button"
                onClick={clearNotifications}
                className="flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-rose-600 dark:text-zinc-500 dark:hover:text-rose-400 px-1.5 py-1 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                title="Clear all alerts"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Notification List */}
        <div className="max-h-[22rem] overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-900 overscroll-contain">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <div className="size-10 rounded-full bg-slate-100 dark:bg-zinc-900 flex items-center justify-center text-slate-400 dark:text-zinc-600 mb-2.5">
                <Bell className="size-5 opacity-60" />
              </div>
              <p className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                No notifications yet
              </p>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1 max-w-[18rem]">
                Real-time alerts for incoming orders, invoices, and payment sync will appear here.
              </p>
            </div>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                onClick={() => handleSelectNotification(item)}
                className={`flex items-start gap-3 p-3 transition-colors cursor-pointer group text-left ${
                  !item.read
                    ? 'bg-blue-50/40 dark:bg-blue-950/20 hover:bg-blue-50/70 dark:hover:bg-blue-950/30'
                    : 'hover:bg-slate-50 dark:hover:bg-zinc-900/60'
                }`}
              >
                {getAlertIcon(item.type)}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1.5">
                    <h4
                      className={`text-xs font-semibold truncate ${
                        !item.read
                          ? 'text-slate-900 dark:text-zinc-100'
                          : 'text-slate-700 dark:text-zinc-300'
                      }`}
                    >
                      {item.title}
                    </h4>
                    {!item.read && (
                      <span className="size-2 rounded-full bg-blue-600 shrink-0" />
                    )}
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 line-clamp-2 mt-0.5 leading-snug">
                    {item.message}
                  </p>

                  <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-400 dark:text-zinc-500">
                    <Clock className="size-2.5 opacity-70" />
                    <span>{getRelativeTimeString(item.timestamp)}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Real-Time Status */}
        <DropdownMenuSeparator className="m-0" />
        <div className="flex items-center justify-between px-3.5 py-2 bg-slate-50/80 dark:bg-zinc-900/80 text-[10px] text-slate-500 dark:text-zinc-400">
          <div className="flex items-center gap-1.5">
            <Radio className="size-3 text-emerald-500 animate-pulse" />
            <span className="font-medium">Live SSE Feed Active</span>
          </div>
          <span className="font-mono text-[9px] text-slate-400 dark:text-zinc-500">
            {notifications.length} {notifications.length === 1 ? 'alert' : 'alerts'}
          </span>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
