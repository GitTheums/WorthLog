import { changeTone, formatPercent, formatSignedMoney } from '../lib/format';
import './ChangeValue.css';

interface ChangeValueProps {
  amountCents: number | null;
  percent?: number | null;
  currency: string;
}

export function ChangeValue({
  amountCents,
  percent = null,
  currency,
}: ChangeValueProps) {
  const tone = changeTone(amountCents);

  if (amountCents === null) {
    return <span className="change-value change-value--neutral">—</span>;
  }

  return (
    <span className={`change-value change-value--${tone}`}>
      <span>{formatSignedMoney(amountCents, currency)}</span>
      {percent !== null ? (
        <span className="change-value__percent">{formatPercent(percent)}</span>
      ) : null}
    </span>
  );
}
