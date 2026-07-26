import { useEffect } from 'react';

let lockCount = 0;

export function useBodyScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) {
      return;
    }

    lockCount += 1;
    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;

    if (lockCount === 1) {
      const scrollbar = window.innerWidth - document.documentElement.clientWidth;
      body.style.overflow = 'hidden';
      if (scrollbar > 0) {
        body.style.paddingRight = `${String(scrollbar)}px`;
      }
    }

    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) {
        body.style.overflow = previousOverflow;
        body.style.paddingRight = previousPaddingRight;
      }
    };
  }, [locked]);
}
