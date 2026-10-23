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
import { get } from '../lib/api';
import { getProductImageUrl } from '../lib/utils';
import { toast } from 'react-toastify';
import { BatchStatusBadge } from '../components/production/BatchStatusBadge';
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
} from 'lucide-react';
import ProductionBatchDetailModal, {
  formatSriLankaDateTime,
} from '../components/production/ProductionBatchDetailModal';
import SendToWashModal from '../components/production/SendToWashModal';

interface LineBatchItem {
  id: number;
  productionNo: string;
  productId: number;
  variantId?: number | null;
  targetQuantity: number;
  completedQty: number;
  lineSentQty?: number;
  sentToWashQty: number;
  washedQty: number;
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
}

interface ParsedBatchProduct {
  productId: number;
  variantId?: number | null;
  productName: string;
  sku?: string;
  sentToLineQty: number;
  sentToWashQty: number;
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
        return {
          productId: pId,
          variantId: tp.variantId ? Number(tp.variantId) : null,
          productName: tp.productName || fullProduct?.name || batch.product?.name || `Product #${pId}`,
          sku: tp.sku || fullProduct?.variants?.[0]?.sku || batch.variant?.sku || '',
          sentToLineQty: sentQty,
          sentToWashQty: washQty,
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
      imageUrl: rawImg ? getProductImageUrl(rawImg) : null,
    },
  ];
};

export const LinePage: React.FC = () => {
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const { user } = useAuth();
  const isDark = resolvedTheme === 'dark';

  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<LineBatchItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected batch for Send to Wash Modal
  const [selectedBatchForWash, setSelectedBatchForWash] = useState<LineBatchItem | null>(null);
  const [isSendToWashOpen, setIsSendToWashOpen] = useState(false);

  // Detail Modal
  const [detailOrder, setDetailOrder] = useState<any | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [productsList, setProductsList] = useState<any[]>([]);

  // Fetch all batches currently in 'LINE' status or ongoing 'WASHING' dispatches
  const fetchLineBatches = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await get('/production?status=LINE,WASHING&limit=100');
      const data = res?.data || res;
      const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      // Include batches in LINE, plus WASHING batches that still have garments remaining on the sewing line or are active
      const activeBatches = items.filter((b: any) => {
        if (b.status === 'LINE') return true;
        if (b.status === 'WASHING') {
          const prods = getBatchProducts(b, []);
          const hasRemaining = prods.some((p) => p.sentToLineQty > p.sentToWashQty);
          return hasRemaining || !b.isStockSynced;
        }
        return false;
      });
      setBatches(activeBatches);
    } catch (err: any) {
      console.error('Failed to fetch line batches:', err);
      toast.error('Failed to load batches in Sewing Line stage');
    } finally {
      setLoading(false);
    }
  }, []);

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

  // Client-side search filtering
  const filteredBatches = useMemo(() => {
    if (!searchQuery.trim()) return batches;
    const q = searchQuery.toLowerCase().trim();
    return batches.filter((b) => {
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
  }, [batches, searchQuery, productsList]);

  // Aggregate Metrics for Top KPI Cards
  const metrics = useMemo(() => {
    const totalBatches = batches.length;
    let totalLineIntake = 0;
    let totalForwardedToWash = 0;

    batches.forEach((b) => {
      const prods = getBatchProducts(b, productsList);
      const batchSentTotal = prods.reduce((sum, p) => sum + p.sentToLineQty, 0);
      totalLineIntake += batchSentTotal > 0 ? batchSentTotal : (b.lineSentQty || b.targetQuantity || b.completedQty || 0);
      totalForwardedToWash += b.sentToWashQty || 0;
    });

    const pendingSewing = Math.max(0, totalLineIntake - totalForwardedToWash);

    return {
      totalBatches,
      totalLineIntake,
      totalForwardedToWash,
      pendingSewing,
    };
  }, [batches, productsList]);

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

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLineBatches}
            className="h-9 gap-1.5 rounded-xl text-xs font-semibold"
            title="Refresh Sewing Line"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          <Button
            onClick={() => navigate('/system/production')}
            className="h-9 gap-1.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs cursor-pointer"
          >
            <span>Production Ledger</span>
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
                Active Sewing Batches
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
            Currently active on factory sewing tables
          </p>
        </div>

        {/* Metric 2: Total Intake Units */}
        <div className="rounded-2xl border p-4 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between min-h-[110px]">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                Total Line Intake
              </span>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1 font-mono">
                {metrics.totalLineIntake.toLocaleString()}{' '}
                <span className="text-xs font-medium text-slate-500">Units</span>
              </h3>
            </div>
            <div className="p-2.5 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-xl shrink-0">
              <Layers className="size-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-2">
            Cut garment pieces received from Cutting
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
                {metrics.totalForwardedToWash.toLocaleString()}{' '}
                <span className="text-xs font-medium text-slate-500">Units</span>
              </h3>
            </div>
            <div className="p-2.5 bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 rounded-xl shrink-0">
              <Waves className="size-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-2">
            Sewn bundles forwarded to Wash Plant
          </p>
        </div>

        {/* Metric 4: In Sewing Line */}
        <div className="rounded-2xl border p-4 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between min-h-[110px]">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                In Sewing WIP
              </span>
              <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1 font-mono">
                {metrics.pendingSewing.toLocaleString()}{' '}
                <span className="text-xs font-medium text-slate-500">Units</span>
              </h3>
            </div>
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl shrink-0">
              <Clock className="size-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-2">
            Remaining to be sewn and inspected
          </p>
        </div>
      </div>

      {/* ── Search Bar & Filter ── */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by batch number, garment style, SKU, or notes..."
            className="pl-10 h-10 text-xs rounded-xl bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 shadow-xs"
          />
        </div>
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
          <div className="hidden lg:block rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden shadow-xs">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-zinc-900/80 border-b border-slate-200/80 dark:border-zinc-800">
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 w-32">
                    Batch No
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 w-48">
                    Date &amp; Time
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                    Target Garment Products
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 w-44">
                    Raw Material Cut
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 text-center w-32">
                    Total Line Intake
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 text-center w-28">
                    Sent to Wash
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
                {paginatedBatches.map((batch) => {
                  const prods = getBatchProducts(batch, productsList);
                  const batchTotalDispatched = prods.reduce((sum, p) => sum + p.sentToLineQty, 0);
                  const batchTotalWash = prods.reduce((sum, p) => sum + p.sentToWashQty, 0);
                  const lineQty = batchTotalDispatched > 0 ? batchTotalDispatched : (batch.lineSentQty || batch.targetQuantity || batch.completedQty || 0);
                  const washQty = batchTotalWash > 0 ? batchTotalWash : (batch.sentToWashQty || 0);
                  const remainingOnLine = Math.max(0, lineQty - washQty);
                  const overallPercent = lineQty > 0 ? Math.min(100, Math.round((washQty / lineQty) * 100)) : 0;

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
                      {/* 1. Batch No */}
                      <TableCell className="align-middle">
                        <span className="font-mono font-bold text-xs text-slate-900 dark:text-white block">
                          #{batch.productionNo}
                        </span>
                      </TableCell>

                      {/* 2. Date & Time */}
                      <TableCell className="align-middle text-xs font-mono text-slate-600 dark:text-zinc-400 whitespace-nowrap">
                        {formatSriLankaDateTime(batch.productionDate || batch.createdAt)}
                      </TableCell>

                      {/* 3. Target Garment Products */}
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
                                  />
                                ) : (
                                  <div className="size-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/50 flex items-center justify-center shrink-0 text-indigo-600 dark:text-indigo-400">
                                    <Shirt className="size-4" />
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
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
                                    <span className="text-[10px] text-slate-400 truncate block">
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
                      <TableCell className="align-middle">
                        <div className="space-y-0.5">
                          {batch.materialUsages && batch.materialUsages.length > 0 ? (
                            batch.materialUsages.slice(0, 2).map((u: any) => (
                              <div key={u.id} className="text-xs text-slate-700 dark:text-zinc-300 truncate max-w-[180px]">
                                <span className="font-semibold text-slate-900 dark:text-zinc-100">
                                  {u.rawMaterial?.name || 'Material'}
                                </span>
                                {' · '}
                                <span className="font-mono text-amber-700 dark:text-amber-400 font-semibold">
                                  {u.netConsumedQty ?? u.issuedQty} {u.rawMaterial?.unit || 'Units'}
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
                      <TableCell className="align-middle text-center">
                        <span className="text-xs font-mono font-bold text-slate-800 dark:text-zinc-200">
                          {lineQty} Pcs
                        </span>
                      </TableCell>

                      {/* 6. Sent to Wash */}
                      <TableCell className="align-middle text-center">
                        <span className="text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400">
                          {washQty} Pcs
                        </span>
                      </TableCell>

                      {/* 7. Remaining Progress */}
                      <TableCell className="align-middle">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <span className="font-bold text-amber-600 dark:text-amber-400">
                              {remainingOnLine} Pcs Left
                            </span>
                            <span className="text-slate-400 text-[10px]">{overallPercent}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                              style={{ width: `${overallPercent}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>

                      {/* 8. Status */}
                      <TableCell className="align-middle text-center">
                        <BatchStatusBadge status={batch.status} isStockSynced={batch.isStockSynced} />
                      </TableCell>

                      {/* 9. Action */}
                      <TableCell className="align-middle text-right" onClick={(e) => e.stopPropagation()}>
                        {isLineDone ? (
                          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 font-bold px-2.5 py-1 rounded-xl shrink-0 inline-flex items-center gap-1 shadow-2xs ml-auto">
                            <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>COMPLETED</span>
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleOpenSendToWash(batch)}
                            className="h-8 text-xs bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer ml-auto"
                          >
                            <Waves className="size-3.5" />
                            <span>Send to Wash</span>
                          </Button>
                        )}
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
              const batchTotalDispatched = prods.reduce((sum, p) => sum + p.sentToLineQty, 0);
              const batchTotalWash = prods.reduce((sum, p) => sum + p.sentToWashQty, 0);
              const lineQty = batchTotalDispatched > 0 ? batchTotalDispatched : (batch.lineSentQty || batch.targetQuantity || batch.completedQty || 0);
              const washQty = batchTotalWash > 0 ? batchTotalWash : (batch.sentToWashQty || 0);
              const remainingOnLine = Math.max(0, lineQty - washQty);
              const overallPercent = lineQty > 0 ? Math.min(100, Math.round((washQty / lineQty) * 100)) : 0;

              // "Send to Wash" remains active and accessible as long as sentToLineQty > sentToWashQty for ANY product in the batch
              const hasRemainingToWash = prods.length > 0
                ? prods.some((p) => p.sentToLineQty > p.sentToWashQty)
                : (washQty < lineQty);
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
                    {formatSriLankaDateTime(batch.productionDate || batch.createdAt)}
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
                            <span className="text-[10px] text-indigo-600 font-bold">Intake: {p.sentToLineQty}</span>
                            <span className="text-slate-300">·</span>
                            <span className="text-[10px] text-cyan-600 font-bold">Wash: {p.sentToWashQty}</span>
                            <span className="text-slate-300">·</span>
                            <span className="text-[10px] text-amber-600 font-bold">Rem: {Math.max(0, p.sentToLineQty - p.sentToWashQty)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Metrics Row */}
                  <div className="grid grid-cols-3 gap-2 text-center p-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800 text-xs">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Line Intake</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-zinc-200">
                        {lineQty} Pcs
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-cyan-600 block">Sent to Wash</span>
                      <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">
                        {washQty} Pcs
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-amber-600 block">Remaining</span>
                      <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                        {remainingOnLine} Pcs
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>Forwarded to Wash Progress</span>
                      <span className="font-bold text-slate-700 dark:text-zinc-300">{overallPercent}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                        style={{ width: `${overallPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="pt-1 flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                    {isLineDone ? (
                      <div className="w-full flex items-center justify-center p-2 rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-bold text-xs gap-1.5 shadow-2xs">
                        <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                        <span>LINE STAGE COMPLETED</span>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleOpenSendToWash(batch)}
                        className="h-8 text-xs bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-xs w-full justify-center cursor-pointer"
                      >
                        <Waves className="size-3.5" />
                        <span>Send to Wash</span>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500">
                Page {currentPage} of {totalPages} ({filteredBatches.length} batches)
              </span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Detail History Modal ── */}
      <ProductionBatchDetailModal
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
    </div>
  );
};

export default LinePage;
