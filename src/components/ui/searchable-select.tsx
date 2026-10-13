import * as React from "react";
import * as PortalPrimitive from "@radix-ui/react-portal";
import { DismissableLayerBranch } from "@radix-ui/react-dismissable-layer";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";

/**
 * Type augmentation for React HTML attributes to accommodate Vaul drawer
 * gesture exclusion and Radix auto-focus prevention attributes without TS errors.
 */
declare module "react" {
  interface HTMLAttributes<T> {
    "data-vaul-no-drag"?: string | boolean;
    onOpenAutoFocus?: (event: React.SyntheticEvent | Event) => void;
  }
}

/**
 * PopoverPrimitive portal wrapper mounted directly to document.body.
 * Guarantees that the select dropdown breaks out of any stacking context
 * or overflow-hidden container on desktop tables and wide viewports.
 */
const PopoverPrimitive = {
  Portal: ({ children, container }: { children: React.ReactNode; container?: HTMLElement | null }) => (
    <PortalPrimitive.Portal container={container ?? (typeof document !== "undefined" ? document.body : undefined)}>
      {children}
    </PortalPrimitive.Portal>
  ),
};

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
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  dark?: boolean;
  className?: string; // Optional custom height/style prop
}

/**
 * SearchableSelect
 * 
 * Touch-optimized and keyboard-accessible searchable dropdown select component
 * engineered with a Hybrid Viewport Architecture:
 * 
 * ### Hybrid Viewport Architecture:
 * 1. **Mobile / Touch Viewports (< 768px or inside Drawer/Modal containers)**:
 *    - Renders as an **Inline Absolute Container** (`absolute left-0 right-0 top-full mt-1.5 z-[9999]`).
 *    - By staying within the parent DOM subtree, Radix Dialog / Vaul Drawer focus traps never
 *      intercept input focus, completely eliminating software keyboard rejection and immediate blur on iOS/Android.
 *    - Attaches `data-vaul-no-drag=""` to both the dropdown wrapper and options list so parent bottom sheet
 *      drawers never hijack vertical scroll swipes.
 *    - Employs native momentum touch scrolling with `touchAction: 'pan-y'` and `WebkitOverflowScrolling: 'touch'`,
 *      free of gesture-locking event cancellation.
 * 
 * 2. **Desktop Viewports (>= 768px)**:
 *    - Mounts via `<PopoverPrimitive.Portal>` into `document.body` wrapped in `<DismissableLayerBranch asChild>`.
 *    - Dynamically computes bounding coordinates (`coords.top`, `coords.left`, `coords.width`) with intelligent
 *      vertical flipping and viewport edge clamping, guaranteeing zero clipping inside overflow-hidden data tables.
 * 
 * 3. **Unified Outside-Interaction Cleanup**:
 *    - Listens to both `mousedown` and `{ passive: true }` `touchstart` events on `document` to cleanly dismiss
 *      the dropdown without conflicting with child selections.
 */
export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onValueChange,
  placeholder = "Select option...",
  searchPlaceholder = "Search role...",
  emptyMessage = "No matching options.",
  disabled = false,
  dark = true,
  className = "", // Default empty, preserves natural component height
}) => {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Viewport mode tracking: mobile (<768px) vs desktop (>=768px)
  const [isMobileViewport, setIsMobileViewport] = React.useState<boolean>(() => {
    return typeof window !== "undefined" ? window.innerWidth < 768 : false;
  });

  React.useEffect(() => {
    const handleResize = () => {
      setIsMobileViewport(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Determine whether to render inline (mobile viewports or inside touch drawers)
  const isInline = React.useMemo(() => {
    if (isMobileViewport) return true;
    if (containerRef.current) {
      const inDrawerOrModal = !!containerRef.current.closest('[data-vaul-drawer], [data-radix-dialog-content], [role="dialog"]');
      if (inDrawerOrModal && typeof window !== "undefined" && window.innerWidth < 1024) {
        return true;
      }
    }
    return false;
  }, [isMobileViewport, open]);

  // Real-time dynamic screen coordinates for desktop portaled dropdown
  const [coords, setCoords] = React.useState<{ top: number; left: number; width: number }>({
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

  // Dynamically calculate coordinates attached precisely to trigger button on desktop
  const updatePosition = React.useCallback(() => {
    if (isInline) return;
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      // Measure actual rendered dropdown height if available, fallback to 260
      const actualHeight = dropdownRef.current ? dropdownRef.current.offsetHeight : 260;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      let top = rect.bottom + 4;
      // Only flip up if bottom space is genuinely restricted and top has ample clearance
      if (spaceBelow < actualHeight && spaceAbove > actualHeight) {
        top = Math.max(8, rect.top - actualHeight - 4);
      } else {
        // Clamp so dropdown bottom never overflows screen
        top = Math.max(8, Math.min(top, window.innerHeight - actualHeight - 8));
      }

      // Responsive width: match trigger width, but at least 200px and no wider than viewport - 16px
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
    }
  }, [isInline]);

  // Update position when opened or query changes on desktop
  React.useLayoutEffect(() => {
    if (open && !isInline) {
      updatePosition();
    }
  }, [open, isInline, searchQuery, updatePosition]);

  // Synchronize desktop coordinates on page scroll or resize
  React.useEffect(() => {
    if (open && !isInline) {
      const handleScrollResize = () => updatePosition();
      window.addEventListener("scroll", handleScrollResize, true);
      window.addEventListener("resize", handleScrollResize);
      return () => {
        window.removeEventListener("scroll", handleScrollResize, true);
        window.removeEventListener("resize", handleScrollResize);
      };
    }
  }, [open, isInline, updatePosition]);

  // Focus the search input smoothly on open without jumping viewport
  React.useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        inputRef.current?.focus({ preventScroll: true });
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setSearchQuery("");
    }
  }, [open]);

  // Unified outside-click & outside-touch handler
  React.useEffect(() => {
    if (!open) return;

    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (!target) return;

      // Click or touch inside container wrapper (trigger or inline dropdown)
      if (containerRef.current && containerRef.current.contains(target)) {
        return;
      }

      // Click or touch inside portaled desktop dropdown
      if (dropdownRef.current && dropdownRef.current.contains(target)) {
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
    onValueChange(optValue);
    setOpen(false);
    setSearchQuery("");
  };

  // Shared dropdown content: Search input and option items list
  const dropdownContent = (
    <>
      {/* Search Input with Native Touch-Friendly Focus */}
      <div className={`flex items-center gap-2 px-3 py-2 border-b shrink-0 ${dark ? "border-zinc-800" : "border-gray-100"}`}>
        <Search className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full bg-transparent text-xs focus:outline-none placeholder-zinc-500"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="text-zinc-400 hover:text-zinc-200 p-0.5 cursor-pointer"
            title="Clear search"
          >
            <X className="size-3" />
          </button>
        )}
      </div>

      {/* List Options with Vaul Drawer Isolation & Momentum Touch Scroll */}
      <div
        data-vaul-no-drag=""
        className="max-h-[220px] sm:max-h-[260px] overflow-y-auto overscroll-contain p-1 space-y-0.5"
        style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
      >
        {filteredOptions.length === 0 ? (
          <div className="p-3 text-center text-xs text-zinc-500">{emptyMessage}</div>
        ) : (
          filteredOptions.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={opt.disabled}
                onClick={() => handleSelect(opt.value)}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer select-none text-left ${
                  isSelected
                    ? "bg-emerald-500/10 text-emerald-400 font-medium"
                    : dark
                    ? "hover:bg-zinc-800 text-zinc-300 active:bg-zinc-800"
                    : "hover:bg-gray-100 text-gray-700 active:bg-gray-100"
                }`}
              >
                <span className="flex items-center gap-2 truncate min-w-0">
                  {opt.icon}
                  <span className="truncate">{opt.label}</span>
                </span>
                {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-1.5" />}
              </button>
            );
          })
        )}
      </div>
    </>
  );

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger Button with attached triggerRef */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            if (!isInline) {
              updatePosition();
            }
            setOpen((prev) => !prev);
          }
        }}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs transition-all ${
          dark
            ? "bg-zinc-950 border-zinc-800 text-zinc-100 focus:border-emerald-500/60"
            : "bg-white border-gray-200 text-gray-900 focus:border-emerald-500"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ${className}`}
      >
        <span className="flex items-center gap-2 truncate">
          {selectedOption?.icon}
          <span className={selectedOption ? (dark ? "text-zinc-100" : "text-gray-900") : "text-zinc-500"}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </span>
        <ChevronsUpDown className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
      </button>

      {/* Hybrid Dropdown: Inline on Mobile/Touch Drawers, Body Portal on Desktop */}
      {open &&
        (isInline ? (
          <div
            ref={dropdownRef}
            data-vaul-no-drag=""
            className={`absolute left-0 right-0 top-full mt-1.5 z-[9999] rounded-xl border shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-100 ${
              dark ? "bg-zinc-900 border-zinc-800 text-zinc-100" : "bg-white border-gray-200 text-gray-900"
            }`}
          >
            {dropdownContent}
          </div>
        ) : (
          <PopoverPrimitive.Portal>
            <DismissableLayerBranch asChild>
              <div
                ref={dropdownRef}
                data-vaul-no-drag=""
                onOpenAutoFocus={(e) => e.preventDefault()}
                style={{
                  position: "fixed",
                  top: `${coords.top}px`,
                  left: `${coords.left}px`,
                  width: `${coords.width}px`,
                  zIndex: 9999,
                  pointerEvents: "auto",
                }}
                className={`z-[9999] rounded-xl border shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-100 ${
                  dark ? "bg-zinc-900 border-zinc-800 text-zinc-100" : "bg-white border-gray-200 text-gray-900"
                }`}
              >
                {dropdownContent}
              </div>
            </DismissableLayerBranch>
          </PopoverPrimitive.Portal>
        ))}
    </div>
  );
};