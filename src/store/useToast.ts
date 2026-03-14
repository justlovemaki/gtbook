import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  title: string;
  description?: string;
  type: ToastType;
}

interface ToastState {
  toasts: Toast[];
  addToast: (title: string, type: ToastType, description?: string) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (title, type, description) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      toasts: [...state.toasts, { id, title, type, description }],
    }));
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 5000);
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));

export const toast = {
  success: (title: string, description?: string) => useToastStore.getState().addToast(title, 'success', description),
  error: (title: string, description?: string) => useToastStore.getState().addToast(title, 'error', description),
  info: (title: string, description?: string) => useToastStore.getState().addToast(title, 'info', description),
  warning: (title: string, description?: string) => useToastStore.getState().addToast(title, 'warning', description),
};
