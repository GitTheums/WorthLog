import { LineChart } from 'lucide-react';
import './EmptyState.css';

interface EmptyStateProps {
  onAddSnapshot: () => void;
}

export function EmptyState({ onAddSnapshot }: EmptyStateProps) {
  return (
    <section className="empty-state">
      <div className="empty-state__icon" aria-hidden="true">
        <LineChart size={28} strokeWidth={1.6} />
      </div>
      <h2 className="empty-state__title">No snapshots yet</h2>
      <p className="empty-state__message">
        Create your first snapshot to start tracking the total EUR value of your
        investment categories over time. Once saved, your dashboard charts,
        allocation, and history will appear here.
      </p>
      <button
        type="button"
        className="empty-state__button"
        onClick={onAddSnapshot}
      >
        Add your first snapshot
      </button>
    </section>
  );
}
