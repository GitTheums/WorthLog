import { CalendarDays, Layers, TrendingUp, Wallet } from 'lucide-react';
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
        <div className="summary-card__top">
          <span className="summary-card__icon" aria-hidden="true">
            <Wallet size={15} strokeWidth={1.8} />
          </span>
          <h2 className="summary-card__label">Total value</h2>
        </div>
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
        <div className="summary-card__top">
          <span className="summary-card__icon" aria-hidden="true">
            <TrendingUp size={15} strokeWidth={1.8} />
          </span>
          <h2 className="summary-card__label">Since previous</h2>
        </div>
        <p className="summary-card__value summary-card__value--compact">
          <ChangeValue
            amountCents={data.changeCents}
            percent={data.changePercent}
            currency={currency}
          />
        </p>
      </article>

      <article className="summary-card">
        <div className="summary-card__top">
          <span className="summary-card__icon" aria-hidden="true">
            <Layers size={15} strokeWidth={1.8} />
          </span>
          <h2 className="summary-card__label">Since first entry</h2>
        </div>
        <p className="summary-card__value summary-card__value--compact">
          <ChangeValue
            amountCents={data.changeSinceFirstCents}
            percent={data.changeSinceFirstPercent}
            currency={currency}
          />
        </p>
      </article>

      <article className="summary-card">
        <div className="summary-card__top">
          <span className="summary-card__icon" aria-hidden="true">
            <CalendarDays size={15} strokeWidth={1.8} />
          </span>
          <h2 className="summary-card__label">Last updated</h2>
        </div>
        <p className="summary-card__value summary-card__value--date">
          {data.latestDate ? formatSnapshotDate(data.latestDate) : '—'}
        </p>
      </article>
    </section>
  );
}
