import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { RotateCcw, MessageCircle, Sparkles, Shield } from 'lucide-react';
import { BRAND, IS_DEMO_MODE } from '../config/brand';
import { resetDemoDb } from '../demo/mockApi';
import { useAuth } from '../contexts/AuthContext';

const DEMO_ROLES = [
  { label: 'Admin', role: 'ADMIN' as const, targetRoute: '/system/dashboard' },
  { label: 'Cashier', role: 'CASHIER' as const, targetRoute: '/system/quick-invoice' },
  { label: 'Sales Rep', role: 'REP' as const, targetRoute: '/system/invoices' },
] as const;

/**
 * DemoBanner — Fixed top bar rendered exclusively when `VITE_DEMO_MODE === 'true'`.
 *
 * Uses a `ResizeObserver` to measure its live rendered height (handling both desktop
 * single-row and wrapped mobile layouts) and sets `--demo-banner-height` on
 * `document.documentElement` so all sticky/fixed headers, drawers, and sidebars
 * offset cleanly without overlap.
 */
export const DemoBanner: React.FC = () => {
  const { user, loginAsDemoRole } = useAuth();
  const navigate = useNavigate();
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (!IS_DEMO_MODE) {
      root.style.setProperty('--demo-banner-height', '0px');
      return;
    }

    const updateHeight = () => {
      const h = bannerRef.current ? Math.ceil(bannerRef.current.getBoundingClientRect().height) : 0;
      root.style.setProperty('--demo-banner-height', `${h}px`);
    };

    updateHeight();

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && bannerRef.current) {
      observer = new ResizeObserver(updateHeight);
      observer.observe(bannerRef.current);
    }
    window.addEventListener('resize', updateHeight);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateHeight);
      root.style.setProperty('--demo-banner-height', '0px');
    };
  }, []);

  if (!IS_DEMO_MODE) return null;

  const handleResetDemo = () => {
    resetDemoDb();
    window.location.reload();
  };

  const handleSwitchRole = async (role: 'ADMIN' | 'CASHIER' | 'REP', targetRoute: string) => {
    await loginAsDemoRole(role);
    localStorage.setItem('reliance_last_active_route', targetRoute);
    navigate(targetRoute, { replace: true });
  };

  return (
    <div
      ref={bannerRef}
      className="fixed top-0 left-0 right-0 z-[90] w-full bg-zinc-950 text-zinc-100 border-b border-emerald-500/30 px-3 sm:px-6 py-1.5 text-[11px] sm:text-xs shadow-sm"
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold text-[10px] uppercase tracking-wider shrink-0">
            <Sparkles className="w-3 h-3" />
            Live Demo
          </span>
          <span className="font-medium text-zinc-200 truncate">
            {BRAND.demoBannerText}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Instant Role Switcher */}
          <div className="inline-flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-md p-0.5">
            <span className="hidden md:inline-flex items-center gap-1 px-1.5 text-[10px] text-zinc-400 uppercase tracking-wider">
              <Shield className="w-3 h-3 text-emerald-400" />
              Role:
            </span>
            {DEMO_ROLES.map((item) => {
              const isActive = user?.role === item.role;
              return (
                <button
                  key={item.role}
                  type="button"
                  onClick={() => handleSwitchRole(item.role, item.targetRoute)}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleResetDemo}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 text-[11px] font-medium transition-colors cursor-pointer"
            title="Reset sample data in localStorage to initial state"
          >
            <RotateCcw className="w-3 h-3 text-amber-400" />
            <span>Reset Demo Data</span>
          </button>

          <a
            href={BRAND.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold transition-colors"
          >
            <MessageCircle className="w-3 h-3" />
            <span>WhatsApp Inquiry</span>
          </a>
        </div>
      </div>
    </div>
  );
};
