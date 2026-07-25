import { useId, useRef, type RefObject } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import './ConfirmDialog.css';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  busy?: boolean;
  restoreFocusTo?: RefObject<HTMLElement | null>;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  busy = false,
  restoreFocusTo,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

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

  if (!open) {
    return null;
  }

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
        className="confirm-dialog__panel"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        <h2 id={titleId} className="confirm-dialog__title">
          {title}
        </h2>
        <p id={descriptionId} className="confirm-dialog__description">
          {description}
        </p>
        <div className="confirm-dialog__actions">
          <button
            type="button"
            className="confirm-dialog__button confirm-dialog__button--ghost"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={
              tone === 'danger'
                ? 'confirm-dialog__button confirm-dialog__button--danger'
                : 'confirm-dialog__button confirm-dialog__button--primary'
            }
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
