import React, { useState, useRef, useMemo } from 'react';
import { Check, ChevronsUpDown, Building2, MapPin } from 'lucide-react';
import {
  SRI_LANKAN_BANKS,
  SRI_LANKAN_TOWNS,
  splitBankAndTown,
  formatBankAndTown,
} from '../../utils/sriLankanBanks';

export interface CreatableComboboxProps {
  value: string;
  onChange?: (value: string) => void;
  onValueChange?: (value: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  dark?: boolean;
  size?: 'sm' | 'md';
  icon?: 'bank' | 'pin';
  ariaLabel?: string;
}

/**
 * CreatableCombobox
 * Rock-solid, zero-dependency controlled combobox for Bank and Town inputs.
 * - Standard controlled <input>: typing custom text directly updates the field immediately.
 * - Suggestions rendered right below input in absolute container (z-[100] mt-1 max-h-48).
 * - onMouseDown with preventDefault() & stopPropagation() on each option ensures selection
 *   fires before input onBlur can close the dropdown.
 * - onBlur closes menu with a safe 150ms timeout to avoid race conditions.
 * - Pure memoized filtering with useMemo, eliminating any infinite state loops.
 */
export const CreatableCombobox: React.FC<CreatableComboboxProps> = ({
  value = '',
  onChange,
  onValueChange,
  options,
  placeholder = 'Type or select...',
  disabled = false,
  className = '',
  dark: darkProp,
  size = 'md',
  icon = 'bank',
  ariaLabel,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const emitChange = (val: string) => {
    onChange?.(val);
    onValueChange?.(val);
  };

  // Dark mode awareness
  const isDark =
    typeof darkProp === 'boolean'
      ? darkProp
      : typeof document !== 'undefined'
      ? document.documentElement.classList.contains('dark')
      : false;

  // Memoize filtered options strictly based on current value and options list
  const filteredOptions = useMemo(() => {
    const query = (value || '').trim().toLowerCase();
    if (!query) {
      return options.slice(0, 40);
    }
    return options
      .filter((opt) => opt.toLowerCase().includes(query))
      .slice(0, 50);
  }, [value, options]);

  const handleSelect = (option: string) => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    emitChange(option);
    setIsOpen(false);
  };

  const handleBlur = () => {
    // 150ms delay guarantees onMouseDown / onClick on suggestions execute before closing
    blurTimerRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150);
  };

  const isSmall = size === 'sm';
  const inputClass = isSmall
    ? 'h-7 text-[10.5px] px-2 rounded-md'
    : 'h-10 text-xs px-3 rounded-xl';

  const exactMatchExists = options.some(
    (opt) => opt.toLowerCase() === (value || '').trim().toLowerCase()
  );

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center w-full">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            emitChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (!disabled) setIsOpen(true);
          }}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          aria-label={ariaLabel || placeholder}
          className={`w-full font-medium transition-all outline-none border ${
            isDark
              ? 'bg-zinc-900 border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/30'
              : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 shadow-2xs'
          } ${inputClass} ${className} pr-7`}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onMouseDown={(e) => {
            e.preventDefault();
            if (!disabled) setIsOpen((prev) => !prev);
          }}
          className={`absolute right-1.5 p-1 rounded transition-colors ${
            isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-slate-400 hover:text-slate-600'
          }`}
          title="Toggle suggestions"
        >
          <ChevronsUpDown className="size-3" />
        </button>
      </div>

      {/* Suggestion Dropdown positioned directly below the input */}
      {isOpen && (
        <div
          className={`absolute top-full left-0 right-0 z-[100] mt-1 max-h-48 overflow-y-auto rounded-xl border shadow-xl ${
            isDark
              ? 'bg-zinc-950 border-zinc-800 text-zinc-100 divide-zinc-800/60'
              : 'bg-white border-slate-200 text-slate-900 divide-slate-100 shadow-slate-900/10'
          }`}
        >
          {filteredOptions.length > 0 ? (
            <div className="py-1">
              {filteredOptions.map((opt) => {
                const isSelected = opt.toLowerCase() === (value || '').trim().toLowerCase();
                return (
                  <button
                    key={opt}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSelect(opt);
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      handleSelect(opt);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left cursor-pointer select-none transition-colors ${
                      isSelected
                        ? isDark
                          ? 'bg-zinc-800/70 text-amber-300 font-semibold'
                          : 'bg-slate-100 text-amber-800 font-semibold'
                        : isDark
                        ? 'hover:bg-zinc-900 text-zinc-200'
                        : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      {icon === 'bank' ? (
                        <Building2 className="size-3 text-amber-600/70 shrink-0" />
                      ) : (
                        <MapPin className="size-3 text-blue-600/70 shrink-0" />
                      )}
                      <span className="truncate">{opt}</span>
                    </div>
                    {isSelected && <Check className="size-3 text-amber-600 shrink-0 ml-1.5" />}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="p-2.5 text-center text-xs">
              <span className={`block font-medium ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                No predefined match.
              </span>
              {(value || '').trim() && (
                <span className={`block text-[11px] mt-0.5 ${isDark ? 'text-amber-400' : 'text-amber-700 font-semibold'}`}>
                  Use &quot;{(value || '').trim()}&quot; (Custom)
                </span>
              )}
            </div>
          )}

          {/* Quick Notice when custom name typed */}
          {!exactMatchExists && (value || '').trim() && filteredOptions.length > 0 && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSelect((value || '').trim());
              }}
              onClick={(e) => {
                e.preventDefault();
                handleSelect((value || '').trim());
              }}
              className={`w-full p-1.5 text-center text-[10.5px] border-t cursor-pointer font-medium ${
                isDark
                  ? 'border-zinc-800/80 bg-zinc-900/70 text-amber-400 hover:bg-zinc-800'
                  : 'border-slate-100 bg-amber-50/60 text-amber-800 hover:bg-amber-100/70'
              }`}
            >
              + Keep custom value: &quot;{(value || '').trim()}&quot;
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export interface ChequeBankTownSelectProps {
  value?: string;
  onChange?: (value: string) => void;
  onValueChange?: (value: string) => void;
  bank?: string;
  town?: string;
  onBankChange?: (bank: string) => void;
  onTownChange?: (town: string) => void;
  dark?: boolean;
  size?: 'sm' | 'md';
  bankPlaceholder?: string;
  townPlaceholder?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * ChequeBankTownSelect
 * Dual Creatable Combobox inputs providing searchable/creatable selection for:
 * 1. Sri Lankan Bank Name (pre-populated with BOC, People's Bank, Commercial Bank, Sampath, HNB, etc.)
 * 2. Town / Branch (pre-populated with 25-district Sri Lanka towns with comprehensive Matara coverage)
 * Automatically synchronizes a combined "Bank - Town" string for backend compatibility while also
 * supporting direct discrete bank and town state binding.
 */
export const ChequeBankTownSelect: React.FC<ChequeBankTownSelectProps> = ({
  value = '',
  onChange,
  onValueChange,
  bank: bankProp,
  town: townProp,
  onBankChange,
  onTownChange,
  size = 'md',
  bankPlaceholder = 'Select / Type Bank Name *',
  townPlaceholder = 'Select / Type Branch / Town',
  className = '',
  disabled = false,
  dark,
}) => {
  const parsed = useMemo(() => splitBankAndTown(value), [value]);
  const currentBank = bankProp !== undefined ? bankProp : parsed.bank;
  const currentTown = townProp !== undefined ? townProp : parsed.town;

  const handleBankChange = (newBank: string) => {
    onBankChange?.(newBank);
    const combined = formatBankAndTown(newBank, currentTown);
    onChange?.(combined);
    onValueChange?.(combined);
  };

  const handleTownChange = (newTown: string) => {
    onTownChange?.(newTown);
    const combined = formatBankAndTown(currentBank, newTown);
    onChange?.(combined);
    onValueChange?.(combined);
  };

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2 w-full ${className}`}>
      {/* 1. Bank Name Creatable Combobox */}
      <div className="space-y-1">
        <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-300 block">
          Bank Name *
        </label>
        <CreatableCombobox
          value={currentBank}
          onChange={handleBankChange}
          onValueChange={handleBankChange}
          options={SRI_LANKAN_BANKS}
          placeholder={bankPlaceholder}
          disabled={disabled}
          size={size}
          dark={dark}
          icon="bank"
          ariaLabel="Bank Name"
        />
      </div>

      {/* 2. Town / Branch Creatable Combobox */}
      <div className="space-y-1">
        <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-300 block">
          Town / Branch
        </label>
        <CreatableCombobox
          value={currentTown}
          onChange={handleTownChange}
          onValueChange={handleTownChange}
          options={SRI_LANKAN_TOWNS}
          placeholder={townPlaceholder}
          disabled={disabled}
          size={size}
          dark={dark}
          icon="pin"
          ariaLabel="Town or Branch"
        />
      </div>
    </div>
  );
};
