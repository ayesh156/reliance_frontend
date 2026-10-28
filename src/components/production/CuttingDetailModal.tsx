import React, { useMemo, useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { getProductImageUrl } from '../../lib/utils';
import {
  Scissors,
  Shirt,
  Calendar,
  Layers,
  Sparkles,
  Info,
  Clock,
  History,
  ArrowRight,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { BatchStatusBadge } from './BatchStatusBadge';
import { post } from '../../lib/api';
import { toast } from 'react-toastify';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { SendToLineModal } from './SendToLineModal';

export interface StageTransitionInfo {
  fromStage: string;
  toStage: string;
  fromStyle: string;
  toStyle: string;
  label: string;
  actionDisplay: string;
}

export function resolveStageTransition(stage?: string | null, action?: string | null, notes?: string | null): StageTransitionInfo {
  const stg = (stage || '').toUpperCase().trim();
  const act = (action || '').toUpperCase().trim();

  // 1. Send to Line from Cutting
  if (act.includes('SEND_TO_LINE') || (stg === 'LINE' && (act.includes('LINE') || act.includes('DISPATCH')))) {
    if (act.includes('DIRECT_LINE')) {
      return {
        fromStage: 'Direct Cut',
        toStage: 'Sewing Line',
        fromStyle: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800',
        toStyle: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800',
        label: 'Dispatched to Sewing Line',
        actionDisplay: 'Direct Line Intake',
      };
    }
    return {
      fromStage: 'Cutting Floor',
      toStage: 'Sewing Line',
      fromStyle: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800',
      toStyle: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800',
      label: 'Dispatched to Sewing Line',
      actionDisplay: 'Handover to Line',
    };
  }

  // 2. Send to Wash from Line
  if (act.includes('SEND_TO_WASH') || (stg === 'WASHING' && (act.includes('DISPATCH') || act.includes('WASH')))) {
    if (notes && notes.includes('Direct Wash')) {
      return {
        fromStage: 'Direct Cut',
        toStage: 'Wash Plant',
        fromStyle: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800',
        toStyle: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800',
        label: 'Direct Wash Handover',
        actionDisplay: 'Direct Wash Intake',
      };
    }
    return {
      fromStage: 'Sewing Line',
      toStage: 'Wash Plant',
      fromStyle: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800',
      toStyle: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800',
      label: 'Forwarded to Washing Plant',
      actionDisplay: 'Washing Handover',
    };
  }

  // 3. Wash output logged & stock sync
  if (act.includes('WASHED') || act.includes('LOG_WASHED') || (stg === 'COMPLETED' && act.includes('STOCK'))) {
    return {
      fromStage: 'Wash Plant',
      toStage: 'Finished Stock',
      fromStyle: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800',
      toStyle: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
      label: 'Washed & Synced to Stock',
      actionDisplay: 'Available Inventory',
    };
  }

  // 4. Daily Sewn logged on Line
  if (act.includes('SEWN') || act.includes('LOG_SEWN')) {
    return {
      fromStage: 'Sewing Line',
      toStage: 'Sewing Progress',
      fromStyle: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800',
      toStyle: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800',
      label: 'Daily Pieces Sewn',
      actionDisplay: 'Sewn Output',
    };
  }

  // 5. Initial Cutting
  if (act.includes('INITIAL') || act.includes('CUT') || stg === 'CUTTING') {
    return {
      fromStage: 'Warehouse Fabric',
      toStage: 'Cutting Floor',
      fromStyle: 'bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-300 border-slate-300 dark:border-zinc-700',
      toStyle: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800',
      label: 'Initial Material Cut',
      actionDisplay: 'Fabric Allocation',
    };
  }

  // Fallback
  return {
    fromStage: stg || 'Production',
    toStage: act || 'Process',
    fromStyle: 'bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-300 border-slate-300 dark:border-zinc-700',
    toStyle: 'bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-300 border-slate-300 dark:border-zinc-700',
    label: act.replace(/_/g, ' ') || 'Stage Transition',
    actionDisplay: act.replace(/_/g, ' ') || 'Update',
  };
}

export function formatSriLankaDateTime(dateStr?: string | Date | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    const datePart = d.toLocaleDateString('en-CA');
    const timePart = d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
    return `${datePart} ${timePart}`;
  } catch {
    return String(dateStr);
  }
}

export interface CuttingDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: any | null;
  rawMaterialsList?: any[];
  productsList?: any[];
  onOpenMultiWash?: (batch: any) => void;
  onOrderUpdate?: (updatedOrder: any) => void;
  onRefresh?: () => void;
  dark?: boolean;
}

export const CuttingDetailModal: React.FC<CuttingDetailModalProps> = ({
  open,
  onOpenChange,
  order: initialOrder,
  rawMaterialsList = [],
  productsList = [],
  onOpenMultiWash,
  onOrderUpdate,
  onRefresh,
  dark = false,
}) => {
  const [currentOrder, setCurrentOrder] = useState<any | null>(initialOrder);
  const [isSendToLineOpen, setIsSendToLineOpen] = useState<boolean>(false);
  const [logToRevert, setLogToRevert] = useState<any | null>(null);
  const [isReverting, setIsReverting] = useState(false);

  useEffect(() => {
    setCurrentOrder(initialOrder);
  }, [initialOrder]);

  const order = currentOrder || initialOrder;

  const handleBatchUpdated = (newOrder: any) => {
    setCurrentOrder(newOrder);
    if (onOrderUpdate) onOrderUpdate(newOrder);
    if (onRefresh) onRefresh();
  };

  const chronologicalLogs = useMemo(() => {
    if (!order?.activityLogs || !Array.isArray(order.activityLogs)) return [];
    return [...order.activityLogs].sort(
      (a: any, b: any) =>
        new Date(a.timestamp || a.createdAt).getTime() - new Date(b.timestamp || b.createdAt).getTime()
    );
  }, [order?.activityLogs]);

  const handleConfirmRevert = async () => {
    if (!logToRevert || !order?.id) return;
    setIsReverting(true);
    try {
      const res: any = await post(`/production/${order.id}/revert-log/${logToRevert.id}`, {});
      const updated = res?.data || res;
      toast.success('Successfully returned to previous state and removed log entry');
      setLogToRevert(null);
      handleBatchUpdated(updated);
    } catch (err: any) {
      console.error('Failed to revert activity log:', err);
      toast.error(err.message || 'Failed to revert step to previous state');
    } finally {
      setIsReverting(false);
    }
  };

  // Parse target finished products from order
  const targetProductsList = useMemo(() => {
    if (!order) return [];
    let list: Array<{
      productId: number;
      productName: string;
      sku?: string;
      barcode?: string;
      cutQty?: number;
      plannedQty?: number;
      sentToLineQty?: number;
      imageUrl?: string | null;
    }> = [];

    let parsed = order.targetProducts;
    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        parsed = null;
      }
    }

    if (Array.isArray(parsed) && parsed.length > 0) {
      parsed
        .filter((tp: any) => tp && (tp.productId || tp.id))
        .forEach((tp: any) => {
          const pId = Number(tp.productId || tp.id);
          const fullProduct = productsList.find((p) => p.id === pId);
          const rawImg = fullProduct?.images?.[0]?.imageUrl || (fullProduct as any)?.image;
          list.push({
            productId: pId,
            productName: tp.productName || fullProduct?.name || `Product #${pId}`,
            sku: tp.sku || fullProduct?.variants?.[0]?.sku || '',
            barcode: tp.barcode || fullProduct?.variants?.[0]?.barcode || '',
            cutQty: tp.cutQty !== undefined && tp.cutQty !== null ? Number(tp.cutQty) : (Number(tp.plannedQty) || 0),
            plannedQty: tp.plannedQty,
            sentToLineQty: Number(tp.sentToLineQty ?? tp.lineSentQty) || 0,
            imageUrl: rawImg ? getProductImageUrl(rawImg) : null,
          });
        });
    } else if (order.product) {
      const p = order.product;
      const rawImg = p.images?.[0]?.imageUrl || (p as any).image;
      list.push({
        productId: p.id,
        productName: p.name,
        sku: order.variant?.sku || '',
        barcode: order.variant?.barcode || '',
        cutQty: order.cutQty || order.targetQuantity || order.completedQty || 1,
        plannedQty: order.targetQuantity || order.completedQty || 1,
        sentToLineQty: Number(order.lineSentQty) || 0,
        imageUrl: rawImg ? getProductImageUrl(rawImg) : null,
      });
    }

    return list;
  }, [order, productsList]);

  if (!order) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] sm:max-w-3xl lg:max-w-4xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 shadow-2xl">
          {/* Streamlined Header */}
          <DialogHeader className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-950 z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20 shadow-xs">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2.5 flex-wrap">
                    <span>Cutting #{order.productionNo}</span>
                    <BatchStatusBadge status={order.status} isStockSynced={order.isStockSynced} />
                  </DialogTitle>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    Manufacturing Audit Trail &amp; Stage Flow
                  </p>
                </div>
              </div>

              <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white border border-slate-200 dark:border-zinc-700">
                #{order.productionNo}
              </span>
            </div>
          </DialogHeader>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {/* Target Garment Products Breakdown */}
            <div className="p-3.5 bg-slate-50/80 dark:bg-zinc-900/40 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Shirt className="size-3.5 text-amber-600 dark:text-amber-400" />
                  <span>TARGET GARMENTS ({targetProductsList.length})</span>
                </h4>
                <span className="text-[11px] font-mono font-semibold text-slate-500">
                  Total Cut: {targetProductsList.reduce((sum, p) => sum + (p.cutQty || 0), 0)} Pcs
                </span>
              </div>

              <div className="space-y-2">
                {targetProductsList.map((tp, idx) => (
                  <div
                    key={`prod-${tp.productId}-${idx}`}
                    className="p-2.5 bg-white dark:bg-zinc-950 rounded-lg border border-slate-200/90 dark:border-zinc-800 flex items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {tp.imageUrl ? (
                        <img
                          src={tp.imageUrl}
                          alt={tp.productName}
                          className="size-8 rounded-lg object-cover border border-slate-200 dark:border-zinc-700 shrink-0"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="size-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400">
                          <Shirt className="size-4" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <h5 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {tp.productName}
                        </h5>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                          {tp.sku && <span>SKU: {tp.sku}</span>}
                          {tp.barcode && <span>• Barcode: {tp.barcode}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="font-mono text-[10px] font-bold px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                        Cut: {tp.cutQty ?? 0} Pcs
                      </Badge>
                      <Badge variant="outline" className="font-mono text-[10px] font-bold px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800">
                        Sent to Line: {tp.sentToLineQty ?? 0} Pcs
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Raw Material Consumption Breakdown */}
            {order.materialUsages && order.materialUsages.length > 0 && (
              <div className="p-3.5 bg-slate-50/80 dark:bg-zinc-900/40 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-2.5 shadow-2xs">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="size-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Allocated Raw Materials</span>
                </h4>
                <div className="space-y-2">
                  {order.materialUsages.map((usage: any) => (
                    <div
                      key={usage.id}
                      className="p-2.5 bg-white dark:bg-zinc-950 rounded-lg border border-slate-200/90 dark:border-zinc-800 flex items-center justify-between gap-2 shadow-2xs text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {usage.rawMaterial?.name || 'Raw Material'}
                        </span>
                        <div className="text-[10px] text-slate-500 font-mono">
                          Code: {usage.rawMaterial?.code || '—'} · Rolls: {usage.piecesCount || 1}
                        </div>
                      </div>
                      <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
                        {usage.netConsumedQty ?? usage.issuedQty} {usage.rawMaterial?.unit || 'Units'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Activity Logs Timeline */}
            <div className="p-3.5 bg-slate-50/80 dark:bg-zinc-900/40 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-2.5 shadow-2xs">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="size-3.5 text-amber-600 dark:text-amber-400" />
                <span>Manufacturing Log &amp; Audit Trail</span>
              </h4>

              {chronologicalLogs.length > 0 ? (
                <div className="space-y-2">
                  {chronologicalLogs.map((log: any) => {
                    const trans = resolveStageTransition(log.stage, log.action, log.notes);
                    const actUpper = (log.action || '').toUpperCase();
                    const isRevertible =
                      !actUpper.includes('INITIAL') &&
                      !actUpper.includes('CANCEL') &&
                      (actUpper.includes('SEND_TO_LINE') ||
                        actUpper.includes('SEND_TO_WASH') ||
                        actUpper.includes('LOG_SEWN') ||
                        actUpper.includes('SEWN') ||
                        actUpper.includes('STOCK') ||
                        actUpper.includes('WASHED') ||
                        actUpper.includes('WASH_COMPLETED') ||
                        log.stage === 'LINE' ||
                        log.stage === 'WASHING');

                    return (
                      <div
                        key={log.id}
                        className="p-2.5 bg-white dark:bg-zinc-950 rounded-lg border border-slate-200/90 dark:border-zinc-800 space-y-1.5 shadow-2xs text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${trans.fromStyle}`}>
                              {trans.fromStage}
                            </span>
                            <ArrowRight className="size-3 text-slate-400" />
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${trans.toStyle}`}>
                              {trans.toStage}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-500 dark:text-zinc-400 font-medium">
                            {formatSriLankaDateTime(log.timestamp || log.createdAt)}
                          </span>
                        </div>
                        {log.notes && (
                          <div className="space-y-0.5 pt-0.5">
                            {(() => {
                              const rawNotes = String(log.notes || '');
                              const lines = rawNotes
                                .split(/(?:•|\n|;|\|)/g)
                                .map((s) => s.trim())
                                .filter(Boolean);

                              const displayLines = lines.length > 0 ? lines : [rawNotes];

                              return displayLines.map((line, lIdx) => (
                                <div key={lIdx} className="flex items-start gap-1.5 text-[11px] text-slate-600 dark:text-zinc-300 font-mono">
                                  <span className="text-cyan-500 dark:text-cyan-400 mt-0.5 shrink-0">•</span>
                                  <span className="break-words">{line}</span>
                                </div>
                              ));
                            })()}
                          </div>
                        )}
                        <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-100 dark:border-zinc-800/80">
                          <span>Operator: {log.userName || 'System'}</span>
                          <div className="flex items-center gap-2">
                            {log.quantity > 0 && (
                              <span className="font-mono font-bold text-slate-700 dark:text-zinc-300">
                                Qty: {log.quantity} Pcs
                              </span>
                            )}
                            {isRevertible && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setLogToRevert(log)}
                                className="h-5 px-1.5 text-[9.5px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 gap-1 rounded cursor-pointer"
                                title="Return to previous state and remove this step from history"
                              >
                                <RotateCcw className="size-2.5" />
                                <span>Return to Previous State</span>
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-2">No activity logged yet.</p>
              )}
            </div>
          </div>

          {/* Footer */}
          <DialogFooter className="px-5 py-3 border-t border-slate-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-950 flex flex-row items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsSendToLineOpen(true)}
              className="text-xs rounded-xl h-8 gap-1.5 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50"
            >
              <Shirt className="size-3.5" />
              <span>Send to Line</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs rounded-xl h-8"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send to Line Modal */}
      <SendToLineModal
        open={isSendToLineOpen}
        onOpenChange={setIsSendToLineOpen}
        batch={order}
        productsList={productsList}
        dark={dark}
        onSuccess={(updated) => {
          handleBatchUpdated(updated);
        }}
      />

      {/* Confirmation Dialog: Return to Previous State (Revert Step) */}
      <AlertDialog open={!!logToRevert} onOpenChange={(open) => !open && setLogToRevert(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <RotateCcw className="size-4" />
              <span>Return to Previous State</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600 dark:text-zinc-400 space-y-2">
              <p>
                Are you sure you want to revert this step (<strong>{logToRevert?.notes || logToRevert?.action}</strong>)?
              </p>
              <p>
                This will accurately roll back the recorded quantities, restore the previous stage status, and permanently remove this entry from the manufacturing audit timeline.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isReverting} className="text-xs h-8">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRevert}
              disabled={isReverting}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs h-8 gap-1.5"
            >
              {isReverting ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
              <span>Confirm Revert</span>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default CuttingDetailModal;
