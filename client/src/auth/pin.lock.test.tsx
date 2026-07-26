import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { mockApi } from '../test/mock-api';
import { setViewportWidth } from '../test/viewport';

describe('PIN lock frontend', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.dataset['theme'] = 'light';
    vi.restoreAllMocks();
    setViewportWidth(1280);
  });

  it('checks auth status before dashboard data', async () => {
    mockApi();
    render(<App />);

    await screen.findByRole('heading', { name: 'History' });

    const urls = vi.mocked(globalThis.fetch).mock.calls.map((call) => {
      const input = call[0];
      if (typeof input === 'string') {
        return input;
      }
      if (input instanceof URL) {
        return input.toString();
      }
      return input.url;
    });
    const authIndex = urls.findIndex((url) => url.includes('/api/auth/status'));
    const dashboardIndex = urls.findIndex((url) =>
      url.includes('/api/dashboard'),
    );
    expect(authIndex).toBeGreaterThanOrEqual(0);
    expect(dashboardIndex).toBeGreaterThan(authIndex);
  });

  it('shows the lock screen without private dashboard flash when locked', async () => {
    mockApi({
      authStatus: {
        pinEnabled: true,
        unlocked: false,
        sessionExpiresAt: null,
      },
      configuredPin: '1234',
    });

    render(<App />);

    expect(
      await screen.findByRole('heading', { name: 'Portfolio locked' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Enter your PIN to continue.')).toBeInTheDocument();
    expect(screen.queryByText('Since previous')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'History' })).not.toBeInTheDocument();

    const urls = vi.mocked(globalThis.fetch).mock.calls.map((call) => {
      const input = call[0];
      if (typeof input === 'string') {
        return input;
      }
      if (input instanceof URL) {
        return input.toString();
      }
      return input.url;
    });
    expect(urls.some((url) => url.includes('/api/dashboard'))).toBe(false);
    expect(urls.some((url) => url.includes('/api/settings'))).toBe(false);
  });

  it('unlocks with the correct PIN and rejects an incorrect PIN', async () => {
    mockApi({
      authStatus: {
        pinEnabled: true,
        unlocked: false,
        sessionExpiresAt: null,
      },
      configuredPin: '1234',
    });
    const user = userEvent.setup();

    render(<App />);
    await screen.findByRole('heading', { name: 'Portfolio locked' });

    await user.type(screen.getByLabelText('PIN'), '9999');
    await user.click(screen.getByRole('button', { name: 'Unlock' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That PIN is incorrect.',
    );
    expect(screen.getByLabelText('PIN')).toHaveValue('');

    await user.type(screen.getByLabelText('PIN'), '1234');
    await user.click(screen.getByRole('button', { name: 'Unlock' }));
    expect(await screen.findByRole('heading', { name: 'History' })).toBeInTheDocument();
  });

  it('submits the PIN with Enter', async () => {
    mockApi({
      authStatus: {
        pinEnabled: true,
        unlocked: false,
        sessionExpiresAt: null,
      },
      configuredPin: '4321',
    });
    const user = userEvent.setup();

    render(<App />);
    await screen.findByRole('heading', { name: 'Portfolio locked' });
    await user.type(screen.getByLabelText('PIN'), '4321{Enter}');
    expect(await screen.findByRole('heading', { name: 'History' })).toBeInTheDocument();
  });

  it('shows a rate-limit countdown message', async () => {
    mockApi({
      authStatus: {
        pinEnabled: true,
        unlocked: false,
        sessionExpiresAt: null,
      },
      configuredPin: '1234',
      unlockFailuresBeforeBlock: 1,
    });
    const user = userEvent.setup();

    render(<App />);
    await screen.findByRole('heading', { name: 'Portfolio locked' });
    await user.type(screen.getByLabelText('PIN'), '0000');
    await user.click(screen.getByRole('button', { name: 'Unlock' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Too many attempts\. Try again in \d+ seconds\./,
    );
  });

  it('enables a PIN from Settings with matching confirmation', async () => {
    const setupPins: string[] = [];
    mockApi({
      onAuthSetup: (pin) => {
        setupPins.push(pin);
      },
    });
    const user = userEvent.setup();

    render(<App />);
    await screen.findByRole('heading', { name: 'History' });
    await user.click(screen.getByRole('button', { name: 'Open settings' }));
    const dialog = await screen.findByRole('dialog', { name: 'Settings' });
    await user.click(within(dialog).getByRole('tab', { name: 'Security' }));

    await user.type(within(dialog).getByLabelText('New PIN'), '2468');
    await user.type(within(dialog).getByLabelText('Confirm PIN'), '1357');
    await user.click(within(dialog).getByRole('button', { name: 'Enable PIN' }));
    expect(
      await within(dialog).findByText('PIN confirmation does not match.'),
    ).toBeInTheDocument();
    expect(setupPins).toHaveLength(0);

    await user.clear(within(dialog).getByLabelText('Confirm PIN'));
    await user.type(within(dialog).getByLabelText('Confirm PIN'), '2468');
    await user.click(within(dialog).getByRole('button', { name: 'Enable PIN' }));
    expect(
      await within(dialog).findByText('PIN protection is enabled'),
    ).toBeInTheDocument();
    expect(setupPins).toEqual(['2468']);
    expect(
      screen.getByRole('button', { name: 'Lock WorthLog' }),
    ).toBeInTheDocument();
  });

  it('shows the header lock button only when PIN is enabled', async () => {
    mockApi();
    render(<App />);
    await screen.findByRole('heading', { name: 'History' });
    expect(
      screen.queryByRole('button', { name: 'Lock WorthLog' }),
    ).not.toBeInTheDocument();
  });

  it('locks now from Settings and returns to the lock screen', async () => {
    mockApi({
      authStatus: {
        pinEnabled: true,
        unlocked: true,
        sessionExpiresAt: '2099-01-01T00:00:00.000Z',
      },
      configuredPin: '1234',
    });
    const user = userEvent.setup();

    render(<App />);
    await screen.findByRole('heading', { name: 'History' });
    await user.click(screen.getByRole('button', { name: 'Open settings' }));
    const dialog = await screen.findByRole('dialog', { name: 'Settings' });
    await user.click(within(dialog).getByRole('tab', { name: 'Security' }));
    await user.click(within(dialog).getByRole('button', { name: 'Lock now' }));

    expect(
      await screen.findByRole('heading', { name: 'Portfolio locked' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'History' })).not.toBeInTheDocument();
  });

  it('changes and removes a PIN without deleting portfolio data', async () => {
    mockApi({
      authStatus: {
        pinEnabled: true,
        unlocked: true,
        sessionExpiresAt: '2099-01-01T00:00:00.000Z',
      },
      configuredPin: '1234',
    });
    const user = userEvent.setup();

    render(<App />);
    await screen.findByRole('heading', { name: 'History' });
    await user.click(screen.getByRole('button', { name: 'Open settings' }));
    const dialog = await screen.findByRole('dialog', { name: 'Settings' });
    await user.click(within(dialog).getByRole('tab', { name: 'Security' }));

    await user.click(within(dialog).getByRole('button', { name: 'Change PIN' }));
    await user.type(within(dialog).getByLabelText('Current PIN'), '1234');
    await user.type(within(dialog).getByLabelText('New PIN'), '5678');
    await user.type(within(dialog).getByLabelText('Confirm new PIN'), '5678');
    await user.click(within(dialog).getByRole('button', { name: 'Update PIN' }));
    expect(await screen.findByText('PIN updated')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Remove PIN' }));
    await user.type(within(dialog).getByLabelText('Current PIN'), '5678');
    const removeSubmit = within(dialog)
      .getAllByRole('button', { name: 'Remove PIN' })
      .find((button) => button.getAttribute('type') === 'submit');
    if (!removeSubmit) {
      throw new Error('Expected Remove PIN submit button');
    }
    await user.click(removeSubmit);
    expect(
      await within(dialog).findByRole('button', { name: 'Enable PIN' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'History' })).toBeInTheDocument();
  });

  it('keeps theme and privacy mode after locking', async () => {
    mockApi({
      authStatus: {
        pinEnabled: true,
        unlocked: true,
        sessionExpiresAt: '2099-01-01T00:00:00.000Z',
      },
      configuredPin: '1234',
    });
    const user = userEvent.setup();

    render(<App />);
    await screen.findByRole('heading', { name: 'History' });
    await user.click(
      screen.getByRole('button', { name: 'Switch to dark theme' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Hide monetary values' }),
    );
    await waitFor(() => {
      expect(document.documentElement.dataset['theme']).toBe('dark');
      expect(window.localStorage.getItem('worthlog-theme')).toBe('dark');
      expect(window.localStorage.getItem('worthlog-privacy-mode')).toBe('hidden');
    });

    await user.click(screen.getByRole('button', { name: 'Lock WorthLog' }));
    expect(
      await screen.findByRole('heading', { name: 'Portfolio locked' }),
    ).toBeInTheDocument();
    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(window.localStorage.getItem('worthlog-theme')).toBe('dark');
    expect(window.localStorage.getItem('worthlog-privacy-mode')).toBe('hidden');
    expect(window.localStorage.getItem('worthlog_session')).toBeNull();
    expect(window.sessionStorage.length).toBe(0);
  });

  it('works on 320px and 375px viewports', async () => {
    for (const width of [320, 375]) {
      setViewportWidth(width);
      mockApi({
        authStatus: {
          pinEnabled: true,
          unlocked: false,
          sessionExpiresAt: null,
        },
        configuredPin: '1234',
      });

      const { unmount } = render(<App />);
      expect(
        await screen.findByRole('heading', { name: 'Portfolio locked' }),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Unlock' })).toBeVisible();
      unmount();
      vi.restoreAllMocks();
    }
  });

  it('returns to the lock screen when a later API call returns PORTFOLIO_LOCKED', async () => {
    mockApi({
      authStatus: {
        pinEnabled: true,
        unlocked: true,
        sessionExpiresAt: '2099-01-01T00:00:00.000Z',
      },
      configuredPin: '1234',
    });
    const user = userEvent.setup();

    render(<App />);
    await screen.findByRole('heading', { name: 'History' });

    const previous = vi.mocked(globalThis.fetch).getMockImplementation();
    vi.mocked(globalThis.fetch).mockImplementation((input, init) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      if (url.includes('/api/dashboard')) {
        return Promise.resolve(
          Response.json(
            {
              error: {
                code: 'PORTFOLIO_LOCKED',
                message: 'WorthLog is locked.',
              },
            },
            { status: 401 },
          ),
        );
      }
      return previous
        ? previous(input, init)
        : Promise.resolve(new Response('Not found', { status: 404 }));
    });

    await user.click(screen.getByRole('button', { name: '1Y' }));

    expect(
      await screen.findByRole('heading', { name: 'Portfolio locked' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'History' })).not.toBeInTheDocument();
  });
});
