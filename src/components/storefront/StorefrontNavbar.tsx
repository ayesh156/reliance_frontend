import React, { useState, useEffect } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ThemeToggle, ThemeSegmentedSwitch } from '../ThemeToggle';
import {
  Lock,
  Menu,
  X,
  ArrowRight,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';

/**
 * StorefrontNavbar — Haute Couture luxury navigation bar inspired by Chanel.com.
 * Sits at absolute viewport top with frosted glass effect.
 * Seamlessly adapts to Light Haute Couture (Warm Alabaster Ivory #f8f8f6)
 * and Dark Haute Mode (Deep Obsidian #09090b).
 * 
 * Mobile optimization:
 * - Brand emblem & text locked to shrink-0 on left
 * - Compact right cluster: Portal icon shortcut, compact ThemeToggle, hamburger menu
 * - Zero overlap with hero headers or top badges
 * - Full-featured luxury slide-out drawer with crisp high-contrast typography
 */
export const StorefrontNavbar: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const navLinks = [
    { label: 'Home', path: '/' },
    { label: 'Shop', path: '/shop' },
    { label: 'About Us', path: '/about' },
    { label: 'Contact Us', path: '/contact' },
  ];

  return (
    <>
      {/* ── Main Chanel-Inspired Luxury Navbar — Frosted Glass ── */}
      <header
        className={`sticky top-0 z-50 w-full transition-all duration-500 ${
          scrolled
            ? 'bg-[#f8f8f6]/90 dark:bg-zinc-950/90 backdrop-blur-md border-b border-[#e5e5e0]/80 dark:border-zinc-800/60 shadow-sm dark:shadow-2xl dark:shadow-black/40 py-2.5 sm:py-3'
            : 'bg-[#f8f8f6]/95 dark:bg-zinc-950/95 backdrop-blur-sm border-b border-[#e5e5e0]/60 dark:border-zinc-900/60 py-3.5 sm:py-4'
        }`}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            {/* ── Brand Emblem & Title (Locked with shrink-0) ── */}
            <Link
              to="/"
              className="flex items-center gap-2.5 sm:gap-3 group text-left focus:outline-none shrink-0"
            >
              <div className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-sm overflow-hidden border border-zinc-300 dark:border-zinc-700/60 shadow-sm bg-white dark:bg-zinc-900 flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-105">
                <img
                  src="/images/logo.jpg"
                  alt="Reliance Emblem"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = '/images/reliance-placeholder.jpg';
                  }}
                />
              </div>
              <div className="shrink-0">
                <span className="block font-serif text-base sm:text-xl font-bold tracking-[0.22em] sm:tracking-[0.26em] text-zinc-950 dark:text-white uppercase group-hover:text-zinc-700 dark:group-hover:text-zinc-200 transition-colors">
                  RELIANCE
                </span>
                <span className="block text-[7.5px] sm:text-[9px] font-light tracking-[0.28em] sm:tracking-[0.32em] text-zinc-600 dark:text-zinc-400 uppercase">
                  Branded Mens Clothing
                </span>
              </div>
            </Link>

            {/* ── Center Desktop Nav Links ── */}
            <nav className="hidden md:flex items-center gap-8 lg:gap-10">
              {navLinks.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={`relative text-[11px] lg:text-xs uppercase tracking-[0.24em] font-medium transition-all py-1.5 ${
                      isActive
                        ? 'text-zinc-950 dark:text-white font-semibold'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                    }`}
                  >
                    {item.label}
                    {isActive && (
                      <span className="absolute bottom-0 left-0 w-full h-[1.5px] bg-zinc-950 dark:bg-white transition-all duration-300" />
                    )}
                  </NavLink>
                );
              })}
            </nav>

            {/* ── Right Portal & Theme Actions (Streamlined on Mobile) ── */}
            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              {/* Quick Shop Shortcut (Desktop / Tablet) */}
              <Link
                to="/shop"
                className="hidden sm:inline-flex items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white uppercase tracking-widest px-3 py-1.5 rounded-sm hover:bg-zinc-200/50 dark:hover:bg-zinc-900 transition-all"
                title="Browse Garments"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span className="hidden lg:inline text-[10px]">Catalog</span>
              </Link>

              {/* ── Desktop Theme Toggle Trigger ── */}
              <div className="hidden sm:flex items-center">
                <ThemeToggle />
              </div>

              {/* ── Desktop Luxury Portal Button ("System Portal") (>= 640px) ── */}
              <button
                id="storefront-system-portal-btn"
                onClick={() => {
                  if (isAuthenticated) {
                    navigate('/system/products');
                  } else {
                    navigate('/login');
                  }
                }}
                className="hidden sm:inline-flex group relative items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 text-[10px] sm:text-xs font-semibold uppercase tracking-[0.2em] rounded-sm transition-all duration-300 bg-zinc-950 text-white hover:bg-zinc-800 border border-zinc-950 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 dark:border-white shadow-sm"
              >
                {isAuthenticated ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-700" />
                    <span>System Portal</span>
                    <span className="hidden xl:inline text-[9px] text-zinc-300 dark:text-zinc-600 lowercase font-mono">
                      ({user?.name?.split(' ')[0] || 'Staff'})
                    </span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3 h-3 text-white dark:text-zinc-950 group-hover:scale-110 transition-transform" />
                    <span>System Portal</span>
                  </>
                )}
                <ArrowRight className="w-3 h-3 -mr-0.5 opacity-60 group-hover:translate-x-0.5 transition-transform" />
              </button>

              {/* ── Mobile Compact Portal Quick Icon Button (< 640px) ── */}
              <button
                type="button"
                onClick={() => navigate(isAuthenticated ? '/system/products' : '/login')}
                className="sm:hidden p-2 text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-200/50 dark:hover:bg-zinc-800/60 rounded-full transition-colors"
                title={isAuthenticated ? 'System Portal' : 'Staff Portal Login'}
                aria-label="Staff Portal"
              >
                {isAuthenticated ? (
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Lock className="w-4 h-4" />
                )}
              </button>

              {/* ── Mobile Compact Theme Toggle Trigger (< 640px) ── */}
              <div className="sm:hidden flex items-center">
                <ThemeToggle />
              </div>

              {/* ── Mobile Burger Menu Toggle ── */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 text-zinc-900 dark:text-zinc-100 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 rounded-sm focus:outline-none transition-colors"
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Luxury Mobile Navigation Drawer ── */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden animate-in fade-in duration-200"
          style={{ top: 0 }}
        >
          {/* Backdrop with frosted blur */}
          <div
            className="absolute inset-0 bg-[#f8f8f6]/95 dark:bg-zinc-950/95 backdrop-blur-2xl transition-colors"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer Content */}
          <div className="relative z-10 flex flex-col justify-between h-full pt-20 pb-8 px-6 overflow-y-auto">
            <div className="space-y-6 text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-300 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/70 text-zinc-700 dark:text-zinc-300 text-[10px] tracking-widest uppercase mb-2 shadow-sm">
                <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>Haute Couture · Matara, Sri Lanka</span>
              </div>

              <nav className="flex flex-col space-y-4">
                {navLinks.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`text-xl sm:text-2xl uppercase tracking-[0.3em] font-serif transition-colors py-2 font-extrabold ${
                        isActive
                          ? 'text-zinc-950 dark:text-white font-extrabold'
                          : 'text-zinc-800 dark:text-zinc-200 hover:text-emerald-600 dark:hover:text-emerald-400'
                      }`}
                    >
                      {item.label}
                    </NavLink>
                  );
                })}
              </nav>

              {/* ── Luxury 3-Segment Switcher Pill in Mobile Drawer ── */}
              <div className="pt-5 pb-2 border-t border-[#e5e5e0] dark:border-zinc-800 max-w-xs mx-auto">
                <span className="text-[10px] uppercase tracking-widest text-zinc-600 dark:text-zinc-400 font-mono block mb-2.5 font-medium">
                  Theme Atmosphere
                </span>
                <ThemeSegmentedSwitch />
              </div>

              <div className="pt-4 border-t border-[#e5e5e0] dark:border-zinc-800 max-w-xs mx-auto">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate(isAuthenticated ? '/system/products' : '/login');
                  }}
                  className="w-full flex items-center justify-center gap-2.5 py-3 px-4 bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 text-xs font-bold uppercase tracking-[0.24em] rounded-sm shadow-xl transition-colors"
                >
                  {isAuthenticated ? (
                    <>
                      <ShieldCheck className="w-4 h-4 text-emerald-400 dark:text-emerald-700" />
                      <span>Enter System Portal ({user?.name?.split(' ')[0] || 'Staff'})</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Enter System Portal</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Minimal Branding in Drawer Footer */}
            <div className="text-center space-y-1.5 pt-6 border-t border-[#e5e5e0] dark:border-zinc-800">
              <p className="text-[10px] text-zinc-700 dark:text-zinc-300 uppercase tracking-widest font-mono font-medium">
                Reliance · Branded Mens Clothing
              </p>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-500 uppercase tracking-widest">
                Makandura, Matara · Sri Lanka
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
