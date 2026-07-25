import type {
  ApiErrorBody,
  ApiSuccess,
  AppSettings,
  Category,
  DashboardData,
  DashboardRange,
  SnapshotDetails,
  UpsertSnapshotPayload,
} from './types';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Accept', 'application/json');
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, {
    ...init,
    headers,
  });

  if (!response.ok) {
    let code = 'REQUEST_FAILED';
    let message = `Request failed with status ${String(response.status)}`;

    try {
      const body = (await response.json()) as ApiErrorBody;
      code = body.error.code;
      message = body.error.message;
    } catch {
      // Keep the fallback message when the body is not JSON.
    }

    throw new ApiError(response.status, code, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const body = (await response.json()) as ApiSuccess<T>;
  return body.data;
}

export function fetchSettings(): Promise<AppSettings> {
  return request<AppSettings>('/api/settings');
}

export function fetchDashboard(range: DashboardRange): Promise<DashboardData> {
  const params = new URLSearchParams({ range });
  return request<DashboardData>(`/api/dashboard?${params.toString()}`);
}

export function fetchCategories(
  includeArchived = false,
): Promise<Category[]> {
  const params = new URLSearchParams();
  if (includeArchived) {
    params.set('includeArchived', 'true');
  }
  const query = params.toString();
  return request<Category[]>(
    query.length > 0 ? `/api/categories?${query}` : '/api/categories',
  );
}

export function fetchSnapshot(date: string): Promise<SnapshotDetails> {
  return request<SnapshotDetails>(`/api/snapshots/${date}`);
}

export function putSnapshot(
  date: string,
  payload: UpsertSnapshotPayload,
): Promise<SnapshotDetails> {
  return request<SnapshotDetails>(`/api/snapshots/${date}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteSnapshot(date: string): Promise<void> {
  await request<undefined>(`/api/snapshots/${date}`, {
    method: 'DELETE',
  });
}
