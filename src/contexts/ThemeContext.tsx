import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

export type Theme = 'light' | 'dark' | 'system';

export interface ThemeContextType {
  /** Selected theme preference: 'light' | 'dark' | 'system' */
  theme: Theme;
  /** Effective theme computed from preference and OS dark mode: 'light' | 'dark' */
  resolvedTheme: 'light' | 'dark';
  /** Shorthand boolean indicating whether the effective theme is dark */
  isDark: boolean;
  /** Cycle or toggle between light and dark modes */
  toggleTheme: () => void;
  /** Explicitly set theme preference */
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const STORAGE_KEY = 'reliance-theme';

/**
 * Get initial theme preference from localStorage with universal default fallback to 'system'.
 */
export const getInitialTheme = (): 'light' | 'dark' | 'system' => {
  if (typeof window === 'undefined') return 'system';
  try {
    const savedTheme = localStorage.getItem(STORAGE_KEY);
    if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {
      return savedTheme as 'light' | 'dark' | 'system';
    }
  } catch {
    // Ignore localStorage access failures (e.g. incognito/sandboxed iframes)
  }
  return 'system'; // Universal default for both Storefront and System
};

/**
 * Apply target theme class and colorScheme attribute to document.documentElement.
 */
export const applyTheme = (targetTheme: 'light' | 'dark'): void => {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;
  if (targetTheme === 'dark') {
    root.classList.add('dark');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
  }
};

/**
 * ThemeProvider — Enterprise-grade theme engine supporting 'light', 'dark', and 'system' preferences.
 * Defaults globally to 'system', dynamically listens for OS media-query changes,
 * and maintains continuous synchronization across Public Storefront, Protected System (/system/*),
 * and Login Portal (/login).
 */
export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);
  const [systemDark, setSystemDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Dynamic real-time listener for OS preference changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    // Ensure state matches the current OS preference immediately
    setSystemDark(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setSystemDark(e.matches);
      if (theme === 'system') {
        applyTheme(e.matches ? 'dark' : 'light');
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      // @ts-ignore - legacy Safari fallback
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        // @ts-ignore - legacy Safari fallback
        mediaQuery.removeListener(handleChange);
      }
    };
  }, [theme]);

  // Compute resolved active theme ('light' or 'dark')
  const resolvedTheme: 'light' | 'dark' =
    theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  // Apply theme class to documentElement and persist to storage
  useEffect(() => {
    applyTheme(resolvedTheme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Ignore quota/security errors
    }
  }, [theme, resolvedTheme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const currentResolved = prev === 'system' ? (systemDark ? 'dark' : 'light') : prev;
      return currentResolved === 'dark' ? 'light' : 'dark';
    });
  }, [systemDark]);

  const isDark = resolvedTheme === 'dark';

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, isDark, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
};
