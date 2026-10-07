/**
 * Image URL Normalizer & Resolver Utility Engine
 * Converts Google Drive sharing links to direct zero-CORS thumbnail CDN URLs
 * and resolves local/remote asset endpoints.
 */

/**
 * Extracts Google Drive file ID from any standard or non-standard Google Drive URL format.
 */
export function extractGoogleDriveFileId(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();

  // Match /file/d/{id} or /d/{id} on Google Drive / Docs / GoogleUserContent domains
  const fileDMatch = trimmed.match(/(?:drive\.google\.com|docs\.google\.com|lh3\.googleusercontent\.com)\/(?:file\/d|d)\/([a-zA-Z0-9_-]+)/i);
  if (fileDMatch && fileDMatch[1]) {
    return fileDMatch[1];
  }

  // Match id={id} in query parameters across Google Drive endpoints
  if (
    trimmed.includes('drive.google.com') ||
    trimmed.includes('docs.google.com') ||
    trimmed.includes('drive.usercontent.google.com') ||
    trimmed.includes('googleusercontent.com')
  ) {
    const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/i);
    if (idParamMatch && idParamMatch[1]) {
      return idParamMatch[1];
    }
  }

  return null;
}

/**
 * Checks if a string is a Google Drive asset URL.
 */
export function isGoogleDriveUrl(url?: string | null): boolean {
  return Boolean(extractGoogleDriveFileId(url));
}

/**
 * Normalizes any image URL: converts Google Drive sharing URLs to direct zero-CORS thumbnail CDN URLs.
 */
export function normalizeImageUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  const fileId = extractGoogleDriveFileId(trimmed);
  if (fileId) {
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
  }

  return trimmed;
}

/**
 * Resolves full display image URL handling local API paths, Google Drive URLs, and external web links.
 */
export function resolveImageUrl(path?: string | null): string {
  if (!path) return '';
  const normalized = normalizeImageUrl(path);
  if (!normalized) return '';

  if (
    normalized.startsWith('http://') ||
    normalized.startsWith('https://') ||
    normalized.startsWith('data:') ||
    normalized.startsWith('blob:')
  ) {
    return normalized;
  }

  const apiHost = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
    : 'http://localhost:5000';

  const cleanPath = normalized.replace(/^\/?api\/?/, '');
  return `${apiHost}${cleanPath.startsWith('/') ? '' : '/'}${cleanPath}`;
}
