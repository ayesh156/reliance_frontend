import React from 'react';
import { Sun, Moon, Monitor, Check } from 'lucide-react';
import { useTheme, type Theme } from '../contexts/ThemeContext';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from './ui/dropdown-menu';
import { cn } from '../lib/utils';

interface ThemeToggleProps {
  className?: string;
}

/**
 * ThemeToggle — Ultra-sleek luxury frosted glass theme switcher trigger.
 * Displays dynamic Sun/Moon/Monitor icon based on active theme setting
 * with micro-rotational animations. Provides an accessible dropdown menu
 * to choose between Light, Dark, and System modes.
 */
export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '' }) => {
  const { theme, resolvedTheme, setTheme } = useTheme();

  // Determine active icon representation
  const renderIcon = () => {
    if (theme === 'system') {
      return (
        <Monitor className="w-4 h-4 text-zinc-700 dark:text-zinc-200 transition-transform duration-500 hover:rotate-12" />
      );
    }
    if (resolvedTheme === 'dark') {
      return (
        <Moon className="w-4 h-4 text-zinc-200 transition-transform duration-500 hover:-rotate-12" />
      );
    }
    return (
      <Sun className="w-4 h-4 text-amber-500 transition-transform duration-500 hover:rotate-45" />
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Select color theme"
          className={cn(
            "h-9 w-9 p-0 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center transition-all duration-300 shadow-sm focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600",
            className
          )}
        >
          {renderIcon()}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="min-w-[140px] bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 shadow-xl rounded-xl p-1.5"
      >
        <DropdownMenuItem
          onClick={() => setTheme('light')}
          className={`flex items-center justify-between px-3 py-2 text-xs rounded-lg cursor-pointer transition-colors ${
            theme === 'light'
              ? 'bg-zinc-100 dark:bg-zinc-900 font-semibold text-zinc-950 dark:text-white'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50'
          }`}
        >
          <div className="flex items-center gap-2">
            <Sun className="w-3.5 h-3.5 text-amber-500" />
            <span>Light</span>
          </div>
          {theme === 'light' && <Check className="w-3.5 h-3.5 text-zinc-950 dark:text-white" />}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => setTheme('dark')}
          className={`flex items-center justify-between px-3 py-2 text-xs rounded-lg cursor-pointer transition-colors ${
            theme === 'dark'
              ? 'bg-zinc-100 dark:bg-zinc-900 font-semibold text-zinc-950 dark:text-white'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50'
          }`}
        >
          <div className="flex items-center gap-2">
            <Moon className="w-3.5 h-3.5 text-indigo-400" />
            <span>Dark</span>
          </div>
          {theme === 'dark' && <Check className="w-3.5 h-3.5 text-zinc-950 dark:text-white" />}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => setTheme('system')}
          className={`flex items-center justify-between px-3 py-2 text-xs rounded-lg cursor-pointer transition-colors ${
            theme === 'system'
              ? 'bg-zinc-100 dark:bg-zinc-900 font-semibold text-zinc-950 dark:text-white'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50'
          }`}
        >
          <div className="flex items-center gap-2">
            <Monitor className="w-3.5 h-3.5 text-zinc-500" />
            <span>System</span>
          </div>
          {theme === 'system' && <Check className="w-3.5 h-3.5 text-zinc-950 dark:text-white" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

interface ThemeSegmentedSwitchProps {
  className?: string;
}

/**
 * ThemeSegmentedSwitch — Luxury 3-segment pill switcher (Light | Dark | System)
 * Designed for tactile mobile navigation drawer and settings panels.
 */
export const ThemeSegmentedSwitch: React.FC<ThemeSegmentedSwitchProps> = ({ className = '' }) => {
  const { theme, setTheme } = useTheme();

  const options: Array<{ id: Theme; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'light', label: 'Light', icon: Sun },
    { id: 'dark', label: 'Dark', icon: Moon },
    { id: 'system', label: 'System', icon: Monitor },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Theme selection"
      className={`p-1 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-100/90 dark:bg-zinc-900/90 backdrop-blur-md flex items-center justify-between max-w-xs mx-auto shadow-inner ${className}`}
    >
      {options.map(({ id, label, icon: Icon }) => {
        const isActive = theme === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => setTheme(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-full text-xs font-medium uppercase tracking-wider transition-all duration-300 ${
              isActive
                ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-sm font-semibold scale-100'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <Icon
              className={`w-3.5 h-3.5 ${
                isActive
                  ? id === 'light'
                    ? 'text-amber-500'
                    : id === 'dark'
                    ? 'text-indigo-400'
                    : 'text-zinc-400'
                  : 'text-zinc-400'
              }`}
            />
            <span className="text-[11px]">{label}</span>
          </button>
        );
      })}
    </div>
  );
};
