import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Package, Minus, Plus } from 'lucide-react';
import { resolveImageUrl, handleImageError } from '../../utils/imageUrl';

export interface ProductPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant: any | null;
  currentCartQty?: number;
  onApplyQty: (qty: number) => void;
}

/**
 * ProductPreviewModal Component
 *
 * Full-display product and variant preview modal optimized for Sales Reps in tablet mode (534x893).
 *
 * Key Features:
 * - Detailed Product Title, Category, SKU, and Barcode display
 * - High-resolution variant photography with graceful fallback handling
 * - Comprehensive Specs: Available Sizes, Colors, and Real-Time Stock Count
 * - Prominent Available Wholesale Price display
 * - Streamlined direct numerical quantity input with instant state synchronization and auto-select on touch
 */
export const ProductPreviewModal: React.FC<ProductPreviewModalProps> = ({
  open,
  onOpenChange,
  variant,
  currentCartQty = 0,
  onApplyQty,
}) => {
  if (!variant) return null;

  const product = variant.product || {};
  const sizesList = (variant.size || '').split(',').map((s: string) => s.trim()).filter(Boolean);
  const colorsList = (variant.color || '').split(',').map((c: string) => c.trim()).filter(Boolean);

  // Variant image resolution
  const variantDirectImage = variant.imageUrl || variant.images?.[0]?.imageUrl;
  const productImages = product.images || [];
  const matchedVariantImage = productImages.find(
    (imgObj: any) => imgObj.variantId && Number(imgObj.variantId) === Number(variant.id)
  )?.imageUrl;
  const targetImg = variantDirectImage || matchedVariantImage || productImages[0]?.imageUrl;
  const resolvedUrl = targetImg ? resolveImageUrl(targetImg) : null;

  const wholesaleRate = Number(variant.wholesalePrice || variant.unitPrice || 0);

  // Directly initialized to currentCartQty or defaults to 1
  const [qtyValue, setQtyValue] = useState<string>(
    currentCartQty > 0 ? String(currentCartQty) : '1'
  );

  // Synchronize input value whenever modal opens or cart quantity updates
  useEffect(() => {
    if (open) {
      setQtyValue(currentCartQty > 0 ? String(currentCartQty) : '1');
    }
  }, [open, variant?.id, currentCartQty]);

  /**
   * Synchronizes numerical input changes immediately with parent order state.
   * Auto-clamps between 0 and maximum available stock.
   */
  const handleQtyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setQtyValue(raw);

    if (raw.trim() === '') return;

    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      const maxStock = Number(variant.stock || 0);
      const targetQty = Math.min(maxStock, parsed);
      onApplyQty(targetQty);
    }
  };

  /**
   * Resets invalid or empty input on blur back to valid quantity
   */
  const handleBlur = () => {
    const parsed = parseInt(qtyValue, 10);
    if (isNaN(parsed) || parsed < 0) {
      const fallback = currentCartQty > 0 ? currentCartQty : 1;
      setQtyValue(String(fallback));
      if (currentCartQty > 0) {
        onApplyQty(fallback);
      }
    }
  };

  /**
   * Decrements quantity by 1 and updates cart instantly
   */
  const handleDecrement = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const current = parseInt(qtyValue, 10) || 0;
    const next = Math.max(0, current - 1);
    setQtyValue(String(next));
    onApplyQty(next);
  };

  /**
   * Increments quantity by 1 within stock limits and updates cart instantly
   */
  const handleIncrement = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const maxStock = Number(variant.stock || 0);
    const current = parseInt(qtyValue, 10) || 0;
    if (current >= maxStock) return;
    const next = current + 1;
    setQtyValue(String(next));
    onApplyQty(next);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[490px] max-h-[850px] p-0 overflow-hidden rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xl flex flex-col bg-white dark:bg-zinc-950">
        {/* Modal Header: pr-12 ensures title never collides with DialogPrimitive.Close at top-right */}
        <DialogHeader className="px-4 py-2.5 border-b border-slate-100 dark:border-zinc-800/80 shrink-0 pr-12 text-left">
          <div className="flex items-center gap-2 min-w-0">
            <Badge variant="outline" className="text-[9.5px] uppercase font-mono px-1.5 py-0 border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-950/40">
              Specs &amp; Preview
            </Badge>
            {product.category?.name && (
              <span className="text-[11px] text-slate-400 font-medium truncate">
                {product.category.name}
              </span>
            )}
          </div>
          {/* Header Row: Product Name with Product Number / SKU cleanly aligned to far right */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <DialogTitle className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug truncate">
              {product.name}
            </DialogTitle>
            {(variant.sku || variant.barcode) && (
              <span
                className="text-[10px] sm:text-[11px] font-mono font-medium text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded shrink-0 border border-slate-200/50 dark:border-zinc-700/50"
                title={`Product SKU: ${variant.sku || variant.barcode}`}
              >
                {variant.sku || variant.barcode}
              </span>
            )}
          </div>
        </DialogHeader>

        {/* Modal Content Wrapper: Scaled to fit completely inside 534x893 viewport without scrolling */}
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Maximized Product Visual (Takes full available height) */}
          <div className="relative w-full h-[320px] sm:h-[370px] bg-slate-50 dark:bg-zinc-900/60 overflow-hidden flex items-center justify-center shrink-0 border-b border-slate-100 dark:border-zinc-800/80">
            {resolvedUrl ? (
              <img
                src={resolvedUrl}
                alt={product.name}
                onError={handleImageError}
                className="w-full h-full object-contain p-2 hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="flex flex-col items-center gap-1.5 text-slate-400 dark:text-zinc-600">
                <Package className="size-16 opacity-35" />
                <span className="text-xs">No image provided</span>
              </div>
            )}
            {/* SKU and Barcode Overlay Badges */}
            <div className="absolute bottom-2 left-2 flex items-center gap-1.5 pointer-events-none">
              {variant.sku && (
                <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-white text-[10px] font-mono shadow-xs">
                  SKU: {variant.sku}
                </span>
              )}
              {variant.barcode && (
                <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-white text-[10px] font-mono shadow-xs">
                  BC: {variant.barcode}
                </span>
              )}
            </div>
          </div>

          {/* Product Details Section: Displayed directly below image, fitting cleanly without scrolling */}
          <div className="p-3 space-y-2.5 shrink-0 bg-white dark:bg-zinc-950">
            {/* Price & Stock Strip */}
            <div className="grid grid-cols-2 gap-2">
              <div className="px-3 py-1.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-900/40 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Wholesale
                </span>
                <span className="font-mono text-sm font-extrabold text-blue-700 dark:text-blue-300">
                  Rs. {wholesaleRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Stock
                </span>
                <span className={`font-mono text-sm font-bold ${
                  variant.stock > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
                }`}>
                  {variant.stock > 0 ? `${variant.stock} units` : 'Out of Stock'}
                </span>
              </div>
            </div>

            {/* Variants & Specifications Strip */}
            <div className="px-3 py-2 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/50 dark:bg-zinc-900/40 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] uppercase font-bold text-slate-400">Sizes:</span>
                {sizesList.length > 0 ? (
                  sizesList.map((s: string, idx: number) => (
                    <Badge key={idx} variant="secondary" className="font-mono text-[10px] font-bold px-1.5 py-0">
                      {s}
                    </Badge>
                  ))
                ) : (
                  <span className="text-[11px] text-slate-600 dark:text-zinc-400 font-mono">Standard</span>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] uppercase font-bold text-slate-400">Colors:</span>
                {colorsList.length > 0 ? (
                  colorsList.map((c: string, idx: number) => (
                    <Badge key={idx} variant="outline" className="text-[10px] px-1.5 py-0">
                      {c}
                    </Badge>
                  ))
                ) : (
                  <span className="text-[11px] text-slate-600 dark:text-zinc-400 font-mono">Default</span>
                )}
              </div>
            </div>

            {/* Streamlined Numerical Quantity Input Row without toggles or redundant stock headers */}
            <div className="px-3 py-2 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-800/50 flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  Order Quantity
                </span>
                <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono">
                  {currentCartQty > 0
                    ? `In cart: ${currentCartQty} pcs (Rs. ${(currentCartQty * wholesaleRate).toLocaleString()})`
                    : 'Enter quantity for order'}
                </span>
              </div>

              {/* Direct numerical input: default 1 (or cart qty), auto-selects on touch/click, instant sync */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleDecrement}
                  disabled={variant.stock <= 0}
                  className="size-7 rounded-md bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 flex items-center justify-center font-bold cursor-pointer active:scale-95 transition-all disabled:opacity-40"
                  title="Decrease Quantity"
                  aria-label="Decrease Quantity"
                >
                  <Minus className="size-3.5 stroke-[2.5]" />
                </button>

                <input
                  type="number"
                  min="0"
                  max={variant.stock}
                  value={qtyValue}
                  onChange={handleQtyChange}
                  onFocus={(e) => e.target.select()}
                  onBlur={handleBlur}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const p = parseInt(qtyValue, 10);
                      if (!isNaN(p) && p >= 0) {
                        onApplyQty(Math.min(variant.stock, p));
                      }
                      onOpenChange(false);
                    }
                  }}
                  disabled={variant.stock <= 0}
                  placeholder="1"
                  className="w-14 h-7 px-1 text-center font-mono text-xs font-bold bg-white dark:bg-zinc-900 border border-emerald-500 rounded-md text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-2xs"
                  title="Touch to overwrite quantity directly"
                />

                <button
                  type="button"
                  onClick={handleIncrement}
                  disabled={variant.stock <= 0 || (parseInt(qtyValue, 10) || 0) >= variant.stock}
                  className="size-7 rounded-md bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 flex items-center justify-center font-bold cursor-pointer active:scale-95 transition-all disabled:opacity-40"
                  title="Increase Quantity"
                  aria-label="Increase Quantity"
                >
                  <Plus className="size-3.5 stroke-[2.5]" />
                </button>

                {currentCartQty === 0 && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={variant.stock <= 0}
                    onClick={() => {
                      const p = parseInt(qtyValue, 10);
                      const target = !isNaN(p) && p > 0 ? Math.min(variant.stock, p) : 1;
                      onApplyQty(target);
                    }}
                    className="h-7 px-2.5 text-[11px] font-bold rounded-md bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer active:scale-95"
                  >
                    Add
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <DialogFooter className="px-4 py-2.5 bg-slate-50 dark:bg-zinc-900/60 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500 font-mono font-medium">
            {currentCartQty > 0 ? `Line Total: Rs. ${(currentCartQty * wholesaleRate).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : ''}
          </span>
          <Button
            type="button"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 px-4 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white cursor-pointer active:scale-95 transition-all"
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
