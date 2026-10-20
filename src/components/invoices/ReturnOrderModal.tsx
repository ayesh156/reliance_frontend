import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { SearchableSelect } from '../ui/searchable-select';
import { useTheme } from '../../contexts/ThemeContext';
import { post } from '../../lib/api';
import { toast } from 'react-toastify';
import {
  RotateCcw,
  CheckCircle2,
  History,
  Loader2,
} from 'lucide-react';

export interface ReturnOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: any | null;
  onReturnSuccess: () => void;
}

/**
 * Helper to calculate cumulative past returned quantity for a specific product variant on an invoice
 */
export const getCumulativeReturnedForVariant = (inv: any | null, variantId: number): number => {
  if (!inv || !Array.isArray(inv.returns)) return 0;
  return inv.returns.reduce((sum: number, ret: any) => {
    if (!Array.isArray(ret.returnedItems)) return sum;
    const match = ret.returnedItems.find((ri: any) => Number(ri.variantId) === Number(variantId));
    return sum + (match ? Number(match.returnQty || 0) : 0);
  }, 0);
};

export const ReturnOrderModal: React.FC<ReturnOrderModalProps> = ({
  isOpen,
  onClose,
  invoice,
  onReturnSuccess,
}) => {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';

  const [returnQuantities, setReturnQuantities] = useState<Record<number, number>>({});
  const [returnReason, setReturnReason] = useState<string>('Incorrect Size');
  const [customReturnReason, setCustomReturnReason] = useState<string>('');
  const [isProcessingReturn, setIsProcessingReturn] = useState<boolean>(false);

  // Reset state on open or invoice change
  useEffect(() => {
    if (isOpen && invoice) {
      const initialQtys: Record<number, number> = {};
      if (Array.isArray(invoice.items)) {
        invoice.items.forEach((item: any) => {
          initialQtys[item.variantId] = 0;
        });
      }
      setReturnQuantities(initialQtys);
      setReturnReason('Incorrect Size');
      setCustomReturnReason('');
    }
  }, [isOpen, invoice]);

  const updateQuantity = (variantId: number, desiredQty: number, maxQty: number) => {
    const bounded = Math.max(0, Math.min(maxQty, desiredQty));
    setReturnQuantities((prev) => ({
      ...prev,
      [variantId]: bounded,
    }));
  };

  /**
   * Live calculations banner state for return modal:
   * Original Bill Total, Total Returned Value, Adjusted Net Bill Total, and Updated Customer Due
   */
  const returnModalCalculations = useMemo(() => {
    if (!invoice) {
      return {
        originalBill: 0,
        pastReturnsTotal: 0,
        thisReturnTotal: 0,
        totalReturnedValue: 0,
        adjustedNetBillTotal: 0,
        currentBillDue: 0,
        updatedBillDue: 0,
        totalItemsToReturn: 0,
        canSubmit: false,
      };
    }

    const pastReturnsTotal = (invoice.returns || []).reduce(
      (sum: number, r: any) => sum + (Number(r.totalReturnRefund) || 0),
      0
    );

    const originalBill = invoice.originalTotalAmount !== undefined
      ? Number(invoice.originalTotalAmount)
      : Number(invoice.totalAmount) + pastReturnsTotal;

    let thisReturnTotal = 0;
    let totalItemsToReturn = 0;

    if (Array.isArray(invoice.items)) {
      invoice.items.forEach((item: any) => {
        const qty = Number(returnQuantities[item.variantId] || 0);
        if (qty > 0) {
          totalItemsToReturn += qty;
          const unitPrice = Number(item.unitPrice || (item.quantity ? item.price / item.quantity : 0));
          thisReturnTotal += qty * unitPrice;
        }
      });
    }

    thisReturnTotal = Math.round(thisReturnTotal * 100) / 100;
    const totalReturnedValue = Math.round((pastReturnsTotal + thisReturnTotal) * 100) / 100;
    const adjustedNetBillTotal = Math.max(0, Math.round((originalBill - totalReturnedValue) * 100) / 100);

    const currentBillDue = Math.max(0, Math.round((Number(invoice.totalAmount) - Number(invoice.paidAmount)) * 100) / 100);
    const dueOffset = Math.min(currentBillDue, thisReturnTotal);
    const updatedBillDue = Math.max(0, Math.round((currentBillDue - dueOffset) * 100) / 100);

    return {
      originalBill,
      pastReturnsTotal,
      thisReturnTotal,
      totalReturnedValue,
      adjustedNetBillTotal,
      currentBillDue,
      updatedBillDue,
      totalItemsToReturn,
      canSubmit: totalItemsToReturn > 0,
    };
  }, [invoice, returnQuantities]);

  const handleProcessReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) return;

    if (returnModalCalculations.totalItemsToReturn <= 0) {
      toast.error('Please enter a return quantity of at least 1 item');
      return;
    }

    const returnedItems = Object.entries(returnQuantities)
      .filter(([_, qty]) => Number(qty) > 0)
      .map(([variantIdStr, qty]) => {
        const variantId = Number(variantIdStr);
        const originalItem = (invoice.items || []).find((it: any) => Number(it.variantId) === variantId);
        const unitPrice = Number(originalItem?.unitPrice || (originalItem ? originalItem.price / originalItem.quantity : 0));
        return {
          variantId,
          productId: originalItem?.variant?.productId,
          returnQty: Number(qty),
          unitPrice,
          amount: Math.round(Number(qty) * unitPrice * 100) / 100,
        };
      });

    const finalReason = returnReason === 'Other'
      ? (customReturnReason.trim() || 'Other')
      : returnReason;

    try {
      setIsProcessingReturn(true);
      await post(`/orders/${invoice.id}/returns`, {
        returnedItems,
        reason: finalReason,
      });

      toast.success(`Return processed for Invoice #INV${invoice.id}! Stock restored to inventory.`);
      onClose();
      onReturnSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || 'Failed to process return');
    } finally {
      setIsProcessingReturn(false);
    }
  };

  if (!invoice) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full max-w-full sm:max-w-3xl lg:max-w-4xl max-h-[92vh] flex flex-col p-3 sm:p-6 rounded-2xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 shadow-2xl">
        <DialogHeader className="pb-2 border-b border-slate-100 dark:border-zinc-800 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base text-slate-900 dark:text-white font-bold">
            <RotateCcw className="size-5 text-indigo-600 dark:text-indigo-400" />
            Process Item Return &amp; Restock — #INV{invoice.id}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 dark:text-zinc-400">
            Return items back to warehouse stock and automatically reconcile invoice ledgers and customer balances.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleProcessReturnSubmit} className="flex-1 min-h-0 flex flex-col justify-between overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 py-2 pr-1 overscroll-contain">
            {/* Invoice Meta Banner */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 text-xs grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Customer</span>
                <span className="font-bold text-slate-800 dark:text-zinc-200 truncate block">
                  {invoice.customerName || 'Walk-in Customer'}
                </span>
                {invoice.customerPhone && (
                  <span className="text-[10px] font-mono text-slate-500">{invoice.customerPhone}</span>
                )}
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Date / Mode</span>
                <span className="font-semibold text-slate-800 dark:text-zinc-200 block">
                  {new Date(invoice.createdAt).toISOString().split('T')[0]}
                </span>
                <span className="text-[10px] uppercase font-bold text-slate-500">{invoice.paymentMethod}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Original Bill</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white block">
                  Rs. {returnModalCalculations.originalBill.toLocaleString()}
                </span>
                <span className="text-[10px] text-emerald-600 font-medium">
                  Paid: Rs. {Number(invoice.paidAmount).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Current Bill Due</span>
                <span className="font-mono font-bold text-rose-600 block">
                  Rs. {returnModalCalculations.currentBillDue.toLocaleString()}
                </span>
                {invoice.customer?.outstandingBalance !== undefined && (
                  <span className="text-[10px] text-slate-500">
                    Cust Total: Rs. {Number(invoice.customer.outstandingBalance).toLocaleString()}
                  </span>
                )}
              </div>
            </div>

            {/* Items Return Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-zinc-300">
                <span>Purchased Items &amp; Return Quantities:</span>
                <span className="text-[11px] text-slate-400">
                  Max quantity cannot exceed available balance
                </span>
              </div>

              {/* 1. Mobile & Tablet Touch-Friendly Cards (Viewports < 1024px) */}
              <div className="block lg:hidden space-y-2.5">
                {(invoice.items || []).map((item: any) => {
                  const variantId = Number(item.variantId);
                  const purchasedQty = Number(item.quantity || 0);
                  const alreadyReturned = getCumulativeReturnedForVariant(invoice, variantId);
                  const returnableQty = Math.max(0, purchasedQty - alreadyReturned);
                  const unitPrice = Number(item.unitPrice || (item.quantity ? item.price / item.quantity : 0));
                  const currentReturnQty = Number(returnQuantities[variantId] || 0);
                  const lineRefund = Math.round(currentReturnQty * unitPrice * 100) / 100;

                  const name = item.variant?.product?.name || item.name || 'Garment Item';
                  const size = item.size || item.selectedSize || item.variant?.size || '';
                  const color = item.color || item.selectedColor || item.variant?.color || '';
                  const sku = item.variant?.sku || '';

                  return (
                    <div
                      key={variantId}
                      className={`p-3 rounded-xl border transition-all ${
                        currentReturnQty > 0
                          ? 'bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800'
                          : 'bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800'
                      }`}
                    >
                      {/* Row 1: Garment Style Title, Variant Badge & Unit Price */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-2 border-b border-slate-100 dark:border-zinc-800">
                        <div className="space-y-1">
                          <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white block leading-tight">
                            {name}
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {(size || color) && (
                              <span className="inline-flex items-center text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
                                {[size, color].filter(Boolean).join(' · ')}
                              </span>
                            )}
                            {sku && (
                              <span className="inline-flex items-center text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400">
                                SKU: {sku}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-left sm:text-right">
                          <span className="font-mono text-xs font-semibold text-slate-700 dark:text-zinc-300">
                            @ Rs. {unitPrice.toLocaleString()}
                          </span>
                          {lineRefund > 0 && (
                            <span className="block font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                              Refund: - Rs. {lineRefund.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Row 2: Metric Pills & Quantity Return Stepper */}
                      <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        {/* Metric Badges */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-1 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                            Purchased: <strong className="font-mono text-slate-800 dark:text-zinc-200">{purchasedQty}</strong>
                          </span>
                          <span className="px-2 py-1 rounded-md text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/50">
                            Prev Returned: <strong className="font-mono">{alreadyReturned > 0 ? alreadyReturned : 0}</strong>
                          </span>
                          <span className="px-2 py-1 rounded-md text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                            Available: <strong className="font-mono">{returnableQty}</strong>
                          </span>
                        </div>

                        {/* Touch-Friendly Stepper and Return All */}
                        <div className="flex items-center gap-2 justify-between sm:justify-end">
                          <div className="inline-flex items-center border border-slate-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 p-0.5 shadow-xs">
                            <button
                              type="button"
                              disabled={returnableQty <= 0 || currentReturnQty <= 0}
                              onClick={() => updateQuantity(variantId, currentReturnQty - 1, returnableQty)}
                              className="size-8 rounded-lg flex items-center justify-center text-sm font-bold text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 active:scale-95 disabled:opacity-40 transition-all cursor-pointer"
                              aria-label="Decrease return quantity"
                            >
                              -
                            </button>
                            <Input
                              type="number"
                              min={0}
                              max={returnableQty}
                              disabled={returnableQty <= 0}
                              value={currentReturnQty || ''}
                              onChange={(e) => {
                                const parsed = parseInt(e.target.value, 10) || 0;
                                updateQuantity(variantId, parsed, returnableQty);
                              }}
                              placeholder="0"
                              className="w-14 h-8 text-center font-mono font-bold text-xs border-0 rounded-none focus-visible:ring-0 bg-transparent"
                            />
                            <button
                              type="button"
                              disabled={returnableQty <= 0 || currentReturnQty >= returnableQty}
                              onClick={() => updateQuantity(variantId, currentReturnQty + 1, returnableQty)}
                              className="size-8 rounded-lg flex items-center justify-center text-sm font-bold text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 active:scale-95 disabled:opacity-40 transition-all cursor-pointer"
                              aria-label="Increase return quantity"
                            >
                              +
                            </button>
                          </div>

                          <button
                            type="button"
                            disabled={returnableQty <= 0}
                            onClick={() => updateQuantity(variantId, currentReturnQty === returnableQty ? 0 : returnableQty, returnableQty)}
                            className={`h-8 px-2.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer active:scale-95 disabled:opacity-40 ${
                              currentReturnQty === returnableQty
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700'
                            }`}
                          >
                            Return All ({returnableQty})
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 2. Desktop Full Data Table (Strictly viewports >= 1024px) */}
              <div className="hidden lg:block border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-950">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-zinc-900/80 border-b border-slate-200 dark:border-zinc-800 text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                      <th className="py-2.5 px-3 text-left">Item / Style</th>
                      <th className="py-2.5 px-2 text-center">Purchased</th>
                      <th className="py-2.5 px-2 text-center">Returned</th>
                      <th className="py-2.5 px-2 text-center text-indigo-600">Available</th>
                      <th className="py-2.5 px-2 text-right">Unit Price</th>
                      <th className="py-2.5 px-2 text-center">Return Qty</th>
                      <th className="py-2.5 px-3 text-right">Refund Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                    {(invoice.items || []).map((item: any) => {
                      const variantId = Number(item.variantId);
                      const purchasedQty = Number(item.quantity || 0);
                      const alreadyReturned = getCumulativeReturnedForVariant(invoice, variantId);
                      const returnableQty = Math.max(0, purchasedQty - alreadyReturned);
                      const unitPrice = Number(item.unitPrice || (item.quantity ? item.price / item.quantity : 0));
                      const currentReturnQty = Number(returnQuantities[variantId] || 0);
                      const lineRefund = Math.round(currentReturnQty * unitPrice * 100) / 100;

                      const name = item.variant?.product?.name || item.name || 'Garment Item';
                      const size = item.size || item.selectedSize || item.variant?.size || '';
                      const color = item.color || item.selectedColor || item.variant?.color || '';
                      const meta = [size, color].filter(Boolean).join('/');
                      const sku = item.variant?.sku || '';

                      return (
                        <tr
                          key={variantId}
                          className={`hover:bg-slate-50/50 dark:hover:bg-zinc-900/40 transition-colors ${
                            currentReturnQty > 0 ? 'bg-indigo-50/30 dark:bg-indigo-950/20' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-800 dark:text-zinc-200">{name}</div>
                            <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2">
                              {meta && <span>Variant: {meta}</span>}
                              {sku && <span>SKU: {sku}</span>}
                            </div>
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono font-medium text-slate-600 dark:text-zinc-400">
                            {purchasedQty}
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono text-amber-600 font-medium">
                            {alreadyReturned > 0 ? alreadyReturned : '-'}
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono font-bold text-indigo-600">
                            {returnableQty}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono text-slate-700 dark:text-zinc-300">
                            Rs. {unitPrice.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <Input
                              type="number"
                              min={0}
                              max={returnableQty}
                              disabled={returnableQty <= 0}
                              value={currentReturnQty || ''}
                              onChange={(e) => {
                                const parsed = parseInt(e.target.value, 10) || 0;
                                updateQuantity(variantId, parsed, returnableQty);
                              }}
                              placeholder="0"
                              className={`w-20 h-8 mx-auto text-center font-mono font-bold text-xs ${
                                currentReturnQty > 0
                                  ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                                  : ''
                              }`}
                            />
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                            {lineRefund > 0 ? (
                              <span className="text-indigo-600">- Rs. {lineRefund.toLocaleString()}</span>
                            ) : (
                              <span className="text-slate-400">Rs. 0</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Return Reason Selection: Fluid 2 columns on ~534px tablet screens */}
            <div className="grid grid-cols-1 xs:grid-cols-2 gap-2.5 sm:gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Return Reason *
                </label>
                <SearchableSelect
                  value={returnReason}
                  onValueChange={setReturnReason}
                  options={[
                    { value: 'Incorrect Size', label: 'Incorrect Size' },
                    { value: 'Damaged / Defect', label: 'Damaged / Defective Garment' },
                    { value: 'Exchange Request', label: 'Customer Exchange Request' },
                    { value: 'Customer Request', label: 'Customer General Return' },
                    { value: 'Other', label: 'Other Reason (Specify below)' },
                  ]}
                  placeholder="Select Reason"
                  dark={dark}
                  className="h-9"
                />
              </div>

              {returnReason === 'Other' && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    Specify Reason Notes *
                  </label>
                  <Input
                    required
                    value={customReturnReason}
                    onChange={(e) => setCustomReturnReason(e.target.value)}
                    placeholder="e.g. Color mismatch or buyer canceled"
                    className="h-9 text-xs"
                  />
                </div>
              )}
            </div>

            {/* LIVE CALCULATION BANNER */}
            <div className="p-3.5 rounded-xl bg-gradient-to-br from-indigo-50 via-slate-50 to-emerald-50 dark:from-indigo-950/30 dark:via-zinc-900/50 dark:to-emerald-950/30 border border-indigo-200/80 dark:border-indigo-800/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5" />
                  Live Return Ledger Reconciliation
                </span>
                {returnModalCalculations.thisReturnTotal > 0 && (
                  <span className="text-xs font-bold font-mono text-indigo-600 bg-indigo-100 dark:bg-indigo-900/50 px-2 py-0.5 rounded-md">
                    Pending Refund: Rs. {returnModalCalculations.thisReturnTotal.toLocaleString()}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                <div className="p-2.5 rounded-lg bg-white/80 dark:bg-zinc-900/80 border border-slate-200/60 dark:border-zinc-800">
                  <span className="text-[10px] text-slate-400 block font-medium">Original Bill</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                    Rs. {returnModalCalculations.originalBill.toLocaleString()}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-white/80 dark:bg-zinc-900/80 border border-slate-200/60 dark:border-zinc-800">
                  <span className="text-[10px] text-slate-400 block font-medium">Total Return Credit</span>
                  <span className="font-mono font-bold text-indigo-600 text-sm">
                    - Rs. {returnModalCalculations.totalReturnedValue.toLocaleString()}
                  </span>
                  {returnModalCalculations.pastReturnsTotal > 0 && (
                    <span className="text-[9px] text-slate-400 block">
                      Past: Rs. {returnModalCalculations.pastReturnsTotal.toLocaleString()}
                    </span>
                  )}
                </div>

                <div className="p-2.5 rounded-lg bg-white/80 dark:bg-zinc-900/80 border border-slate-200/60 dark:border-zinc-800">
                  <span className="text-[10px] text-slate-400 block font-medium">Adjusted Net Bill</span>
                  <span className="font-mono font-bold text-emerald-600 text-sm">
                    Rs. {returnModalCalculations.adjustedNetBillTotal.toLocaleString()}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-white/80 dark:bg-zinc-900/80 border border-slate-200/60 dark:border-zinc-800">
                  <span className="text-[10px] text-slate-400 block font-medium">Updated Bill Due</span>
                  <span className="font-mono font-bold text-rose-600 text-sm">
                    Rs. {returnModalCalculations.updatedBillDue.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* HISTORICAL RETURN AUDIT LOG */}
            <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-zinc-800">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-zinc-300">
                <History className="size-3.5 text-indigo-600" />
                Historical Return Audit Log ({invoice.returns?.length || 0})
              </div>

              {Array.isArray(invoice.returns) && invoice.returns.length > 0 ? (
                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {invoice.returns.map((ret: any, idx: number) => (
                    <div
                      key={ret.returnId || idx}
                      className="p-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/40 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            #{ret.returnId}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[9px] uppercase font-bold border-indigo-400 text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40"
                          >
                            {ret.reason || 'Return'}
                          </Badge>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(ret.returnDate).toLocaleString()}
                        </span>
                      </div>

                      <div className="space-y-0.5 text-[11px] text-slate-600 dark:text-zinc-300">
                        {(ret.returnedItems || []).map((rit: any, rIdx: number) => (
                          <div key={rIdx} className="flex justify-between items-center">
                            <span>
                              • {rit.productName || 'Garment Item'}
                              {rit.variantName ? ` (${rit.variantName})` : ''}: {rit.returnQty} pcs @ Rs.{' '}
                              {Number(rit.unitPrice).toLocaleString()}
                            </span>
                            <span className="font-mono font-semibold text-indigo-600">
                              - Rs. {Number(rit.amount).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="pt-1 border-t border-slate-200/60 dark:border-zinc-800/80 flex items-center justify-between text-[10px] text-slate-500">
                        <span>
                          Recorded By: <strong className="text-slate-700 dark:text-zinc-300">{ret.recordedBy || 'Cashier'}</strong>
                        </span>
                        <div className="flex items-center gap-2 font-mono">
                          <span>Total Refund: <strong className="text-indigo-600">- Rs. {Number(ret.totalReturnRefund).toLocaleString()}</strong></span>
                          {Number(ret.creditDueAdjustment || 0) > 0 && (
                            <span>(Credit Offset: Rs. {Number(ret.creditDueAdjustment).toLocaleString()})</span>
                          )}
                          {Number(ret.cashRefundAmount || 0) > 0 && (
                            <span>(Cash Paid Back: Rs. {Number(ret.cashRefundAmount).toLocaleString()})</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 text-center text-xs text-slate-400">
                  No previous returns have been processed for this invoice.
                </div>
              )}
            </div>
          </div>

          {/* Sticky Bottom Action Bar with Summary Refund Totals */}
          <div className="sticky bottom-0 -mx-3 -mb-3 sm:-mx-6 sm:-mb-6 p-3 sm:p-4 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-t border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 z-30 shrink-0">
            <div className="flex items-center justify-between sm:justify-start gap-4">
              <div className="text-left">
                <span className="text-[10px] uppercase font-bold text-slate-400 block leading-tight">
                  Pending Refund
                </span>
                <span className="text-base sm:text-lg font-mono font-extrabold text-indigo-600 dark:text-indigo-400">
                  Rs. {returnModalCalculations.thisReturnTotal.toLocaleString()}
                </span>
              </div>
              <div className="text-left border-l border-slate-200 dark:border-zinc-800 pl-3">
                <span className="text-[10px] uppercase font-bold text-slate-400 block leading-tight">
                  Updated Bill Due
                </span>
                <span className="text-sm sm:text-base font-mono font-bold text-rose-600 dark:text-rose-400">
                  Rs. {returnModalCalculations.updatedBillDue.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                className="h-11 px-4 text-xs font-semibold rounded-xl flex-1 sm:flex-initial"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!returnModalCalculations.canSubmit || isProcessingReturn}
                className="h-11 px-5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-sm active:scale-[0.98] transition-all gap-1.5 flex-1 sm:flex-initial cursor-pointer"
              >
                {isProcessingReturn ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Restoring Inventory...
                  </>
                ) : (
                  <>
                    <RotateCcw className="size-4" /> Process Restock &amp; Refund
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
