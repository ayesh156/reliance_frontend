import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { getProductImageUrl } from '../../lib/utils';
import { post } from '../../lib/api';
import { toast } from 'react-toastify';
import {
  Sparkles,
  Shirt,
  CheckCircle2,
  Loader2,
  PackageCheck,
  Info,
  Package,
} from 'lucide-react';

export interface FinalizeBatchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: any | null;
  productsList?: any[];
  dark?: boolean;
  onSuccess?: (updatedBatch: any) => void;
}

interface FinalizeProductLine {
  productId: number;
  variantId?: number | null;
  productName: string;
  sku?: string;
  barcode?: string;
  plannedQty: number;
  completedQty: number | '';
  imageUrl?: string | null;
}

export const FinalizeBatchModal: React.FC<FinalizeBatchModalProps> = ({
  open,
  onOpenChange,
  order,
  productsList = [],
  dark: _dark,
  onSuccess,
}) => {
  const [productLines, setProductLines] = useState<FinalizeProductLine[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Initialize lines from batch target products whenever modal opens
  useEffect(() => {
    if (!open || !order) {
      setProductLines([]);
      setNotes('');
      return;
    }

    let raw = order.targetProducts;
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch {
        raw = null;
      }
    }

    const lines: FinalizeProductLine[] = [];

    if (Array.isArray(raw) && raw.length > 0) {
      raw.forEach((tp: any) => {
        if (tp && (tp.productId || tp.id)) {
          const pId = Number(tp.productId || tp.id);
          const vId = tp.variantId ? Number(tp.variantId) : null;
          const matchedProd = productsList.find((p) => p.id === pId);
          const rawImg = matchedProd?.images?.[0]?.imageUrl || tp.imageUrl;
          const defaultQty = Number(tp.plannedQty) || Number(tp.sentToWashQty) || 1;

          lines.push({
            productId: pId,
            variantId: vId,
            productName: tp.productName || matchedProd?.name || `Product #${pId}`,
            sku: tp.sku || '',
            barcode: tp.barcode || '',
            plannedQty: defaultQty,
            completedQty: defaultQty,
            imageUrl: rawImg ? getProductImageUrl(rawImg) : null,
          });
        }
      });
    } else if (order.materialUsages && order.materialUsages.length > 0) {
      order.materialUsages.forEach((u: any) => {
        let uProds = u.targetProducts;
        if (typeof uProds === 'string') {
          try {
            uProds = JSON.parse(uProds);
          } catch {
            uProds = null;
          }
        }
        if (Array.isArray(uProds)) {
          uProds.forEach((tp: any) => {
            if (tp && (tp.productId || tp.id)) {
              const pId = Number(tp.productId || tp.id);
              const vId = tp.variantId ? Number(tp.variantId) : null;
              const matchedProd = productsList.find((p) => p.id === pId);
              const rawImg = matchedProd?.images?.[0]?.imageUrl || tp.imageUrl;
              const defaultQty = Number(tp.plannedQty) || 1;

              if (!lines.some((l) => l.productId === pId && l.variantId === vId)) {
                lines.push({
                  productId: pId,
                  variantId: vId,
                  productName: tp.productName || matchedProd?.name || `Product #${pId}`,
                  sku: tp.sku || '',
                  barcode: tp.barcode || '',
                  plannedQty: defaultQty,
                  completedQty: defaultQty,
                  imageUrl: rawImg ? getProductImageUrl(rawImg) : null,
                });
              }
            }
          });
        }
      });
    }

    if (lines.length === 0 && order.product) {
      const prodImg = order.product.images?.[0]?.imageUrl;
      const defaultQty = order.targetQuantity || order.completedQty || 1;
      lines.push({
        productId: order.productId,
        variantId: order.variantId || null,
        productName: order.product.name,
        sku: order.variant?.sku || '',
        barcode: order.variant?.barcode || '',
        plannedQty: defaultQty,
        completedQty: defaultQty,
        imageUrl: prodImg ? getProductImageUrl(prodImg) : null,
      });
    }

    setProductLines(lines);
    setNotes('');
  }, [open, order, productsList]);

  const handleQtyChange = (idx: number, val: string) => {
    setProductLines((prev) => {
      const copy = [...prev];
      if (val === '') {
        copy[idx].completedQty = '';
      } else {
        const num = parseInt(val, 10);
        copy[idx].completedQty = isNaN(num) ? '' : num;
      }
      return copy;
    });
  };

  const totalCompletedPcs = useMemo(() => {
    return productLines.reduce((sum, line) => {
      return sum + (typeof line.completedQty === 'number' && line.completedQty > 0 ? line.completedQty : 0);
    }, 0);
  }, [productLines]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order?.id) return;

    const items = productLines
      .filter((l) => typeof l.completedQty === 'number' && l.completedQty > 0)
      .map((l) => ({
        productId: Number(l.productId),
        variantId: l.variantId ? Number(l.variantId) : null,
        quantity: Number(l.completedQty),
      }));

    if (items.length === 0) {
      toast.error('Please enter completed garments quantity for at least one target product.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res: any = await post(`/production/batches/${order.id}/finalize`, {
        items,
        notes: notes.trim() || 'Finalized directly to stock',
      });

      const updatedBatch = res?.data || res;
      toast.success(
        `Batch #${order.productionNo} finalized! ${totalCompletedPcs} pcs synced directly to sellable stock.`
      );
      onOpenChange(false);
      if (onSuccess) {
        onSuccess(updatedBatch);
      }
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || err?.message || 'Failed to finalize batch to stock'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-2xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 shadow-2xl">
        {/* Header */}
        <DialogHeader className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-950 z-10">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-900/50 shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Finalize &amp; Sync to Sellable Stock</span>
                <Badge variant="outline" className="text-[10px] text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 font-mono">
                  Batch #{order.productionNo}
                </Badge>
              </DialogTitle>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Bypasses wash stage and immediately increments active inventory (<strong>ProductVariant.stock</strong>).
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Informational Callout */}
        <div className="px-5 py-2.5 bg-emerald-50/70 dark:bg-emerald-950/30 border-b border-emerald-100 dark:border-emerald-900/40 text-xs text-emerald-950 dark:text-emerald-200 flex items-center gap-2">
          <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>
            Enter actual completed finished garments for each product. Confirmed counts will become immediately sellable in POS and online store.
          </span>
        </div>

        {/* Product list form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {productLines.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No target products mapped to this production batch.
            </div>
          ) : (
            productLines.map((line, idx) => (
              <div
                key={idx}
                className="p-3.5 bg-slate-50/70 dark:bg-zinc-900/50 rounded-xl border border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3 shadow-2xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {line.imageUrl ? (
                    <img
                      src={line.imageUrl}
                      alt={line.productName}
                      className="size-11 rounded-lg object-cover border border-slate-200 dark:border-zinc-700 shrink-0"
                    />
                  ) : (
                    <div className="size-11 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400">
                      <Shirt className="size-5" />
                    </div>
                  )}

                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {line.productName}
                    </h4>
                    <p className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono truncate">
                      {line.sku ? `SKU: ${line.sku}` : ''}
                      {line.barcode ? ` · Barcode: ${line.barcode}` : ''}
                    </p>
                    <span className="text-[10px] text-slate-400 font-medium">
                      Initially planned: {line.plannedQty} pcs
                    </span>
                  </div>
                </div>

                <div className="w-36 shrink-0 space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider block text-right">
                    Completed Pcs <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={line.completedQty}
                    onChange={(e) => handleQtyChange(idx, e.target.value)}
                    placeholder="Completed pcs"
                    className="h-8 text-xs font-mono font-bold text-right text-emerald-700 dark:text-emerald-300 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800"
                  />
                </div>
              </div>
            ))
          )}

          {/* Notes field */}
          <div className="space-y-1 pt-1">
            <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block">
              Finalization Notes / Remarks <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <Input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Inspected, tagged, and delivered straight to retail floor"
              className="h-8 text-xs rounded-xl bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800"
            />
          </div>

          <DialogFooter className="px-0 pt-3 border-t border-slate-100 dark:border-zinc-800 shrink-0 bg-transparent flex-row justify-between items-center gap-2">
            <div className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-2">
              <PackageCheck className="size-4 text-emerald-600" />
              <span>Total to Stock:</span>
              <Badge className="bg-emerald-600 text-white font-mono font-extrabold text-xs">
                {totalCompletedPcs} Pcs
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-xs rounded-xl h-8 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting || totalCompletedPcs <= 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer h-8"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Syncing Inventory...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Confirm &amp; Sync to Stock</span>
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default FinalizeBatchModal;
