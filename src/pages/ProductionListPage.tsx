import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
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

interface ProductionMaterialUsage {
  id: number;
  productionOrderId: number;
  rawMaterialId: number;
  issuedQty: number;
  returnedQty: number;
  netConsumedQty: number;
  unitCost: number;
  returnReason?: string | null;
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
  scrapReturns?: any[];
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

/** Production Batch Status Filter Options */
const BATCH_STATUS_OPTIONS: SearchableSelectOption[] = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'CUTTING', label: 'Cutting' },
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
 * Enhanced History Timeline Component:
 * Chronological activity timeline displaying all 4 manufacturing lifecycle events:
 * 1. Initial/Additional Material Cuts (Amber/Indigo)
 * 2. Leftover Scrap Returned to Warehouse (Teal/Emerald)
 * 3. Garments Finished (Purple)
 * 4. Confirmed & Added to Product Inventory (Emerald)
 * Alongside exact date, time, and user role who logged it.
 */
export const BatchActivityTimeline: React.FC<{ order: ProductionOrder }> = ({ order }) => {
  const events = useMemo(() => {
    const list: Array<{
      id: string;
      type: 'cut' | 'scrap' | 'finish' | 'sync';
      timestamp: Date;
      title: string;
      subtitle: string;
      badgeText: string;
      role: string;
    }> = [];

    // 1. Initial & Additional Material Cuts
    (order.cutLogs || []).forEach((c) => {
      const dt = new Date(c.cutDate);
      list.push({
        id: `cut-${c.id}`,
        type: 'cut',
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
        .filter((u) => u.returnedQty > 0)
        .forEach((u) => {
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
    (order.finishLogs || []).forEach((f) => {
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
        subtitle: `Storefront & POS sellable inventory updated for ${order.product.name}`,
        badgeText: 'Confirmed In Stock',
        role: order.stockSyncedByRole || 'Inventory Admin',
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
    <div className="relative pl-6 border-l-2 border-slate-200 dark:border-zinc-800 space-y-3.5 my-2">
      {events.map((ev) => {
        let nodeBg = 'bg-indigo-600 ring-indigo-50 dark:ring-indigo-950/50';
        let badgeStyle = 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
        let IconComponent = Scissors;

        if (ev.type === 'scrap') {
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
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`text-[10px] py-0 px-2 font-semibold ${badgeStyle}`}
                  >
                    {ev.badgeText}
                  </Badge>
                  <span className="text-xs font-bold text-slate-900 dark:text-zinc-100 font-mono">
                    {ev.title}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Calendar className="w-3 h-3" />
                  <span>
                    {ev.timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at{' '}
                    {ev.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400 mt-2 pt-1.5 border-t border-slate-100 dark:border-zinc-800/60">
                <span>{ev.subtitle}</span>
                <span className="bg-slate-100 dark:bg-zinc-800/80 px-2 py-0.5 rounded text-[10px] font-mono font-medium text-slate-700 dark:text-zinc-300 border border-slate-200/50 dark:border-zinc-700/50">
                  Logged by: <strong>{ev.role}</strong>
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const ProductionListPage: React.FC = () => {
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
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isGarmentsModalOpen, setIsGarmentsModalOpen] = useState(false);
  const [garmentsSearch, setGarmentsSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<ProductionOrder | null>(null);

  // Delete / Rollback Alert
  const [orderToDelete, setOrderToDelete] = useState<ProductionOrder | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [isCutBatchModalOpen, setIsCutBatchModalOpen] = useState(false);
  const [cutBatchProductId, setCutBatchProductId] = useState<string>('');
  const [cutBatchVariantId, setCutBatchVariantId] = useState<string>('');
  const [cutBatchTargetQty, setCutBatchTargetQty] = useState<number | ''>('');
  const [cutBatchDateTime, setCutBatchDateTime] = useState<string>('');
  const [cutBatchReason, setCutBatchReason] = useState<string>('Regular Bulk');
  const [cutBatchNotes, setCutBatchNotes] = useState<string>('');
  const [cutBatchMaterials, setCutBatchMaterials] = useState<Array<{ rawMaterialId: string; issuedQty: number | '' }>>([
    { rawMaterialId: '', issuedQty: '' },
  ]);
  const [isSubmittingCutBatch, setIsSubmittingCutBatch] = useState(false);

  // Stage 3: Dedicated Inventory Stock Sync Confirmation State
  const [orderToSyncStock, setOrderToSyncStock] = useState<ProductionOrder | null>(null);
  const [isSyncingStock, setIsSyncingStock] = useState(false);

  // Asynchronous Production Progress Logging Dialog (Separate Cutting vs Finishing)
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [actionTab, setActionTab] = useState<'cut' | 'finish'>('cut');
  const [isSubmittingProgress, setIsSubmittingProgress] = useState(false);

  // Cut form state
  const [cutRawMaterialId, setCutRawMaterialId] = useState<string>('');
  const [cutQuantity, setCutQuantity] = useState<number | ''>('');
  const [cutDateTime, setCutDateTime] = useState<string>('');
  const [cutLoggedRole, setCutLoggedRole] = useState<string>('Cutting Master');
  const [cutDeductStock, setCutDeductStock] = useState<boolean>(true);

  // Finish form state (defaults finishIncrementStock strictly to false)
  const [finishQuantity, setFinishQuantity] = useState<number | ''>('');
  const [finishDateTime, setFinishDateTime] = useState<string>('');
  const [finishLoggedRole, setFinishLoggedRole] = useState<string>('Finishing / QA');
  const [finishIncrementStock, setFinishIncrementStock] = useState<boolean>(false);

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

  // Variant Options for Cut Batch Modal
  const variantSelectOptions: SearchableSelectOption[] = useMemo(() => {
    if (!cutBatchProductId) return [];
    const prod = productsList.find((p) => p.id === Number(cutBatchProductId));
    if (!prod || !prod.variants || prod.variants.length === 0) return [];
    return [
      { value: '', label: 'Default / No Variant' },
      ...prod.variants.map((v) => ({
        value: String(v.id),
        label: [v.size && `Size ${v.size}`, v.color && `Color ${v.color}`, v.sku && `SKU: ${v.sku}`]
          .filter(Boolean)
          .join(' • ') + ` (In Stock: ${v.stock})`,
      })),
    ];
  }, [cutBatchProductId, productsList]);

  // Raw Material Options with live warehouse available stock
  const rawMaterialSelectOptions: SearchableSelectOption[] = useMemo(() => {
    return rawMaterialsList.map((rm) => ({
      value: String(rm.id),
      label: `${rm.name} (${rm.code || 'RM'}) — Stock: ${rm.currentStock ?? 0} ${rm.unit}`,
    }));
  }, [rawMaterialsList]);

  // Allocated material options for the "Log Material Cut" tab
  const allocatedMaterialSelectOptions: SearchableSelectOption[] = useMemo(() => {
    if (!selectedOrder) return [];
    if (selectedOrder.materialUsages && selectedOrder.materialUsages.length > 0) {
      return selectedOrder.materialUsages.map((usage) => ({
        value: String(usage.rawMaterialId),
        label: `${usage.rawMaterial.name} (${usage.rawMaterial.unit}) — Allocated: ${usage.issuedQty} ${usage.rawMaterial.unit}`,
      }));
    }
    return rawMaterialsList.map((rm) => ({
      value: String(rm.id),
      label: `${rm.name} (${rm.unit}) — Stock: ${rm.currentStock ?? 0} ${rm.unit}`,
    }));
  }, [selectedOrder, rawMaterialsList]);


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
          const dateA = new Date(a.productionDate || a.createdAt).getTime();
          const dateB = new Date(b.productionDate || b.createdAt).getTime();
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
          const dateA = new Date(a.productionDate || a.createdAt).getTime();
          const dateB = new Date(b.productionDate || b.createdAt).getTime();
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

  // Open stage action modal (Cut vs Finish)
  const handleOpenActionModal = (order: ProductionOrder, defaultTab: 'cut' | 'finish' = 'cut') => {
    setSelectedOrder(order);
    setActionTab(defaultTab);
    const nowIso = new Date().toISOString().slice(0, 16);
    setCutDateTime(nowIso);
    setFinishDateTime(nowIso);
    setCutQuantity('');
    setFinishQuantity('');
    setCutLoggedRole(user?.role || 'STAFF');
    setFinishLoggedRole(user?.role || 'STAFF');
    setCutDeductStock(true);
    setFinishIncrementStock(false);

    if (order.materialUsages && order.materialUsages.length > 0) {
      setCutRawMaterialId(String(order.materialUsages[0].rawMaterialId));
    } else if (rawMaterialsList.length > 0) {
      setCutRawMaterialId(String(rawMaterialsList[0].id));
    } else {
      setCutRawMaterialId('');
    }
    setIsActionModalOpen(true);
  };

  // Active material cutting calculation: calculates allocated, already cut, and remaining uncut for selected material
  const selectedCutUsage = useMemo(() => {
    if (!selectedOrder || !cutRawMaterialId) return null;
    return selectedOrder.materialUsages?.find((u) => u.rawMaterialId === Number(cutRawMaterialId));
  }, [selectedOrder, cutRawMaterialId]);

  const cutMaterialStats = useMemo(() => {
    if (!selectedOrder || !selectedCutUsage) return null;
    const rawId = selectedCutUsage.rawMaterialId;
    const issued = Number(selectedCutUsage.issuedQty) || 0;
    const returned = Number(selectedCutUsage.returnedQty) || 0;
    const totalAlreadyCut = (selectedOrder.cutLogs || [])
      .filter((c) => c.rawMaterialId === rawId)
      .reduce((sum, c) => sum + Number(c.quantityCut || 0), 0);
    const remainingToCut = Math.max(0, issued - totalAlreadyCut - returned);
    return {
      issued,
      totalAlreadyCut,
      returned,
      remainingToCut,
      unit: selectedCutUsage.rawMaterial?.unit || 'Units',
    };
  }, [selectedOrder, selectedCutUsage]);

  // Submit asynchronous material cutting log
  const handleLogMaterialCut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    if (!cutRawMaterialId) {
      toast.warn('Please select a raw material');
      return;
    }
    const cutNum = Number(cutQuantity);
    if (!cutQuantity || isNaN(cutNum) || cutNum <= 0) {
      toast.warn('Please enter a valid cut quantity greater than 0');
      return;
    }

    if (cutMaterialStats && cutNum > cutMaterialStats.remainingToCut) {
      toast.error(
        `Quantity cut (${cutNum} ${cutMaterialStats.unit}) cannot exceed remaining uncut allocation in batch (${cutMaterialStats.remainingToCut} ${cutMaterialStats.unit}). Use Edit Batch to allocate more materials.`
      );
      return;
    }

    setIsSubmittingProgress(true);
    try {
      await post<any>(`/production/${selectedOrder.id}/cut-logs`, {
        rawMaterialId: Number(cutRawMaterialId),
        quantityCut: cutNum,
        cutDate: cutDateTime ? new Date(cutDateTime).toISOString() : new Date().toISOString(),
        loggedByRole: user?.role || 'STAFF',
      });

      toast.success(`Logged cutting of ${cutNum} units for Batch #${selectedOrder.productionNo}!`);
      setIsActionModalOpen(false);
      fetchProductionData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record material cutting log');
    } finally {
      setIsSubmittingProgress(false);
    }
  };

  // Submit asynchronous garment finishing log
  const handleLogGarmentFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    const finishNum = Math.floor(Number(finishQuantity));
    if (!finishQuantity || isNaN(finishNum) || finishNum <= 0) {
      toast.warn('Please enter a valid finished quantity greater than 0');
      return;
    }

    const currentCompleted = Math.max(
      selectedOrder.completedQty || 0,
      (selectedOrder.finishLogs || []).reduce((sum, f) => sum + Number(f.quantityFinished || 0), 0)
    );
    const target = Number(selectedOrder.targetQuantity || 0);
    const remaining = Math.max(0, target - currentCompleted);

    if (target > 0 && currentCompleted + finishNum > target) {
      toast.error(`Cannot finish more garments than the target quantity (${target}). Remaining allowed: ${remaining}`);
      return;
    }

    setIsSubmittingProgress(true);
    try {
      await post<any>(`/production/${selectedOrder.id}/finish-logs`, {
        quantityFinished: finishNum,
        finishDate: finishDateTime ? new Date(finishDateTime).toISOString() : new Date().toISOString(),
        loggedByRole: user?.role || 'STAFF',
        incrementInventory: finishIncrementStock,
      });

      if (finishIncrementStock) {
        toast.success(`Logged finishing of ${finishNum} garments for Batch #${selectedOrder.productionNo}! Added to active product inventory immediately.`);
      } else {
        toast.success(`Logged finishing of ${finishNum} garments for Batch #${selectedOrder.productionNo}! Batch output updated (Awaiting stock sync via Stage 3).`);
      }
      setIsActionModalOpen(false);
      fetchProductionData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record garment finishing log');
    } finally {
      setIsSubmittingProgress(false);
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

  // Open Start Batch modal in create mode
  const handleOpenCreateBatchModal = () => {
    setEditingOrderId(null);
    setSelectedOrder(null);
    const nowIso = new Date().toISOString().slice(0, 16);
    setCutBatchDateTime(nowIso);
    setCutBatchProductId('');
    setCutBatchVariantId('');
    setCutBatchTargetQty('');
    setCutBatchReason('Regular Bulk');
    setCutBatchNotes('');
    setCutBatchMaterials([{ rawMaterialId: '', issuedQty: '' }]);
    setIsCutBatchModalOpen(true);
  };

  // Open Start / Edit Batch modal in edit mode pre-populated with order data
  const handleOpenEditBatchModal = (order: ProductionOrder) => {
    setEditingOrderId(order.id);
    setSelectedOrder(order);
    setCutBatchProductId(order.productId ? String(order.productId) : '');
    setCutBatchVariantId(order.variantId ? String(order.variantId) : '');
    setCutBatchTargetQty(order.targetQuantity || order.completedQty || '');
    setCutBatchDateTime(
      order.productionDate
        ? new Date(order.productionDate).toISOString().slice(0, 16)
        : new Date().toISOString().slice(0, 16)
    );
    setCutBatchReason(order.reason || 'Regular Bulk');
    setCutBatchNotes(order.notes || '');
    if (order.materialUsages && order.materialUsages.length > 0) {
      setCutBatchMaterials(
        order.materialUsages.map((u) => ({
          rawMaterialId: String(u.rawMaterialId),
          issuedQty: u.issuedQty,
        }))
      );
    } else {
      setCutBatchMaterials([{ rawMaterialId: '', issuedQty: '' }]);
    }
    setIsCutBatchModalOpen(true);
  };

  /**
   * Start / Edit Production Batch Handler
   * In create mode: POST /production/cut-batch
   * In edit mode: PUT /production/:id
   * Supports allocating additional warehouse raw materials if batch runs short on fabric.
   */
  const handleCreateOrUpdateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cutBatchProductId) {
      toast.warn('Please select a target product');
      return;
    }
    const targetNum = Number(cutBatchTargetQty);
    if (!cutBatchTargetQty || isNaN(targetNum) || targetNum <= 0) {
      toast.warn('Please enter a target planned quantity greater than 0');
      return;
    }

    if (cutBatchMaterials.length === 0) {
      toast.warn('Please add at least one material cut row');
      return;
    }

    for (let i = 0; i < cutBatchMaterials.length; i++) {
      const row = cutBatchMaterials[i];
      if (!row.rawMaterialId) {
        toast.warn(`Please select a raw material for row #${i + 1}`);
        return;
      }
      const issued = Number(row.issuedQty);
      if (!row.issuedQty || isNaN(issued) || issued <= 0) {
        toast.warn(`Please enter a valid quantity for row #${i + 1}`);
        return;
      }
      const mat = rawMaterialsList.find((m) => m.id === Number(row.rawMaterialId));
      if (mat) {
        if (!editingOrderId) {
          // New batch: issued cannot exceed current warehouse stock
          if (issued > (mat.currentStock ?? 0)) {
            toast.error(
              `Entered quantity (${issued} ${mat.unit}) for "${mat.name}" exceeds available warehouse stock (${mat.currentStock} ${mat.unit})`
            );
            return;
          }
        } else {
          // Edit batch: additional delta needed cannot exceed current warehouse stock
          const existingUsage = selectedOrder?.materialUsages?.find((u) => u.rawMaterialId === Number(row.rawMaterialId));
          const existingIssued = existingUsage ? Number(existingUsage.issuedQty) : 0;
          const additionalNeeded = Math.max(0, issued - existingIssued);
          if (additionalNeeded > (mat.currentStock ?? 0)) {
            toast.error(
              `Additional allocation (+${additionalNeeded} ${mat.unit}) for "${mat.name}" exceeds warehouse stock (${mat.currentStock} ${mat.unit})`
            );
            return;
          }
        }
      }
    }

    setIsSubmittingCutBatch(true);
    try {
      const formattedDate = cutBatchDateTime ? new Date(cutBatchDateTime).toISOString() : new Date().toISOString();

      if (editingOrderId) {
        await put<any>(`/production/${editingOrderId}`, {
          productId: Number(cutBatchProductId),
          variantId: cutBatchVariantId ? Number(cutBatchVariantId) : null,
          targetQuantity: targetNum,
          productionDate: formattedDate,
          reason: cutBatchReason,
          notes: cutBatchNotes,
          materials: cutBatchMaterials.map((m) => {
            const rmId = Number(m.rawMaterialId);
            const existingUsage = selectedOrder?.materialUsages?.find((u) => u.rawMaterialId === rmId);
            return {
              rawMaterialId: rmId,
              issuedQty: Number(m.issuedQty),
              returnedQty: existingUsage ? existingUsage.returnedQty : 0,
              returnReason: existingUsage ? existingUsage.returnReason : null,
            };
          }),
        });
        toast.success(`Production batch #${selectedOrder?.productionNo || editingOrderId} updated successfully!`);
      } else {
        await post<any>('/production/cut-batch', {
          productId: Number(cutBatchProductId),
          variantId: cutBatchVariantId ? Number(cutBatchVariantId) : null,
          targetQuantity: targetNum,
          cutDate: formattedDate,
          reason: cutBatchReason,
          notes: cutBatchNotes,
          materials: cutBatchMaterials.map((m) => ({
            rawMaterialId: Number(m.rawMaterialId),
            issuedQty: Number(m.issuedQty),
          })),
        });
        toast.success('Production batch started successfully! Batch status set to CUTTING.');
      }

      setIsCutBatchModalOpen(false);
      setEditingOrderId(null);
      setSelectedOrder(null);
      setCutBatchProductId('');
      setCutBatchVariantId('');
      setCutBatchTargetQty('');
      setCutBatchNotes('');
      setCutBatchMaterials([{ rawMaterialId: '', issuedQty: '' }]);
      fetchProductionData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save production batch');
    } finally {
      setIsSubmittingCutBatch(false);
    }
  };


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

  /** Render standardized multi-stage manufacturing status badges */
  const renderBatchStatusBadge = (status: string, isStockSynced?: boolean) => {
    const st = (status || '').toUpperCase();
    if (st === 'CUTTING') {
      return (
        <Badge variant="outline" className="text-[10px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300 dark:border-amber-800">
          CUTTING
        </Badge>
      );
    }
    if (st === 'IN_PROGRESS') {
      return (
        <Badge variant="outline" className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800">
          SEWING / WIP
        </Badge>
      );
    }
    if (st === 'FINISHED_PENDING_STOCK' || (!isStockSynced && st === 'COMPLETED')) {
      return (
        <Badge variant="outline" className="text-[10px] font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-300 dark:border-purple-800">
          AWAITING STOCK SYNC
        </Badge>
      );
    }
    if (st === 'COMPLETED' && isStockSynced) {
      return (
        <Badge variant="outline" className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800">
          COMPLETED &amp; IN STOCK
        </Badge>
      );
    }
    if (st === 'CANCELLED') {
      return (
        <Badge variant="outline" className="text-[10px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-300 dark:border-rose-800">
          CANCELLED
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="text-[10px]">
        {status}
      </Badge>
    );
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
            Production &amp; Inventory
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Garment Manufacturing Runs, Material Yardage Tracking &amp; Stock Sync
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
            <Scissors className="size-4" /> Start Batch
          </Button>
        </div>
      </div>

      {/* ── KPI Metrics Cards (Summary KPIs: Materials Cut, Garments Finished, Current WIP, Output) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
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
            <div className="hidden lg:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Product &amp; Variant</TableHead>
                    <TableHead>Batch Type / Reason</TableHead>
                    <TableHead className="text-center">Target / Output / WIP</TableHead>
                    <TableHead>Raw Materials Consumed</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRecords.map((order) => {
                    const totalReturned = order.materialUsages.reduce(
                      (acc, u) => acc + (u.returnedQty || 0),
                      0
                    );

                    return (
                      <TableRow
                        key={order.id}
                        className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40 transition-colors"
                      >
                        {/* Clickable Batch # leading to edit modal */}
                        <TableCell className="font-mono text-xs font-bold">
                          <button
                            type="button"
                            onClick={() => handleOpenEditBatchModal(order)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700 font-mono text-xs transition-colors cursor-pointer group"
                            title="Edit batch and allocate materials"
                          >
                            <span>{order.productionNo}</span>
                            <Pencil className="w-3 h-3 text-slate-400 group-hover:text-amber-500 transition-colors" />
                          </button>
                        </TableCell>

                        {/* Date */}
                        <TableCell className="text-xs text-slate-600 dark:text-zinc-400">
                          {new Date(order.productionDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </TableCell>

                        {/* Product & Variant */}
                        <TableCell>
                          <div className="space-y-0.5">
                            <p className="text-xs font-bold text-slate-900 dark:text-white">
                              {order.product.name}
                            </p>
                            {order.variant && (
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-zinc-400">
                                {order.variant.size && (
                                  <span className="bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-[10px] font-medium">
                                    Size: {order.variant.size}
                                  </span>
                                )}
                                {order.variant.color && (
                                  <span className="bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-[10px] font-medium">
                                    Color: {order.variant.color}
                                  </span>
                                )}
                                {order.variant.sku && (
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    {order.variant.sku}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </TableCell>

                        {/* Reason */}
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className="text-[11px] font-medium"
                          >
                            {order.reason || 'Regular Bulk'}
                          </Badge>
                        </TableCell>

                        {/* Target, Output & WIP */}
                        <TableCell className="text-center">
                          <div className="space-y-1">
                            <div className="inline-flex items-center gap-1 font-bold text-xs text-emerald-600 dark:text-emerald-400 font-mono">
                              <span>{order.completedQty}</span>
                              <span className="text-[10px] font-normal text-slate-400">/ {order.targetQuantity || order.completedQty} Pcs</span>
                            </div>
                            {order.status !== 'CANCELLED' && order.status !== 'COMPLETED' ? (
                              <div className="flex justify-center">
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/50 font-mono">
                                  WIP: {Math.max(0, (order.targetQuantity || order.completedQty) - order.completedQty)} Pcs
                                </span>
                              </div>
                            ) : (
                              <div className="flex justify-center">
                                <span className="text-[10px] text-slate-400 font-mono">
                                  Complete
                                </span>
                              </div>
                            )}
                          </div>
                        </TableCell>

                        {/* Materials Breakdown Preview */}
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex flex-wrap gap-1">
                              {order.materialUsages.slice(0, 2).map((usage) => (
                                <span
                                  key={usage.id}
                                  className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700"
                                >
                                  <span>{usage.rawMaterial.name}:</span>
                                  <strong className="font-mono">{usage.netConsumedQty} {usage.rawMaterial.unit}</strong>
                                </span>
                              ))}
                              {order.materialUsages.length > 2 && (
                                <span className="text-[10px] text-slate-400 font-medium px-1 self-center">
                                  +{order.materialUsages.length - 2} more
                                </span>
                              )}
                            </div>
                            {totalReturned > 0 && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                                <RotateCcw className="w-2.5 h-2.5" />
                                {totalReturned} units scrap returned
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* Status */}
                        <TableCell className="text-center">
                          {renderBatchStatusBadge(order.status, order.isStockSynced)}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Stage 3: Dedicated Add to Product Stock confirmation button */}
                            {order.completedQty > 0 && !order.isStockSynced && order.status !== 'CANCELLED' && (
                              <Button
                                size="sm"
                                onClick={() => setOrderToSyncStock(order)}
                                className="h-7 px-2.5 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer animate-in fade-in duration-200"
                                title="Sync finished garments to active storefront inventory"
                              >
                                <Package className="w-3.5 h-3.5" />
                                <span>Add to Product Stock</span>
                              </Button>
                            )}

                            {/* Shadcn 3-Dots Dropdown Menu */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  aria-label="Batch Actions"
                                  className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-52 rounded-xl">
                                <DropdownMenuItem
                                  onClick={() => handleOpenActionModal(order, 'finish')}
                                  className="cursor-pointer gap-2 text-xs font-medium"
                                >
                                  <Shirt className="w-4 h-4 text-emerald-600" />
                                  <span>Log Finished Garments</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleOpenActionModal(order, 'cut')}
                                  className="cursor-pointer gap-2 text-xs font-medium"
                                >
                                  <Scissors className="w-4 h-4 text-amber-600" />
                                  <span>Add More Material Cuts</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleOpenReturnModal(order)}
                                  className="cursor-pointer gap-2 text-xs font-medium"
                                >
                                  <RotateCcw className="w-4 h-4 text-teal-600" />
                                  <span>Return Leftover Scrap</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedOrder(order);
                                    setIsDetailModalOpen(true);
                                  }}
                                  className="cursor-pointer gap-2 text-xs font-medium"
                                >
                                  <Eye className="w-4 h-4 text-blue-600" />
                                  <span>View History &amp; Timeline</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleOpenEditBatchModal(order)}
                                  className="cursor-pointer gap-2 text-xs font-medium"
                                >
                                  <Pencil className="w-4 h-4 text-slate-600" />
                                  <span>Edit Batch</span>
                                </DropdownMenuItem>
                                {isAdmin && (
                                  <DropdownMenuItem
                                    onClick={() => setOrderToDelete(order)}
                                    className="cursor-pointer gap-2 text-xs font-medium text-rose-600 dark:text-rose-400 focus:text-rose-600"
                                  >
                                    <Trash2 className="w-4 h-4 text-rose-600" />
                                    <span>Rollback / Delete Batch</span>
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
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
                const totalReturned = order.materialUsages.reduce(
                  (acc, u) => acc + (u.returnedQty || 0),
                  0
                );
                const targetUnits = order.targetQuantity || order.completedQty;
                const yieldRate = targetUnits > 0
                  ? Math.min(100, Math.round((order.completedQty / targetUnits) * 100))
                  : 100;

                const startDateStr = new Date(order.productionDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });

                // Calculate expected or completed finish date
                const finishDateStr = (() => {
                  if (order.status === 'COMPLETED') {
                    const finishedDate = order.createdAt ? new Date(order.createdAt) : new Date(order.productionDate);
                    return finishedDate.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    });
                  }
                  // For ongoing batches, estimate completion (e.g. +3 days from start)
                  const est = new Date(order.productionDate);
                  est.setDate(est.getDate() + 3);
                  return est.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  });
                })();

                return (
                  <div
                    key={order.id}
                    className="rounded-2xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 p-4 shadow-xs space-y-3 hover:border-slate-300 dark:hover:border-zinc-700 transition-all"
                  >
                    {/* Header: Batch Number & Garment Style */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleOpenEditBatchModal(order)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-mono font-bold text-xs transition-colors cursor-pointer"
                            title="Edit production batch"
                          >
                            <Factory className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>#{order.productionNo}</span>
                            <Pencil className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          </button>

                          <Badge variant="outline" className="text-[10px] font-medium">
                            {order.reason || 'Regular Bulk'}
                          </Badge>
                        </div>

                        {/* Garment Style & Variant */}
                        <div className="pt-1">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {order.product.name}
                          </h4>
                          {order.variant && (
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 flex-wrap">
                              {order.variant.size && (
                                <span className="bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-[10px] font-medium text-slate-700 dark:text-zinc-300">
                                  Size {order.variant.size}
                                </span>
                              )}
                              {order.variant.color && (
                                <span className="bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-[10px] font-medium text-slate-700 dark:text-zinc-300">
                                  {order.variant.color}
                                </span>
                              )}
                              {order.variant.sku && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {order.variant.sku}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div className="shrink-0 text-right">
                        {renderBatchStatusBadge(order.status, order.isStockSynced)}
                      </div>
                    </div>

                    {/* Metric Pill Grid: Target Units, Completed Output, WIP, Yield Rate */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-950/70 border border-slate-100 dark:border-zinc-800/80 text-center">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                          Target
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-zinc-300 font-mono block">
                          {targetUnits} Pcs
                        </span>
                      </div>

                      <div className="space-y-0.5 border-l border-slate-200/70 dark:border-zinc-800">
                        <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                          Finished
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono block">
                          {order.completedQty} Pcs
                        </span>
                      </div>

                      <div className="space-y-0.5 border-l sm:border-l border-slate-200/70 dark:border-zinc-800">
                        <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
                          Current WIP
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-amber-600 dark:text-amber-400 font-mono block">
                          {Math.max(0, targetUnits - order.completedQty)} Pcs
                        </span>
                      </div>

                      <div className="space-y-0.5 border-l border-slate-200/70 dark:border-zinc-800">
                        <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
                          Yield Rate
                        </span>
                        <span className="text-xs sm:text-sm font-extrabold text-indigo-600 dark:text-indigo-400 font-mono block">
                          {yieldRate}%
                        </span>
                      </div>
                    </div>

                    {/* Timeline Grid: Start Date, Expected Finish, Status badge */}
                    <div className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-zinc-950/50 border border-slate-100 dark:border-zinc-800/60 flex items-center justify-between text-xs">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                          Start Date
                        </span>
                        <span className="font-mono text-slate-700 dark:text-zinc-300 font-medium">
                          {startDateStr}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-slate-300 dark:text-zinc-700">
                        <ArrowRight className="size-3.5" />
                      </div>

                      <div className="space-y-0.5 text-right">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                          {order.status === 'COMPLETED' ? 'Completed Finish' : 'Expected Finish'}
                        </span>
                        <span className={`font-mono font-medium ${order.status === 'COMPLETED' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                          {finishDateStr}
                        </span>
                      </div>
                    </div>

                    {/* Materials preview chips */}
                    <div className="space-y-1.5 pt-0.5">
                      <div className="flex flex-wrap gap-1">
                        {order.materialUsages.map((usage) => (
                          <span
                            key={usage.id}
                            className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-white dark:bg-zinc-950 text-slate-700 dark:text-zinc-300 border border-slate-200/80 dark:border-zinc-800 font-mono"
                          >
                            <span>{usage.rawMaterial.name}:</span>
                            <strong className="text-slate-900 dark:text-white">{usage.netConsumedQty} {usage.rawMaterial.unit}</strong>
                          </span>
                        ))}
                      </div>

                      {totalReturned > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          <RotateCcw className="w-2.5 h-2.5" />
                          {totalReturned} units scrap returned to warehouse
                        </span>
                      )}

                      {order.notes && (
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 italic bg-white/70 dark:bg-zinc-950/40 p-2 rounded-lg border border-slate-100 dark:border-zinc-800/60 line-clamp-2">
                          "{order.notes}"
                        </p>
                      )}
                    </div>

                    {/* ── Action Buttons Bar: Prominent Add to Stock & Clean 3-Dots Actions Menu ── */}
                    <div className="pt-2 border-t border-slate-200/70 dark:border-zinc-800 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {order.completedQty > 0 && !order.isStockSynced && order.status !== 'CANCELLED' && (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => setOrderToSyncStock(order)}
                            className="h-8 px-2.5 text-xs font-semibold rounded-xl gap-1.5 cursor-pointer bg-purple-600 hover:bg-purple-700 text-white shadow-xs"
                          >
                            <Package className="size-3.5" />
                            <span>Add to Stock</span>
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setExpandedTimelineBatchId(expandedTimelineBatchId === order.id ? null : order.id)}
                          className="h-8 px-2.5 text-xs rounded-xl gap-1 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-800 cursor-pointer"
                        >
                          <Clock className="size-3.5 text-indigo-500" />
                          <span>Timeline ({((order.cutLogs?.length || 0) + (order.finishLogs?.length || 0))})</span>
                        </Button>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2.5 rounded-xl text-xs gap-1.5 cursor-pointer"
                          >
                            <MoreVertical className="size-3.5" />
                            <span>Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52 rounded-xl">
                          <DropdownMenuItem
                            onClick={() => handleOpenActionModal(order, 'finish')}
                            className="cursor-pointer gap-2 text-xs font-medium"
                          >
                            <Shirt className="w-4 h-4 text-emerald-600" />
                            <span>Log Finished Garments</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleOpenActionModal(order, 'cut')}
                            className="cursor-pointer gap-2 text-xs font-medium"
                          >
                            <Scissors className="w-4 h-4 text-amber-600" />
                            <span>Add More Material Cuts</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleOpenReturnModal(order)}
                            className="cursor-pointer gap-2 text-xs font-medium"
                          >
                            <RotateCcw className="w-4 h-4 text-teal-600" />
                            <span>Return Leftover Scrap</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedOrder(order);
                              setIsDetailModalOpen(true);
                            }}
                            className="cursor-pointer gap-2 text-xs font-medium"
                          >
                            <Eye className="w-4 h-4 text-blue-600" />
                            <span>View History &amp; Timeline</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleOpenEditBatchModal(order)}
                            className="cursor-pointer gap-2 text-xs font-medium"
                          >
                            <Pencil className="w-4 h-4 text-slate-600" />
                            <span>Edit Batch</span>
                          </DropdownMenuItem>
                          {isAdmin && (
                            <DropdownMenuItem
                              onClick={() => setOrderToDelete(order)}
                              className="cursor-pointer gap-2 text-xs font-medium text-rose-600 dark:text-rose-400 focus:text-rose-600"
                            >
                              <Trash2 className="w-4 h-4 text-rose-600" />
                              <span>Rollback / Delete Batch</span>
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Inline History Timeline in Mobile Card if expanded */}
                    {expandedTimelineBatchId === order.id && (
                      <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <h5 className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-indigo-500" /> Stage History Timeline
                          </h5>
                          <span className="text-[10px] text-slate-400 font-medium">Asynchronous Logs</span>
                        </div>
                        <BatchActivityTimeline order={order} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-100 dark:border-zinc-800 text-xs">
              <span className="text-zinc-400">
                Showing {paginatedRecords.length} of {filteredRecords.length} batches
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                >
                  <ChevronLeft className="size-3.5" /> Prev
                </Button>
                <span className="px-2 font-semibold">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  Next <ChevronRight className="size-3.5" />
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
          MODAL 1: VIEW FULL MATERIAL BREAKDOWN DETAIL
      ───────────────────────────────────────────────────────────── */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="w-[95vw] max-w-lg sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
          <DialogHeader className="px-4 py-3 sm:px-5 sm:py-3.5 pr-12 sm:pr-14 border-b border-slate-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-950 z-10">
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-500" />
              Production Batch #{selectedOrder?.productionNo}
            </DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3">
              {/* Top Overview Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-50 dark:bg-zinc-900/60 p-2.5 sm:p-3 rounded-xl border border-slate-200/80 dark:border-zinc-800">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Product</span>
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {selectedOrder.product.name}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Completed</span>
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    {selectedOrder.completedQty} Units
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Date</span>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">
                    {new Date(selectedOrder.productionDate).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Reason</span>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">
                    {selectedOrder.reason || 'Regular'}
                  </p>
                </div>
              </div>

              {selectedOrder.notes && (
                <div className="p-2.5 sm:p-3 bg-slate-50/70 dark:bg-zinc-900/50 rounded-xl text-xs text-slate-600 dark:text-zinc-400 border border-slate-200/60 dark:border-zinc-800/60">
                  <strong className="text-slate-900 dark:text-white block mb-0.5">Notes:</strong>
                  {selectedOrder.notes}
                </div>
              )}

              {/* Material Usages: Mobile Cards + Desktop Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Raw Material Consumption Details
                </h4>

                {/* Mobile Cards (< sm) */}
                <div className="block sm:hidden space-y-2.5">
                  {selectedOrder.materialUsages.map((usage) => (
                    <div
                      key={usage.id}
                      className="p-2.5 sm:p-3 bg-slate-50 dark:bg-zinc-900/60 rounded-xl border border-slate-200/80 dark:border-zinc-800 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <strong className="text-slate-900 dark:text-white font-semibold">
                          {usage.rawMaterial.name}
                        </strong>
                        {usage.rawMaterial.code && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            {usage.rawMaterial.code}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-slate-200/60 dark:border-zinc-800/60">
                        <div className="bg-white dark:bg-zinc-950 p-1.5 rounded-lg border border-slate-100 dark:border-zinc-800">
                          <span className="text-[9px] uppercase font-bold text-slate-400 block">Issued</span>
                          <span className="font-mono font-bold text-slate-700 dark:text-zinc-300 text-xs">
                            {usage.issuedQty} {usage.rawMaterial.unit}
                          </span>
                        </div>
                        <div className="bg-white dark:bg-zinc-950 p-1.5 rounded-lg border border-slate-100 dark:border-zinc-800">
                          <span className="text-[9px] uppercase font-bold text-emerald-600 block">Returned</span>
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                            {usage.returnedQty} {usage.rawMaterial.unit}
                          </span>
                        </div>
                        <div className="bg-white dark:bg-zinc-950 p-1.5 rounded-lg border border-slate-100 dark:border-zinc-800">
                          <span className="text-[9px] uppercase font-bold text-slate-400 block">Net</span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                            {usage.netConsumedQty} {usage.rawMaterial.unit}
                          </span>
                        </div>
                      </div>

                      {usage.returnReason && (
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 italic pt-1">
                          Scrap note: {usage.returnReason}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Desktop Table (>= sm) */}
                <div className="hidden sm:block rounded-xl border border-slate-200 dark:border-zinc-800 overflow-x-auto">
                  <Table className="min-w-[480px]">
                    <TableHeader>
                      <TableRow className="bg-slate-50 dark:bg-zinc-900">
                        <TableHead className="text-[10px] font-bold uppercase text-slate-600 dark:text-zinc-400">
                          Material Name
                        </TableHead>
                        <TableHead className="text-[10px] font-bold uppercase text-slate-600 dark:text-zinc-400 text-right">
                          Issued
                        </TableHead>
                        <TableHead className="text-[10px] font-bold uppercase text-slate-600 dark:text-zinc-400 text-right">
                          Returned
                        </TableHead>
                        <TableHead className="text-[10px] font-bold uppercase text-slate-600 dark:text-zinc-400 text-right">
                          Net Consumed
                        </TableHead>
                        <TableHead className="text-[10px] font-bold uppercase text-slate-600 dark:text-zinc-400">
                          Return Note
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedOrder.materialUsages.map((usage) => (
                        <TableRow key={usage.id}>
                          <TableCell className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                            {usage.rawMaterial.name}
                            {usage.rawMaterial.code && (
                              <span className="text-[10px] text-slate-400 font-mono block">
                                {usage.rawMaterial.code}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-right text-slate-700 dark:text-zinc-300 font-mono">
                            {usage.issuedQty} {usage.rawMaterial.unit}
                          </TableCell>
                          <TableCell className="text-xs text-right text-emerald-600 dark:text-emerald-400 font-semibold font-mono">
                            {usage.returnedQty} {usage.rawMaterial.unit}
                          </TableCell>
                          <TableCell className="text-xs text-right font-bold text-slate-900 dark:text-white font-mono">
                            {usage.netConsumedQty} {usage.rawMaterial.unit}
                          </TableCell>
                          <TableCell className="text-xs text-slate-500 dark:text-zinc-400">
                            {usage.returnReason || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Activity Timeline (Cutting vs Finishing) */}
              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Batch Activity &amp; WIP Timeline
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                      Decoupled Material Cutting &amp; Garment Finishing log history
                    </p>
                  </div>
                  {selectedOrder.status !== 'CANCELLED' && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setIsDetailModalOpen(false);
                        handleOpenActionModal(selectedOrder, 'cut');
                      }}
                      className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Scissors className="w-3.5 h-3.5" />
                      <span>Log Progress</span>
                    </Button>
                  )}
                </div>

                <div className="bg-slate-50 dark:bg-zinc-900/60 p-4 rounded-xl border border-slate-200/80 dark:border-zinc-800">
                  <BatchActivityTimeline order={selectedOrder} />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="px-4 py-3 sm:px-5 sm:py-3.5 border-t border-slate-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-950 z-10 flex flex-row items-center justify-between gap-2">
            {selectedOrder && selectedOrder.status !== 'CANCELLED' ? (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    handleOpenActionModal(selectedOrder, 'cut');
                  }}
                  className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Scissors className="w-3.5 h-3.5" />
                  <span>Log Cutting</span>
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    handleOpenActionModal(selectedOrder, 'finish');
                  }}
                  className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Log Finishing</span>
                </Button>
              </div>
            ) : <div />}
            <Button
              variant="outline"
              onClick={() => setIsDetailModalOpen(false)}
              className="text-xs rounded-xl"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
          MODAL 3: ASYNCHRONOUS PROGRESS LOGGING (CUTTING & FINISHING TABS)
      ───────────────────────────────────────────────────────────── */}
      <Dialog open={isActionModalOpen} onOpenChange={setIsActionModalOpen}>
        <DialogContent className="w-[95vw] max-w-lg sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
          <DialogHeader className="px-4 py-3 sm:px-5 sm:py-3.5 pr-12 sm:pr-14 border-b border-slate-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-950 z-10">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/50">
                <GitBranch className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Batch #{selectedOrder?.productionNo} Progress</span>
                  {selectedOrder && (
                    <Badge variant="outline" className="text-[10px] font-mono uppercase bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                      {selectedOrder.status}
                    </Badge>
                  )}
                </DialogTitle>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  {selectedOrder?.product.name} {selectedOrder?.variant ? `(${selectedOrder.variant.size || ''} ${selectedOrder.variant.color || ''})` : ''} · Target: {selectedOrder?.targetQuantity} pcs
                </p>
              </div>
            </div>
          </DialogHeader>

          {selectedOrder && (
            <Tabs value={actionTab} onValueChange={(val: any) => setActionTab(val)} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="px-4 pt-3 pb-1.5 sm:px-5 sm:pt-3.5 shrink-0 bg-white dark:bg-zinc-950">
                <TabsList className="grid grid-cols-2 w-full p-1 bg-slate-100 dark:bg-zinc-900 rounded-xl">
                  <TabsTrigger
                    value="cut"
                    className="flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:text-amber-700 dark:data-[state=active]:text-amber-400 data-[state=active]:shadow-sm transition-all cursor-pointer"
                  >
                    <Scissors className="w-3.5 h-3.5" />
                    <span>Log Material Cut</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="finish"
                    className="flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-400 data-[state=active]:shadow-sm transition-all cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Log Finished Garment</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* ── TAB 1: LOG MATERIAL CUT ── */}
              <TabsContent value="cut" className="flex flex-col flex-1 min-h-0 m-0 data-[state=inactive]:hidden focus-visible:outline-none">
                <form onSubmit={handleLogMaterialCut} className="flex flex-col flex-1 min-h-0">
                  <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3">
                    <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 p-2.5 sm:p-3 rounded-xl flex items-start gap-2.5">
                      <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-900 dark:text-amber-200">
                        Record raw fabric cuts as they happen from the batch's allocated materials. Cuts consume from batch allocation without deducting again from warehouse stock.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 block">
                        Select Allocated Raw Material <span className="text-rose-500">*</span>
                      </label>
                      <SearchableSelect
                        options={allocatedMaterialSelectOptions}
                        value={cutRawMaterialId}
                        onValueChange={setCutRawMaterialId}
                        placeholder="Select allocated raw material..."
                        searchPlaceholder="Search material name or code..."
                        dark={dark}
                      />

                      {cutMaterialStats && (
                        <div className="p-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs space-y-1">
                          <div className="flex items-center justify-between text-amber-900 dark:text-amber-200">
                            <span className="font-semibold">Batch Allocation Status:</span>
                            <span className="font-mono font-bold text-amber-700 dark:text-amber-300">
                              Remaining to Cut: {cutMaterialStats.remainingToCut} {cutMaterialStats.unit}
                            </span>
                          </div>
                          <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 font-mono">
                            Allocated: {cutMaterialStats.issued} {cutMaterialStats.unit} | Already Cut: {cutMaterialStats.totalAlreadyCut} {cutMaterialStats.unit} | Returned: {cutMaterialStats.returned} {cutMaterialStats.unit}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 block">
                          Quantity Cut {cutMaterialStats ? `(${cutMaterialStats.unit})` : ''} <span className="text-rose-500">*</span>
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={cutMaterialStats ? cutMaterialStats.remainingToCut : undefined}
                          required
                          value={cutQuantity}
                          onChange={(e) => setCutQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                          placeholder={cutMaterialStats ? `Max ${cutMaterialStats.remainingToCut} ${cutMaterialStats.unit}` : 'e.g. 15.5'}
                          className="h-9 text-xs rounded-xl bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 block">
                          Date &amp; Time of Cutting <span className="text-rose-500">*</span>
                        </label>
                        <DateTimePicker
                          value={cutDateTime}
                          onChange={setCutDateTime}
                        />
                      </div>
                    </div>

                    {/* Authenticated Role Status Badge */}
                    <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs">
                      <span className="font-medium text-slate-600 dark:text-zinc-400">Authenticated Operator</span>
                      <div className="flex items-center gap-1.5 font-bold">
                        <span className="text-slate-500 text-[11px]">Logging as:</span>
                        <Badge
                          variant="outline"
                          className="font-mono text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800"
                        >
                          {user?.role || 'STAFF'}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <DialogFooter className="px-4 py-3 sm:px-5 sm:py-3.5 border-t border-slate-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-950 z-10 flex-row justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsActionModalOpen(false)}
                      className="text-xs rounded-xl"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSubmittingProgress || !cutQuantity || (cutMaterialStats ? Number(cutQuantity) > cutMaterialStats.remainingToCut : false)}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-xl shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isSubmittingProgress ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Logging Cut...</span>
                        </>
                      ) : (
                        <>
                          <Scissors className="w-3.5 h-3.5" />
                          <span>Log Material Cut</span>
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </TabsContent>

              {/* ── TAB 2: LOG FINISHED GARMENT ── */}
              <TabsContent value="finish" className="flex flex-col flex-1 min-h-0 m-0 data-[state=inactive]:hidden focus-visible:outline-none">
                <form onSubmit={handleLogGarmentFinish} className="flex flex-col flex-1 min-h-0">
                  {(() => {
                    const actionCurrentCompleted = Math.max(
                      selectedOrder.completedQty || 0,
                      (selectedOrder.finishLogs || []).reduce((sum, f) => sum + Number(f.quantityFinished || 0), 0)
                    );
                    const actionTarget = Number(selectedOrder.targetQuantity || 0);
                    const actionRemaining = Math.max(0, actionTarget - actionCurrentCompleted);
                    const isActionOverTarget = actionTarget > 0 && finishQuantity !== '' && Number(finishQuantity) > actionRemaining;

                    return (
                      <>
                        <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3">

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div className="space-y-1">
                              <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 block">
                                Quantity Finished (Pcs) <span className="text-rose-500">*</span>
                              </label>
                              <Input
                                type="number"
                                step="1"
                                min="1"
                                max={actionTarget > 0 ? actionRemaining : undefined}
                                required
                                value={finishQuantity}
                                onChange={(e) => setFinishQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                                placeholder={actionTarget > 0 ? `Remaining: ${actionRemaining} pcs` : `Target: ${selectedOrder.targetQuantity} pcs`}
                                className={`h-9 text-xs rounded-xl bg-white dark:bg-zinc-900 border font-mono ${
                                  isActionOverTarget
                                    ? 'border-rose-500 dark:border-rose-500 ring-1 ring-rose-500'
                                    : 'border-slate-200 dark:border-zinc-800'
                                }`}
                              />
                              <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-zinc-400 mt-1">
                                <span>Current output: {actionCurrentCompleted} / {actionTarget} pcs</span>
                                <span className={`font-semibold ${actionRemaining === 0 ? 'text-amber-600' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                  Remaining: {actionRemaining} pcs
                                </span>
                              </div>
                              {isActionOverTarget && (
                                <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1">
                                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                  Cannot finish more garments than the target quantity ({actionTarget}). Remaining allowed: {actionRemaining}
                                </p>
                              )}
                            </div>

                            <div className="space-y-1">
                              <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 block">
                                Date &amp; Time of Finishing <span className="text-rose-500">*</span>
                              </label>
                              <DateTimePicker
                                value={finishDateTime}
                                onChange={setFinishDateTime}
                              />
                            </div>
                          </div>

                          {/* Authenticated Role Status Badge */}
                          <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs">
                            <span className="font-medium text-slate-600 dark:text-zinc-400">Authenticated Operator</span>
                            <div className="flex items-center gap-1.5 font-bold">
                              <span className="text-slate-500 text-[11px]">Logging as:</span>
                              <Badge
                                variant="outline"
                                className="font-mono text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                              >
                                {user?.role || 'STAFF'}
                              </Badge>
                            </div>
                          </div>

                          {/* Inventory Increment Checkbox - Defaults strictly to false */}
                          <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/80 cursor-pointer text-xs min-w-0 w-full select-none hover:bg-slate-100/80 dark:hover:bg-zinc-900 transition-colors">
                            <input
                              type="checkbox"
                              checked={finishIncrementStock}
                              onChange={(e) => setFinishIncrementStock(e.target.checked)}
                              className="size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                            <span className="font-semibold text-slate-800 dark:text-zinc-200">
                              Immediately add finished pieces to active product inventory
                            </span>
                          </label>

                          {/* Dynamic Information Banner */}
                          <div
                            className={`border p-3 rounded-xl flex items-start gap-2.5 min-w-0 w-full transition-colors ${
                              finishIncrementStock
                                ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/70 dark:border-emerald-900/40 text-emerald-900 dark:text-emerald-200'
                                : 'bg-purple-50/60 dark:bg-purple-950/20 border-purple-200/70 dark:border-purple-900/40 text-purple-900 dark:text-purple-200'
                            }`}
                          >
                            {finishIncrementStock ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                            ) : (
                              <Info className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                            )}
                            <p className="text-xs">
                              {finishIncrementStock
                                ? 'Finished garments will immediately increment active product inventory and complete the batch run when the target quantity is met.'
                                : 'Batch completed output will update and status will transition to "Awaiting Stock Sync" (FINISHED_PENDING_STOCK). Product inventory will remain unchanged until explicitly synced via "Add to Product Stock" (Stage 3).'}
                            </p>
                          </div>
                        </div>

                        <DialogFooter className="px-4 py-3 sm:px-5 sm:py-3.5 border-t border-slate-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-950 z-10 flex-row justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsActionModalOpen(false)}
                            className="text-xs rounded-xl"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            disabled={isSubmittingProgress || !finishQuantity || isActionOverTarget}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isSubmittingProgress ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Logging Finishing...</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Log Finished Garment</span>
                              </>
                            )}
                          </Button>
                        </DialogFooter>
                      </>
                    );
                  })()}
                </form>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────
          ALERT DIALOG: ROLLBACK & DELETE PRODUCTION RUN (Admin Only)
      ───────────────────────────────────────────────────────────── */}
      {isAdmin && (
        <AlertDialog open={Boolean(orderToDelete)} onOpenChange={() => setOrderToDelete(null)}>
          <AlertDialogContent className="w-full max-w-lg sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-6">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-500" />
                Rollback &amp; Delete Production Batch #{orderToDelete?.productionNo}?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-slate-500 dark:text-zinc-400 space-y-2">
                <p>
                  This action will perform an atomic inventory rollback:
                </p>
                <ul className="list-disc pl-4 space-y-1 text-slate-700 dark:text-zinc-300">
                  <li>
                    Restores <strong>consumed raw materials</strong> back to warehouse inventory stock.
                  </li>
                  <li>
                    Deducts <strong>{orderToDelete?.completedQty} finished garment units</strong> from product stock.
                  </li>
                  <li>
                    Permanently removes this batch record from the production ledger.
                  </li>
                </ul>
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
                {isDeleting ? 'Rolling Back...' : 'Yes, Rollback & Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 4: MULTI-MATERIAL CUT BATCH CREATION (STAGE 1)
      ───────────────────────────────────────────────────────────── */}
      <Dialog open={isCutBatchModalOpen} onOpenChange={setIsCutBatchModalOpen}>
        <DialogContent className="w-[95vw] max-w-lg sm:max-w-3xl lg:max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
          <DialogHeader className="px-4 py-3 sm:px-5 sm:py-3.5 pr-12 sm:pr-14 border-b border-slate-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-950 z-10">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200 dark:border-amber-900/50">
                <Scissors className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{editingOrderId ? `Edit Production Batch #${selectedOrder?.productionNo}` : 'Start New Production Batch'}</span>
                  <Badge variant="outline" className={`text-[10px] font-mono ${editingOrderId ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300 dark:border-amber-800'}`}>
                    {editingOrderId ? 'EDIT & ALLOCATE' : 'STAGE 1: CUTTING'}
                  </Badge>
                </DialogTitle>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  {editingOrderId
                    ? 'Adjust planned output, add notes, or allocate additional raw fabrics from warehouse inventory'
                    : 'Select target garment style, set planned output, and issue/cut raw fabrics from warehouse inventory'}
                </p>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleCreateOrUpdateBatch} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3">
              {/* Target Product Selection with Image Thumbnails */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-amber-500" />
                  Target Garment Product <span className="text-rose-500">*</span>
                </label>
                <SearchableSelect
                  options={productSelectOptions}
                  value={cutBatchProductId}
                  onValueChange={(val) => {
                    setCutBatchProductId(val);
                    setCutBatchVariantId('');
                  }}
                  placeholder="Search and select target product..."
                  searchPlaceholder="Search product by name..."
                  dark={dark}
                />
              </div>

              {/* Optional Variant Selection */}
              {cutBatchProductId && variantSelectOptions.length > 0 && (
                <div className="space-y-1.5 animate-in fade-in-50 duration-150">
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                    Target Product Variant (Size / Color)
                  </label>
                  <SearchableSelect
                    options={variantSelectOptions}
                    value={cutBatchVariantId}
                    onValueChange={setCutBatchVariantId}
                    placeholder="Select variant (or leave blank for all sizes)..."
                    searchPlaceholder="Search variant size or color..."
                    dark={dark}
                  />
                </div>
              )}

              {/* Grid: Target Planned Quantity, Cut Date/Time, Reason */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="space-y-1 sm:col-span-3">
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                    Target Planned Qty <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={cutBatchTargetQty}
                    onChange={(e) => setCutBatchTargetQty(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 100 Pcs"
                    className="h-9 text-xs rounded-xl bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 font-mono"
                  />
                </div>

                <div className="space-y-1 sm:col-span-5">
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                    Batch Date &amp; Time <span className="text-rose-500">*</span>
                  </label>
                  <DateTimePicker
                    value={cutBatchDateTime}
                    onChange={setCutBatchDateTime}
                  />
                </div>

                <div className="space-y-1 sm:col-span-4">
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                    Batch Type / Reason
                  </label>
                  <SearchableSelect
                    options={PRODUCTION_REASON_OPTIONS}
                    value={cutBatchReason}
                    onValueChange={setCutBatchReason}
                    placeholder="Select reason..."
                    dark={dark}
                  />
                </div>
              </div>

              {/* Dynamic Multi-Material Cut Rows with Strict Stock Validation */}
              <div className="space-y-2.5 pt-3 border-t border-slate-100 dark:border-zinc-800">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Scissors className="w-3.5 h-3.5 text-amber-500" />
                    Raw Materials to Issue &amp; Cut <span className="text-rose-500">*</span>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    {editingOrderId
                      ? 'Add fabrics/trims or allocate additional rolls from warehouse inventory'
                      : 'Add multiple fabrics/trims. Issued quantities cannot exceed available warehouse stock.'}
                  </p>
                </div>

                <div className="space-y-2.5">
                  {cutBatchMaterials.map((row, idx) => {
                    const selectedMat = rawMaterialsList.find((m) => m.id === Number(row.rawMaterialId));
                    const initialUsage = editingOrderId && selectedOrder ? selectedOrder.materialUsages?.find((u) => u.rawMaterialId === Number(row.rawMaterialId)) : null;
                    const initialIssued = initialUsage ? Number(initialUsage.issuedQty) : 0;
                    const availableWarehouse = selectedMat ? (Number(selectedMat.currentStock) || 0) : 0;
                    const maxStock = editingOrderId ? availableWarehouse + initialIssued : availableWarehouse;
                    const enteredQty = Number(row.issuedQty) || 0;
                    const isOverStock = selectedMat && row.issuedQty !== '' && enteredQty > maxStock;

                    return (
                      <div
                        key={idx}
                        className={`p-2.5 sm:p-3 rounded-xl border space-y-2 transition-colors ${
                          isOverStock
                            ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900/60'
                            : 'bg-slate-50 dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-700 dark:text-zinc-300">
                            Material Line #{idx + 1} {initialIssued > 0 ? `(Currently Allocated: ${initialIssued} ${selectedMat?.unit})` : ''}
                          </span>
                          {cutBatchMaterials.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setCutBatchMaterials((prev) => prev.filter((_, i) => i !== idx))}
                              className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer p-0.5"
                              title="Remove row"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                              Select Fabric / Raw Material
                            </label>
                            <SearchableSelect
                              options={rawMaterialSelectOptions}
                              value={row.rawMaterialId}
                              onValueChange={(val) => {
                                setCutBatchMaterials((prev) => {
                                  const copy = [...prev];
                                  copy[idx] = { ...copy[idx], rawMaterialId: val };
                                  return copy;
                                });
                              }}
                              placeholder="Select raw material..."
                              searchPlaceholder="Search material name or code..."
                              dark={dark}
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                              Cut / Issued Qty {selectedMat ? `(${selectedMat.unit})` : ''}
                            </label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0.01"
                              max={selectedMat ? maxStock : undefined}
                              value={row.issuedQty}
                              onChange={(e) => {
                                const val = e.target.value;
                                setCutBatchMaterials((prev) => {
                                  const copy = [...prev];
                                  copy[idx] = { ...copy[idx], issuedQty: val === '' ? '' : Number(val) };
                                  return copy;
                                });
                              }}
                              placeholder={
                                selectedMat
                                  ? editingOrderId && initialIssued > 0
                                    ? `Max: ${maxStock} (Warehouse: ${availableWarehouse} + Allocated: ${initialIssued})`
                                    : `Max available: ${maxStock} ${selectedMat.unit}`
                                  : 'Enter quantity...'
                              }
                              className={`h-9 text-xs rounded-xl bg-white dark:bg-zinc-900 ${
                                isOverStock ? 'border-rose-500 focus:ring-rose-500 text-rose-600' : 'border-slate-200 dark:border-zinc-800'
                              }`}
                            />
                          </div>
                        </div>

                        {isOverStock && (
                          <div className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 pt-1">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              Entered quantity ({enteredQty}) exceeds allowed stock ({maxStock} {selectedMat?.unit}{editingOrderId ? ' including prior allocation' : ''}). Please adjust before proceeding.
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* "+ Add Material Row" Button Placed Exclusively Below The Last Item Card */}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCutBatchMaterials((prev) => [...prev, { rawMaterialId: '', issuedQty: '' }])}
                    className="w-full border-dashed border-2 py-2.5 h-auto text-xs rounded-xl gap-2 cursor-pointer text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800/80 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Add Material Row</span>
                  </Button>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                  Batch Notes &amp; Cutting Instructions
                </label>
                <Input
                  type="text"
                  value={cutBatchNotes}
                  onChange={(e) => setCutBatchNotes(e.target.value)}
                  placeholder="e.g. Marker layout pattern #4, double-ply cut on table 2"
                  className="h-9 text-xs rounded-xl bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <DialogFooter className="px-4 py-3 sm:px-5 sm:py-3.5 border-t border-slate-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-950 z-10 flex-row justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCutBatchModalOpen(false)}
                className="text-xs rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  isSubmittingCutBatch ||
                  !cutBatchProductId ||
                  !cutBatchTargetQty ||
                  cutBatchMaterials.some((r) => {
                    if (!r.rawMaterialId || r.issuedQty === '') return true;
                    const mat = rawMaterialsList.find((m) => m.id === Number(r.rawMaterialId));
                    if (!mat) return false;
                    const initialUsage = editingOrderId && selectedOrder ? selectedOrder.materialUsages?.find((u) => u.rawMaterialId === Number(r.rawMaterialId)) : null;
                    const initialIssued = initialUsage ? Number(initialUsage.issuedQty) : 0;
                    const maxAllowed = editingOrderId ? (mat.currentStock ?? 0) + initialIssued : (mat.currentStock ?? 0);
                    return Number(r.issuedQty) > maxAllowed;
                  })
                }
                className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-xl shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmittingCutBatch ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{editingOrderId ? 'Saving Batch...' : 'Initiating Cut Batch...'}</span>
                  </>
                ) : (
                  <>
                    <Scissors className="w-3.5 h-3.5" />
                    <span>{editingOrderId ? 'Save Batch & Allocate Materials' : 'Cut Materials & Start Batch'}</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
    </div>
  );
};

export default ProductionListPage;
