import { Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { DashboardData } from '../api/types';
import { formatMoney, formatSharePercent } from '../lib/format';
import './AllocationChart.css';

interface AllocationChartProps {
  data: DashboardData;
  currency: string;
}

interface TooltipPayloadItem {
  name?: string;
  value?: number;
  payload?: {
    percent: number;
    color: string;
  };
}

function AllocationTooltip({
  active,
  payload,
  currency,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  currency: string;
}) {
  const item = payload?.[0];
  if (!active || !item?.name || item.value === undefined || !item.payload) {
    return null;
  }

  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__date">{item.name}</p>
      <p className="chart-tooltip__value">
        {formatMoney(item.value, currency)}
        <span className="allocation-tooltip__percent">
          {formatSharePercent(item.payload.percent)}
        </span>
      </p>
    </div>
  );
}

function AllocationLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
  name,
}: {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  percent?: number;
  name?: string;
}) {
  if (
    cx === undefined ||
    cy === undefined ||
    midAngle === undefined ||
    innerRadius === undefined ||
    outerRadius === undefined ||
    percent === undefined ||
    !name
  ) {
    return null;
  }

  // Hide tiny slices to avoid clutter; legend still lists every category.
  if (percent < 0.08) {
    return null;
  }

  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
  const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));

  return (
    <text
      x={x}
      y={y}
      fill="var(--chart-label)"
      textAnchor="middle"
      dominantBaseline="central"
      className="allocation-chart__slice-label"
    >
      {formatSharePercent(percent * 100)}
    </text>
  );
}

export function AllocationChart({ data, currency }: AllocationChartProps) {
  const slices = data.latestAllocation
    .filter((item) => item.amountCents > 0)
    .map((item) => ({
      ...item,
      fill: item.color,
    }));

  const centerTotal = data.currentTotalCents;

  return (
    <section className="allocation-chart" aria-label="Current allocation">
      <div className="allocation-chart__header">
        <h2 className="allocation-chart__title">Current allocation</h2>
        <p className="allocation-chart__subtitle">Latest snapshot mix</p>
      </div>

      {slices.length === 0 ? (
        <p className="allocation-chart__empty" role="status">
          No positive allocation in the latest snapshot.
        </p>
      ) : (
        <>
          <div className="allocation-chart__canvas">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="amountCents"
                  nameKey="name"
                  innerRadius="58%"
                  outerRadius="86%"
                  paddingAngle={2}
                  stroke="var(--card)"
                  strokeWidth={2}
                  label={AllocationLabel}
                  labelLine={false}
                />
                <Tooltip content={<AllocationTooltip currency={currency} />} />
                <text
                  x="50%"
                  y="46%"
                  textAnchor="middle"
                  className="allocation-chart__center-label"
                >
                  Total
                </text>
                <text
                  x="50%"
                  y="56%"
                  textAnchor="middle"
                  className="allocation-chart__center-value"
                >
                  {formatMoney(centerTotal, currency)}
                </text>
              </PieChart>
            </ResponsiveContainer>
          </div>

          <ul className="allocation-chart__legend">
            {data.latestAllocation.map((item) => (
              <li key={item.categoryId} className="allocation-chart__legend-item">
                <span
                  className="allocation-chart__swatch"
                  style={{ background: item.color }}
                  aria-hidden="true"
                />
                <span className="allocation-chart__legend-name">{item.name}</span>
                <span className="allocation-chart__legend-meta">
                  <span className="allocation-chart__legend-money">
                    {formatMoney(item.amountCents, currency)}
                  </span>
                  <span className="allocation-chart__legend-value">
                    {formatSharePercent(item.percent)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
