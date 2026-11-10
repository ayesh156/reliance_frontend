import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '../components/ui/button';
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
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../components/ui/dropdown-menu';
import { SearchableSelect, type SearchableSelectOption } from '../components/ui/searchable-select';
import { DateRangePicker, type DateRange } from '../components/ui/date-range-picker';
import { FinishingModal, type FinishingProductItem } from '../components/production/FinishingModal';
import { get, del } from '../lib/api';
import { getProductImageUrl } from '../lib/utils';
import { formatSriLankaDateTime } from '../components/production/CuttingDetailModal';
import { toast } from 'react-toastify';
import {
  Shirt,
  Package,
  Search,
  RotateCcw,
  SlidersHorizontal,
  X,
  Trash2,
  Calendar,
  Layers,
  Sparkles,
  CheckCircle2,
  Filter,
  MoreVertical,
  Pencil,
} from 'lucide-react';

interface FinishingLogItem {
  id: number;
  productId: number;
  actionType: 'IRON' | 'PACK';
  quantity: number;
  date: string;
  createdAt: string;
  updatedAt: string;
  product?: {
    id: number;
    name: string;
    images?: Array<{ imageUrl?: string | null }>;
    variants?: Array<{
      id: number;
      sku: string;
      size?: string | null;
      color?: string | null;
    }>;
  };
}

interface FinishingSummary {
  totalRecords: number;
  todayIroned: number;
  todayPacked: number;
  weekIroned: number;
  weekPacked: number;
  totalIroned: number;
  totalPacked: number;
}

const ACTION_TYPE_OPTIONS: SearchableSelectOption[] = [
  { value: 'ALL', label: 'All Actions (Iron & Pack)', icon: <Layers className="size-3.5 text-slate-400" /> },
  { value: 'IRON', label: 'Ironed (IRON)', icon: <Shirt className="size-3.5 text-blue-500" /> },
  { value: 'PACK', label: 'Packed (PACK)', icon: <Package className="size-3.5 text-emerald-500" /> },
];

export const FinishingPage: React.FC = () => {
  const [logs, setLogs] = useState<FinishingLogItem[]>([]);
  const [summary, setSummary] = useState<FinishingSummary | null>(null);
  const [products, setProducts] = useState<FinishingProductItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalActionType, setModalActionType] = useState<'IRON' | 'PACK'>('IRON');
  const [editingLog, setEditingLog] = useState<FinishingLogItem | null>(null);

  // Deletion Dialog State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [logToDelete, setLogToDelete] = useState<FinishingLogItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Filter States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [selectedProductFilter, setSelectedProductFilter] = useState<string>('ALL');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [activeDatePreset, setActiveDatePreset] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom'>('all');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState<boolean>(false);

  // Fetch Master Products List
  const fetchProducts = useCallback(async () => {
    try {
      const res: any = await get('/products');
      const data = res?.data || res || [];
      if (Array.isArray(data)) {
        setProducts(data);
      }
    } catch (err: any) {
      console.error('Failed to load products list:', err);
    }
  }, []);

  // Fetch Finishing Logs & Summary
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [logsRes, summaryRes]: [any, any] = await Promise.all([
        get('/finishing'),
        get('/finishing/summary'),
      ]);

      const logList = logsRes?.data || logsRes || [];
      const summaryData = summaryRes?.data || summaryRes || null;

      setLogs(Array.isArray(logList) ? logList : []);
      if (summaryData) {
        setSummary(summaryData);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load finishing logs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchData();
  }, [fetchProducts, fetchData]);

  // Date Preset Handlers
  const applyDatePreset = (preset: 'all' | 'today' | 'yesterday' | 'week' | 'month') => {
    setActiveDatePreset(preset);
    const now = new Date();

    if (preset === 'all') {
      setDateRange(undefined);
      return;
    }

    if (preset === 'today') {
      const from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      setDateRange({ from, to });
      return;
    }

    if (preset === 'yesterday') {
      const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const from = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0, 0);
      const to = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59, 999);
      setDateRange({ from, to });
      return;
    }

    if (preset === 'week') {
      const day = now.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday, 0, 0, 0, 0);
      const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      setDateRange({ from, to });
      return;
    }

    if (preset === 'month') {
      const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      setDateRange({ from, to });
      return;
    }
  };

  const handleCustomDateRangeChange = (range: DateRange | undefined) => {
    setDateRange(range);
    setActiveDatePreset('custom');
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setActionFilter('ALL');
    setSelectedProductFilter('ALL');
    setDateRange(undefined);
    setActiveDatePreset('all');
  };

  // Product Filter Combobox Options
  const productFilterOptions: SearchableSelectOption[] = useMemo(() => {
    return [
      { value: 'ALL', label: 'All Products', icon: <Layers className="size-3.5 text-slate-400" /> },
      ...products.map((p) => {
        const rawImg = p.images?.[0]?.imageUrl;
        const resolvedUrl = rawImg ? getProductImageUrl(rawImg) : undefined;
        return {
          value: String(p.id),
          label: p.name,
          imageUrl: resolvedUrl,
          icon: <Shirt className="size-3.5 text-slate-400" />,
        };
      }),
    ];
  }, [products]);

  // Active Filter Count for Mobile Pill
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (actionFilter !== 'ALL') count++;
    if (selectedProductFilter !== 'ALL') count++;
    if (dateRange?.from || dateRange?.to) count++;
    return count;
  }, [searchQuery, actionFilter, selectedProductFilter, dateRange]);

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    let list = [...logs];

    // 1. Action Type Filter
    if (actionFilter !== 'ALL') {
      list = list.filter((item) => item.actionType === actionFilter);
    }

    // 2. Product Filter
    if (selectedProductFilter !== 'ALL') {
      const pId = Number(selectedProductFilter);
      list = list.filter((item) => item.productId === pId);
    }

    // 3. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((item) => {
        const pName = item.product?.name?.toLowerCase() || '';
        const skuList = item.product?.variants?.map((v) => v.sku.toLowerCase()).join(' ') || '';
        return pName.includes(q) || skuList.includes(q);
      });
    }

    // 4. Date Range
    if (dateRange?.from) {
      const fromTime = new Date(dateRange.from).setHours(0, 0, 0, 0);
      const toTime = dateRange.to
        ? new Date(dateRange.to).setHours(23, 59, 59, 999)
        : new Date(dateRange.from).setHours(23, 59, 59, 999);

      list = list.filter((item) => {
        const itemTime = new Date(item.date).getTime();
        return itemTime >= fromTime && itemTime <= toTime;
      });
    }

    return list;
  }, [logs, actionFilter, selectedProductFilter, searchQuery, dateRange]);

  // Totals for filtered list
  const filteredTotals = useMemo(() => {
    let ironQty = 0;
    let packQty = 0;
    filteredLogs.forEach((item) => {
      if (item.actionType === 'IRON') ironQty += item.quantity;
      if (item.actionType === 'PACK') packQty += item.quantity;
    });
    return {
      total: ironQty + packQty,
      iron: ironQty,
      pack: packQty,
    };
  }, [filteredLogs]);

  // Modal Action Handlers
  const handleOpenAddIroned = () => {
    setEditingLog(null);
    setModalActionType('IRON');
    setIsModalOpen(true);
  };

  const handleOpenAddPacked = () => {
    setEditingLog(null);
    setModalActionType('PACK');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (log: FinishingLogItem) => {
    setEditingLog(log);
    setModalActionType(log.actionType);
    setIsModalOpen(true);
  };

  // Delete Log Mutation
  const handleConfirmDelete = async () => {
    if (!logToDelete) return;
    setIsDeleting(true);
    try {
      await del(`/finishing/${logToDelete.id}`);
      toast.success('Finishing record removed successfully');
      setDeleteDialogOpen(false);
      setLogToDelete(null);
      fetchData();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete record');
    } finally {
      setIsDeleting(false);
    }
  };

  const renderDateTimeCell = (dateStr: string) => {
    const formatted = formatSriLankaDateTime(dateStr);
    if (!formatted || formatted === '—') return <span className="text-slate-400">—</span>;
    const firstSpaceIndex = formatted.indexOf(' ');
    if (firstSpaceIndex === -1) return <span>{formatted}</span>;
    const datePart = formatted.substring(0, firstSpaceIndex);
    const timePart = formatted.substring(firstSpaceIndex + 1);
    return (
      <div className="flex flex-col leading-tight whitespace-nowrap">
        <span className="font-semibold text-slate-800 dark:text-zinc-200">{datePart}</span>
        <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-400">{timePart}</span>
      </div>
    );
  };

  return (
    <div className="space-y-5 pb-12 w-full">
      {/* ── Page Header & Top Dual Action Buttons ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 dark:border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
              <Sparkles className="size-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>Finishing Production</span>
            </h1>
            <Badge
              variant="outline"
              className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60"
            >
              Ironing &amp; Packing
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Track post-wash garment pressing, quality checking, folding, and final packing production.
          </p>
        </div>

        {/* Dual Action Buttons (Clean terms: "Add Ironed" and "Add Packed") */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          {/* Button 1: Add Ironed */}
          <Button
            onClick={handleOpenAddIroned}
            className="flex-1 sm:flex-none h-10 px-4 gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs cursor-pointer transition-all active:scale-[0.98]"
          >
            <Shirt className="size-4" />
            <span>Add Ironed</span>
          </Button>

          {/* Button 2: Add Packed */}
          <Button
            onClick={handleOpenAddPacked}
            className="flex-1 sm:flex-none h-10 px-4 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs cursor-pointer transition-all active:scale-[0.98]"
          >
            <Package className="size-4" />
            <span>Add Packed</span>
          </Button>

          {/* Refresh Action */}
          <Button
            variant="outline"
            size="icon"
            onClick={fetchData}
            disabled={loading}
            title="Refresh logs"
            className="size-10 rounded-xl border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-900 shrink-0 cursor-pointer"
          >
            <RotateCcw className={`size-4 text-slate-600 dark:text-zinc-400 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* ── KPI Summary Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full">
        {/* Card 1: Ironed in Period / Today */}
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                {dateRange?.from ? 'Ironed in Period' : 'Ironed Today'}
              </span>
              <h3 className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1 font-mono">
                {(dateRange?.from ? filteredTotals.iron : (summary?.todayIroned ?? filteredTotals.iron)).toLocaleString()}{' '}
                <span className="text-xs font-normal text-slate-500">Pcs</span>
              </h3>
            </div>
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl shrink-0">
              <Shirt className="size-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-2">
            {dateRange?.from ? (
              <>Strict Log Sum: <strong className="font-mono text-slate-700 dark:text-zinc-300">{filteredTotals.iron.toLocaleString()}</strong> Pcs</>
            ) : (
              <>This Week: <strong className="font-mono text-slate-700 dark:text-zinc-300">{(summary?.weekIroned ?? 0).toLocaleString()}</strong> Pcs</>
            )}
          </p>
        </div>

        {/* Card 2: Packed in Period / Today */}
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                {dateRange?.from ? 'Packed in Period' : 'Packed Today'}
              </span>
              <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                {(dateRange?.from ? filteredTotals.pack : (summary?.todayPacked ?? filteredTotals.pack)).toLocaleString()}{' '}
                <span className="text-xs font-normal text-slate-500">Pcs</span>
              </h3>
            </div>
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl shrink-0">
              <Package className="size-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-2">
            {dateRange?.from ? (
              <>Strict Log Sum: <strong className="font-mono text-slate-700 dark:text-zinc-300">{filteredTotals.pack.toLocaleString()}</strong> Pcs</>
            ) : (
              <>This Week: <strong className="font-mono text-slate-700 dark:text-zinc-300">{(summary?.weekPacked ?? 0).toLocaleString()}</strong> Pcs</>
            )}
          </p>
        </div>

        {/* Card 3: Total Ironed */}
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                {dateRange?.from ? 'Total Filtered Ironed' : 'Total Ironed'}
              </span>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-zinc-100 mt-1 font-mono">
                {(dateRange?.from ? filteredTotals.iron : (summary?.totalIroned ?? filteredTotals.iron)).toLocaleString()}{' '}
                <span className="text-xs font-normal text-slate-500">Pcs</span>
              </h3>
            </div>
            <div className="p-2.5 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-xl shrink-0">
              <CheckCircle2 className="size-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-2">
            {dateRange?.from ? 'Event-specific date boundary' : 'Historical Ironed Garments Output'}
          </p>
        </div>

        {/* Card 4: Total Packed */}
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                {dateRange?.from ? 'Total Filtered Packed' : 'Total Packed'}
              </span>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-zinc-100 mt-1 font-mono">
                {(dateRange?.from ? filteredTotals.pack : (summary?.totalPacked ?? filteredTotals.pack)).toLocaleString()}{' '}
                <span className="text-xs font-normal text-slate-500">Pcs</span>
              </h3>
            </div>
            <div className="p-2.5 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-xl shrink-0">
              <Layers className="size-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-2">
            {dateRange?.from ? 'Event-specific date boundary' : 'Historical Boxed / Packed Garments Output'}
          </p>
        </div>
      </div>

      {/* ── Advanced Filter Section (Cutting & Wash Pattern) ── */}
      <div className="rounded-2xl border bg-white dark:bg-zinc-900/60 border-slate-200/80 dark:border-zinc-800 p-4 shadow-xs space-y-3.5">
        {/* Top Filter Bar: Search + Action Type Selector + Mobile Toggle */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
          {/* Search Input */}
          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 focus-within:border-indigo-500 dark:focus-within:border-indigo-500 transition-colors">
            <Search className="size-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by product name, SKU..."
              className="bg-transparent outline-none w-full text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Action Type Dropdown (Essential for Evening Shift Reports) */}
          <div className="w-full sm:w-64 shrink-0">
            <SearchableSelect
              options={ACTION_TYPE_OPTIONS}
              value={actionFilter}
              onValueChange={setActionFilter}
              placeholder="Filter by action..."
              searchPlaceholder="Filter action..."
            />
          </div>

          {/* Product Filter */}
          <div className="hidden lg:block w-64 shrink-0">
            <SearchableSelect
              options={productFilterOptions}
              value={selectedProductFilter}
              onValueChange={setSelectedProductFilter}
              placeholder="All Products"
              searchPlaceholder="Filter by product..."
            />
          </div>

          {/* Date Range Picker (Desktop Inline) */}
          <div className="hidden lg:block w-56 shrink-0">
            <DateRangePicker
              date={dateRange}
              onDateChange={handleCustomDateRangeChange}
              placeholder="Filter date range..."
            />
          </div>

          {/* Mobile Filters Drawer Button (<1024px) */}
          <button
            type="button"
            onClick={() => setMobileFiltersOpen((prev) => !prev)}
            className={`lg:hidden flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              mobileFiltersOpen || activeFilterCount > 0
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/50 dark:border-indigo-800 dark:text-indigo-300'
                : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300'
            }`}
          >
            <SlidersHorizontal className="size-4" />
            <span>Additional Filters</span>
            {activeFilterCount > 0 && (
              <span className="flex items-center justify-center size-5 rounded-full bg-indigo-600 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Quick Date Range Preset Pills */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-slate-100 dark:border-zinc-800/80">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
              <Calendar className="size-3" /> Quick Filter:
            </span>
            <button
              type="button"
              onClick={() => applyDatePreset('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                activeDatePreset === 'all'
                  ? 'bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
              }`}
            >
              All Time
            </button>
            <button
              type="button"
              onClick={() => applyDatePreset('today')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                activeDatePreset === 'today'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => applyDatePreset('yesterday')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                activeDatePreset === 'yesterday'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
              }`}
            >
              Yesterday
            </button>
            <button
              type="button"
              onClick={() => applyDatePreset('week')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                activeDatePreset === 'week'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
              }`}
            >
              This Week
            </button>
            <button
              type="button"
              onClick={() => applyDatePreset('month')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                activeDatePreset === 'month'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
              }`}
            >
              This Month
            </button>
          </div>

          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <X className="size-3.5" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        {/* Collapsible Mobile Drawer for Product & Date Range (<1024px) */}
        {mobileFiltersOpen && (
          <div className="lg:hidden pt-3 border-t border-slate-100 dark:border-zinc-800 space-y-3 animate-in fade-in-50 duration-150">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                Product Filter
              </label>
              <SearchableSelect
                options={productFilterOptions}
                value={selectedProductFilter}
                onValueChange={setSelectedProductFilter}
                placeholder="All Products"
                searchPlaceholder="Filter by product..."
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                Date Range Filter
              </label>
              <DateRangePicker
                date={dateRange}
                onDateChange={handleCustomDateRangeChange}
                placeholder="Select date range..."
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Filtered Summary Banner ── */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-zinc-900 rounded-xl border border-slate-200/60 dark:border-zinc-800 text-xs text-slate-600 dark:text-zinc-300">
        <div className="flex items-center gap-4 flex-wrap">
          <span>
            Showing <strong className="font-mono text-slate-900 dark:text-white">{filteredLogs.length}</strong>{' '}
            record{filteredLogs.length === 1 ? '' : 's'}
          </span>
          <span className="text-slate-300 dark:text-zinc-700">•</span>
          <span>
            Total Output: <strong className="font-mono text-indigo-600 dark:text-indigo-400">{filteredTotals.total.toLocaleString()}</strong> Pcs
          </span>
          {filteredTotals.iron > 0 && (
            <>
              <span className="text-slate-300 dark:text-zinc-700">•</span>
              <span className="text-blue-600 dark:text-blue-400">
                Ironed: <strong className="font-mono">{filteredTotals.iron.toLocaleString()}</strong> Pcs
              </span>
            </>
          )}
          {filteredTotals.pack > 0 && (
            <>
              <span className="text-slate-300 dark:text-zinc-700">•</span>
              <span className="text-emerald-600 dark:text-emerald-400">
                Packed: <strong className="font-mono">{filteredTotals.pack.toLocaleString()}</strong> Pcs
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── Main Content: Desktop Table (>=md) & Mobile Card Views (<md) ── */}
      {loading ? (
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-12 text-center shadow-xs">
          <div className="flex flex-col items-center justify-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
            <div className="size-6 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
            <span>Loading finishing records...</span>
          </div>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-8 sm:p-12 text-center shadow-xs">
          <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
            <div className="p-3 bg-slate-100 dark:bg-zinc-900 rounded-full text-slate-400">
              <Filter className="size-6" />
            </div>
            <h4 className="text-sm font-semibold text-slate-800 dark:text-zinc-200 mt-1">
              No finishing records found
            </h4>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              {activeFilterCount > 0
                ? 'Try adjusting your filters or search query to find records.'
                : 'Start logging ironed and packed garments using the top action buttons.'}
            </p>
            {activeFilterCount > 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                className="mt-2 text-xs rounded-xl"
              >
                Clear Filters
              </Button>
            ) : (
              <div className="flex items-center gap-2 mt-2">
                <Button
                  size="sm"
                  onClick={handleOpenAddIroned}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-xl"
                >
                  + Add Ironed
                </Button>
                <Button
                  size="sm"
                  onClick={handleOpenAddPacked}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-xl"
                >
                  + Add Packed
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* 1. Desktop & Tablet Unified Table (>= md: 768px) */}
          <div className="hidden md:block rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xs overflow-hidden">
            <div className="overflow-x-auto min-w-full">
              <Table className="w-full min-w-[640px]">
                <TableHeader className="bg-slate-50/80 dark:bg-zinc-900/60">
                  <TableRow className="border-b border-slate-200 dark:border-zinc-800 hover:bg-transparent">
                    <TableHead className="w-44 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 py-3 pl-4">
                      Date / Time
                    </TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 py-3">
                      Product
                    </TableHead>
                    <TableHead className="w-36 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 py-3 text-center">
                      Action
                    </TableHead>
                    <TableHead className="w-32 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 py-3 text-right">
                      Quantity
                    </TableHead>
                    <TableHead className="w-20 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 py-3 text-right pr-4">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => {
                    const isIronAction = log.actionType === 'IRON';
                    const rawImg = log.product?.images?.[0]?.imageUrl;
                    const resolvedImg = rawImg ? getProductImageUrl(rawImg) : null;

                    return (
                      <TableRow
                        key={log.id}
                        className="border-b border-slate-100 dark:border-zinc-800/80 hover:bg-slate-50/60 dark:hover:bg-zinc-900/40 transition-colors"
                      >
                        {/* Column 1: Date & Time */}
                        <TableCell className="py-3 pl-4 text-xs">
                          {renderDateTimeCell(log.date || log.createdAt)}
                        </TableCell>

                        {/* Column 2: Product (with Thumbnail Image) */}
                        <TableCell className="py-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {resolvedImg ? (
                              <img
                                src={resolvedImg}
                                alt={log.product?.name || 'Product'}
                                loading="lazy"
                                className="size-9 rounded-lg object-cover border border-slate-200 dark:border-zinc-800 shrink-0 bg-slate-50 dark:bg-zinc-900"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="size-9 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-900 flex items-center justify-center shrink-0 text-slate-400">
                                <Shirt className="size-4" />
                              </div>
                            )}
                            <div className="min-w-0 truncate">
                              <span className="font-semibold text-xs text-slate-900 dark:text-zinc-100 truncate block">
                                {log.product?.name || `Product #${log.productId}`}
                              </span>
                              {log.product?.variants && log.product.variants.length > 0 && (
                                <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono truncate block">
                                  SKU: {log.product.variants[0].sku}
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* Column 3: Action Badge (Blue for IRON, Green for PACK) */}
                        <TableCell className="py-3 text-center">
                          {isIronAction ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/80 dark:border-blue-900/50">
                              <Shirt className="size-3" />
                              <span>IRON</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-900/50">
                              <Package className="size-3" />
                              <span>PACK</span>
                            </span>
                          )}
                        </TableCell>

                        {/* Column 4: Quantity */}
                        <TableCell className="py-3 text-right">
                          <span className="font-mono font-bold text-xs text-slate-900 dark:text-zinc-100">
                            {log.quantity.toLocaleString()}
                          </span>{' '}
                          <span className="text-[11px] text-slate-500 dark:text-zinc-400">Pcs</span>
                        </TableCell>

                        {/* Column 5: Actions (3-dots Dropdown) */}
                        <TableCell className="py-3 text-right pr-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                aria-label="Finishing Actions"
                                className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
                              >
                                <MoreVertical className="size-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40 rounded-xl shadow-xl">
                              <DropdownMenuItem
                                onClick={() => handleOpenEdit(log)}
                                className="cursor-pointer gap-2 text-xs font-medium"
                              >
                                <Pencil className="size-3.5 text-amber-600" />
                                <span>Edit</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => {
                                  setLogToDelete(log);
                                  setDeleteDialogOpen(true);
                                }}
                                className="cursor-pointer gap-2 text-xs font-medium text-rose-600 dark:text-rose-400 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/50"
                              >
                                <Trash2 className="size-3.5 text-rose-600" />
                                <span>Delete</span>
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
          </div>

          {/* 2. Mobile Clean Modern Card View (< md: 768px) */}
          <div className="block md:hidden space-y-3">
            {filteredLogs.map((log) => {
              const isIronAction = log.actionType === 'IRON';
              const rawImg = log.product?.images?.[0]?.imageUrl;
              const resolvedImg = rawImg ? getProductImageUrl(rawImg) : null;

              return (
                <div
                  key={log.id}
                  className="p-3.5 rounded-2xl bg-white dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 shadow-xs space-y-3 transition-shadow hover:shadow-sm"
                >
                  {/* Top Row: Product Thumbnail, Title, Variant SKU & Action Badge */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      {resolvedImg ? (
                        <img
                          src={resolvedImg}
                          alt={log.product?.name || 'Product'}
                          loading="lazy"
                          className="size-11 rounded-xl object-cover border border-slate-200 dark:border-zinc-800 shrink-0 bg-slate-50 dark:bg-zinc-900"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="size-11 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-900 flex items-center justify-center shrink-0 text-slate-400">
                          <Shirt className="size-5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-zinc-100 truncate">
                          {log.product?.name || `Product #${log.productId}`}
                        </h4>
                        {log.product?.variants && log.product.variants.length > 0 ? (
                          <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono truncate block mt-0.5">
                            SKU: {log.product.variants[0].sku}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono truncate block mt-0.5">
                            ID: #{log.productId}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Badge */}
                    <div className="shrink-0">
                      {isIronAction ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/80 dark:border-blue-900/50">
                          <Shirt className="size-3" />
                          <span>IRON</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-900/50">
                          <Package className="size-3" />
                          <span>PACK</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quantity & Date/Time Metrics Bar */}
                  <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                        Quantity
                      </span>
                      <span className="font-mono font-bold text-sm text-slate-900 dark:text-zinc-100">
                        {log.quantity.toLocaleString()}
                      </span>{' '}
                      <span className="text-[11px] text-slate-500 dark:text-zinc-400">Pcs</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                        Date &amp; Time
                      </span>
                      <span className="font-mono text-xs text-slate-700 dark:text-zinc-300 block">
                        {formatSriLankaDateTime(log.date || log.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Card Footer: Record identifier and 3-dots Action Menu */}
                  <div className="flex items-center justify-between pt-0.5 text-xs">
                    <span className="text-[10px] text-slate-400 font-mono">
                      Record #{log.id}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label="Finishing Actions"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer text-xs font-medium"
                        >
                          <MoreVertical className="size-3.5" />
                          <span>Actions</span>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40 rounded-xl shadow-xl">
                        <DropdownMenuItem
                          onClick={() => handleOpenEdit(log)}
                          className="cursor-pointer gap-2 text-xs font-medium"
                        >
                          <Pencil className="size-3.5 text-amber-600" />
                          <span>Edit</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => {
                            setLogToDelete(log);
                            setDeleteDialogOpen(true);
                          }}
                          className="cursor-pointer gap-2 text-xs font-medium text-rose-600 dark:text-rose-400 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/50"
                        >
                          <Trash2 className="size-3.5 text-rose-600" />
                          <span>Delete</span>
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

      {/* ── Modal for Adding / Editing Ironed & Packed Garments ── */}
      <FinishingModal
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingLog(null);
        }}
        actionType={modalActionType}
        onSuccess={fetchData}
        products={products}
        editData={editingLog}
      />

      {/* ── Delete Confirmation Dialog ── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-2xl max-w-md bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-slate-900 dark:text-zinc-100">
              Delete Finishing Record?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-500 dark:text-zinc-400">
              Are you sure you want to delete this record of{' '}
              <strong className="text-slate-700 dark:text-zinc-300">
                {logToDelete?.quantity.toLocaleString()} Pcs
              </strong>{' '}
              ({logToDelete?.actionType === 'IRON' ? 'Ironed' : 'Packed'}) for{' '}
              <strong className="text-slate-700 dark:text-zinc-300">
                {logToDelete?.product?.name || 'this product'}
              </strong>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2">
            <AlertDialogCancel
              disabled={isDeleting}
              className="text-xs rounded-xl font-medium"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmDelete();
              }}
              disabled={isDeleting}
              className="text-xs rounded-xl font-semibold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
            >
              {isDeleting ? 'Deleting...' : 'Yes, Delete Record'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default FinishingPage;
