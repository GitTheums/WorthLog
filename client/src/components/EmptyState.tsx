import { LineChart } from 'lucide-react';
import './EmptyState.css';

interface EmptyStateProps {
  variant?: 'no-snapshots' | 'no-categories';
  onAddSnapshot: () => void;
  onOpenSettings?: () => void;
}

export function EmptyState({
  variant = 'no-snapshots',
  onAddSnapshot,
  onOpenSettings,
}: EmptyStateProps) {
  if (variant === 'no-categories') {
    return (
      <section className="empty-state" aria-labelledby="empty-state-title">
        <div className="empty-state__glow" aria-hidden="true" />
        <div className="empty-state__icon" aria-hidden="true">
          <LineChart size={28} strokeWidth={1.6} />
        </div>
        <h2 id="empty-state-title" className="empty-state__title">
          No categories yet
        </h2>
        <p className="empty-state__message">
          Worthlog needs at least one investment category before you can create
          snapshots. Add a category in Settings to get started.
        </p>
        {onOpenSettings ? (
          <button
            type="button"
            className="empty-state__button"
            onClick={onOpenSettings}
          >
            Open category settings
          </button>
        ) : null}
      </section>
    );
  }

  return (
    <section className="empty-state" aria-labelledby="empty-state-title">
      <div className="empty-state__glow" aria-hidden="true" />
      <div className="empty-state__icon" aria-hidden="true">
        <LineChart size={28} strokeWidth={1.6} />
      </div>
      <h2 id="empty-state-title" className="empty-state__title">
        No snapshots yet
      </h2>
      <p className="empty-state__message">
        Worthlog tracks the total value of each investment category by date —
        not individual assets or trades. Add your first snapshot to unlock the
        portfolio chart, allocation breakdown, and history table.
      </p>
      <ul className="empty-state__list">
        <li>Enter category totals for a single date</li>
        <li>Compare changes since the previous and first snapshots</li>
        <li>Export backups anytime from Settings</li>
      </ul>
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
