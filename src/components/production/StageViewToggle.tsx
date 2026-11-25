import React from 'react';

export type StageViewMode = 'active' | 'all';

interface StageViewToggleProps {
  value: StageViewMode;
  onChange: (mode: StageViewMode) => void;
  className?: string;
}

/**
 * Standardized dual-mode segmented toggle for Production floors & Reports.
 * Switches cleanly between "Active Only" (pending/in-progress in stage) and
 * "All (Incl. Completed)" (historical & progressed batches).
 */
export const StageViewToggle: React.FC<StageViewToggleProps> = ({
  value,
  onChange,
  className = '',
}) => {
  return (
    <div
      role="group"
      aria-label="Batch View Mode"
      className={`inline-flex items-center p-0.5 rounded-xl border bg-slate-100 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 shrink-0 ${className}`}
    >
      <button
        type="button"
        onClick={() => onChange('active')}
        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
          value === 'active'
            ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
            : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
        }`}
      >
        Current
      </button>
      <button
        type="button"
        onClick={() => onChange('all')}
        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
          value === 'all'
            ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
            : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
        }`}
      >
        All
      </button>
    </div>
  );
};
