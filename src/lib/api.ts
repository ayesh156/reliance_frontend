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
    // ⭐ Backend එකෙන් එන message, error හෝ errors array එකෙන් පැහැදිලි පණිවිඩය කියවා ගැනීම
    const resolvedErrorMessage =
      data?.message ||
      data?.error ||
      (Array.isArray(data?.errors) ? data.errors[0] : null) ||
      `API Error ${response.status}: ${response.statusText}`;

    throw new Error(resolvedErrorMessage);
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

export const downloadBlob = async (endpoint: string, defaultFilename: string) => {
  const url = `${BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const token = localStorage.getItem('auth_token');
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    const errText = await response.text();
    let message = 'Failed to download file';
    try {
      const parsed = JSON.parse(errText);
      message = parsed.error || parsed.message || message;
    } catch {
      if (errText) message = errText;
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = defaultFilename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(downloadUrl);
};