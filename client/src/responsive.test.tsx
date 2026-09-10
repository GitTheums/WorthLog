import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { HistoryTable } from './components/HistoryTable';
import {
  dashboardRequestUrls,
  expectSelectedDashboardRange,
} from './test/dashboard-range';
import { dashboardFixture } from './test/fixtures';
import { mockApi } from './test/mock-api';
import { renderWithProviders } from './test/render';
import { setViewportWidth } from './test/viewport';

const clientRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('responsive layout', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.dataset['theme'] = 'light';
  });

  it('keeps Add snapshot and privacy controls available at 375px', async () => {
    setViewportWidth(375);
    mockApi();
    render(<App />);
    await screen.findByRole('heading', { name: 'Worthlog' });

    expect(
      screen.getByRole('button', { name: 'Add snapshot' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Hide monetary values' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Open settings' }),
    ).toBeInTheDocument();
  });

  it('uses All as the initial dashboard range on mobile', async () => {
    setViewportWidth(375);
    mockApi();
    render(<App />);
    await screen.findByRole('heading', { name: 'History' });

    expectSelectedDashboardRange('All');
    expect(dashboardRequestUrls()[0]).toContain('/api/dashboard?range=all');
  });

  it('uses history cards at 375px', () => {
    setViewportWidth(375);
    renderWithProviders(
      <HistoryTable
        data={dashboardFixture}
        currency="EUR"
        onEdit={() => undefined}
        onDelete={() => undefined}
      />,
    );

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getAllByRole('list').length).toBeGreaterThan(0);
    expect(
      screen.getAllByRole('button', { name: /Edit snapshot for/i }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole('button', { name: /Delete snapshot for/i }).length,
    ).toBeGreaterThan(0);
  });

  it('uses a history table at 768px and 1440px', () => {
    setViewportWidth(768);
    const { unmount } = renderWithProviders(
      <HistoryTable
        data={dashboardFixture}
        currency="EUR"
        onEdit={() => undefined}
        onDelete={() => undefined}
      />,
    );
    expect(screen.getByRole('table')).toBeInTheDocument();
    unmount();

    setViewportWidth(1440);
    renderWithProviders(
      <HistoryTable
        data={dashboardFixture}
        currency="EUR"
        onEdit={() => undefined}
        onDelete={() => undefined}
      />,
    );
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('keeps header controls available at 320px', async () => {
    setViewportWidth(320);
    mockApi();
    render(<App />);
    await screen.findByRole('heading', { name: 'Worthlog' });

    expect(
      screen.getByRole('button', { name: 'Add snapshot' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Hide monetary values' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Switch to dark theme' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Open settings' }),
    ).toBeInTheDocument();
  });

  it('keeps settings sections available as tabs', async () => {
    setViewportWidth(1440);
    mockApi();
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'History' });

    await user.click(screen.getByRole('button', { name: 'Open settings' }));
    const dialog = screen.getByRole('dialog', { name: 'Settings' });
    const tablist = within(dialog).getByRole('tablist', {
      name: 'Settings sections',
    });

    expect(
      within(tablist).getByRole('tab', { name: 'Categories' }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(
      within(tablist).getByRole('tab', { name: 'General' }),
    ).toBeInTheDocument();
    expect(
      within(tablist).getByRole('tab', { name: 'Security' }),
    ).toBeInTheDocument();
    expect(
      within(tablist).getByRole('tab', { name: 'Backup and restore' }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: 'Close settings' }),
    ).toBeInTheDocument();
  });

  it('keeps modal accessible on mobile', async () => {
    setViewportWidth(375);
    mockApi();
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'History' });

    await user.click(screen.getByRole('button', { name: 'Add snapshot' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add snapshot' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(
      within(dialog).getByRole('button', { name: 'Close snapshot dialog' }),
    ).toBeInTheDocument();
  });

  it('references the favicon in the HTML entry', () => {
    const html = readFileSync(join(clientRoot, 'index.html'), 'utf8');
    expect(html).toContain('rel="icon"');
    expect(html).toContain('/favicon.svg');
    expect(html).toContain('<title>Worthlog</title>');
  });
});
