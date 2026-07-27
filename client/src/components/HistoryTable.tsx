import { Pencil, Trash2 } from 'lucide-react';
import type { DashboardData } from '../api/types';
import { useIsMobileLayout } from '../hooks/useMediaQuery';
import {
  formatMoney,
  formatSnapshotDate,
  percentChange,
} from '../lib/format';
import { ChangeValue } from './ChangeValue';
import { PrivacyValue } from './PrivacyValue';
import './HistoryTable.css';

interface HistoryTableProps {
  data: DashboardData;
  currency: string;
  onEdit: (date: string, trigger: HTMLElement) => void;
  onDelete: (date: string, totalValueCents: number, trigger: HTMLElement) => void;
}

export function HistoryTable({
  data,
  currency,
  onEdit,
  onDelete,
}: HistoryTableProps) {
  const isMobile = useIsMobileLayout();

  const categoryMeta = new Map<
    string,
    { name: string; color: string }
  >();

  for (const category of data.latestCategoryValues) {
    categoryMeta.set(category.categoryId, {
      name: category.name,
      color: category.color,
    });
  }

  for (const series of data.categoryTimeSeries) {
    if (!categoryMeta.has(series.categoryId)) {
      categoryMeta.set(series.categoryId, {
        name: series.name,
        color: series.color,
      });
    }
  }

  // Canonical order from the newest complete-portfolio snapshot.
  const categoryIds =
    data.categoryDisplayOrder.length > 0
      ? [...data.categoryDisplayOrder]
      : [
          ...data.categoryTimeSeries.map((series) => series.categoryId),
          ...data.latestCategoryValues
            .map((category) => category.categoryId)
            .filter(
              (id) =>
                !data.categoryTimeSeries.some(
                  (series) => series.categoryId === id,
                ),
            ),
        ];

  if (data.historyRows.length === 0) {
    return (
      <section className="history-table" aria-label="Snapshot history">
        <div className="history-table__header">
          <div>
            <h2 className="history-table__title">History</h2>
            <p className="history-table__subtitle">
              Snapshot totals and category values
            </p>
          </div>
        </div>
        <p className="history-table__empty" role="status">
          No snapshots fall inside the selected range.
        </p>
      </section>
    );
  }

  return (
    <section className="history-table" aria-label="Snapshot history">
      <div className="history-table__header">
        <div>
          <h2 className="history-table__title">History</h2>
          <p className="history-table__subtitle">
            Newest first · missing category values shown as{' '}
            <PrivacyValue>{formatMoney(0, currency)}</PrivacyValue>
          </p>
        </div>
      </div>

      {isMobile ? (
        <ul className="history-cards">
          {data.historyRows.map((row, index) => {
            const previous = data.historyRows[index + 1];
            const changeCents =
              previous === undefined
                ? null
                : row.totalValueCents - previous.totalValueCents;
            const changePct =
              previous === undefined
                ? null
                : percentChange(row.totalValueCents, previous.totalValueCents);

            return (
              <li key={row.date} className="history-card">
                <div className="history-card__top">
                  <h3 className="history-card__date">
                    {formatSnapshotDate(row.date)}
                  </h3>
                  <p className="history-card__total">
                    <PrivacyValue>
                      {formatMoney(row.totalValueCents, currency)}
                    </PrivacyValue>
                  </p>
                </div>

                <div className="history-card__change">
                  {changeCents === null ? (
                    <span className="history-card__change-empty">
                      First in range
                    </span>
                  ) : (
                    <ChangeValue
                      amountCents={changeCents}
                      percent={changePct}
                      currency={currency}
                    />
                  )}
                </div>

                {row.note ? (
                  <p className="history-card__note">{row.note}</p>
                ) : null}

                {categoryIds.length > 0 ? (
                  <ul className="history-card__categories">
                    {categoryIds.map((categoryId) => {
                      const amount =
                        row.values.find(
                          (value) => value.categoryId === categoryId,
                        )?.amountCents ?? 0;
                      return (
                        <li
                          key={`${row.date}-${categoryId}`}
                          className="history-card__category"
                        >
                          <span className="history-card__category-name">
                            <span
                              className="history-table__swatch"
                              style={{
                                background:
                                  categoryMeta.get(categoryId)?.color,
                              }}
                              aria-hidden="true"
                            />
                            {categoryMeta.get(categoryId)?.name ?? categoryId}
                          </span>
                          <span
                            className={
                              amount === 0
                                ? 'history-card__category-value history-table__zero'
                                : 'history-card__category-value'
                            }
                          >
                            <PrivacyValue>
                              {formatMoney(amount, currency)}
                            </PrivacyValue>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}

                <div className="history-card__actions">
                  <button
                    type="button"
                    className="history-table__action"
                    aria-label={`Edit snapshot for ${formatSnapshotDate(row.date)}`}
                    onClick={(event) => {
                      onEdit(row.date, event.currentTarget);
                    }}
                  >
                    <Pencil size={15} strokeWidth={1.8} aria-hidden="true" />
                    Edit
                  </button>
                  <button
                    type="button"
                    className="history-table__action history-table__action--danger"
                    aria-label={`Delete snapshot for ${formatSnapshotDate(row.date)}`}
                    onClick={(event) => {
                      onDelete(
                        row.date,
                        row.totalValueCents,
                        event.currentTarget,
                      );
                    }}
                  >
                    <Trash2 size={15} strokeWidth={1.8} aria-hidden="true" />
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="history-table__scroll" tabIndex={0}>
          <table>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Total</th>
                {categoryIds.map((categoryId) => (
                  <th key={categoryId} scope="col">
                    <span className="history-table__category-head">
                      <span
                        className="history-table__swatch"
                        style={{
                          background: categoryMeta.get(categoryId)?.color,
                        }}
                        aria-hidden="true"
                      />
                      {categoryMeta.get(categoryId)?.name}
                    </span>
                  </th>
                ))}
                <th scope="col">Note</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.historyRows.map((row) => {
                const valuesByCategory = new Map(
                  row.values.map((value) => [value.categoryId, value.amountCents]),
                );

                return (
                  <tr key={row.date}>
                    <th scope="row">{formatSnapshotDate(row.date)}</th>
                    <td className="history-table__total">
                      <PrivacyValue>
                        {formatMoney(row.totalValueCents, currency)}
                      </PrivacyValue>
                    </td>
                    {categoryIds.map((categoryId) => {
                      const amount = valuesByCategory.get(categoryId) ?? 0;
                      return (
                        <td
                          key={`${row.date}-${categoryId}`}
                          className={
                            amount === 0
                              ? 'history-table__zero'
                              : undefined
                          }
                        >
                          <PrivacyValue>
                            {formatMoney(amount, currency)}
                          </PrivacyValue>
                        </td>
                      );
                    })}
                    <td className="history-table__note">{row.note ?? '—'}</td>
                    <td className="history-table__actions">
                      <button
                        type="button"
                        className="history-table__action"
                        aria-label={`Edit snapshot for ${formatSnapshotDate(row.date)}`}
                        onClick={(event) => {
                          onEdit(row.date, event.currentTarget);
                        }}
                      >
                        <Pencil size={15} strokeWidth={1.8} aria-hidden="true" />
                        Edit
                      </button>
                      <button
                        type="button"
                        className="history-table__action history-table__action--danger"
                        aria-label={`Delete snapshot for ${formatSnapshotDate(row.date)}`}
                        onClick={(event) => {
                          onDelete(
                            row.date,
                            row.totalValueCents,
                            event.currentTarget,
                          );
                        }}
                      >
                        <Trash2 size={15} strokeWidth={1.8} aria-hidden="true" />
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
