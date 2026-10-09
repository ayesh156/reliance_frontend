import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, del, post } from '../lib/api';
import { DateTimePicker } from '../components/ui/date-time-picker';
import { toast } from 'react-toastify';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { SearchableSelect } from '../components/ui/searchable-select';
import { A4InvoiceModal } from '../components/pos/A4InvoiceModal';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../components/ui/dropdown-menu';
import {
  Search,
  Printer,
  Edit,
  Trash2,
  MoreVertical,
  Download,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileText,
  CreditCard,
  Banknote,
  Building,
  RefreshCw,
  MessageSquare,
  Wallet, // ⭐ Added for Pay Due Action
  RotateCcw, // ⭐ Added for Process Return Action
  History, // ⭐ Added for Historical Return Audit Log
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { openWhatsAppChat, generateCustomerInvoiceWhatsAppMessage } from '../utils/whatsapp';

interface InvoiceRecord {
  id: number;
  source: string;
  customerName: string;
  customerPhone?: string;
  totalAmount: number;
  paidAmount: number;
  paymentMethod: string;
  createdAt: string;
  customer?: {
    id: number;
    name: string;
    phone: string;
    outstandingBalance: number;
  };
  items: any[];
  notes?: string;
  returns?: any[];
  originalTotalAmount?: number;
  userNotes?: string;
}

export const InvoicesPage: React.FC = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { isAdmin } = useAuth();
  const dark = theme === 'dark';

  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [customers, setCustomers] = useState<{ id: number; name: string; phone: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('all');
  const [selectedMethod, setSelectedMethod] = useState('ALL');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Delete Dialog state
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Print Preview state
  const [printInvoice, setPrintInvoice] = useState<any>(null);
  const [printModalOpen, setPrintModalOpen] = useState(false);

  // WhatsApp Dialog state for Walk-in Customers or custom phone dispatch
  const [waModalOpen, setWaModalOpen] = useState(false);
  const [waTargetInvoice, setWaTargetInvoice] = useState<any>(null);
  const [waCustomPhone, setWaCustomPhone] = useState('');

  // Helper for current local ISO string
  const getCurrentLocalISOString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // ⭐ Material Payment ආකාරයේ DateTimePicker State එක (Date & Timestamp සමඟ)
  const [settlingInvoice, setSettlingInvoice] = useState<InvoiceRecord | null>(null);
  const [settleAmount, setSettleAmount] = useState<string>('');
  const [settleMethod, setSettleMethod] = useState<string>('CASH');
  const [settleDateTime, setSettleDateTime] = useState<string>(getCurrentLocalISOString());
  const [settleReference, setSettleReference] = useState<string>('');
  const [isSettling, setIsSettling] = useState<boolean>(false);

  // ⭐ In-Store Return & Stock Restoration Dialog State
  const [returnInvoice, setReturnInvoice] = useState<InvoiceRecord | null>(null);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnQuantities, setReturnQuantities] = useState<Record<number, number>>({});
  const [returnReason, setReturnReason] = useState<string>('Incorrect Size');
  const [customReturnReason, setCustomReturnReason] = useState<string>('');
  const [isProcessingReturn, setIsProcessingReturn] = useState<boolean>(false);

  /**
   * Helper to retrieve total past returned quantity for a specific product variant on an invoice
   */
  const getCumulativeReturnedForVariant = (inv: InvoiceRecord | null, variantId: number): number => {
    if (!inv || !Array.isArray(inv.returns)) return 0;
    return inv.returns.reduce((sum, ret) => {
      if (!Array.isArray(ret.returnedItems)) return sum;
      const match = ret.returnedItems.find((ri: any) => Number(ri.variantId) === Number(variantId));
      return sum + (match ? Number(match.returnQty || 0) : 0);
    }, 0);
  };

  /**
   * Live calculations banner state for return modal:
   * Original Bill Total, Total Returned Value, Adjusted Net Bill Total, and Updated Customer Due
   */
  const returnModalCalculations = useMemo(() => {
    if (!returnInvoice) {
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

    const pastReturnsTotal = (returnInvoice.returns || []).reduce(
      (sum, r) => sum + (Number(r.totalReturnRefund) || 0),
      0
    );

    const originalBill = returnInvoice.originalTotalAmount !== undefined
      ? Number(returnInvoice.originalTotalAmount)
      : Number(returnInvoice.totalAmount) + pastReturnsTotal;

    let thisReturnTotal = 0;
    let totalItemsToReturn = 0;

    if (Array.isArray(returnInvoice.items)) {
      returnInvoice.items.forEach((item) => {
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

    const currentBillDue = Math.max(0, Math.round((Number(returnInvoice.totalAmount) - Number(returnInvoice.paidAmount)) * 100) / 100);
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
  }, [returnInvoice, returnQuantities]);

  const handleOpenReturnModal = (inv: InvoiceRecord) => {
    setReturnInvoice(inv);
    const initialQtys: Record<number, number> = {};
    if (Array.isArray(inv.items)) {
      inv.items.forEach((item) => {
        initialQtys[item.variantId] = 0;
      });
    }
    setReturnQuantities(initialQtys);
    setReturnReason('Incorrect Size');
    setCustomReturnReason('');
    setReturnModalOpen(true);
  };

  const handleProcessReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnInvoice) return;

    if (returnModalCalculations.totalItemsToReturn <= 0) {
      toast.error('Please enter a return quantity of at least 1 item');
      return;
    }

    const returnedItems = Object.entries(returnQuantities)
      .filter(([_, qty]) => Number(qty) > 0)
      .map(([variantIdStr, qty]) => {
        const variantId = Number(variantIdStr);
        const originalItem = returnInvoice.items.find((it) => Number(it.variantId) === variantId);
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
      await post(`/orders/${returnInvoice.id}/returns`, {
        returnedItems,
        reason: finalReason,
      });

      toast.success(`Return processed for Invoice #INV${returnInvoice.id}! Stock restored to inventory.`);
      setReturnModalOpen(false);
      setReturnInvoice(null);
      setReturnQuantities({});
      fetchInvoices();
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || 'Failed to process return');
    } finally {
      setIsProcessingReturn(false);
    }
  };

  /**
   * Submit Customer Invoice Due Settlement
   */
  const handleSettleInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingInvoice) return;

    const payNum = parseFloat(settleAmount);
    const dueAmount = settlingInvoice.totalAmount - settlingInvoice.paidAmount;

    if (isNaN(payNum) || payNum <= 0) {
      toast.error('Please enter a valid positive payment amount');
      return;
    }

    if (payNum > dueAmount) {
      toast.error(`Amount cannot exceed the remaining due of Rs. ${dueAmount.toLocaleString()}`);
      return;
    }

    setIsSettling(true);
    try {
      await post('/credit/settle-bill', {
        orderId: settlingInvoice.id,
        amount: payNum,
        paymentMethod: settleMethod,
        reference: settleReference.trim() || `Invoice #INV${settlingInvoice.id} Settlement`,
        paymentDate: settleDateTime ? new Date(settleDateTime).toISOString() : new Date().toISOString(),
      });

      toast.success(`Payment of Rs. ${payNum.toLocaleString()} settled successfully!`);
      setSettlingInvoice(null);
      setSettleAmount('');
      setSettleReference('');
      fetchInvoices(page);
    } catch (err: any) {
      toast.error(err.message || 'Payment settlement failed');
    } finally {
      setIsSettling(false);
    }
  };

  /**
   * Dispatches WhatsApp receipt:
   * Directly opens chat if customer already has a phone number;
   * Otherwise opens the prompt dialog to enter a number on the spot.
   */
  const handleInitiateWhatsApp = (inv: any) => {
    const existingPhone = inv.customerPhone || inv.customer?.phone;
    if (existingPhone) {
      const waMsg = generateCustomerInvoiceWhatsAppMessage(inv);
      openWhatsAppChat(existingPhone, waMsg);
    } else {
      setWaTargetInvoice(inv);
      setWaCustomPhone('');
      setWaModalOpen(true);
    }
  };

  const handleSendCustomWhatsApp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!waCustomPhone.trim()) {
      toast.error('Please enter a valid WhatsApp mobile number');
      return;
    }
    if (waTargetInvoice) {
      const waMsg = generateCustomerInvoiceWhatsAppMessage(waTargetInvoice);
      openWhatsAppChat(waCustomPhone.trim(), waMsg);
      setWaModalOpen(false);
      setWaTargetInvoice(null);
      setWaCustomPhone('');
    }
  };

  // Fetch Customers for filter dropdown
  useEffect(() => {
    get<any[]>('/customers')
      .then((data) => setCustomers(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // Single Unified Fetcher with race-condition protection
  const fetchInvoices = async (targetPage = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(targetPage));
      params.set('limit', '12');
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (selectedCustomerId !== 'all') params.set('customerId', selectedCustomerId);
      if (selectedMethod !== 'ALL') params.set('paymentMethod', selectedMethod);

      const res = await get<any>(`/orders/invoices?${params.toString()}`);
      setInvoices(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotalCount(res.pagination?.total || 0);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  // Flag to differentiate initial load vs typing in search
  const isFirstRender = useRef(true);

  /**
   * Single Consolidated Effect:
   * Handles Initial Load, Pagination, Customer Filter, Payment Method & Debounced Search seamlessly.
   */
  useEffect(() => {
    // If it's the very first time the page opens, fetch immediately (0ms delay)
    if (isFirstRender.current) {
      isFirstRender.current = false;
      fetchInvoices(page);
      return;
    }

    // For any subsequent changes (typing in search, picking a customer, clicking a payment pill)
    const delay = searchQuery ? 350 : 0; // Instant for dropdowns/pagination, 350ms debounce for typing
    const timer = setTimeout(() => {
      fetchInvoices(page);
    }, delay);

    return () => clearTimeout(timer);
  }, [page, selectedCustomerId, selectedMethod, searchQuery]);

  // Comprehensive Invoice Metrics
  const totalInvoicesGenerated = totalCount;
  const totalInvoiceRevenue = useMemo(() => {
    return invoices.reduce((sum, i) => sum + (Number(i.totalAmount) || 0), 0);
  }, [invoices]);
  const totalCustomerDebt = useMemo(() => {
    return invoices.reduce((sum, i) => sum + Math.max(0, (Number(i.totalAmount) || 0) - (Number(i.paidAmount) || 0)), 0);
  }, [invoices]);

  // Handle Invoice Deletion
  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await del(`/orders/invoices/${deleteId}`);
      toast.success(`Invoice #${deleteId} deleted and stock/credit rolled back!`);
      setDeleteId(null);
      fetchInvoices();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete invoice');
    } finally {
      setDeleting(false);
    }
  };

  // Handle backend PDF streaming download with cross-storage auth token fallback
  const handleDownloadPdf = async (invoiceId: number) => {
    try {
      toast.info(`Generating Invoice #INV${invoiceId} PDF...`);
      const apiHost = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const token = localStorage.getItem('token') || localStorage.getItem('auth_token') || sessionStorage.getItem('token');

      const response = await fetch(`${apiHost}/orders/invoices/${invoiceId}/pdf`, {
        method: 'GET',
        credentials: 'include', // Ensures HTTP-only auth cookies are passed automatically
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => null);
        throw new Error(errJson?.message || `HTTP error ${response.status}`);
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
      toast.error(err.message || 'Failed to download PDF');
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 min-h-[calc(100vh-5rem)]">
      {/* Top Header & Refresh */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-zinc-900/60 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="size-5 text-emerald-600" /> Invoices & Sales Ledger
          </h2>
          <p className="text-xs text-slate-500">Track, print, edit and manage customer orders and credit balances.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchInvoices()}
            disabled={loading}
            className="h-9 gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button
            onClick={() => navigate('/system/quick-checkout')}
            className="h-9 gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            + New Sale
          </Button>
        </div>
      </div>

      {/* Metrics Row matching CustomersPage design */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
        <div className="rounded-2xl border p-4 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 shadow-xs flex justify-between items-center">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Total Invoices</span>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{totalInvoicesGenerated}</h3>
          </div>
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <FileText className="size-5" />
          </div>
        </div>

        <div className="rounded-2xl border p-4 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 shadow-xs flex justify-between items-center">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Total Revenue Generated</span>
            <h3 className="text-2xl font-bold text-emerald-600 mt-1 font-mono">
              Rs. {totalInvoiceRevenue.toLocaleString()}
            </h3>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <Banknote className="size-5" />
          </div>
        </div>

        <div className="rounded-2xl border p-4 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 shadow-xs flex justify-between items-center">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Outstanding Due (Customers)</span>
            <h3 className={`text-2xl font-bold mt-1 font-mono ${totalCustomerDebt > 0 ? 'text-rose-600' : 'text-slate-900 dark:text-white'}`}>
              Rs. {totalCustomerDebt.toLocaleString()}
            </h3>
          </div>
          <div className={`p-3 rounded-xl ${totalCustomerDebt > 0 ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500'}`}>
            <CreditCard className="size-5" />
          </div>
        </div>
      </div>

      {/* Filters Row (Search, Customer Combobox, Payment Method) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-white dark:bg-zinc-900/60 p-3 rounded-2xl border border-slate-200 dark:border-zinc-800">
        {/* Keyword Search */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (page !== 1) setPage(1);
            }}
            placeholder="Search invoice #, customer, phone..."
            className="pl-9 h-9 text-xs"
          />
        </div>

        {/* Searchable Customer Select */}
        <div>
          <SearchableSelect
            value={selectedCustomerId}
            onValueChange={(val) => {
              setSelectedCustomerId(val);
              setPage(1);
            }}
            options={[
              { value: 'all', label: 'All Customers' },
              ...customers.map((c) => ({
                value: String(c.id),
                label: `${c.name} (${c.phone})`,
              })),
            ]}
            placeholder="Filter by Customer..."
            searchPlaceholder="Search customer..."
            dark={dark}
          />
        </div>

        {/* Payment Method Filter */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl">
          {['ALL', 'CASH', 'CHEQUE', 'CREDIT'].map((method) => (
            <button
              key={method}
              type="button"
              onClick={() => {
                setSelectedMethod(method);
                setPage(1);
              }}
              className={`flex-1 py-1 text-[11px] font-bold rounded-lg transition-colors ${
                selectedMethod === method
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400'
              }`}
            >
              {method}
            </button>
          ))}
        </div>
      </div>

      {/* Invoices Table */}
      <div className="flex-1 bg-white dark:bg-zinc-900/60 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/40 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4 text-center">Method</th>
                <th className="py-3 px-4 text-right">Total Amount</th>
                <th className="py-3 px-4 text-right">Paid</th>
                <th className="py-3 px-4 text-right">Credit (Due)</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Loader2 className="size-6 animate-spin mx-auto mb-2 text-emerald-500" />
                    <span>Loading invoices...</span>
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <FileText className="size-8 opacity-30 mx-auto mb-2" />
                    <span>No invoices found matching current criteria.</span>
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => {
                  const creditDue = Math.max(0, inv.totalAmount - inv.paidAmount);
                  const isUnderpaid = creditDue > 0;

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/30 transition-colors">
                      {/* Interactive Clickable Invoice ID with Wholesale / Retail Badge */}
                      <td 
                        onClick={() => navigate(`/system/quick-checkout?editInvoiceId=${inv.id}`)}
                        className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline select-none"
                        title="Click to edit invoice in POS"
                      >
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>INV{inv.id}</span>
                          {inv.source === 'POS_WHOLESALE' ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                              WS
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400">
                              RET
                            </span>
                          )}
                          {inv.returns && inv.returns.length > 0 && (
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenReturnModal(inv);
                              }}
                              className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-0.5 hover:bg-indigo-200 cursor-pointer"
                              title="Click to view returns history"
                            >
                              <RotateCcw className="size-2.5" />
                              RET ({inv.returns.length})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {new Date(inv.createdAt).toISOString().split('T')[0]}
                      </td>
                      {/* Interactive Clickable Customer Name: Direct jump to Quick Checkout in Edit Mode */}
                      <td 
                        onClick={() => navigate(`/system/quick-checkout?editInvoiceId=${inv.id}`)}
                        className="py-3 px-4 cursor-pointer group/inv-cust select-none"
                        title="Click to edit invoice in POS"
                      >
                        <div className="font-semibold text-slate-900 dark:text-white group-hover/inv-cust:text-emerald-600 dark:group-hover/inv-cust:text-emerald-400 group-hover/inv-cust:underline transition-colors">
                          {inv.customerName}
                        </div>
                        {inv.customerPhone && <span className="text-[10px] text-slate-400 font-mono">{inv.customerPhone}</span>}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold uppercase ${
                            inv.paymentMethod === 'CHEQUE'
                              ? 'border-amber-500 text-amber-600 bg-amber-500/10'
                              : inv.paymentMethod === 'CREDIT' || isUnderpaid
                              ? 'border-rose-500 text-rose-600 bg-rose-500/10'
                              : 'border-emerald-500 text-emerald-600 bg-emerald-500/10'
                          }`}
                        >
                          {inv.paymentMethod}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                        Rs. {Number(inv.totalAmount).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-600">
                        Rs. {Number(inv.paidAmount).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        {creditDue > 0 ? (
                          <span className="text-rose-600">- Rs. {creditDue.toLocaleString()}</span>
                        ) : (
                          <span className="text-slate-400">Rs. 0.00</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center">
                          {/* Vertical 3-Dots Action Dropdown Menu (modal={false} prevents layout shifting and scroll lock) */}
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-8 text-slate-500 hover:text-slate-900 dark:hover:text-white">
                                <MoreVertical className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 text-xs font-medium">
                              <DropdownMenuItem
                                onClick={() => {
                                  setPrintInvoice(inv);
                                  setPrintModalOpen(true);
                                }}
                                className="gap-2 cursor-pointer"
                              >
                                <Printer className="size-3.5 text-slate-500" />
                                Print Preview
                              </DropdownMenuItem>

                              {/* ⭐ In-Store Return Action Button */}
                              <DropdownMenuItem
                                onClick={() => handleOpenReturnModal(inv)}
                                className="gap-2 cursor-pointer text-indigo-600 focus:text-indigo-700 focus:bg-indigo-50 dark:focus:bg-indigo-950/30 font-medium"
                              >
                                <RotateCcw className="size-3.5 text-indigo-600" />
                                Process Return
                              </DropdownMenuItem>

                            {/* ⭐ GRN-style Pay Due Balance Action (only shown if creditDue > 0) */}
                            {creditDue > 0 && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setSettlingInvoice(inv);
                                  setSettleAmount(String(creditDue));
                                  setSettleMethod('CASH');
                                  setSettleDateTime(getCurrentLocalISOString());
                                  setSettleReference('');
                                }}
                                className="gap-2 cursor-pointer text-amber-600 focus:text-amber-700 focus:bg-amber-50 dark:focus:bg-amber-950/30 font-semibold"
                              >
                                <Wallet className="size-3.5 text-amber-600" />
                                Pay Due Balance
                              </DropdownMenuItem>
                            )}

                            {/* Smart WhatsApp Share Action (Direct or with Phone Prompt) */}
                            <DropdownMenuItem
                              onClick={() => handleInitiateWhatsApp(inv)}
                              className="gap-2 cursor-pointer text-emerald-600 focus:text-emerald-700"
                            >
                              <MessageSquare className="size-3.5 text-emerald-600" />
                              WhatsApp Bill
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() => handleDownloadPdf(inv.id)}
                              className="gap-2 cursor-pointer text-emerald-600 focus:text-emerald-700"
                            >
                              <Download className="size-3.5 text-emerald-600" />
                              Download PDF
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() => navigate(`/system/quick-checkout?editInvoiceId=${inv.id}`)}
                              className="gap-2 cursor-pointer text-blue-600 focus:text-blue-700"
                            >
                              <Edit className="size-3.5 text-blue-600" />
                              Edit Invoice
                            </DropdownMenuItem>

                            {isAdmin && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setDeleteId(inv.id)}
                                  className="gap-2 cursor-pointer text-rose-600 focus:text-rose-700 focus:bg-rose-50 dark:focus:bg-rose-950/30"
                                >
                                  <Trash2 className="size-3.5 text-rose-600" />
                                  Delete Invoice
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-3 border-t border-slate-100 dark:border-zinc-800 text-xs">
            <span className="text-slate-400">
              Page {page} of {totalPages} ({totalCount} invoices total)
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-7 px-2 text-xs"
              >
                <ChevronLeft className="size-3.5 mr-1" /> Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="h-7 px-2 text-xs"
              >
                Next <ChevronRight className="size-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog (Admin Only) */}
      {isAdmin && (
        <Dialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle className="text-rose-600 flex items-center gap-2">
                <Trash2 className="size-5" /> Delete Invoice #{deleteId}
              </DialogTitle>
              <DialogDescription className="text-xs pt-2">
                Are you sure you want to delete this invoice? This will automatically <strong>roll back stock</strong> to the inventory and <strong>cancel any pending credit</strong> from the customer's balance.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="pt-3">
              <Button variant="outline" size="sm" onClick={() => setDeleteId(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={deleting}
                onClick={confirmDelete}
                className="bg-rose-600 hover:bg-rose-700 font-bold"
              >
                {deleting && <Loader2 className="size-3.5 animate-spin mr-1" />} Confirm Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Headless Direct Print Trigger */}
      {printModalOpen && printInvoice && (
        <A4InvoiceModal
          open={printModalOpen}
          onClose={() => {
            setPrintModalOpen(false);
            setPrintInvoice(null);
          }}
          order={printInvoice}
          autoPrint={true}
        />
      )}

      {/* On-The-Spot WhatsApp Phone Entry Dialog (For Walk-in Customers) */}
      <Dialog open={waModalOpen} onOpenChange={setWaModalOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm text-slate-900 dark:text-white">
              <MessageSquare className="size-4 text-emerald-600" />
              Send Bill via WhatsApp — INV{waTargetInvoice?.id}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              This walk-in customer has no saved contact number. Enter their WhatsApp number to send the digital receipt.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSendCustomWhatsApp} className="space-y-4 py-2">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 flex justify-between items-center text-xs">
              <div>
                <span className="text-slate-400 text-[10px] block">Customer:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {waTargetInvoice?.customerName || 'Walk-in Customer'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 text-[10px] block">Total Amount:</span>
                <span className="font-mono font-bold text-emerald-600">
                  Rs. {Number(waTargetInvoice?.totalAmount || 0).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                WhatsApp Phone Number *
              </label>
              <Input
                type="tel"
                autoFocus
                required
                value={waCustomPhone}
                onChange={(e) => setWaCustomPhone(e.target.value)}
                placeholder="e.g. 0771234567 or 071XXXXXXX"
                className="font-mono text-xs h-10"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setWaModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5">
                <MessageSquare className="size-3.5" /> Open WhatsApp
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>


      {/* ⭐ GRN-style Settle Due Modal for Invoices */}
      <Dialog open={Boolean(settlingInvoice)} onOpenChange={(open) => !open && setSettlingInvoice(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-slate-900 dark:text-white">
              <Wallet className="size-5 text-emerald-600" />
              Settle Due for Invoice #INV{settlingInvoice?.id}
            </DialogTitle>
          </DialogHeader>

          {settlingInvoice && (
            <form onSubmit={handleSettleInvoiceSubmit} className="space-y-3.5 py-1">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Customer:</span>
                  <span className="font-bold text-slate-800 dark:text-zinc-200">{settlingInvoice.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Invoice Total:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-zinc-200">
                    Rs. {Number(settlingInvoice.totalAmount).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-200 dark:border-zinc-800 pt-1">
                  <span className="text-slate-500">Remaining Due Balance:</span>
                  <span className="font-mono font-bold text-rose-600 text-sm">
                    Rs. {(settlingInvoice.totalAmount - settlingInvoice.paidAmount).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    Pay Amount (Rs.) *
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    required
                    max={settlingInvoice.totalAmount - settlingInvoice.paidAmount}
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(e.target.value)}
                    placeholder="0.00"
                    className="h-9 font-mono font-bold text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    Payment Method *
                  </label>
                  <SearchableSelect
                    value={settleMethod}
                    onValueChange={setSettleMethod}
                    options={[
                      { value: 'CASH', label: 'CASH' },
                      { value: 'CARD', label: 'CARD' },
                      { value: 'BANK_TRANSFER', label: 'BANK TRANSFER' },
                      { value: 'CHEQUE', label: 'CHEQUE' },
                    ]}
                    placeholder="Select Method"
                    dark={dark}
                    className="h-9"
                  />
                </div>
              </div>

              {/* Payment Date & Timestamp (Material Payment Modal එකේ ආකාරයටම) */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Payment Date &amp; Timestamp *
                </label>
                <DateTimePicker
                  value={settleDateTime}
                  onChange={setSettleDateTime}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Payment Reference / Cheque No
                </label>
                <Input
                  value={settleReference}
                  onChange={(e) => setSettleReference(e.target.value)}
                  placeholder="e.g. Part payment cash / Cheque #8812"
                  className="h-9 text-xs"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setSettlingInvoice(null)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSettling}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isSettling && <Loader2 className="size-3.5 animate-spin mr-1" />}
                  Confirm Payment
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ⭐ INVOICE ITEM RETURN & RESTOCK MODAL */}
      <Dialog open={returnModalOpen} onOpenChange={(open) => !open && setReturnModalOpen(false)}>
        <DialogContent className="sm:max-w-[760px] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-slate-900 dark:text-white font-bold">
              <RotateCcw className="size-5 text-indigo-600" />
              Process Item Return &amp; Restock — #INV{returnInvoice?.id}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-zinc-400">
              Return items back to warehouse stock and automatically reconcile invoice ledgers and customer balances.
            </DialogDescription>
          </DialogHeader>

          {returnInvoice && (
            <form onSubmit={handleProcessReturnSubmit} className="space-y-4 py-1">
              {/* Invoice Meta Banner */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 text-xs grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Customer</span>
                  <span className="font-bold text-slate-800 dark:text-zinc-200 truncate block">
                    {returnInvoice.customerName || 'Walk-in Customer'}
                  </span>
                  {returnInvoice.customerPhone && (
                    <span className="text-[10px] font-mono text-slate-500">{returnInvoice.customerPhone}</span>
                  )}
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Date / Mode</span>
                  <span className="font-semibold text-slate-800 dark:text-zinc-200 block">
                    {new Date(returnInvoice.createdAt).toISOString().split('T')[0]}
                  </span>
                  <span className="text-[10px] uppercase font-bold text-slate-500">{returnInvoice.paymentMethod}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Original Bill</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white block">
                    Rs. {returnModalCalculations.originalBill.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-emerald-600 font-medium">
                    Paid: Rs. {Number(returnInvoice.paidAmount).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Current Bill Due</span>
                  <span className="font-mono font-bold text-rose-600 block">
                    Rs. {returnModalCalculations.currentBillDue.toLocaleString()}
                  </span>
                  {returnInvoice.customer?.outstandingBalance !== undefined && (
                    <span className="text-[10px] text-slate-500">
                      Cust Total: Rs. {Number(returnInvoice.customer.outstandingBalance).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>

              {/* Items Return Table */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  <span>Purchased Items &amp; Return Quantities:</span>
                  <span className="text-[11px] text-slate-400">
                    Max quantity cannot exceed unreturned balance
                  </span>
                </div>

                <div className="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-950">
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
                      {(returnInvoice.items || []).map((item) => {
                        const variantId = Number(item.variantId);
                        const purchasedQty = Number(item.quantity || 0);
                        const alreadyReturned = getCumulativeReturnedForVariant(returnInvoice, variantId);
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
                                  const bounded = Math.max(0, Math.min(returnableQty, parsed));
                                  setReturnQuantities((prev) => ({
                                    ...prev,
                                    [variantId]: bounded,
                                  }));
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

              {/* Return Reason Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

              {/* ⭐ LIVE CALCULATION BANNER */}
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

              {/* ⭐ HISTORICAL RETURN AUDIT LOG (Mini-Ledger UI) */}
              <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-zinc-800">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-zinc-300">
                  <History className="size-3.5 text-indigo-600" />
                  Historical Return Audit Log ({returnInvoice.returns?.length || 0})
                </div>

                {Array.isArray(returnInvoice.returns) && returnInvoice.returns.length > 0 ? (
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {returnInvoice.returns.map((ret: any, idx: number) => (
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

                        {/* Returned Items Breakdown */}
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

                        {/* Financial Ledger Impact Breakdown */}
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

              {/* Modal Footer Actions */}
              <DialogFooter className="pt-3 border-t border-slate-200 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setReturnModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!returnModalCalculations.canSubmit || isProcessingReturn}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1.5"
                >
                  {isProcessingReturn ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" /> Restoring Inventory...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="size-3.5" /> Confirm Return &amp; Restock
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};