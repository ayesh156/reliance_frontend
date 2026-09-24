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
  AlertCircle,
  Loader2,
  DollarSign,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Banknote,
  FileText,
  Landmark, // Bank Transfer icon
} from 'lucide-react';
// Enterprise Shadcn SearchableSelect Component
import { SearchableSelect } from '../ui/SearchableSelect';
import { useTheme } from '../../contexts/ThemeContext';

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

interface CustomerDueSettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: number | null;
  customerName?: string;
  onPaymentSuccess?: () => void;
}

export const CustomerDueSettlementModal: React.FC<CustomerDueSettlementModalProps> = ({
  isOpen,
  onClose,
  customerId,
  customerName,
  onPaymentSuccess,
}) => {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [loading, setLoading] = useState(false);
  const [bills, setBills] = useState<DueBill[]>([]);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [expandedBillId, setExpandedBillId] = useState<number | null>(null);

  // ගෙවීම් ආකෘතියේ State (Payment Processing State)
  const [payingOrderId, setPayingOrderId] = useState<number | null>(null);
  const [payAmount, setPayAmount] = useState<string>('');
  const [payMethod, setPayMethod] = useState<string>('CASH');
  const [payReference, setPayReference] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // බිල්පත් දත්ත backend එකෙන් ලබා ගැනීම
  const fetchDueBills = async () => {
    if (!customerId) return;
    setLoading(true);
    try {
      const res = await get<{
        success: boolean;
        customer: { outstandingBalance: number; computedTotalDue: number };
        bills: DueBill[];
      }>(`/credit/customers/${customerId}/due-bills`);

      if (res && res.bills) {
        setBills(res.bills);
        setTotalOutstanding(res.customer.computedTotalDue || 0);
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
    }
  }, [isOpen, customerId]);

  // ගෙවීම් Form එක විවෘත කිරීම
  const handleInitiatePay = (bill: DueBill) => {
    setPayingOrderId(bill.orderId);
    setPayAmount(bill.dueAmount.toFixed(2)); // Default ලෙස සම්පූර්ණ හිඟ මුදල සටහන් වේ
    setPayMethod('CASH');
    setPayReference('');
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
      await post('/credit/settle-bill', {
        orderId: bill.orderId,
        amount: numericAmount,
        paymentMethod: payMethod,
        reference: payReference,
      });

      toast.success(`Payment of Rs. ${numericAmount.toFixed(2)} settled successfully!`);
      setPayingOrderId(null);
      setPayAmount('');
      
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:max-w-3xl md:max-w-4xl max-h-[90vh] flex flex-col bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-3xl p-4 sm:p-6 shadow-2xl">
        {/* Header */}
        <DialogHeader className="pb-3 border-b shrink-0 border-slate-100 dark:border-zinc-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Receipt className="size-5 text-emerald-500" />
                <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  {customerName ? `${customerName} - Pending Invoices` : 'Customer Due Invoices'}
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Review bill dates, item breakdown, and settle dues individually.
              </DialogDescription>
            </div>
            <div className="text-right bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 px-3 py-1.5 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400 block leading-tight">
                Total Due
              </span>
              <span className="text-sm sm:text-base font-extrabold font-mono text-rose-700 dark:text-rose-300">
                Rs. {totalOutstanding.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
              </span>
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
                මෙම ගනුදෙනුකරුගේ සියලුම බිල්පත් සම්පූර්ණයෙන්ම ගෙවා අවසන් කර ඇත.
              </p>
            </div>
          ) : (
            bills.map((bill) => {
              const billDate = new Date(bill.createdAt);
              const formattedDate = billDate.toLocaleDateString('en-GB', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              });
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
                  className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/40 p-3.5 sm:p-4 transition-all shadow-xs hover:border-slate-300 dark:hover:border-zinc-700"
                >
                  {/* Top Bar of Bill Card */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400">
                          {bill.invoiceNumber}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                          {bill.source}
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

                  {/* Inline Payment Form (If initiated) */}
                  {isPayingThis && (
                    <div className="mt-3.5 pt-3 border-t border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 rounded-xl space-y-3">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                        <DollarSign className="size-4" />
                        Settle Payment for Invoice #{bill.invoiceNumber}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-300">
                            Paying Amount (Rs.) *
                          </label>
                          <Input
                            type="number"
                            step="0.01"
                            max={bill.dueAmount}
                            value={payAmount}
                            onChange={(e) => setPayAmount(e.target.value)}
                            placeholder="0.00"
                            className="h-8 text-xs font-mono font-bold bg-white dark:bg-zinc-900"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-300">
                            Payment Method *
                          </label>
                          {/* Modern Shadcn SearchableSelect integration with icons */}
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
                                label: 'Credit/Debit Card',
                                icon: <CreditCard className="size-3.5 text-blue-500" />,
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
                            placeholder="Select Payment Method"
                            searchPlaceholder="Search method..."
                            dark={dark}
                            className="h-8 py-0 rounded-md"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-300">
                            Reference / Note
                          </label>
                          <Input
                            type="text"
                            value={payReference}
                            onChange={(e) => setPayReference(e.target.value)}
                            placeholder="Cheque No / Slip No"
                            className="h-8 text-xs bg-white dark:bg-zinc-900"
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
                            onClick={() => setPayingOrderId(null)}
                            className="h-7 text-xs"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={isSubmitting}
                            onClick={() => handleSettleSubmit(bill)}
                            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                          >
                            {isSubmitting ? <Loader2 className="size-3 animate-spin" /> : <Banknote className="size-3" />}
                            {isSubmitting ? 'Processing...' : 'Confirm Payment'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-zinc-800 space-y-3">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                          Invoice Items ({bill.items.length})
                        </span>
                        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-950">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 dark:bg-zinc-900 text-slate-500 text-[10px] uppercase font-semibold">
                              <tr>
                                <th className="p-2">Item</th>
                                <th className="p-2">Size / Color</th>
                                <th className="p-2 text-center">Qty</th>
                                <th className="p-2 text-right">Price</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                              {bill.items.map((it, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-zinc-900/50">
                                  <td className="p-2 font-medium">{it.name}</td>
                                  <td className="p-2 text-slate-500">
                                    {it.size || 'FREE'} {it.color ? `/ ${it.color}` : ''}
                                  </td>
                                  <td className="p-2 text-center font-mono">{it.quantity}</td>
                                  <td className="p-2 text-right font-mono font-medium">
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
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                            Payment Ledger History ({bill.paymentHistory.length})
                          </span>
                          <div className="space-y-1">
                            {bill.paymentHistory.map((ph) => (
                              <div
                                key={ph.id}
                                className="flex items-center justify-between text-[11px] p-2 rounded-lg bg-white dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800"
                              >
                                <div className="flex items-center gap-2">
                                  <CheckCircle2 className="size-3 text-emerald-500" />
                                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                    රු. {ph.amount.toFixed(2)}
                                  </span>
                                  <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-zinc-800 text-[9px] font-semibold">
                                    {ph.method}
                                  </span>
                                  {ph.reference && (
                                    <span className="text-slate-400 text-[10px]">({ph.reference})</span>
                                  )}
                                </div>
                                <span className="text-slate-400 text-[10px] font-mono">
                                  {new Date(ph.createdAt).toLocaleDateString('en-GB')} {new Date(ph.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            ))}
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