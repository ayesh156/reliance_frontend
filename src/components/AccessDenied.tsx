import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, LayoutDashboard, Lock } from 'lucide-react';
import { Button } from './ui/button';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

interface AccessDeniedProps {
  requiredRole?: string | string[];
}

export const AccessDenied: React.FC<AccessDeniedProps> = ({ requiredRole }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const rolesList = requiredRole
    ? Array.isArray(requiredRole)
      ? requiredRole.join(', ')
      : requiredRole
    : 'ADMIN';

  return (
    <div
      className={`min-h-[80vh] flex items-center justify-center p-4 transition-colors ${
        isDark ? 'text-zinc-100' : 'text-slate-900'
      }`}
    >
      <div className="max-w-md w-full text-center">
        {/* Glow & Shield Icon Container */}
        <div className="relative mx-auto mb-6 flex items-center justify-center">
          <div className="absolute -inset-2 bg-gradient-to-r from-red-500/20 to-amber-500/20 rounded-full blur-xl opacity-75 animate-pulse" />
          <div
            className={`relative size-20 rounded-2xl flex items-center justify-center border shadow-xl ${
              isDark
                ? 'bg-zinc-900/90 border-red-500/30 text-red-400 shadow-red-950/40'
                : 'bg-white border-red-200 text-red-600 shadow-red-100'
            }`}
          >
            <ShieldAlert className="size-10 stroke-[1.75]" />
          </div>
        </div>

        {/* Security Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-semibold tracking-wider uppercase mb-4 border bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">
          <Lock className="size-3" />
          403 Forbidden · Strict RBAC Guard
        </div>

        {/* Main Headings */}
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">
          Access Denied
        </h1>
        <p className="text-sm md:text-base text-slate-600 dark:text-zinc-400 mb-6 leading-relaxed">
          You do not have administrative privileges to view this page. This resource is strictly restricted by organizational role-based access control.
        </p>

        {/* Diagnostic Metadata Pill */}
        <div
          className={`p-3.5 rounded-xl border text-xs mb-8 text-left space-y-1.5 ${
            isDark
              ? 'bg-zinc-900/60 border-zinc-800 text-zinc-300'
              : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}
        >
          <div className="flex justify-between items-center">
            <span className="text-slate-400 dark:text-zinc-500">Authenticated User:</span>
            <span className="font-semibold">{user?.name || 'Unknown'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400 dark:text-zinc-500">Current Role:</span>
            <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
              {user?.role || 'NONE'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400 dark:text-zinc-500">Required Role:</span>
            <span className="font-mono font-bold text-red-600 dark:text-red-400">
              {rolesList}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            onClick={() => navigate('/system/products')}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 font-medium px-5"
          >
            <LayoutDashboard className="size-4 mr-2" />
            Return to Dashboard
          </Button>

          <Button
            variant="outline"
            onClick={() => window.history.back()}
            className="w-full sm:w-auto border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300"
          >
            <ArrowLeft className="size-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    </div>
  );
};
