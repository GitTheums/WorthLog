import type {
  ApiErrorBody,
  ApiSuccess,
  AppSettings,
  AuthStatus,
  BackupExport,
  BackupImportResult,
  Category,
  CategoryDeletionImpact,
  CreateCategoryPayload,
  DashboardData,
  DashboardRange,
  DeleteCategoryResult,
  SnapshotDetails,
  UpdateCategoryPayload,
  UpsertSnapshotPayload,
} from './types';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type PortfolioLockedHandler = () => void;

let portfolioLockedHandler: PortfolioLockedHandler | null = null;

/** Register a handler invoked when any API returns PORTFOLIO_LOCKED. */
export function setPortfolioLockedHandler(
  handler: PortfolioLockedHandler | null,
): void {
  portfolioLockedHandler = handler;
}

function getRetryAfterSeconds(details: unknown): number | undefined {
  if (!details || typeof details !== 'object' || !('retryAfterSeconds' in details)) {
    return undefined;
  }
  const value = details.retryAfterSeconds;
  return typeof value === 'number' ? value : undefined;
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
    credentials: 'same-origin',
  });

  if (!response.ok) {
    let code = 'REQUEST_FAILED';
    let message = `Request failed with status ${String(response.status)}`;
    let details: unknown;

    try {
      const body = (await response.json()) as ApiErrorBody;
      code = body.error.code;
      message = body.error.message;
      details = body.error.details;
    } catch {
      // Keep the fallback message when the body is not JSON.
    }

    if (code === 'PORTFOLIO_LOCKED') {
      portfolioLockedHandler?.();
    }

    throw new ApiError(response.status, code, message, details);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const body = (await response.json()) as ApiSuccess<T>;
  return body.data;
}

export function fetchAuthStatus(): Promise<AuthStatus> {
  return request<AuthStatus>('/api/auth/status');
}

export function setupPin(pin: string): Promise<AuthStatus> {
  return request<AuthStatus>('/api/auth/setup', {
    method: 'POST',
    body: JSON.stringify({ pin }),
  });
}

export function unlockPortfolio(pin: string): Promise<AuthStatus> {
  return request<AuthStatus>('/api/auth/unlock', {
    method: 'POST',
    body: JSON.stringify({ pin }),
  });
}

export function lockPortfolio(): Promise<{ locked: boolean }> {
  return request<{ locked: boolean }>('/api/auth/lock', {
    method: 'POST',
  });
}

export function changePin(
  currentPin: string,
  newPin: string,
): Promise<AuthStatus> {
  return request<AuthStatus>('/api/auth/change-pin', {
    method: 'POST',
    body: JSON.stringify({ currentPin, newPin }),
  });
}

export function removePin(currentPin: string): Promise<AuthStatus> {
  return request<AuthStatus>('/api/auth/pin', {
    method: 'DELETE',
    body: JSON.stringify({ currentPin }),
  });
}

export function getApiErrorRetryAfterSeconds(error: unknown): number | null {
  if (!(error instanceof ApiError)) {
    return null;
  }
  const value = getRetryAfterSeconds(error.details);
  return value ?? null;
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

export function fetchCategoryDeletionImpact(
  id: string,
): Promise<CategoryDeletionImpact> {
  return request<CategoryDeletionImpact>(
    `/api/categories/${id}/deletion-impact`,
  );
}

export function deleteCategory(id: string): Promise<DeleteCategoryResult> {
  return request<DeleteCategoryResult>(`/api/categories/${id}`, {
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
