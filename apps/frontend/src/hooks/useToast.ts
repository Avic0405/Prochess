'use client';

import { useEffect, useState, useCallback } from 'react';

interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
  duration?: number;
}

// Module-level singleton — one shared queue for the entire app
type Listener = (toasts: Toast[]) => void;
const listeners: Listener[] = [];
let memoryState: Toast[] = [];

function dispatch(toasts: Toast[]) {
  memoryState = toasts;
  listeners.forEach((l) => l(toasts));
}

// Standalone toast() — safe to call from anywhere (no hook context needed)
export function toast(options: Omit<Toast, 'id'>) {
  const id = Math.random().toString(36).slice(2);
  const duration = options.duration ?? 4000;
  dispatch([...memoryState, { ...options, id }]);
  setTimeout(() => {
    dispatch(memoryState.filter((t) => t.id !== id));
  }, duration);
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>(memoryState);

  useEffect(() => {
    listeners.push(setToasts);
    setToasts(memoryState);
    return () => {
      const idx = listeners.indexOf(setToasts);
      if (idx > -1) listeners.splice(idx, 1);
    };
  }, []);

  const dismiss = useCallback((id: string) => {
    dispatch(memoryState.filter((t) => t.id !== id));
  }, []);

  return { toasts, toast, dismiss };
}
