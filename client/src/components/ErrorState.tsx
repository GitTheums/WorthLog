import { AlertTriangle } from 'lucide-react';
import './ErrorState.css';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
}: ErrorStateProps) {
  return (
    <section className="error-state" role="alert">
      <div className="error-state__icon" aria-hidden="true">
        <AlertTriangle size={22} strokeWidth={1.75} />
      </div>
      <div className="error-state__copy">
        <h2 className="error-state__title">{title}</h2>
        <p className="error-state__message">{message}</p>
      </div>
      {onRetry ? (
        <button type="button" className="error-state__retry" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </section>
  );
}
