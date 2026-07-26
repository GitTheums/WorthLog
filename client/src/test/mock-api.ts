import { vi } from 'vitest';
import type {
  AppSettings,
  AuthStatus,
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

function categoryRouteFromUrl(
  url: string,
): { id: string; deletionImpact: boolean } | null {
  const impactMatch = /\/api\/categories\/([^/?]+)\/deletion-impact(?:\?|$)/.exec(
    url,
  );
  if (impactMatch?.[1]) {
    return {
      id: decodeURIComponent(impactMatch[1]),
      deletionImpact: true,
    };
  }

  const match = /\/api\/categories\/([^/?]+)(?:\?|$)/.exec(url);
  if (!match?.[1] || match[1] === 'reorder') {
    return null;
  }
  // Ignore list endpoint /api/categories
  if (url.includes('/api/categories?') || url.endsWith('/api/categories')) {
    return null;
  }
  return {
    id: decodeURIComponent(match[1]),
    deletionImpact: false,
  };
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
  authStatus?: AuthStatus;
  /** When set, unlock/setup/change/remove use this PIN for validation. */
  configuredPin?: string | null;
  unlockFailuresBeforeBlock?: number;
  onPut?: (date: string, body: UpsertSnapshotPayload) => void;
  onDelete?: (date: string) => void;
  onCreateCategory?: (body: CreateCategoryPayload) => void;
  onUpdateCategory?: (id: string, body: UpdateCategoryPayload) => void;
  onDeleteCategory?: (id: string) => void;
  onReorderCategories?: (categoryIds: string[]) => void;
  onPatchSettings?: (body: Partial<AppSettings>) => void;
  onExportBackup?: () => void;
  onImportBackup?: (body: BackupExport) => void;
  onAuthSetup?: (pin: string) => void;
  onAuthUnlock?: (pin: string) => void;
  onAuthLock?: () => void;
  deleteCategoryError?: { status: number; code: string; message: string };
  /** Resolves before a successful DELETE /api/categories/:id response. */
  awaitBeforeDelete?: () => Promise<void>;
  /** Force protected routes to return PORTFOLIO_LOCKED after N successful calls. */
  lockAfterProtectedCalls?: number;
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
  let authStatus: AuthStatus = {
    pinEnabled: false,
    unlocked: true,
    sessionExpiresAt: null,
    ...options.authStatus,
  };
  let configuredPin = options.configuredPin ?? null;
  if (authStatus.pinEnabled && !configuredPin) {
    configuredPin = '1234';
  }
  let unlockFailures = 0;
  let protectedCalls = 0;
  const unlockFailuresBeforeBlock = options.unlockFailuresBeforeBlock ?? 5;

  return vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = requestUrl(input);
    const method = (init?.method ?? 'GET').toUpperCase();

    if (url.includes('/api/auth/status') && method === 'GET') {
      return Promise.resolve(Response.json({ data: authStatus }));
    }

    if (url.includes('/api/auth/setup') && method === 'POST') {
      const body = readJsonBody(init?.body) as { pin?: string };
      const pin = body.pin ?? '';
      options.onAuthSetup?.(pin);
      if (authStatus.pinEnabled) {
        return Promise.resolve(
          Response.json(
            {
              error: {
                code: 'PIN_ALREADY_SET',
                message: 'A PIN is already configured.',
              },
            },
            { status: 409 },
          ),
        );
      }
      if (!/^\d{4,8}$/.test(pin)) {
        return Promise.resolve(
          Response.json(
            {
              error: {
                code: 'VALIDATION_ERROR',
                message: 'PIN must be 4 to 8 numeric digits.',
              },
            },
            { status: 400 },
          ),
        );
      }
      configuredPin = pin;
      authStatus = {
        pinEnabled: true,
        unlocked: true,
        sessionExpiresAt: '2099-01-01T00:00:00.000Z',
      };
      return Promise.resolve(Response.json({ data: authStatus }));
    }

    if (url.includes('/api/auth/unlock') && method === 'POST') {
      const body = readJsonBody(init?.body) as { pin?: string };
      const pin = body.pin ?? '';
      options.onAuthUnlock?.(pin);
      if (unlockFailures >= unlockFailuresBeforeBlock) {
        return Promise.resolve(
          Response.json(
            {
              error: {
                code: 'TOO_MANY_ATTEMPTS',
                message: 'Too many attempts. Try again later.',
                details: { retryAfterSeconds: 30 },
              },
            },
            { status: 429 },
          ),
        );
      }
      if (!authStatus.pinEnabled || pin !== configuredPin) {
        unlockFailures += 1;
        if (unlockFailures >= unlockFailuresBeforeBlock) {
          return Promise.resolve(
            Response.json(
              {
                error: {
                  code: 'TOO_MANY_ATTEMPTS',
                  message: 'Too many attempts. Try again later.',
                  details: { retryAfterSeconds: 30 },
                },
              },
              { status: 429 },
            ),
          );
        }
        return Promise.resolve(
          Response.json(
            {
              error: {
                code: 'INVALID_PIN',
                message: 'That PIN is incorrect.',
              },
            },
            { status: 401 },
          ),
        );
      }
      unlockFailures = 0;
      authStatus = {
        pinEnabled: true,
        unlocked: true,
        sessionExpiresAt: '2099-01-01T00:00:00.000Z',
      };
      return Promise.resolve(Response.json({ data: authStatus }));
    }

    if (url.includes('/api/auth/lock') && method === 'POST') {
      options.onAuthLock?.();
      if (authStatus.pinEnabled) {
        authStatus = {
          pinEnabled: true,
          unlocked: false,
          sessionExpiresAt: null,
        };
      }
      return Promise.resolve(Response.json({ data: { locked: true } }));
    }

    if (url.includes('/api/auth/change-pin') && method === 'POST') {
      const body = readJsonBody(init?.body) as {
        currentPin?: string;
        newPin?: string;
      };
      if (!authStatus.pinEnabled || !authStatus.unlocked) {
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
      if (body.currentPin !== configuredPin) {
        return Promise.resolve(
          Response.json(
            {
              error: {
                code: 'INVALID_PIN',
                message: 'That PIN is incorrect.',
              },
            },
            { status: 401 },
          ),
        );
      }
      if (!/^\d{4,8}$/.test(body.newPin ?? '')) {
        return Promise.resolve(
          Response.json(
            {
              error: {
                code: 'VALIDATION_ERROR',
                message: 'PIN must be 4 to 8 numeric digits.',
              },
            },
            { status: 400 },
          ),
        );
      }
      configuredPin = body.newPin ?? null;
      authStatus = {
        pinEnabled: true,
        unlocked: true,
        sessionExpiresAt: '2099-01-01T00:00:00.000Z',
      };
      return Promise.resolve(Response.json({ data: authStatus }));
    }

    if (url.includes('/api/auth/pin') && method === 'DELETE') {
      const body = readJsonBody(init?.body) as { currentPin?: string };
      if (!authStatus.pinEnabled || !authStatus.unlocked) {
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
      if (body.currentPin !== configuredPin) {
        return Promise.resolve(
          Response.json(
            {
              error: {
                code: 'INVALID_PIN',
                message: 'That PIN is incorrect.',
              },
            },
            { status: 401 },
          ),
        );
      }
      configuredPin = null;
      authStatus = {
        pinEnabled: false,
        unlocked: true,
        sessionExpiresAt: null,
      };
      return Promise.resolve(Response.json({ data: authStatus }));
    }

    const isProtectedPortfolioRoute =
      url.includes('/api/settings') ||
      url.includes('/api/dashboard') ||
      url.includes('/api/categories') ||
      url.includes('/api/snapshots') ||
      url.includes('/api/backup');

    if (
      isProtectedPortfolioRoute &&
      authStatus.pinEnabled &&
      !authStatus.unlocked
    ) {
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

    if (
      isProtectedPortfolioRoute &&
      options.lockAfterProtectedCalls !== undefined
    ) {
      protectedCalls += 1;
      if (protectedCalls > options.lockAfterProtectedCalls) {
        authStatus = {
          pinEnabled: true,
          unlocked: false,
          sessionExpiresAt: null,
        };
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
    }

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

    const categoryRoute = categoryRouteFromUrl(url);
    if (categoryRoute) {
      const categoryId = categoryRoute.id;

      if (categoryRoute.deletionImpact && method === 'GET') {
        const category = categories.find((item) => item.id === categoryId);
        if (!category) {
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

        let valueCount = 0;
        const snapshotIds = new Set<string>();
        for (const snapshot of Object.values(snapshotsByDate)) {
          for (const value of snapshot.values) {
            if (value.categoryId === categoryId) {
              valueCount += 1;
              snapshotIds.add(snapshot.id);
            }
          }
        }

        return Promise.resolve(
          Response.json({
            data: {
              categoryId,
              categoryName: category.name,
              valueCount,
              snapshotCount: snapshotIds.size,
            },
          }),
        );
      }

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
        return (async () => {
          if (options.awaitBeforeDelete) {
            await options.awaitBeforeDelete();
          }
          options.onDeleteCategory?.(categoryId);
          if (options.deleteCategoryError) {
            return Response.json(
              {
                error: {
                  code: options.deleteCategoryError.code,
                  message: options.deleteCategoryError.message,
                },
              },
              { status: options.deleteCategoryError.status },
            );
          }
          const category = categories.find((item) => item.id === categoryId);
          let deletedValueCount = 0;
          const affectedSnapshots = new Set<string>();
          for (const snapshot of Object.values(snapshotsByDate)) {
            const before = snapshot.values.length;
            snapshot.values = snapshot.values.filter((value) => {
              if (value.categoryId === categoryId) {
                deletedValueCount += 1;
                affectedSnapshots.add(snapshot.id);
                return false;
              }
              return true;
            });
            if (snapshot.values.length !== before) {
              snapshot.totalValueCents = snapshot.values.reduce(
                (sum, value) => sum + value.amountCents,
                0,
              );
            }
          }
          categories = categories.filter((item) => item.id !== categoryId);
          return Response.json({
            data: {
              deletedCategoryId: categoryId,
              deletedCategoryName: category?.name ?? categoryId,
              deletedValueCount,
              affectedSnapshotCount: affectedSnapshots.size,
            },
          });
        })();
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
