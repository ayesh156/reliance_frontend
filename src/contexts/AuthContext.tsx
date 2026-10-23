import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { sseManager } from '../lib/sse';
import { preloadCriticalImageAsset } from '../utils/imagePreloader';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
  permissions?: string[];
}

/** Default permissions strictly injected for Staff accounts */
export const DEFAULT_STAFF_PERMISSIONS = ['production', 'line', 'wash', 'materials'];

/**
 * Safely parse JWT payload to extract user info if auth_user is not yet cached.
 */
function parseJwtPayload(token: string): Partial<AuthUser> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const parsed = JSON.parse(jsonPayload);
    if (!parsed || !parsed.userId) return null;
    const role = parsed.role || 'STAFF';
    return {
      id: parsed.userId,
      name: parsed.name || 'User',
      email: parsed.email || '',
      role,
      permissions: parsed.permissions || (role === 'STAFF' ? DEFAULT_STAFF_PERMISSIONS : []),
    };
  } catch {
    return null;
  }
}

/**
 * Synchronously retrieve cached user from localStorage or decode token.
 */
function getInitialUser(storedToken: string | null): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem('auth_user');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.id) {
        if (!parsed.permissions && parsed.role === 'STAFF') {
          parsed.permissions = DEFAULT_STAFF_PERMISSIONS;
        }
        return parsed;
      }
    }
    if (storedToken) {
      const decoded = parseJwtPayload(storedToken);
      if (decoded && decoded.id) {
        return {
          id: decoded.id,
          name: decoded.name || 'User',
          email: decoded.email || '',
          role: decoded.role || 'STAFF',
          permissions: decoded.permissions || (decoded.role === 'STAFF' ? DEFAULT_STAFF_PERMISSIONS : []),
        };
      }
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

/**
 * AuthContext — Central authentication and session management provider.
 * 
 * Post-Login Default Landing Architecture:
 * - Successful authentication (via Login portal or token restore) establishes active user state.
 * - The application enforces `/system/invoices` as the default landing destination (instead of
 *   dashboard or legacy views) across all devices (mobile and desktop).
 * - Public storefront routes remain unauthenticated, while `/system/*` routes require active auth
 *   and will redirect to `/login` if session is invalid.
 */
interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isRep: boolean;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('auth_token');
  });

  const [user, setUser] = useState<AuthUser | null>(() => {
    const storedToken = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    return getInitialUser(storedToken);
  });

  // Fast synchronous unblocking: loading is immediately false if cached user exists or no token exists
  const [loading, setLoading] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const storedToken = localStorage.getItem('auth_token');
    if (!storedToken) return false;
    const initialUser = getInitialUser(storedToken);
    return !initialUser;
  });

  /**
   * Smoothly transitions and removes the initial startup splash screen overlay
   */
  const dismissSplashScreen = useCallback(() => {
    if (typeof window !== 'undefined') {
      const splash = document.getElementById('pwa-splash-screen');
      if (splash && !splash.classList.contains('pointer-events-none')) {
        splash.classList.add('pointer-events-none');
        splash.style.transition = 'opacity 300ms cubic-bezier(0.4, 0, 0.2, 1)';
        splash.style.opacity = '0';
        splash.style.pointerEvents = 'none';
        setTimeout(() => {
          splash.remove();
        }, 350);
      }
    }
  }, []);

  /**
   * Performs silent background session validation without blocking initial UI render.
   * Only clears session if server explicitly returns 401 Unauthorized.
   */
  const fetchUser = useCallback(async () => {
    const storedToken = localStorage.getItem('auth_token');
    if (!storedToken) {
      setLoading(false);
      dismissSplashScreen();
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${storedToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        const role = data.role || 'STAFF';
        const permissions: string[] = Array.isArray(data.permissions) && data.permissions.length > 0
          ? data.permissions
          : (role === 'STAFF' ? DEFAULT_STAFF_PERMISSIONS : []);

        const verifiedUser: AuthUser = {
          id: data.id,
          name: data.name,
          email: data.email || '',
          role,
          permissions,
        };
        setUser(verifiedUser);
        localStorage.setItem('auth_user', JSON.stringify(verifiedUser));
      } else if (res.status === 401) {
        // STRICT: Only clear session if explicitly 401 Unauthorized
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        setToken(null);
        setUser(null);
        if (typeof window !== 'undefined' && window.location.pathname.startsWith('/system')) {
          window.location.href = '/login';
        }
      }
      // If 5xx or temporary network issue: keep cached session intact
    } catch {
      // Offline / network timeout on slow 4G — preserve cached session without blocking or kicking user out
    } finally {
      setLoading(false);
      dismissSplashScreen();
    }
  }, [dismissSplashScreen]);

  useEffect(() => {
    // If hydrated synchronously from cache or visitor, dismiss splash screen immediately
    const storedToken = localStorage.getItem('auth_token');
    const cachedUser = getInitialUser(storedToken);
    if (!storedToken || cachedUser) {
      dismissSplashScreen();
    }

    // Background validation
    fetchUser();

    // Preload hero background image non-blockingly in background
    preloadCriticalImageAsset('/images/editorial/hero-denim.jpg', 2500).catch(() => {});
  }, [dismissSplashScreen, fetchUser]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Login failed');
    }
    const data = await res.json();
    const role = data.user.role || 'STAFF';
    const permissions: string[] = Array.isArray(data.user.permissions) && data.user.permissions.length > 0
      ? data.user.permissions
      : (role === 'STAFF' ? DEFAULT_STAFF_PERMISSIONS : []);

    const loggedUser: AuthUser = {
      id: data.user.id,
      name: data.user.name,
      email: data.user.email || '',
      role,
      permissions,
    };
    localStorage.setItem('auth_token', data.token);
    localStorage.setItem('auth_user', JSON.stringify(loggedUser));
    setToken(data.token);
    setUser(loggedUser);
  }, []);

  const logout = useCallback(() => {
    sseManager.disconnect();
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setToken(null);
    setUser(null);
  }, []);

  /**
   * Dynamic Permission checker.
   * - Administrators automatically bypass all checks.
   * - Staff users require the specific module permission token.
   */
  const hasPermission = useCallback((permission: string): boolean => {
    if (!user) return false;
    if (user.role === 'ADMIN') return true;
    if (!permission) return true;
    const permissions = user.permissions || (user.role === 'STAFF' ? DEFAULT_STAFF_PERMISSIONS : []);
    return permissions.includes(permission);
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
        isAuthenticated: !!user && !!token,
        isAdmin: user?.role === 'ADMIN',
        isRep: user?.role === 'REP',
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};