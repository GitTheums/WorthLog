import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { dashboardFixture, emptyDashboardFixture } from '../test/fixtures';
import { renderWithProviders } from '../test/render';
import { SummaryCards } from './SummaryCards';

describe('SummaryCards', () => {
  it('renders change and since-first percentages from API fields', () => {
    renderWithProviders(<SummaryCards data={dashboardFixture} currency="EUR" />);

    expect(screen.getByText('Total value')).toBeInTheDocument();
    expect(screen.getByText('€120.00')).toBeInTheDocument();
    expect(screen.getByText('+€40.00')).toBeInTheDocument();
    expect(screen.getAllByText('+50%').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('+€80.00')).toBeInTheDocument();
    expect(screen.getByText('+200%')).toBeInTheDocument();
  });

  it('shows em dashes when the selected range has no points', () => {
    renderWithProviders(
      <SummaryCards
        data={{
          ...emptyDashboardFixture,
          hasSnapshots: true,
          firstTotalCents: 4_000,
        }}
        currency="EUR"
      />,
    );

    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3);
  });

  it('does not invent Infinity when percent fields are null', () => {
    renderWithProviders(
      <SummaryCards
        data={{
          ...dashboardFixture,
          previousTotalCents: 0,
          changeCents: 1_000,
          changePercent: null,
          firstTotalCents: 0,
          changeSinceFirstCents: 1_000,
          changeSinceFirstPercent: null,
        }}
        currency="EUR"
      />,
    );

    expect(screen.queryByText(/Infinity/i)).not.toBeInTheDocument();
    expect(screen.getAllByText('+€10.00').length).toBe(2);
  });
});
