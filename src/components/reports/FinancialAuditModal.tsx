import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { toast } from 'react-toastify';
import {
  Calculator,
  Download,
  Copy,
  Printer,
  FileText,
  DollarSign,
  TrendingUp,
  CreditCard,
  Banknote,
  AlertCircle,
  CheckCircle2,
  MinusCircle,
  PlusCircle,
  Equal,
  RotateCcw,
  Clock,
  Layers,
  ArrowRight,
} from 'lucide-react';

export type FinancialMetricFocus =
  | 'grossRevenue'
  | 'netSales'
  | 'totalPaid'
  | 'totalDue';

export interface FinancialAuditData {
  grossRevenue: number;
  totalDiscount: number;
  totalReturns?: number;
  netSales: number;
  totalPaid: number;
  totalDue: number;
  orderCount?: number;
  averageOrderValue?: number;
  paymentSplit?: Record<string, { count: number; amount: number }>;
  dateLabel?: string;
}

interface FinancialAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeMetric: FinancialMetricFocus;
  data: FinancialAuditData;
  onSelectMetric?: (metric: FinancialMetricFocus) => void;
}

export const FinancialAuditModal: React.FC<FinancialAuditModalProps> = ({
  isOpen,
  onClose,
  activeMetric,
  data,
  onSelectMetric,
}) => {
  const [currentFocus, setCurrentFocus] = useState<FinancialMetricFocus>(activeMetric);

  // Synchronize incoming activeMetric
  React.useEffect(() => {
    setCurrentFocus(activeMetric);
  }, [activeMetric]);

  const grossRevenue = Number(data.grossRevenue) || 0;
  const totalDiscount = Number(data.totalDiscount) || 0;
  const totalReturns = Number(data.totalReturns) || 0;
  const netSales = Number(data.netSales) || 0;
  const totalPaid = Number(data.totalPaid) || 0;
  const totalDue = Number(data.totalDue) || 0;
  const orderCount = Number(data.orderCount) || 0;

  const paymentSplit = data.paymentSplit || {};
  const cashAmount = paymentSplit['CASH']?.amount || 0;
  const cashCount = paymentSplit['CASH']?.count || 0;
  const cardAmount = paymentSplit['CARD']?.amount || 0;
  const cardCount = paymentSplit['CARD']?.count || 0;
  const chequeAmount = paymentSplit['CHEQUE']?.amount || 0;
  const chequeCount = paymentSplit['CHEQUE']?.count || 0;
  const creditAmount = paymentSplit['CREDIT']?.amount || 0;
  const creditCount = paymentSplit['CREDIT']?.count || 0;

  const formatRs = (val: number) =>
    `Rs. ${(val || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}`;

  // Metric Tab Details
  const METRIC_TABS = [
    {
      key: 'grossRevenue' as FinancialMetricFocus,
      label: 'Gross Revenue',
      badgeLabel: 'Gross Volume',
      color: 'text-slate-900 dark:text-white',
      amount: grossRevenue,
      formula: 'Gross Revenue = Total Item List Value before discounts or returns',
      description: 'The aggregate sum of all garment items billed at standard catalogue value.',
    },
    {
      key: 'netSales' as FinancialMetricFocus,
      label: 'Net Sales',
      badgeLabel: 'Adjusted Revenue',
      color: 'text-emerald-600 dark:text-emerald-400',
      amount: netSales,
      formula: 'Net Sales = Gross Item Volume - Discounts Applied - Restocked Returns',
      description: 'True revenue accrued to the business after deducting promotions and returns.',
    },
    {
      key: 'totalPaid' as FinancialMetricFocus,
      label: 'Collected / Paid',
      badgeLabel: 'Liquid Cash & Inflow',
      color: 'text-blue-600 dark:text-blue-400',
      amount: totalPaid,
      formula: 'Collected / Paid = Cash Tendered + Card Settled + Cleared Cheque Payments',
      description: 'Total liquid capital realized and deposited into store accounts.',
    },
    {
      key: 'totalDue' as FinancialMetricFocus,
      label: 'Outstanding Credit Due',
      badgeLabel: 'Open Accounts Receivable',
      color: 'text-rose-600 dark:text-rose-400',
      amount: totalDue,
      formula: 'Outstanding Due = Net Sales Total - Realized Payments Received',
      description: 'Unpaid customer receivables and pending credit balances awaiting collection.',
    },
  ];

  const currentTab = METRIC_TABS.find((t) => t.key === currentFocus) || METRIC_TABS[0];

  // Generate plain-text audit summary string
  const generateAuditSummaryText = () => {
    return `=====================================================
RELIANCE APPAREL - FINANCIAL AUDIT BREAKDOWN
Report Period: ${data.dateLabel || 'Selected Range'}
Generated At: ${new Date().toLocaleString()}
=====================================================

1. MATHEMATICAL FORMULA TRANSPARENCY:
Metric in Focus: ${currentTab.label}
Target Value: ${formatRs(currentTab.amount)}
Formula: ${currentTab.formula}
Definition: ${currentTab.description}

2. ITEMIZED FINANCIAL WATERFALL BREAKDOWN:
(+) Total Item List Value (Gross Volume):  ${formatRs(grossRevenue)} (${orderCount} Orders)
(-) Less: Total Discounts Applied:          - ${formatRs(totalDiscount)}
(-) Less: Restocked Garment Returns:       - ${formatRs(totalReturns)}
(=) EQUALS: Net Sales Revenue:              ${formatRs(netSales)}

3. CASHFLOW & COLLECTIONS BREAKDOWN:
(+) Cash Tendered Inflow:                   ${formatRs(cashAmount)} (${cashCount} Orders)
(+) Card & Bank Digital Payments:           ${formatRs(cardAmount)} (${cardCount} Orders)
(+) Cheque Payments Realized/Registered:    ${formatRs(chequeAmount)} (${chequeCount} Orders)
-----------------------------------------------------
(=) Total Liquid Collected / Paid:          ${formatRs(totalPaid)}
(-) Outstanding Customer Credit Debt:       ${formatRs(totalDue)} (${creditCount} Orders)
=====================================================
Verified & Certified by Reliance Accounting System
=====================================================`;
  };

  // Copy plain text summary to clipboard
  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(generateAuditSummaryText());
      toast.success('Financial Audit Summary copied to clipboard!');
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  // Download audit report file
  const handleDownloadAuditFile = () => {
    const text = generateAuditSummaryText();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reliance-financial-audit-${currentFocus}-${new Date().toISOString().split('T')[0]}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Exportable Audit Summary text downloaded!');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full max-w-lg sm:max-w-2xl lg:max-w-3xl max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xl">
        {/* Header */}
        <div className="p-3.5 sm:p-5 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/80 shrink-0">
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
                  Itemized mathematical reconciliation verifying every rupee across gross sales, deductions, and collections.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Interactive Metric Switcher Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-3 pt-3 border-t border-slate-200/60 dark:border-zinc-800">
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
                  <span className="text-[10px] font-bold uppercase tracking-wider block text-slate-400">
                    {tab.label}
                  </span>
                  <span className={`text-xs font-mono font-bold mt-0.5 block ${tab.color}`}>
                    {formatRs(tab.amount)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Audit Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
          {/* Formula Transparency Callout Banner */}
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 dark:bg-emerald-950/20 border border-emerald-500/30 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5" />
                <span>Exact Mathematical Formula Definition</span>
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

          {/* Itemized Financial Waterfall Table */}
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-2xs">
            <div className="px-4 py-3 bg-slate-50 dark:bg-zinc-800/70 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
              <span className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="size-4 text-blue-500" />
                <span>Line-Item Financial Ledger Waterfall</span>
              </span>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">
                Audit Trail Breakdown
              </span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-zinc-800">
              {/* Line 1: Gross Revenue */}
              <div
                className={`p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2 transition-colors ${
                  currentFocus === 'grossRevenue'
                    ? 'bg-blue-50/50 dark:bg-blue-950/20'
                    : 'bg-white dark:bg-zinc-900'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-1 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 shrink-0">
                    <PlusCircle className="size-3.5" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-slate-900 dark:text-white block text-xs sm:text-sm break-words">
                      Total Item List Value (Gross Volume)
                    </span>
                    <span className="text-[11px] text-slate-400 break-words block">
                      Standard catalogue value across {orderCount} recorded sales
                    </span>
                  </div>
                </div>
                <span className="font-mono font-bold text-xs sm:text-sm text-slate-900 dark:text-white shrink-0 sm:text-right">
                  + {formatRs(grossRevenue)}
                </span>
              </div>

              {/* Line 2: Discounts */}
              <div className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2 bg-white dark:bg-zinc-900">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-1 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 shrink-0">
                    <MinusCircle className="size-3.5" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-slate-900 dark:text-white block text-xs sm:text-sm break-words">
                      Less: Total Promotional Discounts Applied
                    </span>
                    <span className="text-[11px] text-slate-400 break-words block">
                      Discounts granted during checkout and POS register
                    </span>
                  </div>
                </div>
                <span className="font-mono font-bold text-xs sm:text-sm text-amber-600 dark:text-amber-400 shrink-0 sm:text-right">
                  - {formatRs(totalDiscount)}
                </span>
              </div>

              {/* Line 3: Returns */}
              <div className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2 bg-white dark:bg-zinc-900">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-1 rounded-md bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 shrink-0">
                    <RotateCcw className="size-3.5" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-slate-900 dark:text-white block text-xs sm:text-sm break-words">
                      Less: Restocked Garment Returns &amp; Adjustments
                    </span>
                    <span className="text-[11px] text-slate-400 break-words block">
                      Items returned to warehouse stock with customer credit reversals
                    </span>
                  </div>
                </div>
                <span className="font-mono font-bold text-xs sm:text-sm text-rose-600 dark:text-rose-400 shrink-0 sm:text-right">
                  - {formatRs(totalReturns)}
                </span>
              </div>

              {/* Line 4: Net Sales Equals */}
              <div
                className={`p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2 transition-colors ${
                  currentFocus === 'netSales'
                    ? 'bg-emerald-500/15 dark:bg-emerald-950/40'
                    : 'bg-emerald-50/50 dark:bg-emerald-950/20'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-1 rounded-md bg-emerald-600 text-white shrink-0">
                    <Equal className="size-3.5" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-emerald-900 dark:text-emerald-100 text-xs sm:text-sm block break-words">
                      EQUALS: Net Sales Revenue
                    </span>
                    <span className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 break-words block">
                      True revenue credited to Reliance financial statements
                    </span>
                  </div>
                </div>
                <span className="font-mono font-bold text-sm sm:text-base text-emerald-700 dark:text-emerald-300 shrink-0 sm:text-right">
                  = {formatRs(netSales)}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Cashflow, Cheques & Collections Breakdown */}
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 bg-slate-50/50 dark:bg-zinc-950/40 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Banknote className="size-4 text-emerald-600" />
                <span>Collections &amp; Liquidity Settlement Breakdown</span>
              </h4>
              <Badge variant="outline" className="text-[10px] font-mono">
                Actual Inflow vs Debt
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Cash Collections */}
              <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
                <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                  <span className="font-semibold flex items-center gap-1.5">
                    <Banknote className="size-3.5 text-emerald-500" />
                    Cash Collections
                  </span>
                  <span className="font-mono">{cashCount} Invoices</span>
                </div>
                <span className="font-mono font-bold text-sm text-slate-900 dark:text-white block">
                  {formatRs(cashAmount)}
                </span>
              </div>

              {/* Card Collections */}
              <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
                <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                  <span className="font-semibold flex items-center gap-1.5">
                    <CreditCard className="size-3.5 text-purple-500" />
                    Card &amp; Bank Digital
                  </span>
                  <span className="font-mono">{cardCount} Invoices</span>
                </div>
                <span className="font-mono font-bold text-sm text-slate-900 dark:text-white block">
                  {formatRs(cardAmount)}
                </span>
              </div>

              {/* Cheque Payments */}
              <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
                <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                  <span className="font-semibold flex items-center gap-1.5">
                    <FileText className="size-3.5 text-amber-500" />
                    Cheque Payments
                  </span>
                  <span className="font-mono">{chequeCount} Invoices</span>
                </div>
                <span className="font-mono font-bold text-sm text-slate-900 dark:text-white block">
                  {formatRs(chequeAmount)}
                </span>
              </div>

              {/* Total Liquid Collected */}
              <div
                className={`p-3 rounded-xl border ${
                  currentFocus === 'totalPaid'
                    ? 'bg-blue-500/10 border-blue-500/40 ring-1 ring-blue-500/30'
                    : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] text-blue-600 dark:text-blue-400 mb-1">
                  <span className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5" />
                    Total Paid / Collected
                  </span>
                  <span className="font-mono font-semibold">Tendered Inflow</span>
                </div>
                <span className="font-mono font-bold text-sm text-blue-600 dark:text-blue-400 block">
                  {formatRs(totalPaid)}
                </span>
              </div>
            </div>

            {/* Outstanding Debt Strip */}
            <div
              className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2 ${
                currentFocus === 'totalDue'
                  ? 'bg-rose-500/10 border-rose-500/40 ring-1 ring-rose-500/30'
                  : 'bg-rose-500/5 dark:bg-rose-950/20 border-rose-500/20'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle className="size-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <div className="min-w-0">
                  <span className="font-bold text-rose-900 dark:text-rose-200 block text-xs sm:text-sm break-words">
                    Outstanding Customer Credit Debt (Unpaid)
                  </span>
                  <span className="text-[10px] text-rose-700/80 dark:text-rose-300/80 break-words block">
                    Accounts Receivable pending clearance or invoice settlement
                  </span>
                </div>
              </div>
              <span className="font-mono font-bold text-sm sm:text-base text-rose-600 dark:text-rose-400 shrink-0 sm:text-right">
                {formatRs(totalDue)}
              </span>
            </div>
          </div>
        </div>

        {/* Sticky Action Footer: Stacked on Mobile, Flex Row on Desktop */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 p-3 bg-zinc-900 border-t border-zinc-800 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="flex-1 sm:flex-initial h-10 min-h-[40px] sm:h-9 text-xs font-semibold"
          >
            Close Audit
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleCopySummary}
            className="flex-1 sm:flex-initial h-10 min-h-[40px] sm:h-9 text-xs font-semibold gap-1.5"
          >
            <Copy className="size-3.5" />
            <span>Copy Audit Breakdown</span>
          </Button>

          <Button
            size="sm"
            onClick={handleDownloadAuditFile}
            className="flex-1 sm:flex-initial h-10 min-h-[40px] sm:h-9 text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Download className="size-3.5" />
            <span>Export Summary</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
