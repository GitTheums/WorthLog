import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import {
  dashboardRequestUrls,
  expectSelectedDashboardRange,
} from './test/dashboard-range';
import {
  dashboardWithOldSnapshotFixture,
  emptyDashboardFixture,
  emptySelectedRangeDashboardFixture,
} from './test/fixtures';
import { mockApi } from './test/mock-api';

describe('App dashboard', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.dataset['theme'] = 'light';
  });

  it('renders live dashboard data from the API', async () => {
    mockApi();

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Worthlog' })).toBeInTheDocument();
    expect(screen.getByText('Personal investment history')).toBeInTheDocument();

    expect(await screen.findByText('Since previous')).toBeInTheDocument();
    expect(screen.getByText('Since first entry')).toBeInTheDocument();
    expect(screen.getByText('Last updated')).toBeInTheDocument();
    expect(screen.getAllByText('Total value').length).toBeGreaterThanOrEqual(1);

    expect(screen.getByRole('heading', { name: 'Current allocation' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'History' })).toBeInTheDocument();
    expect(screen.getAllByText('Crypto').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Latest')).toBeInTheDocument();

    expectSelectedDashboardRange('All');
    expect(dashboardRequestUrls()[0]).toContain('/api/dashboard?range=all');
  });

  it('shows an empty state when there are no snapshots', async () => {
    mockApi({ dashboard: emptyDashboardFixture });

    render(<App />);

    expect(
      await screen.findByRole('heading', { name: 'No snapshots yet' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add your first snapshot' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/tracks the total value of each investment category/i),
    ).toBeInTheDocument();
  });

  it('shows an error state when the API fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      if (url.includes('/api/auth/status')) {
        return Promise.resolve(
          Response.json({
            data: {
              pinEnabled: false,
              unlocked: true,
              sessionExpiresAt: null,
            },
          }),
        );
      }
      if (url.includes('/api/settings')) {
        return Promise.resolve(
          Response.json({
            data: { currency: 'EUR', defaultRange: 'all' },
          }),
        );
      }
      return Promise.resolve(
        Response.json(
          {
            error: {
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Dashboard unavailable',
            },
          },
          { status: 500 },
        ),
      );
    });

    render(<App />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Dashboard unavailable',
    );
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('opens the snapshot modal and settings dialog, and toggles theme', async () => {
    mockApi();
    const user = userEvent.setup();

    render(<App />);
    await screen.findByRole('heading', { name: 'History' });

    await user.click(screen.getByRole('button', { name: 'Add snapshot' }));
    const snapshotDialog = await screen.findByRole('dialog', {
      name: 'Add snapshot',
    });
    expect(snapshotDialog).toBeInTheDocument();
    expect(
      await within(snapshotDialog).findByLabelText('Snapshot date'),
    ).toBeInTheDocument();
    await user.click(
      within(snapshotDialog).getByRole('button', {
        name: 'Close snapshot dialog',
      }),
    );

    await user.click(screen.getByRole('button', { name: 'Open settings' }));
    const settingsDialog = screen.getByRole('dialog', { name: 'Settings' });
    expect(settingsDialog).toBeInTheDocument();
    expect(
      within(settingsDialog).getByRole('tab', { name: 'Categories' }),
    ).toBeInTheDocument();
    expect(
      within(settingsDialog).getByRole('tab', { name: 'General' }),
    ).toBeInTheDocument();
    expect(
      within(settingsDialog).getByRole('tab', { name: 'Security' }),
    ).toBeInTheDocument();
    expect(
      within(settingsDialog).getByRole('tab', { name: 'Backup and restore' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }));
    await waitFor(() => {
      expect(document.documentElement.dataset['theme']).toBe('dark');
      expect(window.localStorage.getItem('worthlog-theme')).toBe('dark');
    });
  });

  it('changes dashboard range from the chart controls', async () => {
    mockApi();
    const user = userEvent.setup();

    render(<App />);
    await screen.findByRole('heading', { name: 'History' });
    expectSelectedDashboardRange('All');

    await user.click(screen.getByRole('button', { name: '1M' }));
    await waitFor(() => {
      expect(dashboardRequestUrls().some((url) => url.includes('range=1m'))).toBe(
        true,
      );
    });
    expectSelectedDashboardRange('1M');

    await user.click(screen.getByRole('button', { name: '3M' }));
    await waitFor(() => {
      expect(dashboardRequestUrls().some((url) => url.includes('range=3m'))).toBe(
        true,
      );
    });
    expectSelectedDashboardRange('3M');

    await user.click(screen.getByRole('button', { name: '1Y' }));
    await waitFor(() => {
      expect(dashboardRequestUrls().some((url) => url.includes('range=1y'))).toBe(
        true,
      );
    });
    expectSelectedDashboardRange('1Y');

    await user.click(screen.getByRole('button', { name: 'All' }));
    await waitFor(() => {
      expect(
        dashboardRequestUrls().filter((url) => url.includes('range=all')).length,
      ).toBeGreaterThan(1);
    });
    expectSelectedDashboardRange('All');
  });

  it('shows old snapshots immediately on a fresh All load', async () => {
    mockApi({
      dashboardsByRange: {
        all: dashboardWithOldSnapshotFixture,
        '1m': { ...emptySelectedRangeDashboardFixture, range: '1m' },
        '3m': { ...emptySelectedRangeDashboardFixture, range: '3m' },
        '1y': { ...emptySelectedRangeDashboardFixture, range: '1y' },
      },
    });
    const user = userEvent.setup();

    render(<App />);
    await screen.findByRole('heading', { name: 'History' });

    expect(dashboardRequestUrls()[0]).toContain('/api/dashboard?range=all');
    expectSelectedDashboardRange('All');
    expect(screen.getByText('15 Jun 2024')).toBeInTheDocument();
    expect(screen.getByText('Older snapshot')).toBeInTheDocument();
    expect(screen.getAllByText('1 Mar 2026').length).toBeGreaterThan(0);
    expect(
      screen.queryByText('No snapshots in this range'),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '1M' }));
    expect(
      await screen.findByText('No snapshots in this range'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('No snapshots fall inside the selected range.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('15 Jun 2024')).not.toBeInTheDocument();
  });

  it('resets a manually selected 1M range back to All after reload', async () => {
    mockApi();
    const user = userEvent.setup();

    const { unmount } = render(<App />);
    await screen.findByRole('heading', { name: 'History' });
    await user.click(screen.getByRole('button', { name: '1M' }));
    await waitFor(() => {
      expectSelectedDashboardRange('1M');
    });

    unmount();
    render(<App />);
    await screen.findByRole('heading', { name: 'History' });

    expectSelectedDashboardRange('All');
    const urlsAfterReload = dashboardRequestUrls().filter((url) =>
      url.includes('/api/dashboard?range='),
    );
    expect(urlsAfterReload.at(-1)).toContain('range=all');
  });

  it('ignores a stored defaultRange setting on startup', async () => {
    mockApi({
      settings: { currency: 'EUR', defaultRange: '1m' },
    });

    render(<App />);
    await screen.findByRole('heading', { name: 'History' });

    expectSelectedDashboardRange('All');
    expect(dashboardRequestUrls()[0]).toContain('/api/dashboard?range=all');
  });

  it('does not modify portfolio data when switching ranges', async () => {
    const puts: string[] = [];
    const deletes: string[] = [];
    mockApi({
      onPut: (date) => {
        puts.push(date);
      },
      onDelete: (date) => {
        deletes.push(date);
      },
    });
    const user = userEvent.setup();

    render(<App />);
    await screen.findByRole('heading', { name: 'History' });

    await user.click(screen.getByRole('button', { name: '1M' }));
    await user.click(screen.getByRole('button', { name: '3M' }));
    await user.click(screen.getByRole('button', { name: '1Y' }));
    await user.click(screen.getByRole('button', { name: 'All' }));

    await waitFor(() => {
      expectSelectedDashboardRange('All');
    });

    expect(puts).toEqual([]);
    expect(deletes).toEqual([]);
    const mutatingSnapshotCalls = vi
      .mocked(globalThis.fetch)
      .mock.calls.filter(([input, init]) => {
        const url = typeof input === 'string' ? input : '';
        const method = (init?.method ?? 'GET').toUpperCase();
        return (
          url.includes('/api/snapshots') &&
          (method === 'PUT' || method === 'DELETE' || method === 'POST')
        );
      });
    expect(mutatingSnapshotCalls).toHaveLength(0);
  });
});
