import type { DashboardData } from '../api/types';
import { formatMoney, formatSharePercent } from '../lib/format';
import { getCategoryIcon } from '../lib/icons';
import { PrivacyValue } from './PrivacyValue';
import './CategoryCards.css';

interface CategoryCardsProps {
  data: DashboardData;
  currency: string;
}

export function CategoryCards({ data, currency }: CategoryCardsProps) {
  if (data.latestCategoryValues.length === 0) {
    return null;
  }

  const total = data.currentTotalCents;

  return (
    <section className="category-cards" aria-label="Category values">
      {data.latestCategoryValues.map((category) => {
        const Icon = getCategoryIcon(category.icon);
        const share =
          total === 0 ? 0 : (category.amountCents / total) * 100;

        return (
          <article key={category.categoryId} className="category-card">
            <div className="category-card__top">
              <span
                className="category-card__icon"
                style={{
                  color: category.color,
                  background: `${category.color}1f`,
                }}
                aria-hidden="true"
              >
                <Icon size={18} strokeWidth={1.8} />
              </span>
              <h2 className="category-card__name">{category.name}</h2>
            </div>
            <p className="category-card__value">
              <PrivacyValue>
                {formatMoney(category.amountCents, currency)}
              </PrivacyValue>
            </p>
            <div className="category-card__meta">
              <div
                className="category-card__bar"
                role="meter"
                aria-label={`${category.name} share of portfolio`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(share)}
              >
                <span
                  className="category-card__bar-fill"
                  style={{
                    width: `${String(Math.min(Math.max(share, 0), 100))}%`,
                    background: category.color,
                  }}
                />
              </div>
              <span className="category-card__share">
                {formatSharePercent(share)}
              </span>
            </div>
          </article>
        );
      })}
    </section>
  );
}
