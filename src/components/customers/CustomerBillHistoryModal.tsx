import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import {
  FileText,
  Search,
  Download,
  MessageSquare,
  Receipt,
  RotateCcw,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  CreditCard,
  Building,
  Phone,
  Calendar,
  ExternalLink,
  Edit2,
  MapPin,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  Banknote,
  Landmark,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { get, put, post, del } from '../../lib/api';
import { toast } from 'react-toastify';
import { getInvoiceAgeInfo } from '../../utils/invoiceAge';
import { openWhatsAppChat, generateCustomerInvoiceWhatsAppMessage, generateCustomerDebtSummaryWhatsAppMessage } from '../../utils/whatsapp';

/**
 * Customer profile summary definition required for billing history scoping.
 */
export interface CustomerHistoryProfile {
  id: number;
  name: string;
  phone: string;
  type?: 'RETAIL' | 'WHOLESALE';
  outstandingBalance?: number;
  creditLimit?: number;
  address?: string | null;
  city?: string | null;
  nic?: string | null;
  notes?: string | null;
}

/**
 * Single payment audit ledger entry structure
 */
export interface PaymentHistoryItem {
  id: number;
  amount: number;
  method: string;
  reference?: string | null;
  chequeDate?: string | null;
  chequeStatus?: 'PENDING' | 'CLEARED' | 'BOUNCED' | null;
  createdAt: string;
}

/**
 * Historical invoice record structure returned from the orders API.
 */
export interface CustomerInvoiceItem {
  id: number;
  invoiceNumber?: string;
  source: string;
  totalAmount: number;
  paidAmount: number;
  paymentMethod: string;
  createdAt: string;
  dueDate?: string | null;
  status?: string;
  items?: any[];
  returns?: any[];
  notes?: string | null;
  payments?: PaymentHistoryItem[];
  cheques?: any[];
  splitPayments?: any[];
  userNotes?: string;
}

export interface CustomerBillHistoryModalProps {
  /** Flag controlling modal visibility */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Selected customer whose complete invoice history and profile will be displayed */
  customer: CustomerHistoryProfile | null;
  /** Optional callback to open the settlement modal for outstanding balances */
  onOpenSettlement?: (customer: CustomerHistoryProfile) => void;
  /** Optional callback to edit customer profile */
  onEditProfile?: (customer: CustomerHistoryProfile) => void;
  /** Optional callback fired when a payment adjustment is made */
  onPaymentSuccess?: () => void;
}

interface CustomerChequeItem {
  id?: number;
  paymentId?: number;
  invoiceId: number;
  invoiceNumber: string;
  amount: number;
  chequeNumber: string;
  bankName: string;
  chequeDate: string;
  status: 'PENDING' | 'CLEARED' | 'BOUNCED' | string;
  statusLabel: 'PENDING' | 'REALIZED' | 'BOUNCED';
  maturityAlert: 'OVERDUE' | 'DUE_THIS_WEEK' | 'UPCOMING';
  daysToMaturity: number;
  createdAt: string;
}

const formatPaymentMethod = (method?: string) => {
  switch (method?.toUpperCase()) {
    case 'BANK_TRANSFER':
    case 'BANK':
    case 'BANK_T':
      return 'Bank T';
    case 'CARD':
    case 'CREDIT_CARD':
    case 'DEBIT_CARD':
      return 'Card';
    case 'CHEQUE':
      return 'Cheque';
    case 'CASH':
      return 'Cash';
    case 'CREDIT':
      return 'Credit';
    default:
      return method || 'Cash';
  }
};

const getMethodBadge = (method?: string) => {
  const m = String(method || '').toUpperCase();
  if (m === 'CHEQUE') {
    return {
      icon: <FileText className="size-3 text-amber-500" />,
      className: 'border-amber-500/30 text-amber-600 bg-amber-500/10 dark:text-amber-400',
    };
  }
  if (m.includes('CARD')) {
    return {
      icon: <CreditCard className="size-3 text-purple-500" />,
      className: 'border-purple-500/30 text-purple-600 bg-purple-500/10 dark:text-purple-400',
    };
  }
  if (m.includes('BANK')) {
    return {
      icon: <Landmark className="size-3 text-blue-500" />,
      className: 'border-blue-500/30 text-blue-600 bg-blue-500/10 dark:text-blue-400',
    };
  }
  return {
    icon: <Banknote className="size-3 text-emerald-500" />,
    className: 'border-emerald-500/30 text-emerald-600 bg-emerald-500/10 dark:text-emerald-400',
  };
};

/**
 * Universal Customer Bill History & Profile Modal with Settlement Audit & Cheque Tracking.
 */
export const CustomerBillHistoryModal: React.FC<CustomerBillHistoryModalProps> = ({
  isOpen,
  onClose,
  customer,
  onOpenSettlement,
  onEditProfile,
  onPaymentSuccess,
}) => {
  const [invoices, setInvoices] = useState<CustomerInvoiceItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'DUE' | 'PAID' | 'RETURNS'>('ALL');
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  // Expanded Invoice IDs for inline payment history breakdown
  const [expandedInvoices, setExpandedInvoices] = useState<Set<number>>(new Set());

  // Edit Payment State
  const [editingPayment, setEditingPayment] = useState<PaymentHistoryItem | null>(null);
  const [editAmount, setEditAmount] = useState<string>('');
  const [editMethod, setEditMethod] = useState<string>('CASH');
  const [editReference, setEditReference] = useState<string>('');
  const [editDate, setEditDate] = useState<string>('');
  const [editChequeDate, setEditChequeDate] = useState<string>('');
  const [editChequeStatus, setEditChequeStatus] = useState<string>('PENDING');
  const [editNote, setEditNote] = useState<string>('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState<boolean>(false);

  // Void / Delete Payment State
  const [deletingPayment, setDeletingPayment] = useState<PaymentHistoryItem | null>(null);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState<boolean>(false);

  // Dedicated Collapsible Accordion State for Upcoming Cheques Footprint
  const [isChequesExpanded, setIsChequesExpanded] = useState<boolean>(false);

  // Bounce & Replace Cheque Dialog State
  const [replaceTargetCheque, setReplaceTargetCheque] = useState<CustomerChequeItem | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('Cheque returned / payment replacement requested');
  const [issueReplacement, setIssueReplacement] = useState<boolean>(false);
  const [replacementChequeNumber, setReplacementChequeNumber] = useState<string>('');
  const [replacementBankName, setReplacementBankName] = useState<string>('');
  const [replacementDate, setReplacementDate] = useState<string>('');
  const [replacementAmount, setReplacementAmount] = useState<string>('');
  const [isSubmittingCancelReplace, setIsSubmittingCancelReplace] = useState<boolean>(false);

  const toggleInvoiceExpand = (invId: number) => {
    setExpandedInvoices((prev) => {
      const next = new Set(prev);
      if (next.has(invId)) next.delete(invId);
      else next.add(invId);
      return next;
    });
  };

  /**
   * Fetches complete customer invoice history filtered by customer ID.
   */
  const fetchCustomerInvoices = async () => {
    if (!customer?.id) return;
    setLoading(true);
    try {
      // Query complete invoices for this customer with a high ceiling limit
      const res = await get<any>(`/orders/invoices?customerId=${customer.id}&limit=100&sortBy=newest`);
      const list = res?.data || (Array.isArray(res) ? res : []);
      setInvoices(Array.isArray(list) ? list : []);
    } catch (err: any) {
      console.error('Failed to load customer invoice history:', err);
      toast.error(err.message || 'Failed to load customer invoice records');
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && customer?.id) {
      setSearchQuery('');
      setActiveFilter('ALL');
      setExpandedInvoices(new Set());
      fetchCustomerInvoices();
    } else {
      setInvoices([]);
    }
  }, [isOpen, customer?.id]);

  /**
   * Stream generated Invoice PDF directly to browser download.
   */
  const handleDownloadInvoicePdf = async (invoiceId: number) => {
    setDownloadingId(invoiceId);
    try {
      toast.info(`Preparing Invoice #INV${invoiceId} PDF...`);
      const apiHost = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const token =
        localStorage.getItem('token') ||
        localStorage.getItem('auth_token') ||
        sessionStorage.getItem('token');

      const response = await fetch(`${apiHost}/orders/invoices/${invoiceId}/pdf`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to download invoice PDF (Status: ${response.status})`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice-INV${invoiceId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Invoice #INV${invoiceId} PDF downloaded!`);
    } catch (err: any) {
      toast.error(err.message || 'Invoice download failed');
    } finally {
      setDownloadingId(null);
    }
  };

  /**
   * Download the complete statement PDF for this customer.
   */
  const handleDownloadStatementPdf = async () => {
    if (!customer) return;
    try {
      toast.info(`Generating Statement PDF for ${customer.name}...`);
      const apiHost = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const token =
        localStorage.getItem('token') ||
        localStorage.getItem('auth_token') ||
        sessionStorage.getItem('token');

      const response = await fetch(`${apiHost}/credit/customers/${customer.id}/statement-pdf`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) throw new Error('Failed to download Statement PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Statement-${customer.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Statement PDF downloaded successfully!`);
    } catch (err: any) {
      toast.error(err.message || 'Statement PDF download failed');
    }
  };

  /**
   * Dispatch WhatsApp statement summary for this customer including itemized invoices and pending cheques.
   */
  const handleWhatsAppStatement = () => {
    if (!customer) return;
    if (!customer.phone) {
      toast.error('Customer has no registered phone number for WhatsApp');
      return;
    }
    const dueInvoices = invoices.filter((i) => Math.max(0, i.totalAmount - i.paidAmount) > 0);
    const pendingUnclearedCheques = customerCheques.filter((c) => c.statusLabel === 'PENDING' || c.status === 'PENDING');
    const waCustomer = {
      name: customer.name,
      outstandingBalance: Number(customer.outstandingBalance !== undefined ? customer.outstandingBalance : totalDue),
      phone: customer.phone,
    };
    const waMsg = generateCustomerDebtSummaryWhatsAppMessage(waCustomer, dueInvoices, pendingUnclearedCheques);
    openWhatsAppChat(customer.phone, waMsg);
  };

  /**
   * Dispatch single invoice slip via WhatsApp.
   */
  const handleWhatsAppInvoice = (inv: CustomerInvoiceItem) => {
    const phone = customer?.phone;
    if (!phone) {
      toast.error('Customer phone number not available');
      return;
    }
    const invData = {
      ...inv,
      customerName: customer.name,
      customerPhone: customer.phone,
    };
    const msg = generateCustomerInvoiceWhatsAppMessage(invData);
    openWhatsAppChat(phone, msg);
  };

  // Open Edit Payment Dialog
  const handleInitiateEditPayment = (ph: PaymentHistoryItem) => {
    setEditingPayment(ph);
    setEditAmount(String(ph.amount));
    setEditMethod(ph.method || 'CASH');
    const cleanRef = ph.reference?.replace(/\s*\[Edit:.*?\]$/, '') || '';
    setEditReference(cleanRef);
    if (ph.createdAt) {
      try {
        const d = new Date(ph.createdAt);
        const yr = d.getFullYear();
        const mo = String(d.getMonth() + 1).padStart(2, '0');
        const dy = String(d.getDate()).padStart(2, '0');
        const hr = String(d.getHours()).padStart(2, '0');
        const mn = String(d.getMinutes()).padStart(2, '0');
        setEditDate(`${yr}-${mo}-${dy}T${hr}:${mn}`);
      } catch {
        setEditDate('');
      }
    } else {
      setEditDate('');
    }
    setEditChequeDate(ph.chequeDate ? ph.chequeDate.split('T')[0] : '');
    setEditChequeStatus(ph.chequeStatus || 'PENDING');
    setEditNote('');
  };

  // Save Edit Payment Submit
  const handleSaveEditPayment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingPayment) return;
    const num = parseFloat(editAmount);
    if (isNaN(num) || num <= 0) {
      toast.error('Please enter a valid positive payment amount');
      return;
    }

    setIsSubmittingEdit(true);
    try {
      const resolvedDateTime = editDate ? new Date(editDate) : new Date();

      await put(`/payments/${editingPayment.id}`, {
        amount: num,
        method: editMethod,
        reference: editReference.trim() || undefined,
        paymentDate: resolvedDateTime.toISOString(),
        chequeDate: editMethod === 'CHEQUE' && editChequeDate ? new Date(editChequeDate).toISOString() : undefined,
        chequeStatus: editMethod === 'CHEQUE' ? editChequeStatus : undefined,
        notes: editNote.trim() || undefined,
        type: 'customer',
      });

      toast.success('Payment updated and invoice balances adjusted successfully!');
      setEditingPayment(null);
      await fetchCustomerInvoices();
      if (onPaymentSuccess) {
        onPaymentSuccess();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update payment');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Confirm Void / Delete Payment
  const handleConfirmDeletePayment = async () => {
    if (!deletingPayment) return;
    setIsSubmittingDelete(true);
    try {
      await del(`/payments/${deletingPayment.id}?type=customer`);
      toast.success(`Payment of Rs. ${Number(deletingPayment.amount).toFixed(2)} voided and balance reversed.`);
      setDeletingPayment(null);
      await fetchCustomerInvoices();
      if (onPaymentSuccess) {
        onPaymentSuccess();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to void payment');
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  // Direct toggle for cheque realization status
  const handleUpdateChequeStatus = async (paymentId: number, newStatus: 'CLEARED' | 'BOUNCED' | 'PENDING') => {
    try {
      await put(`/payments/${paymentId}`, {
        chequeStatus: newStatus,
        type: 'customer',
        notes: `Cheque status marked as ${newStatus}`,
      });
      toast.success(`Cheque status marked as ${newStatus === 'CLEARED' ? 'REALIZED' : newStatus}`);
      await fetchCustomerInvoices();
      if (onPaymentSuccess) {
        onPaymentSuccess();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update cheque status');
    }
  };

  // Open Cancel / Bounce & Replace Cheque Dialog
  const handleOpenCancelReplace = (chq: CustomerChequeItem) => {
    setReplaceTargetCheque(chq);
    setCancelReason('Cheque returned / payment replacement requested');
    setReplacementAmount(String(chq.amount));
    setReplacementBankName(chq.bankName !== '-' ? chq.bankName : '');
    setReplacementChequeNumber('');
    const nextWeek = new Date(Date.now() + 7 * 86400000);
    const yr = nextWeek.getFullYear();
    const mo = String(nextWeek.getMonth() + 1).padStart(2, '0');
    const dy = String(nextWeek.getDate()).padStart(2, '0');
    setReplacementDate(`${yr}-${mo}-${dy}`);
    setIssueReplacement(false);
  };

  // Execute Cancel / Bounce & Replace Submission
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

    setIsSubmittingCancelReplace(true);
    try {
      const paymentId = replaceTargetCheque.paymentId || 0;
      const payload = {
        orderId: replaceTargetCheque.invoiceId,
        action: issueReplacement ? 'REPLACE' : 'CANCEL',
        reason: cancelReason.trim(),
        replacement: issueReplacement
          ? {
              chequeNumber: replacementChequeNumber.trim(),
              bankName: replacementBankName.trim() || undefined,
              chequeDate: replacementDate,
              amount: Number(replacementAmount),
            }
          : undefined,
      };

      await post(`/payments/${paymentId}/cancel-replace`, payload);

      toast.success(
        issueReplacement
          ? `Cheque cancelled and replacement #${replacementChequeNumber} issued!`
          : `Cheque marked bounced/cancelled. Invoice balance updated.`
      );

      setReplaceTargetCheque(null);
      await fetchCustomerInvoices();
      if (onPaymentSuccess) {
        onPaymentSuccess();
      }
    } catch (err: any) {
      if (!issueReplacement && replaceTargetCheque.paymentId) {
        try {
          await handleUpdateChequeStatus(replaceTargetCheque.paymentId, 'BOUNCED');
          setReplaceTargetCheque(null);
          return;
        } catch {}
      }
      toast.error(err.message || 'Failed to process cheque cancellation/replacement');
    } finally {
      setIsSubmittingCancelReplace(false);
    }
  };

  // Aggregated financial metrics
  const totalBilled = useMemo(
    () => invoices.reduce((acc, curr) => acc + (Number(curr.totalAmount) || 0), 0),
    [invoices]
  );
  const totalPaid = useMemo(
    () => invoices.reduce((acc, curr) => acc + (Number(curr.paidAmount) || 0), 0),
    [invoices]
  );
  const totalDue = useMemo(
    () =>
      invoices.reduce(
        (acc, curr) =>
          acc + Math.max(0, (Number(curr.totalAmount) || 0) - (Number(curr.paidAmount) || 0)),
        0
      ),
    [invoices]
  );

  // Extract all customer post-dated / pending cheques across all invoices
  const customerCheques = useMemo<CustomerChequeItem[]>(() => {
    const list: CustomerChequeItem[] = [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    invoices.forEach((inv) => {
      // 1. From relational payments array
      if (Array.isArray(inv.payments)) {
        inv.payments.forEach((p) => {
          if (String(p.method).toUpperCase() === 'CHEQUE') {
            let chqNo = '-';
            let bName = '-';
            if (p.reference) {
              const mNum = /Cheque\s*#?([^\s(]+)/i.exec(p.reference);
              if (mNum) chqNo = mNum[1];
              else chqNo = p.reference.replace(/\s*\[Edit:.*?\]$/, '').slice(0, 25);
              const mBank = /\(([^)]+)\)/.exec(p.reference);
              if (mBank) bName = mBank[1];
            }
            const cDateStr = p.chequeDate ? String(p.chequeDate).split('T')[0] : String(p.createdAt || inv.createdAt).split('T')[0];
            const cDate = new Date(cDateStr);
            const diffDays = Math.ceil((cDate.getTime() - today) / (1000 * 60 * 60 * 24));
            const status = p.chequeStatus || 'PENDING';
            const isRealized = status === 'CLEARED';
            const isBounced = status === 'BOUNCED';

            let alert: 'OVERDUE' | 'DUE_THIS_WEEK' | 'UPCOMING' = 'UPCOMING';
            if (diffDays < 0) alert = 'OVERDUE';
            else if (diffDays <= 7) alert = 'DUE_THIS_WEEK';

            list.push({
              paymentId: p.id,
              invoiceId: inv.id,
              invoiceNumber: inv.invoiceNumber || `INV${inv.id}`,
              amount: Number(p.amount) || 0,
              chequeNumber: chqNo,
              bankName: bName,
              chequeDate: cDateStr,
              status,
              statusLabel: isRealized ? 'REALIZED' : isBounced ? 'BOUNCED' : 'PENDING',
              maturityAlert: alert,
              daysToMaturity: diffDays,
              createdAt: p.createdAt || inv.createdAt,
            });
          }
        });
      }

      // 2. From parsed cheques metadata in notes if present
      if (Array.isArray(inv.cheques)) {
        inv.cheques.forEach((c: any) => {
          const cNo = c.chequeNumber || '-';
          const alreadyExists = list.some((x) => x.invoiceId === inv.id && x.chequeNumber === cNo);
          if (!alreadyExists && cNo !== '-') {
            const cDateStr = c.chequeDate ? String(c.chequeDate).split('T')[0] : String(inv.createdAt).split('T')[0];
            const cDate = new Date(cDateStr);
            const diffDays = Math.ceil((cDate.getTime() - today) / (1000 * 60 * 60 * 24));
            let alert: 'OVERDUE' | 'DUE_THIS_WEEK' | 'UPCOMING' = 'UPCOMING';
            if (diffDays < 0) alert = 'OVERDUE';
            else if (diffDays <= 7) alert = 'DUE_THIS_WEEK';

            list.push({
              invoiceId: inv.id,
              invoiceNumber: inv.invoiceNumber || `INV${inv.id}`,
              amount: Number(c.amount) || 0,
              chequeNumber: cNo,
              bankName: c.bankName || '-',
              chequeDate: cDateStr,
              status: c.status || 'PENDING',
              statusLabel: (c.status === 'CLEARED' || c.status === 'REALIZED') ? 'REALIZED' : (c.status === 'BOUNCED' ? 'BOUNCED' : 'PENDING'),
              maturityAlert: alert,
              daysToMaturity: diffDays,
              createdAt: inv.createdAt,
            });
          }
        });
      }
    });

    return list;
  }, [invoices]);

  // Filtered invoices matrix
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const creditDue = Math.max(0, (Number(inv.totalAmount) || 0) - (Number(inv.paidAmount) || 0));
      const hasReturns = Array.isArray(inv.returns) && inv.returns.length > 0;

      // Tab Category Filtering
      if (activeFilter === 'DUE' && creditDue <= 0) return false;
      if (activeFilter === 'PAID' && creditDue > 0) return false;
      if (activeFilter === 'RETURNS' && !hasReturns) return false;

      // Text Search Filtering
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const invIdStr = String(inv.id);
        const invNoStr = (inv.invoiceNumber || '').toLowerCase();
        const methodStr = (inv.paymentMethod || '').toLowerCase();
        const dateStr = (inv.createdAt || '').split('T')[0];
        const match =
          invIdStr.includes(q) ||
          invNoStr.includes(q) ||
          methodStr.includes(q) ||
          dateStr.includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [invoices, activeFilter, searchQuery]);

  // Effective outstanding balance strictly dynamically reconciled against open invoice debts
  const effectiveOutstanding = useMemo(() => {
    if (invoices.length > 0) {
      return totalDue;
    }
    return Math.max(0, Number(customer?.outstandingBalance || 0));
  }, [customer?.outstandingBalance, totalDue, invoices.length]);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          className="w-full max-w-lg sm:max-w-3xl lg:max-w-4xl max-h-[94vh] flex flex-col p-0 overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xl"
        >
          {/* Compressed Top Profile Header & Micro KPI Strip (Maximized Mobile Viewport) */}
          <div className="p-2.5 sm:p-4 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/70 shrink-0 space-y-2">
            <DialogHeader className="space-y-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                {/* Customer Name, Type Badge & ID */}
                <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                  <Badge
                    variant="outline"
                    className={`text-[9px] px-1.5 py-0 font-bold ${
                      customer?.type === 'WHOLESALE'
                        ? 'border-blue-500/30 text-blue-600 bg-blue-500/10'
                        : 'border-emerald-500/30 text-emerald-600 bg-emerald-500/10'
                    }`}
                  >
                    {customer?.type || 'RETAIL'}
                  </Badge>
                  <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                    {customer?.name || 'Customer'}
                  </DialogTitle>
                  <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono">
                    #{customer?.id}
                  </span>
                  <DialogDescription className="sr-only">
                    Customer profile details, contact information, credit limits, and full invoice billing history.
                  </DialogDescription>
                </div>

                {/* Compact Single-Line Horizontal Action Strip */}
                <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar shrink-0">
                  {customer?.phone && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleWhatsAppStatement}
                      className="h-7 text-xs px-2.5 py-1 gap-1 text-emerald-600 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer"
                      title="Send Statement via WhatsApp"
                    >
                      <MessageSquare className="size-3" />
                      <span>WhatsApp</span>
                    </Button>
                  )}
                  {customer?.phone && (
                    <a
                      href={`tel:${customer.phone}`}
                      className="h-7 px-2.5 py-1 text-xs rounded-md border border-slate-200 dark:border-zinc-700 inline-flex items-center gap-1 font-medium hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 transition-colors"
                      title={`Call ${customer.phone}`}
                    >
                      <Phone className="size-3 text-slate-500" />
                      <span>Call</span>
                    </a>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDownloadStatementPdf}
                    className="h-7 text-xs px-2.5 py-1 gap-1 text-slate-700 dark:text-zinc-300 hover:text-emerald-600 cursor-pointer"
                    title="Download Customer Statement PDF"
                  >
                    <Download className="size-3" />
                    <span className="hidden sm:inline">Statement</span> PDF
                  </Button>
                  {onEditProfile && customer && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onEditProfile(customer)}
                      className="h-7 text-xs px-2.5 py-1 gap-1 text-slate-700 dark:text-zinc-300 hover:text-blue-600 hover:border-blue-500/30 cursor-pointer"
                      title="Edit Customer Profile"
                    >
                      <Edit2 className="size-3" />
                      <span>Edit Profile</span>
                    </Button>
                  )}
                </div>
              </div>
            </DialogHeader>

            {/* Streamlined Single-Line Metadata Row (Phone, Address, NIC) */}
            <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500 dark:text-zinc-400">
              <div className="flex items-center gap-1 shrink-0 font-medium">
                <Phone className="size-3 text-slate-400" />
                <span className="font-mono text-slate-800 dark:text-zinc-200 font-bold">{customer?.phone || 'No phone'}</span>
              </div>
              {(customer?.address || customer?.city) && (
                <div className="flex items-center gap-1 truncate max-w-[200px] sm:max-w-none">
                  <MapPin className="size-3 text-slate-400 shrink-0" />
                  <span className="truncate">{customer.address || ''}{customer.city ? `, ${customer.city}` : ''}</span>
                </div>
              )}
              {customer?.nic && (
                <div className="flex items-center gap-1 shrink-0">
                  <CreditCard className="size-3 text-slate-400" />
                  <span className="font-mono">{customer.nic}</span>
                </div>
              )}
            </div>

            {/* Micro KPI Metric Cards (Slim 4-Column Strip / Compact 2x2 Grid) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs pt-0.5">
              <div className="p-1.5 sm:p-2 rounded-lg bg-white dark:bg-zinc-800/80 border border-slate-200/70 dark:border-zinc-700/60 shadow-2xs">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block leading-tight">Credit Limit</span>
                <span className="font-bold text-slate-900 dark:text-white font-mono text-xs sm:text-sm">
                  Rs. {Number(customer?.creditLimit || 0).toLocaleString()}
                </span>
              </div>
              <div className="p-1.5 sm:p-2 rounded-lg bg-white dark:bg-zinc-800/80 border border-slate-200/70 dark:border-zinc-700/60 shadow-2xs">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block leading-tight">Invoices</span>
                <span className="font-bold text-slate-900 dark:text-white font-mono text-xs sm:text-sm">
                  {invoices.length}
                </span>
              </div>
              <div className="p-1.5 sm:p-2 rounded-lg bg-white dark:bg-zinc-800/80 border border-slate-200/70 dark:border-zinc-700/60 shadow-2xs">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block leading-tight">Total Billed</span>
                <span className="font-bold text-slate-900 dark:text-white font-mono text-xs sm:text-sm">
                  Rs. {totalBilled.toLocaleString()}
                </span>
              </div>
              <div
                className={`p-1.5 sm:p-2 rounded-lg border shadow-2xs ${
                  effectiveOutstanding > 0
                    ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60'
                    : 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/60'
                }`}
              >
                <span className="text-[10px] text-slate-500 dark:text-zinc-400 uppercase font-semibold block leading-tight">
                  Outstanding Due
                </span>
                <span
                  className={`font-black font-mono text-xs sm:text-sm ${
                    effectiveOutstanding > 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  Rs. {effectiveOutstanding.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Filter Controls Tray */}
          <div className="p-3 sm:px-5 border-b border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
            {/* Quick Filter Pills */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
              {(
                [
                  { key: 'ALL', label: `All (${invoices.length})` },
                  {
                    key: 'DUE',
                    label: `Due (${invoices.filter((i) => Math.max(0, i.totalAmount - i.paidAmount) > 0).length})`,
                  },
                  {
                    key: 'PAID',
                    label: `Paid (${invoices.filter((i) => Math.max(0, i.totalAmount - i.paidAmount) <= 0).length})`,
                  },
                  {
                    key: 'RETURNS',
                    label: `Returns (${invoices.filter((i) => i.returns && i.returns.length > 0).length})`,
                  },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveFilter(tab.key)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    activeFilter === tab.key
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-zinc-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white bg-slate-100 dark:bg-zinc-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Modal Search Input */}
            <div className="relative w-full sm:w-48">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search #INV or date..."
                className="pl-8 pr-7 h-8 text-xs rounded-lg"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Scrollable Invoices List Container with Dynamic Viewport Bounds */}
          <div className="flex-1 min-h-0 sm:min-h-[200px] overflow-y-auto overscroll-contain p-2.5 sm:p-4 pr-1 sm:pr-3 space-y-2">
            {loading ? (
              <div className="py-16 text-center">
                <Loader2 className="size-7 animate-spin mx-auto text-emerald-500 mb-2" />
                <p className="text-xs text-slate-400">Loading complete invoice history...</p>
              </div>
            ) : filteredInvoices.length === 0 ? (
              <div className="py-14 px-4 text-center border border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl bg-slate-50/50 dark:bg-zinc-900/40">
                <FileText className="size-10 text-slate-300 dark:text-zinc-600 mx-auto mb-2.5" />
                <h4 className="text-sm font-bold text-slate-700 dark:text-zinc-300">
                  {invoices.length === 0
                    ? 'No Invoice Records Found'
                    : 'No Invoices Matching Filter'}
                </h4>
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1 max-w-sm mx-auto">
                  {invoices.length === 0
                    ? `Customer "${customer?.name}" does not have any recorded invoices yet. Invoices created via POS will automatically appear here.`
                    : 'Try adjusting your search query or filter selection to view customer records.'}
                </p>
              </div>
            ) : (
              filteredInvoices.map((inv) => {
                const creditDue = Math.max(0, Number(inv.totalAmount || 0) - Number(inv.paidAmount || 0));
                const hasReturns = Array.isArray(inv.returns) && inv.returns.length > 0;
                const ageInfo = getInvoiceAgeInfo(inv.createdAt);

                // Extract Cheque Data tied to this invoice
                const invCheques: Array<{
                  chequeNumber: string;
                  bankName: string;
                  chequeDate: string;
                  statusLabel: string;
                }> = [];

                if (Array.isArray(inv.payments)) {
                  inv.payments.forEach((p) => {
                    if (String(p.method).toUpperCase() === 'CHEQUE') {
                      let chqNo = '-';
                      let bName = '-';
                      if (p.reference) {
                        const mNum = /Cheque\s*#?([^\s(]+)/i.exec(p.reference);
                        if (mNum) chqNo = mNum[1];
                        else chqNo = p.reference.replace(/\s*\[Edit:.*?\]$/, '').slice(0, 25);
                        const mBank = /\(([^)]+)\)/.exec(p.reference);
                        if (mBank) bName = mBank[1];
                      }
                      const chqDateStr = p.chequeDate ? String(p.chequeDate).split('T')[0] : String(p.createdAt).split('T')[0];
                      const st = p.chequeStatus || 'PENDING';
                      invCheques.push({
                        chequeNumber: chqNo,
                        bankName: bName,
                        chequeDate: chqDateStr,
                        statusLabel: st === 'CLEARED' ? 'REALIZED' : st,
                      });
                    }
                  });
                }

                if (invCheques.length === 0 && Array.isArray(inv.cheques)) {
                  inv.cheques.forEach((c: any) => {
                    invCheques.push({
                      chequeNumber: c.chequeNumber || '-',
                      bankName: c.bankName || '-',
                      chequeDate: c.chequeDate ? String(c.chequeDate).split('T')[0] : String(inv.createdAt).split('T')[0],
                      statusLabel: (c.status === 'CLEARED' || c.status === 'REALIZED') ? 'REALIZED' : (c.status || 'PENDING'),
                    });
                  });
                }

                if (invCheques.length === 0 && String(inv.paymentMethod).toUpperCase() === 'CHEQUE') {
                  invCheques.push({
                    chequeNumber: 'Registered',
                    bankName: '-',
                    chequeDate: String(inv.createdAt).split('T')[0],
                    statusLabel: 'PENDING',
                  });
                }

                return (
                  <div
                    key={inv.id}
                    className="p-2.5 sm:p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 hover:border-slate-300 dark:hover:border-zinc-700 transition-all shadow-2xs space-y-2"
                  >
                    {/* Top Row: Invoice #, Type, Date, Status */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white">
                          #INV{inv.id}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            inv.source === 'POS_WHOLESALE'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                              : 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300'
                          }`}
                        >
                          {inv.source === 'POS_WHOLESALE' ? 'Wholesale' : 'Retail'}
                        </span>
                        {hasReturns && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 flex items-center gap-0.5">
                            <RotateCcw className="size-2.5" />
                            Returns ({inv.returns?.length})
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400 font-mono">
                          {inv.createdAt?.split('T')[0] || '-'}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold uppercase ${
                            inv.paymentMethod === 'CHEQUE' || invCheques.length > 0
                              ? 'border-amber-500 text-amber-600 bg-amber-500/10'
                              : inv.paymentMethod === 'CREDIT' || creditDue > 0
                              ? 'border-rose-500 text-rose-600 bg-rose-500/10'
                              : 'border-emerald-500 text-emerald-600 bg-emerald-500/10'
                          }`}
                        >
                          {inv.paymentMethod}
                        </Badge>
                      </div>
                    </div>

                    {/* Task 2: Prominent Cheque Identification Badge Strip on Invoice Card */}
                    {invCheques.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {invCheques.map((cq, idx) => (
                          <div
                            key={idx}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200 shadow-2xs"
                          >
                            <FileText className="size-3 text-amber-600 dark:text-amber-400" />
                            <span className="font-mono font-bold">Chq #{cq.chequeNumber}</span>
                            {cq.bankName !== '-' && <span className="opacity-80">({cq.bankName})</span>}
                            <span className="text-[10px] opacity-75 font-mono">Due: {cq.chequeDate}</span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                                cq.statusLabel === 'REALIZED'
                                  ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                                  : cq.statusLabel === 'BOUNCED'
                                  ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                                  : 'bg-amber-500/25 text-amber-800 dark:text-amber-200 border border-amber-500/30'
                              }`}
                            >
                              {cq.statusLabel}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Middle Row: Financials + Inline Age Pill */}
                    <div className="grid grid-cols-3 gap-2 py-2 px-2.5 rounded-lg bg-slate-50 dark:bg-zinc-950/60 border border-slate-100 dark:border-zinc-800/60 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase block">Bill Total</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white block">
                          Rs. {Number(inv.totalAmount).toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase block">Paid Amount</span>
                        <span className="font-mono font-semibold text-emerald-600 block">
                          Rs. {Number(inv.paidAmount).toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase block">Balance Due</span>
                        {creditDue > 0 ? (
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                            <span className="font-mono font-bold text-rose-600 dark:text-rose-400 block">
                              - Rs. {creditDue.toLocaleString()}
                            </span>
                            {/* Compact Inline Due Age Pill */}
                            <span
                              className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold tracking-tight w-fit ${ageInfo.badgeClassName}`}
                              title={`Issued ${ageInfo.days} days ago`}
                            >
                              {ageInfo.label}
                            </span>
                          </div>
                        ) : (
                          <span className="font-mono text-slate-400 block">Settled (Rs. 0.00)</span>
                        )}
                      </div>
                    </div>

                    {/* Task 1: Inline / Expandable Payment Settlement Audit History */}
                    {inv.payments && inv.payments.length > 0 && (
                      <div className="pt-1 border-t border-slate-100 dark:border-zinc-800/60">
                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => toggleInvoiceExpand(inv.id)}
                            className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            {expandedInvoices.has(inv.id) ? (
                              <ChevronUp className="size-3.5 text-slate-400" />
                            ) : (
                              <ChevronDown className="size-3.5 text-slate-400" />
                            )}
                            <span>Settlement Audit History</span>
                            <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-slate-100 dark:bg-zinc-800 font-mono font-bold">
                              {inv.payments.length}
                            </span>
                          </button>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Total Settled: Rs. {Number(inv.paidAmount).toLocaleString()}
                          </span>
                        </div>

                        {expandedInvoices.has(inv.id) && (
                          <div className="mt-2 space-y-1.5 bg-slate-50/80 dark:bg-zinc-950/70 p-2 sm:p-2.5 rounded-lg border border-slate-200/60 dark:border-zinc-800/80">
                            {inv.payments.map((p) => {
                              const mBadge = getMethodBadge(p.method);
                              const isChq = String(p.method).toUpperCase() === 'CHEQUE';
                              const chqStatus = p.chequeStatus || 'PENDING';
                              return (
                                <div
                                  key={p.id}
                                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded-md bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 text-xs shadow-2xs"
                                >
                                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1 ${mBadge.className}`}>
                                        {mBadge.icon}
                                        <span>{formatPaymentMethod(p.method)}</span>
                                      </span>
                                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                                        Rs. {Number(p.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                      </span>
                                    </div>
                                    <span className="text-[11px] text-slate-400 font-mono">
                                      {new Date(p.createdAt).toLocaleDateString()} {new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    {p.reference && (
                                      <span className="text-[11px] text-slate-600 dark:text-zinc-300 truncate max-w-[220px]" title={p.reference}>
                                        {p.reference}
                                      </span>
                                    )}
                                    {isChq && (
                                      <span
                                        className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                                          chqStatus === 'CLEARED'
                                            ? 'bg-emerald-500/20 text-emerald-600 border border-emerald-500/30'
                                            : chqStatus === 'BOUNCED'
                                            ? 'bg-rose-500/20 text-rose-600 border border-rose-500/30'
                                            : 'bg-amber-500/20 text-amber-600 border border-amber-500/30'
                                        }`}
                                      >
                                        {chqStatus === 'CLEARED' ? 'REALIZED' : chqStatus}
                                      </span>
                                    )}
                                  </div>

                                  {/* Action triggers: Edit Payment & Delete Payment */}
                                  <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                                    <button
                                      type="button"
                                      onClick={() => handleInitiateEditPayment(p)}
                                      className="h-6 px-1.5 rounded hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center gap-1 font-semibold text-[11px] cursor-pointer transition-colors"
                                      title="Edit / Adjust Payment Record"
                                    >
                                      <Pencil className="size-3" />
                                      <span>Edit</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDeletingPayment(p)}
                                      className="h-6 px-1.5 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center gap-1 font-semibold text-[11px] cursor-pointer transition-colors"
                                      title="Void / Reverse Payment Record"
                                    >
                                      <Trash2 className="size-3" />
                                      <span>Void</span>
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Bottom Row: Actions */}
                    <div className="flex items-center justify-between pt-1 gap-2 text-xs">
                      <span className="text-[11px] text-slate-400 truncate max-w-[150px]">
                        {inv.items && inv.items.length > 0
                          ? `${inv.items.length} line item(s)`
                          : 'POS Checkout Order'}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* WhatsApp Receipt Trigger */}
                        {customer?.phone && (
                          <button
                            type="button"
                            onClick={() => handleWhatsAppInvoice(inv)}
                            className="h-7 px-2 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-emerald-500/20 flex items-center gap-1 font-semibold text-[11px] cursor-pointer"
                            title="WhatsApp Invoice Receipt"
                          >
                            <MessageSquare className="size-3" />
                            <span>WhatsApp</span>
                          </button>
                        )}

                        {/* PDF Download Trigger */}
                        <button
                          type="button"
                          onClick={() => handleDownloadInvoicePdf(inv.id)}
                          disabled={downloadingId === inv.id}
                          className="h-7 px-2 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-blue-500/20 flex items-center gap-1 font-semibold text-[11px] cursor-pointer"
                          title="Download Invoice PDF"
                        >
                          {downloadingId === inv.id ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Download className="size-3" />
                          )}
                          <span>PDF</span>
                        </button>

                        {/* Quick Settle Trigger if due */}
                        {creditDue > 0 && onOpenSettlement && customer && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onOpenSettlement(customer);
                            }}
                            className="h-7 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 font-semibold text-[11px] cursor-pointer shadow-xs"
                            title="Settle this invoice balance"
                          >
                            <Receipt className="size-3" />
                            <span>Settle Due</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Collapsible Upcoming & Realizable Cheques Sticky Footer Tray */}
          {customerCheques.length > 0 && (
            <div className="shrink-0 z-30 relative border-t border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/20 transition-all">
              {/* Accordion Header Strip Trigger */}
              <button
                type="button"
                onClick={() => setIsChequesExpanded((prev) => !prev)}
                className="w-full px-3.5 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-2.5 cursor-pointer pointer-events-auto select-none bg-transparent hover:bg-amber-500/10 dark:hover:bg-amber-950/40 transition-colors text-left"
                title="Click to expand/collapse upcoming customer cheques"
                aria-expanded={isChequesExpanded}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
                    <FileText className="size-3.5" />
                  </div>
                  <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                    Upcoming / Realizable Cheques
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-bold border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 shrink-0"
                  >
                    {customerCheques.filter((c) => c.statusLabel === 'PENDING').length} Pending
                  </Badge>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 shrink-0 text-xs">
                  <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono">
                    <span className="text-slate-400">Pending:</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400">
                      Rs. {customerCheques.filter((c) => c.statusLabel === 'PENDING').reduce((s, c) => s + c.amount, 0).toLocaleString()}
                    </span>
                    <span className="text-slate-300 dark:text-zinc-700">•</span>
                    <span className="text-slate-400">Realized:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      Rs. {customerCheques.filter((c) => c.statusLabel === 'REALIZED').reduce((s, c) => s + c.amount, 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 shrink-0">
                    {isChequesExpanded ? (
                      <ChevronDown className="size-4 transition-transform duration-200" />
                    ) : (
                      <ChevronUp className="size-4 transition-transform duration-200" />
                    )}
                  </div>
                </div>
              </button>

              {/* Collapsible Cheques Scrollable Tray */}
              {isChequesExpanded && (
                <div
                  data-vaul-no-drag=""
                  className="w-full max-h-[38vh] overflow-y-auto overscroll-contain p-2 space-y-2.5 border-t border-amber-500/20 bg-zinc-950/95"
                  style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
                >
                  {customerCheques.map((chq, i) => {
                    const isPending = chq.statusLabel === 'PENDING';
                    const isRealized = chq.statusLabel === 'REALIZED';
                    const isBounced = chq.statusLabel === 'BOUNCED';

                    return (
                      <div
                        key={chq.paymentId || `${chq.chequeNumber}-${i}`}
                        className="p-2.5 rounded-xl bg-zinc-900 border border-amber-500/20 text-xs shadow-2xs hover:border-amber-500/40 transition-colors space-y-2"
                      >
                        {/* Top row: Cheque #, Bank Name, Invoice reference & Status Badges */}
                        <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                            <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              #{chq.chequeNumber}
                            </span>
                            <span className="font-semibold text-zinc-100 truncate max-w-[150px] sm:max-w-none">
                              {chq.bankName !== '-' ? chq.bankName : 'Bank Cheque'}
                            </span>
                            {chq.invoiceNumber && (
                              <span className="text-[10px] text-zinc-400 font-mono">
                                for {chq.invoiceNumber}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                            {/* Due / Maturity Alert Badge */}
                            {isPending && (
                              <span
                                className={`font-semibold text-[10px] px-1.5 py-0.5 rounded border ${
                                  chq.maturityAlert === 'OVERDUE'
                                    ? 'bg-rose-950/70 text-rose-300 border-rose-800'
                                    : chq.maturityAlert === 'DUE_THIS_WEEK'
                                    ? 'bg-amber-950/70 text-amber-300 border-amber-800'
                                    : 'bg-blue-950/70 text-blue-300 border-blue-800'
                                }`}
                              >
                                {chq.maturityAlert === 'OVERDUE'
                                  ? 'Overdue'
                                  : chq.maturityAlert === 'DUE_THIS_WEEK'
                                  ? 'Due This Week'
                                  : 'Upcoming'}
                              </span>
                            )}
                            {/* Clearing Status Badge */}
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${
                                isRealized
                                  ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                                  : isBounced
                                  ? 'border-rose-500/30 text-rose-400 bg-rose-500/10'
                                  : 'border-amber-500/30 text-amber-400 bg-amber-500/10'
                              }`}
                            >
                              {chq.statusLabel}
                            </span>
                          </div>
                        </div>

                        {/* Bottom row: Maturity Date, Currency Amount & Realization Actions */}
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-800/80 flex-wrap sm:flex-nowrap">
                          <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-mono">
                            <Calendar className="size-3 text-zinc-500 shrink-0" />
                            <span>Maturity: <strong className="text-zinc-200">{chq.chequeDate}</strong></span>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap shrink-0">
                            <span className="font-mono font-bold text-white text-sm">
                              Rs. {chq.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>

                            {chq.paymentId && isPending && (
                              <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateChequeStatus(chq.paymentId!, 'CLEARED')}
                                  className="h-8 px-2.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer active:scale-95 transition-all shadow-2xs flex items-center gap-1.5"
                                  title="Mark Cheque as Realized"
                                >
                                  <CheckCircle2 className="size-3.5" />
                                  <span>Realize</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenCancelReplace(chq)}
                                  className="h-8 px-2.5 text-xs font-semibold rounded-lg bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800/80 cursor-pointer active:scale-95 transition-all shadow-2xs flex items-center gap-1.5"
                                  title="Mark Cheque as Bounced or Issue Replacement"
                                >
                                  <RotateCcw className="size-3.5" />
                                  <span>Bounce / Replace</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Modal Footer */}
          <div className="p-3 sm:p-4 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900/60 flex items-center justify-between gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">
              Close
            </Button>

            <div className="flex items-center gap-2">
              {effectiveOutstanding > 0 && onOpenSettlement && customer && (
                <Button
                  size="sm"
                  onClick={() => {
                    onClose();
                    onOpenSettlement(customer);
                  }}
                  className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer shadow-xs"
                >
                  <Receipt className="size-3.5" />
                  Settle Customer Dues (Rs. {effectiveOutstanding.toLocaleString()})
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Payment Dialog */}
      {editingPayment && (
        <Dialog open={!!editingPayment} onOpenChange={(open) => !open && setEditingPayment(null)}>
          <DialogContent className="w-full max-w-md p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Pencil className="size-4 text-blue-500" />
                <span>Adjust Payment Record</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-zinc-400">
                Authorized adjustments automatically synchronize invoice paid amount and customer debt.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveEditPayment} className="space-y-3.5 py-2">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                  Payment Amount (Rs.) *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  placeholder="0.00"
                  className="h-9 text-sm font-mono font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                    Payment Method
                  </label>
                  <select
                    value={editMethod}
                    onChange={(e) => setEditMethod(e.target.value)}
                    className="w-full h-9 rounded-md border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="CASH">Cash</option>
                    <option value="CARD">Card</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                    Payment Date
                  </label>
                  <Input
                    type="datetime-local"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              {/* Conditional Cheque Fields */}
              {editMethod === 'CHEQUE' && (
                <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/20 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                    <FileText className="size-3.5" />
                    <span>Cheque Maturity & Realization</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400 block mb-1">
                        Maturity Date
                      </label>
                      <Input
                        type="date"
                        value={editChequeDate}
                        onChange={(e) => setEditChequeDate(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400 block mb-1">
                        Clearing Status
                      </label>
                      <select
                        value={editChequeStatus}
                        onChange={(e) => setEditChequeStatus(e.target.value)}
                        className="w-full h-8 rounded-md border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2 text-xs font-medium text-slate-900 dark:text-white"
                      >
                        <option value="PENDING">PENDING</option>
                        <option value="CLEARED">REALIZED / CLEARED</option>
                        <option value="BOUNCED">BOUNCED</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                  Reference / Cheque No / Slip
                </label>
                <Input
                  type="text"
                  value={editReference}
                  onChange={(e) => setEditReference(e.target.value)}
                  placeholder="e.g. Cheque #12345 (BOC Bank)"
                  className="h-9 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                  Audit Reason / Note (Optional)
                </label>
                <Input
                  type="text"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="Reason for adjusting payment"
                  className="h-9 text-xs"
                />
              </div>

              <DialogFooter className="pt-2 gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingPayment(null)}
                  disabled={isSubmittingEdit}
                  className="h-8 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingEdit}
                  className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                >
                  {isSubmittingEdit ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin mr-1" />
                      Updating...
                    </>
                  ) : (
                    'Save Adjustments'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Void / Delete Payment Confirmation Dialog */}
      {deletingPayment && (
        <Dialog open={!!deletingPayment} onOpenChange={(open) => !open && setDeletingPayment(null)}>
          <DialogContent className="w-full max-w-sm p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="size-4 text-rose-500" />
                <span>Void Payment Record?</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-zinc-400">
                Are you sure you want to void this payment of{' '}
                <strong className="text-slate-900 dark:text-white font-mono">
                  Rs. {Number(deletingPayment.amount).toFixed(2)}
                </strong>
                ? This will restore the balance due on the invoice and increase the customer's outstanding debt.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="pt-3 gap-2 sm:gap-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeletingPayment(null)}
                disabled={isSubmittingDelete}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmDeletePayment}
                disabled={isSubmittingDelete}
                className="h-8 text-xs bg-rose-600 hover:bg-rose-700 text-white font-semibold"
              >
                {isSubmittingDelete ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin mr-1" />
                    Voiding...
                  </>
                ) : (
                  'Confirm Void'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Bounce & Replace Cheque Dialog */}
      {replaceTargetCheque && (
        <Dialog open={!!replaceTargetCheque} onOpenChange={(open) => !open && setReplaceTargetCheque(null)}>
          <DialogContent className="w-full max-w-md p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="size-4 text-rose-500" />
                <span>Bounce / Replace Cheque #{replaceTargetCheque.chequeNumber}</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-zinc-400">
                Mark this cheque as bounced or cancelled, and optionally register a replacement cheque immediately.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmitCancelReplace} className="space-y-3.5 py-2 text-xs">
              {/* Target Cheque Summary */}
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-900 dark:text-rose-200 flex items-center justify-between">
                <div>
                  <span className="font-bold">Cheque #{replaceTargetCheque.chequeNumber}</span>
                  <span className="block text-[11px] opacity-80">
                    {replaceTargetCheque.bankName !== '-' ? replaceTargetCheque.bankName : 'Bank Cheque'} • Maturity: {replaceTargetCheque.chequeDate || 'N/A'}
                  </span>
                </div>
                <span className="font-mono font-bold text-sm">
                  Rs. {replaceTargetCheque.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* Cancellation Reason */}
              <div>
                <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                  Cancellation / Bounce Reason *
                </label>
                <Input
                  required
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Insufficient funds, signature mismatch, stopped payment"
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

              {/* Replacement Cheque Fields */}
              {issueReplacement && (
                <div className="p-3 rounded-xl border border-blue-500/30 bg-blue-500/5 dark:bg-blue-950/20 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                        New Cheque # *
                      </label>
                      <Input
                        required
                        value={replacementChequeNumber}
                        onChange={(e) => setReplacementChequeNumber(e.target.value)}
                        placeholder="e.g. 987654"
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
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
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                        New Amount (Rs.) *
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
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                        New Maturity Date *
                      </label>
                      <Input
                        type="date"
                        required
                        value={replacementDate}
                        onChange={(e) => setReplacementDate(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              <DialogFooter className="pt-3 gap-2 sm:gap-0">
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
                  className={`h-8 text-xs font-semibold ${
                    issueReplacement
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-rose-600 hover:bg-rose-700 text-white'
                  }`}
                >
                  {isSubmittingCancelReplace ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin mr-1" />
                      Processing...
                    </>
                  ) : issueReplacement ? (
                    'Confirm & Issue Replacement'
                  ) : (
                    'Confirm Cheque Bounce'
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
