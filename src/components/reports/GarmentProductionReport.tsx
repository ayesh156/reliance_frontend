import React, { useMemo, useState, useEffect } from 'react';
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
import { generateGarmentProductionPdf, matchProductionStage, getProductionStageConfig } from '../../utils/reportPdf';
import { StageViewToggle, type StageViewMode } from '../production/StageViewToggle';

export const PRODUCTION_STAGES = [
  'ALL STAGES',
  'CUTTING',
  'SEWING LINE',
  'SEWING_SEWN',
  'SEWING_WASH_READY',
  'WASHING',
  'FINISHING / PACKING',
  'IN STOCK / COMPLETED',
] as const;

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
  stageFilter?: string;
  onStageFilterChange?: (stage: string) => void;
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
  stageFilter,
  onStageFilterChange,
}) => {
  const [selectedStage, setSelectedStage] = useState<string>(stageFilter || 'ALL STAGES');
  const [viewMode, setViewMode] = useState<StageViewMode>('all');

  useEffect(() => {
    if (stageFilter) setSelectedStage(stageFilter);
  }, [stageFilter]);

  const handleStageSelect = (stage: string) => {
    setSelectedStage(stage);
    if (onStageFilterChange) {
      onStageFilterChange(stage);
    }
  };

  const initialRows = useMemo(() => {
    return filteredRows || reportData?.tableItems || [];
  }, [filteredRows, reportData]);

  const rows = useMemo(() => {
    return initialRows.filter((r) => matchProductionStage(r, selectedStage, viewMode));
  }, [initialRows, selectedStage, viewMode]);

  const summary = reportData?.summary || {};

  // Dynamically compute real-time KPIs across filtered batches for the 6-stage funnel
  const kpis = useMemo(() => {
    const isSubsetFiltered =
      viewMode === 'active' ||
      (Boolean(selectedStage) && selectedStage !== 'ALL STAGES' && selectedStage !== 'ALL');

    const totalBatches = isSubsetFiltered ? rows.length : (summary.totalBatches ?? rows.length);

    const totalCutPieces = !isSubsetFiltered && summary.totalCutPieces !== undefined
      ? Number(summary.totalCutPieces)
      : rows.reduce((sum, row) => {
          const cut = Number(row.cutQtyYards ?? (row.cutQty > 0 ? row.cutQty : (row.totalCutUnits ?? (Array.isArray(row.cutLogs) && row.cutLogs.length > 0
            ? row.cutLogs.reduce((acc: number, c: any) => acc + (c.quantityCut || 0), 0)
            : 0))));
          return sum + cut;
        }, 0);

    // 2. Stage 2 (Line WIP): Per-batch physical WIP on Sewing Line floor (not yet sent to Wash Plant)
    const inSewingWip = !isSubsetFiltered && summary.inSewingWip !== undefined
      ? Number(summary.inSewingWip)
      : rows.reduce((sum, row) => {
          if (row.status === 'CANCELLED' || row.status === 'COMPLETED' || row.isStockSynced) return sum;
          if (row.lineWipQty !== undefined) return sum + Number(row.lineWipQty || 0);
          const intake = Number(row.lineIntakeQty ?? row.lineSentQty ?? 0);
          const sewn = Number(row.sewnQty || 0);
          const sentWash = Number(row.sentToWashQty || 0);
          return sum + Math.max(0, Math.max(intake, sewn) - sentWash);
        }, 0);

    const totalLineIntake = !isSubsetFiltered && summary.totalLineIntake !== undefined
      ? Number(summary.totalLineIntake)
      : rows.reduce((sum, row) => sum + Number(row.lineIntakeQty ?? row.lineSentQty ?? 0), 0);

    // 3. Stage 3 (Sewn Output / Wash Ready)
    const totalSewnOutput = !isSubsetFiltered && summary.totalSewnOutput !== undefined
      ? Number(summary.totalSewnOutput)
      : rows.reduce((sum, row) => sum + Number(row.sewnQty || 0), 0);

    const totalWashReadyOnLine = rows.reduce((sum, row) => {
      const hasLineWip = row.lineWipQty !== undefined
        ? Number(row.lineWipQty || 0) > 0
        : (row.status !== 'CANCELLED' && row.status !== 'COMPLETED' && !row.isStockSynced && Math.max(0, Math.max(Number(row.lineIntakeQty ?? row.lineSentQty ?? 0), Number(row.sewnQty || 0)) - Number(row.sentToWashQty || 0)) > 0);
      if (!hasLineWip) return sum;
      const sewn = Number(row.sewnQty || 0);
      const sentWash = Number(row.sentToWashQty || 0);
      return sum + Number(row.cumulativeWashReadyQty ?? row.washReadyQty ?? Math.max(0, sewn - sentWash));
    }, 0);

    const unsewnOnLine = Math.max(0, inSewingWip - totalWashReadyOnLine);

    const totalWashReady = rows.reduce((sum, row) => {
      const sewn = Number(row.sewnQty || 0);
      const sentWash = Number(row.sentToWashQty || 0);
      return sum + Number(row.washReadyQty ?? Math.max(0, sewn - sentWash));
    }, 0);

    // 4. Stage 4 (Wash): In Wash / Washed
    const inWashTotal = !isSubsetFiltered && summary.inWashTotal !== undefined
      ? Number(summary.inWashTotal)
      : rows.reduce((sum, row) => sum + Number(row.sentToWashQty || 0) + Number(row.washedQty || 0), 0);

    // 5. Stage 5 (Iron & Pack): Ironed & Packed
    const ironedAndPacked = !isSubsetFiltered && summary.ironedAndPacked !== undefined
      ? Number(summary.ironedAndPacked)
      : rows.reduce((sum, row) => {
          const logged = Array.isArray(row.finishLogs) && row.finishLogs.length > 0
            ? row.finishLogs.reduce((acc: number, f: any) => acc + (Number(f.quantityFinished) || 0), 0)
            : 0;
          const finished = logged > 0
            ? logged
            : (Number(row.completedQty || 0) > 0 ? Number(row.completedQty) : Number(row.washedQty || 0));
          return sum + finished;
        }, 0);

    // 6. Stage 6 (Finished Stock): Fully Finished / Synced to Inventory
    const fullyFinishedSynced = !isSubsetFiltered && summary.fullyFinishedSynced !== undefined
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

    return {
      totalBatches,
      totalCutPieces,
      totalLineIntake,
      inSewingWip,
      washReadyOnLine: totalWashReadyOnLine,
      unsewnOnLine,
      totalSewnOutput,
      totalWashReady,
      inWashTotal,
      ironedAndPacked,
      fullyFinishedSynced,
      pendingStockSync,
    };
  }, [rows, summary, viewMode, selectedStage]);

  const stageConfig = useMemo(() => getProductionStageConfig(selectedStage), [selectedStage]);

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
    await generateGarmentProductionPdf(
      {
        ...reportData,
        tableItems: rows,
      },
      {
        dateRangeLabel,
        generatedBy,
        stageFilter: selectedStage,
        viewMode,
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* 6-Stage Production Funnel Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Stage 1: Total Cut Qty (Yard) */}
        <div className={`p-3 sm:p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Total Cut Qty (Yard)</p>
            <Scissors className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <p className="text-lg md:text-xl font-bold mt-1 text-amber-600 dark:text-amber-400 font-mono">
            {formatQty(kpis.totalCutPieces)} <span className="text-xs font-medium text-slate-500">Yards</span>
          </p>
          <p className="text-[11px] text-slate-400 mt-1">{kpis.totalBatches} Batches Started</p>
        </div>

        {/* Stage 2: Current = In Sewing Line (WIP) | All = Total Line Intake */}
        <div className={`p-3 sm:p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
              {viewMode === 'active' ? 'In Sewing Line (WIP)' : 'Total Line Intake'}
            </p>
            <Clock className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <p className="text-lg md:text-xl font-bold mt-1 text-indigo-600 dark:text-indigo-400 font-mono">
            {formatQty(viewMode === 'active' ? kpis.inSewingWip : kpis.totalLineIntake)}{' '}
            <span className="text-xs font-medium text-slate-500">Pcs</span>
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {viewMode === 'active'
              ? `Unsewn: ${formatQty(kpis.unsewnOnLine)} • Wash Ready: ${formatQty(kpis.washReadyOnLine)}`
              : `Live Line WIP: ${formatQty(kpis.inSewingWip)} Pcs`}
          </p>
        </div>

        {/* Stage 3: Current = Sewn / Wash Ready (On Line) | All = Sewn Output / Wash Ready */}
        <div className={`p-3 sm:p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
              {viewMode === 'active' ? 'Sewn / Wash Ready (On Line)' : 'Sewn Output / Wash Ready'}
            </p>
            <Sparkles className="w-3.5 h-3.5 text-purple-500" />
          </div>
          <p className="text-lg md:text-xl font-bold mt-1 text-purple-600 dark:text-purple-400 font-mono">
            {formatQty(
              viewMode === 'active'
                ? kpis.washReadyOnLine
                : selectedStage === 'SEWING_WASH_READY'
                ? kpis.totalWashReady
                : kpis.totalSewnOutput
            )}{' '}
            <span className="text-xs font-medium text-slate-500">Pcs</span>
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {viewMode === 'active'
              ? 'Ready for Wash Plant on active line'
              : selectedStage === 'SEWING_WASH_READY'
              ? 'Sewn & awaiting Wash Plant'
              : `Sent to Wash: ${formatQty(Math.max(0, kpis.totalSewnOutput - kpis.totalWashReady))} • Wash Ready: ${formatQty(kpis.totalWashReady)}`}
          </p>
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
          <p className="text-[11px] text-slate-400 mt-1">Quality checked &amp; packed</p>
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
                <Bar dataKey="cutQty" name="1. Cut Qty (Yard)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
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
        <div className="p-4 border-b border-slate-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold tracking-tight">Production Batches &amp; Stage Pipeline Audit</h3>
            <p className="text-xs text-slate-400">Order-level intake, stage throughput, and inventory sync status ({stageConfig.stageLabel})</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              {rows.length} Batches
            </Badge>
          </div>
        </div>

        {/* Section-Wise Stage Filter Toolbar */}
        <div className="px-4 py-2.5 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 shrink-0 mr-1">
              Stage Filter:
            </span>
            {PRODUCTION_STAGES.map((stg) => {
              const isSelected = selectedStage === stg;
              return (
                <button
                  key={stg}
                  type="button"
                  onClick={() => handleStageSelect(stg)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-700'
                  }`}
                >
                  {stg}
                </button>
              );
            })}
          </div>
          <StageViewToggle value={viewMode} onChange={setViewMode} />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className={`border-b text-[11px] font-bold uppercase tracking-wider ${dark ? 'border-zinc-800 text-zinc-400 bg-zinc-900/90' : 'border-slate-200 text-slate-500 bg-slate-50'}`}>
                {stageConfig.columns.map((col) => (
                  <th
                    key={col.key}
                    className={`py-2.5 px-3 whitespace-nowrap ${
                      col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                    }`}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 font-medium">
              {rows.map((row: any) => (
                <tr
                  key={row.id || row.productionNo}
                  onClick={() => onSelectBatch && onSelectBatch(row)}
                  className={`hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors ${onSelectBatch ? 'cursor-pointer' : ''}`}
                >
                  {stageConfig.columns.map((col) => {
                    const val = col.getValue(row);
                    if (col.key === 'cuttingNo') {
                      return (
                        <td key={col.key} className="py-2.5 px-3 font-mono font-medium text-blue-600 dark:text-blue-400 whitespace-nowrap">
                          {val}
                        </td>
                      );
                    }
                    if (col.key === 'productName') {
                      return (
                        <td key={col.key} className="py-2.5 px-3 font-medium text-slate-800 dark:text-zinc-200">
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
                            <span>{val}</span>
                          </div>
                        </td>
                      );
                    }
                    if (col.key === 'status') {
                      return (
                        <td key={col.key} className="py-2.5 px-3 text-center whitespace-nowrap">
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-semibold ${
                              row.status === 'COMPLETED' && row.isStockSynced
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                                : row.status === 'FINISHED_PENDING_STOCK' || (!row.isStockSynced && Number(row.completedQty || 0) > 0)
                                ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-300 dark:border-purple-800'
                                : row.status === 'CUTTING'
                                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                                : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800'
                            }`}
                          >
                            {val}
                          </Badge>
                        </td>
                      );
                    }
                    return (
                      <td
                        key={col.key}
                        className={`py-2.5 px-3 whitespace-nowrap ${
                          col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                        } ${col.isNumeric ? 'font-mono font-bold' : 'text-slate-600 dark:text-zinc-300'} ${
                          col.key === 'cutQtyYards' ? 'text-amber-600 dark:text-amber-400' : ''
                        }`}
                      >
                        {val}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className={`border-t-2 font-bold text-xs ${dark ? 'border-zinc-700 bg-zinc-900/90 text-zinc-100' : 'border-slate-300 bg-slate-50 text-slate-900'}`}>
                  {stageConfig.columns.map((col, idx) => {
                    if (idx === 0) {
                      return (
                        <td key={col.key} className="py-2.5 px-3 font-bold uppercase tracking-wider">
                          Total
                        </td>
                      );
                    }
                    if (col.isNumeric && col.getNumericValue) {
                      const colSum = rows.reduce((acc, r) => acc + col.getNumericValue!(r), 0);
                      return (
                        <td
                          key={col.key}
                          className={`py-2.5 px-3 font-mono font-bold whitespace-nowrap ${
                            col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                          }`}
                        >
                          {formatQty(colSum)} {col.unit || ''}
                        </td>
                      );
                    }
                    if (col.key === 'status') {
                      return (
                        <td key={col.key} className="py-2.5 px-3 text-center font-mono">
                          {rows.length} Batches
                        </td>
                      );
                    }
                    return <td key={col.key} className="py-2.5 px-3" />;
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default GarmentProductionReport;

