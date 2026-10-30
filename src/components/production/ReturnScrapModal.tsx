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
import { Input } from '../ui/input';
import { post } from '../../lib/api';
import { toast } from 'react-toastify';
import {
  RotateCcw,
  Layers,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Info,
} from 'lucide-react';

export interface ReturnScrapModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: any | null;
  dark?: boolean;
  onSuccess?: (updatedBatch: any) => void;
}

interface ReturnScrapLine {
  usageId: number;
  rawMaterialId: number;
  materialName: string;
  materialCode?: string;
  unit: string;
  issuedQty: number;
  totalCutQty: number;
  previouslyReturnedScrap: number;
  maxReturnable: number;
  scrapQty: number | '';
  returnReason: string;
}

export const ReturnScrapModal: React.FC<ReturnScrapModalProps> = ({
  open,
  onOpenChange,
  order,
  dark: _dark,
  onSuccess,
}) => {
  const [returnLines, setReturnLines] = useState<ReturnScrapLine[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Initialize return lines whenever modal opens or order changes
  useEffect(() => {
    if (!open || !order) {
      setReturnLines([]);
      return;
    }

    const usages: any[] = order.materialUsages || [];
    const cutLogs: any[] = order.cutLogs || [];

    const lines: ReturnScrapLine[] = usages.map((u: any) => {
      const totalCut = cutLogs
        .filter((c: any) => c.rawMaterialId === u.rawMaterialId)
        .reduce((sum: number, c: any) => sum + Number(c.quantityCut || 0), 0);

      const previouslyReturned = Number(u.returnedScrap ?? u.returnedQty ?? 0);
      const issued = Number(u.issuedQty || 0);
      const maxReturnable = Math.max(0, Number((issued - totalCut - previouslyReturned).toFixed(2)));

      return {
        usageId: u.id,
        rawMaterialId: u.rawMaterialId,
        materialName: u.rawMaterial?.name || `Material #${u.rawMaterialId}`,
        materialCode: u.rawMaterial?.code,
        unit: u.rawMaterial?.unit || 'Units',
        issuedQty: issued,
        totalCutQty: totalCut,
        previouslyReturnedScrap: previouslyReturned,
        maxReturnable,
        scrapQty: '',
        returnReason: '',
      };
    });

    setReturnLines(lines);
  }, [open, order]);

  const handleScrapQtyChange = (idx: number, val: string) => {
    setReturnLines((prev) => {
      const copy = [...prev];
      if (val === '') {
        copy[idx].scrapQty = '';
      } else {
        const num = parseFloat(val);
        copy[idx].scrapQty = isNaN(num) ? '' : num;
      }
      return copy;
    });
  };

  const handleReasonChange = (idx: number, val: string) => {
    setReturnLines((prev) => {
      const copy = [...prev];
      copy[idx].returnReason = val;
      return copy;
    });
  };

  const totalScrapEntered = returnLines.reduce((sum, line) => {
    return sum + (typeof line.scrapQty === 'number' && line.scrapQty > 0 ? line.scrapQty : 0);
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order?.id) return;

    const activeReturns = returnLines
      .filter((l) => typeof l.scrapQty === 'number' && l.scrapQty > 0)
      .map((l) => ({
        usageId: Number(l.usageId),
        rawMaterialId: Number(l.rawMaterialId),
        scrapQty: Number(l.scrapQty),
        returnedScrap: Number(l.scrapQty),
        returnReason: l.returnReason.trim() || 'Leftover scrap returned to warehouse',
      }));

    if (activeReturns.length === 0) {
      toast.error('Please enter a scrap return quantity greater than 0 for at least one material.');
      return;
    }

    // Validate quantities against max returnable
    for (const ret of activeReturns) {
      const line = returnLines.find((l) => l.usageId === ret.usageId);
      if (line && ret.scrapQty > line.maxReturnable) {
        toast.error(`Return quantity for ${line.materialName} cannot exceed ${line.maxReturnable} ${line.unit}.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const res: any = await post(`/production/batches/${order.id}/return-scrap`, {
        returns: activeReturns,
      });

      const updatedBatch = res?.data || res;
      toast.success(
        `Successfully restored ${activeReturns.length} scrap material line(s) back to warehouse inventory!`
      );
      onOpenChange(false);
      if (onSuccess) {
        onSuccess(updatedBatch);
      }
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || err?.message || 'Failed to return material scrap to inventory'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 shadow-2xl">
        {/* Header */}
        <DialogHeader className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-950 z-10">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 flex items-center justify-center border border-teal-200 dark:border-teal-900/50 shadow-xs">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Return Material Scrap</span>
                <Badge variant="outline" className="text-[10px] text-teal-700 dark:text-teal-400 border-teal-300 dark:border-teal-800 font-mono">
                  Batch #{order.productionNo}
                </Badge>
              </DialogTitle>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Restores uncut fabric &amp; raw materials back into warehouse stock with audit logging.
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Informational Banner */}
        <div className="px-5 py-2.5 bg-teal-50/60 dark:bg-teal-950/30 border-b border-teal-100 dark:border-teal-900/40 text-xs text-teal-950 dark:text-teal-200 flex items-center gap-2">
          <Info className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
          <span>
            Quantities entered here will atomically increment warehouse inventory (<strong>RawMaterialItem.currentStock</strong>) and update this batch&apos;s net material usage.
          </span>
        </div>

        {/* Content list */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {returnLines.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No allocated materials found on this production batch.
            </div>
          ) : (
            returnLines.map((line, idx) => {
              const isOverMax = typeof line.scrapQty === 'number' && line.scrapQty > line.maxReturnable;
              const hasReturn = typeof line.scrapQty === 'number' && line.scrapQty > 0;

              return (
                <div
                  key={line.usageId}
                  className={`p-3.5 rounded-xl border transition-all ${
                    hasReturn
                      ? 'bg-teal-50/40 dark:bg-teal-950/20 border-teal-300 dark:border-teal-800'
                      : 'bg-slate-50/70 dark:bg-zinc-900/50 border-slate-200 dark:border-zinc-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center text-teal-600 shrink-0">
                        <Layers className="size-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                          {line.materialName}
                        </h4>
                        <div className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono flex items-center gap-2 mt-0.5">
                          {line.materialCode && <span>Code: {line.materialCode}</span>}
                          <span>Issued: {line.issuedQty} {line.unit}</span>
                          {line.totalCutQty > 0 && <span>· Cut: {line.totalCutQty} {line.unit}</span>}
                          {line.previouslyReturnedScrap > 0 && (
                            <span className="text-teal-600 dark:text-teal-400 font-medium">
                              · Prev Scrap: {line.previouslyReturnedScrap} {line.unit}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">
                        Max Returnable
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-mono font-bold ${
                          line.maxReturnable > 0
                            ? 'text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30'
                            : 'text-slate-400 border-slate-200 dark:border-zinc-800'
                        }`}
                      >
                        {line.maxReturnable} {line.unit}
                      </Badge>
                    </div>
                  </div>

                  {line.maxReturnable > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-200/60 dark:border-zinc-800/60">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider flex items-center justify-between">
                          <span>Scrap / Returned Qty ({line.unit})</span>
                          {isOverMax && (
                            <span className="text-rose-500 font-semibold flex items-center gap-1 normal-case">
                              <AlertCircle className="size-3" /> Exceeds max
                            </span>
                          )}
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={line.maxReturnable}
                          value={line.scrapQty}
                          onChange={(e) => handleScrapQtyChange(idx, e.target.value)}
                          placeholder={`Enter qty (max ${line.maxReturnable})`}
                          className={`h-8 text-xs rounded-lg font-mono font-bold bg-white dark:bg-zinc-950 ${
                            isOverMax
                              ? 'border-rose-400 focus:ring-rose-400 text-rose-600'
                              : 'border-slate-200 dark:border-zinc-800 text-teal-700 dark:text-teal-300'
                          }`}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider block">
                          Reason / Note <span className="text-slate-400 font-normal">(Optional)</span>
                        </label>
                        <Input
                          type="text"
                          value={line.returnReason}
                          onChange={(e) => handleReasonChange(idx, e.target.value)}
                          placeholder="e.g. Uncut end roll saved, pattern adjustment"
                          className="h-8 text-xs rounded-lg bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800"
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 dark:text-zinc-500 italic pt-1 border-t border-slate-200/60 dark:border-zinc-800/60">
                      All issued material for this line has been fully cut or already returned.
                    </p>
                  )}
                </div>
              );
            })
          )}

          <DialogFooter className="px-0 pt-3 border-t border-slate-100 dark:border-zinc-800 shrink-0 bg-transparent flex-row justify-between items-center gap-2">
            <div className="text-xs text-slate-600 dark:text-zinc-400 font-medium">
              {totalScrapEntered > 0 ? (
                <span className="text-teal-600 dark:text-teal-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="size-3.5" />
                  Ready to return scrap
                </span>
              ) : (
                <span>Enter return quantity above</span>
              )}
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
                disabled={isSubmitting || totalScrapEntered <= 0}
                className="bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer h-8"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Restoring Stock...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Confirm Scrap Return</span>
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

export default ReturnScrapModal;
