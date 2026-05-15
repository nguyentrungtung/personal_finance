import {
  createContext, useContext, useState, useCallback, useEffect,
  type ReactNode, createElement,
} from 'react';
import { createPortal } from 'react-dom';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  variant: ToastVariant;
  title: string;
  message?: string;
  /** HTTP status code — displayed for error toasts */
  status?: number;
  /** Error code string — displayed for error toasts */
  code?: string;
  duration?: number; // ms, default 4000; 0 = persistent
}

interface ToastOptions {
  message?: string;
  status?: number;
  code?: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: ToastItem[];
  success: (title: string, opts?: Omit<ToastOptions, 'status' | 'code'>) => void;
  error: (title: string, opts?: ToastOptions) => void;
  warning: (title: string, opts?: Omit<ToastOptions, 'status' | 'code'>) => void;
  info: (title: string, opts?: Omit<ToastOptions, 'status' | 'code'>) => void;
  dismiss: (id: string) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

// ─── Single Toast Component ───────────────────────────────────────────────────

const VARIANT_STYLES: Record<ToastVariant, { bar: string; icon: string; label: string }> = {
  success: { bar: 'bg-brand-green',   icon: '✓', label: 'text-brand-green' },
  error:   { bar: 'bg-red-500',       icon: '✕', label: 'text-red-400'    },
  warning: { bar: 'bg-amber-500',     icon: '⚠', label: 'text-amber-400'  },
  info:    { bar: 'bg-blue-500',      icon: 'ℹ', label: 'text-blue-400'   },
};

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const s = VARIANT_STYLES[toast.variant];
  const duration = toast.duration ?? 4000;

  // Progress bar animation
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="relative w-80 bg-surface-card border border-border-subtle rounded-xl shadow-2xl overflow-hidden flex flex-col animate-toast-in"
    >
      {/* Accent bar left */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${s.bar}`} />

      <div className="flex items-start gap-3 px-4 py-3 pl-5">
        {/* Icon */}
        <span className={`mt-0.5 text-sm font-bold shrink-0 ${s.label}`}>{s.icon}</span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-text-primary text-sm font-medium leading-snug">{toast.title}</p>

          {toast.message && (
            <p className="text-text-secondary text-xs mt-0.5 leading-relaxed">{toast.message}</p>
          )}

          {/* Error meta: status + code */}
          {(toast.status !== undefined || toast.code) && (
            <p className="text-text-muted text-xs mt-1 font-mono">
              {toast.status !== undefined && (
                <span className="bg-red-500/20 text-red-400 rounded px-1 py-0.5 mr-1">
                  HTTP {toast.status}
                </span>
              )}
              {toast.code && (
                <span className="bg-surface text-text-secondary rounded px-1 py-0.5">
                  {toast.code}
                </span>
              )}
            </p>
          )}
        </div>

        {/* Close button */}
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-text-muted hover:text-text-primary text-lg leading-none mt-0.5"
          aria-label="Dismiss notification"
        >
          ×
        </button>
      </div>

      {/* Progress bar (only for timed toasts) */}
      {duration > 0 && (
        <div className="h-0.5 w-full bg-border-subtle overflow-hidden">
          <div
            className={`h-full ${s.bar} opacity-60`}
            style={{
              animation: `toast-progress ${duration}ms linear forwards`,
            }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const add = useCallback((item: Omit<ToastItem, 'id'>) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { ...item, id }]);
    return id;
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const success = useCallback((title: string, opts?: Omit<ToastOptions, 'status' | 'code'>) => {
    add({ variant: 'success', title, ...opts });
  }, [add]);

  const error = useCallback((title: string, opts?: ToastOptions) => {
    add({ variant: 'error', title, duration: 6000, ...opts });
  }, [add]);

  const warning = useCallback((title: string, opts?: Omit<ToastOptions, 'status' | 'code'>) => {
    add({ variant: 'warning', title, ...opts });
  }, [add]);

  const info = useCallback((title: string, opts?: Omit<ToastOptions, 'status' | 'code'>) => {
    add({ variant: 'info', title, ...opts });
  }, [add]);

  return createElement(
    ToastContext.Provider,
    { value: { toasts, success, error, warning, info, dismiss } },
    <>
      {children}
      {createPortal(
        <ToastContainer toasts={toasts} onDismiss={dismiss} />,
        document.body,
      )}
    </>,
  );
}

// ─── Container (portal target) ────────────────────────────────────────────────

function ToastContainer({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) {
  return (
    <div
      className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none"
      aria-label="Notifications"
    >
      {toasts.map((t) => (
        <AutoDismiss key={t.id} toast={t} onDismiss={() => onDismiss(t.id)}>
          <ToastCard toast={t} onDismiss={() => onDismiss(t.id)} />
        </AutoDismiss>
      ))}
    </div>
  );
}

// ─── AutoDismiss wrapper ──────────────────────────────────────────────────────

function AutoDismiss({ toast, onDismiss, children }: { toast: ToastItem; onDismiss: () => void; children: ReactNode }) {
  const duration = toast.duration ?? 4000;

  useEffect(() => {
    if (duration === 0) return;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  return (
    <div className="pointer-events-auto">
      {children}
    </div>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
