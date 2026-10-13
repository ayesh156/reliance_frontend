import React, { useState, useEffect } from 'react';
import { get, post, put, del } from '../../lib/api';
import { toast } from 'react-toastify';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Receipt,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  DollarSign,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Banknote,
  FileText,
  Landmark,
  Download,
  Pencil,
  Trash2,
  AlertTriangle,
  MessageSquare,
} from 'lucide-react';
import { openWhatsAppChat, generateCustomerDebtSummaryWhatsAppMessage } from '../../utils/whatsapp';
// Enterprise Shadcn SearchableSelect Component

import { useTheme } from '../../contexts/ThemeContext';
// Enterprise Shadcn DatePicker Integration
import { DatePicker } from '../ui/date-picker';
import { DateTimePicker } from '../ui/date-time-picker';
import { SearchableSelect } from '../ui/searchable-select';

interface BillItem {
  name: string;
  size?: string;
  color?: string;
  quantity: number;
  price: number;
}

interface PaymentHistoryItem {
  id: number;
  amount: number;
  method: string;
  reference?: string;
  createdAt: string;
}

interface DueBill {
  orderId: number;
  invoiceNumber: string;
  source: string;
  createdAt: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  status: string;
  paymentMethod?: string;
  items: BillItem[];
  paymentHistory: PaymentHistoryItem[];
}

const getCurrentLocalISOString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const mins = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${mins}`;
};

const PAYMENT_METHOD_OPTIONS = [
  { value: 'CASH', label: 'Cash', icon: <Banknote className="size-3.5 text-emerald-500" /> },
  { value: 'CARD', label: 'Card', icon: <CreditCard className="size-3.5 text-purple-500" /> },
  { value: 'BANK_TRANSFER', label: 'Bank T', icon: <Landmark className="size-3.5 text-blue-500" /> },
  { value: 'CHEQUE', label: 'Cheque', icon: <FileText className="size-3.5 text-amber-500" /> },
];

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
    default:
      return method || 'Cash';
  }
};

interface CustomerDueSettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: number | null;
  customerName?: string;
  customerPhone?: string;
  onPaymentSuccess?: () => void;
}

export const CustomerDueSettlementModal: React.FC<CustomerDueSettlementModalProps> = ({
  isOpen,
  onClose,
  customerId,
  customerName,
  customerPhone,
  onPaymentSuccess,
}) => {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';

  const [loading, setLoading] = useState(false);
  const [bills, setBills] = useState<DueBill[]>([]);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [customerPhoneState, setCustomerPhoneState] = useState<string | null>(null);
  const [expandedBillId, setExpandedBillId] = useState<number | null>(null);

  // Payment Processing State with DateTime
  const [payingOrderId, setPayingOrderId] = useState<number | null>(null);
  const [payAmount, setPayAmount] = useState<string>('');
  const [payMethod, setPayMethod] = useState<string>('CASH');
  const [payReference, setPayReference] = useState<string>('');
  const [payDate, setPayDate] = useState<string>(getCurrentLocalISOString);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Quick Whole-Balance Settlement state
  const [quickPayAmount, setQuickPayAmount] = useState<string>('');
  const [quickPayMethod, setQuickPayMethod] = useState<string>('CASH');
  const [quickPayRef, setQuickPayRef] = useState<string>('');
  const [quickPayDateTime, setQuickPayDateTime] = useState<string>(getCurrentLocalISOString);
  const [isSubmittingQuickPay, setIsSubmittingQuickPay] = useState(false);
  const [showQuickPayForm, setShowQuickPayForm] = useState(false);

  // Payment Edit & Void (Delete) states
  const [editingPayment, setEditingPayment] = useState<PaymentHistoryItem | null>(null);
  const [editAmount, setEditAmount] = useState<string>('');
  const [editMethod, setEditMethod] = useState<string>('CASH');
  const [editReference, setEditReference] = useState<string>('');
  const [editDate, setEditDate] = useState<string>(getCurrentLocalISOString);
  const [editNote, setEditNote] = useState<string>('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const [deletingPayment, setDeletingPayment] = useState<PaymentHistoryItem | null>(null);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);

  // බිල්පත් දත්ත backend එකෙන් ලබා ගැනීම
  const fetchDueBills = async () => {
    if (!customerId) return;
    setLoading(true);
    try {
      const res = await get<{
        success: boolean;
        customer: { id?: number; name?: string; phone?: string; outstandingBalance: number; computedTotalDue: number };
        bills: DueBill[];
      }>(`/credit/customers/${customerId}/due-bills`);

      if (res && res.bills) {
        setBills(res.bills);
        setTotalOutstanding(res.customer.computedTotalDue || 0);
        if (res.customer.phone) {
          setCustomerPhoneState(res.customer.phone);
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load customer pending bills');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && customerId) {
      fetchDueBills();
      setPayingOrderId(null);
      setPayAmount('');
      setQuickPayAmount('');
      setQuickPayRef('');
      setQuickPayDateTime(new Date().toISOString());
      setShowQuickPayForm(false);
      setEditingPayment(null);
      setDeletingPayment(null);
    }
  }, [isOpen, customerId]);

  // One-click / Custom Whole Balance Settlement Submit
  const handleQuickSettleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!customerId) return;
    const numericAmount = parseFloat(quickPayAmount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }
    if (numericAmount > totalOutstanding) {
      toast.error(`Maximum payable amount is Rs. ${totalOutstanding.toFixed(2)}`);
      return;
    }

    setIsSubmittingQuickPay(true);
    try {
      await post(`/orders/customers/${customerId}/settle-debt`, {
        amount: numericAmount,
        strategy: 'FIFO',
        paymentMethod: quickPayMethod,
        notes: quickPayRef?.trim() || 'Full Balance Settlement',
        paymentDate: quickPayDateTime ? new Date(quickPayDateTime).toISOString() : new Date().toISOString(),
      });

      toast.success(`Payment of Rs. ${numericAmount.toFixed(2)} settled successfully!`);
      setQuickPayAmount('');
      setQuickPayRef('');
      setQuickPayDateTime(new Date().toISOString());
      setShowQuickPayForm(false);
      await fetchDueBills();
      if (onPaymentSuccess) {
        onPaymentSuccess();
      }
    } catch (err: any) {
      toast.error(err.message || 'Payment settlement failed');
    } finally {
      setIsSubmittingQuickPay(false);
    }
  };

  // Open Payment Form
  const handleInitiatePay = (bill: DueBill) => {
    setPayingOrderId(bill.orderId);
    setPayAmount(bill.dueAmount.toFixed(2));
    setPayMethod('CASH');
    setPayReference('');
    setPayDate(getCurrentLocalISOString());
  };

  // Initiate Edit Payment
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
        setEditDate(getCurrentLocalISOString());
      }
    } else {
      setEditDate(getCurrentLocalISOString());
    }
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
        notes: editNote.trim() || undefined,
        type: 'customer',
      });

      toast.success('Payment updated and balance delta adjusted successfully!');
      setEditingPayment(null);
      await fetchDueBills();
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
      toast.success(`Payment of Rs. ${deletingPayment.amount.toFixed(2)} voided and balance reversed.`);
      setDeletingPayment(null);
      await fetchDueBills();
      if (onPaymentSuccess) {
        onPaymentSuccess();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to void payment');
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  // බිලකට මුදල් ගෙවීම Submit කිරීම
  const handleSettleSubmit = async (bill: DueBill) => {
    const numericAmount = parseFloat(payAmount);

    if (isNaN(numericAmount) || numericAmount <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }

    if (numericAmount > bill.dueAmount) {
      toast.error(`Maximum payable amount is Rs. ${bill.dueAmount.toFixed(2)}`);
      return;
    }

    setIsSubmitting(true);
    try {
      const resolvedPaymentDateTime = payDate ? new Date(payDate) : new Date();

      await post('/credit/settle-bill', {
        orderId: bill.orderId,
        amount: numericAmount,
        paymentMethod: payMethod,
        reference: payReference,
        paymentDate: resolvedPaymentDateTime.toISOString(),
      });

      toast.success(`Payment of Rs. ${numericAmount.toFixed(2)} settled successfully!`);
      setPayingOrderId(null);
      setPayAmount('');
      setPayDate(getCurrentLocalISOString());
      
      await fetchDueBills();
      if (onPaymentSuccess) {
        onPaymentSuccess();
      }
    } catch (err: any) {
      toast.error(err.message || 'Payment settlement failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Direct Backend Statement PDF Downloader
  const handleDownloadStatement = async () => {
    try {
      toast.info('Generating Account Statement PDF...');
      const apiHost = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const token = localStorage.getItem('token') || localStorage.getItem('auth_token') || sessionStorage.getItem('token');

      const response = await fetch(`${apiHost}/credit/customers/${customerId}/statement-pdf`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) throw new Error('Failed to generate statement PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Statement-${(customerName || 'Customer').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Statement PDF downloaded successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Download failed');
    }
  };

  // Send Statement / Due Breakdown on WhatsApp
  const handleSendWhatsAppStatement = () => {
    const activePhone = customerPhone || customerPhoneState;
    if (!activePhone) {
      const manual = window.prompt('Enter customer mobile number for WhatsApp statement:');
      if (!manual?.trim()) return;
      const waMsg = generateCustomerDebtSummaryWhatsAppMessage(
        {
          name: customerName || 'Customer',
          outstandingBalance: totalOutstanding,
          phone: manual.trim(),
        },
        bills.map((b) => ({
          invoiceNo: b.invoiceNumber,
          date: b.createdAt,
          totalAmount: b.totalAmount,
          paidAmount: b.paidAmount,
          dueAmount: b.dueAmount,
          source: b.source,
        }))
      );
      openWhatsAppChat(manual.trim(), waMsg);
      return;
    }
    const waMsg = generateCustomerDebtSummaryWhatsAppMessage(
      {
        name: customerName || 'Customer',
        outstandingBalance: totalOutstanding,
        phone: activePhone,
      },
      bills.map((b) => ({
        invoiceNo: b.invoiceNumber,
        date: b.createdAt,
        totalAmount: b.totalAmount,
        paidAmount: b.paidAmount,
        dueAmount: b.dueAmount,
        source: b.source,
      }))
    );
    openWhatsAppChat(activePhone, waMsg);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-lg sm:max-w-2xl max-h-[92vh] flex flex-col p-3 sm:p-5 overflow-hidden bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl sm:rounded-3xl shadow-2xl">
        {/* Header */}
        <DialogHeader className="pb-3 border-b shrink-0 border-slate-100 dark:border-zinc-800 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Receipt className="size-5 text-emerald-500 shrink-0" />
              <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                {customerName ? `${customerName} - Pending Invoices` : 'Customer Due Invoices'}
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-xs text-slate-500 dark:text-zinc-400 -mt-1 text-left">
            Review bill dates, item breakdown, and settle dues individually.
          </DialogDescription>

          {/* Full-width Responsive Outstanding Balance / Summary Card Banner */}
          <div className="w-full rounded-xl p-3 mb-3 bg-rose-50/90 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 shrink-0">
                <AlertCircle className="size-4" />
              </div>
              <div className="min-w-0 text-left">
                <span className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400 block leading-tight tracking-wider">
                  Total Due Balance
                </span>
                <span className="text-xs text-slate-500 dark:text-zinc-400 truncate block">
                  {bills.length} pending bill{bills.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-base sm:text-lg font-extrabold font-mono text-rose-700 dark:text-rose-300">
                Rs. {totalOutstanding.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Responsive Header Action Buttons */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full mb-3">
            {totalOutstanding > 0 && (
              <button
                type="button"
                onClick={() => {
                  setQuickPayAmount(totalOutstanding.toFixed(2));
                  setQuickPayMethod('CASH');
                  setQuickPayRef('');
                  setQuickPayDateTime(new Date().toISOString());
                  setShowQuickPayForm(true);
                }}
                className="flex-1 min-w-[100px] text-xs h-9 justify-center font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-sm transition-all inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Banknote className="size-3.5 shrink-0" />
                <span>Pay Full</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleDownloadStatement}
              className="flex-1 min-w-[100px] text-xs h-9 justify-center font-semibold rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 shadow-sm transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="size-3.5 text-emerald-600 shrink-0" />
              <span>Statement PDF</span>
            </button>

            <button
              type="button"
              onClick={handleSendWhatsAppStatement}
              className="flex-1 min-w-[100px] text-xs h-9 justify-center font-semibold rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 shadow-sm transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              title="Send Outstanding Statement via WhatsApp"
            >
              <MessageSquare className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>WhatsApp</span>
            </button>
          </div>
        </DialogHeader>

        {/* Invoice Items & Payment Ledger Scroll Container */}
        <div className="w-full flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1 space-y-3 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-zinc-700">
          {/* Quick Full-Balance Settlement Confirmation Modal */}
          <Dialog open={showQuickPayForm} onOpenChange={setShowQuickPayForm}>
            <DialogContent className="w-full max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl z-[70]">
              <DialogHeader className="pb-2 border-b border-slate-100 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <Banknote className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                    Settle Due Balance
                  </DialogTitle>
                </div>
                <DialogDescription className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Clear outstanding credit balance for <strong>{customerName || 'Customer'}</strong>.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleQuickSettleSubmit} className="space-y-4 pt-1">
                {/* Header Card: Customer meta */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/70 border border-slate-200/80 dark:border-zinc-800/80 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-zinc-400 font-medium">Customer Name:</span>
                    <span className="font-bold text-slate-800 dark:text-zinc-200 px-2 py-0.5 rounded-md bg-white dark:bg-zinc-800 border border-slate-200/60 dark:border-zinc-700/60">
                      {customerName || 'Customer'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-zinc-400 font-medium">Total Balance:</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-zinc-200 px-2 py-0.5 rounded-md bg-white dark:bg-zinc-800 border border-slate-200/60 dark:border-zinc-700/60">
                      Rs. {totalOutstanding.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-200/70 dark:border-zinc-800/70 pt-1.5 text-xs">
                    <span className="text-slate-600 dark:text-zinc-300 font-semibold">Remaining Due Balance:</span>
                    <span className="font-mono font-extrabold text-rose-600 dark:text-rose-400 text-sm px-2.5 py-0.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200/80 dark:border-rose-900/50">
                      Rs. {Math.max(0, totalOutstanding - (parseFloat(quickPayAmount) || 0)).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Inputs Grid: Convert Amount and Payment Method into a responsive 2-column grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                      Amount (Rs.) *
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      required
                      max={totalOutstanding}
                      value={quickPayAmount}
                      onChange={(e) => setQuickPayAmount(e.target.value)}
                      placeholder="0.00"
                      className="h-10 font-mono font-bold text-sm bg-white dark:bg-zinc-900 rounded-xl"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                      Payment Method *
                    </label>
                    <SearchableSelect
                      value={quickPayMethod}
                      onValueChange={(val) => setQuickPayMethod(val)}
                      options={PAYMENT_METHOD_OPTIONS}
                      placeholder="Select Method"
                      searchPlaceholder="Search method..."
                      dark={dark}
                      className="h-10 rounded-xl"
                    />
                  </div>
                </div>

                {/* Payment Timestamp Row */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    Payment Date &amp; Timestamp *
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2.5 w-full">
                    <DateTimePicker
                      value={quickPayDateTime}
                      onChange={setQuickPayDateTime}
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    Payment Reference / Note (Optional)
                  </label>
                  <Input
                    type="text"
                    value={quickPayRef}
                    onChange={(e) => setQuickPayRef(e.target.value)}
                    placeholder="Cheque No / Slip No / Note"
                    className="h-10 text-xs bg-white dark:bg-zinc-900 rounded-xl"
                  />
                </div>

                {/* Action Footer */}
                <div className="pt-2 space-y-2">
                  <Button
                    type="submit"
                    disabled={isSubmittingQuickPay}
                    className="h-11 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-sm active:scale-[0.98] transition-all cursor-pointer inline-flex items-center justify-center gap-2"
                  >
                    {isSubmittingQuickPay ? <Loader2 className="size-4 animate-spin" /> : <Banknote className="size-4" />}
                    {isSubmittingQuickPay ? 'Processing...' : 'Confirm Payment'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowQuickPayForm(false)}
                    className="h-10 w-full border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors font-medium text-xs sm:text-sm"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2">
              <Loader2 className="size-8 animate-spin text-emerald-500" />
              <p className="text-xs text-slate-500">හිඟ බිල්පත් ගණනය වෙමින් පවතී...</p>
            </div>
          ) : bills.length === 0 && totalOutstanding <= 0 ? (
            <div className="py-16 text-center">
              <CheckCircle2 className="size-10 text-emerald-500 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-200">
                හිඟ මුදල් කිසිවක් නොමැත!
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                මෙම ගනුදෙනුකරුගේ සියලුම බිල්පත් සම්පූර්ණයෙන්ම ගෙවා අවසන් කර ඇත.
              </p>
            </div>
          ) : (
            bills.map((bill) => {
              const billDate = new Date(bill.createdAt);
              // Standard yyyy-mm-dd date format
              const formattedDate = `${billDate.getFullYear()}-${String(billDate.getMonth() + 1).padStart(2, '0')}-${String(billDate.getDate()).padStart(2, '0')}`;
              const formattedTime = billDate.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              });

              const isExpanded = expandedBillId === bill.orderId;
              const isPayingThis = payingOrderId === bill.orderId;

              return (
                <div
                  key={bill.orderId}
                  className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/40 p-3.5 sm:p-4 transition-all shadow-xs hover:border-slate-300 dark:hover:border-zinc-700 w-full overflow-hidden"
                >
                  {/* Top Bar of Bill Card */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400">
                          {bill.invoiceNumber}
                        </span>
                        {/* Compact Badge: Displays Short Wholesale (WS) or Retail (RET) tag */}
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${
                            bill.source === 'POS_WHOLESALE'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800'
                              : 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700'
                          }`}
                        >
                          {bill.source === 'POS_WHOLESALE' ? 'WHOLESALE' : 'RETAIL'}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                          {bill.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-zinc-400 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3 text-slate-400" /> {formattedDate}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="size-3 text-slate-400" /> {formattedTime}
                        </span>
                        <span>Items: {bill.items.length}</span>
                      </div>
                    </div>

                    {/* Financial Summary & Actions */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200 dark:border-zinc-800">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block leading-tight">Due Balance</span>
                        <span className="text-sm sm:text-base font-extrabold font-mono text-rose-600 dark:text-rose-400">
                          Rs. {bill.dueAmount.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-[9px] text-slate-400 block leading-none">
                          Total: Rs. {bill.totalAmount.toFixed(2)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => (isPayingThis ? setPayingOrderId(null) : handleInitiatePay(bill))}
                          className="h-8 text-xs font-semibold px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs"
                        >
                          {isPayingThis ? 'Close' : 'Pay Bill'}
                        </Button>

                        <button
                          type="button"
                          onClick={() => setExpandedBillId(isExpanded ? null : bill.orderId)}
                          className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-500 transition-colors"
                          title="View Bill Details"
                        >
                          {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Inline Payment Form */}
                  {isPayingThis && (
                    <div className="mt-3.5 pt-3 border-t border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 rounded-xl space-y-3 overflow-visible relative z-30 w-full">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                        <DollarSign className="size-4 shrink-0" />
                        <span>Settle Payment for Invoice #{bill.invoiceNumber}</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 w-full overflow-visible relative z-40">
                        <div className="w-full space-y-1">
                          <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-300 block">
                            Paying Amount *
                          </label>
                          <Input
                            type="number"
                            step="0.01"
                            max={bill.dueAmount}
                            value={payAmount}
                            onChange={(e) => setPayAmount(e.target.value)}
                            onFocus={(e) => e.target.select()}
                            onClick={(e) => (e.target as HTMLInputElement).select()}
                            placeholder="0.00"
                            className="h-9 text-xs font-mono font-bold bg-white dark:bg-zinc-900 rounded-lg w-full"
                          />
                        </div>

                        <div className="w-full space-y-1 relative z-50">
                          <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-300 block">
                            Payment Method *
                          </label>
                          <SearchableSelect
                            value={payMethod}
                            onValueChange={(val) => setPayMethod(val)}
                            options={PAYMENT_METHOD_OPTIONS}
                            placeholder="Select Method"
                            searchPlaceholder="Search method..."
                            dark={dark}
                            className="h-9 py-0 rounded-lg text-xs w-full"
                          />
                        </div>

                        <div className="w-full sm:col-span-2 lg:col-span-2 relative z-45">
                          <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-300 block">
                            Payment Date & Time *
                          </label>
                          <DateTimePicker
                            value={payDate}
                            onChange={setPayDate}
                            className="w-full"
                          />
                        </div>

                        <div className="w-full sm:col-span-2 lg:col-span-4 space-y-1">
                          <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-300 block">
                            Reference / Note (Optional)
                          </label>
                          <Input
                            type="text"
                            value={payReference}
                            onChange={(e) => setPayReference(e.target.value)}
                            placeholder="Cheque No / Slip No"
                            className="h-9 text-xs bg-white dark:bg-zinc-900 rounded-lg w-full"
                          />
                        </div>
                      </div>

                      {/* Responsive Payment Settlement Row */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 p-3 rounded-xl bg-slate-100/90 dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800">
                        <div className="text-xs text-slate-600 dark:text-zinc-300 font-medium flex items-center justify-between sm:justify-start gap-2">
                          <span>Remaining Due:</span>
                          <strong className="font-mono text-rose-600 dark:text-rose-400 font-bold">
                            Rs. {Math.max(0, bill.dueAmount - (parseFloat(payAmount) || 0)).toFixed(2)}
                          </strong>
                        </div>
                        <div className="flex items-center gap-2 justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setPayingOrderId(null)}
                            className="h-9 text-xs px-3 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => handleSettleSubmit(bill)}
                            className="h-9 text-xs px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5 flex-1 sm:flex-none justify-center shadow-xs"
                          >
                            {isSubmitting ? <Loader2 className="size-3.5 animate-spin" /> : <Banknote className="size-3.5" />}
                            {isSubmitting ? 'Processing...' : 'Confirm Payment'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-zinc-800 space-y-3 w-full overflow-hidden">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                          Invoice Items ({bill.items.length})
                        </span>
                        <div className="w-full overflow-hidden rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                          <table className="w-full text-left text-xs table-fixed">
                            <thead className="bg-slate-50 dark:bg-zinc-900 text-slate-500 text-[10px] uppercase font-semibold">
                              <tr>
                                <th className="p-2 w-5/12">Item</th>
                                <th className="p-2 w-3/12">Size / Color</th>
                                <th className="p-2 w-2/12 text-center">Qty</th>
                                <th className="p-2 w-2/12 text-right">Price</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                              {bill.items.map((it, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-zinc-900/50">
                                  <td className="p-2 font-medium truncate" title={it.name}>{it.name}</td>
                                  <td className="p-2 text-slate-500 truncate" title={`${it.size || 'FREE'} ${it.color ? `/ ${it.color}` : ''}`}>
                                    {it.size || 'FREE'} {it.color ? `/ ${it.color}` : ''}
                                  </td>
                                  <td className="p-2 text-center font-mono">{it.quantity}</td>
                                  <td className="p-2 text-right font-mono font-medium whitespace-nowrap">
                                    රු. {it.price.toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Payment History for this bill */}
                      {bill.paymentHistory.length > 0 && (
                        <div className="w-full overflow-hidden">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                            Payment Ledger History ({bill.paymentHistory.length})
                          </span>
                          <div className="space-y-1.5 w-full">
                            {bill.paymentHistory.map((ph) => {
                              const d = new Date(ph.createdAt);
                              const yyyy = d.getFullYear();
                              const mm = String(d.getMonth() + 1).padStart(2, '0');
                              const dd = String(d.getDate()).padStart(2, '0');
                              const formattedDate = `${yyyy}-${mm}-${dd}`;
                              const formattedTime = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

                              return (
                                <div
                                  key={ph.id}
                                  className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-1.5 text-[11px] p-2 rounded-lg bg-white dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 group hover:border-slate-300 dark:hover:border-zinc-700 transition-colors w-full overflow-hidden"
                                >
                                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                    <CheckCircle2 className="size-3 text-emerald-500 shrink-0" />
                                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                      රු. {ph.amount.toFixed(2)}
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-[9px] font-semibold whitespace-nowrap">
                                      {formatPaymentMethod(ph.method)}
                                    </span>
                                    {ph.reference && (
                                      <span className="text-slate-400 text-[10px] truncate max-w-[120px] sm:max-w-[180px]" title={ph.reference}>
                                        ({ph.reference})
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0 ml-auto">
                                    <div className="flex items-center gap-1 text-slate-500 dark:text-zinc-400 text-[10px] sm:text-[11px] font-mono font-medium whitespace-nowrap">
                                      <span>{formattedDate}</span>
                                      <span className="text-slate-400 text-[9px] hidden sm:inline">{formattedTime}</span>
                                    </div>
                                    {/* Action Buttons: Edit & Delete (Void) */}
                                    <div className="flex items-center gap-1 ml-1 border-l border-slate-200 dark:border-zinc-800 pl-1.5">
                                      <button
                                        type="button"
                                        onClick={() => handleInitiateEditPayment(ph)}
                                        className="p-1 rounded text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer"
                                        title="Edit Payment"
                                      >
                                        <Pencil className="size-3" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setDeletingPayment(ph)}
                                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                                        title="Void / Delete Payment"
                                      >
                                        <Trash2 className="size-3" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Edit Payment Modal */}
          <Dialog open={!!editingPayment} onOpenChange={(open) => !open && setEditingPayment(null)}>
            <DialogContent className="w-[90vw] sm:max-w-md bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-3xl p-5 shadow-2xl z-[80] overflow-visible">
              <DialogHeader className="pb-2 border-b border-slate-100 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <Pencil className="size-4 text-amber-600 dark:text-amber-400" />
                  <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">
                    Edit Payment Record
                  </DialogTitle>
                </div>
                <DialogDescription className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Update amount, date, or cheque reference with net balance adjustment.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSaveEditPayment} className="space-y-3 pt-2 overflow-visible">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-300 block">
                    Payment Amount (Rs.) *
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    placeholder="0.00"
                    className="h-8 text-xs font-mono font-bold bg-white dark:bg-zinc-900 rounded-xl"
                  />
                </div>

                <div className="space-y-1 relative z-50">
                  <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-300 block">
                    Payment Date & Time *
                  </label>
                  <DateTimePicker
                    value={editDate}
                    onChange={setEditDate}
                    className="h-8 text-xs rounded-xl"
                  />
                </div>

                <div className="space-y-1 relative z-40">
                  <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-300 block">
                    Payment Method *
                  </label>
                  <SearchableSelect
                    value={editMethod}
                    onValueChange={setEditMethod}
                    options={PAYMENT_METHOD_OPTIONS}
                    placeholder="Select Method"
                    searchPlaceholder="Search method..."
                    dark={dark}
                    className="h-8 py-0 rounded-xl"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-300 block">
                    Cheque No / Slip Reference
                  </label>
                  <Input
                    type="text"
                    value={editReference}
                    onChange={(e) => setEditReference(e.target.value)}
                    placeholder="e.g. CHQ-99081 / Commercial Bank"
                    className="h-8 text-xs bg-white dark:bg-zinc-900 rounded-xl"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-amber-700 dark:text-amber-400 block">
                    Reason for Edit / Audit Note (Optional)
                  </label>
                  <Input
                    type="text"
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    placeholder="e.g. Cheque amount corrected per bank deposit slip (optional)"
                    className="h-8 text-xs bg-white dark:bg-zinc-900 rounded-xl border-amber-300 dark:border-amber-700"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingPayment(null)}
                    className="h-8 text-xs rounded-xl"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSubmittingEdit}
                    className="h-8 text-xs font-semibold px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    {isSubmittingEdit ? <Loader2 className="size-3 animate-spin" /> : <Pencil className="size-3.5" />}
                    {isSubmittingEdit ? 'Saving...' : 'Save & Adjust Balance'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {/* Void / Delete Confirmation Modal */}
          <Dialog open={!!deletingPayment} onOpenChange={(open) => !open && setDeletingPayment(null)}>
            <DialogContent className="w-[90vw] sm:max-w-md bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-3xl p-5 shadow-2xl z-[80]">
              <DialogHeader className="pb-2 border-b border-slate-100 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-5 text-rose-600" />
                  <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">
                    Void Payment &amp; Reverse Balance
                  </DialogTitle>
                </div>
                <DialogDescription className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                  Are you sure you want to void this payment record?
                </DialogDescription>
              </DialogHeader>

              {deletingPayment && (
                <div className="py-3 space-y-2 text-xs">
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 space-y-1">
                    <div className="flex justify-between font-medium text-rose-900 dark:text-rose-200">
                      <span>Voiding Amount:</span>
                      <strong className="font-mono text-rose-700 dark:text-rose-300">
                        Rs. {deletingPayment.amount.toFixed(2)}
                      </strong>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500 dark:text-zinc-400">
                      <span>Method:</span>
                      <span>{formatPaymentMethod(deletingPayment.method)}</span>
                    </div>
                    {deletingPayment.reference && (
                      <div className="flex justify-between text-[11px] text-slate-500 dark:text-zinc-400">
                        <span>Reference:</span>
                        <span className="font-mono">{deletingPayment.reference}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                    Voiding this payment will decrement the invoice's paid amount and add{' '}
                    <strong className="text-rose-600 font-mono">Rs. {deletingPayment.amount.toFixed(2)}</strong> back to the customer's outstanding credit balance.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDeletingPayment(null)}
                  className="h-8 text-xs rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={isSubmittingDelete}
                  onClick={handleConfirmDeletePayment}
                  className="h-8 text-xs font-semibold px-4 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  {isSubmittingDelete ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3.5" />}
                  {isSubmittingDelete ? 'Voiding...' : 'Yes, Void Payment'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t shrink-0 border-slate-100 dark:border-zinc-800 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Total Pending Invoices: <strong className="text-slate-800 dark:text-zinc-200">{bills.length}</strong>
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-8 text-xs px-4 rounded-xl cursor-pointer"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};