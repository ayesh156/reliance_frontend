import React, { useMemo } from 'react';
import {
  Scissors,
  Shirt,
  Clock,
  Package,
  FileText,
  Loader2,
  Printer,
  Sparkles,
  Droplets,
  PackageCheck,
  TrendingUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { TooltipSimple } from '../ui/tooltip';
import { formatQty, formatCurrency } from '../../lib/utils';
import { generateGarmentProductionPdf } from '../../utils/reportPdf';

export interface GarmentProductionReportProps {
  reportData?: {
    summary?: any;
    tableItems?: any[];
    dateFilter?: any;
  } | null;
  filteredRows?: any[];
  loading?: boolean;
  dateRangeLabel?: string;
  generatedBy?: string;
  dark?: boolean;
  onSelectBatch?: (batch: any) => void;
  onDownloadPdf?: () => void;
  downloadingPdf?: boolean;
}

/**
 * GarmentProductionReport Component:
 * Encapsulates the comprehensive 6-stage garment production funnel:
 *  1. Total Cut Pieces: Sum of cutQty
 *  2. In Sewing Line (WIP): Sum of (cutQty - sewnQty) for active lines
 *  3. Total Sewn Output: Sum of sewnQty
 *  4. In Wash / Washed: Sum of sentToWashQty + washedQty
 *  5. Ironed & Packed: Aggregate from finishLogs or completedQty
 *  6. Fully Finished / Synced: Sum of completedQty synced to inventory
 * 
 * Enforces strict 2-decimal formatting via formatQty to eliminate floating-point precision bugs.
 */
export const GarmentProductionReport: React.FC<GarmentProductionReportProps> = ({
  reportData,
  filteredRows,
  loading = false,
  dateRangeLabel,
  generatedBy,
  dark = false,
  onSelectBatch,
  onDownloadPdf,
  downloadingPdf = false,
}) => {
  const rows = useMemo(() => {
    return filteredRows || reportData?.tableItems || [];
  }, [filteredRows, reportData]);

  const summary = reportData?.summary || {};

  // Dynamically compute real-time KPIs across filtered batches for the 6-stage funnel
  const kpis = useMemo(() => {
    const totalBatches = rows.length;

    // 1. Stage 1 (Cutting): Total Cut Pieces - Sum of cutQty
    const totalCutPieces = rows.reduce((sum, row) => {
      const cut = Number(row.cutQty > 0 ? row.cutQty : (row.totalCutUnits ?? (Array.isArray(row.cutLogs) && row.cutLogs.length > 0
        ? row.cutLogs.reduce((acc: number, c: any) => acc + (c.quantityCut || 0), 0)
        : (row.completedQty || row.targetQuantity || 0))));
      return sum + cut;
    }, 0);

    // 2. Stage 2 (Line WIP): In Sewing Line (WIP) - Sum of (cutQty - sewnQty)
    const inSewingWip = rows.reduce((sum, row) => {
      if (row.status !== 'CANCELLED' && row.status !== 'COMPLETED') {
        const cut = Number(row.cutQty > 0 ? row.cutQty : (row.lineSentQty > 0 ? row.lineSentQty : (row.totalCutUnits ?? row.targetQuantity ?? 0)));
        const sewn = Number(row.sewnQty || 0);
        return sum + Math.max(0, cut - sewn);
      }
      return sum;
    }, 0);

    // 3. Stage 3 (Sewn Output): Total Sewn Output - Sum of sewnQty
    const totalSewnOutput = rows.reduce((sum, row) => sum + Number(row.sewnQty || 0), 0);

    // 4. Stage 4 (Wash): In Wash / Washed - Sum of sentToWashQty + washedQty
    const inWashTotal = rows.reduce((sum, row) => {
      const sentWash = Number(row.sentToWashQty || 0);
      const washed = Number(row.washedQty || 0);
      return sum + sentWash + washed;
    }, 0);

    // 5. Stage 5 (Iron & Pack): Ironed & Packed - FinishingLog aggregate or completedQty
    const ironedAndPacked = rows.reduce((sum, row) => {
      const logged = Array.isArray(row.finishLogs) && row.finishLogs.length > 0
        ? row.finishLogs.reduce((acc: number, f: any) => acc + (Number(f.quantityFinished) || 0), 0)
        : 0;
      return sum + (logged > 0 ? logged : Number(row.completedQty ?? row.washedQty ?? 0));
    }, 0);

    // 6. Stage 6 (Finished Stock): Fully Finished / Synced to Inventory
    const fullyFinishedSynced = rows.reduce((sum, row) => {
      const isSynced = Boolean(row.isStockSynced) && row.status !== 'CANCELLED';
      const finished = Number(row.completedQty > 0 ? row.completedQty : (row.washedQty || 0));
      return isSynced ? sum + finished : sum;
    }, 0);

    const pendingStockSync = rows.reduce((sum, row) => {
      const finished = Number(row.washedQty > 0 ? row.washedQty : (row.completedQty ?? 0));
      const isCompleted = row.status !== 'CANCELLED' && (finished > 0 || row.status === 'COMPLETED');
      return (!row.isStockSynced && isCompleted) ? sum + finished : sum;
    }, 0);

    const targetQuantity = rows.reduce((sum, row) => sum + Number(row.targetQuantity || 0), 0);
    const overallYieldDivisor = totalCutPieces > 0 ? totalCutPieces : targetQuantity;
    const overallYieldPercentage = overallYieldDivisor > 0
      ? Math.round((ironedAndPacked / overallYieldDivisor) * 1000) / 10
      : (summary.overallYieldPercentage || 0);

    return {
      totalBatches,
      totalCutPieces,
      inSewingWip,
      totalSewnOutput,
      inWashTotal,
      ironedAndPacked,
      fullyFinishedSynced,
      pendingStockSync,
      overallYieldPercentage,
    };
  }, [rows, summary]);

  // Chart data mapping for 6-Stage Production Funnel Trends
  const chartData = useMemo(() => {
    const daily = summary?.dailyTrends;
    if (Array.isArray(daily) && daily.length > 0) {
      return daily.slice(0, 10).map((d: any) => ({
        name: d.date ? d.date.slice(5) : 'Date',
        cutQty: Math.round((d.cutQty || 0) * 100) / 100,
        sewnQty: Math.round((d.sewnQty || 0) * 100) / 100,
        washedQty: Math.round((d.washedQty || 0) * 100) / 100,
        finishedQty: Math.round((d.finishedQty || 0) * 100) / 100,
      })).reverse();
    }
    return rows.slice(0, 10).map((item: any) => ({
      name: item.productionNo,
      cutQty: Math.round(Number(item.cutQty || item.totalCutUnits || 0) * 100) / 100,
      sewnQty: Math.round(Number(item.sewnQty || 0) * 100) / 100,
      washedQty: Math.round(Number(item.washedQty || 0) * 100) / 100,
      finishedQty: Math.round(Number(item.completedQty || item.totalFinishedUnits || 0) * 100) / 100,
    }));
  }, [summary, rows]);

  const handleExportPdf = async () => {
    if (onDownloadPdf) {
      onDownloadPdf();
      return;
    }
    if (!reportData) return;
    await generateGarmentProductionPdf(reportData, {
      dateRangeLabel,
      generatedBy,
    });
  };

  return (
    <div className="space-y-6">
      {/* 6-Stage Production Funnel Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Stage 1: Total Cut Pieces */}
        <div className={`p-3 sm:p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Total Cut Pieces</p>
            <Scissors className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <p className="text-lg md:text-xl font-bold mt-1 text-amber-600 dark:text-amber-400 font-mono">
            {formatQty(kpis.totalCutPieces)} <span className="text-xs font-medium text-slate-500">Units</span>
          </p>
          <p className="text-[11px] text-slate-400 mt-1">{kpis.totalBatches} Batches Started</p>
        </div>

        {/* Stage 2: In Sewing Line (WIP) */}
        <div className={`p-3 sm:p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">In Sewing Line (WIP)</p>
            <Clock className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <p className="text-lg md:text-xl font-bold mt-1 text-indigo-600 dark:text-indigo-400 font-mono">
            {formatQty(kpis.inSewingWip)} <span className="text-xs font-medium text-slate-500">Pcs</span>
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Ongoing in Sewing floor</p>
        </div>

        {/* Stage 3: Total Sewn Output */}
        <div className={`p-3 sm:p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Total Sewn Output</p>
            <Sparkles className="w-3.5 h-3.5 text-purple-500" />
          </div>
          <p className="text-lg md:text-xl font-bold mt-1 text-purple-600 dark:text-purple-400 font-mono">
            {formatQty(kpis.totalSewnOutput)} <span className="text-xs font-medium text-slate-500">Pcs</span>
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Exited Sewing floor</p>
        </div>

        {/* Stage 4: In Wash / Washed */}
        <div className={`p-3 sm:p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">In Wash / Washed</p>
            <Droplets className="w-3.5 h-3.5 text-cyan-500" />
          </div>
          <p className="text-lg md:text-xl font-bold mt-1 text-cyan-600 dark:text-cyan-400 font-mono">
            {formatQty(kpis.inWashTotal)} <span className="text-xs font-medium text-slate-500">Pcs</span>
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Wet Processing pipeline</p>
        </div>

        {/* Stage 5: Ironed & Packed */}
        <div className={`p-3 sm:p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Ironed &amp; Packed</p>
            <PackageCheck className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <p className="text-lg md:text-xl font-bold mt-1 text-emerald-600 dark:text-emerald-400 font-mono">
            {formatQty(kpis.ironedAndPacked)} <span className="text-xs font-medium text-slate-500">Pcs</span>
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Yield: {formatQty(kpis.overallYieldPercentage)}%</p>
        </div>

        {/* Stage 6: Fully Finished / Synced */}
        <div className={`p-3 sm:p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Fully Finished / Synced</p>
            <Package className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <p className="text-lg md:text-xl font-bold mt-1 text-blue-600 dark:text-blue-400 font-mono">
            {formatQty(kpis.fullyFinishedSynced)} <span className="text-xs font-medium text-slate-500">Pcs</span>
          </p>
          <p className="text-[11px] text-purple-500/80 mt-1">
            {kpis.pendingStockSync > 0 ? `${formatQty(kpis.pendingStockSync)} Pcs Pending Sync` : 'Confirmed In Warehouse'}
          </p>
        </div>
      </div>

      {/* Cutting vs Finishing Output Trends Chart (6-Stage Production Funnel Trends) */}
      {chartData.length > 0 && (
        <div className={`p-4 sm:p-5 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold tracking-tight">Cutting vs Finishing Output Trends (6-Stage Funnel)</h3>
              <p className="text-xs text-slate-400">Multi-stage throughput comparison: Cut vs. Sewn vs. Washed vs. Finished</p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" stroke={dark ? '#71717a' : '#94a3b8'} fontSize={11} />
                <YAxis stroke={dark ? '#71717a' : '#94a3b8'} fontSize={11} />
                <RechartsTooltip />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                <Bar dataKey="cutQty" name="1. Cut Pieces" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="sewnQty" name="2. Sewn Output" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="washedQty" name="3. In Wash / Washed" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                <Bar dataKey="finishedQty" name="4. Finished / Packed" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

export default GarmentProductionReport;

