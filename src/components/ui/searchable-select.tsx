import * as React from "react";
import { Check, ChevronsUpDown, Search, X, Plus } from "lucide-react";
import { useSafeTheme } from "../../contexts/ThemeContext";

/**
 * Type augmentation for React HTML attributes to accommodate Vaul drawer
 * gesture exclusion and Radix attributes without TS errors.
 */
declare module "react" {
  interface HTMLAttributes<T> {
    "data-vaul-no-drag"?: string | boolean;
    "data-radix-portal"?: string | boolean;
    "data-searchable-select-portal"?: string | boolean;
    onOpenAutoFocus?: (event: React.SyntheticEvent | Event) => void;
    onCloseAutoFocus?: (event: React.SyntheticEvent | Event) => void;
  }
}

/**
 * PopoverContent component with auto-focus prevention
 */
export const PopoverContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    onOpenAutoFocus?: (event: React.SyntheticEvent | Event) => void;
    onCloseAutoFocus?: (event: React.SyntheticEvent | Event) => void;
  }
>(({ className, children, onOpenAutoFocus, onCloseAutoFocus, ...props }, ref) => (
  <div ref={ref} {...props} className={className}>
    {children}
  </div>
));
PopoverContent.displayName = "PopoverContent";

export interface SearchableSelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  count?: number;
  disabled?: boolean;
  subLabel?: string;
  imageUrl?: string;
  isAction?: boolean; // Pinned static action option (e.g. ➕ Add New Material / Product)
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onValueChange?: (value: string) => void;
  onChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  dark?: boolean;
  className?: string;
  inline?: boolean;
  actionOption?: {
    label: string;
    icon?: React.ReactNode;
    onSelect: () => void;
  };
}

/**
 * SearchableSelect
 * 
 * High-performance, keyboard-accessible searchable dropdown select component.
 * Uses the Inline Search Input pattern: when opened, the trigger box itself
 * transforms into the active search input directly within the parent DOM tree.
 * The options dropdown renders inline with position: absolute and high z-index.
 * This completely avoids document.body portal issues and Radix Dialog FocusScope focus-stealing.
 */
export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onValueChange,
  onChange,
  placeholder = "Select option...",
  searchPlaceholder = "Search...",
  emptyMessage = "No matching options.",
  disabled = false,
  dark: darkProp,
  className = "",
  inline: _inline = false,
  actionOption,
}) => {
  const safeTheme = useSafeTheme();
  const [domIsDark, setDomIsDark] = React.useState<boolean>(() => {
    if (typeof document !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const updateThemeFromDom = () => {
      setDomIsDark(document.documentElement.classList.contains("dark"));
    };
    updateThemeFromDom();
    const observer = new MutationObserver(updateThemeFromDom);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  const isDark =
    typeof darkProp === "boolean"
      ? darkProp
      : safeTheme
      ? safeTheme.isDark
      : domIsDark;

  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [dropUpwards, setDropUpwards] = React.useState(false);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listContainerRef = React.useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = React.useMemo(() => {
    // If actionOption is provided via props, strip any redundant inline action options to guarantee zero duplicates
    const rawBase = actionOption
      ? options.filter((opt) => !opt.isAction && !opt.value.startsWith('__ADD_NEW_'))
      : options;

    // Deduplicate options by unique value to eliminate any duplicate spread operators or double unshifts
    const seenValues = new Set<string>();
    const baseOptions = rawBase.filter((opt) => {
      if (seenValues.has(opt.value)) return false;
      seenValues.add(opt.value);
      return true;
    });

    // Separate persistent static action options from searchable items
    const staticOptions = baseOptions.filter(
      (opt) => opt.isAction || opt.value.startsWith('__ADD_NEW_')
    );
    const standardOptions = baseOptions.filter(
      (opt) => !opt.isAction && !opt.value.startsWith('__ADD_NEW_')
    );

    const query = searchQuery.trim().toLowerCase();
    if (!query) return [...staticOptions, ...standardOptions];

    const terms = query.split(/\s+/).filter(Boolean);
    const queryDigits = query.replace(/\D/g, "");

    const matched = standardOptions.filter((opt) => {
      const labelLower = opt.label.toLowerCase();
      const subLabelLower = opt.subLabel?.toLowerCase() || "";
      // 1. Multi-word matching: every search term must be found in label or subLabel
      const wordsMatch = terms.every(
        (term) => labelLower.includes(term) || subLabelLower.includes(term)
      );
      if (wordsMatch) return true;

      // 2. Phone number / code digit matching
      if (queryDigits.length >= 3) {
        const labelDigits = opt.label.replace(/\D/g, "");
        if (labelDigits.includes(queryDigits)) return true;
      }

      return false;
    });

    // Pinned static options persist at the top even while searching
    return [...staticOptions, ...matched];
  }, [options, searchQuery, actionOption]);

  // Position detection: Flip upwards if restricted space below and ample clearance above
  React.useLayoutEffect(() => {
    if (open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const estimatedHeight = 260;
      if (spaceBelow < estimatedHeight && spaceAbove > estimatedHeight) {
        setDropUpwards(true);
      } else {
        setDropUpwards(false);
      }
    }
  }, [open]);

  // Instant single-click auto-focus on open
  React.useEffect(() => {
    if (open) {
      const raf = requestAnimationFrame(() => {
        inputRef.current?.focus({ preventScroll: true });
      });
      const timer1 = setTimeout(() => {
        inputRef.current?.focus({ preventScroll: true });
      }, 20);
      const timer2 = setTimeout(() => {
        inputRef.current?.focus({ preventScroll: true });
      }, 60);
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    } else {
      setSearchQuery("");
    }
  }, [open]);

  // Mouse-wheel scroll isolation: scrolls ONLY dropdown items and prevents parent modal scroll chaining
  React.useEffect(() => {
    const el = listContainerRef.current;
    if (!open || !el) return;

    const handleWheel = (e: WheelEvent) => {
      e.stopPropagation();
      const { scrollTop, scrollHeight, clientHeight } = el;
      const canScroll = scrollHeight > clientHeight;
      if (!canScroll) {
        e.preventDefault();
        return;
      }
      const isAtTop = scrollTop <= 0;
      const isAtBottom = Math.ceil(scrollTop + clientHeight) >= scrollHeight;
      if ((e.deltaY < 0 && isAtTop) || (e.deltaY > 0 && isAtBottom)) {
        e.preventDefault();
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", handleWheel);
    };
  }, [open, filteredOptions.length]);

  // Outside-click & touch dismiss handler
  React.useEffect(() => {
    if (!open) return;

    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (!target) return;

      if (containerRef.current && containerRef.current.contains(target)) {
        return;
      }

      setOpen(false);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick, { passive: true });

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [open]);

  const handleSelect = (optValue: string) => {
    if (onValueChange) onValueChange(optValue);
    if (onChange) onChange(optValue);
    setOpen(false);
    setSearchQuery("");
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${open ? "z-50" : "z-auto"}`}
    >
      {/* Inline Search Input pattern */}
      {!open ? (
        /* Closed: Trigger Button */
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!disabled) {
              setOpen(true);
            }
          }}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs transition-all ${
            isDark
              ? "bg-zinc-950 border-zinc-800 text-zinc-100 hover:border-zinc-700 focus:border-emerald-500/60"
              : "bg-white border-slate-200 text-slate-900 hover:border-slate-300 focus:border-emerald-500 shadow-2xs"
          } ${
            disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
          } ${className}`}
        >
          <span className="flex items-center gap-2 truncate">
            {selectedOption?.icon}
            <span
              className={
                selectedOption
                  ? isDark
                    ? "text-zinc-100"
                    : "text-slate-900 font-medium"
                  : isDark
                  ? "text-zinc-500"
                  : "text-slate-400"
              }
            >
              {selectedOption ? selectedOption.label : placeholder}
            </span>
          </span>
          <ChevronsUpDown
            className={`w-3.5 h-3.5 shrink-0 ml-1.5 ${
              isDark ? "text-zinc-500" : "text-slate-400"
            }`}
          />
        </button>
      ) : (
        /* Open: Trigger Box becomes the Active Search Input right inside the container */
        <div
          onClick={() => {
            inputRef.current?.focus({ preventScroll: true });
          }}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition-all cursor-text ring-2 ring-emerald-500/30 ${
            isDark
              ? "bg-zinc-950 border-emerald-500/60 text-zinc-100"
              : "bg-white border-emerald-500 text-slate-900 shadow-2xs"
          } ${className}`}
        >
          <Search
            className={`w-3.5 h-3.5 shrink-0 ${
              isDark ? "text-emerald-400" : "text-emerald-600"
            }`}
          />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Escape") {
                e.preventDefault();
                setOpen(false);
              } else if (e.key === "Enter") {
                e.preventDefault();
                if (filteredOptions.length > 0) {
                  handleSelect(filteredOptions[0].value);
                }
              }
            }}
            placeholder={searchPlaceholder || placeholder || "Type to search..."}
            className={`w-full bg-transparent text-xs focus:outline-none cursor-text ${
              isDark
                ? "text-zinc-100 placeholder-zinc-500"
                : "text-slate-900 placeholder-slate-400"
            }`}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSearchQuery("");
                inputRef.current?.focus({ preventScroll: true });
              }}
              className={`p-0.5 cursor-pointer rounded transition-colors ${
                isDark
                  ? "text-zinc-400 hover:text-zinc-200"
                  : "text-slate-400 hover:text-slate-600"
              }`}
              title="Clear search"
            >
              <X className="size-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
              }}
              className={`p-0.5 cursor-pointer rounded transition-colors ${
                isDark
                  ? "text-zinc-500 hover:text-zinc-300"
                  : "text-slate-400 hover:text-slate-600"
              }`}
              title="Close dropdown"
            >
              <ChevronsUpDown className="size-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Options List: Rendered inline directly in the component's relative container */}
      {open && (
        <div
          role="listbox"
          className={`absolute left-0 right-0 ${
            dropUpwards ? "bottom-[calc(100%+4px)]" : "top-[calc(100%+4px)]"
          } z-50 rounded-xl border shadow-2xl overflow-hidden pointer-events-auto animate-in fade-in-0 zoom-in-95 duration-100 ${
            isDark
              ? "bg-zinc-900 border-zinc-800 text-zinc-100 shadow-black/60"
              : "bg-white border-slate-200 text-slate-900 shadow-slate-300/80"
          }`}
        >
          <div
            ref={listContainerRef}
            data-vaul-no-drag=""
            onWheel={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            className="max-h-[220px] sm:max-h-[260px] overflow-y-auto overscroll-contain touch-pan-y p-1 space-y-0.5 pointer-events-auto"
            style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
          >
            {/* Optional Persistent Top Action Option */}
            {actionOption && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setOpen(false);
                  actionOption.onSelect();
                }}
                onClick={() => {
                  setOpen(false);
                  actionOption.onSelect();
                }}
                className={`w-full flex items-center justify-between px-2.5 py-2 mb-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer select-none text-left border-b ${
                  isDark
                    ? "bg-transparent hover:bg-zinc-800 text-emerald-400 hover:text-emerald-300 border-zinc-800"
                    : "bg-transparent hover:bg-slate-100 text-emerald-600 hover:text-emerald-700 border-slate-100"
                }`}
              >
                <span className="flex items-center gap-2 truncate min-w-0">
                  {actionOption.icon || <Plus className="size-3.5 shrink-0 stroke-[2.5]" />}
                  <span className="truncate">{actionOption.label.replace(/^[➕\s+]+/, '')}</span>
                </span>
              </button>
            )}

            {filteredOptions.length === 0 ? (
              <div
                className={`p-3 text-center text-xs ${
                  isDark ? "text-zinc-500" : "text-slate-400"
                }`}
              >
                {emptyMessage}
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                const isAction = opt.isAction || opt.value.startsWith('__ADD_NEW_');

                if (isAction) {
                  const cleanLabel = opt.label.replace(/^[➕\s+]+/, '');
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelect(opt.value);
                      }}
                      onClick={() => handleSelect(opt.value)}
                      className={`w-full flex items-center justify-between px-2.5 py-2 mb-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer select-none text-left border-b ${
                        isDark
                          ? "bg-transparent hover:bg-zinc-800 text-emerald-400 hover:text-emerald-300 border-zinc-800"
                          : "bg-transparent hover:bg-slate-100 text-emerald-600 hover:text-emerald-700 border-slate-100"
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate min-w-0">
                        {opt.icon || <Plus className="size-3.5 shrink-0 stroke-[2.5]" />}
                        <span className="truncate">{cleanLabel}</span>
                      </span>
                    </button>
                  );
                }

                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={opt.disabled}
                    onMouseDown={(e) => {
                      // Prevent input blur before click registers
                      e.preventDefault();
                      handleSelect(opt.value);
                    }}
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer select-none text-left ${
                      isSelected
                        ? isDark
                          ? "bg-emerald-500/15 text-emerald-400 font-semibold"
                          : "bg-emerald-50 text-emerald-700 font-semibold"
                        : isDark
                        ? "hover:bg-zinc-800 text-zinc-300 active:bg-zinc-800"
                        : "hover:bg-slate-100 text-slate-700 active:bg-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate min-w-0 flex-1">
                      {opt.imageUrl ? (
                        <img
                          src={opt.imageUrl}
                          alt=""
                          className="size-7 rounded-md object-cover border border-slate-200 dark:border-zinc-700 shrink-0"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        opt.icon
                      )}
                      <div className="truncate flex-1 min-w-0">
                        <div className="truncate font-medium">{opt.label}</div>
                        {opt.subLabel && (
                          <div className={`text-[10px] truncate ${isDark ? "text-zinc-500" : "text-slate-400"}`}>
                            {opt.subLabel}
                          </div>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <Check
                        className={`w-3.5 h-3.5 shrink-0 ml-1.5 ${
                          isDark ? "text-emerald-400" : "text-emerald-600"
                        }`}
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};