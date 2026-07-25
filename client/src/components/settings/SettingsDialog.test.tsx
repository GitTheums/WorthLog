import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../App';
import {
  categoriesFixture,
  dashboardFixture,
  emptyDashboardFixture,
} from '../../test/fixtures';
import { backupFixture, mockApi } from '../../test/mock-api';

async function openSettings(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Open settings' }));
  return screen.findByRole('dialog', { name: 'Settings' });
}

function makeUploadFile(name: string, contents: string, type: string) {
  const file = new File([contents], name, { type });
  Object.defineProperty(file, 'text', {
    configurable: true,
    value: () => Promise.resolve(contents),
  });
  return file;
}

describe('settings dialog', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.dataset['theme'] = 'light';
    vi.restoreAllMocks();
  });

  it('lists active categories and prevents duplicate names case-insensitively', async () => {
    mockApi();
    const user = userEvent.setup();

    render(<App />);
    await screen.findByRole('heading', { name: 'History' });

    const dialog = await openSettings(user);
    expect(
      within(dialog).getByRole('heading', { name: 'Active categories' }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('Crypto')).toBeInTheDocument();
    expect(within(dialog).getByText('Stocks')).toBeInTheDocument();

    await user.click(
      within(dialog).getByRole('button', { name: 'Add category' }),
    );
    await user.type(within(dialog).getByLabelText('Name'), 'crypto');
    await user.click(
      within(dialog).getByRole('button', { name: 'Save category' }),
    );

    expect(
      await within(dialog).findByText(
        'A category with this name already exists',
      ),
    ).toBeInTheDocument();
  });

  it('adds, reorders, archives, restores, and deletes unused categories', async () => {
    const created: string[] = [];
    const reordered: string[][] = [];
    const updated: Array<{ id: string; archived?: boolean }> = [];
    const deleted: string[] = [];

    const unusedBase = categoriesFixture[0];
    const secondBase = categoriesFixture[1];
    if (!unusedBase || !secondBase) {
      throw new Error('Expected category fixtures');
    }

    mockApi({
      dashboard: emptyDashboardFixture,
      categories: [
        {
          ...unusedBase,
          id: 'cat-unused',
          name: 'Unused',
          sortOrder: 0,
        },
        {
          ...secondBase,
          id: 'cat-second',
          name: 'Second',
          sortOrder: 1,
        },
      ],
      onCreateCategory: (body) => {
        created.push(body.name);
      },
      onReorderCategories: (ids) => {
        reordered.push(ids);
      },
      onUpdateCategory: (id, body) => {
        if (body.archived === undefined) {
          updated.push({ id });
          return;
        }
        updated.push({ id, archived: body.archived });
      },
      onDeleteCategory: (id) => {
        deleted.push(id);
      },
    });
    const user = userEvent.setup();

    render(<App />);
    await screen.findByRole('heading', { name: 'No snapshots yet' });

    const dialog = await openSettings(user);

    await user.click(
      within(dialog).getByRole('button', { name: 'Add category' }),
    );
    await user.clear(within(dialog).getByLabelText('Name'));
    await user.type(within(dialog).getByLabelText('Name'), 'Bonds');
    await user.clear(within(dialog).getByLabelText('Color'));
    await user.type(within(dialog).getByLabelText('Color'), '#10B981');
    await user.click(within(dialog).getByRole('button', { name: 'Landmark' }));
    await user.click(
      within(dialog).getByRole('button', { name: 'Save category' }),
    );

    await waitFor(() => {
      expect(created).toEqual(['Bonds']);
    });
    expect(await within(dialog).findByText('Bonds')).toBeInTheDocument();

    await user.click(
      within(dialog).getByRole('button', { name: 'Move Unused down' }),
    );
    await waitFor(() => {
      expect(reordered.at(-1)?.[0]).toBe('cat-second');
      expect(reordered.at(-1)?.[1]).toBe('cat-unused');
    });

    await user.click(
      within(dialog).getByRole('button', { name: 'Archive Unused' }),
    );
    await waitFor(() => {
      expect(updated).toContainEqual({ id: 'cat-unused', archived: true });
    });

    const archivedToggle = within(dialog).getByRole('button', {
      name: /Archived categories/,
    });
    expect(archivedToggle).toHaveAttribute('aria-expanded', 'true');
    expect(within(dialog).getByText('Unused')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Restore' }));
    await waitFor(() => {
      expect(updated).toContainEqual({ id: 'cat-unused', archived: false });
    });

    await user.click(
      within(dialog).getByRole('button', { name: 'Delete Unused' }),
    );
    await waitFor(() => {
      expect(deleted).toEqual(['cat-unused']);
    });
  });

  it('blocks permanent delete for categories with snapshot history', async () => {
    mockApi({ dashboard: dashboardFixture });
    const user = userEvent.setup();

    render(<App />);
    await screen.findByRole('heading', { name: 'History' });

    const dialog = await openSettings(user);
    expect(
      within(dialog).getAllByText(/Has snapshot history/).length,
    ).toBeGreaterThan(0);
    expect(
      within(dialog).getByText(
        /Permanent delete is only available for categories that were never used/,
      ),
    ).toBeInTheDocument();

    await user.click(
      within(dialog).getByRole('button', { name: 'Delete Crypto' }),
    );

    expect(
      await screen.findByText(
        /Crypto has snapshot history and can only be archived/,
      ),
    ).toBeInTheDocument();
  });

  it('saves general settings and explains the no-login local network model', async () => {
    const patches: Array<Record<string, unknown>> = [];
    mockApi({
      onPatchSettings: (body) => {
        patches.push(body);
      },
    });
    const user = userEvent.setup();

    render(<App />);
    await screen.findByRole('heading', { name: 'History' });

    const dialog = await openSettings(user);
    await user.click(within(dialog).getByRole('tab', { name: 'General' }));

    expect(
      within(dialog).getByText(/no login and is intended for a trusted local network/i),
    ).toBeInTheDocument();

    const currency = within(dialog).getByLabelText('Currency');
    await user.clear(currency);
    await user.type(currency, 'USD');
    await user.selectOptions(
      within(dialog).getByLabelText('Default dashboard range'),
      '1y',
    );
    await user.click(
      within(dialog).getByRole('button', { name: 'Save general settings' }),
    );

    await waitFor(() => {
      expect(patches).toEqual([{ currency: 'USD', defaultRange: '1y' }]);
    });
    expect(
      await within(dialog).findByText('General settings saved'),
    ).toBeInTheDocument();
  });

  it('exports a dated backup JSON file', async () => {
    const exported: unknown[] = [];
    mockApi({
      onExportBackup: () => {
        exported.push(true);
      },
    });

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(() => 'blob:backup'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });

    let downloadName = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      function mockClick(this: HTMLAnchorElement) {
        downloadName = this.download;
      },
    );

    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'History' });

    const dialog = await openSettings(user);
    await user.click(
      within(dialog).getByRole('tab', { name: 'Backup and restore' }),
    );
    await user.click(
      within(dialog).getByRole('button', { name: 'Export backup' }),
    );

    await waitFor(() => {
      expect(exported).toHaveLength(1);
      expect(downloadName).toMatch(/^worthlog-backup-\d{4}-\d{2}-\d{2}\.json$/);
    });
    expect(
      await within(dialog).findByText(/Downloaded worthlog-backup-/),
    ).toBeInTheDocument();
  });

  it('validates import files and confirms before replacing data', async () => {
    const imports: BackupExportLike[] = [];
    mockApi({
      onImportBackup: (body) => {
        imports.push(body);
      },
    });
    const user = userEvent.setup();

    render(<App />);
    await screen.findByRole('heading', { name: 'History' });

    const dialog = await openSettings(user);
    await user.click(
      within(dialog).getByRole('tab', { name: 'Backup and restore' }),
    );

    expect(
      within(dialog).getByText(/automatically creates a timestamped/i),
    ).toBeInTheDocument();

    const fileInput = dialog.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    const badFile = makeUploadFile('backup.txt', 'not-json', 'text/plain');
    fireEvent.change(fileInput, { target: { files: [badFile] } });
    expect(
      await within(dialog).findByText('Choose a .json backup file'),
    ).toBeInTheDocument();

    const invalidJson = makeUploadFile(
      'bad.json',
      '{"version":2}',
      'application/json',
    );
    fireEvent.change(fileInput, { target: { files: [invalidJson] } });
    expect(
      await within(dialog).findByText(/not a valid Worthlog backup/i),
    ).toBeInTheDocument();

    const goodFile = makeUploadFile(
      'worthlog-backup-2026-07-25.json',
      JSON.stringify(backupFixture),
      'application/json',
    );
    fireEvent.change(fileInput, { target: { files: [goodFile] } });

    const confirm = await screen.findByRole('alertdialog', {
      name: 'Replace all Worthlog data?',
    });
    expect(
      within(confirm).getByText(/automatic timestamped database backup/i),
    ).toBeInTheDocument();

    await user.click(
      within(confirm).getByRole('button', { name: 'Import and replace' }),
    );

    await waitFor(() => {
      expect(imports).toHaveLength(1);
    });
    expect(
      await within(dialog).findByText(/Import complete/),
    ).toBeInTheDocument();
  });
});

type BackupExportLike = typeof backupFixture;
