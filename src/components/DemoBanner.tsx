import React from 'react';
import { useNavigate } from 'react-router-dom';
import { RotateCcw, MessageCircle, Sparkles, Shield } from 'lucide-react';
import { BRAND, IS_DEMO_MODE } from '../config/brand';
import { resetDemoDb } from '../demo/mockApi';
import { useAuth } from '../contexts/AuthContext';

const DEMO_ROLES = [
  { label: 'Admin', email: 'admin@nebulainfinite.com', role: 'ADMIN', targetRoute: '/system/dashboard' },
  { label: 'Cashier', email: 'cashier@nebulainfinite.com', role: 'CASHIER', targetRoute: '/system/quick-invoice' },
  { label: 'Sales Rep', email: 'rep@nebulainfinite.com', role: 'REP', targetRoute: '/system/invoices' },
] as const;

/**
 * DemoBanner — Slim sticky top bar rendered exclusively when `VITE_DEMO_MODE === 'true'`.
 *
 * Displays:
 * - "Live Interactive Demo — Apex Apparel ERP by Nebula Infinite (Sample Data)"
 * - Instant Role Switcher (`Admin` | `Cashier` | `Sales Rep`) that switches session role
 *   without logging out and navigates to an allowed route for that role
 * - "Reset Demo Data" button that clears & re-seeds `localStorage` (`nebula_demo_erp_v1`) and reloads
 * - Direct WhatsApp inquiry button (`https://wa.me/94783233760`)
 */
export const DemoBanner: React.FC = () => {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  if (!IS_DEMO_MODE) return null;

  const handleResetDemo = () => {
    resetDemoDb();
    window.location.reload();
  };

  const handleSwitchRole = async (email: string, targetRoute: string) => {
    await login(email, 'demo1234');
    localStorage.setItem('reliance_last_active_route', targetRoute);
    navigate(targetRoute, { replace: true });
  };

  return (
    <div className="sticky top-0 z-[60] w-full bg-zinc-950 text-zinc-100 border-b border-emerald-500/30 px-3 sm:px-6 py-1.5 text-[11px] sm:text-xs shadow-sm">
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
                  onClick={() => handleSwitchRole(item.email, item.targetRoute)}
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
