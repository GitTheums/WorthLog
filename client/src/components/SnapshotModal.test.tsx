import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import {
  dashboardFixture,
  emptyDashboardFixture,
  snapshotFixture,
} from '../test/fixtures';
import { mockApi } from '../test/mock-api';

async function openAddModal(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Add snapshot' }));
  return screen.findByRole('dialog', { name: 'Add snapshot' });
}

describe('snapshot workflow', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.dataset['theme'] = 'light';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects negatives and invalid text without requiring every category', async () => {
    mockApi({ dashboard: emptyDashboardFixture, snapshotsByDate: {} });
    const user = userEvent.setup();

    render(<App />);
    await screen.findByRole('heading', { name: 'No snapshots yet' });

    const dialog = await openAddModal(user);
    await within(dialog).findByLabelText('Crypto');

    expect(
      within(dialog).getByText(
        'Leave empty if you do not own anything in this category.',
      ),
    ).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText('Crypto'), '-1');
    await user.type(within(dialog).getByLabelText('Stocks'), 'abc');

    await user.click(
      within(dialog).getByRole('button', { name: 'Save snapshot' }),
    );

    expect(
      await within(dialog).findByText('Value cannot be negative'),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('Enter a valid amount')).toBeInTheDocument();
    expect(
      within(dialog).queryByText('Enter a value'),
    ).not.toBeInTheDocument();
  });

  it('saves all-empty category inputs as amountCents 0', async () => {
    const putCalls: Array<{ date: string; body: unknown }> = [];
    mockApi({
      dashboard: emptyDashboardFixture,
      snapshotsByDate: {},
      onPut: (date, body) => {
        putCalls.push({ date, body });
      },
    });
    const user = userEvent.setup();

    render(<App />);
    await screen.findByRole('heading', { name: 'No snapshots yet' });

    const dialog = await openAddModal(user);
    await within(dialog).findByLabelText('Crypto');

    expect(within(dialog).getByLabelText('Crypto')).toHaveValue('');
    expect(within(dialog).getByLabelText('Stocks')).toHaveValue('');
    expect(within(dialog).getByText('€0.00')).toBeInTheDocument();

    await user.click(
      within(dialog).getByRole('button', { name: 'Save snapshot' }),
    );

    await waitFor(() => {
      expect(putCalls).toHaveLength(1);
    });

    expect(putCalls[0]?.body).toMatchObject({
      values: expect.arrayContaining([
        { categoryId: 'cat-crypto', amountCents: 0 },
        { categoryId: 'cat-stocks', amountCents: 0 },
        { categoryId: 'cat-pokemon', amountCents: 0 },
        { categoryId: 'cat-skins', amountCents: 0 },
      ]),
    });
  });

  it('saves one filled category and empty others as zeros', async () => {
    const putCalls: Array<{ date: string; body: unknown }> = [];
    mockApi({
      dashboard: emptyDashboardFixture,
      snapshotsByDate: {},
      onPut: (date, body) => {
        putCalls.push({ date, body });
      },
    });
    const user = userEvent.setup();

    render(<App />);
    await screen.findByRole('heading', { name: 'No snapshots yet' });

    const dialog = await openAddModal(user);
    await within(dialog).findByLabelText('Crypto');
    await user.type(within(dialog).getByLabelText('Crypto'), '25');

    expect(within(dialog).getByText('€25.00')).toBeInTheDocument();

    await user.click(
      within(dialog).getByRole('button', { name: 'Save snapshot' }),
    );

    await waitFor(() => {
      expect(putCalls).toHaveLength(1);
    });

    expect(putCalls[0]?.body).toMatchObject({
      values: expect.arrayContaining([
        { categoryId: 'cat-crypto', amountCents: 2500 },
        { categoryId: 'cat-stocks', amountCents: 0 },
        { categoryId: 'cat-pokemon', amountCents: 0 },
        { categoryId: 'cat-skins', amountCents: 0 },
      ]),
    });
  });

  it('accepts explicit zero, comma decimals, and dot decimals', async () => {
    const putCalls: Array<{ date: string; body: unknown }> = [];
    mockApi({
      dashboard: emptyDashboardFixture,
      snapshotsByDate: {},
      onPut: (date, body) => {
        putCalls.push({ date, body });
      },
    });
    const user = userEvent.setup();

    render(<App />);
    await screen.findByRole('heading', { name: 'No snapshots yet' });

    const dialog = await openAddModal(user);
    await within(dialog).findByLabelText('Crypto');

    await user.type(within(dialog).getByLabelText('Crypto'), '12,34');
    await user.type(within(dialog).getByLabelText('Stocks'), '0');
    await user.type(within(dialog).getByLabelText('Pokémon'), '0,00');
    await user.type(within(dialog).getByLabelText('CS2 Skins'), '1.5');

    await user.click(
      within(dialog).getByRole('button', { name: 'Save snapshot' }),
    );

    await waitFor(() => {
      expect(putCalls).toHaveLength(1);
    });

    expect(putCalls[0]?.body).toMatchObject({
      values: expect.arrayContaining([
        { categoryId: 'cat-crypto', amountCents: 1234 },
        { categoryId: 'cat-stocks', amountCents: 0 },
        { categoryId: 'cat-pokemon', amountCents: 0 },
        { categoryId: 'cat-skins', amountCents: 150 },
      ]),
    });

    expect(
      await screen.findByText(/Snapshot for .+ saved/i),
    ).toBeInTheDocument();
  });

  it('creates a first snapshot when crypto.randomUUID is unavailable', async () => {
    vi.stubGlobal('crypto', {
      getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto),
    });

    const putCalls: Array<{ date: string; body: unknown }> = [];
    mockApi({
      dashboard: emptyDashboardFixture,
      snapshotsByDate: {},
      onPut: (date, body) => {
        putCalls.push({ date, body });
      },
    });
    const user = userEvent.setup();

    render(<App />);
    await screen.findByRole('heading', { name: 'No snapshots yet' });

    const dialog = await openAddModal(user);
    await within(dialog).findByLabelText('Crypto');
    await user.type(within(dialog).getByLabelText('Crypto'), '10');

    await user.click(
      within(dialog).getByRole('button', { name: 'Save snapshot' }),
    );

    await waitFor(() => {
      expect(putCalls).toHaveLength(1);
    });

    expect(putCalls[0]?.body).toMatchObject({
      values: expect.arrayContaining([
        { categoryId: 'cat-crypto', amountCents: 1000 },
        { categoryId: 'cat-stocks', amountCents: 0 },
      ]),
    });
    expect(typeof globalThis.crypto.randomUUID).not.toBe('function');
    expect(
      await screen.findByText(/Snapshot for .+ saved/i),
    ).toBeInTheDocument();
  });

  it('confirms before replacing a duplicate date', async () => {
    const putCalls: Array<{ date: string; body: unknown }> = [];
    mockApi({
      snapshotsByDate: {
        '2026-03-01': snapshotFixture,
      },
      onPut: (date, body) => {
        putCalls.push({ date, body });
      },
    });
    const user = userEvent.setup();

    render(<App />);
    await screen.findByRole('heading', { name: 'History' });

    const dialog = await openAddModal(user);
    const dateInput = await within(dialog).findByLabelText('Snapshot date');
    fireEvent.change(dateInput, { target: { value: '2026-03-01' } });

    await waitFor(() => {
      expect(
        within(dialog).getByText(/already exists for this date/i),
      ).toBeInTheDocument();
    });

    const crypto = within(dialog).getByLabelText('Crypto');
    await user.clear(crypto);
    await user.type(crypto, '10');
    await user.clear(within(dialog).getByLabelText('Stocks'));
    await user.type(within(dialog).getByLabelText('Stocks'), '20');
    await user.clear(within(dialog).getByLabelText('Pokémon'));
    await user.type(within(dialog).getByLabelText('Pokémon'), '30');
    await user.clear(within(dialog).getByLabelText('CS2 Skins'));
    await user.type(within(dialog).getByLabelText('CS2 Skins'), '40');

    await user.click(
      within(dialog).getByRole('button', { name: 'Save snapshot' }),
    );

    const confirm = await screen.findByRole('alertdialog', {
      name: 'Replace existing snapshot?',
    });
    expect(confirm).toBeInTheDocument();

    await user.click(
      within(confirm).getByRole('button', { name: 'Replace snapshot' }),
    );

    await waitFor(() => {
      expect(putCalls).toHaveLength(1);
      expect(putCalls[0]?.date).toBe('2026-03-01');
    });
  });

  it('loads an existing snapshot in edit mode, shows zeros, and allows clearing', async () => {
    const putCalls: Array<{ date: string; body: unknown }> = [];
    mockApi({
      snapshotsByDate: {
        '2026-03-01': {
          ...snapshotFixture,
          values: [
            {
              id: 'val-1',
              snapshotId: 'snap-1',
              categoryId: 'cat-crypto',
              amountCents: 3000,
              createdAt: snapshotFixture.createdAt,
              updatedAt: snapshotFixture.updatedAt,
            },
            {
              id: 'val-2',
              snapshotId: 'snap-1',
              categoryId: 'cat-stocks',
              amountCents: 0,
              createdAt: snapshotFixture.createdAt,
              updatedAt: snapshotFixture.updatedAt,
            },
            {
              id: 'val-3',
              snapshotId: 'snap-1',
              categoryId: 'cat-pokemon',
              amountCents: 3000,
              createdAt: snapshotFixture.createdAt,
              updatedAt: snapshotFixture.updatedAt,
            },
            {
              id: 'val-4',
              snapshotId: 'snap-1',
              categoryId: 'cat-skins',
              amountCents: 3000,
              createdAt: snapshotFixture.createdAt,
              updatedAt: snapshotFixture.updatedAt,
            },
          ],
        },
      },
      onPut: (date, body) => {
        putCalls.push({ date, body });
      },
    });
    const user = userEvent.setup();

    render(<App />);
    await screen.findByRole('heading', { name: 'History' });

    const editButtons = screen.getAllByRole('button', {
      name: /Edit snapshot for/i,
    });
    const editButton = editButtons[0];
    if (!editButton) {
      throw new Error('Expected an edit button');
    }
    await user.click(editButton);

    const dialog = await screen.findByRole('dialog', { name: 'Edit snapshot' });
    expect(within(dialog).getByLabelText('Stocks')).toHaveValue('0.00');

    await user.clear(within(dialog).getByLabelText('Stocks'));
    expect(within(dialog).getByLabelText('Stocks')).toHaveValue('');

    const crypto = within(dialog).getByLabelText('Crypto');
    await user.clear(crypto);
    await user.type(crypto, '99,99');

    await user.click(
      within(dialog).getByRole('button', { name: 'Save changes' }),
    );

    await waitFor(() => {
      expect(putCalls).toHaveLength(1);
      expect(putCalls[0]?.date).toBe('2026-03-01');
    });

    expect(putCalls[0]?.body).toMatchObject({
      values: expect.arrayContaining([
        { categoryId: 'cat-crypto', amountCents: 9999 },
        { categoryId: 'cat-stocks', amountCents: 0 },
      ]),
    });
  });

  it('requires delete confirmation and deletes after confirm', async () => {
    const deleted: string[] = [];
    mockApi({
      onDelete: (date) => {
        deleted.push(date);
      },
    });
    const user = userEvent.setup();

    render(<App />);
    await screen.findByRole('heading', { name: 'History' });

    const deleteButtons = screen.getAllByRole('button', {
      name: /Delete snapshot for/i,
    });
    const deleteButton = deleteButtons[0];
    if (!deleteButton) {
      throw new Error('Expected a delete button');
    }
    await user.click(deleteButton);

    const confirm = await screen.findByRole('alertdialog', {
      name: 'Delete snapshot?',
    });
    expect(confirm.textContent).toMatch(/2026/);
    expect(confirm.textContent).toMatch(/120/);

    await user.click(
      within(confirm).getByRole('button', { name: 'Delete snapshot' }),
    );

    await waitFor(() => {
      expect(deleted).toEqual(['2026-03-01']);
    });

    expect(
      await screen.findByText(/Snapshot for .+ deleted/i),
    ).toBeInTheDocument();
  });

  it('preserves entered values after an API error', async () => {
    mockApi({ dashboard: emptyDashboardFixture, snapshotsByDate: {} });
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const method = (init?.method ?? 'GET').toUpperCase();

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
      if (url.includes('/api/dashboard')) {
        return Promise.resolve(Response.json({ data: emptyDashboardFixture }));
      }
      if (url.includes('/api/categories')) {
        return Promise.resolve(
          Response.json({
            data: [
              {
                id: 'cat-crypto',
                name: 'Crypto',
                color: '#7C5CFC',
                icon: 'Bitcoin',
                sortOrder: 0,
                archivedAt: null,
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
              {
                id: 'cat-stocks',
                name: 'Stocks',
                color: '#2563EB',
                icon: 'ChartNoAxesCombined',
                sortOrder: 1,
                archivedAt: null,
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
              {
                id: 'cat-pokemon',
                name: 'Pokémon',
                color: '#F59E0B',
                icon: 'Sparkles',
                sortOrder: 2,
                archivedAt: null,
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
              {
                id: 'cat-skins',
                name: 'CS2 Skins',
                color: '#EF4444',
                icon: 'Crosshair',
                sortOrder: 3,
                archivedAt: null,
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
            ],
          }),
        );
      }
      if (url.includes('/api/snapshots/') && method === 'GET') {
        return Promise.resolve(
          Response.json(
            {
              error: {
                code: 'SNAPSHOT_NOT_FOUND',
                message: 'not found',
              },
            },
            { status: 404 },
          ),
        );
      }
      if (url.includes('/api/snapshots/') && method === 'PUT') {
        return Promise.resolve(
          Response.json(
            {
              error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Save failed',
              },
            },
            { status: 500 },
          ),
        );
      }
      return Promise.resolve(new Response('Not found', { status: 404 }));
    });

    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'No snapshots yet' });

    const dialog = await openAddModal(user);
    await within(dialog).findByLabelText('Crypto');

    await user.type(within(dialog).getByLabelText('Crypto'), '11,11');
    await user.type(within(dialog).getByLabelText('Stocks'), '22,22');
    await user.type(within(dialog).getByLabelText('Pokémon'), '33,33');
    await user.type(within(dialog).getByLabelText('CS2 Skins'), '44,44');

    await user.click(
      within(dialog).getByRole('button', { name: 'Save snapshot' }),
    );

    expect(await within(dialog).findByText('Save failed')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Crypto')).toHaveValue('11,11');
    expect(within(dialog).getByLabelText('Stocks')).toHaveValue('22,22');
    expect(dialog).toBeInTheDocument();
  });

  it('prefills latest known values when adding from an existing portfolio', async () => {
    mockApi({
      dashboard: dashboardFixture,
      snapshotsByDate: {},
    });
    const user = userEvent.setup();

    render(<App />);
    await screen.findByRole('heading', { name: 'History' });

    const dialog = await openAddModal(user);
    await within(dialog).findByLabelText('Crypto');

    expect(within(dialog).getByLabelText('Crypto')).toHaveValue('30.00');
    expect(within(dialog).getByLabelText('Stocks')).toHaveValue('30.00');
  });

  it('shows a first-snapshot helper callout with one category and no history', async () => {
    mockApi({
      dashboard: emptyDashboardFixture,
      snapshotsByDate: {},
      categories: [
        {
          id: 'cat-stocks',
          name: 'Stocks',
          color: '#2563EB',
          icon: 'ChartNoAxesCombined',
          sortOrder: 0,
          archivedAt: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });
    const user = userEvent.setup();

    render(<App />);
    await screen.findByRole('heading', { name: 'No snapshots yet' });

    const dialog = await openAddModal(user);
    expect(
      await within(dialog).findByText(
        'Starting simple? You can add more investment categories later in Settings.',
      ),
    ).toBeInTheDocument();
  });

  it('hides the helper callout after another category is added', async () => {
    mockApi({
      dashboard: emptyDashboardFixture,
      snapshotsByDate: {},
      categories: [
        {
          id: 'cat-stocks',
          name: 'Stocks',
          color: '#2563EB',
          icon: 'ChartNoAxesCombined',
          sortOrder: 0,
          archivedAt: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'cat-bonds',
          name: 'Bonds',
          color: '#0F766E',
          icon: 'Landmark',
          sortOrder: 1,
          archivedAt: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });
    const user = userEvent.setup();

    render(<App />);
    await screen.findByRole('heading', { name: 'No snapshots yet' });

    const dialog = await openAddModal(user);
    await within(dialog).findByLabelText('Stocks');
    expect(
      within(dialog).queryByText(
        'Starting simple? You can add more investment categories later in Settings.',
      ),
    ).not.toBeInTheDocument();
  });

  it('blocks snapshot creation when there are zero active categories', async () => {
    mockApi({
      dashboard: emptyDashboardFixture,
      snapshotsByDate: {},
      categories: [],
    });
    const user = userEvent.setup();

    render(<App />);
    expect(
      await screen.findByRole('heading', { name: 'No categories yet' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add snapshot' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add snapshot' });

    expect(
      within(dialog).getByText(
        'No active categories yet. Add a category in Settings before creating a snapshot.',
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole('button', { name: 'Save snapshot' }),
    ).not.toBeInTheDocument();

    await user.click(
      within(dialog).getByRole('button', { name: 'Open category settings' }),
    );
    expect(
      await screen.findByRole('dialog', { name: 'Settings' }),
    ).toBeInTheDocument();
  });
});
