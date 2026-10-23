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
} from 'lucide-react';
import { BatchStatusBadge } from './BatchStatusBadge';
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
      label: 'Sent to Sewing Line',
      actionDisplay: 'Dispatched to Line Floor',
    };
  }

  // 2. Send to Wash from Line
  if (act.includes('SEND_TO_WASH') || (stg === 'WASHING' && act.includes('WASH') && !act.includes('LOG_WASHED'))) {
    return {
      fromStage: 'Sewing Line',
      toStage: 'Wash Stage',
      fromStyle: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800',
      toStyle: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800',
      label: 'Sent to Wash Floor',
      actionDisplay: 'Dispatched to Washing',
    };
  }

  // 3. Wash to Stock / Washed Logged / Finished
  if (act.includes('LOG_WASHED') || act.includes('WASHED') || act.includes('FINALIZED') || act.includes('FINISH_BATCH')) {
    return {
      fromStage: 'Wash Stage',
      toStage: 'Product Stock',
      fromStyle: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800',
      toStyle: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
      label: 'Added to Inventory Stock',
      actionDisplay: 'Synced to Finished Stock',
    };
  }

  // 4. Initial Cut
  if (act.includes('INITIAL_CUT') || act.includes('CUTTING') || act.includes('BATCH_CREATED')) {
    return {
      fromStage: 'Raw Fabric',
      toStage: 'Cutting Floor',
      fromStyle: 'bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-200 border-slate-300 dark:border-zinc-700',
      toStyle: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800',
      label: 'Fabric Cut Initiated',
      actionDisplay: 'Initial Cutting Completed',
    };
  }

  // 5. Cut Edit
  if (act.includes('EDIT_CUT') || act.includes('CUT_ADJUSTED')) {
    return {
      fromStage: 'Cutting Floor',
      toStage: 'Cut Adjusted',
      fromStyle: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800',
      toStyle: 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border-orange-300 dark:border-orange-800',
      label: 'Cutting Log Adjusted',
      actionDisplay: 'Quantity Adjusted',
    };
  }

  // 6. Returned Scrap
  if (act.includes('RETURN') || act.includes('SCRAP')) {
    return {
      fromStage: 'Cutting Floor',
      toStage: 'Warehouse Stock',
      fromStyle: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800',
      toStyle: 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border-teal-300 dark:border-teal-800',
      label: 'Scrap Returned to Warehouse',
      actionDisplay: 'Warehouse Stock Restored',
    };
  }

  // 7. Cancelled
  if (act.includes('CANCEL') || stg.includes('CANCEL')) {
    return {
      fromStage: 'Production',
      toStage: 'Cancelled',
      fromStyle: 'bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-200 border-slate-300 dark:border-zinc-700',
      toStyle: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800',
      label: 'Batch Cancelled & Refunded',
      actionDisplay: 'Materials Restored to Stock',
    };
  }

  // Default fallback (clean up underscores)
  const cleanStage = (stage || 'Production').replace(/_/g, ' ').trim();
  const cleanAction = (action || 'Processed').replace(/_/g, ' ').trim();
  return {
    fromStage: cleanStage,
    toStage: cleanAction,
    fromStyle: 'bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-200 border-slate-300 dark:border-zinc-700',
    toStyle: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800',
    label: `${cleanStage} to ${cleanAction}`,
    actionDisplay: cleanAction,
  };
}

export interface ProductionBatchDetailModalProps {
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

/**
 * Format timestamp in Sri Lanka time (Asia/Colombo) YYYY-MM-DD hh:mm:ss AM/PM (12-hour format)
 */
export const formatSriLankaDateTime = (dateStr: string | Date | null | undefined): string => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
    const parts = formatter.formatToParts(d);
    const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '';
    const year = getPart('year');
    const month = getPart('month');
    const day = getPart('day');
    const hour = getPart('hour');
    const minute = getPart('minute');
    const second = getPart('second');
    const dayPeriod = (getPart('dayPeriod') || '').toUpperCase();
    return `${year}-${month}-${day} ${hour}:${minute}:${second} ${dayPeriod}`.trim();
  } catch {
    return String(dateStr);
  }
};

export const ProductionBatchDetailModal: React.FC<ProductionBatchDetailModalProps> = ({
  open,
  onOpenChange,
  order: initialOrder,
  productsList = [],
  onOrderUpdate,
  onRefresh,
  dark,
}) => {
  const [currentOrder, setCurrentOrder] = useState<any | null>(initialOrder);
  const [isSendToLineOpen, setIsSendToLineOpen] = useState<boolean>(false);

  useEffect(() => {
    setCurrentOrder(initialOrder);
  }, [initialOrder]);

  const order = currentOrder || initialOrder;

  const handleBatchUpdated = (newOrder: any) => {
    setCurrentOrder(newOrder);
    if (onOrderUpdate) onOrderUpdate(newOrder);
    if (onRefresh) onRefresh();
  };

  // Parse target finished products from order
  const targetProductsList = useMemo(() => {
    if (!order) return [];
    let list: Array<{
      productId: number;
      productName: string;
      sku?: string;
      barcode?: string;
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
        <DialogContent className="w-[96vw] max-w-3xl lg:max-w-4xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 shadow-2xl">
          {/* Streamlined Header */}
          <DialogHeader className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-950 z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20 shadow-xs">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2.5 flex-wrap">
                    <span>Batch #{order.productionNo}</span>
                    <BatchStatusBadge status={order.status} isStockSynced={order.isStockSynced} />
                  </DialogTitle>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    Batch History &amp; Manufacturing Audit Trail
                  </p>
                </div>
              </div>

              {/* Exact Date & Time Timestamp in Header */}
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Date &amp; Time
                </span>
                <span className="text-xs font-mono font-bold text-slate-800 dark:text-zinc-200">
                  {formatSriLankaDateTime(order.productionDate || order.createdAt)}
                </span>
              </div>
            </div>
          </DialogHeader>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {/* Overview Metric Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-50 dark:bg-zinc-900/60 p-3 rounded-xl border border-slate-200/80 dark:border-zinc-800">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Batch Status</span>
                <div className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                  <BatchStatusBadge status={order.status} isStockSynced={order.isStockSynced} />
                </div>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Line Dispatched</span>
                <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 font-mono mt-0.5">
                  {order.lineSentQty || 0} Units
                </p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Wash Intake</span>
                <p className="text-xs font-bold text-cyan-600 dark:text-cyan-400 font-mono mt-0.5">
                  {order.sentToWashQty || 0} Units
                </p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Completed / Finished</span>
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                  {order.completedQty || 0} Pcs
                </p>
              </div>
            </div>

            {order.notes && (
              <div className="p-3 bg-slate-50/70 dark:bg-zinc-900/50 rounded-xl text-xs text-slate-600 dark:text-zinc-400 border border-slate-200/60 dark:border-zinc-800/60 flex items-start gap-2">
                <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900 dark:text-white block mb-0.5">Batch Notes:</strong>
                  <span>{order.notes}</span>
                </div>
              </div>
            )}

            {/* ═════════════════════════════════════════════════════════════════
                SECTION 1: CUTTING DETAILS (RAW MATERIAL ALLOCATIONS)
            ═════════════════════════════════════════════════════════════════ */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-amber-500" />
                  <span>Cutting Details</span>
                </h4>
                <Badge variant="outline" className="text-[10px] text-slate-500">
                  {order.materialUsages?.length || 0} Material Line(s)
                </Badge>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-2xs">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-zinc-900">
                      <TableHead className="text-[10px] font-bold uppercase text-slate-600 dark:text-zinc-400">
                        Material
                      </TableHead>
                      <TableHead className="text-[10px] font-bold uppercase text-slate-600 dark:text-zinc-400 text-center">
                        Rolls
                      </TableHead>
                      <TableHead className="text-[10px] font-bold uppercase text-slate-600 dark:text-zinc-400 text-right">
                        Units Qty Cut
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(order.materialUsages || []).map((usage: any) => (
                      <TableRow key={usage.id}>
                        <TableCell className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                          {usage.rawMaterial?.name || 'Raw Material'}
                          {usage.rawMaterial?.code && (
                            <span className="text-[10px] text-slate-400 font-mono block">
                              {usage.rawMaterial.code}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-center font-mono text-slate-600 dark:text-zinc-400">
                          {usage.piecesCount || 1} {usage.piecesCount === 1 ? 'Roll' : 'Rolls'}
                        </TableCell>
                        <TableCell className="text-xs text-right font-bold text-slate-900 dark:text-white font-mono">
                          {usage.netConsumedQty ?? usage.issuedQty} {usage.rawMaterial?.unit || 'Units'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* ═════════════════════════════════════════════════════════════════
                SECTION 2: TARGET PRODUCTS
            ═════════════════════════════════════════════════════════════════ */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Shirt className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Target Products</span>
                </h4>
                <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400">
                  {targetProductsList.length} Garment Style(s)
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {targetProductsList.map((tp, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-50 dark:bg-zinc-900/60 rounded-xl border border-slate-200/80 dark:border-zinc-800 flex items-center gap-3 shadow-2xs"
                  >
                    {tp.imageUrl ? (
                      <img
                        src={tp.imageUrl}
                        alt={tp.productName}
                        className="size-10 rounded-lg object-cover border border-slate-200 dark:border-zinc-700 shrink-0"
                      />
                    ) : (
                      <div className="size-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400">
                        <Shirt className="size-5" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <h5 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {tp.productName}
                      </h5>
                      {tp.sku && (
                        <p className="text-[10px] text-slate-400 font-mono truncate">
                          SKU: {tp.sku}
                        </p>
                      )}
                      <div className="flex items-center gap-1.5 mt-1">
                        {(tp.sentToLineQty || 0) > 0 ? (
                          <Badge
                            variant="outline"
                            className="text-[9px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 py-0 px-1.5"
                          >
                            Line Sent: {tp.sentToLineQty}
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium">
                            Ready for Line
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ═════════════════════════════════════════════════════════════════
                SECTION 3: FACTORY WORKFLOW AUDIT LOG / TIMELINE
            ═════════════════════════════════════════════════════════════════ */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Workflow History &amp; Dispatch Timeline</span>
                </h4>
                <span className="text-[10px] text-slate-400 font-mono">
                  {(order.activityLogs?.length || 0)} event(s)
                </span>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-zinc-800 p-3 bg-slate-50/50 dark:bg-zinc-900/40 space-y-2">
                {!order.activityLogs || order.activityLogs.length === 0 ? (
                  <div className="text-xs text-slate-500 py-2 text-center">
                    Initial cutting recorded on {formatSriLankaDateTime(order.productionDate || order.createdAt)}.
                  </div>
                ) : (
                  order.activityLogs.map((log: any, lIdx: number) => {
                    const isCutEvent = log.action === 'INITIAL_CUT' || log.action === 'CUTTING';
                    const displayNotes = log.notes
                      ? (isCutEvent
                          ? log.notes
                              .replace(/for target output:\s*/gi, 'for target products: ')
                              .replace(/(\d+)\s*Pcs\s+/gi, '')
                          : log.notes)
                      : '';

                    const transition = resolveStageTransition(log.stage, log.action, log.notes);

                    return (
                      <div
                        key={log.id || lIdx}
                        className="flex items-start justify-between gap-3 text-xs p-2.5 rounded-lg bg-white dark:bg-zinc-950 border border-slate-200/70 dark:border-zinc-800 shadow-2xs hover:border-slate-300 dark:hover:border-zinc-700 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border shadow-2xs ${transition.fromStyle}`}>
                              {transition.fromStage}
                            </span>
                            <ArrowRight className="size-3 text-slate-400 shrink-0" />
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border shadow-2xs ${transition.toStyle}`}>
                              {transition.toStage}
                            </span>
                            <span className="font-semibold text-slate-800 dark:text-zinc-200 ml-1 text-xs">
                              {transition.actionDisplay}
                            </span>
                            {log.quantity > 0 && !isCutEvent && (
                              <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold text-[11px] ml-0.5">
                                (+{log.quantity} Units)
                              </span>
                            )}
                          </div>
                          {displayNotes && (
                            <p className="text-[11px] text-slate-500 dark:text-zinc-400 pl-0.5">
                              {displayNotes}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-mono text-[10px] text-slate-500 dark:text-zinc-400 block">
                            {formatSriLankaDateTime(log.timestamp || log.createdAt)}
                          </span>
                          {log.userName && (
                            <span className="text-[10px] text-slate-400">
                              By: {log.userName}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Streamlined Footer */}
          <DialogFooter className="px-5 py-3.5 border-t border-slate-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-950 z-10 flex-row justify-between items-center gap-2">
            <div className="text-xs font-semibold text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Standard Factory Workflow: Fabric &rarr; Cutting &rarr; Line &rarr; Wash &rarr; Stock</span>
            </div>

            <div className="flex items-center gap-2">
              {/* Primary "Send to Line" button directly to the left of the "Close" button */}
              <Button
                type="button"
                onClick={() => setIsSendToLineOpen(true)}
                className="h-8 px-3.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Shirt className="w-3.5 h-3.5" />
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
            </div>
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
    </>
  );
};

export default ProductionBatchDetailModal;
