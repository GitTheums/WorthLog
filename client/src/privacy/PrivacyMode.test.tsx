import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { HistoryTable } from '../components/HistoryTable';
import { SummaryCards } from '../components/SummaryCards';
import { TotalValueChart } from '../components/TotalValueChart';
import { PRIVACY_STORAGE_KEY } from '../lib/privacy';
import { dashboardFixture } from '../test/fixtures';
import { mockApi } from '../test/mock-api';
import { renderWithProviders } from '../test/render';
import { setViewportWidth } from '../test/viewport';

describe('privacy mode', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.dataset['theme'] = 'light';
    delete document.documentElement.dataset['privacy'];
    setViewportWidth(1440);
  });

  it('defaults to visible monetary values', async () => {
    mockApi();
    render(<App />);
    await screen.findByRole('heading', { name: 'History' });

    expect(screen.getAllByText('€120.00').length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByRole('button', { name: 'Hide monetary values' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('hides monetary values while keeping percentages visible', async () => {
    mockApi();
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'History' });

    await user.click(
      screen.getByRole('button', { name: 'Hide monetary values' }),
    );

    expect(screen.queryByText('€120.00')).not.toBeInTheDocument();
    expect(screen.getAllByText('Monetary value hidden').length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByText('+50%').length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByRole('button', { name: 'Show monetary values' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(window.localStorage.getItem(PRIVACY_STORAGE_KEY)).toBe('hidden');
  });

  it('restores values when privacy mode is turned off', async () => {
    mockApi();
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'History' });

    await user.click(
      screen.getByRole('button', { name: 'Hide monetary values' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Show monetary values' }),
    );

    expect(screen.getAllByText('€120.00').length).toBeGreaterThanOrEqual(1);
    expect(window.localStorage.getItem(PRIVACY_STORAGE_KEY)).toBe('visible');
  });

  it('applies saved hidden state on startup', async () => {
    window.localStorage.setItem(PRIVACY_STORAGE_KEY, 'hidden');
    mockApi();
    render(<App />);
    await screen.findByRole('heading', { name: 'History' });

    expect(screen.queryByText('€120.00')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Show monetary values' }),
    ).toBeInTheDocument();
  });

  it('keeps snapshot input fields readable while privacy mode is on', async () => {
    window.localStorage.setItem(PRIVACY_STORAGE_KEY, 'hidden');
    mockApi({ dashboard: dashboardFixture, snapshotsByDate: {} });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'History' });

    await user.click(screen.getByRole('button', { name: 'Add snapshot' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add snapshot' });
    const crypto = await within(dialog).findByLabelText('Crypto');
    await user.clear(crypto);
    await user.type(crypto, '12.34');
    expect(crypto).toHaveValue('12.34');
  });

  it('does not expose hidden amounts through accessibility labels', () => {
    window.localStorage.setItem(PRIVACY_STORAGE_KEY, 'hidden');
    renderWithProviders(
      <SummaryCards data={dashboardFixture} currency="EUR" />,
    );

    expect(screen.queryByLabelText(/€120/)).not.toBeInTheDocument();
    expect(screen.getAllByText('Monetary value hidden').length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByTitle(/€120/)).not.toBeInTheDocument();
  });

  it('hides desktop history monetary values', () => {
    window.localStorage.setItem(PRIVACY_STORAGE_KEY, 'hidden');
    setViewportWidth(1440);
    renderWithProviders(
      <HistoryTable
        data={dashboardFixture}
        currency="EUR"
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.queryByText('€120.00')).not.toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('hides mobile history monetary values and keeps percentages', () => {
    window.localStorage.setItem(PRIVACY_STORAGE_KEY, 'hidden');
    setViewportWidth(375);
    renderWithProviders(
      <HistoryTable
        data={dashboardFixture}
        currency="EUR"
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getAllByRole('list').length).toBeGreaterThan(0);
    expect(screen.queryByText('€120.00')).not.toBeInTheDocument();
    expect(screen.getAllByText(/Monetary value hidden/).length).toBeGreaterThan(
      0,
    );
  });

  it('does not reveal chart tooltip amounts while privacy mode is on', () => {
    window.localStorage.setItem(PRIVACY_STORAGE_KEY, 'hidden');
    renderWithProviders(
      <TotalValueChart
        data={dashboardFixture}
        currency="EUR"
        range="3m"
        onRangeChange={vi.fn()}
      />,
    );

    expect(screen.queryByText('€120.00')).not.toBeInTheDocument();
  });

  it('theme switching does not reset privacy mode', async () => {
    mockApi();
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'History' });

    await user.click(
      screen.getByRole('button', { name: 'Hide monetary values' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Switch to dark theme' }),
    );

    await waitFor(() => {
      expect(document.documentElement.dataset['theme']).toBe('dark');
    });
    expect(window.localStorage.getItem(PRIVACY_STORAGE_KEY)).toBe('hidden');
    expect(screen.queryByText('€120.00')).not.toBeInTheDocument();
  });

  it('toggling privacy does not trigger a data refetch', async () => {
    mockApi();
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'History' });

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    // Wait until the initial load settles so a late bootstrap request is not
    // counted as a privacy-toggle refetch.
    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(0);
    });
    const callsBefore = fetchMock.mock.calls.length;
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(fetchMock.mock.calls.length).toBe(callsBefore);

    await user.click(
      screen.getByRole('button', { name: 'Hide monetary values' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Show monetary values' }),
    );

    expect(fetchMock.mock.calls.length).toBe(callsBefore);
  });
});
