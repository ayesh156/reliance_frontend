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
  Loader2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Banknote,
  FileText,
  Landmark,
  Download,
  Building2,
  Pencil,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
// Enterprise SearchableSelect & DatePicker
import { DateTimePicker } from '../ui/date-time-picker';
import { DatePicker } from '../ui/date-picker';
import { useTheme } from '../../contexts/ThemeContext';
import type { RawMaterialShop } from '../../pages/RawMaterialShopsPage';
import { SearchableSelect } from '../ui/searchable-select';

interface PurchaseMaterialItem {
  id: number;
  name: string;
  code: string | null;
  unit: string;
  quantity: number;
  pricePerUnit: number;
  rowTotal: number;
}

interface PaymentHistoryItem {
  id: number;
  amount: number;
  method: string;
  reference?: string;
  createdAt: string;
}

interface DuePurchaseBill {
  id: number;
  invoiceNumber: string;
  purchaseDate: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  paymentStatus: string;
  paymentMethod?: string;
  items: PurchaseMaterialItem[];
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

interface SupplierDueSettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  shop: RawMaterialShop | null;
  onSuccess: () => void;
}

export const SupplierDueSettlementModal: React.FC<SupplierDueSettlementModalProps> = ({
  isOpen,
  onClose,
  shop,
  onSuccess,
}) => {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';

  const [loading, setLoading] = useState(false);
  const [bills, setBills] = useState<DuePurchaseBill[]>([]);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [expandedBillId, setExpandedBillId] = useState<number | null>(null);

  // Payment Processing States
  const [payingBillId, setPayingBillId] = useState<number | null>(null);
  const [payAmount, setPayAmount] = useState<string>('');
  const [payMethod, setPayMethod] = useState<string>('CASH');
  const [payReference, setPayReference] = useState<string>('');

  const [payDate, setPayDate] = useState<string>(getCurrentLocalISOString);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Payment Edit & Delete States
  const [editingPayment, setEditingPayment] = useState<PaymentHistoryItem | null>(null);
  const [editingBillId, setEditingBillId] = useState<number | null>(null);
  const [editAmount, setEditAmount] = useState<string>('');
  const [editMethod, setEditMethod] = useState<string>('CASH');
  const [editReference, setEditReference] = useState<string>('');
  const [editDate, setEditDate] = useState<string>(getCurrentLocalISOString);
  const [editNote, setEditNote] = useState<string>('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const [deletingPayment, setDeletingPayment] = useState<PaymentHistoryItem | null>(null);
  const [deletingBillId, setDeletingBillId] = useState<number | null>(null);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);

  // Supplier ගේ නොගෙවූ Purchase Orders සහ Item History ලබා ගැනීම
  const fetchDuePurchases = async () => {
    if (!shop) return;
    setLoading(true);
    try {
      const res = await get<any[]>(`/buy-raw-materials?shopId=${shop.id}`);
      if (Array.isArray(res)) {
        // ගෙවීමට හිඟ මුදලක් පවතින Purchase Orders Filter කිරීම
        const dueList: DuePurchaseBill[] = res
          .filter((p) => Number(p.totalAmount) - Number(p.paidAmount) > 0)
          .map((p) => {
            const tot = Number(p.totalAmount) || 0;
            const pd = Number(p.paidAmount) || 0;
            return {
              id: p.id,
              invoiceNumber: p.invoiceNumber || `PO-${String(p.id).padStart(4, '0')}`,
              purchaseDate: p.purchaseDate,
              totalAmount: tot,
              paidAmount: pd,
              dueAmount: Math.max(0, tot - pd),
              paymentStatus: p.paymentStatus,
              paymentMethod: p.paymentMethod,
              items: (p.items || []).map((it: any) => ({
                id: it.id,
                name: it.rawMaterialItem?.name || 'Raw Material Item',
                code: it.rawMaterialItem?.code || null,
                unit: it.rawMaterialItem?.unit || 'METERS',
                quantity: Number(it.quantity) || 0,
                pricePerUnit: Number(it.pricePerUnit) || 0,
                rowTotal: Number(it.rowTotal || (it.quantity * it.pricePerUnit)) || 0,
              })),
              paymentHistory: p.paymentHistory || [],
            };
          });

        setBills(dueList);
        const computedTotal = dueList.reduce((sum, b) => sum + b.dueAmount, 0);
        setTotalOutstanding(computedTotal > 0 ? computedTotal : Number(shop.creditBalance || 0));
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load supplier pending purchases');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && shop) {
      fetchDuePurchases();
      setPayingBillId(null);
      setPayAmount('');
      setExpandedBillId(null);
      setEditingPayment(null);
      setDeletingPayment(null);
    }
  }, [isOpen, shop]);

  // Pay Form Open (Reset to Current Date & Time)
  const handleInitiatePay = (bill: DuePurchaseBill) => {
    setPayingBillId(bill.id);
    setPayAmount(bill.dueAmount.toFixed(2));
    setPayMethod('CASH');
    setPayReference('');
    setPayDate(getCurrentLocalISOString());
  };

  // Initiate Edit Supplier Payment
  const handleInitiateEditPayment = (ph: PaymentHistoryItem, billId: number) => {
    setEditingPayment(ph);
    setEditingBillId(billId);
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

  // Save Edit Supplier Payment
  const handleSaveEditPayment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingPayment || !editingBillId) return;
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
        purchaseId: editingBillId,
        type: 'supplier',
      });

      toast.success('Supplier payment updated successfully!');
      setEditingPayment(null);
      setEditingBillId(null);
      await fetchDuePurchases();
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update supplier payment');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Confirm Void / Delete Supplier Payment
  const handleConfirmDeletePayment = async () => {
    if (!deletingPayment || !deletingBillId) return;
    setIsSubmittingDelete(true);
    try {
      await del(`/payments/${deletingPayment.id}?purchaseId=${deletingBillId}&type=supplier`);
      toast.success(`Payment of Rs. ${deletingPayment.amount.toFixed(2)} voided and supplier debt restored.`);
      setDeletingPayment(null);
      setDeletingBillId(null);
      await fetchDuePurchases();
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Failed to void payment');
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  // Payment Submit
  const handleSettleSubmit = async (bill: DuePurchaseBill) => {
    const numericAmount = parseFloat(payAmount);

    if (isNaN(numericAmount) || numericAmount <= 0) {
      toast.error('Please enter a valid positive payment amount');
      return;
    }

    if (numericAmount > bill.dueAmount) {
      toast.error(`Maximum payable amount is Rs. ${bill.dueAmount.toFixed(2)}`);
      return;
    }

    setIsSubmitting(true);
    try {
      const resolvedPaymentDateTime = payDate ? new Date(payDate) : new Date();

      await post('/buy-raw-materials/settle-payment', {
        purchaseId: bill.id,
        amount: numericAmount,
        paymentMethod: payMethod,
        paymentDate: resolvedPaymentDateTime.toISOString(),
        reference: payReference.trim() || undefined,
      });

      toast.success(`Payment of Rs. ${numericAmount.toFixed(2)} settled successfully!`);
      setPayingBillId(null);
      setPayAmount('');
      setPayDate(getCurrentLocalISOString());
      await fetchDuePurchases();
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Payment settlement failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-lg sm:max-w-3xl lg:max-w-4xl max-h-[90vh] flex flex-col bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-3xl p-4 sm:p-6 shadow-2xl">
        {/* Header Section */}
        <DialogHeader className="pb-3 border-b shrink-0 border-slate-100 dark:border-zinc-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="size-5 text-emerald-500" />
                <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  {shop?.name ? `${shop.name} — Pending GRN Notes` : 'Supplier Pending GRN Notes'}
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Review GRN receipts, material batch breakdown, and settle supplier dues individually.
              </DialogDescription>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-right bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 px-3 py-1.5 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400 block leading-tight">
                  Total Due
                </span>
                <span className="text-sm sm:text-base font-extrabold font-mono text-rose-700 dark:text-rose-300">
                  Rs. {totalOutstanding.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Body Viewport */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain py-3 px-1 space-y-3 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-zinc-700">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2">
              <Loader2 className="size-8 animate-spin text-emerald-500" />
              <p className="text-xs text-slate-500">හිඟ බිල්පත් ගණනය වෙමින් පවතී...</p>
            </div>
          ) : bills.length === 0 ? (
            <div className="py-16 text-center">
              <CheckCircle2 className="size-10 text-emerald-500 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-200">
                හිඟ මුදල් කිසිවක් නොමැත!
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                මෙම සැපයුම්කරුගේ සියලුම මිලදී ගැනීමේ බිල්පත් සම්පූර්ණයෙන්ම ගෙවා අවසන් කර ඇත.
              </p>
            </div>
          ) : (
            bills.map((bill) => {
              const bDate = new Date(bill.purchaseDate);
              const formattedDate = `${bDate.getFullYear()}-${String(bDate.getMonth() + 1).padStart(2, '0')}-${String(bDate.getDate()).padStart(2, '0')}`;
              const formattedTime = bDate.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              });

              const isExpanded = expandedBillId === bill.id;
              const isPayingThis = payingBillId === bill.id;

              return (
                <div
                  key={bill.id}
                  className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/40 p-3.5 sm:p-4 transition-all shadow-xs hover:border-slate-300 dark:hover:border-zinc-700"
                >
                  {/* Top Bar of Purchase Bill Card */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400">
                          {bill.invoiceNumber}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                          {bill.paymentStatus}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-zinc-400 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3 text-slate-400" /> {formattedDate}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="size-3 text-slate-400" /> {formattedTime}
                        </span>
                        <span>Materials: {bill.items.length}</span>
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
                          onClick={() => (isPayingThis ? setPayingBillId(null) : handleInitiatePay(bill))}
                          className="h-8 text-xs font-semibold px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs cursor-pointer"
                        >
                          {isPayingThis ? 'Close' : 'Pay Bill'}
                        </Button>

                        <button
                          type="button"
                          onClick={() => setExpandedBillId(isExpanded ? null : bill.id)}
                          className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-500 transition-colors cursor-pointer"
                          title="View Materials Breakdown"
                        >
                          {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Inline Payment Form with elevated z-index so calendar popover floats above all content */}
                  {isPayingThis && (
                    <div className="mt-3.5 pt-3 border-t border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 rounded-xl space-y-3 overflow-visible relative z-30">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                        <CreditCard className="size-4" />
                        Settle Payment for Invoice #{bill.invoiceNumber}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 items-end gap-2.5 w-full overflow-visible relative z-40">
                        <div className="w-full space-y-1">
                          <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-300 block whitespace-nowrap">
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
                          <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-300 block whitespace-nowrap">
                            Payment Date & Time *
                          </label>
                          <DateTimePicker
                            value={payDate}
                            onChange={setPayDate}
                            className="h-9 w-full"
                          />
                        </div>

                        <div className="w-full space-y-1 relative z-40">
                          <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-300 block whitespace-nowrap">
                            Payment Method *
                          </label>
                          <SearchableSelect
                            value={payMethod}
                            onValueChange={(val) => setPayMethod(val)}
                            options={[
                              {
                                value: 'CASH',
                                label: 'Cash',
                                icon: <Banknote className="size-3.5 text-emerald-500" />,
                              },
                              {
                                value: 'CARD',
                                label: 'Card',
                                icon: <CreditCard className="size-3.5 text-blue-500" />,
                              },
                              {
                                value: 'BANK_TRANSFER',
                                label: 'Bank T',
                                icon: <Landmark className="size-3.5 text-indigo-500" />,
                              },
                              {
                                value: 'CHEQUE',
                                label: 'Cheque',
                                icon: <FileText className="size-3.5 text-amber-500" />,
                              },
                            ]}
                            placeholder="Select Method"
                            searchPlaceholder="Search method..."
                            dark={dark}
                            className="h-9 py-0 rounded-lg text-xs w-full"
                          />
                        </div>

                        <div className="w-full space-y-1">
                          <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-300 block whitespace-nowrap">
                            Reference / Note
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

                      <div className="flex items-center justify-between pt-1">
                        <div className="text-[10px] text-slate-500">
                          Remaining Due: <strong className="font-mono">
                            Rs. {Math.max(0, bill.dueAmount - (parseFloat(payAmount) || 0)).toFixed(2)}
                          </strong>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setPayingBillId(null)}
                            className="h-7 text-xs cursor-pointer"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={isSubmitting}
                            onClick={() => handleSettleSubmit(bill)}
                            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1 cursor-pointer"
                          >
                            {isSubmitting ? <Loader2 className="size-3 animate-spin" /> : <Banknote className="size-3" />}
                            {isSubmitting ? 'Processing...' : 'Confirm Payment'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Expanded Items Breakdown */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-zinc-800 space-y-3">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                          Received Materials ({bill.items.length})
                        </span>
                        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-950">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 dark:bg-zinc-900 text-slate-500 text-[10px] uppercase font-semibold">
                              <tr>
                                <th className="p-2">Material</th>
                                <th className="p-2">Code</th>
                                <th className="p-2 text-center">Qty</th>
                                <th className="p-2 text-right">Cost / Unit</th>
                                <th className="p-2 text-right">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                              {bill.items.map((it, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-zinc-900/50">
                                  <td className="p-2 font-medium">{it.name}</td>
                                  <td className="p-2 text-slate-500 font-mono text-[11px]">{it.code || '-'}</td>
                                  <td className="p-2 text-center font-mono">
                                    {it.quantity} {it.unit.toLowerCase()}
                                  </td>
                                  <td className="p-2 text-right font-mono">
                                    Rs. {it.pricePerUnit.toFixed(2)}
                                  </td>
                                  <td className="p-2 text-right font-mono font-bold">
                                    Rs. {it.rowTotal.toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* ⭐ Payment Ledger History (Customer Modal එකේ ආකාරයටම Installments පෙන්වීම) */}
                      {bill.paymentHistory && bill.paymentHistory.length > 0 && (
                        <div className="pt-2">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">
                            Payment Ledger History ({bill.paymentHistory.length})
                          </span>
                          <div className="space-y-1.5">
                            {bill.paymentHistory.map((ph: any, pIdx: number) => {
                              const pDate = new Date(ph.createdAt);
                              const fDate = `${pDate.getFullYear()}-${String(pDate.getMonth() + 1).padStart(2, '0')}-${String(pDate.getDate()).padStart(2, '0')}`;
                              const fTime = pDate.toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true,
                              });

                              return (
                                <div
                                  key={ph.id || pIdx}
                                  className="flex items-center justify-between text-[11px] p-2 rounded-xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 shadow-2xs group hover:border-slate-300 dark:hover:border-zinc-700 transition-colors"
                                >
                                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                                    <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                      Rs. {Number(ph.amount).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-[9px] font-semibold">
                                      {ph.method}
                                    </span>
                                    {ph.reference && (
                                      <span className="text-slate-400 text-[10px] truncate max-w-[140px] sm:max-w-[200px]" title={ph.reference}>
                                        ({ph.reference})
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400 font-mono text-[11px]">
                                      <span>{fDate}</span>
                                      <span className="text-slate-400 text-[10px] hidden sm:inline">{fTime}</span>
                                    </div>
                                    {/* Action Buttons: Edit & Delete (Void) */}
                                    <div className="flex items-center gap-1 ml-1 border-l border-slate-200 dark:border-zinc-800 pl-1.5">
                                      <button
                                        type="button"
                                        onClick={() => handleInitiateEditPayment(ph, bill.id)}
                                        className="p-1 rounded text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer"
                                        title="Edit Payment"
                                      >
                                        <Pencil className="size-3" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setDeletingPayment(ph);
                                          setDeletingBillId(bill.id);
                                        }}
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

          {/* Edit Supplier Payment Modal */}
          <Dialog open={!!editingPayment} onOpenChange={(open) => !open && setEditingPayment(null)}>
            <DialogContent className="w-[90vw] sm:max-w-md bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-3xl p-5 shadow-2xl z-[80] overflow-visible">
              <DialogHeader className="pb-2 border-b border-slate-100 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <Pencil className="size-4 text-amber-600 dark:text-amber-400" />
                  <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">
                    Edit Supplier Payment Record
                  </DialogTitle>
                </div>
                <DialogDescription className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Update payment amount, date, or cheque reference with debt reconciliation.
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
                    options={[
                      { value: 'CASH', label: 'Cash', icon: <Banknote className="size-3.5 text-emerald-500" /> },
                      { value: 'CARD', label: 'Credit/Debit Card', icon: <CreditCard className="size-3.5 text-blue-500" /> },
                      { value: 'BANK_TRANSFER', label: 'Bank Transfer', icon: <Landmark className="size-3.5 text-indigo-500" /> },
                      { value: 'CHEQUE', label: 'Cheque', icon: <FileText className="size-3.5 text-amber-500" /> },
                    ]}
                    placeholder="Select Method"
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
                    onClick={() => {
                      setEditingPayment(null);
                      setEditingBillId(null);
                    }}
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
                    Void Payment &amp; Restore Due Debt
                  </DialogTitle>
                </div>
                <DialogDescription className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                  Are you sure you want to void this supplier payment record?
                </DialogDescription>
              </DialogHeader>

              {deletingPayment && (
                <div className="py-3 space-y-2 text-xs">
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 space-y-1">
                    <div className="flex justify-between font-medium text-rose-900 dark:text-rose-200">
                      <span>Voiding Amount:</span>
                      <strong className="font-mono text-rose-700 dark:text-rose-300">
                        Rs. {Number(deletingPayment.amount).toFixed(2)}
                      </strong>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500 dark:text-zinc-400">
                      <span>Method:</span>
                      <span>{deletingPayment.method}</span>
                    </div>
                    {deletingPayment.reference && (
                      <div className="flex justify-between text-[11px] text-slate-500 dark:text-zinc-400">
                        <span>Reference:</span>
                        <span className="font-mono">{deletingPayment.reference}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                    Voiding this payment will decrement the GRN note's paid amount and add{' '}
                    <strong className="text-rose-600 font-mono">Rs. {Number(deletingPayment.amount).toFixed(2)}</strong> back to the supplier's due debt balance.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDeletingPayment(null);
                    setDeletingBillId(null);
                  }}
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
            Total Pending GRN Notes: <strong className="text-slate-800 dark:text-zinc-200">{bills.length}</strong>
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