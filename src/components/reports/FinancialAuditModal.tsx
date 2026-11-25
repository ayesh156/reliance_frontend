import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { toast } from 'react-toastify';
import { Calculator, Copy } from 'lucide-react';

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
  totalGrnPurchases?: number;
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
  data,
}) => {
  const netSales = Number(data.netSales) || 0;
  const cogs = Number(data.costOfGoodsSold ?? data.totalCostOfGoodsSold) || 0;
  const grossProfit = Number(data.grossProfit ?? (netSales - cogs)) || 0;
  const totalExpenses = Number(data.totalExpenses) || 0;
  const netProfit = Number(data.netProfit ?? (grossProfit - totalExpenses)) || 0;

  const formatRs = (val: number) =>
    `Rs. ${(val || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  /**
   * Compact 2-line accrual P&L formula summary for clipboard export (matches 4 summary cards 1-to-1).
   */
  const generateAuditSummaryText = () => {
    const periodLine = data.dateLabel ? ` (${data.dateLabel})` : '';
    const line1 = `Gross Profit${periodLine}: ${formatRs(netSales)} (Total Sales) - ${formatRs(cogs)} (Cost of Sales) = ${formatRs(grossProfit)}`;
    const line2 = `Net Profit: ${formatRs(grossProfit)} (Gross Profit) - ${formatRs(totalExpenses)} (Total Expenses) = ${formatRs(netProfit)}`;
    return `${line1}\n${line2}`;
  };

  /**
   * Copy compact 2-line P&L formula summary to clipboard.
   */
  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(generateAuditSummaryText());
      toast.success('Summary copied to clipboard!');
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] max-w-md sm:max-w-lg p-0 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xl overflow-hidden">
        {/* Compact Header */}
        <div className="px-4 py-3.5 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/80 pr-11">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-emerald-600/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
                  <Calculator className="size-4" />
                </div>
                <DialogTitle className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                  Financial Profit Audit
                </DialogTitle>
              </div>
              {data.dateLabel && (
                <Badge variant="outline" className="text-[10px] font-medium shrink-0 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300">
                  {data.dateLabel}
                </Badge>
              )}
            </div>
          </DialogHeader>
        </div>

        {/* Ultra-Compact Single-View 2-Block P&L Formula (Zero Scroll) */}
        <div className="p-4 space-y-3 text-xs">
          {/* Block 1: Gross Profit */}
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/40 p-3.5 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-600 dark:text-zinc-300 font-medium">Total Sales</span>
              <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-zinc-100 whitespace-nowrap">
                {formatRs(netSales)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-600 dark:text-zinc-300 font-medium">- Cost of Sales</span>
              <span className="font-mono tabular-nums font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                - {formatRs(cogs)}
              </span>
            </div>
            <div className="border-t border-slate-200 dark:border-zinc-800 pt-2 flex items-center justify-between gap-3">
              <span className="font-bold text-slate-900 dark:text-white">= Gross Profit</span>
              <span className="font-mono tabular-nums font-bold text-sm text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                {formatRs(grossProfit)}
              </span>
            </div>
          </div>

          {/* Block 2: Net Profit */}
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/40 p-3.5 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-600 dark:text-zinc-300 font-medium">Gross Profit</span>
              <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-zinc-100 whitespace-nowrap">
                {formatRs(grossProfit)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-600 dark:text-zinc-300 font-medium">- Total Expenses</span>
              <span className="font-mono tabular-nums font-semibold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                - {formatRs(totalExpenses)}
              </span>
            </div>

            <div className="border-t border-slate-200 dark:border-zinc-800 pt-2 flex items-center justify-between gap-3">
              <span className="font-bold text-slate-900 dark:text-white">= Net Profit</span>
              <span
                className={`font-mono tabular-nums font-bold text-sm sm:text-base whitespace-nowrap px-2 py-0.5 rounded-lg ${
                  netProfit >= 0
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                    : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                }`}
              >
                {formatRs(netProfit)}
              </span>
            </div>
          </div>
        </div>

        {/* Compact Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 bg-slate-50 dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopySummary}
            className="h-8 text-xs font-semibold gap-1.5 border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-700"
          >
            <Copy className="size-3.5 text-slate-500" />
            <span>Copy Summary</span>
          </Button>
          <Button
            size="sm"
            onClick={onClose}
            className="h-8 text-xs font-semibold bg-slate-900 hover:bg-slate-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
