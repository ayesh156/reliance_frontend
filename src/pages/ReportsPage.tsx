import React, { useState, useEffect, useMemo } from 'react';
import { get, downloadBlob } from '../lib/api';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { DateRangePicker, type DateRange } from '../components/ui/date-range-picker';
import { toast } from 'react-toastify';
import {
  Download,
  Loader2,
  Search,
  RotateCcw,
  Boxes,
  ShoppingBag,
  Factory,
  Building2,
  FileEdit,
  TrendingUp,
  Receipt,
  Layers,
  Calendar,
  AlertTriangle,
  RefreshCw,
  Printer,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Cell,
  PieChart,
  Pie,
} from 'recharts';

type ModuleKey =
  | 'sales'
  | 'returns'
  | 'inventory'
  | 'products'
  | 'materials'
  | 'production'
  | 'suppliers'
  | 'audit';

type PresetKey = 'daily' | 'monthly' | 'yearly' | 'custom';

interface TabItem {
  key: ModuleKey;
  label: string;
  icon: React.ElementType;
  description: string;
}

const MODULE_TABS: TabItem[] = [
  { key: 'sales', label: 'Sales & Invoices', icon: Receipt, description: 'Revenue, payment splits, discounts, and customer credit accumulation' },
  { key: 'returns', label: 'Returns & Restock', icon: RotateCcw, description: 'Restocked quantities, refund reasons, cash vs credit adjustments' },
  { key: 'inventory', label: 'Inventory & Valuation', icon: Boxes, description: 'Warehouse stock levels, cost vs retail valuation, low-stock warnings' },
  { key: 'products', label: 'Products & SKUs', icon: ShoppingBag, description: 'Fast/slow moving garment SKUs and category sales distribution' },
  { key: 'materials', label: 'Raw Materials Ledger', icon: Layers, description: 'Fabric rolls/yards, weighted average cost, scrap and waste logs' },
  { key: 'production', label: 'Garment Production', icon: Factory, description: 'Production batches, target vs yield efficiency, material consumption' },
  { key: 'suppliers', label: 'Suppliers & GRN', icon: Building2, description: 'Inward goods received notes, purchase totals, and outstanding debt' },
  { key: 'audit', label: 'Invoice Modifications', icon: FileEdit, description: 'Modified invoice logs, cashier edit frequency, audit trail reconciliations' },
];

export const ReportsPage: React.FC = () => {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [activeModule, setActiveModule] = useState<ModuleKey>('sales');
  const [activePreset, setActivePreset] = useState<PresetKey>('monthly');
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined);

  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [downloadingActivePdf, setDownloadingActivePdf] = useState<boolean>(false);
  const [downloadingConsolidatedPdf, setDownloadingConsolidatedPdf] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Table Pagination State (15 rows per page)
  const PAGE_SIZE = 15;
  const [currentPage, setCurrentPage] = useState<number>(1);

  const buildDateFilterParams = () => {
    const params = new URLSearchParams();
    params.set('preset', activePreset);

    if (activePreset === 'custom' && customRange?.from) {
      params.set('startDate', customRange.from.toISOString());
      // Gracefully handle single-date selection without passing invalid or missing ranges
      if (customRange.to) {
        params.set('endDate', customRange.to.toISOString());
      } else {
        params.set('endDate', customRange.from.toISOString());
      }
    }
    return params;
  };

  const fetchReport = async () => {
    try {
      setLoading(true);
      const params = buildDateFilterParams();
      const res: any = await get(`/reports/${activeModule}/data?${params.toString()}`);
      if (res?.success && res?.data) {
        setReportData(res.data);
      } else {
        setReportData(null);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch report data');
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  // Auto-reset pagination state to Page 1 whenever switching domain tabs or presets
  useEffect(() => {
    fetchReport();
    setSearchQuery('');
    setCurrentPage(1);
  }, [activeModule, activePreset]);

  // When custom range is clicked/updated, handle single-date selection gracefully
  const handleRangeChange = (range: DateRange | undefined) => {
    setCustomRange(range);
    setCurrentPage(1);
    if (!range) {
      setActivePreset('monthly');
      return;
    }
    if (range.from) {
      setActivePreset('custom');
      // Single-date or full range selection triggers fetch
      setTimeout(fetchReport, 50);
    }
  };

  const handlePresetSelect = (preset: PresetKey) => {
    setActivePreset(preset);
    setCurrentPage(1);
  };

  const handleTabSelect = (key: ModuleKey) => {
    setActiveModule(key);
    setCurrentPage(1);
  };

  const activeTabItem = useMemo(() => {
    return MODULE_TABS.find((t) => t.key === activeModule) || MODULE_TABS[0];
  }, [activeModule]);

  // 1. Tab-Specific Granular PDF Export (Date Filter Bar)
  const handleDownloadActivePdf = async () => {
    try {
      setDownloadingActivePdf(true);
      const params = buildDateFilterParams();
      const dateTag = reportData?.dateFilter?.startDate
        ? new Date(reportData.dateFilter.startDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      const defaultFilename = `reliance-${activeModule}-report-${dateTag}.pdf`;
      await downloadBlob(`/reports/${activeModule}/pdf?${params.toString()}`, defaultFilename);
      toast.success(`${activeTabItem.label} PDF report exported successfully!`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to download module PDF report');
    } finally {
      setDownloadingActivePdf(false);
    }
  };

  // 2. Full Consolidated Master Report PDF Export (Top Header Action)
  const handleDownloadConsolidatedPdf = async () => {
    try {
      setDownloadingConsolidatedPdf(true);
      const params = buildDateFilterParams();
      const dateTag = reportData?.dateFilter?.startDate
        ? new Date(reportData.dateFilter.startDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      const defaultFilename = `reliance-consolidated-master-report-${dateTag}.pdf`;
      await downloadBlob(`/reports/consolidated/pdf?${params.toString()}`, defaultFilename);
      toast.success('Official Consolidated Master Audit PDF exported successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to download consolidated master report');
    } finally {
      setDownloadingConsolidatedPdf(false);
    }
  };

  const summary = reportData?.summary || {};
  const allRows: any[] = reportData?.tableItems || [];

  // Client-side search within table
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return allRows;
    const q = searchQuery.toLowerCase();
    return allRows.filter((row) =>
      Object.values(row).some((val) => String(val || '').toLowerCase().includes(q))
    );
  }, [allRows, searchQuery]);

  // Client-side Pagination Math
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedRows = useMemo(() => {
    return filteredRows.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredRows, startIndex, PAGE_SIZE]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  // Readable active date badge formatter (e.g. Selected: 2026-10-01 to 2026-10-09)
  const formattedSelectedBadge = useMemo(() => {
    if (reportData?.dateFilter?.startDate && reportData?.dateFilter?.endDate) {
      const s = new Date(reportData.dateFilter.startDate).toISOString().split('T')[0];
      const e = new Date(reportData.dateFilter.endDate).toISOString().split('T')[0];
      return `${s} to ${e}`;
    }
    if (activePreset === 'custom' && customRange?.from) {
      const s = customRange.from.toISOString().split('T')[0];
      const e = (customRange.to || customRange.from).toISOString().split('T')[0];
      return `${s} to ${e}`;
    }
    return reportData?.dateFilter?.presetLabel || 'Resolving...';
  }, [reportData, activePreset, customRange]);

  // Chart data preparation
  const chartData = useMemo(() => {
    if (!reportData) return [];

    if (activeModule === 'sales') {
      const split = summary.paymentSplit || {};
      return Object.entries(split).map(([method, data]: [string, any]) => ({
        name: method,
        value: data.amount || 0,
        count: data.count || 0,
      }));
    }

    if (activeModule === 'returns') {
      const reasons = summary.reasonsBreakdown || {};
      return Object.entries(reasons).map(([reason, data]: [string, any]) => ({
        name: reason,
        value: data.refund || 0,
        count: data.qty || 0,
      }));
    }

    if (activeModule === 'products') {
      return (reportData.tableItems || []).slice(0, 6).map((item: any) => ({
        name: item.productName?.length > 15 ? item.productName.slice(0, 15) + '...' : item.productName,
        value: item.totalRevenue || 0,
        qty: item.soldQty || 0,
      }));
    }

    if (activeModule === 'production') {
      return (reportData.tableItems || []).slice(0, 6).map((item: any) => ({
        name: item.productionNo,
        target: item.targetQuantity || 0,
        completed: item.completedQty || 0,
      }));
    }

    if (activeModule === 'suppliers') {
      return (reportData.tableItems || []).slice(0, 6).map((item: any) => ({
        name: item.supplierName?.length > 12 ? item.supplierName.slice(0, 12) + '...' : item.supplierName,
        purchases: item.totalPurchases || 0,
        due: item.outstandingBalance || 0,
      }));
    }

    if (activeModule === 'audit') {
      const cashierMap = summary.cashierEditsBreakdown || {};
      return Object.entries(cashierMap).map(([cashier, count]: [string, any]) => ({
        name: cashier,
        value: count,
      }));
    }

    return [];
  }, [reportData, activeModule, summary]);

  const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

  const formatRs = (val: number) => `Rs. ${(val || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}`;

  return (
    <div className={`min-h-screen p-4 md:p-6 lg:p-8 transition-colors ${dark ? 'bg-zinc-950 text-zinc-100' : 'bg-slate-50 text-slate-900'}`}>
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-5 border-b border-slate-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-500/20">
              <TrendingUp className="size-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">Reports & Enterprise Analytics</h1>
              <p className="text-xs md:text-sm text-slate-500 dark:text-zinc-400">
                Unified cross-domain intelligence, financial aggregations, and official A4 audit exports
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons: Refresh & Consolidated Master PDF Export */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            onClick={fetchReport}
            variant="outline"
            size="sm"
            disabled={loading}
            className="border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800"
          >
            <RefreshCw className={`size-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            onClick={handleDownloadConsolidatedPdf}
            disabled={downloadingConsolidatedPdf || loading}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 font-medium text-xs md:text-sm"
          >
            {downloadingConsolidatedPdf ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Compiling Master Audit PDF...
              </>
            ) : (
              <>
                <Download className="size-4 mr-2" />
                Download Consolidated Master Audit PDF
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Task 1: Responsive Non-Scrolling Grid Tab Bar (Fits comfortably on all viewports without scrollbars or arrows) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-6">
        {MODULE_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeModule === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => handleTabSelect(tab.key)}
              title={tab.description}
              className={`w-full flex items-center justify-start gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-500/20 scale-[1.01]'
                  : dark
                  ? 'bg-zinc-900/80 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 border border-zinc-800/80'
                  : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200 shadow-sm'
              }`}
            >
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Date Filtering Bar with Active Tab PDF Export Button */}
      <div className={`p-4 rounded-2xl mb-6 border transition-all ${
        dark ? 'bg-zinc-900/60 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mr-1 flex items-center gap-1.5">
              <Calendar className="size-3.5" />
              Period:
            </span>

            <Button
              size="sm"
              variant={activePreset === 'daily' ? 'default' : 'outline'}
              onClick={() => handlePresetSelect('daily')}
              className={`text-xs h-8 ${activePreset === 'daily' ? 'bg-blue-600 text-white' : 'dark:border-zinc-800'}`}
            >
              Today
            </Button>
            <Button
              size="sm"
              variant={activePreset === 'monthly' ? 'default' : 'outline'}
              onClick={() => handlePresetSelect('monthly')}
              className={`text-xs h-8 ${activePreset === 'monthly' ? 'bg-blue-600 text-white' : 'dark:border-zinc-800'}`}
            >
              This Month
            </Button>
            <Button
              size="sm"
              variant={activePreset === 'yearly' ? 'default' : 'outline'}
              onClick={() => handlePresetSelect('yearly')}
              className={`text-xs h-8 ${activePreset === 'yearly' ? 'bg-blue-600 text-white' : 'dark:border-zinc-800'}`}
            >
              This Year
            </Button>

            <div className="h-4 w-px bg-slate-300 dark:bg-zinc-800 mx-1 hidden sm:block" />

            {/* Custom Range Picker */}
            <div className="w-56 sm:w-64">
              <DateRangePicker
                date={customRange}
                onDateChange={handleRangeChange}
                placeholder="Custom Date Range..."
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Right-hand side: Active Period Tag & Tab-Specific PDF Download Button */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
              <span className="font-semibold text-slate-600 dark:text-zinc-300">Selected:</span>
              <Badge variant="outline" className="font-mono text-xs font-semibold px-2.5 py-1 border-blue-200 dark:border-blue-900/60 text-blue-600 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-950/40 shadow-xs">
                {formattedSelectedBadge}
              </Badge>
            </div>

            <Button
              onClick={handleDownloadActivePdf}
              disabled={downloadingActivePdf || loading || !reportData}
              variant="outline"
              size="sm"
              className="h-8 text-xs border-slate-300 dark:border-zinc-700 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-zinc-800 font-medium"
            >
              {downloadingActivePdf ? (
                <>
                  <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                  Exporting {activeTabItem.label.split(' ')[0]}...
                </>
              ) : (
                <>
                  <Printer className="size-3.5 mr-1.5" />
                  Download {activeTabItem.label} PDF
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="size-8 animate-spin text-blue-600" />
          <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">Aggregating analytical ledger...</p>
        </div>
      ) : !reportData ? (
        <div className="text-center py-20 border rounded-2xl border-dashed border-slate-300 dark:border-zinc-800">
          <AlertTriangle className="size-10 mx-auto text-amber-500 mb-2 opacity-80" />
          <p className="text-sm font-semibold">No data returned for the selected filter</p>
          <p className="text-xs text-slate-400 mt-1">Try selecting a broader date range or adjusting the filter.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Quick Summary Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 md:gap-4">
            {activeModule === 'sales' && (
              <>
                <div className={`p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Gross Revenue</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-slate-900 dark:text-zinc-100">{formatRs(summary.grossRevenue)}</p>
                  <p className="text-[11px] text-slate-400 mt-1">{summary.orderCount || 0} Orders Recorded</p>
                </div>
                <div className={`p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Net Sales</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{formatRs(summary.netSales)}</p>
                  <p className="text-[11px] text-slate-400 mt-1">Discounts: {formatRs(summary.totalDiscount)}</p>
                </div>
                <div className={`p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Collected / Paid</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-blue-600 dark:text-blue-400">{formatRs(summary.totalPaid)}</p>
                  <p className="text-[11px] text-slate-400 mt-1">Avg Order: {formatRs(summary.averageOrderValue)}</p>
                </div>
                <div className={`p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Outstanding Credit Due</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-rose-600 dark:text-rose-400">{formatRs(summary.totalDue)}</p>
                  <p className="text-[11px] text-rose-500/80 mt-1">Pending Customer Debt</p>
                </div>
              </>
            )}

            {activeModule === 'returns' && (
              <>
                <div className={`p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Return Events</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-slate-900 dark:text-zinc-100">{summary.totalReturnEvents || 0}</p>
                  <p className="text-[11px] text-slate-400 mt-1">Transactions Processed</p>
                </div>
                <div className={`p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Restocked Units</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{summary.totalItemsReturned || 0} Pcs</p>
                  <p className="text-[11px] text-slate-400 mt-1">Returned to Inventory</p>
                </div>
                <div className={`p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Total Return Value</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-rose-600 dark:text-rose-400">{formatRs(summary.totalReturnValue)}</p>
                  <p className="text-[11px] text-slate-400 mt-1">Gross Adjustment Value</p>
                </div>
                <div className={`p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Cash vs Credit Split</p>
                  <p className="text-sm md:text-base font-bold mt-1 text-slate-900 dark:text-zinc-100">
                    {formatRs(summary.totalCashRefund)} <span className="text-xs font-normal text-slate-400">Cash</span>
                  </p>
                  <p className="text-[11px] text-blue-500 mt-1">{formatRs(summary.totalCreditAdjustment)} Credit Adjusted</p>
                </div>
              </>
            )}

            {activeModule === 'inventory' && (
              <>
                <div className={`p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Total SKUs / Units</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-slate-900 dark:text-zinc-100">{summary.totalSkus || 0} SKUs</p>
                  <p className="text-[11px] text-slate-400 mt-1">{summary.totalStockUnits || 0} Total Pieces in Warehouse</p>
                </div>
                <div className={`p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Cost Valuation</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-amber-600 dark:text-amber-400">{formatRs(summary.totalCostValuation)}</p>
                  <p className="text-[11px] text-slate-400 mt-1">Invested Garment Capital</p>
                </div>
                <div className={`p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Retail Valuation</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{formatRs(summary.totalRetailValuation)}</p>
                  <p className="text-[11px] text-emerald-500 mt-1">Est. Profit: {formatRs(summary.potentialGrossProfit)}</p>
                </div>
                <div className={`p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Stock Alerts</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-rose-600 dark:text-rose-400">{summary.lowStockCount || 0} Low Stock</p>
                  <p className="text-[11px] text-slate-400 mt-1">{summary.outOfStockCount || 0} Out of Stock SKUs</p>
                </div>
              </>
            )}

            {activeModule === 'products' && (
              <>
                <div className={`p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Units Sold</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-slate-900 dark:text-zinc-100">{summary.totalProductsSold || 0} Pcs</p>
                  <p className="text-[11px] text-slate-400 mt-1">Sales Turnover</p>
                </div>
                <div className={`p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Total Revenue</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{formatRs(summary.totalRevenue)}</p>
                  <p className="text-[11px] text-slate-400 mt-1">From Product Sales</p>
                </div>
                <div className={`p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Top Velocity Product</p>
                  <p className="text-sm md:text-base font-bold mt-1 text-blue-600 dark:text-blue-400 truncate">{summary.topProduct || 'N/A'}</p>
                  <p className="text-[11px] text-slate-400 mt-1">Highest Sales Volume</p>
                </div>
                <div className={`p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Leading Category</p>
                  <p className="text-sm md:text-base font-bold mt-1 text-purple-600 dark:text-purple-400 truncate">{summary.topCategory || 'N/A'}</p>
                  <p className="text-[11px] text-slate-400 mt-1">Highest Grossing Line</p>
                </div>
              </>
            )}

            {activeModule === 'materials' && (
              <>
                <div className={`p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Material Types</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-slate-900 dark:text-zinc-100">{summary.totalMaterials || 0} Fabrics/Items</p>
                  <p className="text-[11px] text-slate-400 mt-1">Recorded in Ledger</p>
                </div>
                <div className={`p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Stock Valuation</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{formatRs(summary.totalValuation)}</p>
                  <p className="text-[11px] text-slate-400 mt-1">Weighted Average Cost</p>
                </div>
                <div className={`p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Low Stock Warnings</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-rose-600 dark:text-rose-400">{summary.lowStockMaterials || 0} Materials</p>
                  <p className="text-[11px] text-slate-400 mt-1">Below Alert Threshold</p>
                </div>
                <div className={`p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Period Scrap Returned</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-amber-600 dark:text-amber-400">{summary.periodScrapQty || 0} Units</p>
                  <p className="text-[11px] text-slate-400 mt-1">Leftover Recovery</p>
                </div>
              </>
            )}

            {activeModule === 'production' && (
              <>
                <div className={`p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Production Batches</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-slate-900 dark:text-zinc-100">{summary.totalBatches || 0} Runs</p>
                  <p className="text-[11px] text-slate-400 mt-1">Cut & Sew Operations</p>
                </div>
                <div className={`p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Completed Garments</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{summary.completedQuantity || 0} Pcs</p>
                  <p className="text-[11px] text-slate-400 mt-1">Target: {summary.targetQuantity || 0} Pcs</p>
                </div>
                <div className={`p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Overall Efficiency Yield</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-blue-600 dark:text-blue-400">{summary.overallYieldPercentage || 0}%</p>
                  <p className="text-[11px] text-slate-400 mt-1">Yield Efficiency Rate</p>
                </div>
                <div className={`p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Raw Material Cost</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-amber-600 dark:text-amber-400">{formatRs(summary.totalMaterialCost)}</p>
                  <p className="text-[11px] text-slate-400 mt-1">Returned: {summary.scrapVariance || 0} Units</p>
                </div>
              </>
            )}

            {activeModule === 'suppliers' && (
              <>
                <div className={`p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Registered Suppliers</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-slate-900 dark:text-zinc-100">{summary.totalSuppliers || 0} Vendors</p>
                  <p className="text-[11px] text-slate-400 mt-1">Raw Material Shops</p>
                </div>
                <div className={`p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Total Purchases (GRN)</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-slate-900 dark:text-zinc-100">{formatRs(summary.totalPurchases)}</p>
                  <p className="text-[11px] text-slate-400 mt-1">{summary.grnCount || 0} GRN Vouchers</p>
                </div>
                <div className={`p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Settled Payments</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{formatRs(summary.totalPaid)}</p>
                  <p className="text-[11px] text-slate-400 mt-1">Disbursed to Suppliers</p>
                </div>
                <div className={`p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Outstanding Payables</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-rose-600 dark:text-rose-400">{formatRs(summary.totalOutstandingPayables)}</p>
                  <p className="text-[11px] text-rose-500 mt-1">Current Supplier Credit Debt</p>
                </div>
              </>
            )}

            {activeModule === 'audit' && (
              <>
                <div className={`p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Invoices Created</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-slate-900 dark:text-zinc-100">{summary.totalInvoicesInPeriod || 0}</p>
                  <p className="text-[11px] text-slate-400 mt-1">Original Transactions</p>
                </div>
                <div className={`p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Modified After Issuance</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-amber-600 dark:text-amber-400">{summary.modifiedInvoicesCount || 0}</p>
                  <p className="text-[11px] text-slate-400 mt-1">Revisions Recorded</p>
                </div>
                <div className={`p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Modification Rate</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-blue-600 dark:text-blue-400">{summary.modificationRate || 0}%</p>
                  <p className="text-[11px] text-slate-400 mt-1">Of Total Invoices</p>
                </div>
                <div className={`p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Top Cashier With Edits</p>
                  <p className="text-sm md:text-base font-bold mt-1 text-rose-600 dark:text-rose-400 truncate">{summary.topCashierWithEdits || 'None'}</p>
                  <p className="text-[11px] text-slate-400 mt-1">Audit Reconciliations</p>
                </div>
              </>
            )}
          </div>

          {/* Analytical Charts Block */}
          {chartData.length > 0 && (
            <div className={`p-5 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold tracking-tight">
                    {activeModule === 'sales' && 'Payment Method Breakdown (Rs.)'}
                    {activeModule === 'returns' && 'Return Reasons Distribution (Refund Rs.)'}
                    {activeModule === 'products' && 'Top Performing SKUs by Revenue (Rs.)'}
                    {activeModule === 'production' && 'Target vs Completed Units per Batch'}
                    {activeModule === 'suppliers' && 'Supplier Volume & Outstanding Debt'}
                    {activeModule === 'audit' && 'Cashier Revisions Frequency'}
                  </h3>
                  <p className="text-xs text-slate-400">Visual trend distribution for the selected reporting period</p>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {activeModule === 'returns' ? (
                    <PieChart>
                      <Pie
                        data={chartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                      >
                        {chartData.map((_: unknown, index: number) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip formatter={(val: any) => formatRs(Number(val))} />
                    </PieChart>
                  ) : activeModule === 'production' ? (
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="name" stroke={dark ? '#71717a' : '#94a3b8'} fontSize={11} />
                      <YAxis stroke={dark ? '#71717a' : '#94a3b8'} fontSize={11} />
                      <RechartsTooltip />
                      <Bar dataKey="target" name="Target Qty" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="completed" name="Completed Output" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  ) : activeModule === 'suppliers' ? (
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="name" stroke={dark ? '#71717a' : '#94a3b8'} fontSize={11} />
                      <YAxis stroke={dark ? '#71717a' : '#94a3b8'} fontSize={11} />
                      <RechartsTooltip formatter={(val: any) => formatRs(Number(val))} />
                      <Bar dataKey="purchases" name="Total Purchases" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="due" name="Outstanding Debt" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  ) : (
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="name" stroke={dark ? '#71717a' : '#94a3b8'} fontSize={11} />
                      <YAxis stroke={dark ? '#71717a' : '#94a3b8'} fontSize={11} />
                      <RechartsTooltip formatter={(val: any) => (activeModule === 'audit' ? `${val} revisions` : formatRs(Number(val)))} />
                      <Bar dataKey="value" name="Value" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                        {chartData.map((_: unknown, index: number) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Interactive Data Preview Table with Stable Explicit Width Allocations & No Text Collapse */}
          <div className={`rounded-2xl border overflow-hidden ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
            {/* Table Search & Meta Header */}
            <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="relative w-full sm:w-72">
                  <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Search records..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-9 h-9 text-xs dark:bg-zinc-950 dark:border-zinc-800"
                  />
                </div>
                {searchQuery && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSearchQuery('');
                      setCurrentPage(1);
                    }}
                    className="h-9 text-xs"
                  >
                    Clear
                  </Button>
                )}
              </div>

              <div className="text-xs text-slate-400">
                Showing <span className="font-semibold text-slate-700 dark:text-zinc-200">{filteredRows.length > 0 ? startIndex + 1 : 0} – {Math.min(startIndex + PAGE_SIZE, filteredRows.length)}</span> of {filteredRows.length} items
              </div>
            </div>

            {/* Responsive Table Scroll Container with Min Height to Prevent Layout Jumps */}
            <div className="overflow-x-auto min-h-[360px] max-h-[520px] overflow-y-auto scrollbar-thin">
              <table className="w-full min-w-full text-left border-collapse text-xs">
                <thead>
                  <tr className={`border-b ${dark ? 'bg-zinc-950/80 border-zinc-800 text-zinc-400' : 'bg-slate-100/80 border-slate-200 text-slate-600'}`}>
                    {activeModule === 'sales' && (
                      <>
                        <th className="py-2.5 px-3 font-semibold w-28 min-w-[100px]">Invoice #</th>
                        <th className="py-2.5 px-3 font-semibold w-28 min-w-[100px]">Date</th>
                        <th className="py-2.5 px-3 font-semibold min-w-[160px]">Customer</th>
                        <th className="py-2.5 px-3 font-semibold w-28 min-w-[90px]">Channel</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-28 min-w-[100px]">Subtotal</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-24 min-w-[80px]">Discount</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-28 min-w-[110px]">Net Total</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-28 min-w-[100px]">Paid</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-28 min-w-[100px]">Due / Debt</th>
                        <th className="py-2.5 px-3 font-semibold w-28 min-w-[100px]">Method</th>
                      </>
                    )}

                    {activeModule === 'returns' && (
                      <>
                        <th className="py-2.5 px-3 font-semibold w-28 min-w-[100px]">Return ID</th>
                        <th className="py-2.5 px-3 font-semibold w-28 min-w-[100px]">Date</th>
                        <th className="py-2.5 px-3 font-semibold w-28 min-w-[100px]">Invoice #</th>
                        <th className="py-2.5 px-3 font-semibold min-w-[140px]">Customer</th>
                        <th className="py-2.5 px-3 font-semibold w-36 min-w-[120px]">Reason</th>
                        <th className="py-2.5 px-3 font-semibold min-w-[180px]">Returned Items</th>
                        <th className="py-2.5 px-3 font-semibold text-center w-20 min-w-[60px]">Qty</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-28 min-w-[100px]">Total Refund</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-28 min-w-[90px]">Cash</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-28 min-w-[90px]">Credit</th>
                      </>
                    )}

                    {activeModule === 'inventory' && (
                      <>
                        <th className="py-2.5 px-3 font-semibold w-32 min-w-[110px]">SKU</th>
                        <th className="py-2.5 px-3 font-semibold min-w-[180px]">Product Name</th>
                        <th className="py-2.5 px-3 font-semibold w-32 min-w-[110px]">Category</th>
                        <th className="py-2.5 px-3 font-semibold w-28 min-w-[90px]">Variant</th>
                        <th className="py-2.5 px-3 font-semibold text-center w-24 min-w-[70px]">In Stock</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-28 min-w-[100px]">Cost Price</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-28 min-w-[100px]">Retail Price</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-28 min-w-[100px]">Cost Val.</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-28 min-w-[100px]">Retail Val.</th>
                        <th className="py-2.5 px-3 font-semibold text-center w-28 min-w-[90px]">Status</th>
                      </>
                    )}

                    {activeModule === 'products' && (
                      <>
                        <th className="py-2.5 px-3 font-semibold w-32 min-w-[110px]">SKU</th>
                        <th className="py-2.5 px-3 font-semibold min-w-[180px]">Product Name</th>
                        <th className="py-2.5 px-3 font-semibold w-32 min-w-[110px]">Category</th>
                        <th className="py-2.5 px-3 font-semibold w-28 min-w-[90px]">Variant</th>
                        <th className="py-2.5 px-3 font-semibold text-center w-24 min-w-[70px]">Sold Qty</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-32 min-w-[110px]">Sales Revenue</th>
                        <th className="py-2.5 px-3 font-semibold text-center w-28 min-w-[80px]">Current Stock</th>
                        <th className="py-2.5 px-3 font-semibold text-center w-24 min-w-[80px]">Velocity</th>
                      </>
                    )}

                    {activeModule === 'materials' && (
                      <>
                        <th className="py-2.5 px-3 font-semibold w-28 min-w-[90px]">Code</th>
                        <th className="py-2.5 px-3 font-semibold min-w-[180px]">Material Name</th>
                        <th className="py-2.5 px-3 font-semibold text-center w-20 min-w-[60px]">Unit</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-28 min-w-[90px]">Current Stock</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-28 min-w-[90px]">Alert Threshold</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-28 min-w-[100px]">Avg Unit Cost</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-32 min-w-[110px]">Total Valuation</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-28 min-w-[90px]">Scrap in Period</th>
                        <th className="py-2.5 px-3 font-semibold text-center w-24 min-w-[80px]">Status</th>
                      </>
                    )}

                    {activeModule === 'production' && (
                      <>
                        <th className="py-2.5 px-3 font-semibold w-28 min-w-[100px]">Batch No</th>
                        <th className="py-2.5 px-3 font-semibold min-w-[180px]">Garment Style</th>
                        <th className="py-2.5 px-3 font-semibold w-28 min-w-[90px]">Size / Color</th>
                        <th className="py-2.5 px-3 font-semibold text-center w-20 min-w-[60px]">Target</th>
                        <th className="py-2.5 px-3 font-semibold text-center w-20 min-w-[60px]">Done</th>
                        <th className="py-2.5 px-3 font-semibold text-center w-20 min-w-[60px]">Yield %</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-28 min-w-[100px]">Material Cost</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-28 min-w-[90px]">Scrap Returned</th>
                        <th className="py-2.5 px-3 font-semibold text-center w-24 min-w-[80px]">Status</th>
                      </>
                    )}

                    {activeModule === 'suppliers' && (
                      <>
                        <th className="py-2.5 px-3 font-semibold min-w-[180px]">Supplier Name</th>
                        <th className="py-2.5 px-3 font-semibold w-36 min-w-[120px]">Contact / Phone</th>
                        <th className="py-2.5 px-3 font-semibold text-center w-20 min-w-[60px]">GRNs</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-32 min-w-[110px]">Total Purchases</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-32 min-w-[110px]">Total Paid</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-32 min-w-[110px]">Outstanding Debt</th>
                      </>
                    )}

                    {activeModule === 'audit' && (
                      <>
                        <th className="py-2.5 px-3 font-semibold w-28 min-w-[100px]">Invoice #</th>
                        <th className="py-2.5 px-3 font-semibold min-w-[140px]">Customer</th>
                        <th className="py-2.5 px-3 font-semibold w-28 min-w-[100px]">Cashier</th>
                        <th className="py-2.5 px-3 font-semibold w-28 min-w-[100px]">Created Date</th>
                        <th className="py-2.5 px-3 font-semibold w-28 min-w-[100px]">Last Modified</th>
                        <th className="py-2.5 px-3 font-semibold text-center w-24 min-w-[80px]">Delta (Min)</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-28 min-w-[100px]">Amount</th>
                        <th className="py-2.5 px-3 font-semibold text-center w-28 min-w-[90px]">Has Returns</th>
                        <th className="py-2.5 px-3 font-semibold min-w-[180px]">Notes</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-400">
                        No matching records found.
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((row: any, idx: number) => {
                      const isStripe = idx % 2 === 1;
                      return (
                        <tr
                          key={idx}
                          className={`transition-colors hover:bg-blue-50/50 dark:hover:bg-zinc-800/50 ${
                            isStripe ? (dark ? 'bg-zinc-900/30' : 'bg-slate-50/50') : ''
                          }`}
                        >
                          {activeModule === 'sales' && (
                            <>
                              <td className="py-2.5 px-3 font-mono font-medium text-blue-600 dark:text-blue-400 whitespace-nowrap">{row.invoiceNumber}</td>
                              <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{row.createdAt?.split('T')[0]}</td>
                              <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-zinc-200 break-words whitespace-normal">{row.customerName}</td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <Badge variant="outline" className="text-[10px]">
                                  {row.source === 'POS_WHOLESALE' ? 'Wholesale' : 'Retail'}
                                </Badge>
                              </td>
                              <td className="py-2.5 px-3 text-right whitespace-nowrap">{formatRs(row.subtotal)}</td>
                              <td className="py-2.5 px-3 text-right text-slate-400 whitespace-nowrap">{row.discount > 0 ? `-${formatRs(row.discount)}` : '-'}</td>
                              <td className="py-2.5 px-3 text-right font-semibold text-slate-900 dark:text-zinc-100 whitespace-nowrap">{formatRs(row.totalAmount)}</td>
                              <td className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{formatRs(row.paidAmount)}</td>
                              <td className="py-2.5 px-3 text-right font-medium text-rose-600 dark:text-rose-400 whitespace-nowrap">{row.dueAmount > 0 ? formatRs(row.dueAmount) : '-'}</td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <Badge variant="outline" className="text-[10px]">
                                  {row.paymentMethod}
                                </Badge>
                              </td>
                            </>
                          )}

                          {activeModule === 'returns' && (
                            <>
                              <td className="py-2.5 px-3 font-mono text-blue-600 dark:text-blue-400 font-medium whitespace-nowrap">{row.returnId}</td>
                              <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{row.returnDate?.split('T')[0]}</td>
                              <td className="py-2.5 px-3 font-mono whitespace-nowrap">{row.invoiceNumber}</td>
                              <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-zinc-200 break-words whitespace-normal">{row.customerName}</td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <Badge variant="outline" className="text-[10px] bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800">
                                  {row.reason}
                                </Badge>
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 dark:text-zinc-400 break-words whitespace-normal">{row.itemsSummary}</td>
                              <td className="py-2.5 px-3 text-center font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{row.itemsCount}</td>
                              <td className="py-2.5 px-3 text-right font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">{formatRs(row.totalRefund)}</td>
                              <td className="py-2.5 px-3 text-right text-slate-500 whitespace-nowrap">{row.cashRefund > 0 ? formatRs(row.cashRefund) : '-'}</td>
                              <td className="py-2.5 px-3 text-right text-blue-500 whitespace-nowrap">{row.creditAdjustment > 0 ? formatRs(row.creditAdjustment) : '-'}</td>
                            </>
                          )}

                          {activeModule === 'inventory' && (
                            <>
                              <td className="py-2.5 px-3 font-mono font-medium text-blue-600 dark:text-blue-400 whitespace-nowrap">{row.sku}</td>
                              <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-zinc-200 break-words whitespace-normal">{row.productName}</td>
                              <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{row.categoryName}</td>
                              <td className="py-2.5 px-3 whitespace-nowrap">{row.variant}</td>
                              <td className="py-2.5 px-3 text-center font-bold text-slate-900 dark:text-zinc-100 whitespace-nowrap">{row.stock}</td>
                              <td className="py-2.5 px-3 text-right whitespace-nowrap">{formatRs(row.costPrice)}</td>
                              <td className="py-2.5 px-3 text-right font-medium text-slate-900 dark:text-zinc-100 whitespace-nowrap">{formatRs(row.retailPrice)}</td>
                              <td className="py-2.5 px-3 text-right text-amber-600 dark:text-amber-400 whitespace-nowrap">{formatRs(row.costValuation)}</td>
                              <td className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400 font-semibold whitespace-nowrap">{formatRs(row.retailValuation)}</td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ${
                                    row.status === 'In Stock'
                                      ? 'text-emerald-600 border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20'
                                      : row.status === 'Low Stock'
                                      ? 'text-amber-600 border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20'
                                      : 'text-rose-600 border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/20'
                                  }`}
                                >
                                  {row.status}
                                </Badge>
                              </td>
                            </>
                          )}

                          {activeModule === 'products' && (
                            <>
                              <td className="py-2.5 px-3 font-mono font-medium text-blue-600 dark:text-blue-400 whitespace-nowrap">{row.sku}</td>
                              <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-zinc-200 break-words whitespace-normal">{row.productName}</td>
                              <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{row.categoryName}</td>
                              <td className="py-2.5 px-3 whitespace-nowrap">{row.variantName}</td>
                              <td className="py-2.5 px-3 text-center font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{row.soldQty}</td>
                              <td className="py-2.5 px-3 text-right font-semibold text-slate-900 dark:text-zinc-100 whitespace-nowrap">{formatRs(row.totalRevenue)}</td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">{row.currentStock}</td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ${
                                    row.velocity === 'Fast'
                                      ? 'text-emerald-600 border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20'
                                      : row.velocity === 'Slow'
                                      ? 'text-rose-600 border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/20'
                                      : 'text-blue-600 border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20'
                                  }`}
                                >
                                  {row.velocity}
                                </Badge>
                              </td>
                            </>
                          )}

                          {activeModule === 'materials' && (
                            <>
                              <td className="py-2.5 px-3 font-mono text-blue-600 dark:text-blue-400 font-medium whitespace-nowrap">{row.code}</td>
                              <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-zinc-200 break-words whitespace-normal">{row.name}</td>
                              <td className="py-2.5 px-3 text-center text-slate-500 uppercase text-[10px] whitespace-nowrap">{row.unit}</td>
                              <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-zinc-100 whitespace-nowrap">{row.currentStock}</td>
                              <td className="py-2.5 px-3 text-right text-slate-400 whitespace-nowrap">{row.alertThreshold}</td>
                              <td className="py-2.5 px-3 text-right whitespace-nowrap">{formatRs(row.unitCostAverage)}</td>
                              <td className="py-2.5 px-3 text-right font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{formatRs(row.totalValuation)}</td>
                              <td className="py-2.5 px-3 text-right text-rose-500 whitespace-nowrap">{row.periodScrap > 0 ? `${row.periodScrap} ${row.unit}` : '-'}</td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ${
                                    row.status === 'Optimal'
                                      ? 'text-emerald-600 border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20'
                                      : 'text-rose-600 border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/20'
                                  }`}
                                >
                                  {row.status}
                                </Badge>
                              </td>
                            </>
                          )}

                          {activeModule === 'production' && (
                            <>
                              <td className="py-2.5 px-3 font-mono font-medium text-blue-600 dark:text-blue-400 whitespace-nowrap">{row.productionNo}</td>
                              <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-zinc-200 break-words whitespace-normal">{row.productName}</td>
                              <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{row.variant}</td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">{row.targetQuantity}</td>
                              <td className="py-2.5 px-3 text-center font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{row.completedQty}</td>
                              <td className="py-2.5 px-3 text-center font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">{row.yieldPercentage}%</td>
                              <td className="py-2.5 px-3 text-right whitespace-nowrap">{formatRs(row.materialCost)}</td>
                              <td className="py-2.5 px-3 text-right text-slate-400 whitespace-nowrap">{row.scrapReturned}</td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <Badge variant="outline" className="text-[10px]">
                                  {row.status}
                                </Badge>
                              </td>
                            </>
                          )}

                          {activeModule === 'suppliers' && (
                            <>
                              <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-zinc-200 break-words whitespace-normal">{row.supplierName}</td>
                              <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{row.phone}</td>
                              <td className="py-2.5 px-3 text-center font-medium whitespace-nowrap">{row.grnCount}</td>
                              <td className="py-2.5 px-3 text-right font-semibold text-slate-900 dark:text-zinc-100 whitespace-nowrap">{formatRs(row.totalPurchases)}</td>
                              <td className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{formatRs(row.totalPaid)}</td>
                              <td className="py-2.5 px-3 text-right font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">{row.outstandingBalance > 0 ? formatRs(row.outstandingBalance) : '-'}</td>
                            </>
                          )}

                          {activeModule === 'audit' && (
                            <>
                              <td className="py-2.5 px-3 font-mono font-medium text-blue-600 dark:text-blue-400 whitespace-nowrap">{row.invoiceNumber}</td>
                              <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-zinc-200 break-words whitespace-normal">{row.customerName}</td>
                              <td className="py-2.5 px-3 text-slate-600 dark:text-zinc-400 whitespace-nowrap">{row.cashier}</td>
                              <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{row.createdAt?.split('T')[0]}</td>
                              <td className="py-2.5 px-3 text-amber-600 dark:text-amber-400 whitespace-nowrap">{row.updatedAt?.split('T')[0]}</td>
                              <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700 dark:text-zinc-300 whitespace-nowrap">+{row.timeDeltaMinutes}m</td>
                              <td className="py-2.5 px-3 text-right font-semibold text-slate-900 dark:text-zinc-100 whitespace-nowrap">{formatRs(row.totalAmount)}</td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                {row.hasReturn ? (
                                  <Badge variant="outline" className="text-[10px] text-rose-600 border-rose-300 bg-rose-50 dark:bg-rose-950/20">
                                    Return Logged
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] text-slate-400">
                                    Standard Edit
                                  </Badge>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 dark:text-zinc-400 break-words whitespace-normal">{row.userNotes}</td>
                            </>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Standardized Table Pagination Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between p-3.5 border-t border-slate-200 dark:border-zinc-800 text-xs bg-slate-50/50 dark:bg-zinc-950/30 gap-2">
              <span className="text-slate-500 dark:text-zinc-400">
                Showing {filteredRows.length > 0 ? startIndex + 1 : 0} – {Math.min(startIndex + PAGE_SIZE, filteredRows.length)} of {filteredRows.length} records (Page {currentPage} of {totalPages})
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="h-7 px-2.5 text-xs font-medium border-slate-300 dark:border-zinc-700"
                >
                  <ChevronLeft className="size-3.5 mr-1" /> Prev
                </Button>
                <div className="px-2 text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  {currentPage} / {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="h-7 px-2.5 text-xs font-medium border-slate-300 dark:border-zinc-700"
                >
                  Next <ChevronRight className="size-3.5 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsPage;
