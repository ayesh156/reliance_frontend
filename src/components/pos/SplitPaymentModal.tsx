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
import { DateTimePicker } from '../ui/date-time-picker';
import { SearchableSelect } from '../ui/searchable-select';
import { useTheme } from '../../contexts/ThemeContext';
import {
  Banknote,
  FileText,
  Landmark,
  CreditCard,
  Plus,
  Trash2,
  CheckCircle2,
  Sparkles,
  Layers,
  Pencil,
} from 'lucide-react';
import { toast } from 'react-toastify';

export type SplitMethod = 'CASH' | 'CHEQUE' | 'BANK_TRANSFER' | 'CARD';

export interface SplitPaymentItem {
  id: string;
  method: SplitMethod;
  amount: string;
  date: string; // ISO DateTime string: YYYY-MM-DDTHH:mm or YYYY-MM-DD
  chequeNumber?: string;
  bankName?: string;
  reference?: string;
}

interface SplitPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalBill: number;
  initialSplits?: SplitPaymentItem[];
  onApply: (splits: SplitPaymentItem[]) => void;
  dark?: boolean;
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

const METHOD_OPTIONS: {
  value: SplitMethod;
  label: string;
  icon: React.FC<{ className?: string }>;
  color: string;
  bgColor: string;
  borderBadge: string;
}[] = [
  {
    value: 'CASH',
    label: 'Cash',
    icon: Banknote,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    borderBadge: 'border-emerald-300 dark:border-emerald-800',
  },
  {
    value: 'CHEQUE',
    label: 'Cheque',
    icon: FileText,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    borderBadge: 'border-amber-300 dark:border-amber-800',
  },
  {
    value: 'BANK_TRANSFER',
    label: 'Bank T',
    icon: Landmark,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
    borderBadge: 'border-blue-300 dark:border-blue-800',
  },
  {
    value: 'CARD',
    label: 'Card',
    icon: CreditCard,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-500/10 text-purple-700 dark:text-purple-300',
    borderBadge: 'border-purple-300 dark:border-purple-800',
  },
];

export const SplitPaymentModal: React.FC<SplitPaymentModalProps> = ({
  open,
  onOpenChange,
  totalBill,
  initialSplits,
  onApply,
}) => {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [splits, setSplits] = useState<SplitPaymentItem[]>([]);

  const nowDateTimeStr = useMemo(() => getCurrentLocalISOString(), [open]);

  // Single Add Entry Form state (one unified entry bar)
  const [entryMethod, setEntryMethod] = useState<SplitMethod>('CASH');
  const [entryAmount, setEntryAmount] = useState<string>('');
  const [entryDate, setEntryDate] = useState<string>(nowDateTimeStr);
  const [entryChequeNumber, setEntryChequeNumber] = useState<string>('');
  const [entryBankName, setEntryBankName] = useState<string>('');
  const [entryReference, setEntryReference] = useState<string>('');

  // Editing split state
  const [editingSplit, setEditingSplit] = useState<SplitPaymentItem | null>(null);
  const [editAmount, setEditAmount] = useState<string>('');
  const [editMethod, setEditMethod] = useState<SplitMethod>('CASH');
  const [editDate, setEditDate] = useState<string>(nowDateTimeStr);
  const [editChequeNumber, setEditChequeNumber] = useState<string>('');
  const [editBankName, setEditBankName] = useState<string>('');
  const [editReference, setEditReference] = useState<string>('');

  // Initialize or reset splits state when modal opens
  useEffect(() => {
    if (open) {
      const currentNow = getCurrentLocalISOString();
      if (initialSplits && initialSplits.length > 0) {
        setSplits(
          initialSplits.map((s, idx) => ({
            ...s,
            id: s.id || `split-${idx + 1}-${Date.now()}`,
            date: s.date || currentNow,
            amount: s.amount !== undefined ? String(s.amount) : '',
          }))
        );
      } else {
        setSplits([]);
      }

      // Reset entry form
      setEntryMethod('CASH');
      setEntryAmount(totalBill > 0 ? String(totalBill) : '');
      setEntryDate(currentNow);
      setEntryChequeNumber('');
      setEntryBankName('');
      setEntryReference('');
      setEditingSplit(null);
    }
  }, [open, initialSplits, totalBill]);

  // Live Calculations
  const totalTendered = useMemo(() => {
    return splits.reduce((sum, item) => sum + (Math.max(0, Number(item.amount)) || 0), 0);
  }, [splits]);

  const remainingDue = Math.max(0, totalBill - totalTendered);
  const excessTendered = Math.max(0, totalTendered - totalBill);

  // When splits change and entryAmount was empty or auto, update suggested amount if balance remains
  const handleFillEntryRemaining = () => {
    setEntryAmount(remainingDue > 0 ? String(remainingDue) : '0');
  };

  const handleAddPaymentEntry = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const num = parseFloat(entryAmount);
    if (isNaN(num) || num <= 0) {
      toast.error('Please enter a valid positive payment amount');
      return;
    }

    if (entryMethod === 'CHEQUE' && !entryChequeNumber.trim()) {
      toast.warn('Please enter Cheque Number');
    }

    const newSplit: SplitPaymentItem = {
      id: `split-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      method: entryMethod,
      amount: String(num),
      date: entryDate || nowDateTimeStr,
      chequeNumber: entryChequeNumber.trim() || undefined,
      bankName: entryBankName.trim() || undefined,
      reference: entryReference.trim() || undefined,
    };

    setSplits((prev) => [...prev, newSplit]);

    // Calculate new balance after adding this split
    const nextRemaining = Math.max(0, remainingDue - num);
    setEntryAmount(nextRemaining > 0 ? String(nextRemaining) : '');
    setEntryChequeNumber('');
    setEntryBankName('');
    setEntryReference('');
    toast.success(`Payment of Rs. ${num.toLocaleString()} added`);
  };

  const handleRemoveSplit = (id: string) => {
    setSplits((prev) => prev.filter((s) => s.id !== id));
    toast.info('Payment entry removed');
  };

  // Initiate Edit Modal
  const handleInitiateEdit = (item: SplitPaymentItem) => {
    setEditingSplit(item);
    setEditAmount(item.amount);
    setEditMethod(item.method);
    setEditDate(item.date || nowDateTimeStr);
    setEditChequeNumber(item.chequeNumber || '');
    setEditBankName(item.bankName || '');
    setEditReference(item.reference || '');
  };

  // Save Edit
  const handleSaveEdit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingSplit) return;
    const num = parseFloat(editAmount);
    if (isNaN(num) || num <= 0) {
      toast.error('Please enter a valid positive payment amount');
      return;
    }

    setSplits((prev) =>
      prev.map((s) =>
        s.id === editingSplit.id
          ? {
              ...s,
              method: editMethod,
              amount: String(num),
              date: editDate,
              chequeNumber: editChequeNumber.trim() || undefined,
              bankName: editBankName.trim() || undefined,
              reference: editReference.trim() || undefined,
            }
          : s
      )
    );

    setEditingSplit(null);
    toast.success('Payment entry updated successfully');
  };

  // Delete from Edit modal
  const handleDeleteFromEdit = () => {
    if (!editingSplit) return;
    handleRemoveSplit(editingSplit.id);
    setEditingSplit(null);
  };

  const handleApply = () => {
    const validSplits = splits.filter(
      (s) => Number(s.amount) > 0 || (s.method === 'CHEQUE' && s.chequeNumber?.trim())
    );

    if (validSplits.length === 0 && totalBill > 0) {
      toast.warn('Please add at least one payment entry');
      return;
    }

    // Check for missing cheque numbers
    for (const split of validSplits) {
      if (split.method === 'CHEQUE' && Number(split.amount) > 0 && !split.chequeNumber?.trim()) {
        toast.info(`Please enter Cheque Number for Rs. ${Number(split.amount).toLocaleString()}`);
      }
    }

    onApply(validSplits);
    onOpenChange(false);
    toast.success(`Split payment configuration applied (Rs. ${totalTendered.toLocaleString()} tendered)`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-3xl min-w-0 sm:min-w-[640px] p-0 overflow-hidden border border-slate-200 dark:border-zinc-800 shadow-2xl rounded-2xl bg-white dark:bg-zinc-950">
        {/* Header Bar */}
        <div className="p-5 pb-4 border-b border-slate-100 dark:border-zinc-800/80 bg-slate-50/50 dark:bg-zinc-900/40">
          <DialogHeader className="gap-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-600 flex items-center justify-center text-white shadow-sm">
                  <Layers className="size-5" />
                </div>
                <div>
                  <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    Multi-Method Split Payments
                    <Badge
                      variant="outline"
                      className="text-[10px] uppercase font-mono tracking-wider text-emerald-600 border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40"
                    >
                      POS Engine
                    </Badge>
                  </DialogTitle>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Add payments across multiple methods (Cash, Cheque, Bank Transfer, Card) with clean row tracking.
                  </p>
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* Live Financial Balance Indicator */}
          <div className="mt-4 grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-xs">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 whitespace-nowrap">
                Total Bill
              </span>
              <div className="font-mono text-base sm:text-lg font-black text-slate-900 dark:text-white whitespace-nowrap">
                Rs. {totalBill.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div className="space-y-0.5 border-x border-slate-100 dark:border-zinc-800 px-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 whitespace-nowrap">
                Total Tendered
              </span>
              <div className="font-mono text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                Rs. {totalTendered.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div className="space-y-0.5 pl-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 whitespace-nowrap">
                {excessTendered > 0 ? 'Excess (Change)' : remainingDue === 0 ? 'Settlement Status' : 'Remaining Due'}
              </span>
              <div>
                {excessTendered > 0 ? (
                  <span className="font-mono text-base sm:text-lg font-black text-blue-600 dark:text-blue-400 whitespace-nowrap">
                    + Rs. {excessTendered.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                  </span>
                ) : remainingDue === 0 && splits.length > 0 ? (
                  <div className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold text-xs sm:text-sm pt-0.5 whitespace-nowrap">
                    <CheckCircle2 className="size-4" /> Fully Balanced
                  </div>
                ) : (
                  <span className="font-mono text-base sm:text-lg font-black text-amber-600 dark:text-amber-400 whitespace-nowrap">
                    Rs. {remainingDue.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Section 1: Dedicated Add Payment Entry Form (Single clean entry area) */}
          <form
            onSubmit={handleAddPaymentEntry}
            className="p-3.5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/60 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-200 flex items-center gap-1.5 whitespace-nowrap">
                <Plus className="size-3.5 text-emerald-600" />
                Add Payment Entry
              </span>
              {remainingDue > 0 && (
                <button
                  type="button"
                  onClick={handleFillEntryRemaining}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 inline-flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-900/60 cursor-pointer whitespace-nowrap"
                >
                  <Sparkles className="size-3" /> Fill Remaining Due (Rs. {remainingDue.toLocaleString()})
                </button>
              )}
            </div>

            {/* Inputs Form Row - Structured Full-Width Responsive Flex Container */}
            <div className="w-full flex flex-wrap sm:flex-nowrap items-end gap-2.5">
              {/* Payment Method */}
              <div className="flex-1 min-w-[130px] space-y-1">
                <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-300 block whitespace-nowrap">Method *</label>
                <SearchableSelect
                  value={entryMethod}
                  onValueChange={(val) => setEntryMethod(val as SplitMethod)}
                  options={METHOD_OPTIONS.map((opt) => ({
                    value: opt.value,
                    label: opt.label,
                    icon: <opt.icon className={`size-3.5 ${opt.color}`} />,
                  }))}
                  placeholder="Select Method"
                  searchPlaceholder="Search method..."
                  dark={dark}
                  className="h-9 py-0 rounded-lg text-xs"
                />
              </div>

              {/* Amount Input */}
              <div className="flex-1 min-w-[130px] space-y-1">
                <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-300 block whitespace-nowrap">Amount (Rs.) *</label>
                <div className="relative flex items-center">
                  <span className="absolute left-2.5 text-xs font-mono font-bold text-slate-400">Rs.</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={entryAmount}
                    onChange={(e) => setEntryAmount(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddPaymentEntry(e);
                      }
                    }}
                    onFocus={(e) => e.target.select()}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    placeholder="0.00"
                    className="pl-8 h-9 font-mono font-bold text-xs text-right bg-white dark:bg-zinc-900 rounded-lg"
                  />
                </div>
              </div>

              {/* Date & Time */}
              <div className="flex-initial min-w-[210px] space-y-1">
                <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-300 block whitespace-nowrap">Date & Time *</label>
                <DateTimePicker
                  value={entryDate}
                  onChange={setEntryDate}
                  className="h-9"
                />
              </div>

              {/* Compact Square Add Action Button */}
              <div className="shrink-0">
                <Button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    handleAddPaymentEntry(e);
                  }}
                  disabled={!entryAmount || parseFloat(entryAmount) <= 0}
                  title="Add Payment Entry"
                  className="w-10 h-10 shrink-0 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white flex items-center justify-center shadow-sm cursor-pointer p-0"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Contextual Extra Fields based on Method */}
            {entryMethod === 'CHEQUE' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-amber-200/40 dark:border-amber-900/40 animate-in fade-in duration-100">
                <Input
                  type="text"
                  value={entryChequeNumber}
                  onChange={(e) => setEntryChequeNumber(e.target.value)}
                  placeholder="Cheque No (e.g. CHQ-994821) *"
                  className="h-8 text-xs font-mono bg-white dark:bg-zinc-900 rounded-xl border-amber-200 dark:border-amber-800/60"
                />
                <Input
                  type="text"
                  value={entryBankName}
                  onChange={(e) => setEntryBankName(e.target.value)}
                  placeholder="Bank / Branch (e.g. Commercial Bank - Colombo)"
                  className="h-8 text-xs bg-white dark:bg-zinc-900 rounded-xl border-amber-200 dark:border-amber-800/60"
                />
              </div>
            )}

            {entryMethod === 'BANK_TRANSFER' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-blue-200/40 dark:border-blue-900/40 animate-in fade-in duration-100">
                <Input
                  type="text"
                  value={entryBankName}
                  onChange={(e) => setEntryBankName(e.target.value)}
                  placeholder="Bank Name (e.g. Sampath Bank / HNB)"
                  className="h-8 text-xs bg-white dark:bg-zinc-900 rounded-xl border-blue-200 dark:border-blue-800/60"
                />
                <Input
                  type="text"
                  value={entryReference}
                  onChange={(e) => setEntryReference(e.target.value)}
                  placeholder="Transfer Ref / Slip No / Narration"
                  className="h-8 text-xs font-mono bg-white dark:bg-zinc-900 rounded-xl border-blue-200 dark:border-blue-800/60"
                />
              </div>
            )}

            {entryMethod === 'CARD' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-purple-200/40 dark:border-purple-900/40 animate-in fade-in duration-100">
                <Input
                  type="text"
                  value={entryReference}
                  onChange={(e) => setEntryReference(e.target.value)}
                  placeholder="Card Approval Code / POS Ref No"
                  className="h-8 text-xs font-mono bg-white dark:bg-zinc-900 rounded-xl border-purple-200 dark:border-purple-800/60"
                />
                <Input
                  type="text"
                  value={entryBankName}
                  onChange={(e) => setEntryBankName(e.target.value)}
                  placeholder="Card Type / Bank (e.g. Visa / Master)"
                  className="h-8 text-xs bg-white dark:bg-zinc-900 rounded-xl border-purple-200 dark:border-purple-800/60"
                />
              </div>
            )}

            {entryMethod === 'CASH' && (
              <div className="pt-0.5">
                <Input
                  type="text"
                  value={entryReference}
                  onChange={(e) => setEntryReference(e.target.value)}
                  placeholder="Optional reference / drawer note..."
                  className="h-7 text-[11px] bg-white dark:bg-zinc-900 rounded-xl border-slate-200 dark:border-zinc-800"
                />
              </div>
            )}
          </form>

          {/* Section 2: Applied Payment Rows List (Rendered as single-line ledger rows with Edit & Delete) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Applied Split Payments ({splits.length})
              </span>
              {splits.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSplits([])}
                  className="text-[11px] font-semibold text-rose-500 hover:text-rose-700 cursor-pointer"
                >
                  Clear All
                </button>
              )}
            </div>

            {splits.length === 0 ? (
              <div className="py-8 text-center rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 bg-slate-50/40 dark:bg-zinc-900/20">
                <Layers className="size-8 text-slate-300 dark:text-zinc-600 mx-auto mb-1.5" />
                <p className="text-xs font-semibold text-slate-600 dark:text-zinc-400">No split payments added yet</p>
                <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                  Enter payment details above and click '+ Add' to record payments.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {splits.map((s) => {
                  const mConfig = METHOD_OPTIONS.find((m) => m.value === s.method) || METHOD_OPTIONS[0];
                  const IconComp = mConfig.icon;

                  return (
                    <div
                      key={s.id}
                      className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 group hover:border-slate-300 dark:hover:border-zinc-700 transition-colors shadow-xs"
                    >
                      {/* Left: Method Badge, Amount, Details */}
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold inline-flex items-center gap-1 border ${mConfig.bgColor} ${mConfig.borderBadge}`}
                        >
                          <IconComp className="size-3" />
                          {mConfig.label}
                        </span>

                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm">
                          Rs. {Number(s.amount || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                        </span>

                        {s.chequeNumber && (
                          <span className="font-mono text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200/60 dark:border-amber-800/40">
                            #{s.chequeNumber}
                          </span>
                        )}

                        {s.bankName && (
                          <span
                            className="text-slate-500 dark:text-zinc-400 text-[11px] truncate max-w-[140px] sm:max-w-[200px]"
                            title={s.bankName}
                          >
                            ({s.bankName})
                          </span>
                        )}

                        {s.reference && !s.chequeNumber && (
                          <span
                            className="text-slate-500 dark:text-zinc-400 text-[11px] truncate max-w-[140px] sm:max-w-[200px]"
                            title={s.reference}
                          >
                            ({s.reference})
                          </span>
                        )}
                      </div>

                      {/* Right: Date, Edit & Delete Icons */}
                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className="text-slate-500 dark:text-zinc-400 text-[11px] font-mono">
                          {s.date ? s.date.replace('T', ' ') : ''}
                        </span>

                        <div className="flex items-center gap-1 border-l border-slate-200 dark:border-zinc-800 pl-2">
                          <button
                            type="button"
                            onClick={() => handleInitiateEdit(s)}
                            className="p-1 rounded text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer"
                            title="Edit Payment Entry"
                          >
                            <Pencil className="size-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRemoveSplit(s.id)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                            title="Delete Payment Entry"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <DialogFooter className="p-4 border-t border-slate-100 dark:border-zinc-800/80 bg-slate-50/50 dark:bg-zinc-900/40 flex items-center justify-between sm:justify-between">
          <div className="text-xs text-slate-500">
            {remainingDue > 0 ? (
              <span className="text-amber-600 font-semibold">
                Unallocated Due: Rs. {remainingDue.toLocaleString()}
              </span>
            ) : (
              <span className="text-emerald-600 font-semibold">
                Total Allocated: Rs. {totalTendered.toLocaleString()}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs font-semibold rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleApply}
              className="h-8 text-xs font-bold px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl shadow-sm cursor-pointer"
            >
              Apply &amp; Save ({splits.length} splits)
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      {/* Edit Payment Sub-Modal */}
      <Dialog open={!!editingSplit} onOpenChange={(open) => !open && setEditingSplit(null)}>
        <DialogContent className="w-[90vw] sm:max-w-md bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-2xl z-[80] overflow-visible">
          <DialogHeader className="pb-2 border-b border-slate-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Pencil className="size-4 text-amber-600 dark:text-amber-400" />
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">
                Edit Payment Entry
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Modify the split amount, payment method, date, or cheque details.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEdit} className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-300 block">Method *</label>
                <SearchableSelect
                  value={editMethod}
                  onValueChange={(val) => setEditMethod(val as SplitMethod)}
                  options={METHOD_OPTIONS.map((opt) => ({
                    value: opt.value,
                    label: opt.label,
                    icon: <opt.icon className={`size-3.5 ${opt.color}`} />,
                  }))}
                  placeholder="Select Method"
                  searchPlaceholder="Search method..."
                  dark={dark}
                  className="h-8 py-0 rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-300 block">Amount (Rs.) *</label>
                <div className="relative flex items-center">
                  <span className="absolute left-2.5 text-xs font-mono font-bold text-slate-400">Rs.</span>
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
                    className="pl-9 h-8 font-mono font-bold text-xs text-right bg-white dark:bg-zinc-900 rounded-xl"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-300 block">Date & Time *</label>
              <DateTimePicker
                value={editDate}
                onChange={setEditDate}
                className="h-8 text-xs font-mono rounded-xl bg-white dark:bg-zinc-900"
              />
            </div>

            {editMethod === 'CHEQUE' && (
              <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-zinc-800">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-300 block">Cheque Number *</label>
                  <Input
                    type="text"
                    value={editChequeNumber}
                    onChange={(e) => setEditChequeNumber(e.target.value)}
                    placeholder="e.g. CHQ-994821"
                    className="h-8 text-xs font-mono bg-white dark:bg-zinc-900 rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-300 block">Bank Name / Branch</label>
                  <Input
                    type="text"
                    value={editBankName}
                    onChange={(e) => setEditBankName(e.target.value)}
                    placeholder="e.g. Commercial Bank"
                    className="h-8 text-xs bg-white dark:bg-zinc-900 rounded-xl"
                  />
                </div>
              </div>
            )}

            {editMethod === 'BANK_TRANSFER' && (
              <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-zinc-800">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-300 block">Bank Name</label>
                  <Input
                    type="text"
                    value={editBankName}
                    onChange={(e) => setEditBankName(e.target.value)}
                    placeholder="e.g. Sampath Bank"
                    className="h-8 text-xs bg-white dark:bg-zinc-900 rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-300 block">Transfer Ref / Slip No</label>
                  <Input
                    type="text"
                    value={editReference}
                    onChange={(e) => setEditReference(e.target.value)}
                    placeholder="e.g. REF-88129"
                    className="h-8 text-xs font-mono bg-white dark:bg-zinc-900 rounded-xl"
                  />
                </div>
              </div>
            )}

            {editMethod === 'CARD' && (
              <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-zinc-800">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-300 block">Approval Code / Ref</label>
                  <Input
                    type="text"
                    value={editReference}
                    onChange={(e) => setEditReference(e.target.value)}
                    placeholder="e.g. AUTH-4491"
                    className="h-8 text-xs font-mono bg-white dark:bg-zinc-900 rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-300 block">Card Type / Bank</label>
                  <Input
                    type="text"
                    value={editBankName}
                    onChange={(e) => setEditBankName(e.target.value)}
                    placeholder="e.g. Visa / Master"
                    className="h-8 text-xs bg-white dark:bg-zinc-900 rounded-xl"
                  />
                </div>
              </div>
            )}

            {editMethod === 'CASH' && (
              <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-zinc-800">
                <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-300 block">Reference / Note</label>
                <Input
                  type="text"
                  value={editReference}
                  onChange={(e) => setEditReference(e.target.value)}
                  placeholder="Optional reference note"
                  className="h-8 text-xs bg-white dark:bg-zinc-900 rounded-xl"
                />
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-zinc-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDeleteFromEdit}
                className="h-8 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-200 dark:border-rose-900 rounded-xl gap-1"
              >
                <Trash2 className="size-3.5" /> Delete
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingSplit(null)}
                  className="h-8 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="h-8 text-xs font-bold px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm cursor-pointer"
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};
