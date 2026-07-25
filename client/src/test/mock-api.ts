import { vi } from 'vitest';
import type {
  AppSettings,
  BackupExport,
  Category,
  CreateCategoryPayload,
  DashboardData,
  SnapshotDetails,
  UpdateCategoryPayload,
  UpsertSnapshotPayload,
} from '../api/types';
import {
  categoriesFixture,
  dashboardFixture,
  settingsFixture,
  snapshotFixture,
} from './fixtures';

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
}

function readJsonBody(body: BodyInit | null | undefined): unknown {
  if (typeof body !== 'string') {
    return {};
  }
  return JSON.parse(body) as unknown;
}

function categoryIdFromUrl(url: string): string | null {
  const match = /\/api\/categories\/([^/?]+)/.exec(url);
  if (!match?.[1] || match[1] === 'reorder') {
    return null;
  }
  return decodeURIComponent(match[1]);
}

export const backupFixture: BackupExport = {
  version: 1,
  exportedAt: '2026-07-25T12:00:00.000Z',
  settings: [
    {
      key: 'currency',
      value: 'EUR',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      key: 'defaultRange',
      value: '3m',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  categories: categoriesFixture.map((category) => ({ ...category })),
  snapshots: [
    {
      id: snapshotFixture.id,
      date: snapshotFixture.date,
      note: snapshotFixture.note,
      createdAt: snapshotFixture.createdAt,
      updatedAt: snapshotFixture.updatedAt,
      values: snapshotFixture.values.map((value) => ({ ...value })),
    },
  ],
};

interface MockApiOptions {
  dashboard?: DashboardData;
  settings?: AppSettings;
  categories?: Category[];
  snapshotsByDate?: Record<string, SnapshotDetails>;
  onPut?: (date: string, body: UpsertSnapshotPayload) => void;
  onDelete?: (date: string) => void;
  onCreateCategory?: (body: CreateCategoryPayload) => void;
  onUpdateCategory?: (id: string, body: UpdateCategoryPayload) => void;
  onDeleteCategory?: (id: string) => void;
  onReorderCategories?: (categoryIds: string[]) => void;
  onPatchSettings?: (body: Partial<AppSettings>) => void;
  onExportBackup?: () => void;
  onImportBackup?: (body: BackupExport) => void;
  deleteCategoryError?: { status: number; code: string; message: string };
}

export function mockApi(options: MockApiOptions = {}) {
  const dashboard = options.dashboard ?? dashboardFixture;
  let settings: AppSettings = {
    ...(options.settings ?? settingsFixture),
  };
  let categories = (options.categories ?? categoriesFixture).map((item) => ({
    ...item,
  }));
  const snapshotsByDate = options.snapshotsByDate ?? {
    '2026-03-01': snapshotFixture,
  };

  return vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = requestUrl(input);
    const method = (init?.method ?? 'GET').toUpperCase();

    if (url.includes('/api/settings')) {
      if (method === 'PATCH') {
        const body = readJsonBody(init?.body) as Partial<AppSettings>;
        options.onPatchSettings?.(body);
        settings = {
          currency: body.currency ?? settings.currency,
          defaultRange: body.defaultRange ?? settings.defaultRange,
        };
        return Promise.resolve(Response.json({ data: settings }));
      }
      return Promise.resolve(Response.json({ data: settings }));
    }

    if (url.includes('/api/dashboard')) {
      return Promise.resolve(Response.json({ data: dashboard }));
    }

    if (url.includes('/api/backup/export') && method === 'GET') {
      options.onExportBackup?.();
      return Promise.resolve(Response.json({ data: backupFixture }));
    }

    if (url.includes('/api/backup/import') && method === 'POST') {
      const body = readJsonBody(init?.body) as BackupExport;
      options.onImportBackup?.(body);
      return Promise.resolve(
        Response.json({
          data: {
            backupPath: '/data/worthlog.backup.2026-07-25T120000.db',
            importedAt: '2026-07-25T12:00:00.000Z',
            counts: {
              settings: body.settings.length,
              categories: body.categories.length,
              snapshots: body.snapshots.length,
              values: body.snapshots.reduce(
                (sum, snapshot) => sum + snapshot.values.length,
                0,
              ),
            },
          },
        }),
      );
    }

    if (url.includes('/api/categories/reorder') && method === 'POST') {
      const body = readJsonBody(init?.body) as { categoryIds: string[] };
      options.onReorderCategories?.(body.categoryIds);
      const order = new Map(
        body.categoryIds.map((id, index) => [id, index] as const),
      );
      categories = [...categories]
        .map((category) => ({
          ...category,
          sortOrder: order.get(category.id) ?? category.sortOrder,
        }))
        .sort((a, b) => a.sortOrder - b.sortOrder);
      return Promise.resolve(Response.json({ data: categories }));
    }

    const categoryId = categoryIdFromUrl(url);
    if (categoryId) {
      if (method === 'PATCH') {
        const body = readJsonBody(init?.body) as UpdateCategoryPayload;
        options.onUpdateCategory?.(categoryId, body);
        const index = categories.findIndex((item) => item.id === categoryId);
        const current = categories[index];
        if (!current) {
          return Promise.resolve(
            Response.json(
              {
                error: {
                  code: 'CATEGORY_NOT_FOUND',
                  message: 'Category not found',
                },
              },
              { status: 404 },
            ),
          );
        }
        const updated: Category = {
          ...current,
          name: body.name ?? current.name,
          color: body.color ?? current.color,
          icon: body.icon ?? current.icon,
          sortOrder: body.sortOrder ?? current.sortOrder,
          archivedAt:
            body.archived === undefined
              ? current.archivedAt
              : body.archived
                ? '2026-07-25T12:00:00.000Z'
                : null,
          updatedAt: '2026-07-25T12:00:00.000Z',
        };
        categories = categories.map((item, itemIndex) =>
          itemIndex === index ? updated : item,
        );
        return Promise.resolve(Response.json({ data: updated }));
      }

      if (method === 'DELETE') {
        options.onDeleteCategory?.(categoryId);
        if (options.deleteCategoryError) {
          return Promise.resolve(
            Response.json(
              {
                error: {
                  code: options.deleteCategoryError.code,
                  message: options.deleteCategoryError.message,
                },
              },
              { status: options.deleteCategoryError.status },
            ),
          );
        }
        categories = categories.filter((item) => item.id !== categoryId);
        return Promise.resolve(new Response(null, { status: 204 }));
      }
    }

    if (url.includes('/api/categories')) {
      if (method === 'POST') {
        const body = readJsonBody(init?.body) as CreateCategoryPayload;
        options.onCreateCategory?.(body);
        const created: Category = {
          id: `cat-${String(categories.length + 1)}`,
          name: body.name,
          color: body.color,
          icon: body.icon,
          sortOrder: categories.length,
          archivedAt: null,
          createdAt: '2026-07-25T12:00:00.000Z',
          updatedAt: '2026-07-25T12:00:00.000Z',
        };
        categories = [...categories, created];
        return Promise.resolve(Response.json({ data: created }, { status: 201 }));
      }

      const includeArchived = url.includes('includeArchived=true');
      const data = includeArchived
        ? categories
        : categories.filter((item) => item.archivedAt === null);
      return Promise.resolve(Response.json({ data }));
    }

    const snapshotMatch = /\/api\/snapshots\/(\d{4}-\d{2}-\d{2})/.exec(url);
    if (snapshotMatch) {
      const date = snapshotMatch[1] ?? '';

      if (method === 'GET') {
        const snapshot = snapshotsByDate[date];
        if (!snapshot) {
          return Promise.resolve(
            Response.json(
              {
                error: {
                  code: 'SNAPSHOT_NOT_FOUND',
                  message: `Snapshot ${date} was not found`,
                },
              },
              { status: 404 },
            ),
          );
        }
        return Promise.resolve(Response.json({ data: snapshot }));
      }

      if (method === 'PUT') {
        const body = readJsonBody(init?.body) as UpsertSnapshotPayload;
        options.onPut?.(date, body);
        const totalValueCents = body.values.reduce(
          (sum, value) => sum + value.amountCents,
          0,
        );
        return Promise.resolve(
          Response.json({
            data: {
              ...snapshotFixture,
              date,
              note: body.note ?? null,
              values: body.values.map((value, index) => ({
                id: `val-${String(index)}`,
                snapshotId: 'snap-1',
                categoryId: value.categoryId,
                amountCents: value.amountCents,
                createdAt: snapshotFixture.createdAt,
                updatedAt: snapshotFixture.updatedAt,
              })),
              totalValueCents,
            },
          }),
        );
      }

      if (method === 'DELETE') {
        options.onDelete?.(date);
        return Promise.resolve(new Response(null, { status: 204 }));
      }
    }

    return Promise.resolve(new Response('Not found', { status: 404 }));
  });
}
