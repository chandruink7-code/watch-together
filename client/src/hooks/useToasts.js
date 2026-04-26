import { useState, useCallback, useEffect, useRef } from 'react';

let toastIdCounter = 0;

/**
 * Lightweight toast system. Returns:
 *   toasts       — array to render
 *   notify(opts) — push a new toast { kind, title, message, duration }
 *   dismiss(id)  — remove a toast manually
 *
 * Toasts auto-dismiss after `duration` ms (default 4000).
 */
export default function useToasts() {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const notify = useCallback((opts) => {
    const id = ++toastIdCounter;
    const toast = {
      id,
      kind: opts.kind || 'info',
      title: opts.title,
      message: opts.message,
      duration: opts.duration ?? 4000,
    };
    setToasts((prev) => [...prev, toast]);

    if (toast.duration > 0) {
      const timer = setTimeout(() => dismiss(id), toast.duration);
      timersRef.current.set(id, timer);
    }
    return id;
  }, [dismiss]);

  // Cleanup any timers on unmount
  useEffect(() => () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current.clear();
  }, []);

  return { toasts, notify, dismiss };
}
