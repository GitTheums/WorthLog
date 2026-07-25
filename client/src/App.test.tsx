import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import {
  dashboardFixture,
  emptyDashboardFixture,
  settingsFixture,
} from './test/fixtures';

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
}

function mockApi(dashboard = dashboardFixture) {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url = requestUrl(input);

    if (url.includes('/api/settings')) {
      return Promise.resolve(Response.json({ data: settingsFixture }));
    }

    if (url.includes('/api/dashboard')) {
      return Promise.resolve(Response.json({ data: dashboard }));
    }

    return Promise.resolve(new Response('Not found', { status: 404 }));
  });
}

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
    mockApi(emptyDashboardFixture);

    render(<App />);

    expect(
      await screen.findByRole('heading', { name: 'No snapshots yet' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add your first snapshot' }),
    ).toBeInTheDocument();
  });

  it('shows an error state when the API fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = requestUrl(input);
      if (url.includes('/api/settings')) {
        return Promise.resolve(Response.json({ data: settingsFixture }));
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

  it('opens placeholder dialogs and toggles theme', async () => {
    mockApi();
    const user = userEvent.setup();

    render(<App />);
    await screen.findByRole('heading', { name: 'History' });

    await user.click(screen.getByRole('button', { name: 'Add snapshot' }));
    const snapshotDialog = screen.getByRole('dialog', { name: 'Add snapshot' });
    expect(snapshotDialog).toBeInTheDocument();
    await user.click(within(snapshotDialog).getByRole('button', { name: 'Close' }));

    await user.click(screen.getByRole('button', { name: 'Open settings' }));
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();

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
