import React from 'react';
import * as Toast from '@radix-ui/react-toast';
import { useToastStore } from '../store/useToast';
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  return (
    <Toast.Provider swipeDirection="right">
      {toasts.map((t) => (
        <Toast.Root
          key={t.id}
          className={clsx(
            "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-4 pr-8 shadow-lg transition-all",
            t.type === 'success' && "bg-green-50 text-green-900 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800",
            t.type === 'error' && "bg-red-50 text-red-900 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
            t.type === 'info' && "bg-blue-50 text-blue-900 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",
            t.type === 'warning' && "bg-yellow-50 text-yellow-900 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800"
          )}
          onOpenChange={(open) => !open && removeToast(t.id)}
        >
          <div className="flex items-start gap-3">
            <div className="shrink-0 mt-0.5">
              {t.type === 'success' && <CheckCircle2 className="w-4 h-4" />}
              {t.type === 'error' && <AlertCircle className="w-4 h-4" />}
              {t.type === 'info' && <Info className="w-4 h-4" />}
              {t.type === 'warning' && <AlertTriangle className="w-4 h-4" />}
            </div>
            <div className="grid gap-1">
              {t.title && <Toast.Title className="text-sm font-semibold">{t.title}</Toast.Title>}
              {t.description && (
                <Toast.Description className="text-xs opacity-90">
                  {t.description}
                </Toast.Description>
              )}
            </div>
          </div>
          <Toast.Close className="absolute right-2 top-2 rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100">
            <X className="w-4 h-4" />
          </Toast.Close>
        </Toast.Root>
      ))}
      <Toast.Viewport className="fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]" />
    </Toast.Provider>
  );
};
