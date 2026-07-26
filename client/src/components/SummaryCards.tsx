import type { DashboardData } from '../api/types';
import { formatMoney, formatSnapshotDate } from '../lib/format';
import { ChangeValue } from './ChangeValue';
import { PrivacyValue } from './PrivacyValue';
import './SummaryCards.css';

interface SummaryCardsProps {
  data: DashboardData;
  currency: string;
}

export function SummaryCards({ data, currency }: SummaryCardsProps) {
  const hasRangeData = data.timeSeries.length > 0;

  return (
    <section className="summary-cards" aria-label="Portfolio summary">
      <article className="summary-card">
        <h2 className="summary-card__label">Total value</h2>
        <p className="summary-card__value">
          {hasRangeData ? (
            <PrivacyValue>
              {formatMoney(data.currentTotalCents, currency)}
            </PrivacyValue>
          ) : (
            '—'
          )}
        </p>
      </article>

      <article className="summary-card">
        <h2 className="summary-card__label">Since previous</h2>
        <p className="summary-card__value summary-card__value--compact">
          <ChangeValue
            amountCents={data.changeCents}
            percent={data.changePercent}
            currency={currency}
          />
        </p>
      </article>

      <article className="summary-card">
        <h2 className="summary-card__label">Since first entry</h2>
        <p className="summary-card__value summary-card__value--compact">
          <ChangeValue
            amountCents={data.changeSinceFirstCents}
            percent={data.changeSinceFirstPercent}
            currency={currency}
          />
        </p>
      </article>

      <article className="summary-card">
        <h2 className="summary-card__label">Last updated</h2>
        <p className="summary-card__value summary-card__value--date">
          {data.latestDate ? formatSnapshotDate(data.latestDate) : '—'}
        </p>
      </article>
    </section>
  );
}
