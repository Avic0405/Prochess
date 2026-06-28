'use client';

import { useToast } from '@/hooks/useToast';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-80">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'flex items-start gap-3 p-4 rounded-xl border shadow-lg animate-fadeIn',
            toast.variant === 'destructive'
              ? 'bg-destructive text-destructive-foreground border-destructive/20'
              : 'bg-card border',
          )}
        >
          <div className="flex-1">
            {toast.title && <p className="font-semibold text-sm">{toast.title}</p>}
            {toast.description && <p className="text-sm opacity-90 mt-0.5">{toast.description}</p>}
          </div>
          <button onClick={() => dismiss(toast.id)} className="opacity-70 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
