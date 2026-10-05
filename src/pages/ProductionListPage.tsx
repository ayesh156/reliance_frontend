import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
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
import { SearchableSelect, type SearchableSelectOption } from '../components/ui/searchable-select';
import { DateRangePicker, type DateRange } from '../components/ui/date-range-picker';
import { get, put, del } from '../lib/api';
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

export const ProductionListPage: React.FC = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const dark = theme === 'dark';

  // Unified Date Range Filter (Defaults to current month)
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return { from: startOfMonth, to: endOfMonth };
  });

  // Search & Product Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProductFilter, setSelectedProductFilter] = useState<string>('all');

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
      materialName: string;
      unit: string;
      issuedQty: number;
      currentReturnedQty: number;
      netConsumed: number;
      additionalReturnQty: number | '';
      returnReason: string;
    }>
  >([]);
  const [isSubmittingReturns, setIsSubmittingReturns] = useState(false);

  // Helper to format Date to YYYY-MM-DD
  const formatDateToYMD = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Fetch master products for combobox filter
  const fetchProducts = useCallback(async () => {
    try {
      const prodRes = await get<any>('/products');
      const prods = prodRes?.data || prodRes || [];
      setProductsList(prods);
    } catch (err: any) {
      console.error('Error fetching products catalog:', err);
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
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    setDateRange({ from: startOfMonth, to: endOfMonth });
    setCurrentPage(1);
  };

  // Product Combobox Options
  const productFilterOptions: SearchableSelectOption[] = useMemo(() => [
    { value: 'all', label: 'All Products' },
    ...productsList.map((p) => ({
      value: String(p.id),
      label: p.name,
    })),
  ], [productsList]);

  // Client-side search filtering on records
  const filteredRecords = useMemo(() => {
    if (!summaryData?.records) return [];
    if (!searchQuery.trim()) return summaryData.records;

    const q = searchQuery.toLowerCase();
    return summaryData.records.filter(
      (r) =>
        r.productionNo.toLowerCase().includes(q) ||
        r.product.name.toLowerCase().includes(q) ||
        (r.reason && r.reason.toLowerCase().includes(q)) ||
        (r.variant?.sku && r.variant.sku.toLowerCase().includes(q)) ||
        (r.variant?.size && r.variant.size.toLowerCase().includes(q)) ||
        (r.variant?.color && r.variant.color.toLowerCase().includes(q))
    );
  }, [summaryData, searchQuery]);

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

  // Live Recalculated KPI Metrics
  const liveMetrics = useMemo(() => {
    const totalOutput = filteredRecords.reduce((acc, r) => acc + (r.completedQty || 0), 0);
    const activeBatches = filteredRecords.length;
    const netMaterialConsumed = filteredRecords.reduce((acc, r) => {
      return acc + (r.materialUsages || []).reduce((sub, u) => sub + (u.netConsumedQty || 0), 0);
    }, 0);

    return {
      totalOutput,
      activeBatches,
      netMaterialConsumed: Number(netMaterialConsumed.toFixed(2)),
      todayOutput: summaryData?.metrics?.todayOutput ?? 0,
    };
  }, [filteredRecords, summaryData?.metrics]);

  // Pagination slice
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage) || 1;
  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Open return modal for specific order
  const handleOpenReturnModal = (order: ProductionOrder) => {
    setSelectedOrder(order);
    setReturnFormLines(
      order.materialUsages.map((u) => ({
        usageId: u.id,
        materialName: u.rawMaterial.name,
        unit: u.rawMaterial.unit,
        issuedQty: u.issuedQty,
        currentReturnedQty: u.returnedQty,
        netConsumed: u.netConsumedQty,
        additionalReturnQty: '',
        returnReason: '',
      }))
    );
    setIsReturnModalOpen(true);
  };

  // Submit returned materials
  const handleSubmitReturns = async () => {
    if (!selectedOrder) return;

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Production &amp; Inventory
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Garment Manufacturing Runs, Material Yardage Tracking &amp; Stock Sync
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={fetchProductionData}
            title="Refresh Ledger"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            onClick={() => navigate('/system/production/new')}
            className="gap-2 bg-slate-900 hover:bg-slate-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 shadow-xs cursor-pointer"
          >
            <Plus className="size-4" /> New Production Run
          </Button>
        </div>
      </div>

      {/* ── KPI Metrics Cards (Strictly Matching Heights with Sleek Completed Garments Widget) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        {/* Metric 1: Total Completed Output */}
        <div className="rounded-2xl border p-4 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between min-h-[125px]">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Total Output</span>
              <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                {liveMetrics.totalOutput.toLocaleString()} <span className="text-xs font-medium text-slate-500">Pcs</span>
              </h3>
            </div>
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl shrink-0">
              <CheckCircle2 className="size-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-2">
            Across {liveMetrics.activeBatches} active run{liveMetrics.activeBatches === 1 ? '' : 's'}
          </p>
        </div>

        {/* Metric 2: Net Material Consumed */}
        <div className="rounded-2xl border p-4 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between min-h-[125px]">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Material Consumed</span>
              <h3 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1 font-mono">
                {liveMetrics.netMaterialConsumed.toLocaleString()} <span className="text-xs font-medium text-slate-500">Units</span>
              </h3>
            </div>
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl shrink-0">
              <Layers className="size-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-2">
            Net fabric &amp; raw materials used
          </p>
        </div>

        {/* Metric 3: Active Production Batches */}
        <div className="rounded-2xl border p-4 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between min-h-[125px]">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Active Batches</span>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1 font-mono">
                {liveMetrics.activeBatches} <span className="text-xs font-medium text-slate-500">Runs</span>
              </h3>
            </div>
            <div className="p-2.5 bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 rounded-xl shrink-0">
              <Factory className="size-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-2">
            Filtered in active date range
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

      {/* ── Responsive Filter & Search Toolbar (Streamlined without redundant tabs) ── */}
      <div className="p-4 rounded-2xl border bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search Input: flex-1 w-full occupies all remaining horizontal space */}
          <div className="relative flex-1 w-full flex items-center">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 w-full focus-within:border-slate-400 dark:focus-within:border-zinc-600 transition-colors">
              <Search className="size-4 text-zinc-400 shrink-0" />
              <input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search by batch #, product, SKU, variant, reason..."
                className="bg-transparent outline-none w-full text-xs text-slate-900 dark:text-zinc-100 placeholder:text-zinc-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setCurrentPage(1);
                  }}
                  className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Unified Date Range Picker & Searchable Product Combobox */}
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {/* Shadcn Date Range Picker */}
            <div className="w-full sm:w-64">
              <DateRangePicker
                date={dateRange}
                onDateChange={handleDateRangeChange}
                placeholder="Filter by date range..."
              />
            </div>

            {/* Searchable Product Combobox */}
            <div className="w-full sm:w-56">
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

            {/* Reset Filters Button */}
            {(searchQuery || selectedProductFilter !== 'all' || dateRange !== undefined) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="h-9 px-2.5 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 shrink-0 cursor-pointer"
                title="Reset all filters"
              >
                <X className="size-3.5 mr-1" /> Reset
              </Button>
            )}
          </div>
        </div>
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
              onClick={() => navigate('/system/production/new')}
              variant="outline"
              size="sm"
              className="text-xs rounded-xl cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Start First Production Run
            </Button>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Product &amp; Variant</TableHead>
                  <TableHead>Batch Type / Reason</TableHead>
                  <TableHead className="text-center">Completed Output</TableHead>
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
                      {/* Clickable Batch # leading to edit page */}
                      <TableCell className="font-mono text-xs font-bold">
                        <button
                          type="button"
                          onClick={() => navigate(`/system/production/edit/${order.id}`)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700 font-mono text-xs transition-colors cursor-pointer group"
                        >
                          <span>{order.productionNo}</span>
                          <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
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

                      {/* Output Completed */}
                      <TableCell className="text-center">
                        <span className="inline-flex items-center gap-1 font-bold text-sm text-emerald-600 dark:text-emerald-400 font-mono">
                          {order.completedQty} <span className="text-[11px] font-normal text-slate-500">Pcs</span>
                        </span>
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
                        <Badge
                          variant={order.status === 'COMPLETED' ? 'success' : 'secondary'}
                          dot
                        >
                          {order.status}
                        </Badge>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit Full Page */}
                          <button
                            type="button"
                            onClick={() => navigate(`/system/production/edit/${order.id}`)}
                            title="Edit Production Batch"
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400 transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          {/* View Detail */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedOrder(order);
                              setIsDetailModalOpen(true);
                            }}
                            title="View Material Breakdown"
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400 transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Return Leftovers */}
                          <button
                            type="button"
                            onClick={() => handleOpenReturnModal(order)}
                            title="Return Leftover Scrap Materials"
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400 transition-colors cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>

                          {/* Rollback / Delete */}
                          <button
                            type="button"
                            onClick={() => setOrderToDelete(order)}
                            title="Rollback &amp; Delete Batch"
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-rose-500 hover:text-rose-600 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

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
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 p-6 rounded-2xl">
          <DialogHeader className="border-b border-slate-100 dark:border-zinc-800 pb-3 shrink-0">
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
            <div className="pt-2 shrink-0">
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
          <div className="flex-1 overflow-y-auto space-y-2.5 py-3 pr-1">
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
                    className={`p-3 rounded-xl border transition-all ${
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

          <DialogFooter className="pt-3 border-t border-slate-100 dark:border-zinc-800 shrink-0">
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
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 p-6 rounded-2xl">
          <DialogHeader className="border-b border-slate-100 dark:border-zinc-800 pb-3">
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-500" />
              Production Batch #{selectedOrder?.productionNo}
            </DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4 pt-2">
              {/* Top Overview Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-zinc-900/60 p-3.5 rounded-xl border border-slate-200/80 dark:border-zinc-800">
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
                <div className="p-3 bg-slate-50/70 dark:bg-zinc-900/50 rounded-xl text-xs text-slate-600 dark:text-zinc-400 border border-slate-200/60 dark:border-zinc-800/60">
                  <strong className="text-slate-900 dark:text-white block mb-0.5">Notes:</strong>
                  {selectedOrder.notes}
                </div>
              )}

              {/* Material Usages Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Raw Material Consumption Details
                </h4>

                <div className="rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
                  <Table>
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
            </div>
          )}

          <DialogFooter className="pt-3 border-t border-slate-100 dark:border-zinc-800">
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
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 p-6 rounded-2xl">
          <DialogHeader className="border-b border-slate-100 dark:border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <RotateCcw className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">
                  Return Leftover Materials to Inventory
                </DialogTitle>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Batch #{selectedOrder?.productionNo} — Scrap will be restored directly to warehouse stock
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 pt-3">
            <div className="space-y-3">
              {returnFormLines.map((line, idx) => (
                <div
                  key={line.usageId}
                  className="p-3.5 bg-slate-50 dark:bg-zinc-900/60 rounded-xl border border-slate-200/80 dark:border-zinc-800 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        {line.materialName}
                      </h4>
                      <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                        Issued: {line.issuedQty} {line.unit} | Previously Returned:{' '}
                        {line.currentReturnedQty} {line.unit} | Net Consumed:{' '}
                        <strong className="font-mono">
                          {line.netConsumed} {line.unit}
                        </strong>
                      </span>
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
                        max={line.netConsumed}
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
                        placeholder={`Max ${line.netConsumed} ${line.unit}`}
                        className="h-8 text-xs rounded-lg bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800"
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

          <DialogFooter className="pt-3 border-t border-slate-100 dark:border-zinc-800 gap-2">
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
              className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 font-semibold text-xs rounded-xl shadow-sm flex items-center gap-2"
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
          ALERT DIALOG: ROLLBACK & DELETE PRODUCTION RUN
      ───────────────────────────────────────────────────────────── */}
      <AlertDialog open={Boolean(orderToDelete)} onOpenChange={() => setOrderToDelete(null)}>
        <AlertDialogContent className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl">
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
          <AlertDialogFooter className="gap-2">
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
    </div>
  );
};

export default ProductionListPage;
