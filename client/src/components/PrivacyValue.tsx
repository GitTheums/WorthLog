import type { ReactNode } from 'react';
import { usePrivacyModeContext } from '../privacy/PrivacyModeContext';
import './PrivacyValue.css';

interface PrivacyValueProps {
  children: ReactNode;
  /** Optional class for the outer wrapper. */
  className?: string;
}

/**
 * Displays a monetary value, or a layout-stable obscured placeholder when
 * privacy mode is enabled. Never exposes the real amount via aria/title.
 */
export function PrivacyValue({ children, className }: PrivacyValueProps) {
  const { hidden } = usePrivacyModeContext();

  const classes = ['privacy-value', className].filter(Boolean).join(' ');

  if (!hidden) {
    return <span className={classes}>{children}</span>;
  }

  return (
    <span className={`${classes} privacy-value--hidden`}>
      <span className="privacy-value__mask" aria-hidden="true">
        ••••••
      </span>
      <span className="sr-only">Monetary value hidden</span>
    </span>
  );
}
