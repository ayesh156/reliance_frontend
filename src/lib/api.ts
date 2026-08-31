const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  // 1. LocalStorage එකෙන් Token එක ලබා ගැනීම
  const token = localStorage.getItem('auth_token');

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  // 2. Token එකක් තිබේ නම් Bearer Header එක එක් කිරීම
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // FormData නොවන JSON payloads සඳහා Content-Type සැකසීම
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || `API Error ${response.status}: ${response.statusText}`);
  }

  return data as T;
}

export const get = <T>(endpoint: string, options?: RequestInit) =>
  request<T>(endpoint, { ...options, method: 'GET' });

export const post = <T>(endpoint: string, body?: any, options?: RequestInit) =>
  request<T>(endpoint, {
    ...options,
    method: 'POST',
    body: body instanceof FormData ? body : JSON.stringify(body),
  });

export const patch = <T>(endpoint: string, body?: any, options?: RequestInit) =>
  request<T>(endpoint, {
    ...options,
    method: 'PATCH',
    body: body instanceof FormData ? body : JSON.stringify(body),
  });

export const put = <T>(endpoint: string, body?: any, options?: RequestInit) =>
  request<T>(endpoint, {
    ...options,
    method: 'PUT',
    body: body instanceof FormData ? body : JSON.stringify(body),
  });

export const del = <T>(endpoint: string, options?: RequestInit) =>
  request<T>(endpoint, { ...options, method: 'DELETE' });