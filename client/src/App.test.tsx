import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { emptyDashboardFixture } from './test/fixtures';
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

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/dashboard?range=3m'),
      expect.any(Object),
    );
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
            data: { currency: 'EUR', defaultRange: '3m' },
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

    await user.click(screen.getByRole('button', { name: '1Y' }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/dashboard?range=1y'),
        expect.any(Object),
      );
    });
  });
});
