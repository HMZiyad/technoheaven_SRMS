import { create } from 'zustand';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  requestId?: string;
  reference?: string;
  timestamp: string;
  read: boolean;
}

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (item: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
}

const STORAGE_KEY = 'srms_notifications';

function loadStoredNotifications(): AppNotification[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveNotifications(notifications: AppNotification[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, 50)));
  } catch {
    // Ignore storage quota errors
  }
}

const initialNotifications = loadStoredNotifications();
const initialUnread = initialNotifications.filter((n) => !n.read).length;

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: initialNotifications,
  unreadCount: initialUnread,

  addNotification: (item) => {
    const id = Math.random().toString(36).substring(2, 10);
    const newNotification: AppNotification = {
      ...item,
      id,
      timestamp: new Date().toISOString(),
      read: false,
    };

    set((state) => {
      // Keep up to 40 most recent notifications
      const updated = [newNotification, ...state.notifications].slice(0, 40);
      const unreadCount = updated.filter((n) => !n.read).length;
      saveNotifications(updated);
      return { notifications: updated, unreadCount };
    });
  },

  markAsRead: (id: string) => {
    set((state) => {
      const updated = state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      );
      const unreadCount = updated.filter((n) => !n.read).length;
      saveNotifications(updated);
      return { notifications: updated, unreadCount };
    });
  },

  markAllAsRead: () => {
    set((state) => {
      const updated = state.notifications.map((n) => ({ ...n, read: true }));
      saveNotifications(updated);
      return { notifications: updated, unreadCount: 0 };
    });
  },

  clearAll: () => {
    saveNotifications([]);
    set({ notifications: [], unreadCount: 0 });
  },
}));

export default useNotificationStore;
