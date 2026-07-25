import { Pencil, Trash2 } from 'lucide-react';
import type { DashboardData } from '../api/types';
import { formatMoney, formatSnapshotDate } from '../lib/format';
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
  const categoryNames = new Map(
    data.latestCategoryValues.map((category) => [
      category.categoryId,
      category.name,
    ]),
  );

  for (const series of data.categoryTimeSeries) {
    categoryNames.set(series.categoryId, series.name);
  }

  const categoryIds = [...categoryNames.keys()];

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

      <div className="history-table__scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Total</th>
              {categoryIds.map((categoryId) => (
                <th key={categoryId} scope="col">
                  {categoryNames.get(categoryId)}
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
                    {formatMoney(row.totalValueCents, currency)}
                  </td>
                  {categoryIds.map((categoryId) => (
                    <td key={`${row.date}-${categoryId}`}>
                      {formatMoney(valuesByCategory.get(categoryId) ?? 0, currency)}
                    </td>
                  ))}
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
                        onDelete(row.date, row.totalValueCents, event.currentTarget);
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
    </section>
  );
}
