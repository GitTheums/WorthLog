import { useEffect, useId, useRef } from 'react';
import './PlaceholderDialog.css';

interface PlaceholderDialogProps {
  open: boolean;
  title: string;
  description: string;
  onClose: () => void;
}

export function PlaceholderDialog({
  open,
  title,
  description,
  onClose,
}: PlaceholderDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="placeholder-dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onClose={onClose}
      onCancel={onClose}
    >
      <div className="placeholder-dialog__panel">
        <h2 id={titleId} className="placeholder-dialog__title">
          {title}
        </h2>
        <p id={descriptionId} className="placeholder-dialog__description">
          {description}
        </p>
        <button
          type="button"
          className="placeholder-dialog__button"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </dialog>
  );
}
