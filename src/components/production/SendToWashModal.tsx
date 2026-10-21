import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { DateTimePicker } from '../ui/date-time-picker';
import { getProductImageUrl } from '../../lib/utils';
import { post } from '../../lib/api';
import { toast } from 'react-toastify';
import {
  Waves,
  Shirt,
  Calendar,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ArrowRight,
  Info,
} from 'lucide-react';
import { BatchStatusBadge } from './BatchStatusBadge';

export interface SendToWashModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batch: any | null;
  productsList?: any[];
  dark?: boolean;
  onSuccess?: (updatedBatch: any) => void;
}

export const SendToWashModal: React.FC<SendToWashModalProps> = ({
  open,
  onOpenChange,
  batch,
  productsList = [],
  dark = false,
  onSuccess,
}) => {
  const [productQuantities, setProductQuantities] = useState<Record<number, number | ''>>({});
  const [washDateTime, setWashDateTime] = useState<string>('');
  const [washNotes, setWashNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Extract all target products mapped to this batch
  const targetProductsList = useMemo(() => {
    if (!batch) return [];
    const list: Array<{
      productId: number;
      variantId?: number | null;
      productName: string;
      sku?: string;
      barcode?: string;
      plannedQty: number;
      sentToWashQty: number;
      imageUrl?: string | null;
    }> = [];

    let raw = batch.targetProducts;
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch {
        raw = null;
      }
    }

    if (Array.isArray(raw) && raw.length > 0) {
      raw
        .filter((tp: any) => tp && (tp.productId || tp.id))
        .forEach((tp: any) => {
          const pId = Number(tp.productId || tp.id);
          const fullProduct = productsList.find((p) => p.id === pId);
          const rawImg = fullProduct?.images?.[0]?.imageUrl || (fullProduct as any)?.image;
          list.push({
            productId: pId,
            variantId: tp.variantId ? Number(tp.variantId) : null,
            productName: tp.productName || fullProduct?.name || `Product #${pId}`,
            sku: tp.sku || fullProduct?.variants?.[0]?.sku || '',
            barcode: tp.barcode || fullProduct?.variants?.[0]?.barcode || '',
            plannedQty: Number(tp.plannedQty) || 0,
            sentToWashQty: Number(tp.sentToWashQty) || 0,
            imageUrl: rawImg ? getProductImageUrl(rawImg) : null,
          });
        });
    } else if (batch.materialUsages && Array.isArray(batch.materialUsages) && batch.materialUsages.length > 0) {
      batch.materialUsages.forEach((u: any) => {
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
              const fullProduct = productsList.find((p) => p.id === pId);
              const rawImg = fullProduct?.images?.[0]?.imageUrl || (fullProduct as any)?.image;
              list.push({
                productId: pId,
                variantId: tp.variantId ? Number(tp.variantId) : null,
                productName: tp.productName || fullProduct?.name || `Product #${pId}`,
                sku: tp.sku || fullProduct?.variants?.[0]?.sku || '',
                barcode: tp.barcode || fullProduct?.variants?.[0]?.barcode || '',
                plannedQty: Number(tp.plannedQty) || 0,
                sentToWashQty: Number(tp.sentToWashQty) || 0,
                imageUrl: rawImg ? getProductImageUrl(rawImg) : null,
              });
            }
          });
        }
      });
    }

    if (list.length === 0 && batch.product) {
      const rawImg = batch.product.images?.[0]?.imageUrl || (batch.product as any)?.image;
      list.push({
        productId: batch.productId,
        variantId: batch.variantId || null,
        productName: batch.product.name,
        sku: batch.variant?.sku || '',
        barcode: batch.variant?.barcode || '',
        plannedQty: batch.targetQuantity || batch.completedQty || 1,
        sentToWashQty: batch.sentToWashQty || 0,
        imageUrl: rawImg ? getProductImageUrl(rawImg) : null,
      });
    }

    return list;
  }, [batch, productsList]);

  // Reset inputs when modal opens or batch changes
  useEffect(() => {
    if (open && batch) {
      const initialQtys: Record<number, number | ''> = {};
      targetProductsList.forEach((tp, idx) => {
        const remaining = Math.max(0, tp.plannedQty - tp.sentToWashQty);
        initialQtys[idx] = remaining > 0 ? remaining : (tp.plannedQty > 0 ? tp.plannedQty : 1);
      });
      setProductQuantities(initialQtys);
      setWashDateTime(new Date().toISOString().slice(0, 16));
      setWashNotes('');
    }
  }, [open, batch, targetProductsList]);

  // Calculate total units to send today
  const totalToSendToday = useMemo(() => {
    return targetProductsList.reduce((sum, _, idx) => {
      const val = productQuantities[idx];
      return sum + (typeof val === 'number' && !isNaN(val) ? val : 0);
    }, 0);
  }, [targetProductsList, productQuantities]);

  const totalPlannedFromProducts = useMemo(() => {
    return targetProductsList.reduce((sum, tp) => sum + (Number(tp.plannedQty) || 0), 0);
  }, [targetProductsList]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batch?.id) return;

    if (totalToSendToday <= 0) {
      toast.error('Please enter at least one product quantity to send to wash today.');
      return;
    }

    // Build per-product payload
    const items = targetProductsList
      .map((tp, idx) => {
        const qty = Number(productQuantities[idx] || 0);
        return {
          productId: tp.productId,
          variantId: tp.variantId || null,
          sentQty: qty,
        };
      })
      .filter((it) => it.sentQty > 0);

    if (items.length === 0) {
      toast.error('At least one product must have a quantity greater than zero.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res: any = await post(`/production/${batch.id}/send-to-wash`, {
        items,
        sewnQuantity: totalToSendToday,
        date: washDateTime ? new Date(washDateTime).toISOString() : new Date().toISOString(),
        notes: washNotes.trim() || undefined,
      });

      const updated = res?.data || res;
      toast.success(
        `Batch #${batch.productionNo} successfully transitioned to WASHING (${totalToSendToday} garments sent)`
      );
      onOpenChange(false);
      if (onSuccess) {
        onSuccess(updated);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to send batch to wash');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!batch) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] sm:max-w-2xl lg:max-w-3xl max-h-[92vh] flex flex-col p-0 gap-0 rounded-2xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 shadow-2xl">
        <DialogHeader className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-950 z-10 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 flex items-center justify-center border border-cyan-200 dark:border-cyan-900/50 shadow-xs">
                <Waves className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                  <span>Send to Wash Stage</span>
                  <BatchStatusBadge status={batch.status} isStockSynced={batch.isStockSynced} />
                </DialogTitle>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Batch #{batch.productionNo} · Multi-Product End-of-Day Factory Handover
                </p>
              </div>
            </div>

            {/* Total to send badge */}
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-900/60 text-cyan-800 dark:text-cyan-300 shadow-2xs shrink-0">
              <Waves className="size-4 shrink-0 text-cyan-600 dark:text-cyan-400" />
              <div className="text-right">
                <div className="text-[9px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
                  TOTAL SENDING
                </div>
                <div className="text-xs sm:text-sm font-extrabold font-mono leading-none">
                  {totalToSendToday} Pcs
                </div>
              </div>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {/* Banner */}
            <div className="p-3 rounded-xl bg-cyan-50/70 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-900/50 text-xs text-cyan-950 dark:text-cyan-200 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold">
                <Waves className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                <span>End-of-Day Factory Handover:</span>
              </div>
              <p>
                Enter the actual count of completed sewn garments per target style ready for the washing plant today.
                This will record the items and transition the batch status to <strong>WASHING</strong>.
              </p>
            </div>

            {/* Target Products Multi-Row Cards */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Shirt className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                  <span>Target Garment Styles ({targetProductsList.length})</span>
                </label>
                <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
                  Planned Total: {totalPlannedFromProducts} Pcs
                </span>
              </div>

              <div className="space-y-2.5">
                {targetProductsList.map((tp, idx) => {
                  const currentQty = productQuantities[idx];
                  const remaining = Math.max(0, tp.plannedQty - tp.sentToWashQty);

                  return (
                    <div
                      key={`tp-${tp.productId}-${tp.variantId || idx}`}
                      className="p-3 bg-slate-50/90 dark:bg-zinc-900/60 rounded-xl border border-slate-200/90 dark:border-zinc-800 space-y-2.5 shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        {/* Thumbnail & Product Details */}
                        <div className="flex items-center gap-3 min-w-0">
                          {tp.imageUrl ? (
                            <img
                              src={tp.imageUrl}
                              alt={tp.productName}
                              className="size-10 rounded-lg object-cover border border-slate-200 dark:border-zinc-700 shrink-0"
                            />
                          ) : (
                            <div className="size-10 rounded-lg bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-900/50 flex items-center justify-center shrink-0">
                              <Shirt className="size-5 text-cyan-600 dark:text-cyan-400" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <h5 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {tp.productName}
                            </h5>
                            <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">
                              {tp.sku && <span>SKU: {tp.sku}</span>}
                              {tp.barcode && <span>• Barcode: {tp.barcode}</span>}
                            </div>
                          </div>
                        </div>

                        {/* Metric Chips */}
                        <div className="flex items-center gap-2 text-xs">
                          <div className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300">
                            <span className="text-[9px] uppercase font-bold text-slate-400 block">Planned</span>
                            <span className="font-mono font-bold">{tp.plannedQty}</span>
                          </div>
                          <div className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300">
                            <span className="text-[9px] uppercase font-bold text-cyan-600 block">Sent So Far</span>
                            <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">
                              {tp.sentToWashQty}
                            </span>
                          </div>
                          <div className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300">
                            <span className="text-[9px] uppercase font-bold text-amber-600 block">Remaining</span>
                            <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                              {remaining}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Input for Qty to Send to Wash Today */}
                      <div className="pt-2 border-t border-slate-200/60 dark:border-zinc-800/80 flex items-center justify-between gap-3">
                        <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                          Qty to Send to Wash Today:
                        </label>
                        <div className="w-36">
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={currentQty}
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0);
                              setProductQuantities((prev) => ({
                                ...prev,
                                [idx]: val,
                              }));
                            }}
                            placeholder="0"
                            className="h-9 text-xs text-right font-mono font-bold text-cyan-700 dark:text-cyan-300 rounded-xl bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Handover Date & Time */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block">
                Handover Date &amp; Time
              </label>
              <DateTimePicker
                value={washDateTime}
                onChange={setWashDateTime}
              />
            </div>

            {/* Handover Remarks / Notes */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block">
                Handover Remarks / Notes <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <Input
                type="text"
                value={washNotes}
                onChange={(e) => setWashNotes(e.target.value)}
                placeholder="e.g. Sent to wash plant via Factory Truck #2"
                className="h-9 text-xs rounded-xl bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800"
              />
            </div>
          </div>

          <DialogFooter className="px-5 py-3 border-t border-slate-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-950 flex-row justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs rounded-xl cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || totalToSendToday <= 0}
              className="bg-cyan-600 hover:bg-cyan-700 text-white text-xs rounded-xl font-semibold shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Transitioning Status...</span>
                </>
              ) : (
                <>
                  <Waves className="w-3.5 h-3.5" />
                  <span>Confirm &amp; Send {totalToSendToday} Pcs to Wash</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SendToWashModal;
