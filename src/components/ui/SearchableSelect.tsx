import * as React from "react";
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
  className?: string; // ⭐ Optional custom height/style prop
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
  className = "", // ⭐ Default empty, preserves natural component height
}) => {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = React.useMemo(() => {
    if (!searchQuery.trim()) return options;
    return options.filter((opt) =>
      opt.label.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [options, searchQuery]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Trigger Button - Defaults to original py-2, but allows custom override via className */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
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

      {/* Dropdown Menu */}
      {open && (
        <div
          className={`absolute left-0 right-0 mt-1.5 z-50 rounded-xl border shadow-xl overflow-hidden ${
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
                    onClick={() => {
                      onValueChange(opt.value);
                      setOpen(false);
                      setSearchQuery("");
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
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
        </div>
      )}
    </div>
  );
};