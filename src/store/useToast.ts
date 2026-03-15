import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  title: string;
  description?: string;
  type: ToastType;
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
  addToast: (title: string, type: ToastType, description?: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (title, type, description, duration = 5000) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      toasts: [...state.toasts, { id, title, type, description, duration }],
    }));
    
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, duration);
    }
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));

export const toast = {
  success: (title: string, description?: string, duration?: number) => useToastStore.getState().addToast(title, 'success', description, duration),
  error: (title: string, description?: string, duration?: number) => useToastStore.getState().addToast(title, 'error', description, duration),
  info: (title: string, description?: string, duration?: number) => useToastStore.getState().addToast(title, 'info', description, duration),
  warning: (title: string, description?: string, duration?: number) => useToastStore.getState().addToast(title, 'warning', description, duration),
};
