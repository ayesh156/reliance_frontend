import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  FileText,
  MessageSquare,
  FileDown,
  ArrowRightCircle,
  Building,
  User,
  Phone,
  MapPin,
  Calendar,
  Package,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  Edit,
} from 'lucide-react';
import { resolveImageUrl, handleImageError } from '../../utils/imageUrl';
import { openWhatsAppChat, generateSalesOrderWhatsAppMessage } from '../../utils/whatsapp';
import { downloadBlob, post } from '../../lib/api';
import { toast } from 'react-toastify';

interface OrderDetailModalProps {
  order: any | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusUpdated?: () => void;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  order,
  isOpen,
  onClose,
  onStatusUpdated,
}) => {
  const navigate = useNavigate();
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  if (!order) return null;

  const handleDownloadPdf = async () => {
    try {
      setIsDownloadingPdf(true);
      await downloadBlob(
        `/sales-orders/${order.id}/pdf`,
        `Order-${order.orderNumber || order.id}.pdf`
      );
      toast.success('Order PDF downloaded successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to download PDF');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleShareWhatsApp = () => {
    const phone = order.customerPhone || order.customer?.phone;
    if (!phone) {
      toast.warn('No customer contact number available for WhatsApp');
      return;
    }
    const message = generateSalesOrderWhatsAppMessage(order);
    openWhatsAppChat(phone, message);
  };

  /**
   * Convert to Invoice: routes directly to Wholesale Quick Invoice page with cart data
   */
  const handleConvertToInvoice = () => {
    onClose();
    navigate(`/system/quick-invoice?mode=WHOLESALE&convertOrderId=${order.id}`, {
      state: { convertOrder: order },
    });
  };

  /**
   * Edit Order: routes to Order Create Page in edit mode
   */
  const handleEditOrder = () => {
    onClose();
    navigate(`/system/orders/new?editOrderId=${order.id}`);
  };

  const getRoleBadge = (role?: string) => {
    const r = (role || 'REP').toUpperCase();
    switch (r) {
      case 'ADMIN':
        return (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
            ADMIN
          </span>
        );
      case 'REP':
        return (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
            REP
          </span>
        );
      case 'STAFF':
        return (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            STAFF
          </span>
        );
      case 'CASHIER':
        return (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            CASHIER
          </span>
        );
      default:
        return (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
            {r}
          </span>
        );
    }
  };

  const statusColors: Record<string, string> = {
    PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800',
    CONFIRMED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
    CONVERTED: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800',
    CANCELLED: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800',
  };

  const statusClass = statusColors[order.status] || 'bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-300';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl w-full max-h-[92vh] overflow-y-auto p-4 sm:p-6 rounded-2xl">
        <DialogHeader className="space-y-2 pb-3 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                <FileText className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                  <span>{order.orderNumber || `Order #${order.id}`}</span>
                  {getRoleBadge(order.user?.role)}
                  <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${statusClass}`}>
                    {order.status}
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 dark:text-zinc-400">
                  Booked on {new Date(order.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                  {order.user?.name && ` by ${order.user.name}`}
                </DialogDescription>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleShareWhatsApp}
                className="gap-1.5 h-8 text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800"
              >
                <MessageSquare className="size-3.5" />
                <span className="hidden sm:inline">WhatsApp</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isDownloadingPdf}
                onClick={handleDownloadPdf}
                className="gap-1.5 h-8 text-xs font-semibold text-slate-700 dark:text-zinc-300"
              >
                {isDownloadingPdf ? <Loader2 className="size-3.5 animate-spin" /> : <FileDown className="size-3.5" />}
                <span className="hidden sm:inline">Download PDF</span>
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Customer Information & Order Details: Fluid 2 columns on tablet portrait ~534px */}
        <div className="grid grid-cols-1 xs:grid-cols-2 gap-3 sm:gap-3.5 py-2.5 sm:py-3">
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 flex items-center gap-1.5">
              <User className="size-3" /> Customer Information
            </span>
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {order.customerName || order.customer?.name || 'Guest Customer'}
            </p>
            <div className="space-y-0.5 text-xs text-slate-600 dark:text-zinc-300">
              {(order.customerPhone || order.customer?.phone) && (
                <p className="flex items-center gap-1.5">
                  <Phone className="size-3 text-slate-400" /> {order.customerPhone || order.customer?.phone}
                </p>
              )}
              {(order.customerAddress || order.customer?.address) && (
                <p className="flex items-center gap-1.5">
                  <MapPin className="size-3 text-slate-400" /> {order.customerAddress || order.customer?.address}
                  {order.customerCity && `, ${order.customerCity}`}
                </p>
              )}
              {order.customerId ? (
                <span className="inline-block mt-1 text-[10px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md">
                  Registered Customer Account
                </span>
              ) : (
                <span className="inline-block mt-1 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md">
                  On-the-fly Guest Customer
                </span>
              )}
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 flex items-center gap-1.5">
              <Building className="size-3" /> Order Details
            </span>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Order Ref:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{order.orderNumber || order.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Sales Rep:</span>
                <span className="font-medium text-slate-900 dark:text-white">{order.user?.name || 'Unassigned'}</span>
              </div>
              {(() => {
                // Safely parse order notes: if serialized JSON metadata, extract only userNotes; fallback to raw string
                const getDisplayNotes = (notesRaw?: any): string => {
                  if (!notesRaw) return '';
                  if (typeof notesRaw === 'object') {
                    return notesRaw.userNotes !== undefined ? String(notesRaw.userNotes || '') : '';
                  }
                  const trimmed = String(notesRaw).trim();
                  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                    try {
                      const parsed = JSON.parse(trimmed);
                      if (parsed && typeof parsed === 'object') {
                        return parsed.userNotes !== undefined ? String(parsed.userNotes || '') : trimmed;
                      }
                    } catch {
                      return trimmed;
                    }
                  }
                  return trimmed;
                };

                const displayNotes = getDisplayNotes(order.notes);
                if (!displayNotes) return null;

                return (
                  <div className="pt-1.5 border-t border-slate-200/60 dark:border-zinc-800">
                    <span className="text-[11px] text-slate-400 block font-semibold">Notes:</span>
                    <p className="text-xs text-slate-700 dark:text-zinc-300 italic">{displayNotes}</p>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Ordered Items - Modern Card UI List */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
              <Package className="size-3.5 text-indigo-600" /> Booked Items ({order.items?.length || 0})
            </h4>
          </div>

          <div className="space-y-2.5">
            {order.items?.map((item: any, idx: number) => {
              const img = item.imageUrl || item.variant?.product?.images?.[0]?.imageUrl;
              const unitPrice = Number(item.unitPrice || 0);
              const qty = Number(item.quantity || 0);
              const disc = Number(item.discount || 0);
              const lineTotal = Number(item.totalPrice || Math.max(0, qty * unitPrice - disc));

              return (
                <div
                  key={idx}
                  className="p-3 sm:p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:border-slate-300 dark:hover:border-zinc-700 transition-all shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  {/* Left: Thumbnail & Item Title / SKU / Variant */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-12 rounded-xl bg-slate-100 dark:bg-zinc-800 overflow-hidden flex items-center justify-center shrink-0 border border-slate-200/80 dark:border-zinc-800">
                      {img ? (
                        <img
                          src={resolveImageUrl(img)}
                          alt={item.productName}
                          onError={handleImageError}
                          className="size-full object-cover"
                        />
                      ) : (
                        <Package className="size-5 text-slate-400 dark:text-zinc-600" />
                      )}
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <h5 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white leading-tight break-words">
                        {item.productName}
                      </h5>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        {item.sku && (
                          <span className="font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 font-semibold text-[10px]">
                            {item.sku}
                          </span>
                        )}
                        {item.variantName && (
                          <span className="text-slate-500 dark:text-zinc-400 text-xs">
                            {item.variantName}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono sm:hidden pt-0.5">
                        @ Rs. {unitPrice.toLocaleString('en-LK')}
                      </div>
                    </div>
                  </div>

                  {/* Right: Metrics on Tablet/Desktop, Grid on Mobile */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-zinc-800/80">
                    {/* Unit Price (Desktop / Tablet) */}
                    <div className="hidden sm:block text-right">
                      <span className="text-[9.5px] uppercase font-bold text-slate-400 dark:text-zinc-500 block leading-tight">
                        Unit Price
                      </span>
                      <span className="font-mono text-xs text-slate-700 dark:text-zinc-300 font-medium">
                        Rs. {unitPrice.toLocaleString('en-LK')}
                      </span>
                    </div>

                    {/* Quantity Badge */}
                    <div className="text-center">
                      <span className="text-[9.5px] uppercase font-bold text-slate-400 dark:text-zinc-500 leading-tight sm:block hidden">
                        Quantity
                      </span>
                      <span className="inline-flex items-center justify-center font-mono font-bold text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700">
                        Qty: {qty}
                      </span>
                    </div>

                    {/* Item Discount (if any) */}
                    {disc > 0 && (
                      <div className="text-right">
                        <span className="text-[9.5px] uppercase font-bold text-rose-500 dark:text-rose-400 leading-tight sm:block hidden">
                          Discount
                        </span>
                        <span className="font-mono text-xs font-semibold text-rose-600 dark:text-rose-400">
                          -Rs. {disc.toLocaleString('en-LK')}
                        </span>
                      </div>
                    )}

                    {/* Line Total */}
                    <div className="text-right pl-2 sm:pl-3 border-l border-slate-100 dark:border-zinc-800 min-w-[70px]">
                      <span className="text-[9.5px] uppercase font-bold text-slate-400 dark:text-zinc-500 block leading-tight">
                        Total
                      </span>
                      <span className="font-mono font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                        Rs. {lineTotal.toLocaleString('en-LK')}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Order Summary & Financials: Metrics Ribbon + Financial Breakdown */}
        {(() => {
          const distinctProductsCount = new Set(
            (order.items || []).map((it: any) => it.productName || it.variant?.productId || it.variantId || it.id)
          ).size || (order.items?.length || 0);

          const totalPiecesQuantity = (order.items || []).reduce(
            (sum: number, it: any) => sum + (Number(it.quantity) || 0),
            0
          );

          return (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {/* Visually Distinct Metrics Card: Total Items / Units & Total Qty */}
              <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 flex items-center justify-around gap-2 text-center">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block">
                    Total Items / Units
                  </span>
                  <span className="font-mono text-base font-bold text-slate-900 dark:text-white">
                    {distinctProductsCount} <span className="text-xs font-normal text-slate-500">units</span>
                  </span>
                </div>
                <div className="h-8 w-px bg-slate-200 dark:bg-zinc-800" />
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block">
                    Total Qty
                  </span>
                  <span className="font-mono text-base font-bold text-indigo-600 dark:text-indigo-400">
                    {totalPiecesQuantity} <span className="text-xs font-normal text-slate-500">pcs</span>
                  </span>
                </div>
              </div>

              {/* Financial Breakdown Card */}
              <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 text-xs">
                <div className="flex justify-between text-slate-600 dark:text-zinc-400">
                  <span>Subtotal:</span>
                  <span className="font-mono">Rs. {Number(order.subtotal || 0).toLocaleString('en-LK')}</span>
                </div>
                {Number(order.discount) > 0 && (
                  <div className="flex justify-between text-rose-600 dark:text-rose-400 font-medium">
                    <span>Discount:</span>
                    <span className="font-mono">- Rs. {Number(order.discount).toLocaleString('en-LK')}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1.5 border-t border-slate-200 dark:border-zinc-800 text-sm font-bold text-slate-900 dark:text-white">
                  <span>Total Amount:</span>
                  <span className="font-mono text-indigo-600 dark:text-indigo-400">
                    Rs. {Number(order.totalAmount || 0).toLocaleString('en-LK')}
                  </span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Bottom Actions Footer */}
        <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} className="text-xs">
            Close
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleEditOrder}
              className="gap-1.5 h-9 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800"
            >
              <Edit className="size-3.5 text-indigo-600" />
              <span>Edit Order</span>
            </Button>

            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={order.status === 'CONVERTED'}
              onClick={handleConvertToInvoice}
              className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer shadow-xs text-xs h-9"
            >
              <ArrowRightCircle className="size-3.5" />
              {order.status === 'CONVERTED' ? 'Already Converted' : 'Convert to Invoice'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
