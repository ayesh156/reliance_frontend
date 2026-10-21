import React from 'react';
import { Badge } from '../ui/badge';

export interface BatchStatusBadgeProps {
  status: string;
  isStockSynced?: boolean;
  className?: string;
}

/**
 * Standardized High-Contrast Unified Batch Status Badge.
 * Guarantees a single source of truth across the ledger, detail, and edit modals.
 */
export const BatchStatusBadge: React.FC<BatchStatusBadgeProps> = ({
  status,
  isStockSynced,
  className = '',
}) => {
  const st = (status || '').toUpperCase();

  if (st === 'CUTTING') {
    return (
      <Badge
        variant="outline"
        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-amber-400 dark:border-amber-700 shadow-2xs ${className}`}
      >
        CUTTING
      </Badge>
    );
  }

  if (st === 'IN_PROGRESS' || st === 'WIP') {
    return (
      <Badge
        variant="outline"
        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200 border-blue-400 dark:border-blue-700 shadow-2xs ${className}`}
      >
        WIP
      </Badge>
    );
  }

  if (st === 'FINISHED_PENDING_STOCK' || (!isStockSynced && st === 'COMPLETED')) {
    return (
      <Badge
        variant="outline"
        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-200 border-purple-400 dark:border-purple-700 shadow-2xs ${className}`}
      >
        AWAITING STOCK SYNC
      </Badge>
    );
  }

  if (st === 'COMPLETED' && isStockSynced) {
    return (
      <Badge
        variant="outline"
        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 border-emerald-400 dark:border-emerald-700 shadow-2xs ${className}`}
      >
        COMPLETED
      </Badge>
    );
  }

  if (st === 'CANCELLED') {
    return (
      <Badge
        variant="outline"
        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200 border-rose-400 dark:border-rose-700 shadow-2xs ${className}`}
      >
        CANCELLED
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className={`text-[11px] font-bold ${className}`}>
      {status || 'CUTTING'}
    </Badge>
  );
};

export default BatchStatusBadge;
