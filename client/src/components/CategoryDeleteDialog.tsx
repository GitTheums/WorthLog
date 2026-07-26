import {
  useEffect,
  useId,
  useRef,
  useState,
  type RefObject,
  type SyntheticEvent,
} from 'react';
import type { Category, CategoryDeletionImpact } from '../api/types';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useFocusTrap } from '../hooks/useFocusTrap';
import './ConfirmDialog.css';
import './CategoryDeleteDialog.css';

interface CategoryDeleteDialogProps {
  open: boolean;
  category: Category | null;
  impact: CategoryDeletionImpact | null;
  loadingImpact: boolean;
  busy: boolean;
  error: string | null;
  restoreFocusTo?: RefObject<HTMLElement | null>;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CategoryDeleteDialog({
  open,
  category,
  impact,
  loadingImpact,
  busy,
  error,
  restoreFocusTo,
  onConfirm,
  onCancel,
}: CategoryDeleteDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const confirmInputId = useId();
  const [typedName, setTypedName] = useState('');

  const hasHistory = (impact?.valueCount ?? 0) > 0;
  const nameMatches =
    category !== null && typedName === category.name;
  const canDelete =
    !busy &&
    !loadingImpact &&
    category !== null &&
    impact !== null &&
    (!hasHistory || nameMatches);

  useBodyScrollLock(open);

  useFocusTrap({
    open,
    containerRef: panelRef,
    restoreFocusTo,
    onEscape: () => {
      if (!busy) {
        onCancel();
      }
    },
    escapeEnabled: !busy,
  });

  useEffect(() => {
    if (open) {
      setTypedName('');
    }
  }, [open, category?.id]);

  if (!open || !category) {
    return null;
  }

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canDelete) {
      return;
    }
    onConfirm();
  };

  return (
    <div className="confirm-dialog" role="presentation">
      <button
        type="button"
        className="confirm-dialog__backdrop"
        aria-label="Dismiss dialog"
        disabled={busy}
        onClick={() => {
          if (!busy) {
            onCancel();
          }
        }}
      />
      <div
        ref={panelRef}
        className="confirm-dialog__panel category-delete-dialog__panel"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        <h2 id={titleId} className="confirm-dialog__title">
          Delete {category.name}?
        </h2>

        <div id={descriptionId} className="category-delete-dialog__body">
          {loadingImpact || !impact ? (
            <p className="confirm-dialog__description">
              Checking category history…
            </p>
          ) : hasHistory ? (
            <>
              <p className="confirm-dialog__description">
                You are about to permanently delete{' '}
                <strong>{category.name}</strong>, including{' '}
                <strong>{String(impact.valueCount)}</strong> historical value
                {impact.valueCount === 1 ? '' : 's'} across{' '}
                <strong>{String(impact.snapshotCount)}</strong> snapshot
                {impact.snapshotCount === 1 ? '' : 's'}.
              </p>
              <p className="category-delete-dialog__warning" role="note">
                Deleting this category permanently removes all of its historical
                values. Your past portfolio totals and charts will be
                recalculated. This cannot be undone.
              </p>
              <p className="confirm-dialog__description">
                Archive instead if you only want to hide {category.name} from
                future snapshot forms while keeping its history.
              </p>
              <div className="category-delete-dialog__confirm-field">
                <label htmlFor={confirmInputId}>
                  Type <strong>{category.name}</strong> to confirm
                </label>
                <input
                  id={confirmInputId}
                  value={typedName}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={busy}
                  onChange={(event) => {
                    setTypedName(event.target.value);
                  }}
                />
              </div>
            </>
          ) : (
            <>
              <p className="confirm-dialog__description">
                This permanently removes {category.name}. It has no snapshot
                history, so nothing else will change.
              </p>
              <p className="confirm-dialog__description">
                Prefer Archive if you might use this category again later.
              </p>
            </>
          )}
        </div>

        {error ? (
          <p className="category-delete-dialog__error" role="alert">
            {error}
          </p>
        ) : null}

        <form className="confirm-dialog__actions" onSubmit={handleSubmit}>
          <button
            type="button"
            className="confirm-dialog__button confirm-dialog__button--ghost"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="confirm-dialog__button confirm-dialog__button--danger"
            disabled={!canDelete}
          >
            {busy ? 'Deleting…' : 'Delete category'}
          </button>
        </form>
      </div>
    </div>
  );
}
