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
}

interface TooltipPayloadItem {
  value?: number;
  payload?: { date: string };
}

function ChartTooltip({
  active,
  payload,
  currency,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  currency: string;
}) {
  if (!active || !payload?.[0]?.payload?.date || payload[0].value === undefined) {
    return null;
  }

  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__date">
        {formatSnapshotDate(payload[0].payload.date)}
      </p>
      <p className="chart-tooltip__value">
        {formatMoney(payload[0].value, currency)}
      </p>
    </div>
  );
}

export function TotalValueChart({
  data,
  currency,
  range,
  onRangeChange,
}: TotalValueChartProps) {
  const points = data.timeSeries;

  return (
    <section className="total-chart" aria-label="Total value over time">
      <div className="total-chart__header">
        <div>
          <h2 className="total-chart__title">Total value</h2>
          <p className="total-chart__subtitle">Portfolio value across snapshots</p>
        </div>
        <RangeControls value={range} onChange={onRangeChange} />
      </div>

      <div className="total-chart__canvas">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={points}
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
              minTickGap={28}
              tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
              tickFormatter={(value: string, index: number) =>
                formatChartTick(value, index, points.length)
              }
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={72}
              tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
              tickFormatter={(value: number) =>
                formatCompactMoney(value, currency)
              }
            />
            <Tooltip
              content={<ChartTooltip currency={currency} />}
              cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
            />
            <Line
              type="monotone"
              dataKey="totalValueCents"
              stroke="var(--accent)"
              strokeWidth={2.5}
              dot={points.length <= 24}
              activeDot={{ r: 5, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
