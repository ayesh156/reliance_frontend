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
import { Badge } from '../ui/badge';
import { get } from '../../lib/api';
import {
  User,
  Phone,
  MapPin,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  MessageSquare,
  FileText,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import { openWhatsAppChat } from '../../utils/whatsapp';

export interface CustomerPreviewModalProps {
  open: boolean;
  onClose: () => void;
  customer?: any | null;
  customerId?: number | string | null;
  onOpenHistory?: (customer: any) => void;
}

/**
 * CustomerPreviewModal Component
 * Provides an instant, non-intrusive popup showing key customer metrics:
 * Credit Limit, Outstanding Balance, Available Credit, Contact, and Location
 * without navigating away from the current page.
 */
export const CustomerPreviewModal: React.FC<CustomerPreviewModalProps> = ({
  open,
  onClose,
  customer: initialCustomer,
  customerId,
  onOpenHistory,
}) => {
  const [customer, setCustomer] = useState<any | null>(initialCustomer || null);
  const [loading, setLoading] = useState<boolean>(false);

  const targetId = customerId || initialCustomer?.id || initialCustomer?.customerId;

  useEffect(() => {
    if (open) {
      if (initialCustomer) {
        setCustomer(initialCustomer);
      }
      if (targetId) {
        setLoading(true);
        get<any>(`/customers/${targetId}`)
          .then((res) => {
            const data = res?.customer || res;
            if (data && typeof data === 'object') {
              setCustomer((prev: any) => ({ ...prev, ...data }));
            }
          })
          .catch((err) => {
            console.warn('[CustomerPreviewModal] Could not fetch fresh customer data:', err);
          })
          .finally(() => {
            setLoading(false);
          });
      }
    } else {
      setCustomer(null);
    }
  }, [open, targetId, initialCustomer]);

  if (!open) return null;

  const name = customer?.name || initialCustomer?.customerName || 'Customer';
  const phone = customer?.phone || initialCustomer?.customerPhone || '';
  const city = customer?.city || initialCustomer?.city || '';
  const address = customer?.address || initialCustomer?.address || '';
  const nic = customer?.nic || '';
  const type = customer?.type || (customer?.isWholesale ? 'WHOLESALE' : 'RETAIL');
  const outstandingBalance = Number(customer?.outstandingBalance ?? initialCustomer?.outstandingBalance ?? 0);
  const creditLimit = Number(customer?.creditLimit ?? initialCustomer?.creditLimit ?? 0);
  const availableCredit = Math.max(0, creditLimit - outstandingBalance);
  const utilizationRatio = creditLimit > 0 ? Math.min(100, Math.round((outstandingBalance / creditLimit) * 100)) : 0;
  const isOverLimit = creditLimit > 0 && outstandingBalance > creditLimit;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="w-full max-w-md p-0 overflow-hidden rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xl bg-white dark:bg-zinc-900">
        {/* Header */}
        <DialogHeader className="p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-zinc-800/80 bg-slate-50/50 dark:bg-zinc-900/50">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 shrink-0">
                <User className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                  {name}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-2 mt-0.5">
                  <span>Customer #{targetId || '-'}</span>
                  <span>•</span>
                  <Badge variant="outline" className="text-[10px] font-semibold uppercase px-1.5 py-0">
                    {type}
                  </Badge>
                </DialogDescription>
              </div>
            </div>
            {loading && <Loader2 className="size-4 animate-spin text-slate-400" />}
          </div>
        </DialogHeader>

        {/* Body Content */}
        <div className="p-4 sm:p-5 space-y-4">
          {/* Credit & Financial Status Cards */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Outstanding Balance */}
            <div className="p-3 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-950/60">
              <span className="text-[10.5px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block">
                Outstanding Balance
              </span>
              <p
                className={`text-lg font-bold font-mono mt-0.5 ${
                  outstandingBalance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                Rs. {outstandingBalance.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {outstandingBalance > 0 ? 'Pending credit due' : 'Ledger settled'}
              </span>
            </div>

            {/* Credit Limit */}
            <div className="p-3 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-950/60">
              <span className="text-[10.5px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block">
                Credit Limit
              </span>
              <p className="text-lg font-bold font-mono text-slate-900 dark:text-white mt-0.5">
                {creditLimit > 0
                  ? `Rs. ${creditLimit.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : 'No Limit Set'}
              </p>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {creditLimit > 0 ? `Available: Rs. ${availableCredit.toLocaleString()}` : 'Default terms'}
              </span>
            </div>
          </div>

          {/* Credit Utilization Bar (if credit limit is set) */}
          {creditLimit > 0 && (
            <div className="space-y-1.5 p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-850/50 border border-slate-100 dark:border-zinc-800 text-xs">
              <div className="flex items-center justify-between text-[11px] font-medium">
                <span className="text-slate-500 dark:text-zinc-400">Credit Utilization</span>
                <span
                  className={`font-mono font-bold ${
                    isOverLimit
                      ? 'text-rose-600 dark:text-rose-400'
                      : utilizationRatio > 80
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-slate-700 dark:text-zinc-300'
                  }`}
                >
                  {utilizationRatio}% {isOverLimit && '(LIMIT EXCEEDED)'}
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-zinc-700 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    isOverLimit
                      ? 'bg-rose-600'
                      : utilizationRatio > 80
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, utilizationRatio)}%` }}
                />
              </div>
            </div>
          )}

          {/* Contact & Location Details */}
          <div className="space-y-2 text-xs border border-slate-100 dark:border-zinc-800 rounded-xl p-3 bg-white dark:bg-zinc-900">
            {phone && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-600 dark:text-zinc-400">
                  <Phone className="size-3.5 text-slate-400 shrink-0" />
                  <span className="font-mono font-medium text-slate-900 dark:text-zinc-100">{phone}</span>
                </div>
                <button
                  type="button"
                  onClick={() => openWhatsAppChat(phone, `Hello ${name}, this is from Reliance Clothing regarding your account.`)}
                  className="px-2 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 font-semibold text-[10.5px] flex items-center gap-1 transition-colors"
                >
                  <MessageSquare className="size-3" />
                  <span>WhatsApp</span>
                </button>
              </div>
            )}

            {(city || address) && (
              <div className="flex items-start gap-2 text-slate-600 dark:text-zinc-400">
                <MapPin className="size-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span>{[address, city].filter(Boolean).join(', ')}</span>
              </div>
            )}

            {nic && (
              <div className="flex items-center gap-2 text-slate-600 dark:text-zinc-400">
                <CreditCard className="size-3.5 text-slate-400 shrink-0" />
                <span className="font-mono">NIC: {nic}</span>
              </div>
            )}

            {customer?.notes && (
              <div className="pt-2 border-t border-slate-100 dark:border-zinc-800/80 text-[11px] text-slate-500 italic">
                "{customer.notes}"
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-3 sm:p-4 bg-slate-50/50 dark:bg-zinc-900/50 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between gap-2">
          {onOpenHistory && targetId ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onClose();
                onOpenHistory(customer || { id: targetId, name, phone });
              }}
              className="text-xs gap-1.5"
            >
              <FileText className="size-3.5 text-blue-600" />
              <span>Full Billing History</span>
            </Button>
          ) : <div />}
          <Button type="button" variant="ghost" size="sm" onClick={onClose} className="text-xs">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerPreviewModal;

