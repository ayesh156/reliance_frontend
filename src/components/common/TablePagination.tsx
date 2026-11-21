import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

export interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize?: number;
  visibleCount?: number;
  startIndex?: number;
  endIndex?: number;
  onPageChange: (page: number) => void;
  className?: string;
  itemNoun?: string;
  itemLabel?: string;
}

/**
 * Standardized Unified Table Pagination Component.
 * Matches the Products page footer design:
 * - Left side: muted count indicator `Showing {visibleCount} of {totalCount}` or `{start}–{end} of {totalCount}`
 * - Right side: rounded pill `< Prev` button, bold page counter `{currentPage} / {totalPages}`, and rounded pill `Next >` button
 * - Clean styling across Light and Dark themes.
 */
export const TablePagination: React.FC<TablePaginationProps> = ({
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  visibleCount,
  startIndex,
  endIndex,
  onPageChange,
  className,
  itemNoun,
  itemLabel,
}) => {
  const safeTotalPages = Math.max(1, totalPages || 1);
  const safeCurrentPage = Math.max(1, Math.min(currentPage || 1, safeTotalPages));

  // Determine the display count string matching Products page footer style
  let countText = '';
  if (startIndex !== undefined && endIndex !== undefined) {
    const s = totalCount > 0 ? startIndex + 1 : 0;
    const e = Math.min(endIndex, totalCount);
    countText = `Showing ${s}–${e} of ${totalCount}`;
  } else if (pageSize !== undefined && pageSize > 0) {
    const s = totalCount > 0 ? (safeCurrentPage - 1) * pageSize + 1 : 0;
    const e = Math.min(safeCurrentPage * pageSize, totalCount);
    countText = `Showing ${s}–${e} of ${totalCount}`;
  } else if (visibleCount !== undefined) {
    countText = `Showing ${visibleCount} of ${totalCount}`;
  } else {
    countText = `Showing ${totalCount} records`;
  }

  const noun = itemLabel || itemNoun;
  if (noun) {
    countText += ` ${noun}`;
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between pt-4 mt-2 border-t border-slate-100 dark:border-zinc-800 text-xs',
        className
      )}
    >
      <span className="text-zinc-400 dark:text-zinc-500 font-normal">
        {countText}
      </span>
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          disabled={safeCurrentPage <= 1}
          onClick={() => onPageChange(safeCurrentPage - 1)}
          className="rounded-xl h-8 px-2.5 text-xs font-medium cursor-pointer transition-colors"
        >
          <ChevronLeft className="size-3.5 mr-1" /> Prev
        </Button>
        <span className="px-2 font-semibold text-slate-800 dark:text-zinc-200">
          {safeCurrentPage} / {safeTotalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={safeCurrentPage >= safeTotalPages}
          onClick={() => onPageChange(safeCurrentPage + 1)}
          className="rounded-xl h-8 px-2.5 text-xs font-medium cursor-pointer transition-colors"
        >
          Next <ChevronRight className="size-3.5 ml-1" />
        </Button>
      </div>
    </div>
  );
};

export default TablePagination;
