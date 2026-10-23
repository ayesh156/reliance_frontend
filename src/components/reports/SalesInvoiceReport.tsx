import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Loader2, Printer, FileText } from 'lucide-react';
import { generateCustomerDuesPdf, type CustomerDueInvoice } from '../../utils/customerDuesPdf';

export interface SalesInvoiceReportProps {
  invoices?: CustomerDueInvoice[];
  dateRangeLabel?: string;
  generatedBy?: string;
  loading?: boolean;
  onDownloadFullReport?: () => void;
  downloadingFullReport?: boolean;
}

/**
 * SalesInvoiceReport Component:
 * Encapsulates the Sales & Invoice report download actions strictly inline on the exact same
 * horizontal row with the selected date text, full report download button, and Customer Dues PDF button.
 */
export const SalesInvoiceReport: React.FC<SalesInvoiceReportProps> = ({
  invoices = [],
  dateRangeLabel,
  generatedBy,
  loading = false,
  onDownloadFullReport,
  downloadingFullReport = false,
}) => {
  const [downloadingDues, setDownloadingDues] = useState(false);

  const handleDownloadCustomerDues = async () => {
    try {
      setDownloadingDues(true);
      await generateCustomerDuesPdf(invoices, {
        dateRangeLabel,
        generatedBy,
      });
    } finally {
      setDownloadingDues(false);
    }
  };

  return (
    <div className="flex flex-row items-center gap-2">
      {/* Selected Date text strictly inline */}
      {dateRangeLabel && (
        <div className="flex flex-row items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400 shrink-0">
          <span className="font-semibold text-slate-600 dark:text-zinc-300">Selected:</span>
          <Badge variant="outline" className="font-mono text-xs font-semibold px-2.5 py-1 border-blue-200 dark:border-blue-900/60 text-blue-600 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-950/40 shadow-xs">
            {dateRangeLabel}
          </Badge>
        </div>
      )}

      {/* Existing Full Report Download Button */}
      <Button
        onClick={onDownloadFullReport}
        disabled={downloadingFullReport || loading || invoices.length === 0}
        variant="outline"
        size="sm"
        className="h-8 text-xs font-medium shrink-0 border-slate-300 dark:border-zinc-700 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-zinc-800"
      >
        {downloadingFullReport ? (
          <>
            <Loader2 className="size-3.5 mr-1.5 animate-spin" />
            Exporting Sales...
          </>
        ) : (
          <>
            <Printer className="size-3.5 mr-1.5" />
            Download Sales &amp; Invoices PDF
          </>
        )}
      </Button>

      {/* ⭐ Requirement 1: Distinct Download Customer Dues PDF Button strictly inline */}
      <Button
        onClick={handleDownloadCustomerDues}
        disabled={downloadingDues || loading || invoices.length === 0}
        variant="outline"
        size="sm"
        className="h-8 text-xs border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 hover:text-emerald-800 dark:hover:bg-emerald-900/50 font-medium shadow-xs shrink-0"
        title="Download filtered PDF of customers with outstanding dues (dueBalance > 0)"
      >
        {downloadingDues ? (
          <>
            <Loader2 className="size-3.5 mr-1.5 animate-spin" />
            Generating Dues PDF...
          </>
        ) : (
          <>
            <FileText className="size-3.5 mr-1.5 text-emerald-600 dark:text-emerald-400" />
            Download Customer Dues PDF
          </>
        )}
      </Button>
    </div>
  );
};

export default SalesInvoiceReport;
