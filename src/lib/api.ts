const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/** Global timeout in milliseconds for extreme latency on weak 3G/4G networks (60s) */
export const DEFAULT_TIMEOUT_MS = 60000;
/** Default maximum retry attempts for failed/timed-out requests */
export const DEFAULT_MAX_RETRIES = 3;
/** Initial exponential backoff delay in milliseconds (1000ms -> 2000ms -> 4000ms) */
export const INITIAL_RETRY_DELAY_MS = 1000;

export interface RequestOptions extends RequestInit {
  timeoutMs?: number;
  retries?: number;
  retryDelay?: number;
}

/**
 * Intercept and broadcast network-level offline events after retries have failed.
 * Dispatches 'app:network-offline' to trigger OfflineSentinel without exposing
 * uncaught raw alert dialogs or prematurely triggering during transient retries.
 */
function notifyNetworkOffline(error: unknown): void {
  const msg = error instanceof Error ? error.message : String(error);
  const isNetworkFailure =
    error instanceof TypeError ||
    msg.includes('Failed to fetch') ||
    msg.includes('ERR_CONNECTION_REFUSED') ||
    msg.includes('ERR_NETWORK_CHANGED') ||
    msg.includes('ERR_INTERNET_DISCONNECTED') ||
    msg.includes('NetworkError') ||
    msg.includes('fetch failed') ||
    msg.includes('Load failed');

  if (isNetworkFailure && typeof window !== 'undefined') {
    window.dispatchEvent(new Event('app:network-offline'));
  }
}

/**
 * Determines whether an error is a network or request timeout.
 */
function isTimeoutError(error: unknown, timedOutFlag = false): boolean {
  if (timedOutFlag) return true;
  if (!error) return false;
  if (error instanceof DOMException && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
    return true;
  }
  if (error instanceof Error) {
    if (error.name === 'TimeoutError') return true;
    const msg = error.message.toLowerCase();
    return (
      msg.includes('timeout') ||
      msg.includes('timed out') ||
      msg.includes('econnaborted') ||
      msg.includes('etimedout')
    );
  }
  return false;
}

/**
 * Determines whether an error is a low-level network failure (DNS, offline, socket drop).
 */
function isNetworkError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof TypeError) return true;
  if (error instanceof Error) {
    const msg = error.message;
    return (
      msg.includes('Failed to fetch') ||
      msg.includes('ERR_CONNECTION_REFUSED') ||
      msg.includes('ERR_NETWORK_CHANGED') ||
      msg.includes('ERR_INTERNET_DISCONNECTED') ||
      msg.includes('ERR_CONNECTION_RESET') ||
      msg.includes('ERR_CONNECTION_TIMED_OUT') ||
      msg.includes('NetworkError') ||
      msg.includes('fetch failed') ||
      msg.includes('Load failed') ||
      msg.includes('Network request failed')
    );
  }
  return false;
}

/**
 * Determines whether a failed request is eligible for an automatic retry.
 * - 4xx client errors are never retried.
 * - Timeouts and ECONNABORTED errors are retried across all methods.
 * - 502/503/504 gateway/proxy errors are retried.
 * - Low-level network failures are retried.
 * - GET requests retry on any 5xx server errors.
 */
function shouldRetry(
  error: unknown,
  response: Response | undefined,
  method: string,
  isTimedOut: boolean
): boolean {
  if (response && response.status >= 400 && response.status < 500) {
    return false;
  }

  if (isTimeoutError(error, isTimedOut)) {
    return true;
  }

  if (response && (response.status === 502 || response.status === 503 || response.status === 504)) {
    return true;
  }

  if (isNetworkError(error)) {
    return true;
  }

  if (method.toUpperCase() === 'GET' && response && response.status >= 500) {
    return true;
  }

  return false;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Resilient fetch wrapper with configurable per-request timeout and exponential backoff retry.
 */
export async function fetchWithRetry(url: string, options: RequestOptions = {}): Promise<Response> {
  const method = (options.method || 'GET').toUpperCase();
  const maxRetries = options.retries ?? DEFAULT_MAX_RETRIES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const initialDelay = options.retryDelay ?? INITIAL_RETRY_DELAY_MS;

  let lastError: unknown = null;
  let lastWasTimeout = false;
  let lastResponse: Response | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      // Exponential backoff: 1000ms -> 2000ms -> 4000ms
      const backoffDelay = initialDelay * Math.pow(2, attempt - 1);
      await sleep(backoffDelay);
    }

    const controller = new AbortController();
    let isTimedOut = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    if (timeoutMs > 0) {
      timeoutId = setTimeout(() => {
        isTimedOut = true;
        try {
          controller.abort(new DOMException(`Request timed out after ${timeoutMs}ms`, 'TimeoutError'));
        } catch {
          controller.abort();
        }
      }, timeoutMs);
    }

    const onCallerAbort = () => {
      try {
        controller.abort(options.signal?.reason);
      } catch {
        controller.abort();
      }
    };

    if (options.signal) {
      if (options.signal.aborted) {
        if (timeoutId) clearTimeout(timeoutId);
        throw options.signal.reason || new DOMException('Aborted', 'AbortError');
      }
      options.signal.addEventListener('abort', onCallerAbort, { once: true });
    }

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      if (!response.ok && shouldRetry(null, response, method, false)) {
        lastResponse = response;
        lastWasTimeout = response.status === 504;
        lastError = new Error(`Server responded with HTTP ${response.status}`);
        if (attempt === maxRetries) {
          return response;
        }
        continue;
      }

      return response;
    } catch (err: unknown) {
      // If user intentionally aborted caller signal (and not our timeout), bubble immediately
      if (options.signal?.aborted && !isTimedOut) {
        throw err;
      }

      const timedOut = isTimeoutError(err, isTimedOut);
      lastError = err;
      lastWasTimeout = timedOut;

      const canRetry = attempt < maxRetries && shouldRetry(err, undefined, method, timedOut);
      if (!canRetry) {
        break;
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      if (options.signal) {
        options.signal.removeEventListener('abort', onCallerAbort);
      }
    }
  }

  // Intercept and return user-friendly error after all retries fail
  if (lastWasTimeout) {
    throw new Error('Slow internet connection. Please move to an area with a better signal and try again.');
  }

  if (isNetworkError(lastError)) {
    notifyNetworkOffline(lastError);
    throw new Error('Network connection failed. Please check your signal and try again.');
  }

  if (lastResponse) {
    return lastResponse;
  }

  notifyNetworkOffline(lastError);
  throw lastError instanceof Error ? lastError : new Error(String(lastError || 'Network request failed'));
}

export async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  // Strip duplicate '/api' prefix if caller already included it
  const cleanEndpoint = endpoint.replace(/^\/?api\//, '/');
  const url = `${BASE_URL}${cleanEndpoint.startsWith('/') ? cleanEndpoint : `/${cleanEndpoint}`}`;

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

  const response = await fetchWithRetry(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    // 401 Unauthorized Session Handling
    if (response.status === 401) {
      localStorage.removeItem('auth_token');
      // STRICT ROUTING GUARD: Only redirect unauthenticated requests if accessing protected /system/* suite
      // Allow public storefront routes (/, /shop, /about, /contact) to remain accessible without interruption
      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/system')) {
        window.location.href = '/login';
      }
    }

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

export const get = <T>(endpoint: string, options?: RequestOptions) =>
  request<T>(endpoint, { ...options, method: 'GET' });

export const post = <T>(endpoint: string, body?: any, options?: RequestOptions) =>
  request<T>(endpoint, {
    ...options,
    method: 'POST',
    body: body instanceof FormData ? body : JSON.stringify(body),
  });

export const patch = <T>(endpoint: string, body?: any, options?: RequestOptions) =>
  request<T>(endpoint, {
    ...options,
    method: 'PATCH',
    body: body instanceof FormData ? body : JSON.stringify(body),
  });

export const put = <T>(endpoint: string, body?: any, options?: RequestOptions) =>
  request<T>(endpoint, {
    ...options,
    method: 'PUT',
    body: body instanceof FormData ? body : JSON.stringify(body),
  });

export const del = <T>(endpoint: string, options?: RequestOptions) =>
  request<T>(endpoint, { ...options, method: 'DELETE' });

export const downloadBlob = async (endpoint: string, defaultFilename: string, options?: RequestOptions) => {
  const cleanEndpoint = endpoint.replace(/^\/?api\//, '/');
  const url = `${BASE_URL}${cleanEndpoint.startsWith('/') ? cleanEndpoint : `/${cleanEndpoint}`}`;
  const token = localStorage.getItem('auth_token');
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetchWithRetry(url, {
    ...options,
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
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