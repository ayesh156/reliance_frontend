import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Checkbox } from '../components/ui/checkbox';
import { Badge } from '../components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { SearchableSelect, type SearchableSelectOption } from '../components/ui/searchable-select';
import { DateRangePicker, type DateRange } from '../components/ui/date-range-picker';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../components/ui/dropdown-menu';
import { DateTimePicker } from '../components/ui/date-time-picker';
import { get, post, put, del } from '../lib/api';
import { getProductImageUrl } from '../lib/utils';
import { toast } from 'react-toastify';
import CuttingModal from '../components/production/CuttingModal';
import CuttingDetailModal, {
  formatSriLankaDateTime,
  resolveStageTransition,
  type StageTransitionInfo,
} from '../components/production/CuttingDetailModal';
import CreateLineBatchModal from '../components/production/CreateLineBatchModal';
import SendToWashModal from '../components/production/SendToWashModal';
import { SendToLineModal } from '../components/production/SendToLineModal';
import CuttingEditModal from '../components/production/CuttingEditModal';
import { BatchStatusBadge } from '../components/production/BatchStatusBadge';
import {
  Factory,
  Plus,
  Search,
  Trash2,
  Eye,
  Loader2,
  X,
  RotateCcw,
  CheckCircle2,
  Layers,
  TrendingUp,
  Package,
  AlertCircle,
  Pencil,
  ArrowRight,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Shirt,
  Scissors,
  SlidersHorizontal,
  Calendar,
  Clock,
  Check,
  Sparkles,
  Info,
  GitBranch,
  MoreVertical,
  Ban,
  Waves,
} from 'lucide-react';

interface ProductImageItem {
  id?: number;
  imageUrl?: string | null;
  isPrimary?: boolean;
  variantId?: number | null;
}

interface ProductItem {
  id: number;
  name: string;
  slug?: string | null;
  images?: ProductImageItem[];
  variants?: Array<{
    id: number;
    size?: string | null;
    color?: string | null;
    sku?: string | null;
    stock: number;
  }>;
}

export interface MaterialCutLog {
  id: number;
  productionOrderId: number;
  rawMaterialId: number;
  quantityCut: number;
  cutDate: string;
  loggedByRole?: string | null;
  rawMaterial?: {
    id: number;
    name: string;
    code: string | null;
    unit: string;
  };
}

export interface GarmentFinishLog {
  id: number;
  productionOrderId: number;
  quantityFinished: number;
  finishDate: string;
  loggedByRole?: string | null;
  isSyncedToStock?: boolean;
  syncedAt?: string | null;
}

export interface TargetProductItem {
  productId: number;
  productName?: string;
  sku?: string;
  barcode?: string;
  plannedQty: number;
}

interface ProductionMaterialUsage {
  id: number;
  productionOrderId: number;
  rawMaterialId: number;
  piecesCount?: number | null;
  issuedQty: number;
  returnedQty: number;
  netConsumedQty: number;
  unitCost: number;
  returnReason?: string | null;
  targetProducts?: TargetProductItem[] | null;
  rawMaterial: {
    id: number;
    name: string;
    code: string | null;
    unit: string;
    currentStock?: number;
  };
}

interface ProductionOrder {
  id: number;
  productionNo: string;
  productId: number;
  variantId?: number | null;
  targetQuantity: number;
  completedQty: number;
  status: string;
  isStockSynced?: boolean;
  stockSyncedAt?: string | null;
  stockSyncedByRole?: string | null;
  reason?: string | null;
  notes?: string | null;
  productionDate: string;
  createdAt: string;
  targetProducts?: TargetProductItem[] | null;
  product: {
    id: number;
    name: string;
    slug?: string | null;
    images?: ProductImageItem[];
  };
  variant?: {
    id: number;
    size?: string | null;
    color?: string | null;
    sku?: string | null;
    stock?: number;
  } | null;
  materialUsages: ProductionMaterialUsage[];
  cutLogs?: MaterialCutLog[];
  finishLogs?: GarmentFinishLog[];
  activityLogs?: BatchActivityLogItem[];
  scrapReturns?: any[];
}

export interface BatchActivityLogItem {
  id: number;
  stage: string;
  action: string;
  notes?: string | null;
  timestamp: string;
  userId?: number | null;
  userName?: string | null;
  quantity: number;
  createdAt: string;
}

interface ProductionSummaryResponse {
  metrics: {
    todayOutput: number;
    todayBatches: number;
    monthOutput: number;
    monthBatches: number;
    filteredBatches: number;
    filteredGarments: number;
    totalYardageConsumed: number;
    totalMaterialsCut?: number;
    totalScrapReturned?: number;
    pendingStockSync?: number;
    syncedToInventory?: number;
    totalCutToday?: number;
    totalCutWeek?: number;
    totalFinishedToday?: number;
    totalFinishedWeek?: number;
    currentWip?: number;
    activeWipBatches?: number;
  };
  materialBreakdown: Array<{
    name: string;
    unit: string;
    totalIssued: number;
    totalReturned: number;
    netConsumed: number;
    totalCost: number;
  }>;
  records: ProductionOrder[];
}

const renderSriLankaDateTime = (dateStr: string | Date | null | undefined) => {
  const formatted = formatSriLankaDateTime(dateStr);
  if (!formatted || formatted === '—') return <span className="text-slate-400">—</span>;
  const firstSpaceIndex = formatted.indexOf(' ');
  if (firstSpaceIndex === -1) return <span>{formatted}</span>;
  const datePart = formatted.substring(0, firstSpaceIndex);
  const timePart = formatted.substring(firstSpaceIndex + 1);
  return (
    <div className="flex flex-col leading-tight whitespace-nowrap">
      <span className="font-semibold text-slate-800 dark:text-zinc-200">{datePart}</span>
      <span className="text-[11px] text-slate-500 dark:text-zinc-400">{timePart}</span>
    </div>
  );
};

interface ParsedProductionProduct {
  productId: number;
  variantId?: number | null;
  productName: string;
  sku?: string;
  variantName?: string | null;
  plannedQty?: number;
  imageUrl?: string | null;
}

const getOrderProducts = (order: ProductionOrder, productsList: ProductItem[] = []): ParsedProductionProduct[] => {
  let raw: any = order.targetProducts;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = null;
    }
  }

  if (Array.isArray(raw) && raw.length > 0) {
    return raw
      .filter((tp: any) => tp && (tp.productId || tp.id))
      .map((tp: any) => {
        const pId = Number(tp.productId || tp.id);
        const fullProduct = productsList.find((p) => p.id === pId);
        const rawImg = tp.imageUrl || fullProduct?.images?.[0]?.imageUrl || (fullProduct as any)?.image;
        const vId = tp.variantId ? Number(tp.variantId) : null;
        const fullVariant = vId ? fullProduct?.variants?.find((v) => v.id === vId) : null;
        const vParts = [fullVariant?.size, fullVariant?.color].filter(Boolean);
        return {
          productId: pId,
          variantId: vId,
          productName: tp.productName || fullProduct?.name || order.product?.name || `Product #${pId}`,
          sku: tp.sku || fullVariant?.sku || fullProduct?.variants?.[0]?.sku || order.variant?.sku || '',
          variantName: vParts.length > 0 ? vParts.join(' / ') : null,
          plannedQty: Number(tp.plannedQty ?? tp.targetQuantity ?? tp.quantity ?? 0),
          imageUrl: rawImg ? getProductImageUrl(rawImg) : null,
        };
      });
  }

  if (order.materialUsages && Array.isArray(order.materialUsages) && order.materialUsages.length > 0) {
    const list: ParsedProductionProduct[] = [];
    order.materialUsages.forEach((u: any) => {
      let uProds: any = u.targetProducts;
      if (typeof uProds === 'string') {
        try { uProds = JSON.parse(uProds); } catch { uProds = null; }
      }
      if (Array.isArray(uProds)) {
        uProds.forEach((tp: any) => {
          if (tp && (tp.productId || tp.id)) {
            const pId = Number(tp.productId || tp.id);
            if (!list.some((existing) => existing.productId === pId)) {
              const fullProduct = productsList.find((p) => p.id === pId);
              const rawImg = tp.imageUrl || fullProduct?.images?.[0]?.imageUrl || (fullProduct as any)?.image;
              const vId = tp.variantId ? Number(tp.variantId) : null;
              const fullVariant = vId ? fullProduct?.variants?.find((v) => v.id === vId) : null;
              const vParts = [fullVariant?.size, fullVariant?.color].filter(Boolean);
              list.push({
                productId: pId,
                variantId: vId,
                productName: tp.productName || fullProduct?.name || `Product #${pId}`,
                sku: tp.sku || fullVariant?.sku || '',
                variantName: vParts.length > 0 ? vParts.join(' / ') : null,
                plannedQty: Number(tp.plannedQty ?? 0),
                imageUrl: rawImg ? getProductImageUrl(rawImg) : null,
              });
            }
          }
        });
      }
    });
    if (list.length > 0) return list;
  }

  // Fallback to primary order product
  const rawImg = order.product?.images?.[0]?.imageUrl || (order.product as any)?.image;
  const vParts = [order.variant?.size, order.variant?.color].filter(Boolean);
  return [
    {
      productId: order.productId,
      variantId: order.variantId || null,
      productName: order.product?.name || `Product #${order.productId}`,
      sku: order.variant?.sku || '',
      variantName: vParts.length > 0 ? vParts.join(' / ') : null,
      plannedQty: Number(order.targetQuantity || order.completedQty || 0),
      imageUrl: rawImg ? getProductImageUrl(rawImg) : null,
    },
  ];
};

/** Production Batch Status Filter Options */
const BATCH_STATUS_OPTIONS: SearchableSelectOption[] = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'CUTTING', label: 'Cutting' },
  { value: 'WASHING', label: 'Washing' },
  { value: 'IN_PROGRESS', label: 'Sewing / WIP' },
  { value: 'FINISHED_PENDING_STOCK', label: 'Awaiting Stock Sync' },
  { value: 'COMPLETED', label: 'Completed & In Stock' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

/** Production Sort Order Options */
const PRODUCTION_SORT_OPTIONS: SearchableSelectOption[] = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'highest_output', label: 'Highest Output' },
  { value: 'most_material', label: 'Most Material Consumed' },
];

/** Production Reason / Batch Type Options */
const PRODUCTION_REASON_OPTIONS: SearchableSelectOption[] = [
  { value: 'Regular Bulk', label: 'Regular Bulk Production' },
  { value: 'Urgent Order', label: 'Urgent Customer Order' },
  { value: 'Sample Collection', label: 'Sample Collection' },
  { value: 'Custom Tailoring', label: 'Custom Tailoring' },
  { value: 'Stock Replenishment', label: 'Stock Replenishment' },
];

/**
 * Formats a Date instance, timestamp string, or epoch number strictly into
 * the standardized `YYYY-MM-DD hh:mm AM/PM` pattern (e.g., `2026-10-20 09:30 AM`).
 * Safely handles invalid inputs and returns '-' as fallback.
 *
 * @param dateInput - Date instance, ISO date string, or epoch number
 * @returns Strict `YYYY-MM-DD hh:mm AM/PM` formatted string
 */
function formatDateTimeAmPm(dateInput?: string | Date | number | null): string {
  if (!dateInput) return '-';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '-';

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // '0' should display as '12'
  const hh = String(hours).padStart(2, '0');

  return `${yyyy}-${mm}-${dd} ${hh}:${minutes} ${ampm}`;
}

/**
 * Resolves the latest manufacturing activity timestamp for a production batch across
 * inventory syncs, garment finishing logs, fabric cutting logs, and batch creation.
 * Returns the timestamp formatted strictly as `YYYY-MM-DD hh:mm AM/PM`.
 *
 * @param order - ProductionOrder record
 * @returns Latest formatted timestamp string
 */
function getBatchLatestTimestamp(order: ProductionOrder): string {
  const timestamps: number[] = [];

  if (order.stockSyncedAt) {
    const t = new Date(order.stockSyncedAt).getTime();
    if (!isNaN(t)) timestamps.push(t);
  }

  if (order.finishLogs && order.finishLogs.length > 0) {
    order.finishLogs.forEach((f) => {
      const t = new Date(f.finishDate || (f as any).createdAt).getTime();
      if (!isNaN(t)) timestamps.push(t);
    });
  }

  if (order.cutLogs && order.cutLogs.length > 0) {
    order.cutLogs.forEach((c) => {
      const t = new Date(c.cutDate || (c as any).createdAt).getTime();
      if (!isNaN(t)) timestamps.push(t);
    });
  }

  if (order.productionDate) {
    const t = new Date(order.productionDate).getTime();
    if (!isNaN(t)) timestamps.push(t);
  }

  if (order.createdAt) {
    const t = new Date(order.createdAt).getTime();
    if (!isNaN(t)) timestamps.push(t);
  }

  if (timestamps.length === 0) return '-';
  const latestTime = Math.max(...timestamps);
  return formatDateTimeAmPm(new Date(latestTime));
}

/**
 * Enhanced History Timeline Component:
 * Chronological activity timeline displaying all 4 manufacturing lifecycle events:
 * 1. Initial/Additional Material Cuts (Amber/Indigo)
 * 2. Leftover Scrap Returned to Warehouse (Teal/Emerald)
 * 3. Garments Finished (Purple)
 * 4. Confirmed & Added to Product Inventory (Emerald)
 * Alongside exact date, time, and user role who logged it.
 */
export const BatchActivityTimeline: React.FC<{
  order: ProductionOrder | any;
  onOrderUpdate?: (updatedOrder: any) => void;
  onRefresh?: () => void;
  onEditBatch?: (order: any) => void;
}> = ({ order, onOrderUpdate, onRefresh, onEditBatch }) => {

  const events = useMemo(() => {
    const list: Array<{
      id: string;
      type: 'cut' | 'scrap' | 'finish' | 'sync' | 'cancel';
      timestamp: Date;
      title: string;
      subtitle: string;
      badgeText: string;
      role: string;
      stageTransition?: StageTransitionInfo;
      cutLogId?: number;
      rawCutLog?: any;
    }> = [];

    // 0. Stage Activity Logs
    (order.activityLogs || []).forEach((act: any) => {
      const dt = new Date(act.timestamp || act.createdAt);
      const transition = resolveStageTransition(act.stage, act.action, act.notes);
      const isCut = act.action === 'INITIAL_CUT' || act.action === 'CUTTING';

      list.push({
        id: `activity-${act.id}`,
        type: act.stage === 'CANCELLED' || act.action === 'BATCH_CANCELLED'
          ? 'cancel'
          : act.action === 'FINALIZED'
          ? 'sync'
          : act.action === 'RETURNED'
          ? 'scrap'
          : act.stage === 'CUTTING'
          ? 'cut'
          : 'finish',
        timestamp: dt,
        stageTransition: transition,
        title: transition.actionDisplay + (act.quantity > 0 && !isCut ? ` (+${act.quantity} Units)` : ''),
        subtitle: act.notes ? act.notes.replace(/_/g, ' ') : `${transition.fromStage} to ${transition.toStage}`,
        badgeText: `${transition.fromStage} → ${transition.toStage}`,
        role: act.userName || 'Production Staff',
      });
    });

    // 1. Initial & Additional Material Cuts (Multi-Cut logging supported)
    (order.cutLogs || []).forEach((c: any) => {
      const dt = new Date(c.cutDate);
      list.push({
        id: `cut-${c.id}`,
        type: 'cut',
        cutLogId: c.id,
        rawCutLog: c,
        timestamp: dt,
        title: `Material Cut: ${c.quantityCut} ${c.rawMaterial?.unit || 'Units'}`,
        subtitle: c.rawMaterial ? `${c.rawMaterial.name} (${c.rawMaterial.code || 'RM'})` : 'Raw Material',
        badgeText: 'Fabric Cutting',
        role: c.loggedByRole || 'Cutting Master',
      });
    });

    // 2. Leftover Scrap Returned to Warehouse
    const scrapList = order.scrapReturns || [];
    if (scrapList.length > 0) {
      scrapList.forEach((s: any, idx: number) => {
        const dt = new Date(s.createdAt);
        const matName = s.rawMaterialItem?.name || 'Raw Material';
        const unit = s.rawMaterialItem?.unit || 'Units';
        list.push({
          id: `scrap-${s.id || idx}`,
          type: 'scrap',
          timestamp: dt,
          title: `Scrap Returned: +${s.quantity} ${unit}`,
          subtitle: `${matName} restored to warehouse inventory • ${s.reference || 'Leftover scrap recovery'}`,
          badgeText: 'Scrap Recovery',
          role: s.role || (s.reference && s.reference.includes('Role: ') ? s.reference.split('Role: ')[1].split(')')[0] : 'Warehouse Manager'),
        });
      });
    } else {
      // Fallback from materialUsages
      (order.materialUsages || [])
        .filter((u: any) => u.returnedQty > 0)
        .forEach((u: any) => {
          list.push({
            id: `usage-ret-${u.id}`,
            type: 'scrap',
            timestamp: new Date(order.productionDate || order.createdAt),
            title: `Scrap Returned: +${u.returnedQty} ${u.rawMaterial?.unit || 'Units'}`,
            subtitle: `${u.rawMaterial?.name || 'Raw Material'} returned • ${u.returnReason || 'Scrap recovery'}`,
            badgeText: 'Scrap Recovery',
            role: 'Warehouse / Cutting',
          });
        });
    }

    // 3. Garments Finished
    (order.finishLogs || []).forEach((f: any) => {
      const dt = new Date(f.finishDate);
      list.push({
        id: `finish-${f.id}`,
        type: 'finish',
        timestamp: dt,
        title: `Garments Finished: +${f.quantityFinished} Pcs`,
        subtitle: f.isSyncedToStock
          ? 'Finished and synced to sellable stock'
          : 'Finished & awaiting stock sync confirmation',
        badgeText: f.isSyncedToStock ? 'Finished & In Stock' : 'Garment Finishing (Pending Sync)',
        role: f.loggedByRole || 'Finishing Supervisor',
      });
    });

    // Legacy fallback if no cut or finish logs but completedQty > 0
    if ((order.finishLogs || []).length === 0 && order.completedQty > 0) {
      list.push({
        id: `init-finish-${order.id}`,
        type: 'finish',
        timestamp: new Date(order.productionDate || order.createdAt),
        title: `Garments Finished: ${order.completedQty} Pcs`,
        subtitle: 'Recorded during initial production setup',
        badgeText: 'Initial Output',
        role: 'STAFF',
      });
    }

    // 4. Confirmed & Added to Product Inventory
    if (order.isStockSynced && order.stockSyncedAt) {
      list.push({
        id: `sync-${order.id}`,
        type: 'sync',
        timestamp: new Date(order.stockSyncedAt),
        title: `Inventory Synced: +${order.completedQty} Pcs Added to Active Stock`,
        subtitle: `Storefront & POS sellable inventory updated for ${order.product?.name || 'Garments'}`,
        badgeText: 'Confirmed In Stock',
        role: order.stockSyncedByRole || 'Inventory Admin',
      });
    }

    // 5. Batch Cancelled fallback
    if (order.status === 'CANCELLED' && !order.activityLogs?.some((a: any) => a.stage === 'CANCELLED' || a.action === 'BATCH_CANCELLED')) {
      list.push({
        id: `cancel-${order.id}`,
        type: 'cancel',
        timestamp: new Date(order.updatedAt || order.productionDate),
        title: `Batch Cancelled: Raw Materials Refunded to Stock`,
        subtitle: order.notes ? `Cancellation recorded (${order.notes})` : 'Batch cancelled and raw material allocations restored to warehouse',
        badgeText: 'Batch Cancelled',
        role: 'Admin',
      });
    }

    // Fallback for active cutting batch without explicit activity log
    if (list.length === 0 && (order.status === 'CUTTING' || (order.materialUsages && order.materialUsages.length > 0))) {
      list.push({
        id: `init-cut-${order.id}`,
        type: 'cut',
        timestamp: new Date(order.productionDate || order.createdAt),
        title: `Initial Cutting Batch Initiated: ${order.targetQuantity || 0} Pcs Planned`,
        subtitle: order.notes || 'Initial raw fabric cutting batch initiated',
        badgeText: 'Initial Cut Initiated',
        role: 'Cutting Master',
      });
    }

    return list.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [order]);

  if (events.length === 0) {
    return (
      <div className="py-4 px-3 rounded-xl bg-slate-50 dark:bg-zinc-900/40 border border-slate-200/60 dark:border-zinc-800 text-center">
        <Clock className="w-5 h-5 mx-auto text-slate-400 mb-1" />
        <p className="text-xs font-semibold text-slate-600 dark:text-zinc-400">No Stage Activity Logs Yet</p>
        <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
          Asynchronous cutting, finishing, scrap returns, or inventory sync events will appear here in chronological order.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="relative pl-6 border-l-2 border-slate-200 dark:border-zinc-800 space-y-3.5 my-2">
        {events.map((ev) => {
          let nodeBg = 'bg-indigo-600 ring-indigo-50 dark:ring-indigo-950/50';
          let badgeStyle = 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
          let IconComponent = Scissors;

          if (ev.type === 'cancel') {
            nodeBg = 'bg-rose-600 ring-rose-50 dark:ring-rose-950/50';
            badgeStyle = 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-800';
            IconComponent = Ban;
          } else if (ev.type === 'scrap') {
            nodeBg = 'bg-teal-600 ring-teal-50 dark:ring-teal-950/50';
            badgeStyle = 'bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300 border-teal-200 dark:border-teal-800';
            IconComponent = RotateCcw;
          } else if (ev.type === 'finish') {
            nodeBg = 'bg-purple-600 ring-purple-50 dark:ring-purple-950/50';
            badgeStyle = 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border-purple-200 dark:border-purple-800';
            IconComponent = Shirt;
          } else if (ev.type === 'sync') {
            nodeBg = 'bg-emerald-600 ring-emerald-50 dark:ring-emerald-950/50';
            badgeStyle = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
            IconComponent = Package;
          }

          return (
            <div key={ev.id} className="relative group">
              {/* Timeline Pulsing Node */}
              <div
                className={`absolute -left-[31px] top-1 size-5 rounded-full border-2 border-white dark:border-zinc-950 flex items-center justify-center text-white shadow-xs ${nodeBg} ring-4`}
              >
                <IconComponent className="w-2.5 h-2.5" />
              </div>

              <div className="bg-white dark:bg-zinc-900/90 p-3 rounded-xl border border-slate-200/80 dark:border-zinc-800 shadow-2xs hover:border-slate-300 dark:hover:border-zinc-700 transition-colors">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    {ev.stageTransition ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border shadow-2xs ${ev.stageTransition.fromStyle}`}>
                          {ev.stageTransition.fromStage}
                        </span>
                        <ArrowRight className="size-3 text-slate-400 shrink-0" />
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border shadow-2xs ${ev.stageTransition.toStyle}`}>
                          {ev.stageTransition.toStage}
                        </span>
                        <span className="text-xs font-bold text-slate-900 dark:text-zinc-100 ml-1">
                          {ev.title}
                        </span>
                      </div>
                    ) : (
                      <>
                        <Badge
                          variant="outline"
                          className={`text-[10px] py-0 px-2 font-semibold ${badgeStyle}`}
                        >
                          {ev.badgeText}
                        </Badge>
                        <span className="text-xs font-bold text-slate-900 dark:text-zinc-100 font-mono">
                          {ev.title}
                        </span>
                      </>
                    )}
                  </div>
                    {/* Edit icon button on each Fabric Cutting card routing to full edit modal */}
                    {ev.type === 'cut' && order.status !== 'CANCELLED' && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onEditBatch) {
                            onEditBatch(order);
                          }
                        }}
                        className="h-6 px-1.5 text-[11px] rounded-md hover:bg-amber-100 dark:hover:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center gap-1 cursor-pointer font-medium"
                        title="Edit fabric cuts in full multi-row batch modal"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>Edit</span>
                      </Button>
                    )}
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
                      <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{formatDateTimeAmPm(ev.timestamp)}</span>
                    </div>
                  </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-zinc-400 mt-2 pt-1.5 border-t border-slate-100 dark:border-zinc-800/60">
                  <div className="space-y-0.5 flex-1 min-w-0">
                    {(() => {
                      const text = ev.subtitle || '';
                      const rawParts = text
                        .split(/(?:•|\n|;|\|)/g)
                        .map((s) => s.trim())
                        .filter(Boolean);

                      const lines = rawParts.length > 0 ? rawParts : [text];

                      return lines.map((line, lIdx) => (
                        <div key={lIdx} className="flex items-start gap-1.5 text-[11px] text-slate-600 dark:text-zinc-300 font-mono">
                          <span className="text-cyan-500 dark:text-cyan-400 mt-0.5 shrink-0">•</span>
                          <span className="break-words">{line}</span>
                        </div>
                      ));
                    })()}
                  </div>
                  <span className="self-start sm:self-center shrink-0 bg-slate-100 dark:bg-zinc-800/80 px-2 py-0.5 rounded text-[10px] font-mono font-medium text-slate-700 dark:text-zinc-300 border border-slate-200/50 dark:border-zinc-700/50">
                    Logged by: <strong>{ev.role}</strong>
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

export const CuttingListPage: React.FC = () => {
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const { user, isAdmin } = useAuth();
  const dark = resolvedTheme === 'dark';

  // Unified Date Range Filter (Defaults to undefined / all-time view)
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  // Search & Context-Specific Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProductFilter, setSelectedProductFilter] = useState<string>('all');
  const [batchStatus, setBatchStatus] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Data states
  const [loading, setLoading] = useState(true);
  const [summaryData, setSummaryData] = useState<ProductionSummaryResponse | null>(null);
  const [productsList, setProductsList] = useState<ProductItem[]>([]);

  // Modals
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [sendToWashBatch, setSendToWashBatch] = useState<ProductionOrder | null>(null);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isGarmentsModalOpen, setIsGarmentsModalOpen] = useState(false);
  const [garmentsSearch, setGarmentsSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<ProductionOrder | null>(null);

  // Send to Line Modal state
  const [sendToLineOrder, setSendToLineOrder] = useState<any | null>(null);
  const [isSendToLineOpen, setIsSendToLineOpen] = useState(false);

  // Delete / Rollback Alert
  const [orderToDelete, setOrderToDelete] = useState<ProductionOrder | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Cancel Batch Alert State
  const [orderToCancel, setOrderToCancel] = useState<ProductionOrder | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [isCancelling, setIsCancelling] = useState(false);

  // Direct Line-First Batch Dispatch Modal State
  const [isCreateLineBatchModalOpen, setIsCreateLineBatchModalOpen] = useState(false);

  // Return leftover scrap modal state
  const [returnFormLines, setReturnFormLines] = useState<
    Array<{
      usageId: number;
      rawMaterialId?: number;
      materialName: string;
      unit: string;
      issuedQty: number;
      totalCutQty: number;
      currentReturnedQty: number;
      maxReturnable: number;
      netConsumed: number;
      additionalReturnQty: number | '';
      returnReason: string;
    }>
  >([]);
  const [isSubmittingReturns, setIsSubmittingReturns] = useState(false);

  // Master Raw Materials List for cutting selection
  const [rawMaterialsList, setRawMaterialsList] = useState<any[]>([]);

  // Stage 1: Unified Start / Edit Production Batch Modal State
  const [editingOrderForCutting, setEditingOrderForCutting] = useState<any | null>(null);
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [isCutBatchModalOpen, setIsCutBatchModalOpen] = useState(false);
  const [isEditBatchModalOpen, setIsEditBatchModalOpen] = useState(false);

  // Stage 3: Dedicated Inventory Stock Sync Confirmation State
  const [orderToSyncStock, setOrderToSyncStock] = useState<ProductionOrder | null>(null);
  const [isSyncingStock, setIsSyncingStock] = useState(false);



  // Expanded mobile card timeline
  const [expandedTimelineBatchId, setExpandedTimelineBatchId] = useState<number | null>(null);

  // Helper to format Date to YYYY-MM-DD
  const formatDateToYMD = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Fetch master products & raw materials
  const fetchProducts = useCallback(async () => {
    try {
      const [prodRes, rmRes] = await Promise.all([
        get<any>('/products'),
        get<any>('/raw-material-items'),
      ]);
      const prods = prodRes?.data || prodRes || [];
      const rms = rmRes?.data || rmRes || [];
      setProductsList(prods);
      setRawMaterialsList(rms);
    } catch (err: any) {
      console.error('Error fetching catalogs:', err);
    }
  }, []);

  // Fetch production summary and records with active filters
  const fetchProductionData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();

      if (dateRange?.from) {
        const fromStr = formatDateToYMD(dateRange.from);
        params.append('startDate', fromStr);
        if (dateRange.to) {
          const toStr = formatDateToYMD(dateRange.to);
          params.append('endDate', toStr);
        } else {
          params.append('endDate', fromStr);
        }
      }

      if (selectedProductFilter && selectedProductFilter !== 'all') {
        params.append('productId', selectedProductFilter);
      }

      const res = await get<any>(`/production/summary?${params.toString()}`);
      const data: ProductionSummaryResponse = res?.data || res;
      setSummaryData(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch production ledger');
    } finally {
      setLoading(false);
    }
  }, [dateRange, selectedProductFilter]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Check for saved cutting draft state on mount (e.g. returning after creating a new product)
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const shouldOpen =
      searchParams.get('openAddCutting') === 'true' ||
      Boolean(sessionStorage.getItem('CUTTING_FORM_DRAFT'));

    if (shouldOpen) {
      // Ensure products and raw materials catalogs are fresh before opening modal
      fetchProducts();
      setEditingOrderForCutting(null);
      setIsCutBatchModalOpen(true);
    }
  }, [fetchProducts]);

  useEffect(() => {
    fetchProductionData();
  }, [fetchProductionData]);

  // Handle Date Range changes from the unified picker
  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDateRange(range);
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedProductFilter('all');
    setBatchStatus('ALL');
    setSortBy('newest');
    // Clear date range filter completely on reset
    setDateRange(undefined);
    setCurrentPage(1);
  };

  // Count active non-default secondary filters for the mobile badge
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedProductFilter !== 'all') count++;
    if (batchStatus !== 'ALL') count++;
    if (dateRange?.from || dateRange?.to) count++;
    if (sortBy !== 'newest') count++;
    return count;
  }, [selectedProductFilter, batchStatus, dateRange, sortBy]);

  // Overall active filter presence indicator for the clear button
  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
    selectedProductFilter !== 'all' ||
    batchStatus !== 'ALL' ||
    dateRange !== undefined ||
    sortBy !== 'newest'
  );

  // Product Combobox Options
  const productFilterOptions: SearchableSelectOption[] = useMemo(() => [
    { value: 'all', label: 'All Products' },
    ...productsList.map((p) => ({
      value: String(p.id),
      label: p.name,
    })),
  ], [productsList]);

  // Target Product Combobox Options for Cut Batch Modal with thumbnail images
  const productSelectOptions: SearchableSelectOption[] = useMemo(() => {
    return productsList.map((p) => {
      const rawImage = p.images?.[0]?.imageUrl;
      const resolvedUrl = rawImage ? getProductImageUrl(rawImage) : null;
      return {
        value: String(p.id),
        label: p.name,
        icon: resolvedUrl ? (
          <img
            src={resolvedUrl}
            alt={p.name}
            className="size-6 rounded-md object-cover border border-slate-200 dark:border-zinc-700 shrink-0"
          />
        ) : (
          <Package className="size-4 text-slate-400 shrink-0" />
        ),
      };
    });
  }, [productsList]);


  // Raw Material Options with live warehouse available stock
  const rawMaterialSelectOptions: SearchableSelectOption[] = useMemo(() => {
    return rawMaterialsList.map((rm) => ({
      value: String(rm.id),
      label: `${rm.name} (${rm.code || 'RM'}) — Stock: ${rm.currentStock ?? 0} ${rm.unit}`,
    }));
  }, [rawMaterialsList]);




  // Client-side search and status filtering and sorting on records
  const filteredRecords = useMemo(() => {
    if (!summaryData?.records) return [];

    let list = summaryData.records;

    // Search query filter (batch #, product, reason, SKU, variant size/color)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (r) =>
          r.productionNo.toLowerCase().includes(q) ||
          r.product.name.toLowerCase().includes(q) ||
          (r.reason && r.reason.toLowerCase().includes(q)) ||
          (r.variant?.sku && r.variant.sku.toLowerCase().includes(q)) ||
          (r.variant?.size && r.variant.size.toLowerCase().includes(q)) ||
          (r.variant?.color && r.variant.color.toLowerCase().includes(q))
      );
    }

    // Batch status filter
    if (batchStatus !== 'ALL') {
      list = list.filter((r) => r.status?.toUpperCase() === batchStatus);
    }

    // Sort order
    const sorted = [...list];
    switch (sortBy) {
      case 'oldest':
        sorted.sort((a, b) => {
          const dateA = new Date(a.createdAt || a.productionDate).getTime();
          const dateB = new Date(b.createdAt || b.productionDate).getTime();
          return dateA - dateB || a.id - b.id;
        });
        break;
      case 'highest_output':
        sorted.sort((a, b) => (b.completedQty || 0) - (a.completedQty || 0) || b.id - a.id);
        break;
      case 'most_material':
        sorted.sort((a, b) => {
          const matA = (a.materialUsages || []).reduce((acc, u) => acc + (u.netConsumedQty || 0), 0);
          const matB = (b.materialUsages || []).reduce((acc, u) => acc + (u.netConsumedQty || 0), 0);
          return matB - matA || b.id - a.id;
        });
        break;
      case 'newest':
      default:
        sorted.sort((a, b) => {
          const dateA = new Date(a.createdAt || a.productionDate).getTime();
          const dateB = new Date(b.createdAt || b.productionDate).getTime();
          return dateB - dateA || b.id - a.id;
        });
        break;
    }

    return sorted;
  }, [summaryData, searchQuery, batchStatus, sortBy]);

  // Product-wise live output breakdown summary for widget & modal
  const productWiseBreakdown = useMemo(() => {
    if (!filteredRecords || filteredRecords.length === 0) return [];

    const map = new Map<number, {
      productId: number;
      productName: string;
      image: string | null;
      totalUnits: number;
      batchCount: number;
      variantsMap: Map<string, { size?: string | null; color?: string | null; sku?: string | null; qty: number }>;
    }>();

    filteredRecords.forEach((r) => {
      const pId = r.product.id;
      const current = map.get(pId) || {
        productId: pId,
        productName: r.product.name,
        image: null,
        totalUnits: 0,
        batchCount: 0,
        variantsMap: new Map(),
      };

      current.totalUnits += r.completedQty || 0;
      current.batchCount += 1;

      // Extract primary or first image
      if (!current.image) {
        const prodMatch = productsList.find((p) => p.id === pId);
        const img = r.product.images?.[0]?.imageUrl || prodMatch?.images?.[0]?.imageUrl;
        if (img) current.image = img;
      }

      if (r.variant) {
        const vKey = `${r.variant.size || ''}-${r.variant.color || ''}-${r.variant.sku || ''}`;
        const vCurr = current.variantsMap.get(vKey) || {
          size: r.variant.size,
          color: r.variant.color,
          sku: r.variant.sku,
          qty: 0,
        };
        vCurr.qty += r.completedQty || 0;
        current.variantsMap.set(vKey, vCurr);
      }

      map.set(pId, current);
    });

    return Array.from(map.values()).map((p) => ({
      ...p,
      variants: Array.from(p.variantsMap.values()),
    })).sort((a, b) => b.totalUnits - a.totalUnits);
  }, [filteredRecords, productsList]);

  // Filtered products list for garments modal search
  const filteredModalProducts = useMemo(() => {
    if (!garmentsSearch.trim()) return productWiseBreakdown;
    const q = garmentsSearch.toLowerCase();
    return productWiseBreakdown.filter((p) => p.productName.toLowerCase().includes(q));
  }, [productWiseBreakdown, garmentsSearch]);

  // Live Recalculated KPI Metrics with WIP & Decoupled Cutting/Finishing Stats
  const liveMetrics = useMemo(() => {
    const totalOutput = filteredRecords.reduce((acc, r) => acc + (r.completedQty || 0), 0);
    const activeBatches = filteredRecords.length;
    const netMaterialConsumed = filteredRecords.reduce((acc, r) => {
      return acc + (r.materialUsages || []).reduce((sub, u) => sub + (u.netConsumedQty || 0), 0);
    }, 0);

    // Filtered materials cut
    const totalCutInFilter = filteredRecords.reduce((acc, r) => {
      return acc + (r.cutLogs || []).reduce((sub, c) => sub + (c.quantityCut || 0), 0);
    }, 0);

    // Filtered finished garments
    const totalFinishedInFilter = filteredRecords.reduce((acc, r) => {
      return acc + (r.finishLogs || []).reduce((sub, f) => sub + (f.quantityFinished || 0), 0);
    }, 0);

    // Compute WIP: Units cut or planned in batches that are not yet finished
    let currentWip = 0;
    filteredRecords.forEach((r) => {
      if (r.status !== 'CANCELLED' && r.status !== 'COMPLETED') {
        const remaining = Math.max(0, r.targetQuantity - (r.completedQty || 0));
        currentWip += remaining;
      }
    });

    return {
      totalOutput,
      activeBatches,
      netMaterialConsumed: Number(netMaterialConsumed.toFixed(2)),
      todayOutput: summaryData?.metrics?.todayOutput ?? 0,
      totalCutToday: summaryData?.metrics?.totalCutToday ?? 0,
      totalCutWeek: summaryData?.metrics?.totalCutWeek ?? totalCutInFilter,
      totalFinishedToday: summaryData?.metrics?.totalFinishedToday ?? summaryData?.metrics?.todayOutput ?? 0,
      totalFinishedWeek: summaryData?.metrics?.totalFinishedWeek ?? totalFinishedInFilter,
      currentWip: summaryData?.metrics?.currentWip ?? currentWip,
      activeWipBatches: summaryData?.metrics?.activeWipBatches ?? 0,
    };
  }, [filteredRecords, summaryData?.metrics]);





  /**
   * Cancel Production Batch Confirmation Handler
   * Safely reverses all raw material deductions and synced finished goods in an atomic transaction.
   */
  const handleConfirmCancelBatch = async () => {
    if (!orderToCancel) return;
    setIsCancelling(true);
    try {
      await put<any>(`/production/${orderToCancel.id}/cancel`, {
        reason: cancelReason?.trim() || 'Operator Cancellation',
      });
      toast.success(`Batch #${orderToCancel.productionNo} cancelled. Consumed raw materials restored to warehouse inventory.`);
      setOrderToCancel(null);
      setCancelReason('');
      fetchProductionData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel production batch');
    } finally {
      setIsCancelling(false);
    }
  };



  // Pagination slice
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage) || 1;
  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  /**
   * Open return modal for specific order with strict uncut leftover calculation:
   * Max returnable leftover is strictly: issuedQty - totalCutQty - returnedQty
   */
  const handleOpenReturnModal = (order: ProductionOrder) => {
    setSelectedOrder(order);
    setReturnFormLines(
      order.materialUsages.map((u) => {
        const totalCutQty = (order.cutLogs || [])
          .filter((c) => c.rawMaterialId === u.rawMaterialId)
          .reduce((sum, c) => sum + Number(c.quantityCut || 0), 0);
        const maxReturnable = Math.max(0, u.issuedQty - totalCutQty - u.returnedQty);

        return {
          usageId: u.id,
          rawMaterialId: u.rawMaterialId,
          materialName: u.rawMaterial.name,
          unit: u.rawMaterial.unit,
          issuedQty: u.issuedQty,
          totalCutQty,
          currentReturnedQty: u.returnedQty,
          maxReturnable,
          netConsumed: u.netConsumedQty,
          additionalReturnQty: '',
          returnReason: '',
        };
      })
    );
    setIsReturnModalOpen(true);
  };

  /**
   * Submit returned materials: restores uncut leftover fabric directly to warehouse inventory
   */
  const handleSubmitReturns = async () => {
    if (!selectedOrder) return;

    for (const line of returnFormLines) {
      const returnNum = Number(line.additionalReturnQty) || 0;
      if (returnNum > line.maxReturnable) {
        toast.error(
          `Return quantity for "${line.materialName}" (${returnNum}) exceeds maximum available uncut leftover (${line.maxReturnable} ${line.unit}).`
        );
        return;
      }
    }

    const validReturns = returnFormLines
      .filter((line) => line.additionalReturnQty !== '' && Number(line.additionalReturnQty) > 0)
      .map((line) => ({
        usageId: line.usageId,
        returnedQty: Number(line.additionalReturnQty),
        isAdditional: true,
        returnReason: line.returnReason,
      }));

    if (validReturns.length === 0) {
      toast.warn('Please enter an additional return quantity for at least one material');
      return;
    }

    setIsSubmittingReturns(true);
    try {
      await put<any>(`/production/${selectedOrder.id}/return-materials`, {
        returns: validReturns,
      });

      toast.success('Leftover materials successfully returned to warehouse stock!');
      setIsReturnModalOpen(false);
      fetchProductionData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record scrap return');
    } finally {
      setIsSubmittingReturns(false);
    }
  };

  // Open Add Cutting modal in create mode
  const handleOpenCreateBatchModal = () => {
    setEditingOrderForCutting(null);
    setSelectedOrder(null);
    setIsCutBatchModalOpen(true);
  };

  // Open Cutting modal in edit mode pre-populated with order data and placeholder fallbacks
  const handleOpenEditCuttingModal = async (order: ProductionOrder) => {
    setEditingOrderForCutting(order);
    setSelectedOrder(order);
    setIsCutBatchModalOpen(true);
    try {
      const res = await get<any>(`/production/${order.id}`);
      const freshOrder = res?.data || res;
      if (freshOrder && freshOrder.id === order.id) {
        setEditingOrderForCutting(freshOrder);
        setSelectedOrder(freshOrder);
      }
    } catch {
      // keep using current order if offline
    }
  };

  const handleOpenEditBatchModal = handleOpenEditCuttingModal;


  /**
   * Stage 3: Confirm & Sync Finished Garments to Product Inventory
   * Dedicated action triggered after user confirmation in AlertDialog.
   */
  const handleConfirmSyncStock = async () => {
    if (!orderToSyncStock) return;
    setIsSyncingStock(true);
    try {
      await post<any>(`/production/${orderToSyncStock.id}/sync-stock`, {});
      toast.success(`Successfully synced ${orderToSyncStock.completedQty} finished garments of ${orderToSyncStock.product.name} to active sellable inventory!`);
      setOrderToSyncStock(null);
      fetchProductionData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to sync finished garments to inventory');
    } finally {
      setIsSyncingStock(false);
    }
  };

  /** Helper to format full Date & Time timestamps on ledger rows */
  const formatFullDateTime = (dateStr: string | Date | undefined | null) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  /** Render standardized multi-stage manufacturing status badges with high-contrast color badges */
  const renderBatchStatusBadge = (status: string, isStockSynced?: boolean) => {
    return <BatchStatusBadge status={status} isStockSynced={isStockSynced} />;
  };

  // Delete / Rollback production order
  const handleConfirmDelete = async () => {
    if (!orderToDelete) return;
    setIsDeleting(true);
    try {
      await del<any>(`/production/${orderToDelete.id}`);
      toast.success(`Batch #${orderToDelete.productionNo} deleted and inventory rolled back.`);
      setOrderToDelete(null);
      fetchProductionData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to rollback production batch');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 w-full pb-12">
      {/* ── Page Header (Matching Products.tsx Header Design) ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Cutting
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Raw Material Allocation, Fabric Cutting Logs &amp; Sewing Line Dispatch
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={fetchProductionData}
            title="Refresh Ledger"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            onClick={handleOpenCreateBatchModal}
            className="gap-2 bg-amber-600 hover:bg-amber-700 text-white shadow-xs cursor-pointer font-semibold"
          >
            <Scissors className="size-4" /> Add Cutting
          </Button>
          <Button
            onClick={() => setIsCreateLineBatchModalOpen(true)}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer font-semibold"
          >
            <Layers className="size-4" /> Send to Line
          </Button>
        </div>
      </div>

      {/* ── KPI Metrics Cards: Fluid 2-column grid on tablet portrait (~534px) instead of vertical stacking ── */}
      <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full">
        {/* Metric 1: Total Materials Cut (Today/Week) */}
        <div className="rounded-2xl border p-4 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between min-h-[125px]">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Total Materials Cut</span>
              <h3 className="text-2xl font-bold text-sky-600 dark:text-sky-400 mt-1 font-mono">
                {liveMetrics.totalCutToday.toLocaleString()} <span className="text-xs font-medium text-slate-500">Today</span>
              </h3>
            </div>
            <div className="p-2.5 bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 rounded-xl shrink-0">
              <Scissors className="size-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-2">
            Week: <strong className="font-mono text-slate-700 dark:text-zinc-300">{liveMetrics.totalCutWeek.toLocaleString()}</strong> Units • Net: {liveMetrics.netMaterialConsumed.toLocaleString()}
          </p>
        </div>

        {/* Metric 2: Total Garments Finished */}
        <div className="rounded-2xl border p-4 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between min-h-[125px]">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Total Garments Finished</span>
              <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                {liveMetrics.totalFinishedToday.toLocaleString()} <span className="text-xs font-medium text-slate-500">Today</span>
              </h3>
            </div>
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl shrink-0">
              <Shirt className="size-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-2">
            Week: <strong className="font-mono text-slate-700 dark:text-zinc-300">{liveMetrics.totalFinishedWeek.toLocaleString()}</strong> Pcs • Total: {liveMetrics.totalOutput.toLocaleString()} Pcs
          </p>
        </div>

        {/* Metric 3: Current WIP (Cut but not finished) */}
        <div className="rounded-2xl border p-4 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between min-h-[125px]">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Current WIP (In Progress)</span>
              <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1 font-mono">
                {liveMetrics.currentWip.toLocaleString()} <span className="text-xs font-medium text-slate-500">Pcs</span>
              </h3>
            </div>
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl shrink-0">
              <Layers className="size-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-2">
            Cut &amp; sewing across {liveMetrics.activeBatches} active batch{liveMetrics.activeBatches === 1 ? '' : 'es'}
          </p>
        </div>

        {/* Metric 4: Completed Garments Product List Summary Widget */}
        <div className="rounded-2xl border p-4 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between min-h-[125px] overflow-hidden">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
                <Shirt className="size-3.5 text-emerald-500" />
                Completed Garments
              </span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded-md border border-emerald-200/50 dark:border-emerald-800/40 shrink-0">
                {liveMetrics.totalOutput.toLocaleString()} Pcs
              </span>
            </div>

            {productWiseBreakdown.length === 0 ? (
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 py-1">No garments produced</p>
            ) : (
              <div className="space-y-1">
                {productWiseBreakdown.slice(0, 3).map((item) => (
                  <div key={item.productId} className="flex items-center justify-between text-[11px] leading-tight">
                    <span className="truncate text-slate-700 dark:text-zinc-300 font-medium pr-1.5" title={item.productName}>
                      • {item.productName}
                    </span>
                    <span className="font-mono font-bold text-slate-900 dark:text-zinc-100 shrink-0">
                      {item.totalUnits.toLocaleString()} Pcs
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {productWiseBreakdown.length > 3 ? (
            <div className="pt-1 mt-1 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsGarmentsModalOpen(true)}
                className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline cursor-pointer flex items-center gap-1"
              >
                <span>+ View all ({productWiseBreakdown.length}) items</span>
              </button>
            </div>
          ) : productWiseBreakdown.length > 0 ? (
            <div className="pt-1 mt-1 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsGarmentsModalOpen(true)}
                className="text-[10px] font-medium text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
              >
                View breakdown &amp; shares →
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Standardized Filter Bar Architecture ── */}

      {/* 1. Mobile & Tablet Collapsible Filter Bar (< 1024px) */}
      <div className="block lg:hidden rounded-2xl border bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 p-3 shadow-xs space-y-3">
        {/* Top Row: Search Input + Filter Toggle Button */}
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 focus-within:border-indigo-500 dark:focus-within:border-indigo-500 transition-colors">
            <Search className="size-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search batch #, product, SKU..."
              className="bg-transparent outline-none w-full text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors"
                title="Clear search"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Collapsible Tray Toggle Button with Badge */}
          <button
            type="button"
            onClick={() => setMobileFiltersOpen((prev) => !prev)}
            className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all shrink-0 cursor-pointer ${
              mobileFiltersOpen || activeFilterCount > 0
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/50 dark:border-indigo-800 dark:text-indigo-300'
                : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800'
            }`}
          >
            <SlidersHorizontal className="size-4" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="flex items-center justify-center size-5 rounded-full bg-indigo-600 text-[10px] font-bold text-white shadow-xs">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Collapsible Filters Drawer */}
        {mobileFiltersOpen && (
          <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 space-y-2.5 animate-in fade-in-50 duration-150">
            {/* Date Range Picker */}
            <div className="w-full">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                Production Date Range
              </label>
              <DateRangePicker
                date={dateRange}
                onDateChange={handleDateRangeChange}
                placeholder="Filter by date range..."
              />
            </div>

            {/* Product Combobox */}
            <div className="w-full">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                Product
              </label>
              <SearchableSelect
                options={productFilterOptions}
                value={selectedProductFilter}
                onValueChange={(val) => {
                  setSelectedProductFilter(val);
                  setCurrentPage(1);
                }}
                placeholder="All Products"
                searchPlaceholder="Search product..."
                dark={dark}
              />
            </div>

            {/* Batch Status */}
            <div className="w-full">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                Batch Status
              </label>
              <SearchableSelect
                options={BATCH_STATUS_OPTIONS}
                value={batchStatus}
                onValueChange={(val) => {
                  setBatchStatus(val);
                  setCurrentPage(1);
                }}
                placeholder="All Statuses"
                searchPlaceholder="Filter status..."
                dark={dark}
              />
            </div>

            {/* Sort Order */}
            <div className="w-full">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                Sort Order
              </label>
              <SearchableSelect
                options={PRODUCTION_SORT_OPTIONS}
                value={sortBy}
                onValueChange={(val) => {
                  setSortBy(val);
                  setCurrentPage(1);
                }}
                placeholder="Sort batches..."
                dark={dark}
              />
            </div>

            {/* Clear All Filters Action */}
            {hasActiveFilters && (
              <div className="pt-1 flex justify-end">
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                >
                  <X className="size-3.5" />
                  <span>Clear All Filters</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Desktop Inline Executive Filter Bar (>= 1024px) */}
      <div className="hidden lg:flex items-center gap-2.5 p-3 rounded-2xl border bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 shadow-xs">
        {/* Search Input (flex-1 expands) */}
        <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 focus-within:border-indigo-500 dark:focus-within:border-indigo-500 transition-colors">
          <Search className="size-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by batch #, product, SKU, variant..."
            className="bg-transparent outline-none w-full text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setCurrentPage(1);
              }}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors"
              title="Clear search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Date Range Picker */}
        <div className="w-56 shrink-0">
          <DateRangePicker
            date={dateRange}
            onDateChange={handleDateRangeChange}
            placeholder="Production date..."
          />
        </div>

        {/* Product Combobox */}
        <div className="w-48 shrink-0">
          <SearchableSelect
            options={productFilterOptions}
            value={selectedProductFilter}
            onValueChange={(val) => {
              setSelectedProductFilter(val);
              setCurrentPage(1);
            }}
            placeholder="All Products"
            searchPlaceholder="Search product..."
            dark={dark}
          />
        </div>

        {/* Batch Status */}
        <div className="w-40 shrink-0">
          <SearchableSelect
            options={BATCH_STATUS_OPTIONS}
            value={batchStatus}
            onValueChange={(val) => {
              setBatchStatus(val);
              setCurrentPage(1);
            }}
            placeholder="All Statuses"
            searchPlaceholder="Filter status..."
            dark={dark}
          />
        </div>

        {/* Sort Order */}
        <div className="w-48 shrink-0">
          <SearchableSelect
            options={PRODUCTION_SORT_OPTIONS}
            value={sortBy}
            onValueChange={(val) => {
              setSortBy(val);
              setCurrentPage(1);
            }}
            placeholder="Sort by..."
            dark={dark}
          />
        </div>

        {/* Clear All Filters Button */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="flex items-center justify-center p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors shrink-0 cursor-pointer"
            title="Clear All Filters"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* ── Production Ledger Table ── */}
      <div className="rounded-2xl border p-5 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-zinc-800">
          <span className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <Factory className="size-4 text-emerald-500" /> Production Ledger ({filteredRecords.length})
          </span>
          <span className="text-xs text-zinc-400">
            Page {currentPage} of {totalPages}
          </span>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-slate-900 dark:text-white" />
            <span className="text-xs font-medium">Loading production ledger...</span>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="size-12 mx-auto rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-400">
              <Scissors className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-zinc-400">
              No production records found for the selected period
            </p>
            <Button
              onClick={handleOpenCreateBatchModal}
              variant="outline"
              size="sm"
              className="text-xs rounded-xl cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Start First Production Run
            </Button>
          </div>
        ) : (
          <>
            {/* ── Production Ledger Table (Desktop Viewport >= 1024px) ── */}
            <div className="hidden lg:block overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xs">
              <Table className="w-full min-w-[940px]">
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-zinc-900/80 border-b border-slate-200/80 dark:border-zinc-800">
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 w-28 min-w-[100px]">
                      Cutting No
                    </TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 w-28">
                      Date &amp; Time
                    </TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                      PRODUCT
                    </TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 w-36">
                      Raw Material Cut
                    </TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 text-center w-24">
                      Status
                    </TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 text-right w-24">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRecords.map((order) => {
                    const prods = getOrderProducts(order, productsList);

                    return (
                      <TableRow
                        key={order.id}
                        className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40 transition-colors border-b border-slate-100 dark:border-zinc-800/80"
                      >
                        {/* 1. Batch No (Clean 2-line break matching LinePage and WashPage) */}
                        <TableCell className="align-middle font-mono text-xs font-bold w-28 min-w-[100px]">
                          <button
                            type="button"
                            onClick={() => handleOpenEditCuttingModal(order)}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700 font-mono text-xs transition-colors cursor-pointer group text-left"
                            title="Edit Cutting"
                          >
                            <div className="leading-tight whitespace-nowrap">
                              {(() => {
                                const clean = (order.productionNo || '').replace(/^#/, '');
                                const dashIdx = clean.indexOf('-');
                                if (dashIdx !== -1) {
                                  return (
                                    <>
                                      <span className="block font-bold">#{clean.substring(0, dashIdx + 1)}</span>
                                      <span className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400">{clean.substring(dashIdx + 1)}</span>
                                    </>
                                  );
                                }
                                return <span className="block font-bold">#{clean}</span>;
                              })()}
                            </div>
                            <Pencil className="w-3 h-3 text-slate-400 group-hover:text-amber-600 transition-colors shrink-0 ml-0.5" />
                          </button>
                        </TableCell>

                        {/* 2. Date & Time (Clean 2-line break) */}
                        <TableCell className="align-middle text-xs font-mono w-28">
                          {renderSriLankaDateTime(order.productionDate || order.createdAt)}
                        </TableCell>

                        {/* 3. PRODUCT (Mirrored thumbnail & variant/qty badges) */}
                        <TableCell className="align-middle">
                          <div className="space-y-2 py-1">
                            {prods.map((p, pIdx) => (
                              <div key={pIdx} className="flex items-center gap-2.5 min-w-0">
                                {p.imageUrl ? (
                                  <img
                                    src={p.imageUrl}
                                    alt={p.productName}
                                    className="size-8 rounded-lg object-cover border border-slate-200 dark:border-zinc-700 shrink-0"
                                    onError={(e) => {
                                      (e.currentTarget as HTMLElement).style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <div className="size-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/50 flex items-center justify-center shrink-0 text-indigo-600 dark:text-indigo-400">
                                    <Shirt className="size-4" />
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate" title={p.productName}>
                                      {p.productName}
                                    </span>
                                    {p.variantName && (
                                      <Badge
                                        variant="outline"
                                        className="font-mono text-[10px] font-bold px-1.5 py-0 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 shrink-0"
                                      >
                                        {p.variantName}
                                      </Badge>
                                    )}
                                    {p.plannedQty !== undefined && p.plannedQty > 0 && (
                                      <Badge
                                        variant="outline"
                                        className="font-mono text-[10px] font-bold px-1.5 py-0 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 shrink-0"
                                      >
                                        Qty: {p.plannedQty} Pcs
                                      </Badge>
                                    )}
                                  </div>
                                  {p.sku && (
                                    <span className="text-[10px] text-slate-400 truncate block font-mono">
                                      SKU: {p.sku}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </TableCell>

                        {/* 4. Raw Material Cut */}
                        <TableCell className="align-middle text-xs w-36">
                          {order.materialUsages && order.materialUsages.length > 0 ? (
                            <div className="space-y-0.5">
                              {order.materialUsages.slice(0, 2).map((usage) => (
                                <div key={usage.id} className="text-slate-700 dark:text-zinc-300 font-mono text-xs truncate max-w-[150px]">
                                  <span className="font-semibold text-slate-900 dark:text-white">{usage.rawMaterial.name}</span>
                                  {' · '}
                                  <span className="font-bold text-amber-700 dark:text-amber-400">{usage.netConsumedQty} {usage.rawMaterial.unit}</span>
                                </div>
                              ))}
                              {order.materialUsages.length > 2 && (
                                <span className="text-[10px] text-slate-400 block font-mono">
                                  +{order.materialUsages.length - 2} more
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 font-mono text-xs">—</span>
                          )}
                        </TableCell>

                        {/* 5. Status Badge */}
                        <TableCell className="align-middle text-center w-24">
                          <BatchStatusBadge status={order.status} isStockSynced={order.isStockSynced} />
                        </TableCell>

                        {/* 6. Actions (3-dots) */}
                        <TableCell className="align-middle text-right w-20">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                aria-label="Cutting Actions"
                                className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-xl">
                              <DropdownMenuItem
                                onClick={() => {
                                  setSendToLineOrder(order);
                                  setIsSendToLineOpen(true);
                                }}
                                className="cursor-pointer gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 focus:text-indigo-600 focus:bg-indigo-50 dark:focus:bg-indigo-950/50"
                              >
                                <ArrowRight className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                <span>Send to Line</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleOpenEditCuttingModal(order)}
                                className="cursor-pointer gap-2 text-xs font-medium"
                              >
                                <Pencil className="w-4 h-4 text-amber-600" />
                                <span>Edit Cutting</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedOrder(order);
                                  setIsDetailModalOpen(true);
                                }}
                                className="cursor-pointer gap-2 text-xs font-medium"
                              >
                                <Eye className="w-4 h-4 text-blue-600" />
                                <span>History</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setOrderToDelete(order)}
                                className="cursor-pointer gap-2 text-xs font-medium text-rose-600 dark:text-rose-400 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/50"
                              >
                                <Trash2 className="w-4 h-4 text-rose-600" />
                                <span>Delete Cutting</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* ── Touch-Friendly Production Batch Cards (Mobile & Tablet Viewports < 1024px) ── */}
            <div className="block lg:hidden space-y-3.5">
              {paginatedRecords.map((order) => {
                const prods = getOrderProducts(order, productsList);

                return (
                  <div
                    key={order.id}
                    className="rounded-2xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 p-4 shadow-xs space-y-3 hover:border-slate-300 dark:hover:border-zinc-700 transition-all"
                  >
                    {/* Header: Batch # & Status */}
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEditCuttingModal(order)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-900 dark:text-white font-mono font-bold text-xs transition-colors cursor-pointer border border-slate-200 dark:border-zinc-700 shadow-2xs"
                        title="Edit Cutting"
                      >
                        <span>#{order.productionNo}</span>
                        <Pencil className="w-3 h-3 text-slate-500" />
                      </button>

                      <BatchStatusBadge status={order.status} isStockSynced={order.isStockSynced} />
                    </div>

                    {/* Date & Time */}
                    <div className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
                      <Clock className="size-3.5 text-slate-400" />
                      <span>{formatSriLankaDateTime(order.productionDate || order.createdAt)}</span>
                    </div>

                    {/* Product (Thumbnails, Name, Variant & Qty Badges) */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">PRODUCT</span>
                      <div className="space-y-2">
                        {prods.map((p, pIdx) => (
                          <div key={pIdx} className="flex items-center gap-2.5 min-w-0">
                            {p.imageUrl ? (
                              <img
                                src={p.imageUrl}
                                alt={p.productName}
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
                              <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                {p.productName}
                              </h4>
                              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                {p.variantName && (
                                  <Badge
                                    variant="outline"
                                    className="font-mono text-[9px] font-bold px-1.5 py-0 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 shrink-0"
                                  >
                                    {p.variantName}
                                  </Badge>
                                )}
                                {p.plannedQty !== undefined && p.plannedQty > 0 && (
                                  <Badge
                                    variant="outline"
                                    className="font-mono text-[9px] font-bold px-1.5 py-0 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 shrink-0"
                                  >
                                    Qty: {p.plannedQty}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Raw Material (Material name, Rolls, Units Qty) */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Raw Material</span>
                      {order.materialUsages && order.materialUsages.length > 0 ? (
                        <div className="space-y-1">
                          {order.materialUsages.map((usage) => (
                            <div key={usage.id} className="text-xs font-mono text-slate-700 dark:text-zinc-300 bg-slate-50 dark:bg-zinc-800/50 p-2 rounded-lg border border-slate-100 dark:border-zinc-800">
                              <span className="font-semibold text-slate-900 dark:text-white">{usage.rawMaterial.name}</span>
                              <span className="text-slate-400 mx-1.5">·</span>
                              <span>{usage.piecesCount || 0} Rolls</span>
                              <span className="text-slate-400 mx-1.5">·</span>
                              <span className="font-bold text-slate-900 dark:text-white">{usage.netConsumedQty} {usage.rawMaterial.unit}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 font-mono text-xs">—</span>
                      )}
                    </div>

                    {/* Action Footer: 3-Dots Menu Only */}
                    <div className="pt-2 border-t border-slate-200/70 dark:border-zinc-800 flex items-center justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2.5 rounded-lg text-xs gap-1 cursor-pointer"
                          >
                            <MoreVertical className="size-3.5" />
                            <span>Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-xl">
                          <DropdownMenuItem
                            onClick={() => {
                              setSendToLineOrder(order);
                              setIsSendToLineOpen(true);
                            }}
                            className="cursor-pointer gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 focus:text-indigo-600 focus:bg-indigo-50 dark:focus:bg-indigo-950/50"
                          >
                            <ArrowRight className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            <span>Send to Line</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleOpenEditCuttingModal(order)}
                            className="cursor-pointer gap-2 text-xs font-medium"
                          >
                            <Pencil className="w-4 h-4 text-amber-600" />
                            <span>Edit Cutting</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedOrder(order);
                              setIsDetailModalOpen(true);
                            }}
                            className="cursor-pointer gap-2 text-xs font-medium"
                          >
                            <Eye className="w-4 h-4 text-blue-600" />
                            <span>History</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setOrderToDelete(order)}
                            className="cursor-pointer gap-2 text-xs font-medium text-rose-600 dark:text-rose-400 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/50"
                          >
                            <Trash2 className="w-4 h-4 text-rose-600" />
                            <span>Delete Cutting</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 mt-2 border-t border-slate-100 dark:border-zinc-800 text-xs">
              <span className="text-zinc-400 text-center sm:text-left">
                Showing {paginatedRecords.length} of {filteredRecords.length} batches
              </span>
              <div className="flex items-center gap-1.5 w-full sm:w-auto justify-between sm:justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  className="h-8 px-2.5 text-xs rounded-xl cursor-pointer"
                >
                  <ChevronLeft className="size-3.5 mr-1" /> Prev
                </Button>
                <span className="px-3 py-1 font-mono font-semibold bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-slate-700 dark:text-zinc-300">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="h-8 px-2.5 text-xs rounded-xl cursor-pointer"
                >
                  Next <ChevronRight className="size-3.5 ml-1" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MODAL 0: COMPLETED GARMENTS DETAILED BREAKDOWN & SHARES
      ───────────────────────────────────────────────────────────── */}
      <Dialog open={isGarmentsModalOpen} onOpenChange={setIsGarmentsModalOpen}>
        <DialogContent className="w-[95vw] max-w-lg sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
          <DialogHeader className="px-4 py-3 sm:px-5 sm:py-3.5 pr-12 sm:pr-14 border-b border-slate-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-950 z-10">
            <div>
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Shirt className="w-4 h-4 text-emerald-500" />
                Completed Garments Summary
              </DialogTitle>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Total <strong className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">{liveMetrics.totalOutput.toLocaleString()} units</strong> produced across {productWiseBreakdown.length} distinct products
              </p>
            </div>
          </DialogHeader>

          {/* Search inside modal if multiple products */}
          {productWiseBreakdown.length > 4 && (
            <div className="px-4 pt-3 pb-0 sm:px-5 sm:pt-3.5 shrink-0">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 w-full text-xs">
                <Search className="size-3.5 text-zinc-400" />
                <input
                  value={garmentsSearch}
                  onChange={(e) => setGarmentsSearch(e.target.value)}
                  placeholder="Filter products..."
                  className="bg-transparent outline-none w-full text-slate-900 dark:text-zinc-100 placeholder:text-zinc-500 text-xs"
                />
                {garmentsSearch && (
                  <button
                    type="button"
                    onClick={() => setGarmentsSearch('')}
                    className="text-zinc-400 hover:text-zinc-200"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Itemized List */}
          <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-2.5">
            {filteredModalProducts.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400 dark:text-zinc-500">
                No products match "{garmentsSearch}"
              </div>
            ) : (
              filteredModalProducts.map((item) => {
                const sharePct = liveMetrics.totalOutput > 0
                  ? ((item.totalUnits / liveMetrics.totalOutput) * 100)
                  : 0;
                const primaryImage = item.image ? getProductImageUrl(item.image) : null;
                const isFiltered = selectedProductFilter === String(item.productId);

                return (
                  <div
                    key={item.productId}
                    className={`p-2.5 sm:p-3 rounded-xl border transition-all ${
                      isFiltered
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30'
                        : 'border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/50 dark:bg-zinc-900/40 hover:bg-slate-100/50 dark:hover:bg-zinc-900/80'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Product Thumbnail */}
                      <div className="size-11 rounded-lg overflow-hidden border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0 flex items-center justify-center">
                        {primaryImage ? (
                          <img
                            src={primaryImage}
                            alt={item.productName}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package className="size-5 text-slate-400 dark:text-zinc-500" />
                        )}
                      </div>

                      {/* Info & Metrics */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-zinc-100 truncate">
                            {item.productName}
                          </h4>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400">
                              {item.totalUnits.toLocaleString()} Pcs
                            </span>
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-mono">
                              {sharePct.toFixed(1)}%
                            </span>
                          </div>
                        </div>

                        {/* Variants preview if available */}
                        {item.variants && item.variants.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {item.variants.map((v, vIdx) => (
                              <span
                                key={vIdx}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 font-mono"
                              >
                                {[v.size && `Size ${v.size}`, v.color, v.sku].filter(Boolean).join(' • ')}: <strong>{v.qty}</strong>
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Progress Bar & Filter Action */}
                        <div className="mt-2 space-y-1">
                          <div className="h-1.5 w-full bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(100, Math.max(2, sharePct))}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-zinc-500">
                            <span>{item.batchCount} batch{item.batchCount === 1 ? '' : 'es'} produced</span>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedProductFilter(isFiltered ? 'all' : String(item.productId));
                                setCurrentPage(1);
                                setIsGarmentsModalOpen(false);
                              }}
                              className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium cursor-pointer"
                            >
                              {isFiltered ? 'Clear filter' : 'Filter table by this product'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter className="px-4 py-3 sm:px-5 sm:py-3.5 border-t border-slate-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-950 z-10 flex-row justify-end">
            <Button
              variant="outline"
              onClick={() => setIsGarmentsModalOpen(false)}
              className="text-xs rounded-xl"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────
          MODAL 1: VIEW FULL MATERIAL BREAKDOWN & TARGET OUTPUT DETAIL
      ───────────────────────────────────────────────────────────── */}
      <CuttingDetailModal
        open={isDetailModalOpen}
        onOpenChange={setIsDetailModalOpen}
        order={selectedOrder}
        rawMaterialsList={rawMaterialsList}
        productsList={productsList}
        onOpenMultiWash={(batch) => {
          setIsDetailModalOpen(false);
          setSendToWashBatch(batch);
        }}
        onOrderUpdate={(updated) => {
          setSelectedOrder(updated);
          fetchProductionData();
        }}
        onRefresh={fetchProductionData}
        dark={dark}
      />

      {/* ─────────────────────────────────────────────────────────────
          MODAL: DIRECT SEND TO WASH (INDEPENDENT FROM DETAIL MODAL)
      ───────────────────────────────────────────────────────────── */}
      <SendToWashModal
        open={Boolean(sendToWashBatch)}
        onOpenChange={(open: boolean) => {
          if (!open) setSendToWashBatch(null);
        }}
        batch={sendToWashBatch}
        productsList={productsList}
        dark={dark}
        onSuccess={() => {
          setSendToWashBatch(null);
          fetchProductionData();
        }}
      />

      {/* ─────────────────────────────────────────────────────────────
          MODAL 2: RETURN LEFTOVER SCRAP MATERIALS
      ───────────────────────────────────────────────────────────── */}
      <Dialog open={isReturnModalOpen} onOpenChange={setIsReturnModalOpen}>
        <DialogContent className="w-[95vw] max-w-lg sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
          <DialogHeader className="px-4 py-3 sm:px-5 sm:py-3.5 pr-12 sm:pr-14 border-b border-slate-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-950 z-10">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <RotateCcw className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">
                  Return Leftover Materials to Inventory
                </DialogTitle>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Batch #{selectedOrder?.productionNo} — Uncut leftover scrap will be restored directly to warehouse stock
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3">
            <div className="space-y-2.5">
              {returnFormLines.map((line, idx) => (
                <div
                  key={line.usageId}
                  className="p-2.5 sm:p-3 bg-slate-50 dark:bg-zinc-900/60 rounded-xl border border-slate-200/80 dark:border-zinc-800 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        {line.materialName}
                      </h4>
                      <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 space-y-0.5">
                        <p>
                          Issued: <span className="font-mono font-medium">{line.issuedQty} {line.unit}</span> · Cut Used: <span className="font-mono font-medium text-amber-600 dark:text-amber-400">{line.totalCutQty} {line.unit}</span> · Previously Returned: <span className="font-mono font-medium text-teal-600 dark:text-teal-400">{line.currentReturnedQty} {line.unit}</span>
                        </p>
                        <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                          Available Leftover to Return: Max <span className="font-mono">{line.maxReturnable} {line.unit}</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1.5 border-t border-slate-200/60 dark:border-zinc-800/60">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                        Additional Returned Qty ({line.unit})
                      </label>
                      <Input
                        type="number"
                        min="0.01"
                        max={line.maxReturnable}
                        step="0.01"
                        value={line.additionalReturnQty}
                        onChange={(e) => {
                          const val = e.target.value;
                          setReturnFormLines((prev) => {
                            const copy = [...prev];
                            copy[idx].additionalReturnQty = val === '' ? '' : Number(val);
                            return copy;
                          });
                        }}
                        placeholder={`Max ${line.maxReturnable} ${line.unit}`}
                        className="h-8 text-xs rounded-lg bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                        Return Reason / Notes
                      </label>
                      <Input
                        type="text"
                        value={line.returnReason}
                        onChange={(e) => {
                          const val = e.target.value;
                          setReturnFormLines((prev) => {
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
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="px-4 py-3 sm:px-5 sm:py-3.5 border-t border-slate-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-950 z-10 flex-row justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsReturnModalOpen(false)}
              className="text-xs rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isSubmittingReturns}
              onClick={handleSubmitReturns}
              className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 font-semibold text-xs rounded-xl shadow-sm flex items-center gap-2 cursor-pointer"
            >
              {isSubmittingReturns ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Restoring Stock...</span>
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4" />
                  <span>Restore Scrap to Inventory</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



      {/* ─────────────────────────────────────────────────────────────
          ALERT DIALOG: ROLLBACK & DELETE CUTTING RECORD (Admin Only)
      ───────────────────────────────────────────────────────────── */}
      {isAdmin && (
        <AlertDialog open={Boolean(orderToDelete)} onOpenChange={() => setOrderToDelete(null)}>
          <AlertDialogContent className="w-full max-w-lg sm:max-w-xl max-h-[90vh] overflow-y-auto bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-500" />
                Delete Cutting Record #{orderToDelete?.productionNo}?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-slate-500 dark:text-zinc-400 space-y-2 pt-2">
                <p>
                  Are you sure you want to delete Cutting Record{' '}
                  <strong className="text-slate-900 dark:text-white font-mono font-bold">
                    #{orderToDelete?.productionNo}
                  </strong>?
                </p>
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-900 dark:text-rose-200 space-y-1.5">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                    <span>Cascading Delete &amp; Inventory Restoration:</span>
                  </div>
                  <p>
                    • Permanently deletes the Cutting record AND removes its associated Line and Wash stage progress/logs.
                  </p>
                  <p>
                    • Restores all allocated raw material yardage and rolls back to Raw Material warehouse stock.
                  </p>
                  {orderToDelete?.isStockSynced && (
                    <p>
                      • Reverses any finished product stock increments (+{orderToDelete.completedQty} units) previously added to sellable stock.
                    </p>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="sticky bottom-0 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm pt-3 border-t border-slate-100 dark:border-zinc-800 gap-2 mt-2">
              <AlertDialogCancel disabled={isDeleting} className="text-xs rounded-xl">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs rounded-xl font-semibold shadow-sm cursor-pointer"
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete & Restore Materials'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: SEND TO LINE MODAL
      ───────────────────────────────────────────────────────────── */}
      <SendToLineModal
        open={isSendToLineOpen}
        onOpenChange={setIsSendToLineOpen}
        batch={sendToLineOrder}
        productsList={productsList}
        dark={dark}
        onSuccess={() => fetchProductionData()}
      />

      {/* ─────────────────────────────────────────────────────────────
          MODAL 4: MULTI-MATERIAL & MULTI-PRODUCT CUTTING (CREATE / EDIT)
      ───────────────────────────────────────────────────────────── */}
      <CuttingModal
        open={isCutBatchModalOpen}
        onOpenChange={(open) => {
          setIsCutBatchModalOpen(open);
          if (!open) {
            setEditingOrderForCutting(null);
          }
        }}
        editingOrder={editingOrderForCutting}
        rawMaterialsList={rawMaterialsList}
        productsList={productsList}
        dark={dark}
        onMaterialAdded={(newMat) => {
          setRawMaterialsList((prev) => [newMat, ...prev]);
        }}
        onSuccess={() => {
          setEditingOrderForCutting(null);
          setEditingOrderId(null);
          setSelectedOrder(null);
          fetchProductionData();
        }}
      />

      {/* ─────────────────────────────────────────────────────────────
          MODAL 5: CUTTING EDIT MODAL FULL HYDRATION SUPPORT
      ───────────────────────────────────────────────────────────── */}
      <CuttingEditModal
        open={isEditBatchModalOpen}
        onOpenChange={setIsEditBatchModalOpen}
        order={selectedOrder}
        rawMaterialsList={rawMaterialsList}
        productsList={productsList}
        dark={dark}
        onSuccess={() => {
          setEditingOrderId(null);
          setSelectedOrder(null);
          fetchProductionData();
        }}
      />

      {/* ─────────────────────────────────────────────────────────────
          ALERT DIALOG 2: CONFIRM & SYNC FINISHED GARMENTS TO INVENTORY (STAGE 3)
      ───────────────────────────────────────────────────────────── */}
      <AlertDialog open={Boolean(orderToSyncStock)} onOpenChange={() => setOrderToSyncStock(null)}>
        <AlertDialogContent className="w-full max-w-lg sm:max-w-xl max-h-[90vh] overflow-y-auto bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-2xl">
          <AlertDialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-200 dark:border-purple-900/50">
                <Package className="w-4 h-4" />
              </div>
              <AlertDialogTitle className="text-base font-bold text-slate-900 dark:text-white">
                Add Finished Garments to Product Inventory?
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-xs text-slate-500 dark:text-zinc-400 space-y-2 pt-2">
              <p>
                Are you sure you want to add{' '}
                <strong className="text-purple-600 dark:text-purple-400 font-mono font-bold text-sm">
                  {orderToSyncStock?.completedQty} finished garments
                </strong>{' '}
                of <strong className="text-slate-900 dark:text-white">{orderToSyncStock?.product.name}</strong>{' '}
                {orderToSyncStock?.variant ? `(${orderToSyncStock.variant.size || ''} ${orderToSyncStock.variant.color || ''})` : ''} to active sellable inventory?
              </p>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 space-y-1.5 text-xs text-slate-700 dark:text-zinc-300">
                <div className="flex items-center justify-between">
                  <span>Batch Production Number:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">#{orderToSyncStock?.productionNo}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Quantity to Add to Stock:</span>
                  <span className="font-mono font-bold text-emerald-600">+{orderToSyncStock?.completedQty} Units</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Updated Status:</span>
                  <span className="font-semibold text-emerald-600">COMPLETED &amp; IN STOCK</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 italic">
                Storefront and POS sellable balances will be updated immediately upon confirmation.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sticky bottom-0 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm pt-3 border-t border-slate-100 dark:border-zinc-800 gap-2 mt-2">
            <AlertDialogCancel disabled={isSyncingStock} className="text-xs rounded-xl">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isSyncingStock}
              onClick={handleConfirmSyncStock}
              className="bg-purple-600 hover:bg-purple-700 text-white text-xs rounded-xl font-semibold shadow-sm cursor-pointer flex items-center gap-1.5"
            >
              {isSyncingStock ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Syncing to Inventory...</span>
                </>
              ) : (
                <>
                  <Package className="w-3.5 h-3.5" />
                  <span>Confirm &amp; Add to Product Stock</span>
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─────────────────────────────────────────────────────────────
          MODAL 5: DIRECT "SEND TO LINE" (LINE-FIRST) BATCH CREATION WORKFLOW
      ───────────────────────────────────────────────────────────── */}
      <CreateLineBatchModal
        open={isCreateLineBatchModalOpen}
        onOpenChange={setIsCreateLineBatchModalOpen}
        productsList={productsList}
        dark={dark}
        onSuccess={() => fetchProductionData()}
      />

      {/* ─────────────────────────────────────────────────────────────
          ALERT DIALOG 3: CANCEL PRODUCTION BATCH
      ───────────────────────────────────────────────────────────── */}
      <AlertDialog open={Boolean(orderToCancel)} onOpenChange={() => setOrderToCancel(null)}>
        <AlertDialogContent className="w-full max-w-lg sm:max-w-xl max-h-[90vh] overflow-y-auto bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-2xl">
          <AlertDialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-200 dark:border-rose-900/50">
                <Ban className="w-4 h-4" />
              </div>
              <AlertDialogTitle className="text-base font-bold text-slate-900 dark:text-white">
                Cancel Production Batch #{orderToCancel?.productionNo}?
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-xs text-slate-500 dark:text-zinc-400 space-y-3 pt-2">
              <p>
                Are you sure you want to cancel Batch{' '}
                <strong className="text-slate-900 dark:text-white font-mono font-bold">
                  #{orderToCancel?.productionNo}
                </strong>{' '}
                ({orderToCancel?.product.name})?
              </p>
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-900 dark:text-amber-200 space-y-1.5">
                <div className="font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Atomic Reversal Details:</span>
                </div>
                <p>
                  • All warehouse raw materials deducted for this batch will be safely restored to warehouse inventory.
                </p>
                {orderToCancel?.isStockSynced && (
                  <p>
                    • Finished goods (+{orderToCancel.completedQty} units) previously added to sellable stock will be reversed.
                  </p>
                )}
                <p>
                  • The batch status will transition to <strong>CANCELLED</strong> while preserving audit logs.
                </p>
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block">
                  Cancellation Reason / Notes <span className="text-slate-400">(Optional)</span>
                </label>
                <Input
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Order cancelled by client, defective fabric, machine downtime"
                  className="h-9 text-xs rounded-xl bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sticky bottom-0 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm pt-3 border-t border-slate-100 dark:border-zinc-800 gap-2 mt-2">
            <AlertDialogCancel disabled={isCancelling} className="text-xs rounded-xl">
              Keep Batch Active
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isCancelling}
              onClick={handleConfirmCancelBatch}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs rounded-xl font-semibold shadow-sm cursor-pointer flex items-center gap-1.5"
            >
              {isCancelling ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Cancelling Batch...</span>
                </>
              ) : (
                <>
                  <Ban className="w-3.5 h-3.5" />
                  <span>Confirm Batch Cancellation</span>
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export const ProductionListPage = CuttingListPage;
export default CuttingListPage;
