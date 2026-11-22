// NEXT_PUBLIC_API_BASE_URL is inlined at build time; next.config.ts falls back to the old VITE_API_BASE_URL
// so existing deployment settings keep working.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

export async function apiRequest(endpoint: string, options: ApiRequestOptions = {}) {
  // Ensure endpoint starts with a slash
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}/api/v1${normalizedEndpoint}`;

  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  const { body, headers, ...init } = options;
  const config: RequestInit = {
    ...init,
    headers: {
      ...defaultHeaders,
      ...headers,
    },
  };

  if (body && typeof body === 'object') {
    config.body = JSON.stringify(body);
  } else if (body) {
    config.body = body as BodyInit;
  }

  const response = await fetch(url, config);
  const data = await response.json();

  if (!response.ok || (data && data.success === false)) {
    throw new Error(data.detail || data.message || 'API request failed');
  }

  return data;
}
