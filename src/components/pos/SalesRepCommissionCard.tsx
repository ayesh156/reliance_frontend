import React from 'react';
import { UserCheck, TrendingDown, Award } from 'lucide-react';

export interface SalesRepCommissionCardProps {
  repName: string;
  repRole?: string;
  commissionRatePct?: number;
  ratePercent?: number;
  initialRepEarning?: number;
  initialEarning?: number;
  initialCommission?: number;
  returnDeduction: number;
  netPayableToRep?: number;
  netRepPayable?: number;
  netCommission?: number;
  hasReturns?: boolean;
}

export const SalesRepCommissionCard: React.FC<SalesRepCommissionCardProps> = ({
  repName,
  commissionRatePct,
  ratePercent,
  initialRepEarning,
  initialEarning,
  initialCommission,
  returnDeduction,
  netPayableToRep,
  netRepPayable,
  netCommission,
}) => {
  const rate = commissionRatePct ?? ratePercent ?? 5;
  const initial = initialRepEarning ?? initialEarning ?? initialCommission ?? 0;
  const net = netPayableToRep ?? netRepPayable ?? netCommission ?? 0;

  return (
    <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/60 bg-gradient-to-br from-indigo-50/70 to-blue-50/40 dark:from-indigo-950/40 dark:to-zinc-900/60 p-2.5 text-xs space-y-1.5 shadow-2xs">
      <div className="flex items-center justify-between pb-1 border-b border-indigo-100 dark:border-indigo-900/50">
        <div className="flex items-center gap-1.5">
          <div className="p-1 rounded-md bg-indigo-600 text-white shadow-2xs">
            <UserCheck className="size-3" />
          </div>
          <div>
            <span className="font-bold text-[11px] text-indigo-950 dark:text-indigo-200 block leading-tight">
              Sales Rep Settlement
            </span>
            <span className="text-[10px] text-indigo-700/80 dark:text-indigo-300/80 font-medium truncate max-w-[150px] block">
              Rep: {repName} ({rate}%)
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-100/70 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-300 font-bold shrink-0">
          <Award className="size-3 text-indigo-600 dark:text-indigo-400" />
          <span>Comm. Rate {rate}%</span>
        </div>
      </div>

      <div className="space-y-1 pt-0.5">
        <div className="flex items-center justify-between text-slate-600 dark:text-zinc-400 text-[10.5px]">
          <span>Initial Rep Earning:</span>
          <span className="font-mono font-semibold text-slate-800 dark:text-zinc-200">
            Rs. {initial.toLocaleString()}
          </span>
        </div>

        {returnDeduction > 0 && (
          <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 text-[10.5px]">
            <span className="flex items-center gap-1">
              <TrendingDown className="size-3" />
              <span>Deduction from Returns ({rate}%):</span>
            </span>
            <span className="font-mono font-bold">
              - Rs. {returnDeduction.toLocaleString()}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between pt-1 border-t border-indigo-200/60 dark:border-indigo-900/60 text-xs font-bold text-indigo-950 dark:text-white">
          <span className="text-indigo-900 dark:text-indigo-200">Net Payable to Rep:</span>
          <span className="font-mono text-sm font-extrabold text-indigo-700 dark:text-indigo-300">
            Rs. {net.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
};
