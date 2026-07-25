import type { DashboardData } from '../api/types';
import { formatMoney, formatSnapshotDate } from '../lib/format';
import './HistoryTable.css';

interface HistoryTableProps {
  data: DashboardData;
  currency: string;
}

export function HistoryTable({ data, currency }: HistoryTableProps) {
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
