import * as React from "react";
// Portal rendering for breakout z-index placement
import { createPortal } from "react-dom";
import { Check, ChevronsUpDown, Search } from "lucide-react";

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
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Real-time dynamic screen coordinates
  const [coords, setCoords] = React.useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 200,
  });

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = React.useMemo(() => {
    if (!searchQuery.trim()) return options;
    return options.filter((opt) =>
      opt.label.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [options, searchQuery]);

  // Dynamically calculate coordinates attached precisely to trigger button
  const updatePosition = React.useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      // Measure actual rendered dropdown height if available, fallback to 220
      const actualHeight = dropdownRef.current ? dropdownRef.current.offsetHeight : 220;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      let top = rect.bottom + 4;
      // Only flip up if bottom space is genuinely restricted and top has ample clearance
      if (spaceBelow < actualHeight && spaceAbove > actualHeight) {
        top = rect.top - actualHeight - 4;
      }

      setCoords({
        top,
        left: rect.left,
        width: Math.max(rect.width, 180),
      });
    }
  }, []);

  // Update position when opened or query changes (which shrinks/expands dropdown height)
  React.useLayoutEffect(() => {
    if (open) {
      updatePosition();
    }
  }, [open, searchQuery, updatePosition]);

  // Synchronize position on modal scroll or window resize
  React.useEffect(() => {
    if (open) {
      const handleScrollResize = () => updatePosition();
      window.addEventListener("scroll", handleScrollResize, true);
      window.addEventListener("resize", handleScrollResize);
      return () => {
        window.removeEventListener("scroll", handleScrollResize, true);
        window.removeEventListener("resize", handleScrollResize);
      };
    }
  }, [open, updatePosition]);

  // Radix Dialog safe dismiss handler without swallowing option selection
  React.useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };

    if (open) {
      // Non-capturing listener to allow element clicks to register cleanly first
      document.addEventListener("pointerdown", handlePointerDown);
    }
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const handleSelect = (optValue: string) => {
    onValueChange(optValue);
    setOpen(false);
    setSearchQuery("");
  };

  return (
    <div className="relative w-full">
      {/* Trigger Button with attached triggerRef */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            updatePosition();
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

      {/* Breakout portal dropdown mounted directly to document body to evade overflow clipping */}
      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              zIndex: 99999,
              pointerEvents: "auto",
            }}
            className={`rounded-xl border shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-100 ${
              dark ? "bg-zinc-900 border-zinc-800 text-zinc-100" : "bg-white border-gray-200 text-gray-900"
            }`}
          >
            {/* Search Input */}
            <div className={`flex items-center gap-2 px-3 py-2 border-b ${dark ? "border-zinc-800" : "border-gray-100"}`}>
              <Search className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-transparent text-xs focus:outline-none placeholder-zinc-500"
              />
            </div>

            {/* List Options */}
            <div className="max-h-48 overflow-y-auto p-1 space-y-0.5">
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
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer select-none ${
                        isSelected
                          ? "bg-emerald-500/10 text-emerald-400 font-medium"
                          : dark
                          ? "hover:bg-zinc-800 text-zinc-300"
                          : "hover:bg-gray-100 text-gray-700"
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        {opt.icon}
                        {opt.label}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};