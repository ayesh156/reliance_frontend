import React, { useState, useEffect } from 'react';
import { startOfYear, endOfYear } from 'date-fns';
import { DateRangePicker, type DateRange } from '../ui/date-range-picker';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Loader2, FileText, Printer } from 'lucide-react';
import { generateChequeLedgerPdf, formatChequeLedgerPdfRows } from '../../utils/ChequeLedgerPdf';

export interface ChequeLedgerReportProps {
  initialDateRange?: DateRange;
  onDateRangeChange?: (range: DateRange | undefined) => void;
  reportData?: any;
  loading?: boolean;
}

/**
 * ChequeLedgerReport Component:
 * Encapsulates the Cheque Ledger reporting view with default date range initialized
 * to "This Year" (startOfYear to endOfYear), and integrates with ChequeLedgerPdf.
 */
export const ChequeLedgerReport: React.FC<ChequeLedgerReportProps> = ({
  initialDateRange,
  onDateRangeChange,
  reportData,
  loading = false,
}) => {
  // ⭐ Requirement 1: Update the initial state of the date range picker in Cheque Ledger to default to "This Year"
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    if (initialDateRange) return initialDateRange;
    return {
      from: startOfYear(new Date()),
      to: endOfYear(new Date()),
    };
  });

  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    if (onDateRangeChange) {
      onDateRangeChange(dateRange);
    }
  }, [dateRange, onDateRangeChange]);

  const handleDownloadPdf = async () => {
    try {
      setDownloadingPdf(true);
      await generateChequeLedgerPdf(reportData || {});
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Date Range:</span>
          <div className="w-64">
            <DateRangePicker
              date={dateRange}
              onDateChange={(range) => {
                setDateRange(range);
                onDateRangeChange?.(range);
              }}
              placeholder="This Year..."
              className="h-8 text-xs"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleDownloadPdf}
            disabled={downloadingPdf || loading || !reportData}
            className="h-8 text-xs font-medium"
          >
            {downloadingPdf ? (
              <Loader2 className="size-3.5 mr-1.5 animate-spin" />
            ) : (
              <Printer className="size-3.5 mr-1.5" />
            )}
            Download Cheque Ledger PDF
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChequeLedgerReport;
