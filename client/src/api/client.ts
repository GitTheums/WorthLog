import type {
  ApiErrorBody,
  ApiSuccess,
  AppSettings,
  BackupExport,
  BackupImportResult,
  Category,
  CreateCategoryPayload,
  DashboardData,
  DashboardRange,
  SnapshotDetails,
  UpdateCategoryPayload,
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

export function patchSettings(
  patch: Partial<AppSettings>,
): Promise<AppSettings> {
  return request<AppSettings>('/api/settings', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
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

export function createCategory(
  payload: CreateCategoryPayload,
): Promise<Category> {
  return request<Category>('/api/categories', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateCategory(
  id: string,
  payload: UpdateCategoryPayload,
): Promise<Category> {
  return request<Category>(`/api/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteCategory(id: string): Promise<void> {
  await request<undefined>(`/api/categories/${id}`, {
    method: 'DELETE',
  });
}

export function reorderCategories(categoryIds: string[]): Promise<Category[]> {
  return request<Category[]>('/api/categories/reorder', {
    method: 'POST',
    body: JSON.stringify({ categoryIds }),
  });
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

export function exportBackup(): Promise<BackupExport> {
  return request<BackupExport>('/api/backup/export');
}

export function importBackup(payload: BackupExport): Promise<BackupImportResult> {
  return request<BackupImportResult>('/api/backup/import', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
