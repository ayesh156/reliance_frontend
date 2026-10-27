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
import { post, get } from '../../lib/api';
import { toast } from 'react-toastify';
import {
  Shirt,
  Calendar,
  Loader2,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import { SearchableSelect } from '../ui/searchable-select';
import { BatchStatusBadge } from './BatchStatusBadge';

export interface TargetProductItem {
  productId: number;
  variantId?: number | null;
  productName: string;
  sku?: string;
  barcode?: string;
  cutQty: number;
  plannedQty: number;
  sentToLineQty: number;
  sewnQty: number;
  remaining: number;
  progressPct: number;
  imageUrl?: string | null;
}

export interface LogSewnModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batch: any | null;
  batches?: any[];
  showBatchSelector?: boolean;
  productsList?: any[];
  dark?: boolean;
  onSuccess?: (updatedBatch: any) => void;
  onSelectBatch?: (batch: any) => void;
}

export const LogSewnModal: React.FC<LogSewnModalProps> = ({
  open,
  onOpenChange,
  batch,
  batches = [],
  showBatchSelector = false,
  productsList = [],
  dark: _dark = false,
  onSuccess,
  onSelectBatch,
}) => {
  const [selectedBatchId, setSelectedBatchId] = useState<string>(batch ? String(batch.id) : '');
  const [productQuantities, setProductQuantities] = useState<Record<number, number | ''>>({});
  const [logDateTime, setLogDateTime] = useState<string>(getCurrentLocalDateTime());
  const [logNotes, setLogNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Fresh batch state
  const [freshBatch, setFreshBatch] = useState<any | null>(batch);
  const [isLoadingFresh, setIsLoadingFresh] = useState<boolean>(false);

  useEffect(() => {
    if (batch?.id) {
      setSelectedBatchId(String(batch.id));
      setFreshBatch(batch);
    } else if (batches.length > 0 && !selectedBatchId) {
      setSelectedBatchId(String(batches[0].id));
      setFreshBatch(batches[0]);
    }
  }, [batch, batches]);

  const activeBatchFromList = useMemo(() => {
    if (selectedBatchId && batches.length > 0) {
      const found = batches.find((b: any) => String(b.id) === selectedBatchId);
      if (found) return found;
    }
    return batch;
  }, [selectedBatchId, batches, batch]);

  const activeBatchId = activeBatchFromList?.id;

  useEffect(() => {
    if (open && activeBatchId) {
      let isMounted = true;
      setIsLoadingFresh(true);
      get<any>(`/production/${activeBatchId}`)
        .then((res: any) => {
          if (!isMounted) return;
          const data = res?.data || res;
          if (data && data.id) {
            setFreshBatch(data);
          }
        })
        .catch((err) => {
          console.error('Failed to dynamically fetch latest batch for LogSewnModal:', err);
        })
        .finally(() => {
          if (isMounted) setIsLoadingFresh(false);
        });

      return () => {
        isMounted = false;
      };
    }
  }, [open, activeBatchId]);

  const activeBatch = (freshBatch && freshBatch.id === activeBatchId) ? freshBatch : activeBatchFromList;

  // Extract all target products mapped to this batch
  const targetProductsList = useMemo(() => {
    if (!activeBatch) return [];
    const list: TargetProductItem[] = [];

    let raw = activeBatch.targetProducts;
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch {
        raw = [];
      }
    }

    if (Array.isArray(raw) && raw.length > 0) {
      raw.forEach((tp: any) => {
        const pId = Number(tp.productId || tp.id);
        const vId = tp.variantId ? Number(tp.variantId) : null;
        const fullProduct = productsList.find((p: any) => p.id === pId);
        const rawImg =
          fullProduct?.images?.[0]?.imageUrl ||
          fullProduct?.image ||
          (activeBatch.product?.id === pId ? activeBatch.product.images?.[0]?.imageUrl : null);

        const totalCut = Number(tp.cutQty ?? tp.plannedQty ?? 0);
        const lineIntake = Number(tp.sentToLineQty ?? tp.lineSentQty ?? activeBatch.lineSentQty ?? totalCut);
        const sewn = Number(tp.sewnQty || 0);
        const remaining = Math.max(0, lineIntake - sewn);
        const progressPct = lineIntake > 0 ? Math.min(100, Math.round((sewn / lineIntake) * 100)) : (sewn > 0 ? 100 : 0);

        list.push({
          productId: pId,
          variantId: vId,
          productName: tp.productName || fullProduct?.name || `Product #${pId}`,
          sku: tp.sku || fullProduct?.variants?.[0]?.sku || '',
          barcode: tp.barcode || fullProduct?.variants?.[0]?.barcode || '',
          cutQty: totalCut,
          plannedQty: totalCut,
          sentToLineQty: lineIntake,
          sewnQty: sewn,
          remaining,
          progressPct,
          imageUrl: rawImg ? getProductImageUrl(rawImg) : null,
        });
      });
    }

    if (list.length === 0 && activeBatch.product) {
      const rawImg = activeBatch.product.images?.[0]?.imageUrl || (activeBatch.product as any)?.image;
      const totalCut = Number(activeBatch.cutQty || activeBatch.targetQuantity || 0);
      const lineIntake = Number(activeBatch.lineSentQty || totalCut);
      const sewn = Number(activeBatch.sewnQty || 0);
      const remaining = Math.max(0, lineIntake - sewn);
      const progressPct = lineIntake > 0 ? Math.min(100, Math.round((sewn / lineIntake) * 100)) : (sewn > 0 ? 100 : 0);

      list.push({
        productId: activeBatch.productId,
        variantId: activeBatch.variantId || null,
        productName: activeBatch.product.name,
        sku: activeBatch.variant?.sku || '',
        barcode: activeBatch.variant?.barcode || '',
        cutQty: totalCut,
        plannedQty: totalCut,
        sentToLineQty: lineIntake,
        sewnQty: sewn,
        remaining,
        progressPct,
        imageUrl: rawImg ? getProductImageUrl(rawImg) : null,
      });
    }

    return list;
  }, [activeBatch, productsList]);

  // Calculate overall batch line intake and sewn to date for dedicated progress bar
  const overallLineIntake = useMemo(() => {
    if (targetProductsList.length > 0) {
      return targetProductsList.reduce((sum: number, p: TargetProductItem) => sum + p.sentToLineQty, 0);
    }
    return Number(activeBatch?.lineSentQty ?? activeBatch?.targetQuantity ?? 0);
  }, [targetProductsList, activeBatch]);

  const overallSewnToDate = useMemo(() => {
    if (targetProductsList.length > 0) {
      return targetProductsList.reduce((sum: number, p: TargetProductItem) => sum + p.sewnQty, 0);
    }
    return Number(activeBatch?.sewnQty ?? 0);
  }, [targetProductsList, activeBatch]);

  const overallSewnPct = overallLineIntake > 0
    ? Math.min(100, Math.round((overallSewnToDate / overallLineIntake) * 100))
    : 0;

  // Reset inputs on open or when active batch changes
  useEffect(() => {
    if (open && activeBatch) {
      const initialQtys: Record<number, number | ''> = {};
      targetProductsList.forEach((_: TargetProductItem, idx: number) => {
        initialQtys[idx] = '';
      });
      setProductQuantities(initialQtys);
      setLogDateTime(getCurrentLocalDateTime());
      setLogNotes('');
    }
  }, [open, activeBatch?.id, targetProductsList.length]);

  // Calculate total sewn pieces entered across all products
  const totalEnteredSewnQty = useMemo(() => {
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
    if (!activeBatch?.id) return;

    if (totalEnteredSewnQty <= 0) {
      toast.warn('Please enter sewn pieces (> 0) for at least one garment style.');
      return;
    }

    const items = targetProductsList
      .map((tp: TargetProductItem, idx: number) => {
        const qty = Number(productQuantities[idx] || 0);
        return {
          productId: tp.productId,
          variantId: tp.variantId || null,
          sewnQty: qty,
        };
      })
      .filter((it) => it.sewnQty > 0);

    if (items.length === 0) {
      toast.warn('Please enter a valid sewn quantity greater than zero for at least one product.');
      return;
    }

    setIsSubmitting(true);
    try {
      const formattedDate = logDateTime
        ? new Date(logDateTime).toISOString()
        : new Date().toISOString();

      const payload = {
        items,
        sewnQuantity: totalEnteredSewnQty,
        date: formattedDate,
        notes: logNotes.trim() || undefined,
      };

      let res: any;
      try {
        res = await post(`/production/batches/${activeBatch.id}/log-sewn`, payload);
      } catch {
        res = await post(`/production/${activeBatch.id}/log-sewn`, payload);
      }
      const updatedBatch = res?.data || res;

      toast.success(
        `Cutting #${activeBatch.productionNo} successfully recorded ${totalEnteredSewnQty} sewn garments!`
      );
      if (onSuccess) {
        onSuccess(updatedBatch);
      }
      onOpenChange(false);
    } catch (err: any) {
      console.error('Failed to log daily sewn pieces:', err);
      toast.error(
        err?.response?.data?.message || err?.message || 'Failed to record sewn garments'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!activeBatch) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-3xl lg:max-w-4xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 shadow-2xl">
        {/* Header */}
        <DialogHeader className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-950 z-10 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-500/20 shadow-xs">
                <Shirt className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Log Daily Sewn Pieces</span>
                  <BatchStatusBadge status={activeBatch.status} isStockSynced={activeBatch.isStockSynced} />
                </DialogTitle>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Record daily completed sewing output for this Cutting order
                </p>
              </div>
            </div>

            <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white border border-slate-200 dark:border-zinc-700">
              #{activeBatch.productionNo}
            </span>
          </div>
        </DialogHeader>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {/* 0. Optional Cutting Selector Dropdown (When triggered from top header) */}
            {showBatchSelector && batches && batches.length > 0 && (
              <div className="p-3.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/60 space-y-1.5 shadow-2xs">
                <label className="text-xs font-bold text-purple-950 dark:text-purple-200 flex items-center gap-1.5">
                  <Shirt className="size-3.5 text-purple-600 dark:text-purple-400" />
                  <span>Select Active Cutting Order:</span>
                </label>
                <SearchableSelect
                  options={batches.map((b: any) => {
                    const prodName = b.product?.name || 'Garment';
                    const intake = b.lineSentQty || b.targetQuantity || 0;
                    const sewn = b.sewnQty || 0;
                    return {
                      value: String(b.id),
                      label: `#${b.productionNo} · ${prodName} (${sewn}/${intake} Pcs Sewn)`,
                    };
                  })}
                  value={selectedBatchId}
                  onChange={(val) => {
                    setSelectedBatchId(val);
                    const found = batches.find((b: any) => String(b.id) === val);
                    if (found) {
                      setFreshBatch(found);
                      onSelectBatch?.(found);
                    }
                  }}
                  placeholder="Search and select Cutting record..."
                  searchPlaceholder="Filter cutting # or style..."
                  className="bg-white dark:bg-zinc-900 text-xs font-medium"
                />
              </div>
            )}

            {/* Dedicated Daily Sewn Progress Bar */}
            <div className="p-3.5 rounded-xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200/90 dark:border-purple-900/60 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 font-bold text-purple-950 dark:text-purple-200">
                  <Shirt className="size-4 text-purple-600 dark:text-purple-400" />
                  <span>Daily Sewn Progress</span>
                </div>
                <div className="font-mono text-xs font-bold text-purple-700 dark:text-purple-300">
                  Sewn: {overallSewnToDate.toLocaleString()} / {overallLineIntake.toLocaleString()} Pcs ({overallSewnPct}%)
                </div>
              </div>
              <div className="h-2.5 w-full bg-slate-200/80 dark:bg-zinc-800 rounded-full overflow-hidden p-0.5">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    overallSewnPct >= 100 ? 'bg-emerald-500' : 'bg-purple-600 dark:bg-purple-500'
                  }`}
                  style={{ width: `${overallSewnPct}%` }}
                />
              </div>
            </div>

            {/* 1. Date & Time Picker */}
            <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-zinc-300">
                <Calendar className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                <span>Sewing Date &amp; Time:</span>
              </div>
              <DateTimePicker
                value={logDateTime}
                onChange={setLogDateTime}
              />
            </div>

            {/* 2. Target Garments Cards */}
            <div className="p-3.5 rounded-xl bg-purple-50/40 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-purple-900 dark:text-purple-300">
                  <Layers className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                  <span>Garment Styles Output ({targetProductsList.length})</span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-purple-700 dark:text-purple-300 bg-white dark:bg-zinc-900 px-2.5 py-1 rounded-lg border border-purple-200 dark:border-purple-800">
                  <span className="text-[10px] uppercase tracking-normal text-slate-500 dark:text-zinc-400 font-sans">
                    Sewn Today:
                  </span>
                  <span>{totalEnteredSewnQty.toLocaleString()} Units</span>
                </div>
              </div>

              <div className="space-y-2.5">
                {targetProductsList.map((tp: TargetProductItem, idx: number) => {
                  const qtyVal = productQuantities[idx];
                  const lineIntake = Number(tp.sentToLineQty || 0);
                  const totalSewn = Number(tp.sewnQty || 0);
                  const remaining = Math.max(0, lineIntake - totalSewn);
                  const progressPct = lineIntake > 0 ? Math.min(100, Math.round((totalSewn / lineIntake) * 100)) : (totalSewn > 0 ? 100 : 0);

                  return (
                    <div
                      key={idx}
                      className="p-3 bg-white dark:bg-zinc-950 rounded-xl border border-slate-200/90 dark:border-zinc-800 space-y-2.5 shadow-2xs"
                    >
                      {/* Product Header Row */}
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
                            <div className="size-9 rounded-lg bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/50 flex items-center justify-center shrink-0 text-purple-600 dark:text-purple-400">
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

                        {/* Badges Inline on Right: Line Intake / Total Sewn / Remaining */}
                        <div className="flex items-center gap-1.5 text-xs shrink-0">
                          <div className="px-2 py-1 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-center">
                            <span className="text-[9px] uppercase font-bold text-slate-400 block leading-none mb-0.5">
                              Line Intake
                            </span>
                            <span className="font-mono font-bold text-slate-800 dark:text-zinc-200 leading-none">
                              {lineIntake} Pcs
                            </span>
                          </div>
                          <div className="px-2 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-center">
                            <span className="text-[9px] uppercase font-bold text-purple-600 block leading-none mb-0.5">
                              Total Sewn
                            </span>
                            <span className="font-mono font-bold text-purple-700 dark:text-purple-300 leading-none">
                              {totalSewn} Pcs
                            </span>
                          </div>
                          <div className="px-2 py-1 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-center">
                            <span className="text-[9px] uppercase font-bold text-amber-600 block leading-none mb-0.5">
                              Remaining
                            </span>
                            <span className="font-mono font-bold text-amber-600 dark:text-amber-400 leading-none">
                              {remaining} Pcs
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Visual Progress Bar (Unified Template) */}
                      <div className="space-y-1 pt-1 border-t border-slate-200/50 dark:border-zinc-800/60">
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="text-slate-500 dark:text-zinc-400">
                            Sewn to Date: <strong className="text-purple-600 dark:text-purple-400">{totalSewn} / {lineIntake} Pcs</strong>
                          </span>
                          <span className="font-bold text-slate-700 dark:text-zinc-300">{progressPct}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-200/80 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              progressPct >= 100 ? 'bg-emerald-500' : 'bg-purple-600'
                            }`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>

                      {/* Sewn Qty Input */}
                      <div className="pt-2 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                            Sewn Qty Today:
                          </label>
                          {remaining > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setProductQuantities((prev) => ({
                                  ...prev,
                                  [idx]: remaining,
                                }));
                              }}
                              className="text-[10px] text-purple-600 hover:text-purple-700 font-semibold underline cursor-pointer"
                            >
                              All ({remaining})
                            </button>
                          )}
                        </div>

                        <div className="w-32">
                          <Input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={qtyVal === '' ? '' : qtyVal}
                            onChange={(e) => handleQuantityChange(idx, e.target.value)}
                            className="h-8 text-right font-mono text-xs font-bold rounded-lg focus:ring-purple-500 focus:border-purple-500"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Supervisor Notes (Optional):
              </label>
              <textarea
                rows={2}
                value={logNotes}
                onChange={(e) => setLogNotes(e.target.value)}
                placeholder="Shift notes, machine line number, or quality remarks..."
                className="w-full text-xs rounded-xl p-2.5 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Footer */}
          <DialogFooter className="px-5 py-3 border-t border-slate-100 dark:border-zinc-800 shrink-0 bg-slate-50/80 dark:bg-zinc-900/40 flex items-center justify-between sm:justify-between">
            <span className="text-xs text-slate-500 dark:text-zinc-400 font-mono">
              Total Sewn Today: <strong className="text-purple-700 dark:text-purple-300 font-bold">{totalEnteredSewnQty} Pcs</strong>
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                className="rounded-xl text-xs h-9"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting || totalEnteredSewnQty <= 0}
                className="rounded-xl text-xs h-9 bg-purple-600 hover:bg-purple-700 text-white font-bold gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Log Sewn Pieces ({totalEnteredSewnQty})</span>
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
