const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5000';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface ApiOptions {
  method?: HttpMethod;
  body?: unknown;
  signal?: AbortSignal;
}

class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let isRefreshing = false;
let refreshPromise: Promise<void> | null = null;

async function refreshTokens(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) {
    throw new ApiError(res.status, 'REFRESH_FAILED', 'Session expired. Please log in again.');
  }
}

export async function apiFetch<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, signal } = opts;

  const fetchOpts: RequestInit = {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    signal,
    ...(body ? { body: JSON.stringify(body) } : {}),
  };

  let res = await fetch(`${API_BASE}${path}`, fetchOpts);

  // Silent refresh on 401
  if (res.status === 401) {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = refreshTokens().finally(() => {
        isRefreshing = false;
        refreshPromise = null;
      });
    }

    try {
      await refreshPromise;
    } catch {
      // Refresh failed — propagate original 401
      const body = (await res.json()) as { error?: string; code?: string };
      throw new ApiError(401, body.code ?? 'UNAUTHORIZED', body.error ?? 'Unauthorized');
    }

    // Retry original request
    res = await fetch(`${API_BASE}${path}`, fetchOpts);
  }

  if (!res.ok) {
    let errorBody: { error?: string; code?: string } = {};
    try {
      errorBody = (await res.json()) as typeof errorBody;
    } catch {
      // ignore parse failure
    }
    throw new ApiError(res.status, errorBody.code ?? 'REQUEST_FAILED', errorBody.error ?? 'Request failed');
  }

  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => apiFetch<T>(path, { method: 'GET', signal }),
  post: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'DELETE', body }),
};

export { ApiError };
