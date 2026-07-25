import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { dashboardFixture } from '../test/fixtures';
import { TotalValueChart } from './TotalValueChart';

describe('TotalValueChart', () => {
  it('shows a useful message for a single-point range', () => {
    render(
      <TotalValueChart
        data={{
          ...dashboardFixture,
          timeSeries: [
            { date: '2026-03-01', totalValueCents: 12_000 },
          ],
          categoryTimeSeries: dashboardFixture.categoryTimeSeries.map(
            (series) => ({
              ...series,
              points: [{ date: '2026-03-01', amountCents: 3_000 }],
            }),
          ),
        }}
        currency="EUR"
        range="1m"
        onRangeChange={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/Only one snapshot is in this range/i),
    ).toBeInTheDocument();
  });

  it('shows an empty-range message instead of a broken chart', () => {
    render(
      <TotalValueChart
        data={{
          ...dashboardFixture,
          timeSeries: [],
          categoryTimeSeries: [],
          historyRows: [],
        }}
        currency="EUR"
        range="1m"
        onRangeChange={vi.fn()}
      />,
    );

    expect(
      screen.getByText('No snapshots in this range'),
    ).toBeInTheDocument();
  });

  it('toggles category visibility from the legend', async () => {
    const user = userEvent.setup();

    render(
      <TotalValueChart
        data={dashboardFixture}
        currency="EUR"
        range="3m"
        onRangeChange={vi.fn()}
      />,
    );

    const cryptoToggle = screen.getByRole('button', { name: 'Crypto' });
    expect(cryptoToggle).toHaveAttribute('aria-pressed', 'true');

    await user.click(cryptoToggle);
    expect(cryptoToggle).toHaveAttribute('aria-pressed', 'false');
  });
});
