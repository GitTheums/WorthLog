import { Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { DashboardData } from '../api/types';
import { formatMoney, formatSharePercent } from '../lib/format';
import { usePrivacyModeContext } from '../privacy/usePrivacyModeContext';
import { PrivacyValue } from './PrivacyValue';
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
  privacyHidden,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  currency: string;
  privacyHidden: boolean;
}) {
  const item = payload?.[0];
  if (!active || !item?.name || item.value === undefined || !item.payload) {
    return null;
  }

  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__date">{item.name}</p>
      <p className="chart-tooltip__value">
        {privacyHidden ? (
          'Value hidden'
        ) : (
          formatMoney(item.value, currency)
        )}
        <span className="allocation-tooltip__percent">
          {formatSharePercent(item.payload.percent)}
        </span>
      </p>
    </div>
  );
}

export function AllocationChart({ data, currency }: AllocationChartProps) {
  const { hidden: privacyHidden } = usePrivacyModeContext();
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
                />
                <Tooltip
                  allowEscapeViewBox={{ x: true, y: true }}
                  content={
                    <AllocationTooltip
                      currency={currency}
                      privacyHidden={privacyHidden}
                    />
                  }
                />
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
                  {privacyHidden
                    ? '••••••'
                    : formatMoney(centerTotal, currency)}
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
                    <PrivacyValue>
                      {formatMoney(item.amountCents, currency)}
                    </PrivacyValue>
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
