import type { DashboardData } from '../api/types';
import { formatMoney } from '../lib/format';
import { getCategoryIcon } from '../lib/icons';
import './CategoryCards.css';

interface CategoryCardsProps {
  data: DashboardData;
  currency: string;
}

export function CategoryCards({ data, currency }: CategoryCardsProps) {
  if (data.latestCategoryValues.length === 0) {
    return null;
  }

  const total = data.currentTotalCents || 1;

  return (
    <section className="category-cards" aria-label="Category values">
      {data.latestCategoryValues.map((category) => {
        const Icon = getCategoryIcon(category.icon);
        const share = (category.amountCents / total) * 100;

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
              {formatMoney(category.amountCents, currency)}
            </p>
            <div className="category-card__meta">
              <div className="category-card__bar" aria-hidden="true">
                <span
                  className="category-card__bar-fill"
                  style={{
                    width: `${String(Math.min(share, 100))}%`,
                    background: category.color,
                  }}
                />
              </div>
              <span className="category-card__share">
                {share.toFixed(1)}%
              </span>
            </div>
          </article>
        );
      })}
    </section>
  );
}
