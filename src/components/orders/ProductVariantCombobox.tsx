import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronsUpDown, Package, Check, X, Search } from 'lucide-react';
import { resolveImageUrl } from '../../utils/imageUrl';

export interface ProductVariantOption {
  id: number;
  productId: number;
  productName: string;
  size: string | null;
  color: string | null;
  sku: string;
  stock: number;
  wholesalePrice: number;
  retailPrice: number;
  imageUrl?: string | null;
}

interface ProductVariantComboboxProps {
  value: number | '';
  onChange: (variant: ProductVariantOption) => void;
  options: ProductVariantOption[];
  placeholder?: string;
  disabled?: boolean;
}

export const ProductVariantCombobox: React.FC<ProductVariantComboboxProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select Product Variant...',
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

  const selectedVariant = options.find((opt) => opt.id === Number(value));

  const filtered = options.filter((opt) => {
    const q = query.toLowerCase().trim();
    if (!q) return true;
    return (
      opt.productName.toLowerCase().includes(q) ||
      opt.sku.toLowerCase().includes(q) ||
      (opt.size && opt.size.toLowerCase().includes(q)) ||
      (opt.color && opt.color.toLowerCase().includes(q))
    );
  });

  const handleOpen = () => {
    if (disabled) return;
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownHeight = 280;

      const top = spaceBelow < dropdownHeight ? rect.top - dropdownHeight - 6 : rect.bottom + 4;

      setCoords({
        top: top + window.scrollY,
        left: rect.left + window.scrollX,
        width: Math.max(rect.width, 320),
      });
    }
    setOpen(!open);
    setQuery('');
  };

  return (
    <div className="relative w-full">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={handleOpen}
        className="w-full min-h-[2.5rem] flex items-center justify-between px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-left shadow-xs hover:border-slate-300 dark:hover:border-zinc-700 transition-all cursor-pointer gap-2 disabled:opacity-50"
      >
        <div className="truncate flex items-center gap-2 min-w-0">
          {selectedVariant ? (
            <div className="flex items-center gap-2 min-w-0">
              {selectedVariant.imageUrl ? (
                <img
                  src={resolveImageUrl(selectedVariant.imageUrl)}
                  alt={selectedVariant.productName}
                  className="size-7 rounded-lg object-cover border border-slate-200 dark:border-zinc-700 shrink-0"
                />
              ) : (
                <div className="size-7 rounded-lg bg-slate-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 text-slate-400">
                  <Package className="size-3.5" />
                </div>
              )}
              <div className="truncate flex flex-col">
                <span className="font-semibold text-slate-900 dark:text-white truncate">
                  {selectedVariant.productName}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
                  {selectedVariant.sku} · {selectedVariant.size || 'FREE'} / {selectedVariant.color || 'Default'} · Stock: {selectedVariant.stock}
                </span>
              </div>
            </div>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </div>
        <ChevronsUpDown className="size-3.5 text-zinc-400 shrink-0" />
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
              className="z-[99999] rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl overflow-hidden flex flex-col max-h-[320px] animate-in fade-in-0 zoom-in-95"
            >
              <div className="p-2 border-b border-slate-100 dark:border-zinc-800 flex items-center gap-2 bg-slate-50/50 dark:bg-zinc-900/50">
                <Search className="size-3.5 text-zinc-400 shrink-0 ml-1" />
                <input
                  type="text"
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name, SKU, size, or color..."
                  className="w-full text-xs bg-transparent border-0 outline-none text-slate-900 dark:text-white placeholder:text-zinc-400"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-900 p-1">
                {filtered.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    No matching products found.
                  </div>
                ) : (
                  filtered.map((variant) => {
                    const isSelected = variant.id === Number(value);
                    return (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => {
                          onChange(variant);
                          setOpen(false);
                        }}
                        className={`w-full p-2.5 rounded-xl flex items-center justify-between text-left transition-colors cursor-pointer gap-2.5 ${
                          isSelected
                            ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-semibold'
                            : 'hover:bg-slate-50 dark:hover:bg-zinc-900 text-slate-800 dark:text-zinc-200'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {variant.imageUrl ? (
                            <img
                              src={resolveImageUrl(variant.imageUrl)}
                              alt={variant.productName}
                              className="size-8 rounded-lg object-cover border border-slate-200 dark:border-zinc-700 shrink-0"
                            />
                          ) : (
                            <div className="size-8 rounded-lg bg-slate-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 text-slate-400">
                              <Package className="size-4" />
                            </div>
                          )}
                          <div className="truncate flex flex-col">
                            <span className="text-xs truncate font-medium">
                              {variant.productName}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
                              SKU: {variant.sku} · {variant.size || 'FREE'} / {variant.color || 'Default'}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0 flex flex-col items-end">
                          <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                            Rs. {Number(variant.wholesalePrice || variant.retailPrice).toLocaleString('en-LK')}
                          </span>
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                            Stock: {variant.stock}
                          </span>
                        </div>
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
