import React, { useState } from 'react';
import { generateFinancialAuditPdf } from '../../utils/pdfGenerator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { toast } from 'react-toastify';
import {
  Calculator,
  Download,
  Loader2,
  Copy,
  CheckCircle2,
  MinusCircle,
  PlusCircle,
  Equal,
} from 'lucide-react';

export type FinancialMetricFocus =
  | 'grossRevenue'
  | 'netSales'
  | 'costOfGoodsSold'
  | 'grossProfit'
  | 'totalExpenses'
  | 'netProfit'
  | 'totalPaid'
  | 'totalDue';

export interface FinancialAuditData {
  grossRevenue: number;
  totalDiscount: number;
  totalReturns?: number;
  netSales: number;
  costOfGoodsSold?: number;
  totalCostOfGoodsSold?: number;
  grossProfit?: number;
  grossProfitMargin?: number;
  totalExpenses?: number;
  netProfit?: number;
  netProfitMargin?: number;
  expensesByCategory?: Array<{ name: string; total: number; count: number }>;
  totalPaid: number;
  totalDue: number;
  orderCount?: number;
  averageOrderValue?: number;
  paymentSplit?: Record<string, { count: number; amount: number }>;
  dateLabel?: string;
  totalProductionCost?: number;
  totalGrnExpenses?: number;
  totalGrnLiabilities?: number;
  netOperationalRevenue?: number;
  netOperationalProfit?: number;
}

interface FinancialAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeMetric: FinancialMetricFocus;
  data: FinancialAuditData;
  onSelectMetric?: (metric: FinancialMetricFocus) => void;
  onDownloadMasterPdf?: () => void;
  downloadingMasterPdf?: boolean;
}

export const FinancialAuditModal: React.FC<FinancialAuditModalProps> = ({
  isOpen,
  onClose,
  activeMetric,
  data,
  onSelectMetric,
  onDownloadMasterPdf,
  downloadingMasterPdf,
}) => {
  const [currentFocus, setCurrentFocus] = useState<FinancialMetricFocus>(activeMetric);
  const [exportingSummaryPdf, setExportingSummaryPdf] = useState(false);

  // Synchronize incoming activeMetric
  React.useEffect(() => {
    setCurrentFocus(activeMetric);
  }, [activeMetric]);

  const grossRevenue = Number(data.grossRevenue) || 0;
  const totalDiscount = Number(data.totalDiscount) || 0;
  const totalReturns = Number(data.totalReturns) || 0;
  const netSales = Number(data.netSales) || 0;
  const cogs = Number(data.costOfGoodsSold ?? data.totalCostOfGoodsSold) || 0;
  const grossProfit = Number(data.grossProfit ?? (netSales - cogs)) || 0;
  const totalExpenses = Number(data.totalExpenses) || 0;
  const netProfit = Number(data.netProfit ?? (grossProfit - totalExpenses)) || 0;
  const totalPaid = Number(data.totalPaid) || 0;
  const totalDue = Number(data.totalDue) || 0;
  const orderCount = Number(data.orderCount) || 0;
  const expensesByCategory = data.expensesByCategory || [];

  const paymentSplit = data.paymentSplit || {};
  const cashAmount = paymentSplit['CASH']?.amount || 0;
  const cashCount = paymentSplit['CASH']?.count || 0;
  const cardAmount = paymentSplit['CARD']?.amount || 0;
  const cardCount = paymentSplit['CARD']?.count || 0;
  const chequeAmount = paymentSplit['CHEQUE']?.amount || 0;
  const chequeCount = paymentSplit['CHEQUE']?.count || 0;

  const formatRs = (val: number) =>
    `Rs. ${(val || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Metric Tab Details strictly following Client-Mandated Formula
  const METRIC_TABS = [
    {
      key: 'netSales' as FinancialMetricFocus,
      label: '1. Total Sales',
      badgeLabel: 'Total Sales',
      color: 'text-blue-600 dark:text-blue-400',
      amount: netSales,
      formula: 'TOTAL SALES (+ Rs. X)',
      description: 'Total billed sales revenue accrued for the selected period after deducting promotions and returns.',
    },
    {
      key: 'costOfGoodsSold' as FinancialMetricFocus,
      label: '2. Cost of Sale',
      badgeLabel: 'Cost of Sale',
      color: 'text-amber-600 dark:text-amber-400',
      amount: cogs,
      formula: 'Less: Cost of Sale (- Rs. Y)',
      description: 'Direct cost of goods sold based on production cost and item purchase prices.',
    },
    {
      key: 'grossProfit' as FinancialMetricFocus,
      label: '3. Gross Profit',
      badgeLabel: 'Gross Profit',
      color: 'text-emerald-600 dark:text-emerald-400',
      amount: grossProfit,
      formula: 'EQUALS: GROSS PROFIT (= Rs. X - Y)',
      description: 'Trading surplus calculated strictly as Total Sales minus Cost of Sale.',
    },
    {
      key: 'totalExpenses' as FinancialMetricFocus,
      label: '4. Total Expenses',
      badgeLabel: 'Total Expenses',
      color: 'text-rose-600 dark:text-rose-400',
      amount: totalExpenses,
      formula: 'Less: Total Expenses (- Rs. Z)',
      description: 'Total operational expenditures recorded in the Expenses module.',
    },
    {
      key: 'netProfit' as FinancialMetricFocus,
      label: '5. Net Profit',
      badgeLabel: 'Net Profit',
      color: 'text-purple-600 dark:text-purple-400',
      amount: netProfit,
      formula: 'EQUALS: NET PROFIT (= Rs. Gross Profit - Z)',
      description: 'True bottom-line net profit calculated strictly as Gross Profit minus Total Expenses.',
    },
  ];

  const currentTab = METRIC_TABS.find((t) => t.key === currentFocus) || METRIC_TABS[0];

  /**
   * Plain-text audit summary strictly adhering to Client-Mandated Formula.
   */
  const generateAuditSummaryText = () => {
    return `=====================================================
RELIANCE APPAREL - FINANCIAL AUDIT BREAKDOWN
Report Period: ${data.dateLabel || 'Selected Range'}
Accounting Engine: Sales - Cost of Sale = Gross Profit | Gross Profit - Expenses = Net Profit
Generated At: ${new Date().toLocaleString()}
=====================================================

1. TOTAL SALES:                               + ${formatRs(netSales)}
2. Less: Cost of Sale:                        - ${formatRs(cogs)}
-----------------------------------------------------
3. EQUALS: GROSS PROFIT:                      = ${formatRs(grossProfit)}

4. Less: Total Expenses:                      - ${formatRs(totalExpenses)}
-----------------------------------------------------
5. EQUALS: NET PROFIT:                        = ${formatRs(netProfit)}
=====================================================
Certified by Reliance Apparel Financial Accounting Engine
=====================================================`;
  };

  /**
   * Copy audit breakdown to clipboard.
   */
  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(generateAuditSummaryText());
      toast.success('Financial Audit Summary copied to clipboard!');
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  /**
   * Export PDF report file.
   */
  const handleDownloadAuditFile = async () => {
    try {
      setExportingSummaryPdf(true);
      await generateFinancialAuditPdf(data, {
        currentFocus,
        dateRangeLabel: data.dateLabel,
      });
      toast.success('Financial Audit PDF exported successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to export Financial Audit PDF');
    } finally {
      setExportingSummaryPdf(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full max-w-lg sm:max-w-2xl lg:max-w-3xl max-h-[90vh] overflow-y-auto p-0 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xl">
        {/* Header */}
        <div className="p-3.5 sm:p-5 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/80">
          <DialogHeader>
            <div className="flex items-center gap-3 pr-8">
              <div className="p-2 sm:p-2.5 rounded-xl bg-emerald-600/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
                <Calculator className="size-4 sm:size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-sm sm:text-base font-bold text-slate-900 dark:text-white break-words pr-8">
                  Financial Breakdown Audit &amp; Formula Transparency
                </DialogTitle>
                <DialogDescription className="text-[11px] sm:text-xs text-slate-500 dark:text-zinc-400 mt-0.5 break-words">
                  Client-Mandated Standard: (Sales - Cost of Sale = Gross Profit) &amp; (Gross Profit - Expenses = Net Profit).
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Interactive Metric Switcher Tabs (Strict 5-Step Mathematical Flow) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5 mt-3 pt-3 border-t border-slate-200/60 dark:border-zinc-800">
            {METRIC_TABS.map((tab) => {
              const isSelected = tab.key === currentFocus;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setCurrentFocus(tab.key);
                    if (onSelectMetric) onSelectMetric(tab.key);
                  }}
                  className={`p-2 rounded-xl text-left transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-white dark:bg-zinc-800 border-emerald-500 shadow-xs ring-1 ring-emerald-500/30'
                      : 'bg-transparent border-transparent hover:bg-white/60 dark:hover:bg-zinc-800/60'
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider block text-slate-400 truncate">
                    {tab.label}
                  </span>
                  <span className={`text-xs font-mono font-bold mt-0.5 block truncate ${tab.color}`}>
                    {formatRs(tab.amount)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Modal Body - Single Unified Scrollable Container */}
        <div className="p-4 sm:p-5 space-y-4 text-xs">
          {/* Formula Transparency Callout Banner */}
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 dark:bg-emerald-950/20 border border-emerald-500/30 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5" />
                <span>Client-Mandated Accounting Formula</span>
              </span>
              <Badge variant="outline" className="text-[10px] font-bold border-emerald-500/40 text-emerald-700 dark:text-emerald-300">
                {currentTab.badgeLabel}
              </Badge>
            </div>

            <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-emerald-500/20 font-mono text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
              {currentTab.formula}
            </div>

            <p className="text-[11px] text-slate-600 dark:text-zinc-300">
              {currentTab.description}
            </p>
          </div>

          {/* ── Strict Client-Mandated Financial Mathematical Flow ── */}
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-2xs divide-y divide-slate-100 dark:divide-zinc-800">
            {/* Step 1: TOTAL SALES */}
            <div
              className={`p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors ${
                currentFocus === 'netSales' ? 'bg-blue-50/60 dark:bg-blue-950/30' : 'bg-white dark:bg-zinc-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 shrink-0">
                  <PlusCircle className="size-4" />
                </div>
                <div>
                  <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white block uppercase tracking-wide">
                    TOTAL SALES
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400 block">
                    Billed sales revenue for selected period
                  </span>
                </div>
              </div>
              <span className="font-mono font-bold text-xs sm:text-sm text-blue-600 dark:text-blue-400">
                + {formatRs(netSales)}
              </span>
            </div>

            {/* Step 2: Less: Cost of Sale */}
            <div
              className={`p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors ${
                currentFocus === 'costOfGoodsSold' ? 'bg-amber-50/60 dark:bg-amber-950/30' : 'bg-white dark:bg-zinc-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 shrink-0">
                  <MinusCircle className="size-4" />
                </div>
                <div>
                  <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white block">
                    Less: Cost of Sale
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400 block">
                    Direct product &amp; material cost of goods sold
                  </span>
                </div>
              </div>
              <span className="font-mono font-bold text-xs sm:text-sm text-amber-600 dark:text-amber-400">
                - {formatRs(cogs)}
              </span>
            </div>

            {/* Step 3: EQUALS: GROSS PROFIT */}
            <div
              className={`p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors ${
                currentFocus === 'grossProfit' ? 'bg-emerald-500/15 dark:bg-emerald-950/40' : 'bg-emerald-50/50 dark:bg-emerald-950/20'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-emerald-600 text-white shrink-0">
                  <Equal className="size-4" />
                </div>
                <div>
                  <span className="font-bold text-xs sm:text-sm text-emerald-900 dark:text-emerald-100 block uppercase tracking-wide">
                    EQUALS: GROSS PROFIT
                  </span>
                  <span className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 block">
                    Total Sales - Cost of Sale
                  </span>
                </div>
              </div>
              <span className="font-mono font-bold text-sm sm:text-base text-emerald-700 dark:text-emerald-300">
                = {formatRs(grossProfit)}
              </span>
            </div>

            {/* Step 4: Less: Total Expenses */}
            <div
              className={`p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors ${
                currentFocus === 'totalExpenses' ? 'bg-rose-50/60 dark:bg-rose-950/30' : 'bg-white dark:bg-zinc-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 shrink-0">
                  <MinusCircle className="size-4" />
                </div>
                <div>
                  <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white block">
                    Less: Total Expenses
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400 block">
                    Operating expenditures from Expenses ledger
                  </span>
                </div>
              </div>
              <span className="font-mono font-bold text-xs sm:text-sm text-rose-600 dark:text-rose-400">
                - {formatRs(totalExpenses)}
              </span>
            </div>

            {/* Step 5: EQUALS: NET PROFIT */}
            <div
              className={`p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors ${
                currentFocus === 'netProfit' ? 'bg-purple-500/15 dark:bg-purple-950/40' : 'bg-purple-50/50 dark:bg-purple-950/20'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-purple-600 text-white shrink-0">
                  <Equal className="size-4" />
                </div>
                <div>
                  <span className="font-bold text-xs sm:text-sm text-purple-900 dark:text-purple-100 block uppercase tracking-wide">
                    EQUALS: NET PROFIT
                  </span>
                  <span className="text-[11px] text-purple-700/80 dark:text-purple-300/80 block">
                    Gross Profit - Total Expenses
                  </span>
                </div>
              </div>
              <span className="font-mono font-bold text-sm sm:text-base text-purple-700 dark:text-purple-300">
                = {formatRs(netProfit)}
              </span>
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 p-3 sm:px-4 bg-slate-50 dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="flex-1 sm:flex-initial h-10 min-h-[40px] sm:h-9 text-xs font-semibold border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-700"
          >
            Close Audit
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleCopySummary}
            className="flex-1 sm:flex-initial h-10 min-h-[40px] sm:h-9 text-xs font-semibold gap-1.5 border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-700"
          >
            <Copy className="size-3.5 text-slate-500" />
            <span>Copy Audit Breakdown</span>
          </Button>

          {onDownloadMasterPdf && (
            <Button
              size="sm"
              onClick={onDownloadMasterPdf}
              disabled={downloadingMasterPdf}
              className="flex-1 sm:flex-initial h-10 min-h-[40px] sm:h-9 text-xs font-semibold gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs disabled:opacity-50"
            >
              {downloadingMasterPdf ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Download className="size-3.5" />
              )}
              <span>Master Audit PDF</span>
            </Button>
          )}

          <Button
            size="sm"
            onClick={handleDownloadAuditFile}
            disabled={exportingSummaryPdf}
            className="flex-1 sm:flex-initial h-10 min-h-[40px] sm:h-9 text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs disabled:opacity-50"
          >
            {exportingSummaryPdf ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            <span>Export Summary</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
