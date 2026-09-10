import { screen, within } from '@testing-library/react';
import { expect, vi } from 'vitest';

const RANGE_LABELS = ['1M', '3M', '1Y', 'All'] as const;

export type DashboardRangeLabel = (typeof RANGE_LABELS)[number];

export function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
}

export function dashboardRequestUrls(): string[] {
  return vi
    .mocked(globalThis.fetch)
    .mock.calls.map((call) => requestUrl(call[0]))
    .filter((url) => url.includes('/api/dashboard'));
}

export function expectSelectedDashboardRange(label: DashboardRangeLabel): void {
  const group = screen.getByRole('group', { name: 'Dashboard date range' });
  for (const name of RANGE_LABELS) {
    expect(within(group).getByRole('button', { name })).toHaveAttribute(
      'aria-pressed',
      name === label ? 'true' : 'false',
    );
  }
}
