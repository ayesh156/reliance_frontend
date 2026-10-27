import React, { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { Check, ChevronsUpDown, Shirt, X, Plus } from 'lucide-react';

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
  onAddNewProduct?: () => void;
}

/**
 * ProductCombobox
 * 
 * High-performance garment product selector using the Inline Search Input pattern.
 * When open, the trigger box itself transforms into an active auto-focused search input,
 * with the options dropdown rendered inline directly within the parent DOM tree.
 * This completely prevents Radix Dialog focus traps from stealing cursor focus.
 */
export const ProductCombobox: React.FC<ProductComboboxProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select Finished Product...',
  disabled = false,
  onAddNewProduct,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [dropUpwards, setDropUpwards] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  const selectedProduct = options.find((opt) => opt.id === Number(value));
  const filtered = options.filter(
    (opt) =>
      opt.name.toLowerCase().includes(query.toLowerCase()) ||
      (opt.slug && opt.slug.toLowerCase().includes(query.toLowerCase()))
  );

  // Position detection: Flip upwards if restricted space below and ample clearance above
  useLayoutEffect(() => {
    if (open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const estimatedHeight = 240;
      if (spaceBelow < estimatedHeight && spaceAbove > estimatedHeight) {
        setDropUpwards(true);
      } else {
        setDropUpwards(false);
      }
    }
  }, [open]);

  // Instant single-click auto-focus on open
  useEffect(() => {
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
      setQuery('');
    }
  }, [open]);

  // Mouse-wheel scroll isolation: scrolls ONLY dropdown items and prevents parent modal scroll chaining
  useEffect(() => {
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

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
  }, [open, filtered.length]);

  // Outside-click & touch dismiss handler
  useEffect(() => {
    if (!open) return;

    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (!target) return;

      if (containerRef.current && containerRef.current.contains(target)) {
        return;
      }

      setOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick, { passive: true });

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [open]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${open ? 'z-50' : 'z-auto'}`}
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
      ) : (
        /* Open: Trigger Box becomes the Active Search Input right inside the container */
        <div
          onClick={() => {
            inputRef.current?.focus({ preventScroll: true });
          }}
          className="w-full h-10 flex items-center gap-2 px-3 rounded-xl border border-violet-500 ring-2 ring-violet-500/30 bg-white dark:bg-zinc-950 text-xs text-left shadow-xs transition-all cursor-text"
        >
          <Shirt className="w-3.5 h-3.5 text-violet-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Escape') {
                e.preventDefault();
                setOpen(false);
              } else if (e.key === 'Enter') {
                e.preventDefault();
                if (filtered.length > 0) {
                  onChange(filtered[0].id);
                  setOpen(false);
                  setQuery('');
                }
              }
            }}
            placeholder="Search finished garment..."
            className="w-full bg-transparent text-xs focus:outline-none cursor-text text-slate-900 dark:text-white placeholder-slate-400"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {query ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setQuery('');
                inputRef.current?.focus({ preventScroll: true });
              }}
              className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer rounded"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
              }}
              className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer rounded"
              title="Close dropdown"
            >
              <ChevronsUpDown className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Options List: Rendered inline directly in the component's relative container */}
      {open && (
        <div
          role="listbox"
          className={`absolute left-0 right-0 ${
            dropUpwards ? 'bottom-[calc(100%+4px)]' : 'top-[calc(100%+4px)]'
          } z-50 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl p-1.5 animate-in fade-in-0 zoom-in-95 duration-100 pointer-events-auto`}
        >
          <div
            ref={listContainerRef}
            data-vaul-no-drag=""
            onWheel={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
            className="max-h-56 overflow-y-auto overscroll-contain touch-pan-y space-y-0.5 pointer-events-auto"
          >
            {onAddNewProduct && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setOpen(false);
                  onAddNewProduct();
                }}
                onClick={() => {
                  setOpen(false);
                  onAddNewProduct();
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 mb-1 rounded-lg text-xs font-semibold bg-transparent hover:bg-slate-100 dark:hover:bg-zinc-800 text-emerald-600 dark:text-emerald-400 border-b border-slate-100 dark:border-zinc-800 cursor-pointer text-left transition-colors"
              >
                <Plus className="size-3.5 shrink-0 stroke-[2.5]" />
                <span>Add New Product</span>
              </button>
            )}
            {filtered.length === 0 ? (
              <div className="p-3 text-center text-slate-400 text-xs">
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
                      // Prevent input blur before click registers
                      e.preventDefault();
                      onChange(item.id);
                      setOpen(false);
                      setQuery('');
                    }}
                    onClick={() => {
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
      )}
    </div>
  );
};
