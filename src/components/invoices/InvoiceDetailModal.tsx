import React, { useState, useMemo } from 'react';
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
import { Input } from '../ui/input';
import { DatePicker } from '../ui/date-picker';
import { toast } from 'react-toastify';
import { put, post } from '../../lib/api';
import { ErrorBoundary } from '../common/ErrorBoundary';
import {
  ReceiptText,
  Calendar,
  User,
  Phone,
  CreditCard,
  Banknote,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FileText,
  Building,
  Printer,
  Download,
  MessageCircle,
  X,
  Loader2,
  ShieldAlert,
  ArrowRight,
  TrendingDown,
  Package,
  RotateCcw,
} from 'lucide-react';

export interface InvoiceChequeItem {
  paymentId?: number;
  chequeNumber: string;
  bankName: string;
  chequeDate?: string;
  amount: number;
  status: 'PENDING' | 'CLEARED' | 'BOUNCED' | string;
  statusLabel: 'PENDING' | 'REALIZED' | 'CANCELLED';
  reference?: string;
}

export interface InvoiceDetailData {
  id: number;
  invoiceNumber?: string;
  source?: string;
  customerName: string;
  customerPhone?: string;
  totalAmount: number;
  paidAmount: number;
  paymentMethod: string;
  createdAt: string;
  subtotal?: number;
  discount?: number;
  customer?: {
    id: number;
    name: string;
    phone: string;
    outstandingBalance?: number;
    address?: string;
    city?: string;
  };
  items?: any[];
  returns?: any[];
  payments?: any[];
  cheques?: any[];
  splitPayments?: any[];
  notes?: string;
  isReturnBill?: boolean;
  returnCreditApplied?: number;
  refundedCashAmount?: number;
}

interface InvoiceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: InvoiceDetailData | null;
  onInvoiceUpdated?: () => void;
  onPrintPreview?: (inv: InvoiceDetailData) => void;
  onDownloadPdf?: (id: number) => void;
  onWhatsApp?: (inv: InvoiceDetailData) => void;
}

const InvoiceDetailModalContent: React.FC<InvoiceDetailModalProps & { invoice: InvoiceDetailData }> = ({
  isOpen,
  onClose,
  invoice,
  onInvoiceUpdated,
  onPrintPreview,
  onDownloadPdf,
  onWhatsApp,
}) => {
  // Action Loading States
  const [actionLoadingId, setActionLoadingId] = useState<number | string | null>(null);

  // Replacement Dialog State
  const [replaceTargetCheque, setReplaceTargetCheque] = useState<InvoiceChequeItem | null>(null);
  const [issueReplacement, setIssueReplacement] = useState<boolean>(true);
  const [cancelReason, setCancelReason] = useState<string>('Insufficient funds / Customer request');
  const [replacementChequeNumber, setReplacementChequeNumber] = useState<string>('');
  const [replacementBankName, setReplacementBankName] = useState<string>('');
  const [replacementDate, setReplacementDate] = useState<Date | undefined>(
    () => new Date(Date.now() + 7 * 86400000)
  );
  const [replacementAmount, setReplacementAmount] = useState<string>('');
  const [isSubmittingCancelReplace, setIsSubmittingCancelReplace] = useState<boolean>(false);

  // Extract Cheques from relational payments array, notes, or split payments
  const chequesList = useMemo<InvoiceChequeItem[]>(() => {
    if (!invoice) return [];
    const list: InvoiceChequeItem[] = [];

    // 1. Relational payments array
    if (Array.isArray(invoice.payments)) {
      invoice.payments.forEach((p: any) => {
        if (String(p.method).toUpperCase() === 'CHEQUE') {
          let chqNum = '-';
          let bName = '-';
          if (p.reference) {
            const matchNum = /Cheque\s*#?([^\s(]+)/i.exec(p.reference);
            if (matchNum) chqNum = matchNum[1];
            else chqNum = p.reference.replace(/\s*\[Edit:.*?\]$/, '').slice(0, 20);
            const matchBank = /\(([^)]+)\)/.exec(p.reference);
            if (matchBank) bName = matchBank[1];
          }
          const st = String(p.chequeStatus || 'PENDING').toUpperCase();
          const isRealized = st === 'CLEARED' || st === 'REALIZED';
          const isBounced = st === 'BOUNCED' || st === 'CANCELLED';

          list.push({
            paymentId: p.id,
            chequeNumber: chqNum,
            bankName: bName,
            chequeDate: p.chequeDate
              ? String(p.chequeDate).split('T')[0]
              : p.createdAt
              ? String(p.createdAt).split('T')[0]
              : undefined,
            amount: Number(p.amount) || 0,
            status: st,
            statusLabel: isRealized ? 'REALIZED' : isBounced ? 'CANCELLED' : 'PENDING',
            reference: p.reference,
          });
        }
      });
    }

    // 2. Structured cheques metadata fallback
    if (list.length === 0 && Array.isArray(invoice.cheques)) {
      invoice.cheques.forEach((c: any) => {
        const st = String(c.status || 'PENDING').toUpperCase();
        const isRealized = st === 'CLEARED' || st === 'REALIZED';
        const isBounced = st === 'BOUNCED' || st === 'CANCELLED';
        list.push({
          paymentId: c.id,
          chequeNumber: c.chequeNumber || '-',
          bankName: c.bankName || '-',
          chequeDate: c.chequeDate ? String(c.chequeDate).split('T')[0] : undefined,
          amount: Number(c.amount) || 0,
          status: st,
          statusLabel: isRealized ? 'REALIZED' : isBounced ? 'CANCELLED' : 'PENDING',
        });
      });
    }

    // 3. Split payments fallback
    if (list.length === 0 && Array.isArray(invoice.splitPayments)) {
      invoice.splitPayments.forEach((s: any) => {
        if (String(s.method).toUpperCase() === 'CHEQUE') {
          const st = String(s.status || 'PENDING').toUpperCase();
          const isRealized = st === 'CLEARED' || st === 'REALIZED';
          const isBounced = st === 'BOUNCED' || st === 'CANCELLED';
          list.push({
            paymentId: s.id,
            chequeNumber: s.chequeNumber || '-',
            bankName: s.bankName || '-',
            chequeDate: s.date ? String(s.date).split('T')[0] : undefined,
            amount: Number(s.amount) || 0,
            status: st,
            statusLabel: isRealized ? 'REALIZED' : isBounced ? 'CANCELLED' : 'PENDING',
          });
        }
      });
    }

    // 4. Default Fallback if single payment method was CHEQUE
    if (list.length === 0 && String(invoice.paymentMethod).toUpperCase() === 'CHEQUE') {
      list.push({
        chequeNumber: 'Registered',
        bankName: '-',
        chequeDate: invoice.createdAt ? String(invoice.createdAt).split('T')[0] : undefined,
        amount: invoice.paidAmount,
        status: 'PENDING',
        statusLabel: 'PENDING',
      });
    }

    return list;
  }, [invoice]);

  if (!invoice) return null;

  const totalAmount = Number(invoice.totalAmount) || 0;
  const paidAmount = Number(invoice.paidAmount) || 0;
  const creditDue = Math.max(0, Math.round((totalAmount - paidAmount) * 100) / 100);
  const subtotal = Number(invoice.subtotal) || (totalAmount + (Number(invoice.discount) || 0));
  const discount = Number(invoice.discount) || 0;
  const invoiceCode = invoice.invoiceNumber || `INV${invoice.id}`;

  // Handle Realizing a Cheque
  const handleRealizeCheque = async (chq: InvoiceChequeItem) => {
    if (!chq.paymentId) {
      toast.warning('This cheque does not have an attached transaction ID.');
      return;
    }
    try {
      setActionLoadingId(chq.paymentId);
      await put(`/payments/${chq.paymentId}`, {
        chequeStatus: 'CLEARED',
        type: 'customer',
        notes: `Cheque #${chq.chequeNumber} cleared and confirmed realized`,
      });
      toast.success(`Cheque #${chq.chequeNumber} marked as REALIZED successfully!`);
      if (onInvoiceUpdated) {
        onInvoiceUpdated();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to realize cheque');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Open Cancel & Replace Prompt
  const handleOpenCancelReplace = (chq: InvoiceChequeItem) => {
    setReplaceTargetCheque(chq);
    setCancelReason('Cheque returned / payment replacement requested');
    setReplacementAmount(String(chq.amount));
    setReplacementBankName(chq.bankName !== '-' ? chq.bankName : '');
    setReplacementChequeNumber('');
    setReplacementDate(new Date(Date.now() + 7 * 86400000));
    setIssueReplacement(true);
  };

  // Execute Cancel & Replace Submission
  const handleSubmitCancelReplace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replaceTargetCheque) return;

    if (issueReplacement) {
      if (!replacementChequeNumber.trim()) {
        toast.error('Please enter the replacement cheque number.');
        return;
      }
      if (!replacementAmount || Number(replacementAmount) <= 0) {
        toast.error('Please enter a valid replacement cheque amount.');
        return;
      }
      if (!replacementDate) {
        toast.error('Please select a valid maturity date for the replacement cheque.');
        return;
      }
    }

    try {
      setIsSubmittingCancelReplace(true);
      const paymentId = replaceTargetCheque.paymentId || 0;

      const formattedChequeDate = replacementDate
        ? `${replacementDate.getFullYear()}-${String(replacementDate.getMonth() + 1).padStart(2, '0')}-${String(replacementDate.getDate()).padStart(2, '0')}`
        : undefined;

      const payload = {
        orderId: invoice.id,
        action: issueReplacement ? 'REPLACE' : 'CANCEL',
        reason: cancelReason.trim(),
        replacement: issueReplacement
          ? {
              chequeNumber: replacementChequeNumber.trim(),
              bankName: replacementBankName.trim(),
              chequeDate: formattedChequeDate,
              amount: Number(replacementAmount),
            }
          : undefined,
      };

      await post(`/payments/${paymentId}/cancel-replace`, payload);

      toast.success(
        issueReplacement
          ? `Cheque cancelled and replacement #${replacementChequeNumber} issued!`
          : `Cheque marked cancelled. Invoice balance updated.`
      );

      setReplaceTargetCheque(null);
      if (onInvoiceUpdated) {
        onInvoiceUpdated();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to process cheque cancellation/replacement');
    } finally {
      setIsSubmittingCancelReplace(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="w-full max-w-lg sm:max-w-2xl lg:max-w-3xl max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xl">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/80 shrink-0">
            <DialogHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                    <ReceiptText className="size-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                        {invoiceCode}
                      </DialogTitle>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-bold uppercase ${
                          creditDue > 0
                            ? 'border-rose-500/40 text-rose-600 dark:text-rose-400 bg-rose-500/10'
                            : 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                        }`}
                      >
                        {creditDue > 0 ? 'PARTIAL / DUE' : 'FULLY PAID'}
                      </Badge>
                    </div>
                    <DialogDescription className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 flex items-center gap-2">
                      <span>Issued: {new Date(invoice.createdAt).toLocaleDateString()}</span>
                      <span>•</span>
                      <span className="font-semibold">{invoice.customerName}</span>
                    </DialogDescription>
                  </div>
                </div>

                {/* Quick Print & Share Icons */}
                <div className="flex items-center gap-1.5 self-end sm:self-center">
                  {onPrintPreview && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onPrintPreview(invoice)}
                      className="h-8 text-xs gap-1.5"
                      title="Print A4 Preview"
                    >
                      <Printer className="size-3.5 text-slate-500" />
                      <span className="hidden sm:inline">Print</span>
                    </Button>
                  )}
                  {onDownloadPdf && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onDownloadPdf(invoice.id)}
                      className="h-8 text-xs gap-1.5 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/50"
                      title="Download PDF"
                    >
                      <Download className="size-3.5" />
                      <span className="hidden sm:inline">PDF</span>
                    </Button>
                  )}
                  {onWhatsApp && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onWhatsApp(invoice)}
                      className="h-8 text-xs gap-1.5 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50"
                      title="WhatsApp Invoice"
                    >
                      <MessageCircle className="size-3.5" />
                      <span className="hidden sm:inline">WhatsApp</span>
                    </Button>
                  )}
                </div>
              </div>
            </DialogHeader>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {/* Customer Details Pill */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800 text-xs">
              <div className="flex items-center gap-2">
                <User className="size-4 text-slate-400" />
                <span className="font-bold text-slate-900 dark:text-white">{invoice.customerName}</span>
                {invoice.customerPhone && (
                  <span className="text-slate-500 font-mono">({invoice.customerPhone})</span>
                )}
              </div>
              {invoice.customer?.outstandingBalance !== undefined && (
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 uppercase font-semibold text-[10px]">Total Ledger Debt:</span>
                  <span
                    className={`font-mono font-bold ${
                      Number(invoice.customer.outstandingBalance) > 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-emerald-600'
                    }`}
                  >
                    Rs. {Number(invoice.customer.outstandingBalance).toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {/* Financial Summary Grid */}
            <div className={`grid grid-cols-2 ${Number(invoice.refundedCashAmount) > 0 ? 'sm:grid-cols-5' : 'sm:grid-cols-4'} gap-2.5`}>
              <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Subtotal</span>
                <span className="font-mono font-bold text-slate-800 dark:text-zinc-200 text-sm mt-0.5 block">
                  Rs. {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
                {discount > 0 && (
                  <span className="text-[10px] text-amber-600 block mt-0.5">
                    - Rs. {discount.toLocaleString()} disc
                  </span>
                )}
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Net Total</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white text-sm mt-0.5 block">
                  Rs. {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5 uppercase">
                  Via {invoice.paymentMethod}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/20">
                <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block tracking-wider">
                  Paid Amount
                </span>
                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300 text-sm mt-0.5 block">
                  Rs. {paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-emerald-600/80 block mt-0.5">
                  {totalAmount > 0 ? `${Math.round((paidAmount / totalAmount) * 100)}% Settled` : '100% Settled'}
                </span>
              </div>

              <div
                className={`p-3 rounded-xl border ${
                  creditDue > 0
                    ? 'bg-rose-500/5 dark:bg-rose-950/20 border-rose-500/20'
                    : 'bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800'
                }`}
              >
                <span
                  className={`text-[10px] uppercase font-bold block tracking-wider ${
                    creditDue > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'
                  }`}
                >
                  Credit Due
                </span>
                <span
                  className={`font-mono font-bold text-sm mt-0.5 block ${
                    creditDue > 0 ? 'text-rose-700 dark:text-rose-300' : 'text-slate-400'
                  }`}
                >
                  Rs. {creditDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {creditDue > 0 ? 'Awaiting settlement' : 'Zero balance'}
                </span>
              </div>

              {Number(invoice.refundedCashAmount) > 0 && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700">
                  <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-300 block tracking-wider">
                    Refunded Cash
                  </span>
                  <span className="font-mono font-bold text-emerald-800 dark:text-emerald-200 text-sm mt-0.5 block">
                    Rs. {Number(invoice.refundedCashAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block mt-0.5 font-medium">
                    Handed to Customer
                  </span>
                </div>
              )}
            </div>

            {/* Cheque Portfolio & Actions Section */}
            <div className="border border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/15 rounded-2xl p-3.5 sm:p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
                    <FileText className="size-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>Cheque Portfolio &amp; Clearance Lifecycle</span>
                      <Badge
                        variant="outline"
                        className="text-[10px] font-bold border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                      >
                        {chequesList.length} {chequesList.length === 1 ? 'Cheque' : 'Cheques'}
                      </Badge>
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                      Manage clearance, mark realized, or bounce/replace cheques with auto balance recalculation.
                    </p>
                  </div>
                </div>

                {/* Quick Realized / Pending Stats */}
                <div className="flex items-center gap-2 text-xs">
                  <div className="px-2 py-0.5 rounded-md bg-white dark:bg-zinc-900 border border-amber-500/20 font-mono text-[11px]">
                    <span className="text-slate-400 mr-1">Pending:</span>
                    <span className="font-bold text-amber-600">
                      Rs.{' '}
                      {chequesList
                        .filter((c) => c.statusLabel === 'PENDING')
                        .reduce((acc, c) => acc + c.amount, 0)
                        .toLocaleString()}
                    </span>
                  </div>
                  <div className="px-2 py-0.5 rounded-md bg-white dark:bg-zinc-900 border border-emerald-500/20 font-mono text-[11px]">
                    <span className="text-slate-400 mr-1">Realized:</span>
                    <span className="font-bold text-emerald-600">
                      Rs.{' '}
                      {chequesList
                        .filter((c) => c.statusLabel === 'REALIZED')
                        .reduce((acc, c) => acc + c.amount, 0)
                        .toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {chequesList.length === 0 ? (
                <div className="py-6 text-center border border-dashed border-amber-500/30 rounded-xl bg-white/40 dark:bg-zinc-900/40">
                  <FileText className="size-6 text-amber-400/60 mx-auto mb-1.5" />
                  <p className="text-xs font-semibold text-slate-600 dark:text-zinc-300">
                    No Cheques Tied to this Invoice
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    This order was settled via cash, card, or direct ledger credit.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {chequesList.map((chq, idx) => {
                    const isPending = chq.statusLabel === 'PENDING';
                    const isRealized = chq.statusLabel === 'REALIZED';
                    const isCancelled = chq.statusLabel === 'CANCELLED';

                    return (
                      <div
                        key={idx}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-white dark:bg-zinc-900 border border-amber-500/25 text-xs shadow-2xs hover:border-amber-500/45 transition-colors"
                      >
                        {/* Cheque Info */}
                        <div className="flex items-start gap-2.5 min-w-0">
                          <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-800 dark:text-amber-200 shrink-0">
                            #{chq.chequeNumber}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900 dark:text-white truncate">
                                {chq.bankName !== '-' ? chq.bankName : 'Registered Cheque'}
                              </span>
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${
                                  isRealized
                                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                                    : isCancelled
                                    ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                                    : 'bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/30'
                                }`}
                              >
                                {chq.statusLabel}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-zinc-400 font-mono mt-0.5">
                              <span>Maturity / Due: {chq.chequeDate || 'Not specified'}</span>
                              {chq.reference && (
                                <span className="opacity-75 truncate max-w-[200px]" title={chq.reference}>
                                  • {chq.reference}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Amount & Actions */}
                        <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-zinc-800">
                          <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                            Rs. {chq.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>

                          <div className="flex items-center gap-1.5">
                            {/* Realize Cheque Action */}
                            {isPending && (
                              <Button
                                size="sm"
                                onClick={() => handleRealizeCheque(chq)}
                                disabled={actionLoadingId === chq.paymentId}
                                className="h-7 px-2.5 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1 shadow-2xs"
                                title="Mark Cheque as Realized"
                              >
                                {actionLoadingId === chq.paymentId ? (
                                  <Loader2 className="size-3 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="size-3" />
                                )}
                                <span>Realize</span>
                              </Button>
                            )}

                            {/* Cancel & Replace Action */}
                            {(isPending || isCancelled) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenCancelReplace(chq)}
                                className={`h-7 px-2.5 text-[11px] font-semibold gap-1 ${
                                  isCancelled
                                    ? 'text-blue-600 border-blue-300 dark:border-blue-800 hover:bg-blue-50'
                                    : 'text-rose-600 border-rose-300 dark:border-rose-800 hover:bg-rose-50'
                                }`}
                                title={isCancelled ? 'Issue Replacement Cheque' : 'Cancel Cheque & Replace'}
                              >
                                <RefreshCw className="size-3" />
                                <span>{isCancelled ? 'Replace' : 'Cancel & Replace'}</span>
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Itemized Order Products Breakdown: Visually separated into Purchased Items & Returned Items */}
            {Array.isArray(invoice.items) && invoice.items.length > 0 && (() => {
              const purchasedItems = invoice.items.filter((item: any) => !item.isReturn && Number(item.price) >= 0);
              const returnedItems = invoice.items.filter((item: any) => Boolean(item.isReturn) || Number(item.price) < 0);

              return (
                <div className="space-y-3">
                  {/* Purchased Items Section */}
                  {purchasedItems.length > 0 && (
                    <div className="rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900">
                      <div className="px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800/60 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between text-xs font-semibold">
                        <span className="text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                          <Package className="size-3.5 text-indigo-500" />
                          <span>Purchased Items ({purchasedItems.length})</span>
                        </span>
                        <span className="text-slate-400 font-mono text-[11px]">Qty &amp; Price Breakdown</span>
                      </div>
                      <div className="divide-y divide-slate-100 dark:divide-zinc-800 text-xs">
                        {purchasedItems.map((item: any, i: number) => {
                          const lineTotal = Number(item.quantity) * Number(item.price);
                          const prodName =
                            item.variant?.product?.name || item.product?.name || item.name || `Item #${i + 1}`;
                          const varInfo = [
                            item.size || item.variant?.size?.name,
                            item.color || item.variant?.color?.name,
                          ]
                            .filter(Boolean)
                            .join(' / ');

                          return (
                            <div key={`purchased-${i}`} className="p-3 flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-800 dark:text-zinc-200 truncate">
                                  {prodName}
                                </p>
                                {varInfo && (
                                  <span className="text-[10px] text-slate-400 font-mono block">{varInfo}</span>
                                )}
                              </div>
                              <div className="text-right shrink-0 font-mono">
                                <span className="text-slate-500 mr-2">
                                  {item.quantity} × Rs. {Number(item.price).toLocaleString()}
                                </span>
                                <span className="font-bold text-slate-900 dark:text-white">
                                  Rs. {lineTotal.toLocaleString()}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Returned Items Section */}
                  {returnedItems.length > 0 && (
                    <div className="rounded-xl border border-rose-200 dark:border-rose-900/50 overflow-hidden bg-rose-50/30 dark:bg-rose-950/20">
                      <div className="px-3.5 py-2.5 bg-rose-100/60 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-900/50 flex items-center justify-between text-xs font-semibold">
                        <span className="text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                          <RotateCcw className="size-3.5 text-rose-600 dark:text-rose-400" />
                          <span>Returned Items ({returnedItems.length})</span>
                          <Badge variant="outline" className="text-[9px] font-bold border-rose-300 dark:border-rose-800 bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 px-1 py-0 ml-1">
                            RETURN
                          </Badge>
                        </span>
                        <span className="text-rose-600/70 dark:text-rose-400/70 font-mono text-[11px]">Stock Restored</span>
                      </div>
                      <div className="divide-y divide-rose-100/80 dark:divide-rose-900/30 text-xs">
                        {returnedItems.map((item: any, i: number) => {
                          const unitRate = Math.abs(Number(item.price));
                          const lineTotal = Number(item.quantity) * unitRate;
                          const prodName =
                            item.variant?.product?.name || item.product?.name || item.name || `Returned Item #${i + 1}`;
                          const varInfo = [
                            item.size || item.variant?.size?.name,
                            item.color || item.variant?.color?.name,
                          ]
                            .filter(Boolean)
                            .join(' / ');

                          return (
                            <div key={`returned-${i}`} className="p-3 flex items-center justify-between gap-2 bg-rose-50/20 dark:bg-rose-950/10">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="font-semibold text-rose-900 dark:text-rose-200 truncate">
                                    {prodName}
                                  </p>
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-200/70 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200">
                                    RETURN
                                  </span>
                                </div>
                                {varInfo && (
                                  <span className="text-[10px] text-rose-500/80 dark:text-rose-400/70 font-mono block">{varInfo}</span>
                                )}
                              </div>
                              <div className="text-right shrink-0 font-mono">
                                <span className="text-rose-600/80 dark:text-rose-400/80 mr-2">
                                  {item.quantity} × Rs. {unitRate.toLocaleString()}
                                </span>
                                <span className="font-bold text-rose-600 dark:text-rose-400">
                                  - Rs. {lineTotal.toLocaleString()}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Footer */}
          <div className="p-3 sm:p-4 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/70 flex items-center justify-between gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">
              Close Summary
            </Button>
            <div className="flex items-center gap-2">
              {creditDue > 0 && (
                <div className="text-right pr-2 hidden sm:block">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Balance Outstanding:</span>
                  <span className="text-xs font-mono font-bold text-rose-600">
                    Rs. {creditDue.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel & Issue Replacement Cheque Modal */}
      {replaceTargetCheque && (
        <Dialog open={!!replaceTargetCheque} onOpenChange={(open) => !open && setReplaceTargetCheque(null)}>
          <DialogContent className="w-full max-w-md p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldAlert className="size-4 text-rose-500" />
                <span>Cancel &amp; Replace Cheque #{replaceTargetCheque.chequeNumber}</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-zinc-400">
                Marks current cheque as cancelled/bounced and synchronizes invoice balances.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmitCancelReplace} className="space-y-3.5 py-2 text-xs">
              {/* Target Cheque Summary */}
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-900 dark:text-rose-200 flex items-center justify-between">
                <div>
                  <span className="font-bold">Cheque #{replaceTargetCheque.chequeNumber}</span>
                  <span className="block text-[11px] opacity-80">
                    {replaceTargetCheque.bankName} • Maturity: {replaceTargetCheque.chequeDate || 'N/A'}
                  </span>
                </div>
                <span className="font-mono font-bold text-sm">
                  Rs. {replaceTargetCheque.amount.toLocaleString()}
                </span>
              </div>

              {/* Cancellation Reason */}
              <div>
                <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                  Cancellation Reason *
                </label>
                <Input
                  required
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Signature mismatch, insufficient funds, etc."
                  className="h-8 text-xs"
                />
              </div>

              {/* Replacement Checkbox Option */}
              <div className="pt-2 border-t border-slate-100 dark:border-zinc-800">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={issueReplacement}
                    onChange={(e) => setIssueReplacement(e.target.checked)}
                    className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-bold text-slate-800 dark:text-zinc-200">
                    Issue Replacement Cheque Now
                  </span>
                </label>
                <p className="text-[11px] text-slate-400 mt-0.5 ml-6">
                  {issueReplacement
                    ? 'Records new cheque details and recalculates invoice balance atomically.'
                    : 'Invoice paid amount will be reduced by this cheque amount immediately.'}
                </p>
              </div>

              {/* Replacement Form Fields */}
              {issueReplacement && (
                <div className="space-y-2.5 p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-300 block mb-1">
                        New Cheque # *
                      </label>
                      <Input
                        required
                        value={replacementChequeNumber}
                        onChange={(e) => setReplacementChequeNumber(e.target.value)}
                        placeholder="e.g. 789456"
                        className="h-8 text-xs font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-300 block mb-1">
                        Bank Name
                      </label>
                      <Input
                        value={replacementBankName}
                        onChange={(e) => setReplacementBankName(e.target.value)}
                        placeholder="e.g. Commercial Bank"
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-300 block mb-1">
                        Maturity Date *
                      </label>
                      <DatePicker
                        date={replacementDate}
                        onDateChange={setReplacementDate}
                        placeholder="Select maturity date"
                        className="h-8 text-xs font-mono font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-300 block mb-1">
                        Amount (Rs.) *
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        value={replacementAmount}
                        onChange={(e) => setReplacementAmount(e.target.value)}
                        placeholder="0.00"
                        className="h-8 text-xs font-mono font-bold"
                      />
                    </div>
                  </div>

                  {/* Balance Recalculation Impact Preview */}
                  <div className="p-2 rounded-lg bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/50 dark:border-blue-900/40 text-[11px] text-blue-900 dark:text-blue-200 flex items-center justify-between">
                    <span className="font-semibold">Net Balance Impact:</span>
                    <span className="font-mono font-bold">
                      {Number(replacementAmount || 0) === replaceTargetCheque.amount
                        ? 'Zero delta (Equal swap)'
                        : Number(replacementAmount || 0) > replaceTargetCheque.amount
                        ? `+ Rs. ${(Number(replacementAmount) - replaceTargetCheque.amount).toLocaleString()} paid`
                        : `- Rs. ${(replaceTargetCheque.amount - Number(replacementAmount || 0)).toLocaleString()} to due`}
                    </span>
                  </div>
                </div>
              )}

              <DialogFooter className="pt-2 gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setReplaceTargetCheque(null)}
                  disabled={isSubmittingCancelReplace}
                  className="h-8 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingCancelReplace}
                  className="h-8 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white gap-1.5"
                >
                  {isSubmittingCancelReplace ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Processing...
                    </>
                  ) : issueReplacement ? (
                    'Confirm Cancel & Replace'
                  ) : (
                    'Confirm Cheque Cancellation'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

/**
 * Robust Enterprise InvoiceDetailModal Export
 * Guarantees that hooks are never invoked with a null invoice and wraps the modal
 * in an ErrorBoundary to prevent any rendering or hook exceptions from crashing the application.
 */
export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = (props) => {
  if (!props.isOpen || !props.invoice) {
    return null;
  }

  return (
    <ErrorBoundary resetKey={props.invoice?.id}>
      <InvoiceDetailModalContent {...props} invoice={props.invoice} />
    </ErrorBoundary>
  );
};
