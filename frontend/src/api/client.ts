export class ApiClientError extends Error {
  code: string;
  details?: unknown;
  status: number;
  requestId?: string;

  constructor(message: string, code: string, details?: unknown, status: number = 500, requestId?: string) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.details = details;
    this.status = status;
    this.requestId = requestId;
  }
}

export interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined | null>;
  token?: string | null;
  idempotencyKey?: string | null;
}

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/+$/, '');

function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token') || localStorage.getItem('token');
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { params, token, idempotencyKey, headers: customHeaders, body, ...fetchOptions } = options;

  let normalizedEndpoint = endpoint;
  if (!normalizedEndpoint.startsWith('http://') && !normalizedEndpoint.startsWith('https://')) {
    if (!normalizedEndpoint.startsWith('/')) {
      normalizedEndpoint = `/${normalizedEndpoint}`;
    }
    if (!normalizedEndpoint.startsWith('/api/')) {
      normalizedEndpoint = `/api/v1${normalizedEndpoint}`;
    }
  }

  let url = normalizedEndpoint.startsWith('http://') || normalizedEndpoint.startsWith('https://')
    ? normalizedEndpoint
    : `${API_BASE_URL}${normalizedEndpoint}`;

  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  const headers = new Headers(customHeaders);

  if (idempotencyKey && !headers.has('Idempotency-Key')) {
    headers.set('Idempotency-Key', idempotencyKey);
  }

  const activeToken = token ?? getStoredToken();
  if (activeToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${activeToken}`);
  }

  let processedBody = body;
  if (body !== undefined && body !== null && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof Blob)) {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    processedBody = JSON.stringify(body);
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
    body: processedBody,
  });

  let responseData: any = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      responseData = await response.json();
    } catch {
      responseData = null;
    }
  } else {
    try {
      responseData = await response.text();
    } catch {
      responseData = null;
    }
  }

  if (!response.ok) {
    if (responseData && responseData.error) {
      const err = responseData.error;
      throw new ApiClientError(
        err.message || 'API request failed',
        err.code || 'API_ERROR',
        err.details,
        response.status,
        err.requestId
      );
    }

    throw new ApiClientError(
      response.statusText || 'API request failed',
      `HTTP_${response.status}`,
      responseData,
      response.status
    );
  }

  return responseData as T;
}

export const api = {
  request,
  get: <T>(endpoint: string, options?: RequestOptions): Promise<T> =>
    request<T>(endpoint, { ...options, method: 'GET' }),
  post: <T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> =>
    request<T>(endpoint, { ...options, method: 'POST', body: data as any }),
  patch: <T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> =>
    request<T>(endpoint, { ...options, method: 'PATCH', body: data as any }),
  put: <T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> =>
    request<T>(endpoint, { ...options, method: 'PUT', body: data as any }),
  delete: <T>(endpoint: string, options?: RequestOptions): Promise<T> =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),
};

export default api;
