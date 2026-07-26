import './BrandMark.css';

interface BrandMarkProps {
  className?: string;
}

/** Compact Worthlog mark — three ascending bars (matches favicon). */
export function BrandMark({ className }: BrandMarkProps) {
  const classes = ['brand-mark', className].filter(Boolean).join(' ');

  return (
    <span className={classes} aria-hidden="true">
      <span className="brand-mark__bar" />
      <span className="brand-mark__bar brand-mark__bar--mid" />
      <span className="brand-mark__bar brand-mark__bar--tall" />
    </span>
  );
}
