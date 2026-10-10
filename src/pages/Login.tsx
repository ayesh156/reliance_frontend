import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, LogIn, Eye, EyeOff, ShieldCheck, ArrowLeft } from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';

/**
 * Login — Secure System Authorization Portal for Staff & POS Management.
 * Features a fixed floating luxury theme toggle at the top-right viewport,
 * providing instant daylight glare elimination and complete Light/Dark/System adaptation.
 */
export const Login: React.FC = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/system/products', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setError('Please enter both email and password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await login(cleanEmail, cleanPassword);
      navigate('/system/products');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 flex items-center justify-center p-4 transition-colors duration-300">
      {/* ── Top-Right Floating Quick-Access Theme Toggle (Fix Daylight Glare) ── */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2 p-1 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-slate-200 dark:border-zinc-800 rounded-full shadow-sm">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-display">
            RELIANCE<span className="text-emerald-500">.</span>
          </h1>
          <p className="text-slate-500 dark:text-zinc-500 text-xs uppercase tracking-widest mt-1.5 font-medium">
            Staff &amp; POS Management Portal
          </p>
        </div>

        {/* Authorization Card */}
        <div className="bg-white/85 dark:bg-zinc-900/70 border border-slate-200 dark:border-zinc-800/80 backdrop-blur-xl rounded-2xl p-6 sm:p-8 shadow-xl dark:shadow-2xl transition-colors">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">System Authorization</h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">Sign in to access secure back-office</p>
            </div>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium leading-relaxed">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
                Staff Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staff@reliance.lk"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50/80 dark:bg-zinc-950/60 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/60 transition-all shadow-sm"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
                Account Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50/80 dark:bg-zinc-950/60 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/60 transition-all pr-10 shadow-sm"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-all"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-sm font-semibold transition-all shadow-lg shadow-emerald-600/20 dark:shadow-emerald-950/50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        </div>

        <div className="text-center mt-6 space-y-2">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white uppercase tracking-wider transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Luxury Storefront</span>
          </Link>
          <p className="text-slate-400 dark:text-zinc-600 text-[11px]">
            Reliance Retail &amp; Wholesale POS &middot; Enterprise Security
          </p>
        </div>
      </div>
    </div>
  );
};