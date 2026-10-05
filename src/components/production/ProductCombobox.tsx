import React, { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronsUpDown, Shirt, X, Layers } from 'lucide-react';

export interface ProductComboboxOption {
  id: number;
  name: string;
  slug?: string | null;
  variants?: Array<{
    id: number;
    size?: string | null;
    color?: string | null;
    sku: string;
    stock: number;
  }>;
}

interface ProductComboboxProps {
  value: number | '';
  onChange: (id: number) => void;
  options: ProductComboboxOption[];
  placeholder?: string;
  disabled?: boolean;
}

export const ProductCombobox: React.FC<ProductComboboxProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select Finished Product...',
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 320,
  });

  const selectedProduct = options.find((opt) => opt.id === Number(value));
  const filtered = options.filter(
    (opt) =>
      opt.name.toLowerCase().includes(query.toLowerCase()) ||
      (opt.slug && opt.slug.toLowerCase().includes(query.toLowerCase()))
  );

  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownHeight = 240;

      const top = spaceBelow < dropdownHeight ? rect.top - dropdownHeight - 6 : rect.bottom + 4;

      setCoords({
        top: top + window.scrollY,
        left: rect.left + window.scrollX,
        width: Math.max(rect.width, 300),
      });
    }
  };

  const handleOpen = () => {
    if (disabled) return;
    updatePosition();
    setOpen(!open);
    setQuery('');
  };

  useLayoutEffect(() => {
    if (open) {
      updatePosition();
    }
  }, [open, query]);

  useEffect(() => {
    if (open) {
      const handleScrollResize = () => updatePosition();
      window.addEventListener('scroll', handleScrollResize, true);
      window.addEventListener('resize', handleScrollResize);
      return () => {
        window.removeEventListener('scroll', handleScrollResize, true);
        window.removeEventListener('resize', handleScrollResize);
      };
    }
  }, [open]);

  return (
    <div className="relative w-full">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={handleOpen}
        className="w-full h-10 flex items-center justify-between px-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs text-left shadow-xs hover:border-slate-300 dark:hover:border-zinc-700 transition-all cursor-pointer gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div className="truncate flex items-center gap-2 min-w-0">
          <Shirt className="w-3.5 h-3.5 text-violet-500 shrink-0" />
          {selectedProduct ? (
            <span className="font-semibold text-slate-900 dark:text-white truncate">
              {selectedProduct.name}
              {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-normal ml-1.5 font-mono">
                  ({selectedProduct.variants.length} {selectedProduct.variants.length === 1 ? 'variant' : 'variants'})
                </span>
              )}
            </span>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </div>
        <ChevronsUpDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
      </button>

      {open &&
        createPortal(
          <>
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
                  placeholder="Search finished garment..."
                  className="w-full pl-2.5 pr-6 py-1.5 text-xs bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg outline-none text-slate-900 dark:text-white placeholder-slate-400"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div className="max-h-56 overflow-y-auto space-y-0.5">
                {filtered.length === 0 ? (
                  <div className="p-3 text-center text-slate-400 text-[11px]">
                    No products found
                  </div>
                ) : (
                  filtered.map((item) => {
                    const isSelected = item.id === Number(value);
                    const totalStock = (item.variants || []).reduce((acc, v) => acc + (v.stock || 0), 0);

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
                            ? 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 font-bold'
                            : 'hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-1.5 font-semibold text-xs truncate">
                            <Shirt className="w-3 h-3 text-violet-500 shrink-0" />
                            <span className="truncate">{item.name}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                            <span>{item.variants?.length || 0} Variants</span>
                            <span>·</span>
                            <span>Total Stock: {totalStock} pcs</span>
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />}
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
