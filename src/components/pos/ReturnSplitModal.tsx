import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { RotateCcw, Package, AlertTriangle, CheckCircle2 } from 'lucide-react';

export interface ReturnSplitModalProps {
  open: boolean;
  onClose?: () => void;
  onOpenChange?: (open: boolean) => void;
  productName: string;
  variantDetails?: string;
  size?: string;
  color?: string;
  unitPrice: number;
  totalQuantity?: number;
  originalQty?: number;
  initialReason?: 'UNSOLD' | 'DAMAGED';
  currentReturnReason?: 'UNSOLD' | 'DAMAGED';
  onConfirmSplit?: (returnQty: number, returnReason: 'UNSOLD' | 'DAMAGED') => void;
  onConfirm?: (returnQty: number, returnReason: 'UNSOLD' | 'DAMAGED') => void;
}

export const ReturnSplitModal: React.FC<ReturnSplitModalProps> = ({
  open,
  onClose,
  onOpenChange,
  productName,
  variantDetails,
  size,
  color,
  unitPrice,
  totalQuantity,
  originalQty,
  initialReason,
  currentReturnReason,
  onConfirmSplit,
  onConfirm,
}) => {
  const effectiveQty = totalQuantity ?? originalQty ?? 1;
  const effectiveReason = initialReason ?? currentReturnReason ?? 'UNSOLD';
  const resolvedVariantDetails = variantDetails || (size || color ? `${size || 'FREE'} · ${color || 'Default'}` : undefined);

  const [returnQty, setReturnQty] = useState<number>(1);
  const [returnReason, setReturnReason] = useState<'UNSOLD' | 'DAMAGED'>(effectiveReason);

  const handleClose = () => {
    if (onClose) onClose();
    if (onOpenChange) onOpenChange(false);
  };

  const handleConfirm = () => {
    if (onConfirmSplit) onConfirmSplit(returnQty, returnReason);
    else if (onConfirm) onConfirm(returnQty, returnReason);
    handleClose();
  };

  useEffect(() => {
    if (open) {
      setReturnQty(Math.min(effectiveQty, 1));
      setReturnReason(effectiveReason);
    }
  }, [open, effectiveQty, effectiveReason]);

  const keptQty = Math.max(0, effectiveQty - returnQty);
  const returnCredit = returnQty * unitPrice;
  const keptValue = keptQty * unitPrice;

  const handleApplyPreset = (qty: number) => {
    const clamped = Math.max(1, Math.min(effectiveQty, qty));
    setReturnQty(clamped);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && handleClose()}>
      <DialogContent className="max-w-md w-full p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xl animate-in fade-in-50 zoom-in-95">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
              <RotateCcw className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                Partial Return / Quantity Split
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Split purchased line into kept items and a separate return line
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Product Info Card */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white leading-snug">
              {productName}
            </h4>
            <Badge variant="outline" className="font-mono text-xs border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 bg-indigo-50/50 dark:bg-indigo-950/40 shrink-0">
              Rs. {unitPrice.toLocaleString()} / pc
            </Badge>
          </div>
          {resolvedVariantDetails && (
            <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
              {resolvedVariantDetails}
            </p>
          )}
          <div className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400 pt-1">
            Total on Invoice: <span className="font-bold text-slate-900 dark:text-white font-mono">{effectiveQty} pcs</span>
          </div>
        </div>

        {/* Return Quantity Selector */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-zinc-300">
            <span>Specify Return Quantity:</span>
            <span className="font-mono font-bold text-rose-600 dark:text-rose-400 text-sm">
              {returnQty} / {effectiveQty} pcs
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={effectiveQty}
              value={returnQty}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                  setReturnQty(Math.max(1, Math.min(effectiveQty, val)));
                } else if (e.target.value === '') {
                  setReturnQty(1);
                }
              }}
              onFocus={(e) => e.target.select()}
              className="h-10 text-center font-mono font-bold text-base bg-white dark:bg-zinc-950 border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 focus:ring-rose-500"
            />
          </div>

          {/* Quick preset pills */}
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleApplyPreset(1)}
              className="h-7 px-2 text-[11px] rounded-lg border-slate-200 dark:border-zinc-700"
            >
              1 pc
            </Button>
            {effectiveQty >= 5 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleApplyPreset(5)}
                className="h-7 px-2 text-[11px] rounded-lg border-slate-200 dark:border-zinc-700"
              >
                5 pcs
              </Button>
            )}
            {effectiveQty >= 10 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleApplyPreset(10)}
                className="h-7 px-2 text-[11px] rounded-lg border-slate-200 dark:border-zinc-700"
              >
                10 pcs
              </Button>
            )}
            {effectiveQty > 2 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleApplyPreset(Math.floor(effectiveQty / 2))}
                className="h-7 px-2 text-[11px] rounded-lg border-slate-200 dark:border-zinc-700"
              >
                Half ({Math.floor(effectiveQty / 2)})
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleApplyPreset(effectiveQty)}
              className="h-7 px-2 text-[11px] rounded-lg border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 bg-rose-50/50 dark:bg-rose-950/30"
            >
              Return All ({effectiveQty})
            </Button>
          </div>
        </div>

        {/* Return Reason Condition Pills */}
        <div className="space-y-1.5 pt-1">
          <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block">
            Return Condition / Reason:
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setReturnReason('UNSOLD')}
              className={`p-2.5 rounded-xl border flex flex-col items-start gap-1 text-left transition-all cursor-pointer ${
                returnReason === 'UNSOLD'
                  ? 'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 shadow-2xs ring-1 ring-emerald-500'
                  : 'border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800/50 text-slate-700 dark:text-zinc-300'
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Unsold (Good)</span>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-zinc-400 leading-tight">
                Intact garment eligible to restock into sellable inventory.
              </span>
            </button>

            <button
              type="button"
              onClick={() => setReturnReason('DAMAGED')}
              className={`p-2.5 rounded-xl border flex flex-col items-start gap-1 text-left transition-all cursor-pointer ${
                returnReason === 'DAMAGED'
                  ? 'border-rose-500 bg-rose-50/80 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 shadow-2xs ring-1 ring-rose-500'
                  : 'border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800/50 text-slate-700 dark:text-zinc-300'
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <AlertTriangle className="size-3.5 text-rose-600 dark:text-rose-400" />
                <span>Damaged / Defect</span>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-zinc-400 leading-tight">
                Defective garment requiring inspection or repair ledger.
              </span>
            </button>
          </div>
        </div>

        {/* Live Split Preview Box */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-600 dark:text-zinc-400">
            <span className="flex items-center gap-1">
              <Package className="size-3 text-indigo-500" />
              <span>Kept Purchased Line:</span>
            </span>
            <span className="font-mono font-bold text-slate-900 dark:text-white">
              {keptQty} pcs (Rs. {keptValue.toLocaleString()})
            </span>
          </div>
          <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 pt-1 border-t border-slate-200 dark:border-zinc-800">
            <span className="flex items-center gap-1">
              <RotateCcw className="size-3 text-rose-500" />
              <span>Separate Return Line:</span>
            </span>
            <span className="font-mono font-bold">
              {returnQty} pcs (- Rs. {returnCredit.toLocaleString()})
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            className="h-10 rounded-xl"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            className="h-10 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold gap-1.5 shadow-md"
          >
            <RotateCcw className="size-4" />
            <span>Confirm Return {returnQty > 1 ? `(${returnQty} Pcs)` : ''}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
