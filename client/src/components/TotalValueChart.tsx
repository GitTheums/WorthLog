import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DashboardData, DashboardRange } from '../api/types';
import {
  formatChartTick,
  formatCompactMoney,
  formatMoney,
  formatSnapshotDate,
} from '../lib/format';
import { RangeControls } from './RangeControls';
import './TotalValueChart.css';

interface TotalValueChartProps {
  data: DashboardData;
  currency: string;
  range: DashboardRange;
  onRangeChange: (range: DashboardRange) => void;
  refreshing?: boolean;
}

interface ChartRow {
  date: string;
  totalValueCents: number;
  [categoryId: string]: string | number;
}

interface TooltipPayloadItem {
  dataKey?: string | number;
  name?: string;
  value?: number;
  color?: string;
  payload?: ChartRow;
}

function ChartTooltip({
  active,
  payload,
  currency,
  categoryNames,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  currency: string;
  categoryNames: Map<string, string>;
}) {
  if (!active || !payload?.length || !payload[0]?.payload?.date) {
    return null;
  }

  const date = payload[0].payload.date;

  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__date">{formatSnapshotDate(date)}</p>
      <ul className="chart-tooltip__list">
        {payload.map((item) => {
          if (item.value === undefined || item.dataKey === undefined) {
            return null;
          }
          const key = String(item.dataKey);
          const label =
            key === 'totalValueCents'
              ? 'Total'
              : (categoryNames.get(key) ?? item.name ?? key);
          return (
            <li key={key} className="chart-tooltip__row">
              <span
                className="chart-tooltip__swatch"
                style={{ background: item.color ?? 'var(--accent)' }}
                aria-hidden="true"
              />
              <span className="chart-tooltip__label">{label}</span>
              <span className="chart-tooltip__value">
                {formatMoney(item.value, currency)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function TotalValueChart({
  data,
  currency,
  range,
  onRangeChange,
  refreshing = false,
}: TotalValueChartProps) {
  const points = data.timeSeries;
  const categories = data.categoryTimeSeries;
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(
    () => new Set(),
  );

  const categoryNames = useMemo(
    () =>
      new Map(categories.map((category) => [category.categoryId, category.name])),
    [categories],
  );

  const chartRows = useMemo<ChartRow[]>(() => {
    return points.map((point, index) => {
      const row: ChartRow = {
        date: point.date,
        totalValueCents: point.totalValueCents,
      };
      for (const category of categories) {
        row[category.categoryId] = category.points[index]?.amountCents ?? 0;
      }
      return row;
    });
  }, [points, categories]);

  const toggleCategory = (categoryId: string) => {
    setHiddenCategories((current) => {
      const next = new Set(current);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const singlePoint = points.length === 1;
  const emptyRange = points.length === 0;

  return (
    <section
      className={
        refreshing
          ? 'total-chart total-chart--refreshing'
          : 'total-chart'
      }
      aria-label="Total value over time"
      aria-busy={refreshing || undefined}
    >
      <div className="total-chart__header">
        <div>
          <h2 className="total-chart__title">Total value</h2>
          <p className="total-chart__subtitle">
            Portfolio value across snapshots
          </p>
        </div>
        <RangeControls value={range} onChange={onRangeChange} />
      </div>

      {emptyRange ? (
        <div className="total-chart__message" role="status">
          <p className="total-chart__message-title">No snapshots in this range</p>
          <p className="total-chart__message-body">
            Try a wider range such as 1Y or All to see your earlier history.
          </p>
        </div>
      ) : (
        <>
          {singlePoint ? (
            <p className="total-chart__notice" role="status">
              Only one snapshot is in this range, so a trend line cannot be drawn.
              The point below is your portfolio total for{' '}
              {formatSnapshotDate(points[0]?.date ?? '')}.
            </p>
          ) : null}

          <div className="total-chart__canvas">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartRows}
                margin={{ top: 12, right: 12, left: 0, bottom: 4 }}
              >
                <CartesianGrid
                  stroke="var(--chart-grid)"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={32}
                  interval="preserveStartEnd"
                  tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
                  tickFormatter={(value: string, index: number) =>
                    formatChartTick(value, index, points.length)
                  }
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={78}
                  tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
                  tickFormatter={(value: number) =>
                    formatCompactMoney(value, currency)
                  }
                />
                <Tooltip
                  content={
                    <ChartTooltip
                      currency={currency}
                      categoryNames={categoryNames}
                    />
                  }
                  cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
                />
                <Line
                  type="monotone"
                  dataKey="totalValueCents"
                  name="Total"
                  stroke="var(--accent)"
                  strokeWidth={2.5}
                  dot={points.length <= 24 || singlePoint}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                  isAnimationActive={!refreshing}
                />
                {categories.map((category) =>
                  hiddenCategories.has(category.categoryId) ? null : (
                    <Line
                      key={category.categoryId}
                      type="monotone"
                      dataKey={category.categoryId}
                      name={category.name}
                      stroke={category.color}
                      strokeWidth={1.75}
                      strokeOpacity={0.9}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0 }}
                      isAnimationActive={!refreshing}
                    />
                  ),
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {categories.length > 0 ? (
            <div
              className="total-chart__legend"
              role="group"
              aria-label="Category visibility"
            >
              {categories.map((category) => {
                const hidden = hiddenCategories.has(category.categoryId);
                return (
                  <button
                    key={category.categoryId}
                    type="button"
                    className={
                      hidden
                        ? 'total-chart__legend-button total-chart__legend-button--hidden'
                        : 'total-chart__legend-button'
                    }
                    aria-pressed={!hidden}
                    onClick={() => {
                      toggleCategory(category.categoryId);
                    }}
                  >
                    <span
                      className="total-chart__legend-swatch"
                      style={{ background: category.color }}
                      aria-hidden="true"
                    />
                    {category.name}
                  </button>
                );
              })}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
