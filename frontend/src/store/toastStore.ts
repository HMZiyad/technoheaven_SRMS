import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration?: number;
}

interface ToastState {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, 'id'>) => string;
  removeToast: (id: string) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  addToast: (toast) => {
    const id = Math.random().toString(36).substring(2, 9);
    const duration = toast.duration ?? 4500;
    const newToast: ToastItem = { ...toast, id, duration };

    set((state) => ({
      toasts: [...state.toasts, newToast],
    }));

    if (duration > 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, duration);
    }

    return id;
  },

  removeToast: (id: string) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  success: (message: string, title?: string) => {
    get().addToast({ type: 'success', message, title });
  },

  error: (message: string, title?: string) => {
    get().addToast({ type: 'error', message, title });
  },

  info: (message: string, title?: string) => {
    get().addToast({ type: 'info', message, title });
  },

  warning: (message: string, title?: string) => {
    get().addToast({ type: 'warning', message, title });
  },
}));

export const toast = {
  success: (msg: string, title?: string) => useToastStore.getState().success(msg, title),
  error: (msg: string, title?: string) => useToastStore.getState().error(msg, title),
  info: (msg: string, title?: string) => useToastStore.getState().info(msg, title),
  warning: (msg: string, title?: string) => useToastStore.getState().warning(msg, title),
};

export default useToastStore;
