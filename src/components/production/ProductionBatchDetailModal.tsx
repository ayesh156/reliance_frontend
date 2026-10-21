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
import { Input } from '../ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../ui/dropdown-menu';
import { getProductImageUrl } from '../../lib/utils';
import { post, put } from '../../lib/api';
import { toast } from 'react-toastify';
import {
  Package,
  Scissors,
  CheckCircle2,
  Shirt,
  Calendar,
  Layers,
  Sparkles,
  Info,
  RotateCcw,
  Ban,
  MoreVertical,
  AlertCircle,
  Loader2,
  Waves,
  ArrowRight,
  Plus,
  Pencil,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BatchStatusBadge } from './BatchStatusBadge';
import { AppendFabricModal } from './AppendFabricModal';
import { DateTimePicker } from '../ui/date-time-picker';

export interface ProductionBatchDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: any | null;
  rawMaterialsList?: any[];
  productsList?: any[];
  onOrderUpdate?: (updatedOrder: any) => void;
  onRefresh?: () => void;
  dark?: boolean;
}

export const ProductionBatchDetailModal: React.FC<ProductionBatchDetailModalProps> = ({
  open,
  onOpenChange,
  order: initialOrder,
  rawMaterialsList = [],
  productsList = [],
  onOrderUpdate,
  onRefresh,
  dark,
}) => {
  const navigate = useNavigate();
  // Local active order state synchronized with initialOrder
  const [currentOrder, setCurrentOrder] = useState<any | null>(initialOrder);

  useEffect(() => {
    setCurrentOrder(initialOrder);
  }, [initialOrder]);

  const order = currentOrder || initialOrder;

  // -------------------------------------------------------------
  // STATE 1: APPEND FABRIC MODAL
  // -------------------------------------------------------------
  const [isAppendFabricOpen, setIsAppendFabricOpen] = useState(false);

  // -------------------------------------------------------------
  // STATE 2: SEND TO WASH MODAL
  // -------------------------------------------------------------
  const [isSendToWashOpen, setIsSendToWashOpen] = useState(false);
  const [sewnQuantity, setSewnQuantity] = useState<number | ''>('');
  const [washDateTime, setWashDateTime] = useState<string>('');
  const [washNotes, setWashNotes] = useState<string>('');
  const [isSubmittingSendToWash, setIsSubmittingSendToWash] = useState(false);

  // -------------------------------------------------------------
  // STATE 3: RETURN UNUSED MATERIAL SCRAP MODAL
  // -------------------------------------------------------------
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnLines, setReturnLines] = useState<
    Array<{
      usageId: number;
      materialId: number;
      materialName: string;
      unit: string;
      issuedQty: number;
      totalCutQty: number;
      previouslyReturnedQty: number;
      maxReturnable: number;
      additionalReturnQty: number | '';
      returnReason: string;
    }>
  >([]);
  const [isSubmittingReturns, setIsSubmittingReturns] = useState(false);

  // -------------------------------------------------------------
  // STATE 4: CANCEL BATCH MODAL
  // -------------------------------------------------------------
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

  // Callback to sync order updates
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
      variantId?: number | null;
      productName: string;
      sku?: string;
      barcode?: string;
      plannedQty: number;
    }> = [];

    let raw = order.targetProducts;
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch {
        raw = null;
      }
    }

    if (Array.isArray(raw) && raw.length > 0) {
      list = raw
        .filter((tp: any) => tp && (tp.productId || tp.id))
        .map((tp: any) => ({
          productId: Number(tp.productId || tp.id),
          variantId: tp.variantId ? Number(tp.variantId) : null,
          productName: tp.productName || `Product #${tp.productId || tp.id}`,
          sku: tp.sku || '',
          barcode: tp.barcode || '',
          plannedQty: Number(tp.plannedQty) || 0,
        }));
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
              list.push({
                productId: Number(tp.productId || tp.id),
                variantId: tp.variantId ? Number(tp.variantId) : null,
                productName: tp.productName || `Product #${tp.productId || tp.id}`,
                sku: tp.sku || '',
                barcode: tp.barcode || '',
                plannedQty: Number(tp.plannedQty) || 0,
              });
            }
          });
        }
      });
    }

    if (list.length === 0 && order.product) {
      list = [
        {
          productId: order.productId,
          variantId: order.variantId || null,
          productName: order.product.name,
          sku: order.variant?.sku || '',
          barcode: order.variant?.barcode || '',
          plannedQty: order.targetQuantity || order.completedQty || 1,
        },
      ];
    }

    return list;
  }, [order]);

  const totalPlannedFromProducts = useMemo(() => {
    return targetProductsList.reduce((sum, p) => sum + (Number(p.plannedQty) || 0), 0);
  }, [targetProductsList]);

  // Open "Send to Wash" Modal
  const handleOpenSendToWash = () => {
    if (!order) return;
    const target = totalPlannedFromProducts || order.targetQuantity || 0;
    const currentCompleted = order.completedQty || 0;
    const defaultQty = currentCompleted > 0 ? currentCompleted : target;
    setSewnQuantity(defaultQty > 0 ? defaultQty : '');
    setWashDateTime(new Date().toISOString().slice(0, 16));
    setWashNotes('');
    setIsSendToWashOpen(true);
  };

  // Submit "Send to Wash"
  const handleSubmitSendToWash = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order?.id) return;
    const qty = Number(sewnQuantity);
    if (!qty || isNaN(qty) || qty <= 0) {
      toast.error('Please enter a valid number of sewn garments produced.');
      return;
    }

    setIsSubmittingSendToWash(true);
    try {
      const res: any = await post(`/production/${order.id}/send-to-wash`, {
        sewnQuantity: qty,
        date: washDateTime ? new Date(washDateTime).toISOString() : new Date().toISOString(),
        notes: washNotes.trim() || undefined,
      });

      toast.success(`Batch #${order.productionNo} successfully transitioned to WASHING (${qty} garments sent)`);
      setIsSendToWashOpen(false);
      const updated = res?.data || res;
      if (updated) {
        handleBatchUpdated(updated);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to send batch to wash');
    } finally {
      setIsSubmittingSendToWash(false);
    }
  };

  // Open Return Leftover Scrap Modal
  const handleOpenReturnMaterials = () => {
    if (!order) return;
    const lines = (order.materialUsages || []).map((u: any) => {
      const totalCut = (order.cutLogs || [])
        .filter((c: any) => c.rawMaterialId === u.rawMaterialId)
        .reduce((sum: number, c: any) => sum + Number(c.quantityCut || 0), 0);
      const previouslyReturned = Number(u.returnedQty || 0);
      const maxReturnable = Math.max(0, Number((u.issuedQty - totalCut - previouslyReturned).toFixed(2)));

      return {
        usageId: u.id,
        materialId: u.rawMaterialId,
        materialName: u.rawMaterial?.name || 'Raw Material',
        unit: u.rawMaterial?.unit || 'Units',
        issuedQty: u.issuedQty,
        totalCutQty: totalCut,
        previouslyReturnedQty: previouslyReturned,
        maxReturnable,
        additionalReturnQty: '' as number | '',
        returnReason: '',
      };
    });

    setReturnLines(lines);
    setIsReturnModalOpen(true);
  };

  // Submit Return Leftover Scrap
  const handleSubmitReturnMaterials = async () => {
    if (!order?.id) return;
    const activeReturns = returnLines
      .filter((l) => typeof l.additionalReturnQty === 'number' && l.additionalReturnQty > 0)
      .map((l) => ({
        usageId: l.usageId,
        returnedQty: Number(l.additionalReturnQty),
        isAdditional: true,
        returnReason: l.returnReason?.trim() || 'Uncut leftover scrap returned to warehouse inventory',
      }));

    if (activeReturns.length === 0) {
      toast.error('Please enter a return quantity for at least one raw material line');
      return;
    }

    setIsSubmittingReturns(true);
    try {
      const res: any = await put(`/api/production/${order.id}/return-materials`, {
        returns: activeReturns,
      });
      toast.success('Unused material returned to stock and ledger updated!');
      setIsReturnModalOpen(false);
      const updatedBatch = res?.data || res;
      if (updatedBatch) {
        handleBatchUpdated(updatedBatch);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to return materials');
    } finally {
      setIsSubmittingReturns(false);
    }
  };

  // Submit Cancel Batch
  const handleConfirmCancelBatch = async () => {
    if (!order?.id) return;
    setIsSubmittingCancel(true);
    try {
      const res: any = await put(`/api/production/${order.id}/cancel`, {
        reason: cancelReason?.trim() || 'Batch cancelled by user',
      });
      toast.success('Production batch cancelled and allocated raw materials refunded to stock!');
      setIsCancelModalOpen(false);
      const updatedBatch = res?.data || res;
      if (updatedBatch) {
        handleBatchUpdated(updatedBatch);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to cancel batch');
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  if (!order) return null;

  const isWashing = order.status === 'WASHING';
  const isCutting = order.status === 'CUTTING';
  const isCompleted = order.status === 'COMPLETED';
  const isCancelled = order.status === 'CANCELLED';

  const totalSentToWash = order.sentToWashQty > 0
    ? order.sentToWashQty
    : (order.targetQuantity > 0 ? order.targetQuantity : order.completedQty);
  const washedSoFar = order.washedQty || 0;
  const remainingInWash = Math.max(0, totalSentToWash - washedSoFar);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[96vw] max-w-3xl lg:max-w-4xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 shadow-2xl">
          {/* Header */}
          <DialogHeader className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-950 z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`size-10 rounded-xl flex items-center justify-center border shadow-xs ${
                  isWashing
                    ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20'
                    : isCompleted
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                }`}>
                  {isWashing ? <Waves className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                </div>
                <div>
                  <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2.5 flex-wrap">
                    <span>Batch #{order.productionNo}</span>
                    <BatchStatusBadge status={order.status} isStockSynced={order.isStockSynced} />
                  </DialogTitle>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    Streamlined Production Batch &amp; Factory Workflow
                  </p>
                </div>
              </div>

              {/* Right Side Header Controls */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300">
                  <Shirt className="size-4 shrink-0 text-slate-500" />
                  <div className="text-right">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Planned Output
                    </div>
                    <div className="text-xs sm:text-sm font-extrabold font-mono leading-none">
                      {totalPlannedFromProducts || order.targetQuantity} Pcs
                    </div>
                  </div>
                </div>

                {!isCancelled && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 cursor-pointer"
                        title="More Actions"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-lg">
                      <DropdownMenuItem
                        onClick={() => setIsAppendFabricOpen(true)}
                        className="cursor-pointer gap-2 text-xs font-medium text-amber-700 dark:text-amber-400"
                      >
                        <Scissors className="w-4 h-4 text-amber-600" />
                        <span>Add Fabric</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={handleOpenReturnMaterials}
                        className="cursor-pointer gap-2 text-xs font-medium text-teal-700 dark:text-teal-400"
                      >
                        <RotateCcw className="w-4 h-4 text-teal-600" />
                        <span>Return Unused Material</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setIsCancelModalOpen(true)}
                        className="cursor-pointer gap-2 text-xs font-medium text-rose-600 dark:text-rose-400"
                      >
                        <Ban className="w-4 h-4 text-rose-600" />
                        <span>Cancel Batch</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          </DialogHeader>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {/* WASHING STAGE PROGRESS BANNER */}
            {isWashing && (
              <div className="p-3.5 bg-gradient-to-r from-cyan-50 via-sky-50 to-blue-50 dark:from-cyan-950/40 dark:via-sky-950/30 dark:to-blue-950/30 rounded-xl border border-cyan-200 dark:border-cyan-800/60 shadow-xs flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-xl bg-cyan-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Waves className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-cyan-950 dark:text-cyan-100 flex items-center gap-2">
                      <span>Currently in Wash Stage</span>
                      <Badge variant="outline" className="text-[10px] bg-white/80 dark:bg-zinc-900 border-cyan-300 dark:border-cyan-700 text-cyan-700 dark:text-cyan-300 font-mono">
                        {remainingInWash} Pcs Remaining to Wash
                      </Badge>
                    </h5>
                    <p className="text-[11px] text-cyan-800/80 dark:text-cyan-300/80 mt-0.5">
                      Sent to wash: <strong>{totalSentToWash}</strong> · Washed &amp; sold: <strong>{washedSoFar}</strong>
                    </p>
                  </div>
                </div>

                <Button
                  size="sm"
                  onClick={() => {
                    onOpenChange(false);
                    navigate('/system/wash');
                  }}
                  className="h-8 text-xs bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-xl flex items-center gap-1.5 shadow-sm shrink-0 cursor-pointer"
                >
                  <Waves className="w-3.5 h-3.5" />
                  <span>Go to Wash Page</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}

            {/* Overview Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-50 dark:bg-zinc-900/60 p-3 rounded-xl border border-slate-200/80 dark:border-zinc-800">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Single Batch Status</span>
                <div className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                  <BatchStatusBadge status={order.status} isStockSynced={order.isStockSynced} />
                </div>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Sewn Output Today</span>
                <p className="text-xs font-bold text-cyan-600 dark:text-cyan-400 font-mono mt-0.5">
                  {order.sentToWashQty || order.completedQty || 0} Units
                </p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Batch Creation Date</span>
                <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                  {new Date(order.productionDate).toLocaleDateString()}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Production Type</span>
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate mt-0.5">
                  {order.reason || 'Standard Factory Order'}
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
                SECTION 1: RAW MATERIAL & FABRIC ALLOCATIONS
            ═════════════════════════════════════════════════════════════════ */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-amber-500" />
                    <span>Fabric &amp; Raw Material Allocations</span>
                  </h4>
                  <Badge variant="outline" className="text-[10px] text-slate-500">
                    {order.materialUsages?.length || 0} Material Line(s)
                  </Badge>
                </div>

                {!isCancelled && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsAppendFabricOpen(true)}
                      className="h-7 text-xs rounded-lg text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/50 flex items-center gap-1.5 font-semibold cursor-pointer shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Fabric</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleOpenReturnMaterials}
                      className="h-7 text-xs rounded-lg text-teal-700 dark:text-teal-400 border-teal-300 dark:border-teal-800 hover:bg-teal-50 dark:hover:bg-teal-950/50 flex items-center gap-1.5 font-semibold cursor-pointer shadow-2xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Return Scrap</span>
                    </Button>
                  </div>
                )}
              </div>

              {/* Table of Raw Materials */}
              <div className="rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-2xs">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-zinc-900">
                      <TableHead className="text-[10px] font-bold uppercase text-slate-600 dark:text-zinc-400">
                        Material Name
                      </TableHead>
                      <TableHead className="text-[10px] font-bold uppercase text-slate-600 dark:text-zinc-400 text-center">
                        Rolls / Pcs
                      </TableHead>
                      <TableHead className="text-[10px] font-bold uppercase text-slate-600 dark:text-zinc-400 text-right">
                        Total Cut / Issued
                      </TableHead>
                      <TableHead className="text-[10px] font-bold uppercase text-slate-600 dark:text-zinc-400 text-right">
                        Returned Scrap
                      </TableHead>
                      <TableHead className="text-[10px] font-bold uppercase text-slate-600 dark:text-zinc-400 text-right">
                        Net Consumed
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
                          {usage.piecesCount || 1}
                        </TableCell>
                        <TableCell className="text-xs text-right text-slate-700 dark:text-zinc-300 font-mono font-medium">
                          {usage.issuedQty} {usage.rawMaterial?.unit}
                        </TableCell>
                        <TableCell className="text-xs text-right text-emerald-600 dark:text-emerald-400 font-semibold font-mono">
                          {usage.returnedQty} {usage.rawMaterial?.unit}
                        </TableCell>
                        <TableCell className="text-xs text-right font-bold text-slate-900 dark:text-white font-mono">
                          {usage.netConsumedQty} {usage.rawMaterial?.unit}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* ═════════════════════════════════════════════════════════════════
                SECTION 2: TARGET FINISHED PRODUCTS (PLANNED OUTPUT)
            ═════════════════════════════════════════════════════════════════ */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Shirt className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Target Finished Garments</span>
                </h4>
                <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400">
                  {targetProductsList.length} Garment Style(s)
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {targetProductsList.map((tp, idx) => {
                  const prodImg =
                    order.product?.id === tp.productId
                      ? order.product.images?.[0]?.imageUrl
                      : null;
                  const resolvedImg = prodImg ? getProductImageUrl(prodImg) : null;

                  return (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50 dark:bg-zinc-900/60 rounded-xl border border-slate-200/80 dark:border-zinc-800 flex items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {resolvedImg ? (
                          <img
                            src={resolvedImg}
                            alt={tp.productName}
                            className="size-10 rounded-lg object-cover border border-slate-200 dark:border-zinc-700 shrink-0"
                          />
                        ) : (
                          <div className="size-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400">
                            <Shirt className="size-5" />
                          </div>
                        )}

                        <div className="min-w-0">
                          <h5 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {tp.productName}
                          </h5>
                          <p className="text-[10px] text-slate-500 dark:text-zinc-400 truncate">
                            {tp.sku ? `SKU: ${tp.sku}` : ''}
                            {tp.barcode ? ` • Barcode: ${tp.barcode}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">
                          Planned
                        </span>
                        <span className="text-xs font-extrabold font-mono text-emerald-700 dark:text-emerald-400">
                          {tp.plannedQty} Pcs
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <DialogFooter className="px-5 py-3.5 border-t border-slate-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-950 z-10 flex-row justify-between items-center gap-2">
            {!isCancelled ? (
              <div className="flex items-center gap-2 flex-wrap">
                {/* Append Fabric Action */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsAppendFabricOpen(true)}
                  className="h-8 text-xs border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-xl flex items-center gap-1.5 cursor-pointer font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Fabric</span>
                </Button>

                {/* Send to Wash Button (End of Day Workflow) */}
                {isCutting && (
                  <Button
                    size="sm"
                    onClick={handleOpenSendToWash}
                    className="h-8 text-xs bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer font-semibold"
                  >
                    <Waves className="w-3.5 h-3.5" />
                    <span>Send to Wash</span>
                  </Button>
                )}

                {/* If already in wash, link to wash page */}
                {isWashing && (
                  <Button
                    size="sm"
                    onClick={() => {
                      onOpenChange(false);
                      navigate('/system/wash');
                    }}
                    className="h-8 text-xs bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer font-semibold"
                  >
                    <Waves className="w-3.5 h-3.5" />
                    <span>Manage in Wash Stage</span>
                    <ArrowRight className="w-3 h-3" />
                  </Button>
                )}

                {isCompleted && (
                  <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Batch Completed &amp; Stock Synced</span>
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-rose-600 font-semibold">
                <Ban className="w-4 h-4" />
                <span>This production batch has been cancelled.</span>
              </div>
            )}

            <Button
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

      {/* ─────────────────────────────────────────────────────────────
          STREAMLINED MODAL 1: APPEND FABRIC MODAL
      ───────────────────────────────────────────────────────────── */}
      <AppendFabricModal
        open={isAppendFabricOpen}
        onOpenChange={setIsAppendFabricOpen}
        order={order}
        rawMaterialsList={rawMaterialsList}
        productsList={productsList}
        dark={dark}
        onSuccess={(updated) => {
          handleBatchUpdated(updated);
        }}
      />

      {/* ─────────────────────────────────────────────────────────────
          STREAMLINED MODAL 2: SEND TO WASH (END-OF-DAY WORKFLOW)
      ───────────────────────────────────────────────────────────── */}
      <Dialog open={isSendToWashOpen} onOpenChange={setIsSendToWashOpen}>
        <DialogContent className="w-[95vw] max-w-md bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 flex items-center justify-center border border-cyan-200 dark:border-cyan-900/50">
                <Waves className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">
                  Send to Wash Stage
                </DialogTitle>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Batch #{order.productionNo} · {order.product?.name}
                </p>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmitSendToWash} className="space-y-3.5 pt-2">
            <div className="p-3 rounded-xl bg-cyan-50/70 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-900/50 text-xs text-cyan-950 dark:text-cyan-200 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold">
                <Waves className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                <span>End-of-Day Factory Handover:</span>
              </div>
              <p>
                Enter the actual count of completed sewn garments ready for the washing plant today. This will transition the batch status to <strong>WASHING</strong>.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block">
                Actual Sewn Garments Produced Today <span className="text-rose-500">*</span>
              </label>
              <Input
                type="number"
                min="1"
                step="1"
                required
                value={sewnQuantity}
                onChange={(e) => setSewnQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder={`Planned target: ${totalPlannedFromProducts || order.targetQuantity} pcs`}
                className="h-9 text-xs rounded-xl bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 font-mono font-bold text-cyan-700 dark:text-cyan-300"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block">
                Handover Date &amp; Time
              </label>
              <DateTimePicker
                value={washDateTime}
                onChange={setWashDateTime}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block">
                Handover Remarks / Notes <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <Input
                type="text"
                value={washNotes}
                onChange={(e) => setWashNotes(e.target.value)}
                placeholder="e.g. Sent 50 pcs to industrial washing plant"
                className="h-9 text-xs rounded-xl bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800"
              />
            </div>

            <DialogFooter className="gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800 flex-row justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsSendToWashOpen(false)}
                className="text-xs rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmittingSendToWash || !sewnQuantity}
                className="bg-cyan-600 hover:bg-cyan-700 text-white text-xs rounded-xl font-semibold shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                {isSubmittingSendToWash ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Transitioning Status...</span>
                  </>
                ) : (
                  <>
                    <Waves className="w-3.5 h-3.5" />
                    <span>Confirm &amp; Send to Wash</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────
          STREAMLINED MODAL 3: RETURN UNUSED MATERIAL SCRAP
      ───────────────────────────────────────────────────────────── */}
      <Dialog open={isReturnModalOpen} onOpenChange={setIsReturnModalOpen}>
        <DialogContent className="w-[95vw] max-w-lg sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 shadow-2xl">
          <DialogHeader className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-950 z-10">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 flex items-center justify-center border border-teal-200 dark:border-teal-900/50">
                <RotateCcw className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">
                  Return Unused Material to Inventory
                </DialogTitle>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Batch #{order.productionNo} — Restores uncut fabric back into warehouse stock
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {returnLines.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">
                No raw material lines found in this production batch.
              </div>
            ) : (
              returnLines.map((line, idx) => (
                <div
                  key={line.usageId}
                  className="p-3 bg-slate-50 dark:bg-zinc-900/60 rounded-xl border border-slate-200/80 dark:border-zinc-800 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        {line.materialName}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                        Issued: <span className="font-mono font-medium">{line.issuedQty} {line.unit}</span> · Previously Returned: <span className="font-mono font-medium text-teal-600">{line.previouslyReturnedQty} {line.unit}</span>
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-mono text-emerald-700 dark:text-emerald-300">
                      Max Returnable: {line.maxReturnable} {line.unit}
                    </Badge>
                  </div>

                  {line.maxReturnable > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-200/60 dark:border-zinc-800/60">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider block">
                          Quantity to Return ({line.unit})
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={line.maxReturnable}
                          value={line.additionalReturnQty}
                          onChange={(e) => {
                            const val = e.target.value;
                            setReturnLines((prev) => {
                              const copy = [...prev];
                              copy[idx].additionalReturnQty = val === '' ? '' : Number(val);
                              return copy;
                            });
                          }}
                          placeholder={`Max ${line.maxReturnable} ${line.unit}`}
                          className="h-8 text-xs rounded-lg bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider block">
                          Return Scrap Reason / Note
                        </label>
                        <Input
                          type="text"
                          value={line.returnReason}
                          onChange={(e) => {
                            const val = e.target.value;
                            setReturnLines((prev) => {
                              const copy = [...prev];
                              copy[idx].returnReason = val;
                              return copy;
                            });
                          }}
                          placeholder="e.g. Uncut end roll saved"
                          className="h-8 text-xs rounded-lg bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800"
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 dark:text-zinc-500 italic pt-1 border-t border-slate-100 dark:border-zinc-800">
                      All issued material for this line has been fully used or returned.
                    </p>
                  )}
                </div>
              ))
            )}
          </div>

          <DialogFooter className="px-5 py-3.5 border-t border-slate-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-950 z-10 flex-row justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsReturnModalOpen(false)}
              className="text-xs rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isSubmittingReturns}
              onClick={handleSubmitReturnMaterials}
              className="bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              {isSubmittingReturns ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Restoring Stock...</span>
                </>
              ) : (
                <>
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore Scrap to Inventory</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────
          STREAMLINED MODAL 4: CANCEL BATCH CONFIRMATION
      ───────────────────────────────────────────────────────────── */}
      <Dialog open={isCancelModalOpen} onOpenChange={setIsCancelModalOpen}>
        <DialogContent className="w-[95vw] max-w-lg bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-200 dark:border-rose-900/50">
                <Ban className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">
                  Cancel Production Batch #{order.productionNo}?
                </DialogTitle>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  {order.product?.name} · Target: {order.targetQuantity} units
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-900 dark:text-amber-200 space-y-1.5">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                <span>Automatic Stock Reversal:</span>
              </div>
              <p>
                • All raw materials consumed or allocated to Batch #{order.productionNo} will be refunded directly into warehouse stock.
              </p>
              <p>
                • Batch status changes to <strong>CANCELLED</strong> while preserving audit history.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block">
                Cancellation Reason / Notes <span className="text-slate-400">(Optional)</span>
              </label>
              <Input
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Fabric defect, client order revision, machine failure"
                className="h-9 text-xs rounded-xl bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800"
              />
            </div>

            <DialogFooter className="gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800 flex-row justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCancelModalOpen(false)}
                className="text-xs rounded-xl"
              >
                Keep Batch Active
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isSubmittingCancel}
                onClick={handleConfirmCancelBatch}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs rounded-xl font-semibold shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                {isSubmittingCancel ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Cancelling Batch...</span>
                  </>
                ) : (
                  <>
                    <Ban className="w-3.5 h-3.5" />
                    <span>Confirm Cancellation</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ProductionBatchDetailModal;
