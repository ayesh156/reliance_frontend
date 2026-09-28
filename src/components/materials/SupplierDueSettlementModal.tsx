import React, { useState, useEffect } from 'react';
import { get, post } from '../../lib/api';
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
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [loading, setLoading] = useState(false);
  const [bills, setBills] = useState<DuePurchaseBill[]>([]);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [expandedBillId, setExpandedBillId] = useState<number | null>(null);

  // Payment Processing States
  const [payingBillId, setPayingBillId] = useState<number | null>(null);
  const [payAmount, setPayAmount] = useState<string>('');
  const [payMethod, setPayMethod] = useState<string>('CASH');
  const [payReference, setPayReference] = useState<string>('');

  // ⭐ Calendar Date පමණක් තෝරා ගැනීමේ State එක (වේලාව ස්වයංක්‍රීයව එක්වේ)
  const [payDate, setPayDate] = useState<Date | undefined>(new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    }
  }, [isOpen, shop]);

  // Pay Form එක විවෘත කිරීම (Reset to Current Date)
  const handleInitiatePay = (bill: DuePurchaseBill) => {
    setPayingBillId(bill.id);
    setPayAmount(bill.dueAmount.toFixed(2));
    setPayMethod('CASH');
    setPayReference('');
    setPayDate(new Date());
  };

  // Payment Submit කිරීම
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
      // ⭐ තෝරාගත් දිනය සමඟ සැබෑ වත්මන් වේලාව (Hours, Minutes, Seconds) ස්වයංක්‍රීයව එක් කිරීම
      let resolvedPaymentDateTime = new Date();
      if (payDate) {
        resolvedPaymentDateTime = new Date(payDate);
        const now = new Date();
        resolvedPaymentDateTime.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
      }

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
      <DialogContent className="w-[95vw] sm:max-w-3xl md:max-w-4xl max-h-[90vh] flex flex-col bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-3xl p-4 sm:p-6 shadow-2xl">
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

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end overflow-visible relative z-40">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-300 block">
                            Paying Amount (Rs.) *
                          </label>
                          <Input
                            type="number"
                            step="0.01"
                            max={bill.dueAmount}
                            value={payAmount}
                            onChange={(e) => setPayAmount(e.target.value)}
                            placeholder="0.00"
                            className="h-8 text-xs font-mono font-bold bg-white dark:bg-zinc-900 rounded-xl"
                          />
                        </div>

                        <div className="space-y-1 relative z-50">
                          <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-300 block">
                            Payment Date *
                          </label>
                          <div className="relative z-50">
                            <DatePicker
                              date={payDate}
                              onDateChange={setPayDate}
                              placeholder="Select date"
                              className="h-8 text-xs rounded-xl"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-300 block">
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
                                value: 'BANK_TRANSFER',
                                label: 'Bank Transfer',
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
                            className="h-8 py-0 rounded-xl"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-300 block">
                            Reference / Note
                          </label>
                          <Input
                            type="text"
                            value={payReference}
                            onChange={(e) => setPayReference(e.target.value)}
                            placeholder="Cheque No / Slip No"
                            className="h-8 text-xs bg-white dark:bg-zinc-900 rounded-xl"
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
                                  className="flex items-center justify-between text-[11px] p-2 rounded-xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 shadow-2xs"
                                >
                                  <div className="flex items-center gap-2">
                                    <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                      Rs. {Number(ph.amount).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-[9px] font-semibold">
                                      {ph.method}
                                    </span>
                                    {ph.reference && (
                                      <span className="text-slate-400 text-[10px]">({ph.reference})</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400 font-mono text-[11px]">
                                    <span>{fDate}</span>
                                    <span className="text-slate-400 text-[10px]">{fTime}</span>
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