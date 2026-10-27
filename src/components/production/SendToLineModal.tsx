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
import { getProductImageUrl, getCurrentLocalDateTime } from '../../lib/utils';
import { post } from '../../lib/api';
import { toast } from 'react-toastify';
import {
  Shirt,
  Calendar,
  Loader2,
  Layers,
  Sparkles,
  ArrowRight,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { BatchStatusBadge } from './BatchStatusBadge';

export interface SendToLineModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batch: any | null;
  productsList?: any[];
  dark?: boolean;
  onSuccess?: (updatedBatch: any) => void;
}

export interface CutMaterialItem {
  id: number | string;
  name: string;
  code: string;
  unit: string;
  rolls: number;
  cutQty: number;
}

export interface TargetProductItem {
  productId: number;
  variantId?: number | null;
  productName: string;
  sku?: string;
  barcode?: string;
  cutQty: number;
  plannedQty?: number;
  sentToLineQty: number;
  remaining: number;
  progressPct: number;
  imageUrl?: string | null;
}

export const SendToLineModal: React.FC<SendToLineModalProps> = ({
  open,
  onOpenChange,
  batch,
  productsList = [],
  dark = false,
  onSuccess,
}) => {
  const [productQuantities, setProductQuantities] = useState<Record<number, number | ''>>({});
  const [lineDateTime, setLineDateTime] = useState<string>(getCurrentLocalDateTime());
  const [lineNotes, setLineNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Extract cut materials summary from batch
  const cutMaterials: CutMaterialItem[] = useMemo(() => {
    if (!batch || !Array.isArray(batch.materialUsages)) return [];
    return batch.materialUsages.map((usage: any): CutMaterialItem => ({
      id: usage.id,
      name: usage.rawMaterial?.name || 'Raw Material',
      code: usage.rawMaterial?.code || '',
      unit: usage.rawMaterial?.unit || 'Units',
      rolls: usage.piecesCount || 1,
      cutQty: usage.netConsumedQty ?? usage.issuedQty ?? 0,
    }));
  }, [batch]);

  // Extract all target products mapped to this batch
  const targetProductsList: TargetProductItem[] = useMemo(() => {
    if (!batch) return [];
    const list: TargetProductItem[] = [];

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
          const totalCut = Number(tp.cutQty ?? tp.plannedQty ?? tp.targetQuantity ?? tp.quantity ?? batch.cutQty ?? batch.targetQuantity ?? 0);
          const sentLine = Number(tp.sentToLineQty ?? tp.lineSentQty) || 0;
          const remaining = Math.max(0, totalCut - sentLine);
          const progressPct = totalCut > 0 ? Math.min(100, Math.round((sentLine / totalCut) * 100)) : (sentLine > 0 ? 100 : 0);

          list.push({
            productId: pId,
            variantId: tp.variantId ? Number(tp.variantId) : null,
            productName: tp.productName || fullProduct?.name || `Product #${pId}`,
            sku: tp.sku || fullProduct?.variants?.[0]?.sku || '',
            barcode: tp.barcode || fullProduct?.variants?.[0]?.barcode || '',
            cutQty: totalCut,
            plannedQty: totalCut,
            sentToLineQty: sentLine,
            remaining,
            progressPct,
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
              const totalCut = Number(tp.cutQty ?? tp.plannedQty ?? tp.targetQuantity ?? tp.quantity ?? batch.cutQty ?? batch.targetQuantity ?? 0);
              const sentLine = Number(tp.sentToLineQty ?? tp.lineSentQty) || 0;
              const remaining = Math.max(0, totalCut - sentLine);
              const progressPct = totalCut > 0 ? Math.min(100, Math.round((sentLine / totalCut) * 100)) : (sentLine > 0 ? 100 : 0);

              list.push({
                productId: pId,
                variantId: tp.variantId ? Number(tp.variantId) : null,
                productName: tp.productName || fullProduct?.name || `Product #${pId}`,
                sku: tp.sku || fullProduct?.variants?.[0]?.sku || '',
                barcode: tp.barcode || fullProduct?.variants?.[0]?.barcode || '',
                cutQty: totalCut,
                plannedQty: totalCut,
                sentToLineQty: sentLine,
                remaining,
                progressPct,
                imageUrl: rawImg ? getProductImageUrl(rawImg) : null,
              });
            }
          });
        }
      });
    }

    if (list.length === 0 && batch.product) {
      const rawImg = batch.product.images?.[0]?.imageUrl || (batch.product as any)?.image;
      const totalCut = Number(batch.cutQty || batch.targetQuantity || 0);
      const sentLine = Number(batch.lineSentQty) || 0;
      const remaining = Math.max(0, totalCut - sentLine);
      const progressPct = totalCut > 0 ? Math.min(100, Math.round((sentLine / totalCut) * 100)) : (sentLine > 0 ? 100 : 0);

      list.push({
        productId: batch.productId,
        variantId: batch.variantId || null,
        productName: batch.product.name,
        sku: batch.variant?.sku || '',
        barcode: batch.variant?.barcode || '',
        cutQty: totalCut,
        plannedQty: totalCut,
        sentToLineQty: sentLine,
        remaining,
        progressPct,
        imageUrl: rawImg ? getProductImageUrl(rawImg) : null,
      });
    }

    return list;
  }, [batch, productsList]);

  // Reset inputs on open (strictly EMPTY initially, allowing user to type exact dispatched quantity)
  useEffect(() => {
    if (open && batch) {
      const initialQtys: Record<number, number | ''> = {};
      targetProductsList.forEach((_: TargetProductItem, idx: number) => {
        initialQtys[idx] = '';
      });
      setProductQuantities(initialQtys);
      setLineDateTime(getCurrentLocalDateTime());
      setLineNotes('');
    }
  }, [open, batch, targetProductsList]);

  // Calculate total dispatch pieces across all products
  const totalDispatchQty = useMemo(() => {
    return targetProductsList.reduce((sum: number, _: TargetProductItem, idx: number) => {
      const val = productQuantities[idx];
      return sum + (typeof val === 'number' && !isNaN(val) ? val : 0);
    }, 0);
  }, [targetProductsList, productQuantities]);

  const handleQuantityChange = (idx: number, val: string) => {
    if (val === '') {
      setProductQuantities((prev) => ({ ...prev, [idx]: '' }));
    } else {
      const num = parseInt(val, 10);
      setProductQuantities((prev) => ({ ...prev, [idx]: isNaN(num) ? 0 : Math.max(0, num) }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batch?.id) return;

    if (totalDispatchQty <= 0) {
      toast.warn('Please enter a dispatch quantity (> 0) for at least one garment style.');
      return;
    }

    // Per-Product dispatch payload formatted as: { items: [{ productId, variantId, qty, sentQty }] }
    const items = targetProductsList
      .map((tp: TargetProductItem, idx: number) => {
        const qty = Number(productQuantities[idx] || 0);
        return {
          productId: tp.productId,
          variantId: tp.variantId || null,
          qty,
          sentQty: qty,
        };
      })
      .filter((it) => it.qty > 0);

    if (items.length === 0) {
      toast.warn('Please enter a valid quantity greater than zero for at least one product.');
      return;
    }

    setIsSubmitting(true);
    try {
      const formattedDate = lineDateTime
        ? new Date(lineDateTime).toISOString()
        : new Date().toISOString();

      const payload = {
        items,
        lineQuantity: totalDispatchQty,
        date: formattedDate,
        notes: lineNotes.trim() || undefined,
      };

      const res: any = await post(`/production/batches/${batch.id}/send-to-line`, payload);
      const updatedBatch = res?.data || res;

      toast.success(
        `Batch #${batch.productionNo} successfully dispatched ${totalDispatchQty} units to Sewing Line!`
      );
      if (onSuccess) {
        onSuccess(updatedBatch);
      }
      onOpenChange(false);
    } catch (err: any) {
      console.error('Failed to send batch to line:', err);
      toast.error(
        err?.response?.data?.message || err?.message || 'Failed to dispatch batch to line'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!batch) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-3xl lg:max-w-4xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 shadow-2xl">
        {/* Header */}
        <DialogHeader className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-950 z-10 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20 shadow-xs">
                <Shirt className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Send to Sewing Line</span>
                  <BatchStatusBadge status={batch.status} isStockSynced={batch.isStockSynced} />
                </DialogTitle>
              </div>
            </div>

            <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white border border-slate-200 dark:border-zinc-700">
              #{batch.productionNo}
            </span>
          </div>
        </DialogHeader>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {/* 1. Date & Time Picker (Top Priority) */}
            <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-zinc-300">
                <Calendar className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>Line Dispatch Date &amp; Time:</span>
              </div>
              <DateTimePicker
                value={lineDateTime}
                onChange={setLineDateTime}
              />
            </div>

            {/* 2. Cut Materials Summary */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                <Layers className="w-3.5 h-3.5 text-amber-500" />
                <span>Cut Materials Summary</span>
              </div>
              <div className="space-y-1.5">
                {cutMaterials.length === 0 ? (
                  <p className="text-xs text-slate-400">No raw material lines recorded.</p>
                ) : (
                  cutMaterials.map((mat: CutMaterialItem) => (
                    <div
                      key={mat.id}
                      className="flex items-center justify-between text-xs p-2 rounded-lg bg-white dark:bg-zinc-950 border border-slate-200/70 dark:border-zinc-800"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-zinc-100">{mat.name}</span>
                        {mat.code && (
                          <span className="text-[10px] text-slate-400 font-mono">({mat.code})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 font-mono text-xs">
                        <span className="text-slate-500 dark:text-zinc-400">
                          {mat.rolls} {mat.rolls === 1 ? 'Roll' : 'Rolls'}
                        </span>
                        <span className="font-bold text-amber-700 dark:text-amber-400">
                          {mat.cutQty} {mat.unit}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 3. Dedicated Per-Product Dispatch Inputs */}
            <div className="p-3.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-300">
                  <Shirt className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Target Garment Styles &amp; Dispatch Qty ({targetProductsList.length})</span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-white dark:bg-zinc-900 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800">
                  <span className="text-[10px] uppercase tracking-normal text-slate-500 dark:text-zinc-400 font-sans">
                    Total:
                  </span>
                  <span>{totalDispatchQty.toLocaleString()} Units</span>
                </div>
              </div>

              <div className="space-y-2.5">
                {targetProductsList.map((tp: TargetProductItem, idx: number) => {
                  const qtyVal = productQuantities[idx];
                  const plannedQty = Number(tp.plannedQty || 0);
                  const remaining = plannedQty > 0 ? Math.max(0, plannedQty - tp.sentToLineQty) : 0;
                  const progressPct = plannedQty > 0 ? Math.min(100, Math.round((tp.sentToLineQty / plannedQty) * 100)) : (tp.sentToLineQty > 0 ? 100 : 0);

                  return (
                    <div
                      key={idx}
                      className="p-3 bg-white dark:bg-zinc-950 rounded-xl border border-slate-200/90 dark:border-zinc-800 space-y-2.5 shadow-2xs"
                    >
                      {/* Product Header Row: Thumbnail + Product Name (Truncated) + Badges inline on right */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {tp.imageUrl ? (
                            <img
                              src={tp.imageUrl}
                              alt={tp.productName}
                              className="size-9 rounded-lg object-cover border border-slate-200 dark:border-zinc-700 shrink-0"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="size-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/50 flex items-center justify-center shrink-0 text-indigo-600 dark:text-indigo-400">
                              <Shirt className="size-4" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <h5
                              className="text-xs font-bold text-slate-900 dark:text-white truncate whitespace-nowrap"
                              title={tp.productName}
                            >
                              {tp.productName}
                            </h5>
                            {tp.sku && (
                              <span className="text-[10px] text-slate-400 font-mono truncate block">
                                SKU: {tp.sku}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Compact Data Badges Inline on Right */}
                        <div className="flex items-center gap-1.5 text-xs shrink-0">
                          {(tp.cutQty > 0 || plannedQty > 0) && (
                            <div className="px-2 py-1 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-center">
                              <span className="text-[9px] uppercase font-bold text-slate-400 block leading-none mb-0.5">
                                Cut Pieces
                              </span>
                              <span className="font-mono font-bold text-slate-800 dark:text-zinc-200 leading-none">
                                {tp.cutQty || plannedQty} Pcs
                              </span>
                            </div>
                          )}
                          <div className="px-2 py-1 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-center">
                            <span className="text-[9px] uppercase font-bold text-indigo-500 block leading-none mb-0.5">
                              Line Intake
                            </span>
                            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 leading-none">
                              {tp.sentToLineQty > 0 ? `${tp.sentToLineQty} Pcs` : '0 Pcs'}
                            </span>
                          </div>
                          {plannedQty > 0 && (
                            <div className="px-2 py-1 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-center">
                              <span className="text-[9px] uppercase font-bold text-amber-600 block leading-none mb-0.5">
                                Remaining
                              </span>
                              <span className="font-mono font-bold text-amber-600 dark:text-amber-400 leading-none">
                                {remaining} Pcs
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Visual Progress Bar for Product (Unified Template) */}
                      <div className="space-y-1 pt-1 border-t border-slate-200/50 dark:border-zinc-800/60">
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="text-slate-500 dark:text-zinc-400">
                            Forwarded to Line: <strong className="text-indigo-600 dark:text-indigo-400">{tp.sentToLineQty} {plannedQty > 0 ? `/ ${plannedQty}` : ''} Pcs</strong>
                          </span>
                          {plannedQty > 0 && <span className="font-bold text-slate-700 dark:text-zinc-300">{progressPct}%</span>}
                        </div>
                        {plannedQty > 0 && (
                          <div className="h-1.5 w-full bg-slate-200/80 dark:bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                progressPct >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'
                              }`}
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Product Dispatch Quantity Input */}
                      <div className="pt-2 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                            Qty to Dispatch Today:
                          </label>
                          {plannedQty > 0 && remaining > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setProductQuantities((prev) => ({
                                  ...prev,
                                  [idx]: remaining,
                                }));
                              }}
                              className="text-[10px] text-indigo-600 hover:text-indigo-700 font-semibold underline cursor-pointer"
                            >
                              All ({remaining})
                            </button>
                          )}
                        </div>
                        {plannedQty > 0 && remaining <= 0 ? (
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 py-1">
                            <CheckCircle2 className="size-4" />
                            <span>All {plannedQty} Pcs Dispatched</span>
                          </div>
                        ) : (
                          <div className="w-32 shrink-0">
                            <Input
                              type="number"
                              min={0}
                              placeholder="0"
                              value={qtyVal === undefined ? '' : qtyVal}
                              onChange={(e) => handleQuantityChange(idx, e.target.value)}
                              className="h-8 text-xs font-mono font-bold text-right rounded-xl bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-indigo-700 dark:text-indigo-300"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 4. Optional Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Line Floor Notes &amp; Dispatch Instructions <span className="text-slate-400">(Optional)</span>
              </label>
              <Input
                value={lineNotes}
                onChange={(e) => setLineNotes(e.target.value)}
                placeholder="e.g. Assigned to Sewing Line #3, bundle tracker #A12"
                className="h-9 text-xs rounded-xl"
              />
            </div>
          </div>

          {/* Footer */}
          <DialogFooter className="px-5 py-3.5 border-t border-slate-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-950 z-10 flex-row justify-between items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="h-9 text-xs rounded-xl"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || totalDispatchQty <= 0}
              className="h-9 text-xs font-bold rounded-xl gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Dispatching {totalDispatchQty} Units...</span>
                </>
              ) : (
                <>
                  <Shirt className="w-3.5 h-3.5" />
                  <span>Dispatch {totalDispatchQty > 0 ? `${totalDispatchQty} Units` : ''} to Line</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SendToLineModal;
