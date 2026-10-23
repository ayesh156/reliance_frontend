import * as React from "react";
import { createPortal } from "react-dom";
import { DismissableLayerBranch } from "@radix-ui/react-dismissable-layer";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { useSafeTheme } from "../../contexts/ThemeContext";

/**
 * Type augmentation for React HTML attributes to accommodate Vaul drawer
 * gesture exclusion and Radix auto-focus prevention attributes without TS errors.
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
 * PopoverContent component with auto-focus prevention to prevent conflicts
 * with active parent Radix Dialogs or focus traps.
 */
export const PopoverContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    onOpenAutoFocus?: (event: React.SyntheticEvent | Event) => void;
    onCloseAutoFocus?: (event: React.SyntheticEvent | Event) => void;
  }
>(({ className, children, onOpenAutoFocus, onCloseAutoFocus, ...props }, ref) => (
  <div
    ref={ref}
    onOpenAutoFocus={onOpenAutoFocus ?? ((e) => e.preventDefault())}
    onCloseAutoFocus={onCloseAutoFocus ?? ((e) => e.preventDefault())}
    {...props}
    className={className}
  >
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
  className?: string; // Optional custom height/style prop
  inline?: boolean;   // Optional manual override for inline rendering
}

/**
 * SearchableSelect
 * 
 * High-performance, keyboard-accessible searchable dropdown select component.
 * Portals directly into document.body with z-[999999] and dynamic getBoundingClientRect
 * positioning to eliminate all modal/drawer overflow clipping and focus trap conflicts.
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
  inline = false,
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
  const containerRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listContainerRef = React.useRef<HTMLDivElement>(null);

  // Dynamic positioning coordinates for portaled dropdown
  const [coords, setCoords] = React.useState<{
    top: number;
    left: number;
    width: number;
  }>({
    top: 0,
    left: 0,
    width: 200,
  });

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return options;

    const terms = query.split(/\s+/).filter(Boolean);
    const queryDigits = query.replace(/\D/g, "");

    return options.filter((opt) => {
      const labelLower = opt.label.toLowerCase();
      // 1. Multi-word matching: every search term must be found in the label
      const wordsMatch = terms.every((term) => labelLower.includes(term));
      if (wordsMatch) return true;

      // 2. Phone number digit matching: match raw digits if at least 3 digits provided
      if (queryDigits.length >= 3) {
        const labelDigits = opt.label.replace(/\D/g, "");
        if (labelDigits.includes(queryDigits)) return true;
      }

      return false;
    });
  }, [options, searchQuery]);

  // Fix SearchableSelect Mouse-Wheel Scroll Trap:
  // Intercept the wheel event inside the dropdown list (e.stopPropagation()) so mouse scrolling
  // scrolls ONLY dropdown items and prevents parent modal from scrolling while cursor is inside dropdown.
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
      // Prevent scroll chaining to parent modal when reaching top or bottom boundary
      if ((e.deltaY < 0 && isAtTop) || (e.deltaY > 0 && isAtBottom)) {
        e.preventDefault();
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", handleWheel);
    };
  }, [open, filteredOptions?.length]);

  // Dynamic positioning calculation pinned directly to trigger button
  const updatePosition = React.useCallback(() => {
    if (inline || !triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    // If trigger has scrolled completely offscreen, close dropdown
    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      setOpen(false);
      return;
    }

    const estimatedHeight = 280;
    const actualHeight = dropdownRef.current
      ? dropdownRef.current.offsetHeight
      : estimatedHeight;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    let top = rect.bottom + 4;
    // Flip upwards only if restricted space below and ample clearance above
    if (spaceBelow < actualHeight && spaceAbove > actualHeight) {
      top = Math.max(8, rect.top - actualHeight - 4);
    } else {
      // Clamp so dropdown never overflows viewport bottom
      top = Math.max(8, Math.min(top, window.innerHeight - actualHeight - 8));
    }

    // Width matches trigger width, with min 200px and max viewport width - 16px
    const minWidth = Math.max(rect.width, 200);
    const width = Math.min(minWidth, window.innerWidth - 16);
    let left = rect.left;
    if (left + width > window.innerWidth - 8) {
      left = window.innerWidth - width - 8;
    }
    left = Math.max(8, left);

    setCoords({
      top,
      left,
      width,
    });
  }, [inline]);

  // Synchronous position update on open and query change
  React.useLayoutEffect(() => {
    if (open && !inline) {
      updatePosition();
    }
  }, [open, inline, searchQuery, filteredOptions.length, updatePosition]);

  // Real-time position tracking on scroll and resize
  React.useEffect(() => {
    if (open && !inline) {
      const handleScrollResize = () => updatePosition();
      // Capture phase is crucial to track scrolling inside modal scroll containers
      window.addEventListener("scroll", handleScrollResize, true);
      window.addEventListener("resize", handleScrollResize);
      return () => {
        window.removeEventListener("scroll", handleScrollResize, true);
        window.removeEventListener("resize", handleScrollResize);
      };
    }
  }, [open, inline, updatePosition]);

  // Smooth auto-focus on open without jumping viewport
  React.useEffect(() => {
    if (open) {
      const raf = requestAnimationFrame(() => {
        inputRef.current?.focus({ preventScroll: true });
      });
      const timer = setTimeout(() => {
        inputRef.current?.focus({ preventScroll: true });
      }, 40);
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(timer);
      };
    } else {
      setSearchQuery("");
    }
  }, [open]);

  // Outside-click & touch dismiss handler
  React.useEffect(() => {
    if (!open) return;

    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (!target) return;

      // Click or touch inside trigger container
      if (containerRef.current && containerRef.current.contains(target)) {
        return;
      }

      // Click or touch inside portaled dropdown
      if (dropdownRef.current && dropdownRef.current.contains(target)) {
        return;
      }

      setOpen(false);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick, {
      passive: true,
    });

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

  // Dropdown content: Search input and option items list
  const dropdownContent = (
    <>
      {/* Search Input with event isolation from parent Radix Dialog focus traps */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onFocus={(e) => e.stopPropagation()}
        className={`flex items-center gap-2 px-3 py-2 border-b shrink-0 pointer-events-auto ${
          isDark
            ? "border-zinc-800 bg-zinc-950/60"
            : "border-slate-100 bg-slate-50/80"
        }`}
      >
        <Search
          className={`w-3.5 h-3.5 shrink-0 ${
            isDark ? "text-zinc-500" : "text-slate-400"
          }`}
        />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onFocus={(e) => e.stopPropagation()}
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
          onKeyUp={(e) => e.stopPropagation()}
          placeholder={searchPlaceholder}
          className={`w-full bg-transparent text-xs focus:outline-none cursor-text ${
            isDark
              ? "text-zinc-100 placeholder-zinc-500"
              : "text-slate-900 placeholder-slate-400"
          }`}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {searchQuery && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setSearchQuery("");
            }}
            className={`p-0.5 cursor-pointer transition-colors ${
              isDark
                ? "text-zinc-400 hover:text-zinc-200"
                : "text-slate-400 hover:text-slate-600"
            }`}
            title="Clear search"
          >
            <X className="size-3" />
          </button>
        )}
      </div>

      {/* List Options with momentum scroll and isolated wheel propagation */}
      <div
        ref={listContainerRef}
        data-vaul-no-drag=""
        onWheel={(e) => e.stopPropagation()}
        className="max-h-[220px] sm:max-h-[260px] overflow-y-auto overscroll-contain p-1 space-y-0.5 pointer-events-auto"
        style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
      >
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
            return (
              <button
                key={opt.value}
                type="button"
                disabled={opt.disabled}
                onPointerDown={(e) => e.stopPropagation()}
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
                <span className="flex items-center gap-2 truncate min-w-0">
                  {opt.icon}
                  <span className="truncate">{opt.label}</span>
                </span>
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
    </>
  );

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${open ? "z-[999999]" : "z-auto"}`}
    >
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            if (!inline && triggerRef.current) {
              const rect = triggerRef.current.getBoundingClientRect();
              const spaceBelow = window.innerHeight - rect.bottom;
              const spaceAbove = rect.top;
              const estHeight = 280;
              let top = rect.bottom + 4;
              if (spaceBelow < estHeight && spaceAbove > estHeight) {
                top = Math.max(8, rect.top - estHeight - 4);
              } else {
                top = Math.max(
                  8,
                  Math.min(top, window.innerHeight - estHeight - 8)
                );
              }
              const minWidth = Math.max(rect.width, 200);
              const width = Math.min(minWidth, window.innerWidth - 16);
              let left = rect.left;
              if (left + width > window.innerWidth - 8) {
                left = window.innerWidth - width - 8;
              }
              left = Math.max(8, left);
              setCoords({ top, left, width });
            }
            setOpen((prev) => !prev);
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
          className={`w-3.5 h-3.5 shrink-0 ${
            isDark ? "text-zinc-500" : "text-slate-400"
          }`}
        />
      </button>

      {/* Portaled Dropdown Menu mounted directly to document.body */}
      {open &&
        (inline ? (
          <PopoverContent
            ref={dropdownRef}
            data-vaul-no-drag=""
            role="listbox"
            onOpenAutoFocus={(e) => e.preventDefault()}
            onCloseAutoFocus={(e) => e.preventDefault()}
            onPointerDown={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
            className={`absolute z-[999999] w-full left-0 right-0 top-full mt-1.5 rounded-xl border shadow-xl overflow-hidden pointer-events-auto animate-in fade-in-0 zoom-in-95 duration-100 ${
              isDark
                ? "bg-zinc-900 border-zinc-800 text-zinc-100 shadow-black/40"
                : "bg-white border-slate-200 text-slate-900 shadow-slate-200/60"
            }`}
          >
            {dropdownContent}
          </PopoverContent>
        ) : typeof document !== "undefined" ? (
          createPortal(
            <DismissableLayerBranch asChild>
              <PopoverContent
                ref={dropdownRef}
                data-vaul-no-drag=""
                data-radix-portal=""
                data-searchable-select-portal=""
                role="listbox"
                onOpenAutoFocus={(e) => e.preventDefault()}
                onCloseAutoFocus={(e) => e.preventDefault()}
                onPointerDown={(e) => e.stopPropagation()}
                onFocusCapture={(e) => e.stopPropagation()}
                onWheel={(e) => e.stopPropagation()}
                style={{
                  position: "fixed",
                  top: `${coords.top}px`,
                  left: `${coords.left}px`,
                  width: `${coords.width}px`,
                  zIndex: 999999,
                  pointerEvents: "auto",
                }}
                className={`z-[999999] rounded-xl border shadow-2xl overflow-hidden pointer-events-auto animate-in fade-in-0 zoom-in-95 duration-100 ${
                  isDark
                    ? "bg-zinc-900 border-zinc-800 text-zinc-100 shadow-black/60"
                    : "bg-white border-slate-200 text-slate-900 shadow-slate-300/80"
                }`}
              >
                {dropdownContent}
              </PopoverContent>
            </DismissableLayerBranch>,
            document.body
          )
        ) : null)}
    </div>
  );
};