import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { sseManager } from '../lib/sse';
import { preloadCriticalImageAsset } from '../utils/imagePreloader';

interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('auth_token'));
  const [loading, setLoading] = useState(true);

  /**
   * Smoothly transitions and removes the initial startup splash screen overlay
   * ("Initializing Enterprise Suite..."). Applies a 500ms cubic-bezier opacity transition
   * to guarantee an elegant, flicker-free visual handoff to the application.
   */
  const dismissSplashScreen = useCallback(() => {
    if (typeof window !== 'undefined') {
      const splash = document.getElementById('pwa-splash-screen');
      if (splash && !splash.classList.contains('pointer-events-none')) {
        splash.classList.add('pointer-events-none');
        splash.style.transition = 'opacity 500ms cubic-bezier(0.4, 0, 0.2, 1)';
        splash.style.opacity = '0';
        splash.style.pointerEvents = 'none';
        setTimeout(() => {
          splash.remove();
        }, 550);
      }
    }
  }, []);

  /**
   * Initializes application authentication in parallel with preloading the critical
   * Reliance hero background image (/images/editorial/hero-denim.jpg).
   *
   * Keeps the loading screen visible until BOTH the initialization state resolves
   * AND the hero background image has finished downloading/decoding.
   * A strict 2.5-second safety timeout guarantees the app never blocks if an asset fails.
   */
  const fetchUser = useCallback(async () => {
    const storedToken = localStorage.getItem('auth_token');

    // Preload & hardware-decode flagship hero background image to eliminate visual flashing
    const heroPreloadPromise = preloadCriticalImageAsset('/images/editorial/hero-denim.jpg', 2500);

    const authInitPromise = (async () => {
      if (!storedToken) {
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUser({ id: data.id, name: data.name, email: data.email || '', role: data.role });
        } else {
          localStorage.removeItem('auth_token');
          setToken(null);
          // STRICT ROUTE GUARD: Only redirect unauthenticated requests if accessing protected /system/* suite
          // Public Storefront routes (/, /shop, /about, /contact) load freely with zero auth redirection
          if (typeof window !== 'undefined' && window.location.pathname.startsWith('/system')) {
            window.location.href = '/login';
          }
        }
      } catch {
        // Offline — keep existing state
      }
    })();

    try {
      // Keep loading screen visible until both auth state resolves AND hero background is decoded
      await Promise.all([authInitPromise, heroPreloadPromise]);
    } finally {
      setLoading(false);
      dismissSplashScreen();
    }
  }, [dismissSplashScreen]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Login failed');
    }
    const data = await res.json();
    localStorage.setItem('auth_token', data.token);
    setToken(data.token);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    // Explicitly destroy the SSE EventSource stream connection immediately to prevent ghost connections
    sseManager.disconnect();
    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
  }, []);

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