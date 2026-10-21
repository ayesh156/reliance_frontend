import React, { useState, useRef, useEffect } from 'react';
import { Plus, Check, X, Pencil } from 'lucide-react';
import { toast } from 'react-toastify';

export interface AnimatedInlineQtyInputProps {
  /** Maximum available inventory units in warehouse/stock */
  maxStock: number;
  /** Current quantity already assigned in the order cart */
  currentQty?: number;
  /** Callback invoked when the user confirms or submits a new quantity */
  onApplyQty: (qty: number) => void;
  /** Optional custom CSS class overrides */
  className?: string;
  /** Name of the product for descriptive toast messaging */
  productName?: string;
  /**
   * When true (default on product cards), mounts as an absolute overlay anchored to the
   * bottom edge of the card container to completely eliminate layout shifts.
   */
  overlayBottom?: boolean;
}

/**
 * AnimatedInlineQtyInput Component
 *
 * Provides a high-density, touch-optimized numerical input experience with zero layout shift.
 *
 * Architecture & Tablet Ergonomics (534x893):
 * 1. Default (Collapsed): Shows a modern "Add/Input" icon button or current cart quantity badge.
 * 2. On Click (Expanded):
 *    - Uses `overlayBottom` to anchor directly over the bottom section of the card, guaranteeing
 *      that the product card's dimensions and the 3-column catalog grid never shift vertically.
 *    - Displays "Current Stock: X" prominently at the top of the input container to avoid awkward wrapping.
 *    - Centers the numerical input and bounds the "OK" and "Cancel" buttons within 124px horizontal space.
 * 3. Auto-Focus: Instantly focuses the numeric input field for direct typing.
 * 4. Submit: Pressing 'Enter' or tapping the OK (Check) icon commits the exact quantity to the cart.
 * 5. Validation: Clamps values between 0 and `maxStock`, notifying the user if stock is exceeded.
 */
export const AnimatedInlineQtyInput: React.FC<AnimatedInlineQtyInputProps> = ({
  maxStock,
  currentQty = 0,
  onApplyQty,
  className = '',
  productName = 'Product',
  overlayBottom = true,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [inputValue, setInputValue] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // When expanding, pre-populate with existing quantity or default to 1, then focus input
  useEffect(() => {
    if (isExpanded) {
      setInputValue(currentQty > 0 ? String(currentQty) : '1');
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 50);
    }
  }, [isExpanded, currentQty]);

  // Handle outside clicks to gracefully collapse the input
  useEffect(() => {
    if (!isExpanded) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isExpanded]);

  /**
   * Commit the inputted quantity to the parent cart state
   */
  const handleCommit = (e?: React.MouseEvent | React.FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const clean = inputValue.trim();
    if (clean === '') {
      setIsExpanded(false);
      return;
    }

    const parsed = parseInt(clean, 10);
    if (isNaN(parsed) || parsed < 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    if (parsed === 0) {
      onApplyQty(0);
      setIsExpanded(false);
      toast.info(`Removed ${productName} from order`);
      return;
    }

    if (parsed > maxStock) {
      toast.warn(`Only ${maxStock} in stock for ${productName}. Clamped to maximum.`);
      onApplyQty(maxStock);
      setIsExpanded(false);
      return;
    }

    onApplyQty(parsed);
    setIsExpanded(false);
  };

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (maxStock <= 0) {
      toast.error(`"${productName}" is out of stock`);
      return;
    }
    setIsExpanded(true);
  };

  const handleCancelClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsExpanded(false);
  };

  return (
    <div
      ref={containerRef}
      className={`select-none ${overlayBottom && isExpanded ? 'static' : 'relative flex items-center justify-end'} ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Expanded Input Container: Eliminates layout shift, shows Current Stock at top, centers input */}
      {isExpanded ? (
        <div
          className={`z-20 flex flex-col items-center gap-1.5 ${
            overlayBottom
              ? 'absolute inset-x-0 bottom-0 p-2 bg-white dark:bg-zinc-950 border-t border-emerald-500/60 rounded-b-xl shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-150'
              : 'relative w-full'
          }`}
        >
          {/* Top: Current Stock text (Never breaks into 2 lines on the left) */}
          <div className="text-[10px] font-mono font-semibold text-slate-600 dark:text-zinc-300 text-center w-full truncate">
            Current Stock: {maxStock}
          </div>

          {/* Centered Numerical Input bounded with Cancel and OK buttons */}
          <div className="flex items-center justify-center gap-1.5 w-full">
            {/* Cancel Button */}
            <button
              type="button"
              onClick={handleCancelClick}
              className="size-7 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 flex items-center justify-center shrink-0 cursor-pointer active:scale-95 transition-all shadow-2xs"
              title="Cancel"
              aria-label="Cancel"
            >
              <X className="size-3.5 stroke-[2.5]" />
            </button>

            {/* Centered Numerical Input */}
            <input
              ref={inputRef}
              type="number"
              min="0"
              max={maxStock}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCommit(e);
                } else if (e.key === 'Escape') {
                  setIsExpanded(false);
                }
              }}
              placeholder="Qty"
              className="w-14 h-7 px-1 text-center font-mono text-xs font-bold bg-white dark:bg-zinc-900 border border-emerald-500 rounded-md text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-2xs"
            />

            {/* OK Button */}
            <button
              type="button"
              onClick={handleCommit}
              className="size-7 rounded-md bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-2xs cursor-pointer active:scale-95 transition-all"
              title="OK"
              aria-label="OK"
            >
              <Check className="size-3.5 stroke-[2.5]" />
            </button>
          </div>
        </div>
      ) : (
        /* Collapsed Trigger Button: Modern "Add/Input" Icon or Qty Badge */
        <div>
          {currentQty > 0 ? (
            <button
              type="button"
              onClick={handleTriggerClick}
              className="h-7 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-[11px] flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95 transition-all"
              title={`Cart Qty: ${currentQty}. Click to change.`}
            >
              <span>{currentQty}</span>
              <Pencil className="size-2.5 opacity-80" />
            </button>
          ) : (
            <button
              type="button"
              disabled={maxStock <= 0}
              onClick={handleTriggerClick}
              className={`size-7 rounded-lg flex items-center justify-center border transition-all cursor-pointer active:scale-95 shadow-2xs ${
                maxStock <= 0
                  ? 'bg-slate-100 dark:bg-zinc-800 text-slate-400 border-slate-200 dark:border-zinc-700 cursor-not-allowed opacity-50'
                  : 'bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 dark:hover:bg-emerald-600 dark:hover:text-white'
              }`}
              title="Add Quantity"
            >
              <Plus className="size-3.5 stroke-[2.5]" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
