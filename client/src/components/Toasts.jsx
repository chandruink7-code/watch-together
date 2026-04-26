export default function Toasts({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-[calc(100%-2rem)] sm:w-auto">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

function Toast({ toast, onDismiss }) {
  const styles = {
    info:    { bar: 'bg-brand-500', icon: '✦' },
    success: { bar: 'bg-emerald-500', icon: '✓' },
    warn:    { bar: 'bg-amber-500', icon: '!' },
    error:   { bar: 'bg-red-500', icon: '×' },
    user:    { bar: 'bg-cyan-500', icon: '◉' },
  };
  const s = styles[toast.kind] || styles.info;

  // Map of background colors for the icon tile (real CSS values, not Tailwind).
  const iconBg = {
    info:    'rgba(229, 9, 20, 0.2)',     // brand red
    success: 'rgba(16, 185, 129, 0.2)',   // emerald
    warn:    'rgba(245, 158, 11, 0.2)',   // amber
    error:   'rgba(239, 68, 68, 0.2)',    // red
    user:    'rgba(6, 182, 212, 0.2)',    // cyan
  }[toast.kind] || 'rgba(229, 9, 20, 0.2)';

  return (
    <div className="pointer-events-auto bg-surface-900/95 backdrop-blur-md border border-surface-700 rounded-xl shadow-panel overflow-hidden flex animate-slide-in-right">
      <div className={`w-1 ${s.bar}`} />
      <div className="flex-1 px-4 py-3 flex items-start gap-3">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
          style={{ background: iconBg }}
        >
          <span>{s.icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          {toast.title && (
            <div className="text-sm font-semibold leading-tight">{toast.title}</div>
          )}
          {toast.message && (
            <div className="text-xs text-surface-500 mt-0.5">{toast.message}</div>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="text-surface-500 hover:text-white transition flex-shrink-0"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
