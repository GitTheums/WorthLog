import { vi } from 'vitest';
import type {
  DashboardData,
  SnapshotDetails,
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

function readJsonBody(body: BodyInit | null | undefined): UpsertSnapshotPayload {
  if (typeof body !== 'string') {
    return { values: [] };
  }
  return JSON.parse(body) as UpsertSnapshotPayload;
}

interface MockApiOptions {
  dashboard?: DashboardData;
  snapshotsByDate?: Record<string, SnapshotDetails>;
  onPut?: (date: string, body: UpsertSnapshotPayload) => void;
  onDelete?: (date: string) => void;
}

export function mockApi(options: MockApiOptions = {}) {
  const dashboard = options.dashboard ?? dashboardFixture;
  const snapshotsByDate = options.snapshotsByDate ?? {
    '2026-03-01': snapshotFixture,
  };

  return vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = requestUrl(input);
    const method = (init?.method ?? 'GET').toUpperCase();

    if (url.includes('/api/settings')) {
      return Promise.resolve(Response.json({ data: settingsFixture }));
    }

    if (url.includes('/api/dashboard')) {
      return Promise.resolve(Response.json({ data: dashboard }));
    }

    if (url.includes('/api/categories')) {
      return Promise.resolve(Response.json({ data: categoriesFixture }));
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
        const body = readJsonBody(init?.body);
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
