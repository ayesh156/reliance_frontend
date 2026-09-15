import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronsUpDown, Tag, X } from 'lucide-react';

export interface MaterialOption {
  id: number;
  name: string;
  code: string | null;
  unit: string;
  currentStock: number;
}

interface MaterialComboboxProps {
  value: number | '';
  onChange: (id: number) => void;
  options: MaterialOption[];
  placeholder?: string;
  disabled?: boolean;
}

export const MaterialCombobox: React.FC<MaterialComboboxProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select Material...',
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 280,
  });

  const selectedMaterial = options.find((opt) => opt.id === Number(value));
  const filtered = options.filter(
    (opt) =>
      opt.name.toLowerCase().includes(query.toLowerCase()) ||
      (opt.code && opt.code.toLowerCase().includes(query.toLowerCase()))
  );

  const handleOpen = () => {
    if (disabled) return;
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownHeight = 220;

      const top = spaceBelow < dropdownHeight ? rect.top - dropdownHeight - 6 : rect.bottom + 4;

      setCoords({
        top: top + window.scrollY,
        left: rect.left + window.scrollX,
        width: Math.max(rect.width, 280),
      });
    }
    setOpen(!open);
    setQuery('');
  };

  return (
    <div className="relative w-full">
      {/* Standardized to h-9 to align perfectly with row quantity/price inputs */}
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={handleOpen}
        className="w-full h-9 flex items-center justify-between px-2.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-left shadow-xs hover:border-slate-300 dark:hover:border-zinc-700 transition-all cursor-pointer"
      >
        <div className="truncate">
          {selectedMaterial ? (
            <span className="font-semibold text-slate-900 dark:text-white">
              {selectedMaterial.name}{' '}
              <span className="text-[10px] text-slate-400 font-mono">
                ({selectedMaterial.code || 'No SKU'} · {selectedMaterial.unit})
              </span>
            </span>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </div>
        <ChevronsUpDown className="size-3 text-zinc-400 shrink-0" />
      </button>

      {open &&
        createPortal(
          <>
            {/* Transparent backdrop matching ColorCombobox */}
            <div
              className="fixed inset-0 z-[99998] bg-transparent"
              onClick={() => setOpen(false)}
            />

            <div
              style={{
                position: 'fixed',
                top: `${coords.top - window.scrollY}px`,
                left: `${coords.left - window.scrollX}px`,
                width: `${coords.width}px`,
              }}
              className="z-[99999] rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl p-1.5 animate-in fade-in-0 zoom-in-95 duration-100"
            >
              <div className="relative mb-1">
                <input
                  autoFocus
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search material or code..."
                  className="w-full pl-2 pr-6 py-1 text-xs bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg outline-none text-slate-900 dark:text-white"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute right-1.5 top-1.5 text-slate-400 hover:text-slate-600"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>

              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {filtered.length === 0 ? (
                  <div className="p-3 text-center text-slate-400 text-[11px]">
                    No raw materials found
                  </div>
                ) : (
                  filtered.map((item) => {
                    const isSelected = item.id === Number(value);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onChange(item.id);
                          setOpen(false);
                          setQuery('');
                        }}
                        className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold'
                            : 'hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-1.5 font-medium text-xs">
                            <Tag className="size-3 text-slate-400" />
                            <span>{item.name}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            Code: {item.code || 'N/A'} · Stock: {item.currentStock} {item.unit.toLowerCase()}
                          </div>
                        </div>
                        {isSelected && <Check className="size-3.5 text-indigo-600 shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </>,
          document.body
        )}
    </div>
  );
};