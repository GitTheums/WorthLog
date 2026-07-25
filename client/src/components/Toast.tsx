import { useEffect } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import './Toast.css';

export type ToastTone = 'success' | 'error';

export interface ToastMessage {
  id: string;
  tone: ToastTone;
  message: string;
}

interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

export function Toast({ toast, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => {
      onDismiss();
    }, 3200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [toast, onDismiss]);

  if (!toast) {
    return null;
  }

  const Icon = toast.tone === 'success' ? CheckCircle2 : XCircle;

  return (
    <div className="toast-region" aria-live="polite" aria-atomic="true">
      <div
        className={`toast toast--${toast.tone}`}
        role={toast.tone === 'error' ? 'alert' : 'status'}
      >
        <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
        <p className="toast__message">{toast.message}</p>
        <button
          type="button"
          className="toast__dismiss"
          onClick={onDismiss}
          aria-label="Dismiss notification"
        >
          Close
        </button>
      </div>
    </div>
  );
}
