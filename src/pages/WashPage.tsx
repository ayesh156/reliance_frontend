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
import { DateTimePicker } from '../components/ui/date-time-picker';
import { get, post, del } from '../lib/api';
import { getProductImageUrl, getCurrentLocalDateTime } from '../lib/utils';
import { toast } from 'react-toastify';
import { BatchStatusBadge } from '../components/production/BatchStatusBadge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
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
import {
  Waves,
  Search,
  CheckCircle2,
  Package,
  AlertCircle,
  Loader2,
  RotateCcw,
  Shirt,
  Calendar,
  Clock,
  ArrowRight,
  Sparkles,
  Info,
  Layers,
  ChevronLeft,
  ChevronRight,
  Eye,
  Check,
  SlidersHorizontal,
  X,
  MoreVertical,
  Trash2,
} from 'lucide-react';
import { SearchableSelect, type SearchableSelectOption } from '../components/ui/searchable-select';
import { DateRangePicker, type DateRange } from '../components/ui/date-range-picker';
import CuttingDetailModal, {
  formatSriLankaDateTime,
} from '../components/production/CuttingDetailModal';

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

interface WashBatchItem {
  id: number;
  productionNo: string;
  productId: number;
  variantId?: number | null;
  targetQuantity: number;
  completedQty: number;
  sentToWashQty: number;
  washedQty: number;
  status: string;
  isStockSynced?: boolean;
  stockSyncedAt?: string | null;
  stockSyncedByRole?: string | null;
  reason?: string | null;
  notes?: string | null;
  productionDate: string;
  createdAt: string;
  targetProducts?: any;
  product: {
    id: number;
    name: string;
    slug?: string | null;
    images?: Array<{ id?: number; imageUrl?: string | null }>;
  };
  variant?: {
    id: number;
    size?: string | null;
    color?: string | null;
    sku?: string | null;
    stock?: number;
  } | null;
  materialUsages?: any[];
}

export interface ParsedWashBatchProduct {
  productId: number;
  variantId?: number | null;
  productName: string;
  sku?: string;
  barcode?: string;
  totalSent: number;
  alreadyWashed: number;
  remaining: number;
  imageUrl?: string | null;
}

export const getBatchProducts = (b: WashBatchItem | null): ParsedWashBatchProduct[] => {
  if (!b) return [];
  const list: ParsedWashBatchProduct[] = [];

  let raw = b.targetProducts;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = null;
    }
  }

  if (Array.isArray(raw) && raw.length > 0) {
    raw.forEach((tp: any) => {
      const pId = Number(tp.productId || tp.id);
      const sent = Number(tp.sentToWashQty) || 0;
      const washed = Number(tp.washedQty) || 0;
      const remaining = Math.max(0, sent - washed);
      const rawImg = (b.product?.id === pId ? b.product.images?.[0]?.imageUrl : null) || (tp as any).image;
      list.push({
        productId: pId,
        variantId: tp.variantId ? Number(tp.variantId) : null,
        productName: tp.productName || (b.product?.id === pId ? b.product.name : `Product #${pId}`),
        sku: tp.sku || (b.variant ? b.variant.sku || '' : ''),
        barcode: tp.barcode || '',
        totalSent: sent,
        alreadyWashed: washed,
        remaining,
        imageUrl: rawImg ? getProductImageUrl(rawImg) : null,
      });
    });
  }

  if (list.length === 0 && b.product) {
    const sent = b.sentToWashQty || 0;
    const washed = b.washedQty || 0;
    const remaining = Math.max(0, sent - washed);
    const rawImg = b.product.images?.[0]?.imageUrl;
    list.push({
      productId: b.productId,
      variantId: b.variantId || null,
      productName: b.product.name,
      sku: b.variant?.sku || '',
      barcode: '',
      totalSent: sent,
      alreadyWashed: washed,
      remaining,
      imageUrl: rawImg ? getProductImageUrl(rawImg) : null,
    });
  }

  return list;
};

export const WashPage: React.FC = () => {
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const { user } = useAuth();
  const isDark = resolvedTheme === 'dark';

  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<WashBatchItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected batch for logging wash output
  const [selectedBatch, setSelectedBatch] = useState<WashBatchItem | null>(null);
  const [isLogWashModalOpen, setIsLogWashModalOpen] = useState(false);
  const [washQuantity, setWashQuantity] = useState<number | ''>('');
  const [washProductQuantities, setWashProductQuantities] = useState<Record<number, number | ''>>({});
  const [washDateTime, setWashDateTime] = useState<string>(getCurrentLocalDateTime());
  const [washNotes, setWashNotes] = useState<string>('');
  const [isSubmittingWash, setIsSubmittingWash] = useState(false);

  // Detail Modal
  const [detailOrder, setDetailOrder] = useState<any | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Rollback / Delete Wash Stage
  const [batchToRollbackWash, setBatchToRollbackWash] = useState<any | null>(null);
  const [isRollingBackWash, setIsRollingBackWash] = useState(false);

  const handleConfirmRollbackWash = async () => {
    if (!batchToRollbackWash) return;
    setIsRollingBackWash(true);
    try {
      await del(`/production/${batchToRollbackWash.id}/wash`);
      toast.success(
        `Wash stage for Cutting #${batchToRollbackWash.batchNumber} has been rolled back and returned to Line stage.`
      );
      setBatchToRollbackWash(null);
      fetchWashBatches();
    } catch (err: any) {
      console.error('Failed to rollback wash stage:', err);
      toast.error(err.message || 'Failed to rollback wash stage');
    } finally {
      setIsRollingBackWash(false);
    }
  };

  const [rawMaterialsList, setRawMaterialsList] = useState<any[]>([]);
  const [productsList, setProductsList] = useState<any[]>([]);
  const [selectedProductFilter, setSelectedProductFilter] = useState('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [sortBy, setSortBy] = useState('newest');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Product Options
  const productFilterOptions: SearchableSelectOption[] = useMemo(() => [
    { value: 'all', label: 'All Garments / Styles' },
    ...productsList.map((p) => ({
      value: String(p.id),
      label: p.name,
    })),
  ], [productsList]);

  const sortOptions: SearchableSelectOption[] = useMemo(() => [
    { value: 'newest', label: 'Newest First' },
    { value: 'oldest', label: 'Oldest First' },
    { value: 'highest_qty', label: 'Highest Wash Quantity' },
  ], []);

  // Fetch all batches currently in 'WASHING' status
  const fetchWashBatches = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await get('/production?status=WASHING&limit=100');
      const data = res?.data || res;
      const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      setBatches(items);
    } catch (err: any) {
      console.error('Failed to fetch wash batches:', err);
      toast.error('Failed to load batches in wash stage');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch catalogs for detail modal support
  useEffect(() => {
    fetchWashBatches();
    Promise.all([get<any>('/products'), get<any>('/raw-material-items')])
      .then(([pRes, rRes]) => {
        setProductsList(pRes?.data || pRes || []);
        setRawMaterialsList(rRes?.data || rRes || []);
      })
      .catch((e) => console.error(e));
  }, [fetchWashBatches]);

  // Active filter count for mobile badge
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedProductFilter !== 'all') count++;
    if (dateRange?.from || dateRange?.to) count++;
    if (sortBy !== 'newest') count++;
    return count;
  }, [selectedProductFilter, dateRange, sortBy]);

  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
    selectedProductFilter !== 'all' ||
    dateRange !== undefined ||
    sortBy !== 'newest'
  );

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedProductFilter('all');
    setDateRange(undefined);
    setSortBy('newest');
  };

  // Filtered batches by search query, product, dateRange and sort
  const filteredBatches = useMemo(() => {
    let list = [...batches];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (b) =>
          b.productionNo?.toLowerCase().includes(q) ||
          b.product?.name?.toLowerCase().includes(q) ||
          b.reason?.toLowerCase().includes(q) ||
          b.notes?.toLowerCase().includes(q)
      );
    }

    if (selectedProductFilter && selectedProductFilter !== 'all') {
      const targetPId = Number(selectedProductFilter);
      list = list.filter((b) => {
        if (b.productId === targetPId) return true;
        const prods = getBatchProducts(b);
        return prods.some((p) => p.productId === targetPId);
      });
    }

    if (dateRange?.from) {
      const fromTime = new Date(dateRange.from).setHours(0, 0, 0, 0);
      const toTime = dateRange.to
        ? new Date(dateRange.to).setHours(23, 59, 59, 999)
        : new Date(dateRange.from).setHours(23, 59, 59, 999);

      list = list.filter((b) => {
        const bDate = new Date(b.createdAt || b.productionDate).getTime();
        return bDate >= fromTime && bDate <= toTime;
      });
    }

    switch (sortBy) {
      case 'oldest':
        list.sort((a, b) => {
          const dateA = new Date(a.createdAt || a.productionDate).getTime();
          const dateB = new Date(b.createdAt || b.productionDate).getTime();
          return dateA - dateB || a.id - b.id;
        });
        break;
      case 'highest_qty':
        list.sort((a, b) => {
          const qA = a.sentToWashQty || a.targetQuantity || a.completedQty || 0;
          const qB = b.sentToWashQty || b.targetQuantity || b.completedQty || 0;
          return qB - qA || b.id - a.id;
        });
        break;
      case 'newest':
      default:
        // Preserves backend sorted order (createdAt: desc)
        break;
    }

    return list;
  }, [batches, searchQuery, selectedProductFilter, dateRange, sortBy]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const totalBatches = batches.length;
    let totalSentToWash = 0;
    let totalWashedSoFar = 0;

    batches.forEach((b) => {
      const sent = b.sentToWashQty > 0
        ? b.sentToWashQty
        : (b.targetQuantity > 0 ? b.targetQuantity : b.completedQty);
      const washed = b.washedQty || 0;
      totalSentToWash += sent;
      totalWashedSoFar += washed;
    });

    const totalRemainingToWash = Math.max(0, totalSentToWash - totalWashedSoFar);

    return {
      totalBatches,
      totalSentToWash,
      totalWashedSoFar,
      totalRemainingToWash,
    };
  }, [batches]);

  // Open "Log Washed Items" modal
  const handleOpenLogWashModal = (batch: WashBatchItem) => {
    setSelectedBatch(batch);
    const prods = getBatchProducts(batch);
    const initialQtys: Record<number, number | ''> = {};
    prods.forEach((_, idx) => {
      initialQtys[idx] = '';
    });
    setWashProductQuantities(initialQtys);

    setWashQuantity('');
    setWashDateTime(getCurrentLocalDateTime());
    setWashNotes('');
    setIsLogWashModalOpen(true);
  };

  // Submit Washed Items & Partial Stock Sync
  const handleSubmitWash = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatch) return;

    const currentProds = getBatchProducts(selectedBatch);
    const items = currentProds
      .map((p, idx) => ({
        productId: p.productId,
        variantId: p.variantId || null,
        washedQty: Number(washProductQuantities[idx] || 0),
      }))
      .filter((it) => it.washedQty > 0);

    // Backward compatible total
    const totalWashedToday = items.reduce((sum, it) => sum + it.washedQty, 0);

    if (totalWashedToday <= 0) {
      toast.error('Please enter at least one product washed quantity ready for sale.');
      return;
    }

    // Validate quantities against remaining balance
    for (let i = 0; i < currentProds.length; i++) {
      const p = currentProds[i];
      const enterQty = Number(washProductQuantities[i] || 0);
      if (enterQty > p.remaining) {
        toast.error(`Cannot log ${enterQty} for ${p.productName}. Maximum remaining in wash is ${p.remaining} pcs.`);
        return;
      }
    }

    setIsSubmittingWash(true);
    try {
      const res: any = await post(`/production/${selectedBatch.id}/wash`, {
        items,
        washedQuantity: totalWashedToday,
        washDate: washDateTime ? new Date(washDateTime).toISOString() : new Date().toISOString(),
        notes: washNotes.trim() || undefined,
      });

      const updated = res?.data || res;
      if (updated.status === 'COMPLETED') {
        toast.success(
          `Batch #${selectedBatch.productionNo} fully completed! +${totalWashedToday} items added to sellable stock (Status: COMPLETED).`
        );
      } else {
        toast.success(
          `Logged +${totalWashedToday} washed items to active sellable stock! Batch remains in WASHING status.`
        );
      }

      setIsLogWashModalOpen(false);
      fetchWashBatches();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to log washed items');
    } finally {
      setIsSubmittingWash(false);
    }
  };

  return (
    <div className="space-y-5 pb-12">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200/80 dark:border-zinc-800 pb-4">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 font-sans">
                <Waves className="w-5 h-5 text-cyan-600 dark:text-cyan-400 shrink-0" />
                <span>Industrial Wash Plant</span>
              </h1>
              <Badge
                variant="outline"
                className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800"
              >
                Decoupled Stage
              </Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Manage batches in washing, log finished sale-ready garments, and synchronize sellable product inventory.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchWashBatches}
            disabled={loading}
            className="h-9 text-xs rounded-xl border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-900 font-medium cursor-pointer"
          >
            <RotateCcw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
          <Button
            size="sm"
            onClick={() => navigate('/system/production')}
            className="h-9 text-xs bg-slate-900 hover:bg-slate-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 rounded-xl font-medium cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>View All Production</span>
          </Button>
        </div>
      </div>

      {/* ── KPI Summary Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Active Batches */}
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Batches in Wash
            </span>
            <div className="text-xl sm:text-2xl font-black font-mono text-slate-900 dark:text-white mt-1">
              {metrics.totalBatches}
            </div>
            <span className="text-[10px] text-slate-400">Currently in treatment</span>
          </div>
          <div className="size-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 flex items-center justify-center border border-cyan-200 dark:border-cyan-900/50">
            <Waves className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Total Sent to Wash */}
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Total Sent to Wash
            </span>
            <div className="text-xl sm:text-2xl font-black font-mono text-slate-900 dark:text-white mt-1">
              {metrics.totalSentToWash} <span className="text-xs font-bold text-slate-400">Pcs</span>
            </div>
            <span className="text-[10px] text-slate-400">Sewn garment intake</span>
          </div>
          <div className="size-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-900/50">
            <Shirt className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Washed & Added to Stock */}
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Washed &amp; In Stock
            </span>
            <div className="text-xl sm:text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
              +{metrics.totalWashedSoFar} <span className="text-xs font-bold text-emerald-600/70">Pcs</span>
            </div>
            <span className="text-[10px] text-emerald-600/70">Active sellable inventory</span>
          </div>
          <div className="size-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-900/50">
            <Package className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Remaining in Wash */}
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Remaining in Wash
            </span>
            <div className="text-xl sm:text-2xl font-black font-mono text-amber-600 dark:text-amber-400 mt-1">
              {metrics.totalRemainingToWash} <span className="text-xs font-bold text-amber-600/70">Pcs</span>
            </div>
            <span className="text-[10px] text-amber-600/70">WIP treatment balance</span>
          </div>
          <div className="size-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200 dark:border-amber-900/50">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ── Responsive Filter Bar ── */}
      {/* 1. Mobile Filter Bar (< 1024px) */}
      <div className="lg:hidden flex flex-col gap-2.5 p-3 rounded-2xl border bg-white dark:bg-zinc-950 border-slate-200/80 dark:border-zinc-800 shadow-xs">
        <div className="flex items-center gap-2 w-full">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800">
            <Search className="size-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
              }}
              placeholder="Search cutting #, garment, notes..."
              className="bg-transparent outline-none w-full text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMobileFiltersOpen((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all shrink-0 cursor-pointer ${
              mobileFiltersOpen || activeFilterCount > 0
                ? 'bg-cyan-50 border-cyan-200 text-cyan-700 dark:bg-cyan-950/50 dark:border-cyan-800 dark:text-cyan-300'
                : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300'
            }`}
          >
            <SlidersHorizontal className="size-3.5" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="flex items-center justify-center size-4 rounded-full bg-cyan-600 text-[9px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {mobileFiltersOpen && (
          <div className="pt-2.5 border-t border-slate-100 dark:border-zinc-800 space-y-2 animate-in fade-in-50 duration-150">
            <div className="w-full">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                Date Range
              </label>
              <DateRangePicker
                date={dateRange}
                onDateChange={(range) => {
                  setDateRange(range);
                }}
                placeholder="Filter by date..."
              />
            </div>

            <div className="w-full">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                Garment / Style
              </label>
              <SearchableSelect
                options={productFilterOptions}
                value={selectedProductFilter}
                onValueChange={(val) => {
                  setSelectedProductFilter(val);
                }}
                placeholder="All Garments"
                searchPlaceholder="Search style..."
                dark={isDark}
              />
            </div>

            <div className="w-full">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                Sort Order
              </label>
              <SearchableSelect
                options={sortOptions}
                value={sortBy}
                onValueChange={(val) => {
                  setSortBy(val);
                }}
                placeholder="Sort batches..."
                dark={isDark}
              />
            </div>

            {hasActiveFilters && (
              <div className="pt-1 flex justify-end">
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                >
                  <X className="size-3" />
                  <span>Clear Filters</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Desktop Inline Filter Bar (>= 1024px) */}
      <div className="hidden lg:flex items-center gap-2.5 p-3 rounded-2xl border bg-white dark:bg-zinc-950 border-slate-200/80 dark:border-zinc-800 shadow-xs">
        <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 focus-within:border-cyan-500">
          <Search className="size-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
            }}
            placeholder="Search by cutting number, garment name, or notes..."
            className="bg-transparent outline-none w-full text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
              }}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="w-56 shrink-0">
          <DateRangePicker
            date={dateRange}
            onDateChange={(range) => {
              setDateRange(range);
            }}
            placeholder="Filter date..."
          />
        </div>

        <div className="w-48 shrink-0">
          <SearchableSelect
            options={productFilterOptions}
            value={selectedProductFilter}
            onValueChange={(val) => {
              setSelectedProductFilter(val);
            }}
            placeholder="All Garments"
            searchPlaceholder="Filter style..."
            dark={isDark}
          />
        </div>

        <div className="w-44 shrink-0">
          <SearchableSelect
            options={sortOptions}
            value={sortBy}
            onValueChange={(val) => {
              setSortBy(val);
            }}
            placeholder="Sort order..."
            dark={isDark}
          />
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-900/40 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors shrink-0"
            title="Reset active filters"
          >
            <X className="size-3.5" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* ── Main Content: Desktop Table & Mobile Cards ── */}
      {loading ? (
        <div className="py-16 text-center bg-white dark:bg-zinc-950 rounded-2xl border border-slate-200/80 dark:border-zinc-800">
          <Loader2 className="w-7 h-7 mx-auto animate-spin text-cyan-600 mb-2" />
          <p className="text-xs font-semibold text-slate-600 dark:text-zinc-400">
            Loading batches in wash stage...
          </p>
        </div>
      ) : filteredBatches.length === 0 ? (
        <div className="py-16 px-4 text-center bg-white dark:bg-zinc-950 rounded-2xl border border-slate-200/80 dark:border-zinc-800 space-y-2">
          <div className="size-12 rounded-2xl bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mx-auto border border-cyan-200 dark:border-cyan-900/50">
            <Waves className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            No Batches Currently in Wash Stage
          </h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto">
            When factory operators finish sewing garments today, they can click "Send to Wash" inside the batch details to hand them over to this washing plant pipeline.
          </p>
          <div className="pt-2">
            <Button
              size="sm"
              onClick={() => navigate('/system/production')}
              className="text-xs bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-semibold"
            >
              Go to Production Batches
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Desktop Table (>= 1024px) */}
          <div className="hidden lg:block rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-x-auto shadow-xs">
            <Table className="w-full min-w-[860px]">
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
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 text-center w-24">
                    Sent to Wash
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 text-center w-28">
                    Washed &amp; Sold
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 w-36">
                    Remaining Progress
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 text-center w-24">
                    Status
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 text-right w-36">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBatches.map((batch) => {
                  const prods = getBatchProducts(batch);
                  const prodsTotalSent = prods.reduce((sum, p) => sum + p.totalSent, 0);
                  const prodsTotalWashed = prods.reduce((sum, p) => sum + p.alreadyWashed, 0);

                  const sent = prodsTotalSent > 0 ? prodsTotalSent : (batch.sentToWashQty || 0);
                  const washed = prodsTotalWashed > 0 ? prodsTotalWashed : (batch.washedQty || 0);
                  const remaining = Math.max(0, sent - washed);
                  const percent = sent > 0 ? Math.min(100, Math.round((washed / sent) * 100)) : 0;

                  return (
                    <TableRow
                      key={batch.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-zinc-900/50 transition-colors cursor-pointer border-b border-slate-100 dark:border-zinc-800/80"
                      onClick={() => {
                        setDetailOrder(batch);
                        setIsDetailModalOpen(true);
                      }}
                    >
                      {/* 1. Batch No (Clean 2-line break) */}
                      <TableCell className="align-middle w-28 min-w-[100px]">
                        <div className="font-mono text-xs text-slate-900 dark:text-white leading-tight block whitespace-nowrap">
                          {(() => {
                            const clean = (batch.productionNo || '').replace(/^#/, '');
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
                      </TableCell>

                      {/* 2. Date & Time (Clean 2-line break) */}
                      <TableCell className="align-middle text-xs font-mono w-28">
                        {renderSriLankaDateTime(batch.productionDate || batch.createdAt)}
                      </TableCell>

                      {/* 3. PRODUCT (Maximized width & single line fallback) */}
                      <TableCell className="align-middle">
                        <div className="space-y-2 py-1">
                          {prods.map((p, idx) => (
                            <div key={idx} className="flex items-center gap-2.5 min-w-0">
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
                                <div className="size-8 rounded-lg bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-900/50 flex items-center justify-center shrink-0 text-cyan-600 dark:text-cyan-400">
                                  <Shirt className="size-4" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-bold text-slate-900 dark:text-white truncate" title={p.productName}>
                                    {p.productName}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className="font-mono text-[10px] font-bold px-1.5 py-0 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 shrink-0"
                                  >
                                    Sent: {p.totalSent} Pcs
                                  </Badge>
                                  <Badge
                                    variant="outline"
                                    className="font-mono text-[10px] font-bold px-1.5 py-0 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 shrink-0"
                                  >
                                    Washed: +{p.alreadyWashed} Pcs
                                  </Badge>
                                  <Badge
                                    variant="outline"
                                    className="font-mono text-[10px] font-bold px-1.5 py-0 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 shrink-0"
                                  >
                                    Remaining: {p.remaining} Pcs
                                  </Badge>
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

                      {/* 4. Sent to Wash */}
                      <TableCell className="align-middle text-center w-24">
                        <span className="text-xs font-mono font-bold text-slate-800 dark:text-zinc-200">
                          {sent} Pcs
                        </span>
                      </TableCell>

                      {/* 5. Washed & In Stock */}
                      <TableCell className="align-middle text-center w-28">
                        <span className="text-xs font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                          +{washed} Pcs
                        </span>
                      </TableCell>

                      {/* 6. Remaining & Progress */}
                      <TableCell className="align-middle w-36">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <span className="font-bold text-amber-600 dark:text-amber-400">
                              {remaining} Pcs Left
                            </span>
                            <span className="text-slate-400 text-[10px]">{percent}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>

                      {/* 7. Status */}
                      <TableCell className="align-middle text-center w-24">
                        <BatchStatusBadge status={batch.status} isStockSynced={batch.isStockSynced} />
                      </TableCell>

                      {/* 8. Action (Standardized 3-dots menu: Send to Stock, History, Delete) */}
                      <TableCell className="align-middle text-right w-44" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            onClick={() => handleOpenLogWashModal(batch)}
                            className="h-8 text-xs bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer px-2.5 shrink-0"
                          >
                            <Package className="w-3.5 h-3.5" />
                            <span>Send to Stock</span>
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setDetailOrder(batch);
                              setIsDetailModalOpen(true);
                            }}
                            className="h-8 w-8 p-0 rounded-xl border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 shrink-0 cursor-pointer shadow-xs"
                            title="View Cutting History"
                            aria-label="View Cutting History"
                          >
                            <Clock className="w-3.5 h-3.5" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 cursor-pointer shrink-0"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuItem
                                onClick={() => handleOpenLogWashModal(batch)}
                                className="cursor-pointer gap-2"
                              >
                                <Package className="w-4 h-4 text-cyan-600" />
                                <span>Send to Stock</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setDetailOrder(batch);
                                  setIsDetailModalOpen(true);
                                }}
                                className="cursor-pointer gap-2"
                              >
                                <Clock className="w-4 h-4 text-slate-500" />
                                <span>History</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setBatchToRollbackWash(batch)}
                                className="cursor-pointer gap-2 text-rose-600 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/30"
                              >
                                <Trash2 className="w-4 h-4 text-rose-600" />
                                <span>Delete (Rollback to Line)</span>
                              </DropdownMenuItem>
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

          {/* Mobile Cards (< 1024px) */}
          <div className="block lg:hidden space-y-3">
            {filteredBatches.map((batch) => {
              const prods = getBatchProducts(batch);
              const prodsTotalSent = prods.reduce((sum, p) => sum + p.totalSent, 0);
              const prodsTotalWashed = prods.reduce((sum, p) => sum + p.alreadyWashed, 0);

              const sent = prodsTotalSent > 0 ? prodsTotalSent : (batch.sentToWashQty || 0);
              const washed = prodsTotalWashed > 0 ? prodsTotalWashed : (batch.washedQty || 0);
              const remaining = Math.max(0, sent - washed);
              const percent = sent > 0 ? Math.min(100, Math.round((washed / sent) * 100)) : 0;

              return (
                <div
                  key={batch.id}
                  className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 shadow-xs space-y-3"
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                        #{batch.productionNo}
                      </span>
                    </div>
                    <BatchStatusBadge status={batch.status} isStockSynced={batch.isStockSynced} />
                  </div>

                  <p className="text-[10px] text-slate-400 font-mono">
                    {formatSriLankaDateTime(batch.productionDate || batch.createdAt)}
                  </p>

                  {/* Garment Details / Products List */}
                  <div className="space-y-2">
                    {prods.map((p, idx) => (
                      <div key={idx} className="flex items-center gap-2.5">
                        {p.imageUrl ? (
                          <img
                            src={p.imageUrl}
                            alt={p.productName}
                            className="size-9 rounded-lg object-cover border border-slate-200 dark:border-zinc-700 shrink-0"
                          />
                        ) : (
                          <div className="size-9 rounded-lg bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-900/50 flex items-center justify-center shrink-0 text-cyan-600 dark:text-cyan-400">
                            <Shirt className="size-4" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {p.productName}
                          </h4>
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            <span className="text-[10px] text-blue-600 font-bold">Sent: {p.totalSent}</span>
                            <span className="text-slate-300">·</span>
                            <span className="text-[10px] text-emerald-600 font-bold">Washed: +{p.alreadyWashed}</span>
                            <span className="text-slate-300">·</span>
                            <span className="text-[10px] text-amber-600 font-bold">Rem: {p.remaining}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Metrics Row */}
                  <div className="grid grid-cols-3 gap-2 text-center p-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800 text-xs">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Sent</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-zinc-200">
                        {sent} Pcs
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-emerald-600 block">Washed</span>
                      <span className="font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                        +{washed} Pcs
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-amber-600 block">Remaining</span>
                      <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                        {remaining} Pcs
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>Washing Treatment Completion</span>
                      <span className="font-bold text-slate-700 dark:text-zinc-300">{percent}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      onClick={() => handleOpenLogWashModal(batch)}
                      className="flex-1 h-8 text-xs bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-xl flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Package className="w-3.5 h-3.5" />
                      <span>Send to Stock</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDetailOrder(batch);
                        setIsDetailModalOpen(true);
                      }}
                      className="h-8 w-8 p-0 rounded-xl border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 shrink-0 cursor-pointer shadow-xs"
                      title="View Cutting History"
                      aria-label="View Cutting History"
                    >
                      <Clock className="w-3.5 h-3.5" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 cursor-pointer shrink-0"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem
                          onClick={() => handleOpenLogWashModal(batch)}
                          className="cursor-pointer gap-2"
                        >
                          <Package className="w-4 h-4 text-cyan-600" />
                          <span>Send to Stock</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setDetailOrder(batch);
                            setIsDetailModalOpen(true);
                          }}
                          className="cursor-pointer gap-2"
                        >
                          <Clock className="w-4 h-4 text-slate-500" />
                          <span>History</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setBatchToRollbackWash(batch)}
                          className="cursor-pointer gap-2 text-rose-600 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/30"
                        >
                          <Trash2 className="w-4 h-4 text-rose-600" />
                          <span>Delete (Rollback to Line)</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: LOG WASHED ITEMS & PARTIAL SELLABLE STOCK SYNC
      ───────────────────────────────────────────────────────────── */}
      <Dialog open={isLogWashModalOpen} onOpenChange={setIsLogWashModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-3xl lg:max-w-4xl max-h-[92vh] flex flex-col p-0 gap-0 rounded-2xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 shadow-2xl">
          {selectedBatch && (() => {
            const products = getBatchProducts(selectedBatch);
            const totalToWashNow = products.reduce((sum, _, idx) => {
              const val = washProductQuantities[idx];
              return sum + (typeof val === 'number' && !isNaN(val) ? val : 0);
            }, 0);

            return (
              <>
                <DialogHeader className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-950 z-10 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="size-9 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 flex items-center justify-center border border-cyan-200 dark:border-cyan-900/50 shadow-xs">
                        <Waves className="w-4 h-4" />
                      </div>
                      <div>
                        <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                          <span>Send to Stock — Batch #{selectedBatch.productionNo}</span>
                          <BatchStatusBadge status={selectedBatch.status} isStockSynced={selectedBatch.isStockSynced} />
                        </DialogTitle>
                        <p className="text-xs text-slate-500 dark:text-zinc-400">
                          {selectedBatch.product?.name} · Multi-Product Ready for Sale Inventory Sync
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-900/60 text-cyan-800 dark:text-cyan-300 shadow-2xs shrink-0">
                      <Package className="size-4 shrink-0 text-cyan-600 dark:text-cyan-400" />
                      <div className="text-right">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
                          READY TO SYNC
                        </div>
                        <div className="text-xs sm:text-sm font-extrabold font-mono leading-none">
                          +{totalToWashNow} Pcs
                        </div>
                      </div>
                    </div>
                  </div>
                </DialogHeader>

                <form onSubmit={handleSubmitWash} className="flex flex-col flex-1 min-h-0">
                  <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                    {/* 1. Date & Time of Wash Inspection (Top Priority) */}
                    <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-zinc-300">
                        <Calendar className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
                        <span>Date &amp; Time of Wash Inspection</span>
                      </div>
                      <DateTimePicker
                        value={washDateTime}
                        onChange={setWashDateTime}
                      />
                    </div>

                    {/* 2. Products List */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                          <Shirt className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                          <span>Garment Products in Washing Pipeline ({products.length})</span>
                        </label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const allRem: Record<number, number | ''> = {};
                            products.forEach((p, idx) => {
                              allRem[idx] = p.remaining;
                            });
                            setWashProductQuantities(allRem);
                          }}
                          className="h-6 text-[11px] font-semibold text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 rounded-lg cursor-pointer"
                        >
                          Fill All Remaining
                        </Button>
                      </div>

                      <div className="space-y-2.5">
                        {products.map((p, idx) => {
                          const currentQty = washProductQuantities[idx];

                          return (
                            <div
                              key={`wash-prod-${p.productId}-${p.variantId || idx}`}
                              className="p-3 bg-slate-50/90 dark:bg-zinc-900/60 rounded-xl border border-slate-200/90 dark:border-zinc-800 space-y-2.5 shadow-2xs"
                            >
                              {/* Top Row: Thumbnail + Product Name (Truncated) + Compact Badges Inline on Right */}
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
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
                                    <div className="size-9 rounded-lg bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-900/50 flex items-center justify-center shrink-0">
                                      <Shirt className="size-4 text-cyan-600 dark:text-cyan-400" />
                                    </div>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <h5
                                      className="text-xs font-bold text-slate-900 dark:text-white truncate whitespace-nowrap"
                                      title={p.productName}
                                    >
                                      {p.productName}
                                    </h5>
                                    {p.sku && (
                                      <span className="text-[10px] text-slate-500 dark:text-zinc-400 block mt-0.5 font-mono truncate">
                                        SKU: {p.sku}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* 3 Metrics Inline on Right */}
                                <div className="flex items-center gap-1.5 text-xs shrink-0">
                                  <div className="px-2 py-1 rounded-lg bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-center">
                                    <span className="text-[9px] uppercase font-bold text-slate-400 block leading-none mb-0.5">
                                      Sent
                                    </span>
                                    <span className="font-mono font-bold text-slate-800 dark:text-zinc-200 leading-none">
                                      {p.totalSent} Pcs
                                    </span>
                                  </div>
                                  <div className="px-2 py-1 rounded-lg bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-center">
                                    <span className="text-[9px] uppercase font-bold text-emerald-600 block leading-none mb-0.5">
                                      Washed
                                    </span>
                                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 leading-none">
                                      +{p.alreadyWashed} Pcs
                                    </span>
                                  </div>
                                  <div className="px-2 py-1 rounded-lg bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-center">
                                    <span className="text-[9px] uppercase font-bold text-amber-600 block leading-none mb-0.5">
                                      Remaining
                                    </span>
                                    <span className="font-mono font-bold text-amber-600 dark:text-amber-400 leading-none">
                                      {p.remaining} Pcs
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Visual Progress Bar for Product (Unified Template) */}
                              {(() => {
                                const pProgressPct = p.totalSent > 0 ? Math.min(100, Math.round((p.alreadyWashed / p.totalSent) * 100)) : 0;
                                return (
                                  <div className="space-y-1 pt-1 border-t border-slate-200/50 dark:border-zinc-800/60">
                                    <div className="flex items-center justify-between text-[10px] font-mono">
                                      <span className="text-slate-500 dark:text-zinc-400">
                                        Washed &amp; Synced: <strong className="text-emerald-600 dark:text-emerald-400">{p.alreadyWashed} / {p.totalSent} Pcs</strong>
                                      </span>
                                      <span className="font-bold text-slate-700 dark:text-zinc-300">{pProgressPct}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-200/80 dark:bg-zinc-800 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full transition-all duration-300 ${
                                          pProgressPct >= 100 ? 'bg-emerald-500' : 'bg-cyan-500'
                                        }`}
                                        style={{ width: `${pProgressPct}%` }}
                                      />
                                    </div>
                                  </div>
                                );
                              })()}

                              {/* Input for Washed Qty Ready for Sale */}
                              <div className="pt-2 border-t border-slate-200/60 dark:border-zinc-800/80 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                                    Washed Qty Ready for Sale:
                                  </label>
                                  {p.remaining > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setWashProductQuantities((prev) => ({
                                          ...prev,
                                          [idx]: p.remaining,
                                        }));
                                      }}
                                      className="text-[10px] text-cyan-600 hover:text-cyan-700 font-semibold underline cursor-pointer"
                                    >
                                      All ({p.remaining})
                                    </button>
                                  )}
                                </div>
                                {p.remaining <= 0 ? (
                                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 py-1">
                                    <CheckCircle2 className="size-4" />
                                    <span>All {p.totalSent} Pcs Washed &amp; Synced</span>
                                  </div>
                                ) : (
                                  <div className="w-32 shrink-0">
                                    <Input
                                      type="number"
                                      min="0"
                                      max={p.remaining}
                                      step="1"
                                      value={currentQty}
                                      onChange={(e) => {
                                        const val = e.target.value === '' ? '' : Math.max(0, Math.min(p.remaining, parseInt(e.target.value) || 0));
                                        setWashProductQuantities((prev) => ({
                                          ...prev,
                                          [idx]: val,
                                        }));
                                      }}
                                      placeholder="0"
                                      className="h-8 text-xs text-right font-mono font-bold text-cyan-700 dark:text-cyan-300 rounded-xl bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 3. Quality Inspection Remarks */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block">
                        Quality Inspection Remarks <span className="text-slate-400 font-normal">(Optional)</span>
                      </label>
                      <Input
                        type="text"
                        value={washNotes}
                        onChange={(e) => setWashNotes(e.target.value)}
                        placeholder="e.g. Washed, dried, pressed, 100% passed QC inspection"
                        className="h-9 text-xs rounded-xl bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800"
                      />
                    </div>
                  </div>

                  <DialogFooter className="px-5 py-3 border-t border-slate-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-950 flex-row justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsLogWashModalOpen(false)}
                      className="text-xs rounded-xl cursor-pointer"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={isSubmittingWash || totalToWashNow <= 0}
                      className="bg-cyan-600 hover:bg-cyan-700 text-white text-xs rounded-xl font-semibold shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isSubmittingWash ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Syncing Stock...</span>
                        </>
                      ) : (
                        <>
                          <Package className="w-3.5 h-3.5" />
                          <span>Increment Sellable Stock (+{totalToWashNow} Pcs)</span>
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      {detailOrder && (
        <CuttingDetailModal
          open={isDetailModalOpen}
          onOpenChange={(op) => {
            setIsDetailModalOpen(op);
            if (!op) setDetailOrder(null);
          }}
          order={detailOrder}
          rawMaterialsList={rawMaterialsList}
          productsList={productsList}
          onOrderUpdate={() => fetchWashBatches()}
          onRefresh={fetchWashBatches}
          dark={isDark}
        />
      )}

      {/* AlertDialog Confirmation for Wash Stage Rollback */}
      <AlertDialog
        open={Boolean(batchToRollbackWash)}
        onOpenChange={(op) => {
          if (!op && !isRollingBackWash) setBatchToRollbackWash(null);
        }}
      >
        <AlertDialogContent className="max-w-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              <span>Delete / Rollback Wash Stage?</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-xs text-slate-600 dark:text-zinc-300">
              <p>
                Are you sure you want to rollback the Washing stage for Cutting No{' '}
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  #{batchToRollbackWash?.batchNumber}
                </span>
                ?
              </p>
              <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-[11px] text-amber-800 dark:text-amber-300 space-y-1">
                <p className="font-semibold">Stage Rollback Impact:</p>
                <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                  <li>Resets all washed quantities logged in this batch.</li>
                  <li>Reverses and deducts any sellable finished product stock increments created from this wash batch.</li>
                  <li>Resets pieces sent to wash back to 0, returning all pieces cleanly to the Sewing Line remaining balance.</li>
                  <li>Transitions cutting order status back to <strong>LINE</strong>.</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isRollingBackWash}
              onClick={() => setBatchToRollbackWash(null)}
              className="text-xs h-8"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isRollingBackWash}
              onClick={handleConfirmRollbackWash}
              className="text-xs h-8 bg-rose-600 hover:bg-rose-700 text-white font-semibold cursor-pointer"
            >
              {isRollingBackWash ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  <span>Rolling Back...</span>
                </>
              ) : (
                'Confirm Rollback to Line'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default WashPage;
