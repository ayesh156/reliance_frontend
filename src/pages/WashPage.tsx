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
import { get, post } from '../lib/api';
import { getProductImageUrl } from '../lib/utils';
import { toast } from 'react-toastify';
import { BatchStatusBadge } from '../components/production/BatchStatusBadge';
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
} from 'lucide-react';
import ProductionBatchDetailModal from '../components/production/ProductionBatchDetailModal';

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
  const [washDateTime, setWashDateTime] = useState<string>('');
  const [washNotes, setWashNotes] = useState<string>('');
  const [isSubmittingWash, setIsSubmittingWash] = useState(false);

  // Detail Modal
  const [detailOrder, setDetailOrder] = useState<any | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [rawMaterialsList, setRawMaterialsList] = useState<any[]>([]);
  const [productsList, setProductsList] = useState<any[]>([]);

  // Fetch all batches currently in 'WASHING' status
  const fetchWashBatches = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await get('/production', { status: 'WASHING', limit: 100 });
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

  // Filtered batches by search query
  const filteredBatches = useMemo(() => {
    if (!searchQuery.trim()) return batches;
    const q = searchQuery.toLowerCase().trim();
    return batches.filter(
      (b) =>
        b.productionNo?.toLowerCase().includes(q) ||
        b.product?.name?.toLowerCase().includes(q) ||
        b.reason?.toLowerCase().includes(q) ||
        b.notes?.toLowerCase().includes(q)
    );
  }, [batches, searchQuery]);

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

  // Extract all target products mapped to the batch for washing
  const getBatchProducts = useCallback((b: WashBatchItem | null) => {
    if (!b) return [];
    const list: Array<{
      productId: number;
      variantId?: number | null;
      productName: string;
      sku?: string;
      barcode?: string;
      totalSent: number;
      alreadyWashed: number;
      remaining: number;
      imageUrl?: string | null;
    }> = [];

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
        const sent = Number(tp.sentToWashQty) > 0 ? Number(tp.sentToWashQty) : (Number(tp.plannedQty) || 0);
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
      const sent = b.sentToWashQty > 0
        ? b.sentToWashQty
        : (b.targetQuantity > 0 ? b.targetQuantity : b.completedQty);
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
  }, []);

  // Open "Log Washed Items" modal
  const handleOpenLogWashModal = (batch: WashBatchItem) => {
    setSelectedBatch(batch);
    const prods = getBatchProducts(batch);
    const initialQtys: Record<number, number | ''> = {};
    prods.forEach((p, idx) => {
      initialQtys[idx] = p.remaining > 0 ? p.remaining : '';
    });
    setWashProductQuantities(initialQtys);

    const sent = batch.sentToWashQty > 0
      ? batch.sentToWashQty
      : (batch.targetQuantity > 0 ? batch.targetQuantity : batch.completedQty);
    const washed = batch.washedQty || 0;
    const remaining = Math.max(0, sent - washed);

    setWashQuantity(remaining > 0 ? remaining : '');
    setWashDateTime(new Date().toISOString().slice(0, 16));
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

      {/* ── Search Bar ── */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Search by batch number, garment name, or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs rounded-xl bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800"
          />
        </div>
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearchQuery('')}
            className="h-8 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white"
          >
            Clear Search
          </Button>
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
          <div className="hidden lg:block rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden shadow-xs">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-zinc-900/80 border-b border-slate-200/80 dark:border-zinc-800">
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 w-36">
                    Batch No
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                    Target Garment Style
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 text-center w-28">
                    Sent to Wash
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 text-center w-32">
                    Washed &amp; Sold
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 w-44">
                    Remaining Progress
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 text-center w-28">
                    Status
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 text-right w-40">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBatches.map((batch) => {
                  const sent = batch.sentToWashQty > 0
                    ? batch.sentToWashQty
                    : (batch.targetQuantity > 0 ? batch.targetQuantity : batch.completedQty);
                  const washed = batch.washedQty || 0;
                  const remaining = Math.max(0, sent - washed);
                  const percent = sent > 0 ? Math.min(100, Math.round((washed / sent) * 100)) : 0;

                  const prodImg = batch.product?.images?.[0]?.imageUrl;
                  const resolvedImg = prodImg ? getProductImageUrl(prodImg) : null;

                  return (
                    <TableRow
                      key={batch.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-zinc-900/50 transition-colors cursor-pointer border-b border-slate-100 dark:border-zinc-800/80"
                      onClick={() => {
                        setDetailOrder(batch);
                        setIsDetailModalOpen(true);
                      }}
                    >
                      {/* Batch No & Date */}
                      <TableCell className="align-middle">
                        <span className="font-mono font-bold text-xs text-slate-900 dark:text-white block">
                          #{batch.productionNo}
                        </span>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3" />
                          {new Date(batch.productionDate).toLocaleDateString()}
                        </span>
                      </TableCell>

                      {/* Product Style */}
                      <TableCell className="align-middle">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {resolvedImg ? (
                            <img
                              src={resolvedImg}
                              alt={batch.product?.name}
                              className="size-9 rounded-lg object-cover border border-slate-200 dark:border-zinc-700 shrink-0"
                            />
                          ) : (
                            <div className="size-9 rounded-lg bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-900/50 flex items-center justify-center shrink-0 text-cyan-600 dark:text-cyan-400">
                              <Shirt className="size-4" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-slate-900 dark:text-white truncate block">
                              {batch.product?.name}
                            </span>
                            <span className="text-[10px] text-slate-400 truncate block">
                              {batch.variant?.sku ? `SKU: ${batch.variant.sku}` : batch.reason || 'Garment Batch'}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      {/* Sent to Wash */}
                      <TableCell className="align-middle text-center">
                        <span className="text-xs font-mono font-bold text-slate-800 dark:text-zinc-200">
                          {sent} Pcs
                        </span>
                      </TableCell>

                      {/* Washed & In Stock */}
                      <TableCell className="align-middle text-center">
                        <span className="text-xs font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                          +{washed} Pcs
                        </span>
                      </TableCell>

                      {/* Remaining & Progress */}
                      <TableCell className="align-middle">
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

                      {/* Status */}
                      <TableCell className="align-middle text-center">
                        <BatchStatusBadge status={batch.status} isStockSynced={batch.isStockSynced} />
                      </TableCell>

                      {/* Action */}
                      <TableCell className="align-middle text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          onClick={() => handleOpenLogWashModal(batch)}
                          className="h-8 text-xs bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer ml-auto"
                        >
                          <Waves className="w-3.5 h-3.5" />
                          <span>Log Washed Items</span>
                        </Button>
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
              const sent = batch.sentToWashQty > 0
                ? batch.sentToWashQty
                : (batch.targetQuantity > 0 ? batch.targetQuantity : batch.completedQty);
              const washed = batch.washedQty || 0;
              const remaining = Math.max(0, sent - washed);
              const percent = sent > 0 ? Math.min(100, Math.round((washed / sent) * 100)) : 0;

              const prodImg = batch.product?.images?.[0]?.imageUrl;
              const resolvedImg = prodImg ? getProductImageUrl(prodImg) : null;

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
                      <span className="text-[10px] text-slate-400">
                        {new Date(batch.productionDate).toLocaleDateString()}
                      </span>
                    </div>
                    <BatchStatusBadge status={batch.status} isStockSynced={batch.isStockSynced} />
                  </div>

                  {/* Garment Details */}
                  <div className="flex items-center gap-2.5">
                    {resolvedImg ? (
                      <img
                        src={resolvedImg}
                        alt={batch.product?.name}
                        className="size-11 rounded-xl object-cover border border-slate-200 dark:border-zinc-700 shrink-0"
                      />
                    ) : (
                      <div className="size-11 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-900/50 flex items-center justify-center shrink-0 text-cyan-600 dark:text-cyan-400">
                        <Shirt className="size-5" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {batch.product?.name}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                        {batch.variant?.sku ? `SKU: ${batch.variant.sku}` : batch.reason || 'Garment Style'}
                      </p>
                    </div>
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
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDetailOrder(batch);
                        setIsDetailModalOpen(true);
                      }}
                      className="flex-1 h-8 text-xs rounded-xl font-medium"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" />
                      <span>Details</span>
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleOpenLogWashModal(batch)}
                      className="flex-1 h-8 text-xs bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-xl flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <Waves className="w-3.5 h-3.5" />
                      <span>Log Washed Items</span>
                    </Button>
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
        <DialogContent className="w-[96vw] sm:max-w-2xl lg:max-w-3xl max-h-[92vh] flex flex-col p-0 gap-0 rounded-2xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 shadow-2xl">
          {selectedBatch && (() => {
            const products = getBatchProducts(selectedBatch);
            const totalToWashNow = products.reduce((sum, _, idx) => {
              const val = washProductQuantities[idx];
              return sum + (typeof val === 'number' && !isNaN(val) ? val : 0);
            }, 0);

            const totalBatchSent = selectedBatch.sentToWashQty > 0
              ? selectedBatch.sentToWashQty
              : (selectedBatch.targetQuantity > 0 ? selectedBatch.targetQuantity : selectedBatch.completedQty);
            const currentTotalWashed = selectedBatch.washedQty || 0;
            const currentTotalRemaining = Math.max(0, totalBatchSent - currentTotalWashed);
            const newRemainingPreview = Math.max(0, currentTotalRemaining - totalToWashNow);
            const willBeCompleted = totalToWashNow >= currentTotalRemaining && totalToWashNow > 0;

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
                          <span>Log Washed Items — Batch #{selectedBatch.productionNo}</span>
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
                    {/* Real-time Dynamic Info Banner */}
                    <div className={`p-3 rounded-xl border text-xs space-y-1 transition-colors ${
                      willBeCompleted
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-200'
                        : 'bg-cyan-50/70 dark:bg-cyan-950/30 border-cyan-200 dark:border-cyan-900/50 text-cyan-950 dark:text-cyan-200'
                    }`}>
                      <div className="flex items-center gap-1.5 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Immediate Sellable Stock Sync:</span>
                      </div>
                      <p>
                        {totalToWashNow > 0 ? (
                          willBeCompleted ? (
                            <>
                              Logging <strong>+{totalToWashNow}</strong> washed items will immediately increment active sellable product stock and transition Batch #{selectedBatch.productionNo} to <strong>COMPLETED</strong>!
                            </>
                          ) : (
                            <>
                              Logging <strong>+{totalToWashNow}</strong> washed items will immediately increment sellable stock. The batch will remain in <strong>WASHING</strong> status with <strong>{newRemainingPreview}</strong> pieces remaining.
                            </>
                          )
                        ) : (
                          'Enter the quantities of washed products ready for sale to increment sellable inventory.'
                        )}
                      </p>
                    </div>

                    {/* Products List */}
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
                              <div className="flex items-center justify-between gap-3 flex-wrap">
                                {/* Thumbnail & Info */}
                                <div className="flex items-center gap-3 min-w-0">
                                  {p.imageUrl ? (
                                    <img
                                      src={p.imageUrl}
                                      alt={p.productName}
                                      className="size-10 rounded-lg object-cover border border-slate-200 dark:border-zinc-700 shrink-0"
                                    />
                                  ) : (
                                    <div className="size-10 rounded-lg bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-900/50 flex items-center justify-center shrink-0">
                                      <Shirt className="size-5 text-cyan-600 dark:text-cyan-400" />
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <h5 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                      {p.productName}
                                    </h5>
                                    {p.sku && (
                                      <span className="text-[10px] text-slate-500 dark:text-zinc-400 block mt-0.5">
                                        SKU: {p.sku}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* 3 Metrics: Total Sent to Wash, Already Washed, Remaining */}
                                <div className="flex items-center gap-2 text-xs">
                                  <div className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-center">
                                    <span className="text-[9px] uppercase font-bold text-slate-400 block">
                                      Total Sent to Wash
                                    </span>
                                    <span className="font-mono font-bold text-slate-800 dark:text-zinc-200">
                                      {p.totalSent} Pcs
                                    </span>
                                  </div>
                                  <div className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-center">
                                    <span className="text-[9px] uppercase font-bold text-emerald-600 block">
                                      Already Washed
                                    </span>
                                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                      +{p.alreadyWashed} Pcs
                                    </span>
                                  </div>
                                  <div className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-center">
                                    <span className="text-[9px] uppercase font-bold text-amber-600 block">
                                      Remaining
                                    </span>
                                    <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                                      {p.remaining} Pcs
                                    </span>
                                  </div>
                                </div>
                              </div>

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
                                <div className="w-36">
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
                                    className="h-9 text-xs text-right font-mono font-bold text-cyan-700 dark:text-cyan-300 rounded-xl bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Inspection Date & Time */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block">
                        Date &amp; Time of Wash Inspection
                      </label>
                      <DateTimePicker
                        value={washDateTime}
                        onChange={setWashDateTime}
                      />
                    </div>

                    {/* Quality Inspection Remarks */}
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
        <ProductionBatchDetailModal
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
    </div>
  );
};

export default WashPage;
