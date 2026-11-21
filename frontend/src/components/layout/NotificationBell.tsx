import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCheck,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { useNotificationStore, AppNotification } from '../../store/notificationStore';
import { cn } from '../../utils/cn';

function formatRelativeTime(isoString: string): string {
  try {
    const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (diff < 10) return 'Just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(isoString).toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return 'Recently';
  }
}

export const NotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } =
    useNotificationStore();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleNotificationClick = (item: AppNotification) => {
    markAsRead(item.id);
    if (item.requestId) {
      setIsOpen(false);
      navigate(`/requests/${item.requestId}`);
    }
  };

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'success':
        return (
          <div className="h-8 w-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
            <CheckCircle2 className="h-4 w-4" />
          </div>
        );
      case 'error':
        return (
          <div className="h-8 w-8 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
            <AlertCircle className="h-4 w-4" />
          </div>
        );
      case 'warning':
        return (
          <div className="h-8 w-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
            <AlertTriangle className="h-4 w-4" />
          </div>
        );
      case 'info':
      default:
        return (
          <div className="h-8 w-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
            <Info className="h-4 w-4" />
          </div>
        );
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'relative p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition focus:outline-none focus:ring-2 focus:ring-primary-500/20',
          isOpen && 'bg-slate-100 text-slate-900'
        )}
        title="Notifications"
        aria-label="View notifications"
      >
        <Bell className="h-5 w-5" />

        {/* Unread Count Badge */}
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-rose-500 rounded-full shadow-sm ring-2 ring-white animate-in zoom-in-50 duration-200">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2.5 w-[calc(100vw-2rem)] sm:w-96 max-w-[380px] bg-white rounded-2xl shadow-2xl border border-slate-200/80 z-50 overflow-hidden animate-in fade-in-50 slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50/80 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-primary-100 text-primary-700">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  title="Mark all as read"
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition text-xs flex items-center gap-1 font-medium"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Mark read</span>
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  title="Clear all notifications"
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <div className="h-12 w-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <Bell className="h-6 w-6 opacity-60" />
                </div>
                <p className="text-sm font-medium text-slate-700">No notifications</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Live updates on service requests will appear here.
                </p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className={cn(
                    'flex items-start gap-3 p-3.5 transition cursor-pointer select-none group',
                    item.read
                      ? 'bg-white hover:bg-slate-50/80 text-slate-600'
                      : 'bg-primary-50/30 hover:bg-primary-50/60 text-slate-800'
                  )}
                >
                  {getItemIcon(item.type)}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p
                        className={cn(
                          'text-xs font-semibold truncate',
                          item.read ? 'text-slate-700' : 'text-slate-900 font-bold'
                        )}
                      >
                        {item.title}
                      </p>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {formatRelativeTime(item.timestamp)}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                      {item.message}
                    </p>

                    {item.reference && (
                      <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold text-primary-600 group-hover:underline">
                        View {item.reference} <ExternalLink className="h-2.5 w-2.5" />
                      </span>
                    )}
                  </div>

                  {/* Unread Indicator Dot */}
                  {!item.read && (
                    <div className="h-2 w-2 rounded-full bg-primary-600 shrink-0 mt-1.5 shadow-sm" />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer note */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 bg-slate-50/60 border-t border-slate-100 text-center">
              <span className="text-[11px] text-slate-400 font-medium">
                Showing recent {notifications.length} notifications
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
