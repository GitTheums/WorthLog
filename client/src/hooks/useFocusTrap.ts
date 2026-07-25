import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusable(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
    (element) => !element.hasAttribute('disabled') && element.tabIndex !== -1,
  );
}

interface UseFocusTrapOptions {
  open: boolean;
  containerRef: RefObject<HTMLElement | null>;
  restoreFocusTo?: RefObject<HTMLElement | null> | undefined;
  onEscape?: () => void;
  escapeEnabled?: boolean;
}

export function useFocusTrap({
  open,
  containerRef,
  restoreFocusTo,
  onEscape,
  escapeEnabled = true,
}: UseFocusTrapOptions): void {
  const onEscapeRef = useRef(onEscape);
  const escapeEnabledRef = useRef(escapeEnabled);
  onEscapeRef.current = onEscape;
  escapeEnabledRef.current = escapeEnabled;

  useEffect(() => {
    if (!open) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    const previouslyFocused =
      restoreFocusTo?.current ??
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null);

    const focusable = getFocusable(container);
    const initial = focusable[0] ?? container;
    initial.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!escapeEnabledRef.current) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        event.preventDefault();
        onEscapeRef.current?.();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const items = getFocusable(container);
      if (items.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) {
        return;
      }

      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    container.addEventListener('keydown', onKeyDown);

    return () => {
      container.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus();
    };
  }, [open, containerRef, restoreFocusTo]);
}
