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
import { formatQty, formatCurrency, getProductImageUrl } from '../../lib/utils';
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
    const totalBatches = summary.totalBatches ?? rows.length;

    // Strictly prioritize backend summary's stage-specific event-logging sums over batch row aggregations
    const totalCutPieces = summary.totalCutPieces !== undefined
      ? Number(summary.totalCutPieces)
      : rows.reduce((sum, row) => {
          const cut = Number(row.cutQty > 0 ? row.cutQty : (row.totalCutUnits ?? (Array.isArray(row.cutLogs) && row.cutLogs.length > 0
            ? row.cutLogs.reduce((acc: number, c: any) => acc + (c.quantityCut || 0), 0)
            : (row.completedQty || row.targetQuantity || 0))));
          return sum + cut;
        }, 0);

    // 2. Stage 2 (Line WIP): In Sewing Line (WIP)
    const inSewingWip = summary.inSewingWip !== undefined
      ? Number(summary.inSewingWip)
      : rows.reduce((sum, row) => {
          if (row.status !== 'CANCELLED' && row.status !== 'COMPLETED') {
            const cut = Number(row.cutQty > 0 ? row.cutQty : (row.lineSentQty > 0 ? row.lineSentQty : (row.totalCutUnits ?? row.targetQuantity ?? 0)));
            const sewn = Number(row.sewnQty || 0);
            return sum + Math.max(0, cut - sewn);
          }
          return sum;
        }, 0);

    // 3. Stage 3 (Sewn Output): Total Sewn Output strictly prioritized from isolated backend summary
    const totalSewnOutput = summary.totalSewnOutput !== undefined
      ? Number(summary.totalSewnOutput)
      : rows.reduce((sum, row) => {
          const loggedSewn = Array.isArray(row.activityLogs)
            ? row.activityLogs
                .filter((a: any) => a.action === 'LOG_SEWN' || a.action === 'SEWN' || (a.stage === 'LINE' && String(a.action || '').includes('SEWN')))
                .reduce((acc: number, l: any) => acc + (Number(l.quantity) || 0), 0)
            : 0;
          return sum + (loggedSewn > 0 ? loggedSewn : Number(row.sewnQty || 0));
        }, 0);

    // 4. Stage 4 (Wash): In Wash / Washed strictly prioritized from isolated backend summary
    const inWashTotal = summary.inWashTotal !== undefined
      ? Number(summary.inWashTotal)
      : rows.reduce((sum, row) => {
          const loggedWash = Array.isArray(row.activityLogs)
            ? row.activityLogs
                .filter((a: any) => a.stage === 'WASHING' || String(a.action || '').includes('WASH'))
                .reduce((acc: number, l: any) => acc + (Number(l.quantity) || 0), 0)
            : 0;
          return sum + (loggedWash > 0 ? loggedWash : (Number(row.sentToWashQty || 0) + Number(row.washedQty || 0)));
        }, 0);

    // 5. Stage 5 (Iron & Pack): Ironed & Packed strictly prioritized from isolated backend summary
    const ironedAndPacked = summary.ironedAndPacked !== undefined
      ? Number(summary.ironedAndPacked)
      : rows.reduce((sum, row) => {
          const logged = Array.isArray(row.finishLogs) && row.finishLogs.length > 0
            ? row.finishLogs.reduce((acc: number, f: any) => acc + (Number(f.quantityFinished) || 0), 0)
            : 0;
          return sum + logged;
        }, 0);

    // 6. Stage 6 (Finished Stock): Fully Finished / Synced to Inventory
    const fullyFinishedSynced = summary.fullyFinishedSynced !== undefined
      ? Number(summary.fullyFinishedSynced)
      : rows.reduce((sum, row) => {
          const isSynced = Boolean(row.isStockSynced) && row.status !== 'CANCELLED';
          const finished = Number(row.completedQty || 0) > 0 ? Number(row.completedQty) : Number(row.washedQty || 0);
          return isSynced ? sum + finished : sum;
        }, 0);

    const pendingStockSync = rows.reduce((sum, row) => {
      const finished = Number(row.completedQty || 0) > 0 ? Number(row.completedQty) : Number(row.washedQty || 0);
      const isCompleted = row.status !== 'CANCELLED' && (finished > 0 || row.status === 'COMPLETED');
      return (!row.isStockSynced && isCompleted) ? sum + finished : sum;
    }, 0);

    const targetQuantity = rows.reduce((sum, row) => sum + Number(row.targetQuantity || 0), 0);
    const overallYieldDivisor = totalCutPieces > 0 ? totalCutPieces : targetQuantity;
    const overallYieldPercentage = overallYieldDivisor > 0
      ? Math.round((ironedAndPacked / overallYieldDivisor) * 10000) / 100
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
  // Groups accurately filtered stage logs (Cut, Sewn, Wash, Finish) by their execution dates
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

    // Dynamic extraction of stage-specific logs grouped by execution date
    const dateMap: Record<string, { date: string; cutQty: number; sewnQty: number; washedQty: number; finishedQty: number }> = {};

    const getDay = (dateStr: string) => {
      const d = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.slice(0, 10);
      if (!dateMap[d]) {
        dateMap[d] = { date: d, cutQty: 0, sewnQty: 0, washedQty: 0, finishedQty: 0 };
      }
      return dateMap[d];
    };

    rows.forEach((row: any) => {
      // 1. Cut logs by cutDate
      if (Array.isArray(row.cutLogs) && row.cutLogs.length > 0) {
        row.cutLogs.forEach((cl: any) => {
          if (cl.cutDate) getDay(cl.cutDate).cutQty += Number(cl.quantityCut || 0);
        });
      } else if (row.productionDate) {
        getDay(row.productionDate).cutQty += Number(row.cutQty || row.totalCutUnits || 0);
      }

      // 2. Sewn and Wash logs by timestamp from activityLogs
      if (Array.isArray(row.activityLogs) && row.activityLogs.length > 0) {
        row.activityLogs.forEach((al: any) => {
          if (!al.timestamp) return;
          const act = String(al.action || '').toUpperCase();
          const stg = String(al.stage || '').toUpperCase();
          const q = Number(al.quantity || 0);

          if (act === 'SEWN' || act === 'LOG_SEWN' || stg === 'LINE') {
            getDay(al.timestamp).sewnQty += q;
          } else if (stg === 'WASHING' || act.includes('WASH')) {
            getDay(al.timestamp).washedQty += q;
          } else if (stg === 'COMPLETED' || act === 'FINALIZED') {
            getDay(al.timestamp).finishedQty += q;
          }
        });
      } else {
        if (row.productionDate && Number(row.sewnQty || 0) > 0) {
          getDay(row.productionDate).sewnQty += Number(row.sewnQty);
        }
        if (row.productionDate && Number(row.washedQty || 0) > 0) {
          getDay(row.productionDate).washedQty += Number(row.washedQty);
        }
      }

      // 3. Finish logs by finishDate or date
      if (Array.isArray(row.finishLogs) && row.finishLogs.length > 0) {
        row.finishLogs.forEach((fl: any) => {
          const fDate = fl.finishDate || fl.date;
          if (fDate) getDay(fDate).finishedQty += Number(fl.quantityFinished || fl.quantity || 0);
        });
      } else if (Number(row.completedQty || 0) > 0) {
        const fDate = row.stockSyncedAt || row.productionDate;
        if (fDate) getDay(fDate).finishedQty += Number(row.completedQty);
      }
    });

    const sortedDays = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));
    if (sortedDays.length > 0) {
      return sortedDays.slice(-10).map((d) => ({
        name: d.date ? d.date.slice(5) : 'Date',
        cutQty: Math.round(d.cutQty * 100) / 100,
        sewnQty: Math.round(d.sewnQty * 100) / 100,
        washedQty: Math.round(d.washedQty * 100) / 100,
        finishedQty: Math.round(d.finishedQty * 100) / 100,
      }));
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

      {/* Production Batches Detailed Table with Resolved Funnel Metrics */}
      <div className={`rounded-2xl border overflow-hidden ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="p-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold tracking-tight">Production Batches &amp; Stage Yield Audit</h3>
            <p className="text-xs text-slate-400">Order-level intake, stage throughput, yield efficiency, and inventory sync status</p>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            {rows.length} Batches
          </Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className={`border-b text-[11px] font-bold uppercase tracking-wider ${dark ? 'border-zinc-800 text-zinc-400 bg-zinc-900/90' : 'border-slate-200 text-slate-500 bg-slate-50'}`}>
                <th className="py-2.5 px-3">Batch No</th>
                <th className="py-2.5 px-3 min-w-[160px]">Garment Style</th>
                <th className="py-2.5 px-3">Size / Color</th>
                <th className="py-2.5 px-3 text-center">Target</th>
                <th className="py-2.5 px-3 text-center">Cut Units</th>
                <th className="py-2.5 px-3 text-center">Finished</th>
                <th className="py-2.5 px-3 text-center">WIP Units</th>
                <th className="py-2.5 px-3 text-center">Yield %</th>
                <th className="py-2.5 px-3 text-right">Material Cost</th>
                <th className="py-2.5 px-3 text-right">Scrap Returned</th>
                <th className="py-2.5 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 font-medium">
              {rows.map((row: any) => {
                const cut = Number(
                  row.cutQty > 0
                    ? row.cutQty
                    : (row.totalCutUnits ?? (Array.isArray(row.cutLogs) && row.cutLogs.length > 0
                      ? row.cutLogs.reduce((acc: number, c: any) => acc + (Number(c.quantityCut) || 0), 0)
                      : (row.targetQuantity || 0)))
                );

                const loggedFinish = Array.isArray(row.finishLogs) && row.finishLogs.length > 0
                  ? row.finishLogs.reduce((acc: number, f: any) => acc + (Number(f.quantityFinished) || 0), 0)
                  : 0;
                const finished = loggedFinish > 0
                  ? loggedFinish
                  : (Number(row.completedQty || 0) > 0
                    ? Number(row.completedQty)
                    : Number(row.washedQty || 0));

                const wip = row.wipUnits !== undefined && Number(row.wipUnits) >= 0
                  ? Number(row.wipUnits)
                  : (row.status !== 'CANCELLED' && row.status !== 'COMPLETED' ? Math.max(0, cut - finished) : 0);

                const yieldDivisor = cut > 0 ? cut : Number(row.targetQuantity || 0);
                const yieldVal = row.yieldPercentage !== undefined && Number(row.yieldPercentage) > 0
                  ? Number(row.yieldPercentage)
                  : (yieldDivisor > 0 ? Math.round((finished / yieldDivisor) * 10000) / 100 : 0);

                const scrap = Number(
                  row.scrapReturned !== undefined && Number(row.scrapReturned) > 0
                    ? row.scrapReturned
                    : (Array.isArray(row.materialUsages) && row.materialUsages.length > 0
                      ? row.materialUsages.reduce((s: number, u: any) => s + Number(u.returnedScrap ?? u.returnedQty ?? 0), 0)
                      : (Array.isArray(row.activityLogs)
                        ? row.activityLogs
                            .filter((a: any) => a.action === 'RETURNED_SCRAP' || a.action === 'RETURNED')
                            .reduce((s: number, a: any) => s + Number(a.quantity || 0), 0)
                        : 0))
                );

                return (
                  <tr
                    key={row.id || row.productionNo}
                    onClick={() => onSelectBatch && onSelectBatch(row)}
                    className={`hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors ${onSelectBatch ? 'cursor-pointer' : ''}`}
                  >
                    <td className="py-2.5 px-3 font-mono font-medium text-blue-600 dark:text-blue-400 whitespace-nowrap">
                      {row.productionNo}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-zinc-200">
                      <div className="flex items-center gap-2">
                        {row.productImage ? (
                          <img
                            src={getProductImageUrl(row.productImage)}
                            alt=""
                            className="size-7 rounded-md object-cover border border-slate-200 dark:border-zinc-700 shrink-0"
                          />
                        ) : (
                          <div className="size-7 rounded-md bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center text-slate-400 shrink-0">
                            <Package className="size-3.5" />
                          </div>
                        )}
                        <span>{row.productName || 'Garment'}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                      {row.variant || 'Standard'}
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      {formatQty(row.targetQuantity || 0)}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                      {formatQty(cut)}
                      {row.cutLogsCount > 0 && (
                        <span className="text-[10px] text-slate-400 block font-normal">({row.cutLogsCount} cuts)</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      {formatQty(finished)}
                      {row.finishLogsCount > 0 && (
                        <span className="text-[10px] text-slate-400 block font-normal">({row.finishLogsCount} logs)</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      {wip > 0 ? (
                        <Badge variant="outline" className="text-[10px] bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800 font-mono">
                          {formatQty(wip)} WIP
                        </Badge>
                      ) : (
                        <span className="text-slate-400 font-mono text-[11px]">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                      {formatQty(yieldVal)}%
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono">
                      {formatCurrency(row.materialCost || 0)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-400 whitespace-nowrap font-mono">
                      {formatQty(scrap)}
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-semibold ${
                          row.status === 'COMPLETED' && row.isStockSynced
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                            : row.status === 'FINISHED_PENDING_STOCK' || (!row.isStockSynced && finished > 0)
                            ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-300 dark:border-purple-800'
                            : row.status === 'CUTTING'
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                            : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800'
                        }`}
                      >
                        {row.status === 'COMPLETED' && row.isStockSynced ? 'IN STOCK' : row.status === 'FINISHED_PENDING_STOCK' ? 'AWAITING SYNC' : row.status || 'CUTTING'}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default GarmentProductionReport;

