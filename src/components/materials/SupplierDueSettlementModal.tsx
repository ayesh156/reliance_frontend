import React, { useState, useEffect } from 'react';
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
import { DateTimePicker } from '../ui/DateTimePicker'; // ⭐ Import new DateTimePicker
import { get, post } from '../../lib/api';
import { toast } from 'react-toastify';
import {
  Loader2,
  Wallet,
  ReceiptText,
  Building2,
  CreditCard,
  Banknote,
  CheckCircle2,
} from 'lucide-react';
import type { RawMaterialShop } from '../../pages/RawMaterialShopsPage';

interface PendingPurchase {
  id: number;
  invoiceNumber: string | null;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: string;
  purchaseDate: string;
}

interface SupplierDueSettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  shop: RawMaterialShop | null;
  onSuccess: () => void;
}

/**
 * Supplier Outstanding Due Settlement Modal
 * Enables settling general credit balance or linking specific unpaid raw material purchases
 */
export const SupplierDueSettlementModal: React.FC<SupplierDueSettlementModalProps> = ({
  isOpen,
  onClose,
  shop,
  onSuccess,
}) => {
  const [pendingBills, setPendingBills] = useState<PendingPurchase[]>([]);
  const [loadingBills, setLoadingBills] = useState<boolean>(false);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<number | null>(null);

  // Helper function to get current local datetime in ISO format (YYYY-MM-DDTHH:mm)
  const getCurrentLocalISOString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const [amount, setAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [reference, setReference] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(getCurrentLocalISOString());
  const [submitting, setSubmitting] = useState<boolean>(false);

  // ⭐ Modal open zalyavar payment date ani time tya kshanachya current time ne update karne
  useEffect(() => {
    if (isOpen && shop) {
      fetchPendingInvoices(shop.id);
      setSelectedPurchaseId(null);
      setAmount('');
      setReference('');
      setPaymentMethod('CASH');
      setPaymentDate(getCurrentLocalISOString()); // Current local timestamp
    }
  }, [isOpen, shop]);

  const fetchPendingInvoices = async (shopId: number) => {
    try {
      setLoadingBills(true);
      const data = await get<PendingPurchase[]>(`/raw-material-shops/${shopId}/pending-invoices`);
      setPendingBills(Array.isArray(data) ? data : []);
    } catch {
      setPendingBills([]);
    } finally {
      setLoadingBills(false);
    }
  };

  if (!shop) return null;

  // Selected bill balance
  const activeBill = pendingBills.find((b) => b.id === selectedPurchaseId);
  const maxPayable = activeBill
    ? Math.max(0, activeBill.totalAmount - activeBill.paidAmount)
    : shop.creditBalance;

  const handleSelectBill = (bill: PendingPurchase) => {
    if (selectedPurchaseId === bill.id) {
      setSelectedPurchaseId(null);
      setAmount('');
    } else {
      setSelectedPurchaseId(bill.id);
      const due = Math.max(0, bill.totalAmount - bill.paidAmount);
      setAmount(due > 0 ? due.toString() : '');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payNum = parseFloat(amount);

    if (isNaN(payNum) || payNum <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }

    if (activeBill && payNum > maxPayable) {
      toast.error(`Amount cannot exceed the remaining bill balance of Rs. ${maxPayable.toLocaleString()}`);
      return;
    }

    try {
      setSubmitting(true);
      await post('/raw-material-shops/settle-due', {
        shopId: shop.id,
        purchaseId: selectedPurchaseId || undefined,
        amount: payNum,
        paymentMethod,
        reference: reference.trim() || undefined,
        paymentDate: paymentDate ? new Date(paymentDate).toISOString() : new Date().toISOString(),
      });

      toast.success(`Payment of Rs. ${payNum.toLocaleString()} recorded successfully`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record supplier payment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Wallet className="size-5 text-emerald-600" />
            <DialogTitle>Settle Supplier Due Balance</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Supplier: <strong className="text-slate-900 dark:text-white">{shop.name}</strong> | Total Outstanding Due:{' '}
            <strong className="text-rose-600 font-mono">Rs. {Number(shop.creditBalance).toLocaleString()}</strong>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5 py-1">
          {/* Pending Invoices Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 flex items-center justify-between">
              <span>Select Pending Purchase Invoice (Optional)</span>
              {loadingBills && <Loader2 className="size-3 animate-spin text-slate-400" />}
            </label>

            {pendingBills.length > 0 ? (
              <div className="max-h-32 overflow-y-auto space-y-1.5 border border-slate-200 dark:border-zinc-800 rounded-xl p-1.5 bg-slate-50/50 dark:bg-zinc-900/40">
                {pendingBills.map((bill) => {
                  const billDue = bill.totalAmount - bill.paidAmount;
                  const isSelected = selectedPurchaseId === bill.id;
                  return (
                    <div
                      key={bill.id}
                      onClick={() => handleSelectBill(bill)}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs transition-colors ${
                        isSelected
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-300 dark:border-indigo-700'
                          : 'bg-white dark:bg-zinc-800/80 hover:bg-slate-100 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <ReceiptText className="size-3.5 text-slate-400" />
                        <div>
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {bill.invoiceNumber || `Bill #${bill.id}`}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            {new Date(bill.purchaseDate).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-rose-600 block">
                          Due: Rs. {billDue.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Total: Rs. {bill.totalAmount.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-[11px] text-slate-500">
                No specific unpaid purchase bills found. Amount will be deducted from general account credit balance.
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Payment Amount (Rs.) *
              </label>
              <Input
                type="number"
                step="0.01"
                required
                max={maxPayable > 0 ? maxPayable : undefined}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="h-9 font-mono font-bold text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Payment Method *
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full h-9 rounded-md border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 text-xs"
              >
                <option value="CASH">CASH</option>
                <option value="BANK_TRANSFER">BANK TRANSFER</option>
                <option value="CHEQUE">CHEQUE</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
              Payment Date & Timestamp *
            </label>
            {/* ⭐ Unified Custom DatePicker + Shadcn Time Input */}
            <DateTimePicker
              value={paymentDate}
              onChange={setPaymentDate}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
              Reference / Cheque No / Slip No
            </label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. Cheque #004523 or Bank Transfer Ref"
              className="h-9 text-xs"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {submitting && <Loader2 className="size-3.5 animate-spin mr-1" />}
              Confirm Payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};