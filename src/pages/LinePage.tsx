import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  useUrlFilterSync,
  getInitialDateRangeFromUrl,
  formatDateForUrl,
  getColomboTodayDateRange,
  isColomboTodayRange,
} from '../hooks/useUrlFilterSync';
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
import { get, del } from '../lib/api';
import { getProductImageUrl, formatQty } from '../lib/utils';
import { toast } from 'react-toastify';
import { BatchStatusBadge } from '../components/production/BatchStatusBadge';
import { StageViewToggle, type StageViewMode } from '../components/production/StageViewToggle';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
  Shirt,
  Search,
  CheckCircle2,
  Package,
  Loader2,
  Calendar,
  Clock,
  Sparkles,
  RefreshCw,
  Waves,
  Eye,
  Layers,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  SlidersHorizontal,
  X,
  MoreVertical,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { SearchableSelect, type SearchableSelectOption } from '../components/ui/searchable-select';
import { DateRangePicker, type DateRange } from '../components/ui/date-range-picker';
import { TablePagination } from '../components/common/TablePagination';
import CuttingDetailModal, {
  formatSriLankaDateTime,
} from '../components/production/CuttingDetailModal';
import SendToWashModal from '../components/production/SendToWashModal';
import { LogSewnModal } from '../components/production/LogSewnModal';

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

interface LineBatchItem {
  id: number;
  productionNo: string;
  productId: number;
  variantId?: number | null;
  targetQuantity: number;
  completedQty: number;
  lineSentQty?: number;
  lineIntakeAt?: string | null;
  sentToWashQty: number;
  washedQty: number;
  sewnQty?: number;
  status: string;
  isStockSynced?: boolean;
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
  activityLogs?: any[];
}

interface ParsedBatchProduct {
  productId: number;
  variantId?: number | null;
  productName: string;
  sku?: string;
  sentToLineQty: number;
  sentToWashQty: number;
  sewnQty: number;
  imageUrl?: string | null;
}

const getBatchProducts = (batch: LineBatchItem, productsList: any[] = []): ParsedBatchProduct[] => {
  let raw = batch.targetProducts;
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
        const rawImg = fullProduct?.images?.[0]?.imageUrl || (fullProduct as any)?.image;
        const sentQty = Number(tp.sentToLineQty ?? tp.lineSentQty ?? 0);
        const washQty = Number(tp.sentToWashQty || 0);
        const sewnQty = Number(tp.sewnQty || 0);
        return {
          productId: pId,
          variantId: tp.variantId ? Number(tp.variantId) : null,
          productName: tp.productName || fullProduct?.name || batch.product?.name || `Product #${pId}`,
          sku: tp.sku || fullProduct?.variants?.[0]?.sku || batch.variant?.sku || '',
          sentToLineQty: sentQty,
          sentToWashQty: washQty,
          sewnQty: sewnQty,
          imageUrl: rawImg ? getProductImageUrl(rawImg) : null,
        };
      });
  }

  // Fallback to primary batch product
  const rawImg = batch.product?.images?.[0]?.imageUrl || (batch.product as any)?.image;
  const singleSent = Number(batch.lineSentQty ?? batch.targetQuantity ?? batch.completedQty ?? 0);
  return [
    {
      productId: batch.productId,
      variantId: batch.variantId || null,
      productName: batch.product?.name || `Product #${batch.productId}`,
      sku: batch.variant?.sku || '',
      sentToLineQty: singleSent,
      sentToWashQty: Number(batch.sentToWashQty || 0),
      sewnQty: Number(batch.sewnQty || 0),
      imageUrl: rawImg ? getProductImageUrl(rawImg) : null,
    },
  ];
};

/**
 * Resolves the exact timestamp when the batch entered the Sewing Line Floor:
 * 1. Uses batch.lineIntakeAt if provided by the backend.
 * 2. Or finds the SEND_TO_LINE / LINE_INTAKE log in batch.activityLogs.
 * 3. Falls back to earliest LINE stage log.
 * 4. Falls back to productionDate only if no line log exists.
 */
export const getLineIntakeTimestamp = (batch: any): string | Date => {
  if (batch?.lineIntakeAt) return batch.lineIntakeAt;
  const logs = batch?.activityLogs || [];
  const intakeLog = logs.find((l: any) => {
    const act = String(l?.action || '').toUpperCase();
    const stg = String(l?.stage || '').toUpperCase();
    return act === 'SEND_TO_LINE' || act === 'LINE_INTAKE' || (stg === 'LINE' && act === 'SEND_TO_LINE');
  });
  if (intakeLog?.timestamp) return intakeLog.timestamp;
  const lineLog = logs.find((l: any) => String(l?.stage || '').toUpperCase() === 'LINE');
  if (lineLog?.timestamp) return lineLog.timestamp;
  return batch?.productionDate || batch?.createdAt || '';
};

export const getLineIntakeTimestampMs = (batch: any): number => {
  const ts = getLineIntakeTimestamp(batch);
  if (!ts) return 0;
  const t = new Date(ts).getTime();
  return isNaN(t) ? 0 : t;
};

/**
 * Resolves the real cumulative sewn quantity of a batch.
 * Sums sewnQty from targetProducts or batch.sewnQty, or falls back to
 * the sum of LOG_SEWN / SEWN activity logs, or full line intake for completed/washed batches.
 */
export const getBatchSewnQty = (batch: any, productsList: any[] = []): number => {
  const prods = getBatchProducts(batch, productsList);
  const prodsSewn = prods.reduce((sum, p) => sum + (Number(p.sewnQty) || 0), 0);
  if (prodsSewn > 0) return prodsSewn;

  if (batch.sewnQty !== undefined && Number(batch.sewnQty) > 0) {
    return Number(batch.sewnQty);
  }

  const logs = batch.activityLogs || [];
  const sewnFromLogs = logs
    .filter((l: any) => {
      const act = String(l?.action || '').toUpperCase();
      const stg = String(l?.stage || '').toUpperCase();
      return act === 'LOG_SEWN' || act === 'SEWN' || (stg === 'LINE' && act.includes('SEWN'));
    })
    .reduce((sum: number, l: any) => sum + Number(l?.quantity || 0), 0);

  if (sewnFromLogs > 0) return sewnFromLogs;

  const st = String(batch.status || '').toUpperCase();
  if (['WASHING', 'FINISHING', 'COMPLETED'].includes(st)) {
    const intake = prods.reduce((sum, p) => sum + (Number(p.sentToLineQty) || 0), 0) || Number(batch.lineSentQty || batch.targetQuantity || 0);
    if (intake > 0) return intake;
  }

  return 0;
};

/**
 * Resolves the real cumulative wash quantity of a batch.
 */
export const getBatchWashQty = (batch: any, productsList: any[] = []): number => {
  const prods = getBatchProducts(batch, productsList);
  const prodsWash = prods.reduce((sum, p) => sum + (Number(p.sentToWashQty) || 0), 0);
  if (prodsWash > 0) return prodsWash;

  if (batch.sentToWashQty !== undefined && Number(batch.sentToWashQty) > 0) {
    return Number(batch.sentToWashQty);
  }

  const logs = batch.activityLogs || [];
  const washFromLogs = logs
    .filter((l: any) => {
      const act = String(l?.action || '').toUpperCase();
      const stg = String(l?.stage || '').toUpperCase();
      const notes = String(l?.notes || '');
      return act === 'SEND_TO_WASH' || act === 'WASH_DISPATCH' || (stg === 'WASHING' && (act.includes('SEND') || notes.includes('Wash Plant')));
    })
    .reduce((sum: number, l: any) => sum + Number(l?.quantity || 0), 0);

  if (washFromLogs > 0) return washFromLogs;

  const st = String(batch.status || '').toUpperCase();
  if (['WASHING', 'FINISHING', 'COMPLETED'].includes(st)) {
    const intake = prods.reduce((sum, p) => sum + (Number(p.sentToLineQty) || 0), 0) || Number(batch.lineSentQty || batch.targetQuantity || 0);
    if (intake > 0) return intake;
  }

  return 0;
};

/**
 * Resolves the real cumulative line intake quantity of a batch.
 */
export const getBatchLineIntakeQty = (batch: any, productsList: any[] = []): number => {
  const prods = getBatchProducts(batch, productsList);
  const prodsIntake = prods.reduce((sum, p) => sum + (Number(p.sentToLineQty) || 0), 0);
  if (prodsIntake > 0) return prodsIntake;

  if (batch.lineSentQty !== undefined && Number(batch.lineSentQty) > 0) {
    return Number(batch.lineSentQty);
  }
  return Number(batch.targetQuantity || batch.completedQty || 0);
};

/**
 * Strictly sums activity logs of a specific type within [startTime, endTime] for a batch.
 */
export const getPeriodLogSum = (
  batch: any,
  type: 'intake' | 'sewn' | 'wash',
  startTime: number,
  endTime: number,
  getLogQtyFn?: (log: any) => number
): number => {
  const logs = batch.activityLogs || [];
  const qtyGetter = getLogQtyFn || ((l: any) => Number(l?.quantity ?? l?.qty ?? 0));
  return logs
    .filter((l: any) => {
      const ts = l?.timestamp || l?.date || l?.createdAt;
      if (!ts) return false;
      const t = new Date(ts).getTime();
      if (isNaN(t) || t < startTime || t > endTime) return false;
      const act = String(l?.action || '').toUpperCase();
      const stg = String(l?.stage || '').toUpperCase();
      const notes = String(l?.notes || '');
      if (type === 'intake') {
        return act === 'SEND_TO_LINE' || act === 'LINE_INTAKE' || (stg === 'LINE' && act === 'SEND_TO_LINE');
      }
      if (type === 'sewn') {
        return act === 'LOG_SEWN' || act === 'SEWN' || (stg === 'LINE' && act.includes('SEWN'));
      }
      if (type === 'wash') {
        return act === 'SEND_TO_WASH' || act === 'WASH_DISPATCH' || (stg === 'WASHING' && (act.includes('SEND') || notes.includes('Wash Plant')));
      }
      return false;
    })
    .reduce((sum: number, l: any) => sum + qtyGetter(l), 0);
};

/**
 * Unified progress metrics for a Sewing Line batch, shared by both Desktop
 * table rows and Mobile batch cards so numbers and percentages stay in sync.
 */
export interface BatchLineProgress {
  lineIntakeQty: number;
  sewnQty: number;
  washSentQty: number;
  remainingToSew: number;
  remainingToWash: number;
  sewnPct: number;
  washPct: number;
  isFilteredPeriod: boolean;
  periodSewnQty: number;
  periodWashQty: number;
  periodIntakeQty: number;
}

/**
 * Computes consistent Sewing Line progress indicators (Line Intake, Sewn,
 * Sent to Wash, Remaining, percentages, and optional date-filter period totals)
 * for a batch. Consumed by both Desktop rows and Mobile cards.
 */
export const computeBatchLineProgress = (
  batch: LineBatchItem,
  productsList: any[] = [],
  localBoundaries: { startTime: number; endTime: number } | null = null,
  selectedActivity = 'all',
  getLogQtyFn?: (log: any) => number
): BatchLineProgress => {
  const baseLine = getBatchLineIntakeQty(batch, productsList);
  const baseWash = getBatchWashQty(batch, productsList);
  const baseSewn = getBatchSewnQty(batch, productsList);

  let lineIntakeQty = baseLine;
  let washSentQty = baseWash;
  let sewnQty = baseSewn;
  let isFilteredPeriod = false;
  let periodSewnQty = 0;
  let periodWashQty = 0;
  let periodIntakeQty = 0;

  if (localBoundaries) {
    isFilteredPeriod = true;
    const periodIntakeFromLogs = getPeriodLogSum(
      batch,
      'intake',
      localBoundaries.startTime,
      localBoundaries.endTime,
      getLogQtyFn
    );
    periodWashQty = getPeriodLogSum(
      batch,
      'wash',
      localBoundaries.startTime,
      localBoundaries.endTime,
      getLogQtyFn
    );
    periodSewnQty = getPeriodLogSum(
      batch,
      'sewn',
      localBoundaries.startTime,
      localBoundaries.endTime,
      getLogQtyFn
    );

    const intakeTime = getLineIntakeTimestampMs(batch);
    const hasIntakeLogs = (batch.activityLogs || []).some((l: any) =>
      ['SEND_TO_LINE', 'LINE_INTAKE'].includes(String(l?.action || '').toUpperCase())
    );
    const pInRange =
      !hasIntakeLogs &&
      intakeTime >= localBoundaries.startTime &&
      intakeTime <= localBoundaries.endTime;
    periodIntakeQty = periodIntakeFromLogs > 0 ? periodIntakeFromLogs : (pInRange ? baseLine : 0);

    lineIntakeQty = selectedActivity === 'intake' ? (periodIntakeQty > 0 ? periodIntakeQty : baseLine) : baseLine;
    washSentQty = selectedActivity === 'wash' ? (periodWashQty > 0 ? periodWashQty : baseWash) : baseWash;
    sewnQty = selectedActivity === 'sewn' ? (periodSewnQty > 0 ? periodSewnQty : baseSewn) : baseSewn;
  }

  const remainingToSew = Math.max(0, lineIntakeQty - sewnQty);
  const remainingToWash = Math.max(0, lineIntakeQty - washSentQty);
  const sewnPct = lineIntakeQty > 0 ? Math.min(100, Math.round((sewnQty / lineIntakeQty) * 100)) : 0;
  const washPct = lineIntakeQty > 0 ? Math.min(100, Math.round((washSentQty / lineIntakeQty) * 100)) : 0;

  return {
    lineIntakeQty,
    sewnQty,
    washSentQty,
    remainingToSew,
    remainingToWash,
    sewnPct,
    washPct,
    isFilteredPeriod,
    periodSewnQty,
    periodWashQty,
    periodIntakeQty,
  };
};

export const LinePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { resolvedTheme } = useTheme();
  const { user } = useAuth();
  const isDark = resolvedTheme === 'dark';

  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<LineBatchItem[]>([]);
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') || '');
  const [selectedProductFilter, setSelectedProductFilter] = useState(() => searchParams.get('productId') || 'all');
  const [selectedActivity, setSelectedActivity] = useState(() => searchParams.get('activity') || 'all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => getInitialDateRangeFromUrl(searchParams));
  const [sortBy, setSortBy] = useState(() => searchParams.get('sort') || 'newest');
  const [viewMode, setViewMode] = useState<StageViewMode>(() =>
    searchParams.get('viewMode') === 'active' ? 'active' : 'all'
  );
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Sync active Sewing Line filters to URL query parameters for browser refresh persistence
  useUrlFilterSync({
    search: searchQuery.trim() || undefined,
    activity: selectedActivity !== 'all' ? selectedActivity : undefined,
    startDate: formatDateForUrl(dateRange?.from),
    endDate: formatDateForUrl(dateRange?.to),
    productId: selectedProductFilter !== 'all' ? selectedProductFilter : undefined,
    viewMode: viewMode === 'active' ? 'active' : undefined,
    sort: sortBy !== 'newest' ? sortBy : undefined,
  });

  // Selected batch for Send to Wash Modal
  const [selectedBatchForWash, setSelectedBatchForWash] = useState<LineBatchItem | null>(null);
  const [isSendToWashOpen, setIsSendToWashOpen] = useState(false);

  // Log Daily Sewn Modal state
  const [logSewnBatch, setLogSewnBatch] = useState<LineBatchItem | null>(null);
  const [showLogSewnSelector, setShowLogSewnSelector] = useState(false);
  const [isLogSewnOpen, setIsLogSewnOpen] = useState(false);

  // Line Rollback Alert State
  const [batchToRollback, setBatchToRollback] = useState<LineBatchItem | null>(null);
  const [isRollingBack, setIsRollingBack] = useState(false);

  // Detail Modal
  const [detailOrder, setDetailOrder] = useState<any | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [productsList, setProductsList] = useState<any[]>([]);

  // Product Combobox Options
  const productFilterOptions: SearchableSelectOption[] = useMemo(() => [
    { value: 'all', label: 'All Garments / Styles' },
    ...productsList.map((p) => ({
      value: String(p.id),
      label: p.name,
    })),
  ], [productsList]);

  // Activity Stage / Metric Selector Options
  const activityOptions: SearchableSelectOption[] = useMemo(() => [
    { value: 'all', label: 'All Activities' },
    { value: 'intake', label: 'Line Intake' },
    { value: 'sewn', label: 'Sewn (Daily Output)' },
    { value: 'wash', label: 'Sent to Wash' },
    { value: 'pending', label: 'Remaining / Pending' },
  ], []);

  const sortOptions: SearchableSelectOption[] = useMemo(() => [
    { value: 'newest', label: 'Newest Dispatches First' },
    { value: 'oldest', label: 'Oldest First' },
    { value: 'highest_qty', label: 'Highest Quantity' },
  ], []);

  // Helper to format Date to YYYY-MM-DD
  const formatDateToYMD = (d: Date | string) => {
    const dateObj = typeof d === 'string' ? new Date(d) : d;
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Fetch all batches that have entered the Sewing Line stage (LINE, WASHING, FINISHING, COMPLETED)
  const fetchLineBatches = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('stage', 'line');
      params.append('limit', '500');

      if (dateRange?.from) {
        const fromYmd = formatDateToYMD(dateRange.from);
        const toYmd = dateRange.to ? formatDateToYMD(dateRange.to) : fromYmd;
        params.append('startDate', `${fromYmd}T00:00:00.000+05:30`);
        params.append('endDate', `${toYmd}T23:59:59.999+05:30`);
      }
      if (selectedActivity && selectedActivity !== 'all') {
        params.append('activityType', selectedActivity);
      }
      if (selectedProductFilter && selectedProductFilter !== 'all') {
        params.append('productId', selectedProductFilter);
      }
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }

      const res: any = await get(`/production?${params.toString()}`);
      const data = res?.data || res;
      const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];

      // Retain all batches that have entered the sewing line (LINE, WASHING, FINISHING, COMPLETED)
      const lineBatches = items.filter((b: any) => {
        const prods = getBatchProducts(b, []);
        const totalSentToLine = prods.reduce((sum, p) => sum + (p.sentToLineQty || 0), 0) || Number(b.lineSentQty || 0);
        const hasLineActivity = (b.activityLogs || []).some((log: any) =>
          log.stage === 'LINE' ||
          ['SEND_TO_LINE', 'LINE_INTAKE', 'LOG_SEWN', 'SEWN'].includes(log.action) ||
          (log.stage === 'WASHING' && log.action === 'SEND_TO_WASH')
        );
        return totalSentToLine > 0 || hasLineActivity || b.status === 'LINE';
      });

      setBatches(lineBatches);
    } catch (err: any) {
      console.error('Failed to fetch line batches:', err);
      toast.error('Failed to load batches in Sewing Line stage');
    } finally {
      setLoading(false);
    }
  }, [dateRange, selectedActivity, selectedProductFilter, searchQuery]);

  // Fetch product catalog for thumbnail lookups
  useEffect(() => {
    const fetchCatalogs = async () => {
      try {
        const prodRes: any = await get('/products');
        setProductsList(prodRes?.data || prodRes || []);
      } catch (err) {
        console.error('Failed to fetch products catalog:', err);
      }
    };
    fetchCatalogs();
  }, []);

  useEffect(() => {
    fetchLineBatches();
  }, [fetchLineBatches]);

  // Stage Rollback Handler (Delete in Line)
  const handleConfirmRollback = async () => {
    if (!batchToRollback) return;
    setIsRollingBack(true);
    try {
      await del(`/production/${batchToRollback.id}/line`);
      toast.success(`Sewing Line progress for #${batchToRollback.productionNo} rolled back to Cutting stage.`);
      setBatchToRollback(null);
      fetchLineBatches();
    } catch (err: any) {
      console.error('Failed to rollback Line stage:', err);
      toast.error(err?.response?.data?.message || err?.message || 'Failed to rollback stage');
    } finally {
      setIsRollingBack(false);
    }
  };

  // Active filter count for mobile badge
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (selectedProductFilter !== 'all') count++;
    if (selectedActivity !== 'all') count++;
    if (dateRange?.from || dateRange?.to) count++;
    if (sortBy !== 'newest') count++;
    return count;
  }, [searchQuery, selectedProductFilter, selectedActivity, dateRange, sortBy]);

  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
    selectedProductFilter !== 'all' ||
    selectedActivity !== 'all' ||
    dateRange !== undefined ||
    sortBy !== 'newest'
  );

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedProductFilter('all');
    setSelectedActivity('all');
    setDateRange(undefined);
    setSortBy('newest');
    setCurrentPage(1);
  };

  // Local Asia/Colombo (+05:30) Calendar Day Boundaries
  const localBoundaries = useMemo(() => {
    if (!dateRange?.from) return null;
    const fromYmd = formatDateToYMD(dateRange.from);
    const toYmd = dateRange.to ? formatDateToYMD(dateRange.to) : fromYmd;
    const startTime = new Date(`${fromYmd}T00:00:00.000+05:30`).getTime();
    const endTime = new Date(`${toYmd}T23:59:59.999+05:30`).getTime();
    return { startTime, endTime, fromYmd, toYmd };
  }, [dateRange]);

  /**
   * Today's calendar day boundaries in Asia/Colombo (+05:30).
   */
  const todayBoundaries = useMemo(() => {
    const lkNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
    const yr = lkNow.getUTCFullYear();
    const mo = String(lkNow.getUTCMonth() + 1).padStart(2, '0');
    const dy = String(lkNow.getUTCDate()).padStart(2, '0');
    const todayYmd = `${yr}-${mo}-${dy}`;
    const startTime = new Date(`${todayYmd}T00:00:00.000+05:30`).getTime();
    const endTime = new Date(`${todayYmd}T23:59:59.999+05:30`).getTime();
    return { todayYmd, startTime, endTime };
  }, []);

  const hasDateFilter = Boolean(dateRange?.from);
  const isTodayOnly = useMemo(() => {
    if (!hasDateFilter || !localBoundaries) return false;
    return localBoundaries.fromYmd === todayBoundaries.todayYmd && localBoundaries.toYmd === todayBoundaries.todayYmd;
  }, [hasDateFilter, localBoundaries, todayBoundaries]);

  /**
   * Safely extracts milliseconds timestamp from a BatchActivityLog object or string,
   * checking timestamp, date, or createdAt properties.
   */
  const getLogTimestampMs = useCallback((logOrTs: any): number => {
    if (!logOrTs) return 0;
    if (typeof logOrTs === 'string' || logOrTs instanceof Date) {
      const t = new Date(logOrTs).getTime();
      return isNaN(t) ? 0 : t;
    }
    const ts = logOrTs?.timestamp || logOrTs?.date || logOrTs?.createdAt;
    if (!ts) return 0;
    const t = new Date(ts).getTime();
    return isNaN(t) ? 0 : t;
  }, []);

  /**
   * Extracts the numeric quantity from a BatchActivityLog object.
   * Checks quantity, qty, or pieces first. If 0 or null, falls back to parsing
   * +N Pcs / Qty: N from notes.
   */
  const getLogQty = useCallback((log: any): number => {
    const direct = Number(log?.quantity ?? log?.qty ?? 0);
    if (!isNaN(direct) && direct > 0) return direct;
    if (log?.notes && typeof log.notes === 'string') {
      const match = log.notes.match(/(?:\+|Qty:\s*|Quantity:\s*|\b)(\d+(?:\.\d+)?)\s*(?:Pcs|Units|Pieces)?/i);
      if (match) {
        const parsed = parseFloat(match[1]);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    }
    return 0;
  }, []);

  /**
   * Checks whether an activity log or timestamp falls strictly inside the active date range.
   */
  const isLogWithinRange = useCallback((logOrTs: any) => {
    if (!logOrTs || !localBoundaries) return false;
    const t = getLogTimestampMs(logOrTs);
    return !isNaN(t) && t >= localBoundaries.startTime && t <= localBoundaries.endTime;
  }, [localBoundaries, getLogTimestampMs]);

  /**
   * Filters Sewn activity logs for a batch, optionally restricting to the active date range.
   */
  const getSewnLogs = useCallback((b: any, filterRange = false) => {
    return (b.activityLogs || []).filter((log: any) => {
      const actionStr = String(log?.action || '').toUpperCase();
      const stageStr = String(log?.stage || '').toUpperCase();
      const isSewn =
        actionStr === 'LOG_SEWN' ||
        actionStr === 'SEWN' ||
        (stageStr === 'LINE' && actionStr.includes('SEWN'));
      if (!isSewn) return false;
      return !filterRange || isLogWithinRange(log);
    });
  }, [isLogWithinRange]);

  /**
   * Filters Line Intake activity logs for a batch, optionally restricting to the active date range.
   */
  const getIntakeLogs = useCallback((b: any, filterRange = false) => {
    return (b.activityLogs || []).filter((log: any) => {
      const actionStr = String(log?.action || '').toUpperCase();
      const stageStr = String(log?.stage || '').toUpperCase();
      const isIntake =
        actionStr === 'SEND_TO_LINE' ||
        actionStr === 'LINE_INTAKE' ||
        (stageStr === 'LINE' && actionStr === 'SEND_TO_LINE');
      if (!isIntake) return false;
      return !filterRange || isLogWithinRange(log);
    });
  }, [isLogWithinRange]);

  /**
   * Filters Wash Dispatch activity logs for a batch, optionally restricting to the active date range.
   */
  const getWashDispatchLogs = useCallback((b: any, filterRange = false) => {
    return (b.activityLogs || []).filter((log: any) => {
      const actionStr = String(log?.action || '').toUpperCase();
      const stageStr = String(log?.stage || '').toUpperCase();
      const notesStr = String(log?.notes || '');
      const isWash =
        actionStr === 'SEND_TO_WASH' ||
        actionStr === 'WASH_DISPATCH' ||
        (stageStr === 'WASHING' && (actionStr.includes('SEND') || notesStr.includes('Wash Plant')));
      if (!isWash) return false;
      return !filterRange || isLogWithinRange(log);
    });
  }, [isLogWithinRange]);

  // Comprehensive multi-factor filtering & sorting
  const filteredBatches = useMemo(() => {
    let list = [...batches];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((b) => {
        const matchNo = b.productionNo.toLowerCase().includes(q);
        const matchProd = b.product?.name?.toLowerCase().includes(q);
        const matchSku = b.variant?.sku?.toLowerCase().includes(q);
        const matchNotes = b.notes?.toLowerCase().includes(q);
        const prods = getBatchProducts(b, productsList);
        const matchInProds = prods.some(
          (p) =>
            p.productName.toLowerCase().includes(q) ||
            (p.sku && p.sku.toLowerCase().includes(q))
        );
        return matchNo || matchProd || matchSku || matchNotes || matchInProds;
      });
    }

    if (selectedProductFilter && selectedProductFilter !== 'all') {
      const pId = Number(selectedProductFilter);
      list = list.filter((b) => {
        if (b.productId === pId) return true;
        const prods = getBatchProducts(b, productsList);
        return prods.some((p) => p.productId === pId);
      });
    }

    // Connect Date-Range Filtering directly to Selected Activity Type
    if (selectedActivity === 'intake') {
      list = list.filter((b: any) => {
        if (localBoundaries) {
          const pIntake = getPeriodLogSum(b, 'intake', localBoundaries.startTime, localBoundaries.endTime, getLogQty);
          if (pIntake > 0) return true;
          const intakeTime = getLineIntakeTimestampMs(b);
          const hasIntakeLogs = (b.activityLogs || []).some((l: any) =>
            ['SEND_TO_LINE', 'LINE_INTAKE'].includes(String(l?.action || '').toUpperCase())
          );
          return !hasIntakeLogs && intakeTime >= localBoundaries.startTime && intakeTime <= localBoundaries.endTime && getBatchLineIntakeQty(b, productsList) > 0;
        }
        return getBatchLineIntakeQty(b, productsList) > 0;
      });
    } else if (selectedActivity === 'sewn') {
      list = list.filter((b: any) => {
        if (localBoundaries) {
          const pSewn = getPeriodLogSum(b, 'sewn', localBoundaries.startTime, localBoundaries.endTime, getLogQty);
          return pSewn > 0;
        }
        return getBatchSewnQty(b, productsList) > 0;
      });
    } else if (selectedActivity === 'wash') {
      list = list.filter((b: any) => {
        if (localBoundaries) {
          const pWash = getPeriodLogSum(b, 'wash', localBoundaries.startTime, localBoundaries.endTime, getLogQty);
          return pWash > 0;
        }
        return getBatchWashQty(b, productsList) > 0;
      });
    } else if (selectedActivity === 'pending') {
      list = list.filter((b: any) => {
        const sentTotal = getBatchLineIntakeQty(b, productsList);
        const washTotal = getBatchWashQty(b, productsList);
        const sewnTotal = getBatchSewnQty(b, productsList);
        const isPending = (sentTotal > washTotal) || (sentTotal > sewnTotal);
        if (!isPending) return false;
        if (localBoundaries) {
          const hasLog = (b.activityLogs || []).some((l: any) => isLogWithinRange(l));
          const intakeTime = getLineIntakeTimestampMs(b);
          const inRange = intakeTime >= localBoundaries.startTime && intakeTime <= localBoundaries.endTime;
          return hasLog || inRange;
        }
        return true;
      });
    } else {
      // 'all' Activities
      if (localBoundaries) {
        list = list.filter((b: any) => {
          const hasLogInRange = (b.activityLogs || []).some((log: any) => isLogWithinRange(log));
          if (hasLogInRange) return true;
          const hasIntakeLogs = (b.activityLogs || []).some((l: any) =>
            ['SEND_TO_LINE', 'LINE_INTAKE'].includes(String(l?.action || '').toUpperCase())
          );
          if (!hasIntakeLogs) {
            const intakeTime = getLineIntakeTimestampMs(b);
            return intakeTime >= localBoundaries.startTime && intakeTime <= localBoundaries.endTime;
          }
          return false;
        });
      }
    }

    // Dual-Mode View Filter (Active Only vs All Incl. Completed)
    if (viewMode === 'active') {
      list = list.filter((b: any) => {
        const st = String(b.status || '').toUpperCase();
        if (st === 'COMPLETED' || b.isStockSynced) return false;
        const intake = getBatchLineIntakeQty(b, productsList);
        const wash = getBatchWashQty(b, productsList);
        const sewn = getBatchSewnQty(b, productsList);
        return st === 'LINE' || intake > wash || intake > sewn;
      });
    }

    switch (sortBy) {
      case 'oldest':
        list.sort((a, b) => {
          const dateA = getLineIntakeTimestampMs(a);
          const dateB = getLineIntakeTimestampMs(b);
          return dateA - dateB || a.id - b.id;
        });
        break;
      case 'highest_qty':
        list.sort((a, b) => {
          const qA = getBatchLineIntakeQty(a, productsList);
          const qB = getBatchLineIntakeQty(b, productsList);
          return qB - qA || b.id - a.id;
        });
        break;
      case 'newest':
      default:
        list.sort((a, b) => {
          const dateA = getLineIntakeTimestampMs(a);
          const dateB = getLineIntakeTimestampMs(b);
          return dateB - dateA || b.id - a.id;
        });
        break;
    }

    return list;
  }, [
    batches,
    searchQuery,
    selectedProductFilter,
    selectedActivity,
    localBoundaries,
    sortBy,
    productsList,
    isLogWithinRange,
    getLogQty,
    viewMode,
  ]);

  /**
   * Dynamically aggregated KPI metrics for Top Summary Cards.
   * Displays full cumulative batch quantities for normal filters,
   * with period activity indicators (+X in range) when a date range is active,
   * or activity-specific logged outputs when filtering specifically by sewn, wash, or intake.
   */
  const metrics = useMemo(() => {
    const totalBatches = filteredBatches.length;
    let totalLineIntake = 0;
    let totalForwardedToWash = 0;
    let totalSewnQty = 0;

    let periodLineIntake = 0;
    let periodForwardedToWash = 0;
    let periodSewnQty = 0;
    let todaySewnQty = 0;

    filteredBatches.forEach((b: any) => {
      const bIntake = getBatchLineIntakeQty(b, productsList);
      const bWash = getBatchWashQty(b, productsList);
      const bSewn = getBatchSewnQty(b, productsList);

      totalLineIntake += bIntake;
      totalForwardedToWash += bWash;
      totalSewnQty += bSewn;

      // Always calculate today's logged sewn output for Case A
      const bTodaySewn = getPeriodLogSum(b, 'sewn', todayBoundaries.startTime, todayBoundaries.endTime, getLogQty);
      todaySewnQty += bTodaySewn;

      if (localBoundaries) {
        let pIntake = getPeriodLogSum(b, 'intake', localBoundaries.startTime, localBoundaries.endTime, getLogQty);
        const pWash = getPeriodLogSum(b, 'wash', localBoundaries.startTime, localBoundaries.endTime, getLogQty);
        const pSewn = getPeriodLogSum(b, 'sewn', localBoundaries.startTime, localBoundaries.endTime, getLogQty);

        if (pIntake === 0) {
          const intakeTime = getLineIntakeTimestampMs(b);
          const hasIntakeLogs = (b.activityLogs || []).some((l: any) =>
            ['SEND_TO_LINE', 'LINE_INTAKE'].includes(String(l?.action || '').toUpperCase())
          );
          if (!hasIntakeLogs && intakeTime >= localBoundaries.startTime && intakeTime <= localBoundaries.endTime) {
            pIntake = bIntake;
          }
        }

        periodLineIntake += pIntake;
        periodForwardedToWash += pWash;
        periodSewnQty += pSewn;
      }
    });

    const isSewnActive = selectedActivity === 'sewn' && Boolean(localBoundaries);
    const isWashActive = selectedActivity === 'wash' && Boolean(localBoundaries);
    const isIntakeActive = selectedActivity === 'intake' && Boolean(localBoundaries);

    // Determine Sewn Card State: Case A (Today / Unfiltered) vs Case B (Period Filtered)
    const isPeriodRangeActive = hasDateFilter && !isTodayOnly;
    const sewnCardTitle = isPeriodRangeActive ? 'Sewing Qty' : 'Daily Sewn Qty';
    const sewnCardSubtitle = isPeriodRangeActive
      ? 'Total sewn output in selected period'
      : 'Completed sewn output logged today';
    const sewnCardValue = isPeriodRangeActive ? periodSewnQty : todaySewnQty;

    const pendingSewing = Math.max(0, totalLineIntake - totalForwardedToWash);

    return {
      totalBatches,
      displayLineIntake: (isIntakeActive || isTodayOnly) ? periodLineIntake : totalLineIntake,
      displayForwardedToWash: (isWashActive || isTodayOnly) ? periodForwardedToWash : totalForwardedToWash,
      displaySewnQty: sewnCardValue,
      sewnCardTitle,
      sewnCardSubtitle,
      totalLineIntake,
      totalForwardedToWash,
      totalSewnQty,
      periodLineIntake,
      periodForwardedToWash,
      periodSewnQty,
      todaySewnQty,
      pendingSewing,
      isSewnActive,
      isWashActive,
      isIntakeActive,
      isPeriodRangeActive,
    };
  }, [filteredBatches, productsList, localBoundaries, selectedActivity, getLogQty, todayBoundaries, hasDateFilter, isTodayOnly]);

  // Helper to resolve row display quantities dynamically via shared progress helper
  const getBatchRowDisplay = useCallback((batch: LineBatchItem): BatchLineProgress => {
    return computeBatchLineProgress(batch, productsList, localBoundaries, selectedActivity, getLogQty);
  }, [localBoundaries, productsList, selectedActivity, getLogQty]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;
  const totalPages = Math.ceil(filteredBatches.length / pageSize) || 1;
  const paginatedBatches = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredBatches.slice(start, start + pageSize);
  }, [filteredBatches, currentPage]);

  const handleOpenSendToWash = (batch: LineBatchItem) => {
    setSelectedBatchForWash(batch);
    setIsSendToWashOpen(true);
  };

  return (
    <div className="space-y-6 w-full pb-12">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="size-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20 shadow-xs">
              <Shirt className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
                <span>Sewing Line Floor</span>
                <Badge
                  variant="outline"
                  className="bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200 border-indigo-400 dark:border-indigo-700 text-xs font-bold"
                >
                  STAGE 2: LINE
                </Badge>
              </h1>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Fabric &rarr; Cutting &rarr; <strong>Line (Per-Product Dispatch)</strong> &rarr; Wash &rarr; Stock/Order
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLineBatches}
            className="h-9 px-3 gap-1.5 rounded-xl text-xs font-semibold"
            title="Refresh Sewing Line"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          <Button
            onClick={() => {
              if (batches.length > 0) {
                setLogSewnBatch(batches[0]);
                setShowLogSewnSelector(true);
                setIsLogSewnOpen(true);
              } else {
                toast.info('No active sewing line batch available to log sewn output.');
              }
            }}
            className="h-9 px-3 gap-1.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-xs cursor-pointer"
          >
            <Shirt className="size-3.5" />
            <span>Log Daily Sewn</span>
          </Button>

          <Button
            onClick={() => navigate('/system/cutting')}
            className="h-9 px-3 gap-1.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs cursor-pointer"
          >
            <span>Cutting Ledger</span>
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* ── KPI Metric Cards ── */}
      <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full">
        {/* Metric 1: Batches on Floor */}
        <div className="rounded-2xl border p-4 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between min-h-[110px]">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                {localBoundaries ? 'Filtered Batches' : 'Active Sewing Batches'}
              </span>
              <h3 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1 font-mono">
                {metrics.totalBatches}{' '}
                <span className="text-xs font-medium text-slate-500">Batches</span>
              </h3>
            </div>
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl shrink-0">
              <Shirt className="size-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-2">
            {localBoundaries ? 'Batches active or with logs in selected period' : 'Currently active on factory sewing tables'}
          </p>
        </div>

        {/* Metric 2: Total Intake Units */}
        <div className="rounded-2xl border p-4 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between min-h-[110px]">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                {metrics.isIntakeActive ? 'Period Line Intake' : 'Total Line Intake'}
              </span>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1 font-mono">
                {metrics.displayLineIntake.toLocaleString()}{' '}
                <span className="text-xs font-medium text-slate-500">Units</span>
              </h3>
            </div>
            <div className="p-2.5 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-xl shrink-0">
              <Layers className="size-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-2">
            {metrics.isIntakeActive ? (
              'Received on line in selected period'
            ) : localBoundaries ? (
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                Received in range: +{metrics.periodLineIntake.toLocaleString()} Units
              </span>
            ) : (
              'Cut garment pieces received from Cutting'
            )}
          </p>
        </div>

        {/* Metric 3: Sent to Wash */}
        <div className="rounded-2xl border p-4 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between min-h-[110px]">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                Forwarded to Wash
              </span>
              <h3 className="text-2xl font-bold text-cyan-600 dark:text-cyan-400 mt-1 font-mono">
                {metrics.displayForwardedToWash.toLocaleString()}{' '}
                <span className="text-xs font-medium text-slate-500">Units</span>
              </h3>
            </div>
            <div className="p-2.5 bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 rounded-xl shrink-0">
              <Waves className="size-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-2">
            {metrics.isWashActive ? (
              'Forwarded to wash in selected period'
            ) : localBoundaries ? (
              <span className="font-semibold text-cyan-600 dark:text-cyan-400">
                Forwarded in range: +{metrics.periodForwardedToWash.toLocaleString()} Units
              </span>
            ) : (
              'Sewn bundles forwarded to Wash Plant'
            )}
          </p>
        </div>

        {/* Metric 4: Daily Sewn Qty / Sewing Qty */}
        <div className="rounded-2xl border p-4 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between min-h-[110px]">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                {metrics.sewnCardTitle}
              </span>
              <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                {metrics.displaySewnQty.toLocaleString()}{' '}
                <span className="text-xs font-medium text-slate-500">Pcs</span>
              </h3>
            </div>
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl shrink-0">
              <Sparkles className="size-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-2">
            {metrics.sewnCardSubtitle}
          </p>
        </div>
      </div>

      {/* ── Responsive Filter Bar ── */}
      {/* 1. Mobile Filter Bar (< 1024px) */}
      <div className="lg:hidden flex flex-col gap-2.5 p-3 rounded-2xl border bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 shadow-xs">
        <div className="flex items-center gap-2 w-full">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800">
            <Search className="size-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search cutting #, garment style, SKU..."
              className="bg-transparent outline-none w-full text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
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
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/50 dark:border-indigo-800 dark:text-indigo-300'
                : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300'
            }`}
          >
            <SlidersHorizontal className="size-3.5" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="flex items-center justify-center size-4 rounded-full bg-indigo-600 text-[9px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {mobileFiltersOpen && (
          <div className="pt-2.5 border-t border-slate-100 dark:border-zinc-800 space-y-2 animate-in fade-in-50 duration-150">
            <div className="w-full">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                Activity / Metric
              </label>
              <SearchableSelect
                options={activityOptions}
                value={selectedActivity}
                onValueChange={(val) => {
                  setSelectedActivity(val || 'all');
                  setCurrentPage(1);
                }}
                placeholder="All Activities"
                searchPlaceholder="Filter activity..."
                dark={isDark}
              />
            </div>

            <div className="w-full">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                Date Range
              </label>
              <DateRangePicker
                date={dateRange}
                onDateChange={(range) => {
                  setDateRange(range);
                  setCurrentPage(1);
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
                  setCurrentPage(1);
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
                  setCurrentPage(1);
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
      <div className="hidden lg:flex flex-wrap items-center gap-2 p-3 rounded-2xl border bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 shadow-xs w-full min-w-0">
        <div className="flex-1 min-w-[180px] flex items-center gap-2 px-3 py-2 rounded-xl border bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 focus-within:border-indigo-500">
          <Search className="size-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by cutting number, garment style, SKU, or notes..."
            className="bg-transparent outline-none w-full text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setCurrentPage(1);
              }}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="w-36 lg:w-40 min-w-0 shrink-0">
          <SearchableSelect
            options={activityOptions}
            value={selectedActivity}
            onValueChange={(val) => {
              setSelectedActivity(val || 'all');
              setCurrentPage(1);
            }}
            placeholder="All Activities"
            searchPlaceholder="Filter activity..."
            dark={isDark}
          />
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div className="w-44 shrink-0">
            <DateRangePicker
              date={dateRange}
              onDateChange={(range) => {
                setDateRange(range);
                setCurrentPage(1);
              }}
              placeholder="Filter date..."
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setDateRange(isColomboTodayRange(dateRange) ? undefined : getColomboTodayDateRange());
              setCurrentPage(1);
            }}
            className={`h-9 px-3 rounded-xl text-xs font-semibold border transition-all shrink-0 whitespace-nowrap cursor-pointer ${
              isColomboTodayRange(dateRange)
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                : 'bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
            }`}
            title="Filter strictly to today's Sewing Line activity (+05:30)"
          >
            Today
          </button>
        </div>

        <div className="w-40 min-w-0 shrink-0">
          <SearchableSelect
            options={productFilterOptions}
            value={selectedProductFilter}
            onValueChange={(val) => {
              setSelectedProductFilter(val);
              setCurrentPage(1);
            }}
            placeholder="All Garments"
            searchPlaceholder="Filter style..."
            dark={isDark}
          />
        </div>

        <div className="w-36 lg:w-40 min-w-0 shrink-0">
          <SearchableSelect
            options={sortOptions}
            value={sortBy}
            onValueChange={(val) => {
              setSortBy(val);
              setCurrentPage(1);
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

        {/* Dual-Mode View Toggle (Active Only vs All Incl. Completed) */}
        <StageViewToggle
          value={viewMode}
          onChange={(mode) => {
            setViewMode(mode);
            setCurrentPage(1);
          }}
        />
      </div>

      {/* ── Content View (Desktop Table & Mobile Cards) ── */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
          <Loader2 className="size-7 animate-spin text-indigo-600" />
          <p className="text-xs font-medium">Loading Sewing Line batches...</p>
        </div>
      ) : filteredBatches.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 p-12 text-center bg-white dark:bg-zinc-900/40">
          <div className="size-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3">
            <Shirt className="size-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            No Batches in Sewing Line
          </h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? `No sewing line batches matched your filter "${searchQuery}".`
              : 'All cut bundles have either been forwarded to the Wash Plant or are waiting in the Cutting stage.'}
          </p>
          <Button
            size="sm"
            onClick={() => navigate('/system/production')}
            className="mt-4 gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold"
          >
            <span>Go to Cutting Ledger</span>
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      ) : (
        <>
          {/* Desktop Table View (>= 1024px) */}
          <div className="hidden lg:block rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-x-auto shadow-xs">
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
                    Total Line Intake
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 text-center w-24">
                    Sent to Wash
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 w-36">
                    Remaining Progress
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 text-center w-24">
                    Status
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 text-right w-20">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedBatches.map((batch) => {
                  const prods = getBatchProducts(batch, productsList);
                  const {
                    lineIntakeQty: lineQty,
                    washSentQty: washQty,
                    sewnQty: batchTotalSewn,
                    sewnPct: sewnPercent,
                    washPct: overallPercent,
                    isFilteredPeriod,
                    periodSewnQty: periodSewn,
                    periodWashQty: periodWash,
                    periodIntakeQty: periodIntake,
                  } = getBatchRowDisplay(batch);

                  // "Send to Wash" remains active and accessible as long as sentToLineQty > sentToWashQty for ANY product in the batch
                  const hasRemainingToWash = prods.length > 0
                    ? prods.some((p) => p.sentToLineQty > p.sentToWashQty)
                    : (washQty < lineQty);
                  const isLineDone = !hasRemainingToWash;

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
                        {renderSriLankaDateTime(getLineIntakeTimestamp(batch))}
                      </TableCell>

                      {/* 3. PRODUCT (Maximized width & single line fallback) */}
                      <TableCell className="align-middle">
                        <div className="space-y-2 py-1">
                          {prods.map((p, pIdx) => {
                            const pRemaining = Math.max(0, p.sentToLineQty - p.sentToWashQty);
                            return (
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
                                    <Badge
                                      variant="outline"
                                      className="font-mono text-[10px] font-bold px-1.5 py-0 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 shrink-0"
                                    >
                                      Line Intake: {p.sentToLineQty} Pcs
                                    </Badge>
                                    <Badge
                                      variant="outline"
                                      className="font-mono text-[10px] font-bold px-1.5 py-0 bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800 shrink-0"
                                    >
                                      Sent to Wash: {p.sentToWashQty} Pcs
                                    </Badge>
                                    <Badge
                                      variant="outline"
                                      className="font-mono text-[10px] font-bold px-1.5 py-0 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 shrink-0"
                                    >
                                      Remaining: {pRemaining} Pcs
                                    </Badge>
                                  </div>
                                  {p.sku && (
                                    <span className="text-[10px] text-slate-400 truncate block font-mono">
                                      SKU: {p.sku}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </TableCell>

                      {/* 4. Raw Material Cut */}
                      <TableCell className="align-middle w-36">
                        <div className="space-y-0.5">
                          {batch.materialUsages && batch.materialUsages.length > 0 ? (
                            batch.materialUsages.slice(0, 2).map((u: any) => (
                              <div key={u.id} className="text-xs text-slate-700 dark:text-zinc-300 truncate max-w-[150px]">
                                <span className="font-semibold text-slate-900 dark:text-zinc-100">
                                  {u.rawMaterial?.name || 'Material'}
                                </span>
                                {' · '}
                                <span className="font-mono text-amber-700 dark:text-amber-400 font-semibold">
                                  {formatQty(u.netConsumedQty ?? u.issuedQty)} {u.rawMaterial?.unit || 'Units'}
                                </span>
                              </div>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                          {batch.materialUsages && batch.materialUsages.length > 2 && (
                            <span className="text-[10px] text-slate-400 block">
                              +{batch.materialUsages.length - 2} more
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* 5. Total Line Intake */}
                      <TableCell className="align-middle text-center w-24">
                        <span className="text-xs font-mono font-bold text-slate-800 dark:text-zinc-200">
                          {lineQty} Pcs
                        </span>
                        {isFilteredPeriod && (periodIntake > 0 || selectedActivity === 'intake') && (
                          <span className="block text-[10px] font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                            Range: +{periodIntake}
                          </span>
                        )}
                      </TableCell>

                      {/* 6. Sent to Wash */}
                      <TableCell className="align-middle text-center w-24">
                        <span className="text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400">
                          {washQty} Pcs
                        </span>
                        {isFilteredPeriod && (periodWash > 0 || selectedActivity === 'wash') && (
                          <span className="block text-[10px] font-mono font-semibold text-cyan-600 dark:text-cyan-400">
                            Range: +{periodWash}
                          </span>
                        )}
                      </TableCell>

                      {/* 7. Progress: Daily Sewn & Wash Forwarding */}
                      <TableCell className="align-middle w-48 min-w-[170px]">
                        <div className="space-y-1.5">
                          {/* In-Period Activity Breakdown Badge when date range is active */}
                          {isFilteredPeriod && (periodSewn > 0 || periodWash > 0 || ['sewn', 'wash'].includes(selectedActivity)) && (
                            <div className="flex items-center gap-1.5 flex-wrap pb-1 border-b border-dashed border-slate-200 dark:border-zinc-800 text-[10px] font-mono">
                              <span className="font-bold uppercase tracking-wider text-slate-400">Range:</span>
                              {(periodSewn > 0 || selectedActivity === 'sewn') && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0 font-mono font-bold bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300"
                                >
                                  Sewn: +{periodSewn}
                                </Badge>
                              )}
                              {(periodWash > 0 || selectedActivity === 'wash') && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0 font-mono font-bold bg-cyan-50 text-cyan-700 border-cyan-300 dark:bg-cyan-950/60 dark:text-cyan-300"
                                >
                                  Wash: +{periodWash}
                                </Badge>
                              )}
                            </div>
                          )}

                          {/* Daily Sewn Progress */}
                          <div className="space-y-0.5">
                            <div className="flex items-center justify-between text-[10px] font-mono leading-tight">
                              <span className="font-bold text-purple-700 dark:text-purple-300">
                                Sewn: {batchTotalSewn} / {lineQty} Pcs
                              </span>
                              <span className="text-purple-600 dark:text-purple-400 font-bold">{sewnPercent}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  sewnPercent >= 100 ? 'bg-emerald-500' : 'bg-purple-600'
                                }`}
                                style={{ width: `${sewnPercent}%` }}
                              />
                            </div>
                          </div>

                          {/* Wash Forwarding Progress */}
                          <div className="space-y-0.5">
                            <div className="flex items-center justify-between text-[10px] font-mono leading-tight">
                              <span className="font-semibold text-cyan-700 dark:text-cyan-300">
                                Wash: {washQty} / {lineQty} Pcs
                              </span>
                              <span className="text-cyan-600 dark:text-cyan-400 font-bold">{overallPercent}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-cyan-500 rounded-full transition-all duration-300"
                                style={{ width: `${overallPercent}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      {/* 8. Status */}
                      <TableCell className="align-middle text-center w-24">
                        <BatchStatusBadge status={batch.status} isStockSynced={batch.isStockSynced} />
                      </TableCell>

                      {/* 9. Action (Standardized 3-dots actions menu) */}
                      <TableCell className="align-middle text-right w-20" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              aria-label="Line Actions"
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-xl">
                            <DropdownMenuItem
                              disabled={isLineDone}
                              onClick={() => handleOpenSendToWash(batch)}
                              className="cursor-pointer gap-2 text-xs font-semibold text-cyan-600 dark:text-cyan-400 focus:text-cyan-600 focus:bg-cyan-50 dark:focus:bg-cyan-950/50"
                            >
                              <Waves className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                              <span>Send to Wash</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setLogSewnBatch(batch);
                                setShowLogSewnSelector(false);
                                setIsLogSewnOpen(true);
                              }}
                              className="cursor-pointer gap-2 text-xs font-semibold text-purple-600 dark:text-purple-400 focus:text-purple-600 focus:bg-purple-50 dark:focus:bg-purple-950/50"
                            >
                              <Shirt className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                              <span>Log Daily Sewn</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setDetailOrder(batch);
                                setIsDetailModalOpen(true);
                              }}
                              className="cursor-pointer gap-2 text-xs font-medium"
                            >
                              <Eye className="w-4 h-4 text-blue-600" />
                              <span>History</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setBatchToRollback(batch)}
                              className="cursor-pointer gap-2 text-xs font-medium text-rose-600 dark:text-rose-400 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/50"
                            >
                              <Trash2 className="w-4 h-4 text-rose-600" />
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

          {/* Mobile Card Layout (< 1024px) */}
          <div className="block lg:hidden space-y-3.5">
            {paginatedBatches.map((batch) => {
              const prods = getBatchProducts(batch, productsList);
              const {
                lineIntakeQty,
                sewnQty,
                washSentQty,
                remainingToWash,
                sewnPct,
                washPct,
                isFilteredPeriod,
                periodSewnQty,
                periodWashQty,
                periodIntakeQty,
              } = getBatchRowDisplay(batch);

              // "Send to Wash" remains active and accessible as long as sentToLineQty > sentToWashQty for ANY product in the batch
              const hasRemainingToWash = prods.length > 0
                ? prods.some((p) => p.sentToLineQty > p.sentToWashQty)
                : (washSentQty < lineIntakeQty);
              const isLineDone = !hasRemainingToWash;

              return (
                <div
                  key={batch.id}
                  onClick={() => {
                    setDetailOrder(batch);
                    setIsDetailModalOpen(true);
                  }}
                  className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 shadow-xs space-y-3 cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900 dark:text-white px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800">
                      #{batch.productionNo}
                    </span>
                    <BatchStatusBadge status={batch.status} isStockSynced={batch.isStockSynced} />
                  </div>

                  <p className="text-[10px] text-slate-400 font-mono">
                    {formatSriLankaDateTime(getLineIntakeTimestamp(batch))}
                  </p>

                  {/* Target Garment Products List */}
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
                          <div className="size-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/50 flex items-center justify-center shrink-0 text-indigo-600 dark:text-indigo-400">
                            <Shirt className="size-4" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {p.productName}
                          </h4>
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">Intake: {p.sentToLineQty}</span>
                            <span className="text-slate-300 dark:text-zinc-700">·</span>
                            <span className={`text-[10px] font-bold ${
                              p.sentToLineQty > 0 && (p.sewnQty || 0) >= p.sentToLineQty
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-purple-600 dark:text-purple-400'
                            }`}>
                              Sewn: {p.sewnQty || 0}
                            </span>
                            <span className="text-slate-300 dark:text-zinc-700">·</span>
                            <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-bold">Wash: {p.sentToWashQty}</span>
                            <span className="text-slate-300 dark:text-zinc-700">·</span>
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">Rem: {Math.max(0, p.sentToLineQty - p.sentToWashQty)}</span>
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

                  {/* Raw Material Cut Yardage Summary */}
                  {batch.materialUsages && batch.materialUsages.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-slate-600 dark:text-zinc-400">
                      {batch.materialUsages.slice(0, 2).map((u: any) => (
                        <Badge
                          key={u.id}
                          variant="outline"
                          className="font-mono text-[10px] px-1.5 py-0 bg-amber-50/70 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-amber-200/80 dark:border-amber-900/50"
                        >
                          {u.rawMaterial?.name || 'Material'}: {formatQty(u.netConsumedQty ?? u.issuedQty)} {u.rawMaterial?.unit || 'Units'}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* In-Period Activity Summary Badge when date range or Today filter is active */}
                  {isFilteredPeriod && (periodIntakeQty > 0 || periodSewnQty > 0 || periodWashQty > 0 || ['sewn', 'wash'].includes(selectedActivity)) && (
                    <div className="flex items-center gap-1.5 flex-wrap p-2 rounded-xl bg-purple-50/50 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-900/40 text-[10px] font-mono">
                      <span className="font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                        Range:
                      </span>
                      {periodIntakeQty > 0 && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 font-mono font-bold bg-indigo-50 text-indigo-700 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300"
                        >
                          Intake: +{periodIntakeQty}
                        </Badge>
                      )}
                      {(periodSewnQty > 0 || selectedActivity === 'sewn') && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 font-mono font-bold bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300"
                        >
                          Sewn: +{periodSewnQty}
                        </Badge>
                      )}
                      {(periodWashQty > 0 || selectedActivity === 'wash') && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 font-mono font-bold bg-cyan-50 text-cyan-700 border-cyan-300 dark:bg-cyan-950/60 dark:text-cyan-300"
                        >
                          Wash: +{periodWashQty}
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* 4-Metric Summary Grid (Desktop Parity) */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800 text-xs">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Line Intake</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-zinc-200">
                        {lineIntakeQty} Pcs
                      </span>
                      {isFilteredPeriod && (periodIntakeQty > 0 || selectedActivity === 'intake') && (
                        <span className="block text-[9px] font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                          Range: +{periodIntakeQty}
                        </span>
                      )}
                    </div>
                    <div>
                      <span className={`text-[9px] uppercase font-bold block ${
                        sewnPct >= 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-purple-600 dark:text-purple-400'
                      }`}>
                        Sewn
                      </span>
                      <span className={`font-mono font-bold ${
                        sewnPct >= 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-purple-600 dark:text-purple-400'
                      }`}>
                        {sewnQty} Pcs
                      </span>
                      {isFilteredPeriod && (periodSewnQty > 0 || selectedActivity === 'sewn') && (
                        <span className="block text-[9px] font-mono font-semibold text-purple-600 dark:text-purple-400">
                          Range: +{periodSewnQty}
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-cyan-600 dark:text-cyan-400 block">Sent to Wash</span>
                      <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">
                        {washSentQty} Pcs
                      </span>
                      {isFilteredPeriod && (periodWashQty > 0 || selectedActivity === 'wash') && (
                        <span className="block text-[9px] font-mono font-semibold text-cyan-600 dark:text-cyan-400">
                          Range: +{periodWashQty}
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-amber-600 dark:text-amber-400 block">Remaining</span>
                      <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                        {remainingToWash} Pcs
                      </span>
                    </div>
                  </div>

                  {/* Dual Stacked Progress Bars Identical to Desktop */}
                  <div className="space-y-2">
                    {/* 1. Daily Sewn Progress */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-mono leading-tight">
                        <span className="font-bold text-purple-700 dark:text-purple-300">
                          Sewn: {sewnQty} / {lineIntakeQty} Pcs
                        </span>
                        <span className="text-purple-600 dark:text-purple-400 font-bold">{sewnPct}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            sewnPct >= 100 ? 'bg-emerald-500' : 'bg-purple-600'
                          }`}
                          style={{ width: `${sewnPct}%` }}
                        />
                      </div>
                    </div>

                    {/* 2. Wash Forwarding Progress */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-mono leading-tight">
                        <span className="font-semibold text-cyan-700 dark:text-cyan-300">
                          Wash: {washSentQty} / {lineIntakeQty} Pcs
                        </span>
                        <span className="text-cyan-600 dark:text-cyan-400 font-bold">{washPct}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-cyan-500 rounded-full transition-all duration-300"
                          style={{ width: `${washPct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/70 dark:border-zinc-800 flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
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
                          disabled={isLineDone}
                          onClick={() => handleOpenSendToWash(batch)}
                          className="cursor-pointer gap-2 text-xs font-semibold text-cyan-600 dark:text-cyan-400 focus:text-cyan-600 focus:bg-cyan-50 dark:focus:bg-cyan-950/50"
                        >
                          <Waves className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                          <span>Send to Wash</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setLogSewnBatch(batch);
                            setShowLogSewnSelector(false);
                            setIsLogSewnOpen(true);
                          }}
                          className="cursor-pointer gap-2 text-xs font-semibold text-purple-600 dark:text-purple-400 focus:text-purple-600 focus:bg-purple-50 dark:focus:bg-purple-950/50"
                        >
                          <Shirt className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                          <span>Log Daily Sewn</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setDetailOrder(batch);
                            setIsDetailModalOpen(true);
                          }}
                          className="cursor-pointer gap-2 text-xs font-medium"
                        >
                          <Eye className="w-4 h-4 text-blue-600" />
                          <span>History</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setBatchToRollback(batch)}
                          className="cursor-pointer gap-2 text-xs font-medium text-rose-600 dark:text-rose-400 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/50"
                        >
                          <Trash2 className="w-4 h-4 text-rose-600" />
                          <span>Delete</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Unified Standardized Table Pagination */}
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalCount={filteredBatches.length}
            visibleCount={paginatedBatches.length}
            onPageChange={setCurrentPage}
            itemNoun="batches"
          />
        </>
      )}

      {/* ── Detail History Modal ── */}
      <CuttingDetailModal
        open={isDetailModalOpen}
        onOpenChange={setIsDetailModalOpen}
        order={detailOrder}
        productsList={productsList}
        dark={isDark}
        onRefresh={fetchLineBatches}
      />

      {/* ── Send to Wash Modal ── */}
      <SendToWashModal
        open={isSendToWashOpen}
        onOpenChange={setIsSendToWashOpen}
        batch={selectedBatchForWash}
        productsList={productsList}
        dark={isDark}
        onSuccess={() => {
          fetchLineBatches();
        }}
      />
      {/* ── Log Daily Sewn Modal ── */}
      <LogSewnModal
        open={isLogSewnOpen}
        onOpenChange={setIsLogSewnOpen}
        batch={logSewnBatch}
        batches={batches}
        showBatchSelector={showLogSewnSelector}
        productsList={productsList}
        dark={isDark}
        onSuccess={() => fetchLineBatches()}
      />

      {/* ── AlertDialog: Rollback Sewing Line Stage ── */}
      <AlertDialog open={Boolean(batchToRollback)} onOpenChange={() => setBatchToRollback(null)}>
        <AlertDialogContent className="w-full max-w-lg sm:max-w-xl max-h-[90vh] overflow-y-auto bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-500" />
              Reset Sewing Line Stage #{batchToRollback?.productionNo}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-500 dark:text-zinc-400 space-y-2 pt-2">
              <p>
                Are you sure you want to rollback Sewing Line progress for{' '}
                <strong className="text-slate-900 dark:text-white font-mono font-bold">
                  #{batchToRollback?.productionNo}
                </strong>?
              </p>
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-900 dark:text-rose-200 space-y-1.5">
                <div className="font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                  <span>Line Stage Rollback Impact:</span>
                </div>
                <p>
                  • Resets/deletes the Line stage progress AND any downstream Wash stage progress.
                </p>
                <p>
                  • Reverts any finished product stock increments previously synced to inventory.
                </p>
                <p>
                  • Resets pieces sent from Cutting back to 0 so the record returns cleanly to the Cutting stage.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sticky bottom-0 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm pt-3 border-t border-slate-100 dark:border-zinc-800 gap-2 mt-2">
            <AlertDialogCancel disabled={isRollingBack} className="text-xs rounded-xl">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isRollingBack}
              onClick={handleConfirmRollback}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs rounded-xl font-semibold shadow-sm cursor-pointer"
            >
              {isRollingBack ? 'Resetting...' : 'Yes, Reset to Cutting'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default LinePage;
