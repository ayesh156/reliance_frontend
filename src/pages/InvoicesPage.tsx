import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, del, post, patch } from '../lib/api';
import { DateTimePicker } from '../components/ui/date-time-picker';
import { toast } from 'react-toastify';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useSSE } from '../hooks/useSSE';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import { SearchableSelect } from '../components/ui/searchable-select';
import { A4InvoiceModal } from '../components/pos/A4InvoiceModal';
import { ReturnOrderModal } from '../components/invoices/ReturnOrderModal';
import { InvoiceDetailModal } from '../components/invoices/InvoiceDetailModal';
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
  SlidersHorizontal,
  Calendar,
  X,
  MessageCircle,
  Pencil,
  ArrowUpDown,
  ReceiptText,
} from 'lucide-react';
import { DateRangePicker } from '../components/ui/date-range-picker';
import { openWhatsAppChat, generateCustomerInvoiceWhatsAppMessage } from '../utils/whatsapp';
import { getInvoiceAgeInfo } from '../utils/invoiceAge';

const PAYMENT_METHOD_OPTIONS = [
  { value: 'ALL', label: 'All Payment Methods' },
  { value: 'CASH', label: 'Cash' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'CARD', label: 'Card' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'CREDIT', label: 'Credit' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'most_overdue', label: 'Most Overdue First (Oldest Due)' },
  { value: 'least_overdue', label: 'Least Overdue First (Recent Due)' },
  { value: 'highest_amount', label: 'Highest Amount' },
  { value: 'lowest_amount', label: 'Lowest Amount' },
  { value: 'highest_due', label: 'Highest Due' },
];

interface InvoiceRecord {
  id: number;
  source: string;
  customerName: string;
  customerPhone?: string;
  totalAmount: number;
  paidAmount: number;
  paymentMethod: string;
  createdAt: string;
  userId?: number;
  user?: {
    id: number;
    name: string;
    role?: string;
  };
  subtotal?: number;
  discount?: number;
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
  payments?: any[];
  cheques?: any[];
  splitPayments?: any[];
  // Rep Dispatch Tracking (Sent to sales rep / delivery tracking)
  isDispatched?: boolean;
  dispatchedByRole?: string | null;
}

interface InvoiceChequeInfo {
  chequeNumber: string;
  bankName: string;
  chequeDate?: string;
  amount?: number;
  status: 'PENDING' | 'CLEARED' | 'BOUNCED' | string;
  statusLabel: 'PENDING' | 'REALIZED' | 'BOUNCED';
}

/**
 * Dynamic role-specific badge styling for dispatch tracking and operator identification.
 * Provides accessible contrast and tailored color palettes per organization role:
 * - ADMIN: Purple / Indigo palette
 * - REP: Amber / Orange palette
 * - STAFF: Blue / Sky palette
 * - CASHIER: Emerald / Teal palette
 * - Fallback: Slate / Zinc palette
 */
export function getRoleBadgeStyle(role?: string | null): string {
  const normalized = String(role || '').toUpperCase();
  switch (normalized) {
    case 'ADMIN':
      return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800';
    case 'REP':
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800';
    case 'STAFF':
      return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800';
    case 'CASHIER':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700';
  }
}

function getInvoiceChequeList(inv: InvoiceRecord): InvoiceChequeInfo[] {
  const result: InvoiceChequeInfo[] = [];

  // 1. From relational payments array
  if (Array.isArray(inv.payments)) {
    inv.payments.forEach((p: any) => {
      if (String(p.method).toUpperCase() === 'CHEQUE') {
        let chqNum = '-';
        let bName = '-';
        if (p.reference) {
          const matchNum = /Cheque\s*#?([^\s(]+)/i.exec(p.reference);
          if (matchNum) chqNum = matchNum[1];
          else chqNum = p.reference.replace(/\s*\[Edit:.*?\]$/, '').slice(0, 20);
          const matchBank = /\(([^)]+)\)/.exec(p.reference);
          if (matchBank) bName = matchBank[1];
        }
        const st = p.chequeStatus || 'PENDING';
        result.push({
          chequeNumber: chqNum,
          bankName: bName,
          chequeDate: p.chequeDate ? String(p.chequeDate).split('T')[0] : (p.createdAt ? String(p.createdAt).split('T')[0] : undefined),
          amount: p.amount,
          status: st,
          statusLabel: st === 'CLEARED' ? 'REALIZED' : (st === 'BOUNCED' ? 'BOUNCED' : 'PENDING'),
        });
      }
    });
  }

  // 2. From parsed cheques
  if (result.length === 0 && Array.isArray(inv.cheques)) {
    inv.cheques.forEach((c: any) => {
      const st = c.status || 'PENDING';
      result.push({
        chequeNumber: c.chequeNumber || '-',
        bankName: c.bankName || '-',
        chequeDate: c.chequeDate ? String(c.chequeDate).split('T')[0] : undefined,
        amount: Number(c.amount) || 0,
        status: st,
        statusLabel: (st === 'CLEARED' || st === 'REALIZED') ? 'REALIZED' : (st === 'BOUNCED' ? 'BOUNCED' : 'PENDING'),
      });
    });
  }

  // 3. From splitPayments
  if (result.length === 0 && Array.isArray(inv.splitPayments)) {
    inv.splitPayments.forEach((s: any) => {
      if (String(s.method).toUpperCase() === 'CHEQUE') {
        const st = s.status || 'PENDING';
        result.push({
          chequeNumber: s.chequeNumber || '-',
          bankName: s.bankName || '-',
          chequeDate: s.date ? String(s.date).split('T')[0] : undefined,
          amount: Number(s.amount) || 0,
          status: st,
          statusLabel: (st === 'CLEARED' || st === 'REALIZED') ? 'REALIZED' : (st === 'BOUNCED' ? 'BOUNCED' : 'PENDING'),
        });
      }
    });
  }

  // 4. Fallback if paymentMethod is CHEQUE
  if (result.length === 0 && String(inv.paymentMethod).toUpperCase() === 'CHEQUE') {
    result.push({
      chequeNumber: 'Registered',
      bankName: '-',
      chequeDate: inv.createdAt ? String(inv.createdAt).split('T')[0] : undefined,
      amount: inv.paidAmount,
      status: 'PENDING',
      statusLabel: 'PENDING',
    });
  }

  return result;
}

export const InvoicesPage: React.FC = () => {
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const { user, isAdmin, isRep } = useAuth();
  const dark = resolvedTheme === 'dark';

  const canDeleteInvoice = (inv: InvoiceRecord): boolean => {
    if (isAdmin) return true;
    const isWholesale = inv.source === 'POS_WHOLESALE' || (inv as any).orderType === 'WHOLESALE';
    const isOwner =
      Number(inv.userId) === Number(user?.id) ||
      String(inv.userId) === String(user?.id) ||
      Number((inv as any).createdById) === Number(user?.id);

    if (isRep && isWholesale && isOwner) {
      return true;
    }
    return false;
  };

  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [customers, setCustomers] = useState<{ id: number; name: string; phone: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('all');
  const [selectedMethod, setSelectedMethod] = useState('ALL');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [sortBy, setSortBy] = useState<string>('newest');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

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

  // ⭐ Invoice Summary & Cheque Lifecycle Management Modal State
  const [summaryModalInvoice, setSummaryModalInvoice] = useState<InvoiceRecord | null>(null);

  // Rep Dispatch Tracking State
  const [togglingDispatchId, setTogglingDispatchId] = useState<number | null>(null);

  /**
   * Safely toggle or update Rep Dispatch Tracking status on an invoice.
   * Optimistically updates UI state and synchronizes with PATCH /invoices/:id/dispatch.
   */
  const handleToggleDispatch = async (inv: InvoiceRecord, nextChecked: boolean) => {
    setTogglingDispatchId(inv.id);
    const prevDispatched = inv.isDispatched;
    const prevRole = inv.dispatchedByRole;

    // Optimistic UI state update
    setInvoices((prev) =>
      prev.map((item) =>
        item.id === inv.id
          ? {
              ...item,
              isDispatched: nextChecked,
              dispatchedByRole: nextChecked ? (user?.role || 'ADMIN') : null,
            }
          : item
      )
    );

    try {
      const res = await patch<any>(`/invoices/${inv.id}/dispatch`, {
        isDispatched: nextChecked,
      });
      const updated = res?.data || res;
      if (updated && typeof updated.isDispatched === 'boolean') {
        setInvoices((prev) =>
          prev.map((item) =>
            item.id === inv.id
              ? {
                  ...item,
                  isDispatched: updated.isDispatched,
                  dispatchedByRole: updated.dispatchedByRole,
                }
              : item
          )
        );
      }
      toast.success(
        nextChecked
          ? `Invoice #${inv.id} marked as Shipped (${user?.role || 'ADMIN'})`
          : `Invoice #${inv.id} shipping status removed`
      );
    } catch (err: any) {
      // Revert optimistic update on failure
      setInvoices((prev) =>
        prev.map((item) =>
          item.id === inv.id
            ? {
                ...item,
                isDispatched: prevDispatched,
                dispatchedByRole: prevRole,
              }
            : item
        )
      );
      toast.error(err.message || 'Failed to update dispatch status');
    } finally {
      setTogglingDispatchId(null);
    }
  };

  const handleOpenReturnModal = (inv: InvoiceRecord) => {
    setReturnInvoice(inv);
    setReturnModalOpen(true);
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

  /**
   * Helper to format a JavaScript Date into YYYY-MM-DD in local time
   * without UTC conversion drift or calendar day shifting.
   */
  const formatLocalDate = (d: Date | undefined): string | undefined => {
    if (!d) return undefined;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  /**
   * Count of active non-default secondary filters for badge indicator
   */
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedCustomerId !== 'all') count++;
    if (selectedMethod !== 'ALL') count++;
    if (startDate) count++;
    if (endDate) count++;
    if (sortBy !== 'newest') count++;
    return count;
  }, [selectedCustomerId, selectedMethod, startDate, endDate, sortBy]);

  /**
   * Reset all secondary filters and search query back to default view
   */
  const handleClearAllFilters = () => {
    setSelectedCustomerId('all');
    setSelectedMethod('ALL');
    setStartDate(undefined);
    setEndDate(undefined);
    setSortBy('newest');
    setSearchQuery('');
    setPage(1);
  };

  /**
   * Single Unified Invoices Fetcher with race-condition protection.
   * Dispatches intact query strings (e.g. #INV123, INV-123, digits, customer names/phones)
   * without destructive client-side stripping to let backend order.service.ts normalize regex patterns.
   */
  const fetchInvoices = async (targetPage = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(targetPage));
      params.set('limit', '12');
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (selectedCustomerId !== 'all') params.set('customerId', selectedCustomerId);
      if (selectedMethod !== 'ALL') params.set('paymentMethod', selectedMethod);
      if (sortBy) params.set('sortBy', sortBy);

      const sDateStr = formatLocalDate(startDate);
      const eDateStr = formatLocalDate(endDate);
      if (sDateStr) params.set('startDate', sDateStr);
      if (eDateStr) params.set('endDate', eDateStr);

      const res = await get<any>(`/orders/invoices?${params.toString()}`);
      let list = res.data || [];
      if (sortBy === 'highest_due') {
        list = [...list].sort((a, b) => {
          const dueA = Math.max(0, (Number(a.totalAmount) || 0) - (Number(a.paidAmount) || 0));
          const dueB = Math.max(0, (Number(b.totalAmount) || 0) - (Number(b.paidAmount) || 0));
          return dueB - dueA;
        });
      } else if (sortBy === 'most_overdue') {
        list = [...list]
          .filter((a) => Math.max(0, (Number(a.totalAmount) || 0) - (Number(a.paidAmount) || 0)) > 0)
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      } else if (sortBy === 'least_overdue') {
        list = [...list]
          .filter((a) => Math.max(0, (Number(a.totalAmount) || 0) - (Number(a.paidAmount) || 0)) > 0)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }
      setInvoices(list);
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
   * Handles Initial Load, Pagination, Customer Filter, Payment Method, Date Range & Debounced Search seamlessly.
   */
  useEffect(() => {
    // If it's the very first time the page opens, fetch immediately (0ms delay)
    if (isFirstRender.current) {
      isFirstRender.current = false;
      fetchInvoices(page);
      return;
    }

    // For any subsequent changes (typing in search, picking a customer, clicking a payment pill, changing dates)
    const delay = searchQuery ? 350 : 0; // Instant for dropdowns/pickers, 350ms debounce for typing
    const timer = setTimeout(() => {
      fetchInvoices(page);
    }, delay);

    return () => clearTimeout(timer);
  }, [page, selectedCustomerId, selectedMethod, startDate, endDate, sortBy, searchQuery]);

  // Real-time SSE synchronization: live refetch when invoices are created, updated, or deleted
  useSSE({
    events: {
      invoice_created: () => {
        fetchInvoices(page);
      },
      invoice_updated: () => {
        fetchInvoices(page);
      },
      invoice_deleted: () => {
        fetchInvoices(page);
      },
    },
  });

  // Comprehensive Invoice Metrics
  const totalInvoicesGenerated = totalCount;
  const totalInvoiceRevenue = useMemo(() => {
    return invoices.reduce((sum, i) => sum + (Number(i.totalAmount) || 0), 0);
  }, [invoices]);
  const totalCustomerDebt = useMemo(() => {
    return invoices.reduce((sum, i) => sum + Math.max(0, (Number(i.totalAmount) || 0) - (Number(i.paidAmount) || 0)), 0);
  }, [invoices]);

  // Handle Invoice Deletion with optimistic/dynamic UI removal and robust error feedback
  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await del(`/orders/invoices/${deleteId}`);
      toast.success("Invoice deleted successfully");
      // Dynamically remove the deleted card/row from the UI state
      setInvoices((prev) => prev.filter((item) => item.id !== deleteId));
      setTotalCount((prev) => Math.max(0, prev - 1));
      setDeleteId(null);
    } catch (err: any) {
      const errMsg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        'Failed to delete invoice';
      toast.error(errMsg);
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
    <div className="flex flex-col gap-2.5 sm:gap-4 p-0 min-h-[calc(100vh-5rem)] w-full">
      {/* Top Header & Refresh */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-zinc-900/60 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-zinc-800">
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
            onClick={() => navigate('/system/quick-invoice')}
            className="h-9 gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            + New Sale
          </Button>
        </div>
      </div>

      {/* Metrics Row matching CustomersPage design */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4 w-full">
        <div className="rounded-2xl border p-3 sm:p-4 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 shadow-xs flex justify-between items-center">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Total Invoices</span>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{totalInvoicesGenerated}</h3>
          </div>
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <FileText className="size-5" />
          </div>
        </div>

        <div className="rounded-2xl border p-3 sm:p-4 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 shadow-xs flex justify-between items-center">
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

        <div className="rounded-2xl border p-3 sm:p-4 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 shadow-xs flex justify-between items-center">
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

      {/* ── Mobile View (< 1024px): Clean Search Bar + Collapsible Filters Drawer Button ── */}
      <div className="block lg:hidden bg-white dark:bg-zinc-900/60 p-3 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-2.5">
        <div className="flex items-center gap-2">
          {/* Primary Search Bar */}
          <div className="relative flex-1">
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

          {/* Sleek Filters Toggle Button with Active Badge */}
          <button
            type="button"
            onClick={() => setMobileFiltersOpen((prev) => !prev)}
            className={`h-9 px-3 rounded-xl border flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-all shrink-0 select-none ${
              mobileFiltersOpen || activeFiltersCount > 0
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
                : 'bg-slate-50 dark:bg-zinc-800/60 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800'
            }`}
          >
            <SlidersHorizontal className="size-3.5" />
            <span>Filters</span>
            {activeFiltersCount > 0 && (
              <span className="size-4 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center ml-0.5">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>

        {/* Collapsible Expansion Tray */}
        {mobileFiltersOpen && (
          <div className="pt-2.5 border-t border-slate-100 dark:border-zinc-800/80 space-y-2.5 animate-in fade-in-0 slide-in-from-top-2 duration-150">
            {/* Responsive 2-column grid inside collapsible filter tray */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
              {/* 1. Customer Filter  */}
              <div className="min-w-0">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Customer Account
                </label>
                <SearchableSelect
                  value={selectedCustomerId}
                  onValueChange={(val) => {
                    setSelectedCustomerId(val);
                    if (page !== 1) setPage(1);
                  }}
                  options={[
                    { value: 'all', label: 'All Customers' },
                    ...customers.map((c) => ({
                      value: String(c.id),
                      label: `${c.name} (${c.phone})`,
                    })),
                  ]}
                  placeholder="All Customers"
                  searchPlaceholder="Search customer..."
                  dark={dark}
                  className="h-9 text-xs"
                />
              </div>

              {/* 2. Unified Highlighted Date Range Picker */}
              <div className="min-w-0">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Invoice Date Range
                </label>
                <DateRangePicker
                  date={{ from: startDate, to: endDate }}
                  onDateChange={(range) => {
                    setStartDate(range?.from);
                    setEndDate(range?.to);
                    if (page !== 1) setPage(1);
                  }}
                  placeholder="Pick date range..."
                  className="h-9 text-xs w-full"
                />
              </div>

              {/* 3. Payment Method */}
              <div className="min-w-0">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Payment Method
                </label>
                <SearchableSelect
                  value={selectedMethod}
                  onValueChange={(val) => {
                    setSelectedMethod(val);
                    if (page !== 1) setPage(1);
                  }}
                  options={PAYMENT_METHOD_OPTIONS}
                  placeholder="All Methods"
                  searchPlaceholder="Search method..."
                  dark={dark}
                  className="h-9 text-xs"
                />
              </div>

              {/* 4. Sort Order */}
              <div className="min-w-0">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Sort Order
                </label>
                <SearchableSelect
                  value={sortBy}
                  onValueChange={(val) => {
                    setSortBy(val);
                    if (page !== 1) setPage(1);
                  }}
                  options={SORT_OPTIONS}
                  placeholder="Sort Invoices..."
                  searchPlaceholder="Search sort order..."
                  dark={dark}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Clear All Filters Shortcut */}
            {(activeFiltersCount > 0 || searchQuery) && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-slate-500">
                  {activeFiltersCount} active {activeFiltersCount === 1 ? 'filter' : 'filters'}
                </span>
                <button
                  type="button"
                  onClick={handleClearAllFilters}
                  className="text-xs font-semibold text-rose-500 hover:text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <X className="size-3.5" /> Clear All Filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Desktop View (≥ 1024px): Inline Executive Filter Matrix with Primary Search Bar ── */}
      <div className="hidden lg:flex items-center gap-2.5 bg-white dark:bg-zinc-900/60 p-3.5 rounded-2xl border border-slate-200 dark:border-zinc-800">
        {/* Search Bar (Priority flex-1 min-w-[260px]) */}
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (page !== 1) setPage(1);
            }}
            placeholder="Search invoice #, customer, phone..."
            className="pl-9 h-9 text-xs w-full"
          />
        </div>

        {/* Customer Select (w-44 xl:w-48) */}
        <div className="w-44 xl:w-48 shrink-0">
          <SearchableSelect
            value={selectedCustomerId}
            onValueChange={(val) => {
              setSelectedCustomerId(val);
              if (page !== 1) setPage(1);
            }}
            options={[
              { value: 'all', label: 'All Customers' },
              ...customers.map((c) => ({
                value: String(c.id),
                label: `${c.name} (${c.phone})`,
              })),
            ]}
            placeholder="All Customers..."
            searchPlaceholder="Search customer..."
            dark={dark}
          />
        </div>

        {/* Payment Method Selector (w-36 xl:w-40) */}
        <div className="w-36 xl:w-40 shrink-0">
          <SearchableSelect
            value={selectedMethod}
            onValueChange={(val) => {
              setSelectedMethod(val);
              if (page !== 1) setPage(1);
            }}
            options={PAYMENT_METHOD_OPTIONS}
            placeholder="Payment Method"
            searchPlaceholder="Search method..."
            dark={dark}
          />
        </div>

        {/* Unified Date Range Picker (w-44 xl:w-48) */}
        <div className="w-44 xl:w-48 shrink-0">
          <DateRangePicker
            date={{ from: startDate, to: endDate }}
            onDateChange={(range) => {
              setStartDate(range?.from);
              setEndDate(range?.to);
              if (page !== 1) setPage(1);
            }}
            placeholder="Select Date Range..."
            className="h-9 text-xs w-full"
          />
        </div>

        {/* Sort Selector & Clear All Shortcut (w-40 xl:w-44) */}
        <div className="w-40 xl:w-44 shrink-0 flex items-center gap-1.5">
          <div className="flex-1 min-w-0">
            <SearchableSelect
              value={sortBy}
              onValueChange={(val) => {
                setSortBy(val);
                if (page !== 1) setPage(1);
              }}
              options={SORT_OPTIONS}
              placeholder="Sort..."
              searchPlaceholder="Sort by..."
              dark={dark}
            />
          </div>
          {(activeFiltersCount > 0 || searchQuery) && (
            <button
              type="button"
              onClick={handleClearAllFilters}
              className="size-9 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 hover:border-rose-300 dark:hover:border-rose-800 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
              title="Clear All Filters"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Invoices Table & Mobile/Tablet Adaptive Touch Card View */}
      <div className="flex-1 bg-white dark:bg-zinc-900/60 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden flex flex-col">
        {/* ── Mobile & Tablet (< 1024px) Responsive Touch-Friendly Card View ── */}
        <div className="block lg:hidden flex-1 overflow-y-auto p-2 sm:p-4 space-y-2.5 sm:space-y-3">
          {loading ? (
            <div className="py-12 text-center text-slate-400">
              <Loader2 className="size-6 animate-spin mx-auto mb-2 text-emerald-500" />
              <span>Loading invoices...</span>
            </div>
          ) : invoices.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <FileText className="size-8 opacity-30 mx-auto mb-2" />
              <span>No invoices found matching current criteria.</span>
            </div>
          ) : (
            invoices.map((inv) => {
              const creditDue = Math.max(0, inv.totalAmount - inv.paidAmount);
              const isUnderpaid = creditDue > 0;
              const ageInfo = getInvoiceAgeInfo(inv.createdAt);
              const subtotalAmt = Number(inv.subtotal ?? (inv.totalAmount + (inv.discount || 0)));
              const discountAmt = Number(inv.discount || 0);
              const customerBal = inv.customer?.outstandingBalance !== undefined
                ? Number(inv.customer.outstandingBalance)
                : creditDue;
              const canDelete = canDeleteInvoice(inv);

              return (
                <div
                  key={inv.id}
                  className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 p-3 sm:p-3.5 shadow-sm space-y-2.5 sm:space-y-3 hover:border-slate-300 dark:hover:border-zinc-700 transition-colors w-full"
                >
                  {/* Top Row: #INV{id} badge, Wholesale/Retail pill, Date, and payment status badge */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        onClick={() => navigate(`/system/quick-checkout?editInvoiceId=${inv.id}`)}
                        className="font-mono font-bold text-xs px-2.5 py-1 rounded bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white cursor-pointer hover:underline hover:text-emerald-600 dark:hover:text-emerald-400 select-none"
                        title="Click to edit invoice in POS"
                      >
                        #INV{inv.id}
                      </span>
                      {inv.source === 'POS_WHOLESALE' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                          Wholesale
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300">
                          Retail
                        </span>
                      )}
                      {/* Creator Role Badge inline with Invoice Type */}
                      {inv.user?.role && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
                          {inv.user.role}
                        </span>
                      )}
                      {inv.returns && inv.returns.length > 0 && (
                        <span
                          onClick={() => handleOpenReturnModal(inv)}
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1 cursor-pointer"
                          title="Click to view returns history"
                        >
                          <RotateCcw className="size-2.5" />
                          Returns ({inv.returns.length})
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center items-end gap-1.5">
                      {/* Shipped / Dispatch Checkbox Tracker */}
                      <label
                        onClick={(e) => e.stopPropagation()}
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border cursor-pointer select-none transition-colors ${
                          inv.isDispatched
                            ? getRoleBadgeStyle(inv.dispatchedByRole)
                            : 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-zinc-800/60 dark:text-zinc-400 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800'
                        }`}
                        title="Shipped / Dispatch Tracking"
                      >
                        <Checkbox
                          checked={!!inv.isDispatched}
                          disabled={togglingDispatchId === inv.id}
                          onCheckedChange={(checked) => handleToggleDispatch(inv, Boolean(checked))}
                          className="size-3.5 data-[state=checked]:bg-zinc-900 data-[state=checked]:border-zinc-900 data-[state=checked]:text-white dark:data-[state=checked]:bg-white dark:data-[state=checked]:border-white dark:data-[state=checked]:text-zinc-900"
                        />
                        <span className="font-semibold">
                          {inv.isDispatched ? `Shipped (${inv.dispatchedByRole || 'ADMIN'})` : 'Shipped'}
                        </span>
                      </label>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-500 font-mono">
                          {new Date(inv.createdAt).toISOString().split('T')[0]}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold uppercase ${
                            inv.paymentMethod === 'CHEQUE' || getInvoiceChequeList(inv).length > 0
                              ? 'border-amber-500 text-amber-600 bg-amber-500/10'
                              : inv.paymentMethod === 'CREDIT' || isUnderpaid
                              ? 'border-rose-500 text-rose-600 bg-rose-500/10'
                              : 'border-emerald-500 text-emerald-600 bg-emerald-500/10'
                          }`}
                        >
                          {getInvoiceChequeList(inv).length > 1
                            ? 'SPLIT'
                            : (getInvoiceChequeList(inv).length === 1 && inv.paymentMethod !== 'SPLIT'
                            ? 'CHEQUE'
                            : inv.paymentMethod)}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Customer Info: Name, bold contact number, and accumulated credit balance */}
                  <div className="flex items-start justify-between gap-2 pt-1 border-t border-slate-100 dark:border-zinc-800/60">
                    <div className="min-w-0">
                      <h4
                        onClick={() => navigate(`/system/quick-checkout?editInvoiceId=${inv.id}`)}
                        className="font-bold text-sm text-slate-900 dark:text-white truncate cursor-pointer hover:underline hover:text-emerald-600 dark:hover:text-emerald-400"
                        title="Click to edit invoice in POS"
                      >
                        {inv.customerName}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 font-mono">
                          {inv.customerPhone || inv.customer?.phone || 'No Contact'}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Credit Balance</span>
                      <span className={`text-xs font-mono font-bold ${customerBal > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {customerBal > 0 ? `Rs. ${customerBal.toLocaleString()}` : 'Rs. 0.00'}
                      </span>
                    </div>
                  </div>

                  {/* Financials: Subtotal, Discount, Net Amount, Paid, and Credit Due in high-contrast legible font */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50/90 dark:bg-zinc-950/60 p-2.5 rounded-lg text-xs border border-slate-100 dark:border-zinc-800/60">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Subtotal</span>
                      <span className="font-mono font-semibold text-slate-800 dark:text-zinc-200">
                        Rs. {subtotalAmt.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Discount</span>
                      <span className="font-mono font-semibold text-slate-800 dark:text-zinc-200">
                        Rs. {discountAmt.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Net Total / Paid</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white block">
                        Rs. {Number(inv.totalAmount).toLocaleString()}
                      </span>
                      <span className="font-mono text-[11px] text-emerald-600 font-semibold block">
                        Paid: Rs. {Number(inv.paidAmount).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Credit Due</span>
                      {creditDue > 0 ? (
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                          <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                            - Rs. {creditDue.toLocaleString()}
                          </span>
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-tight ${ageInfo.badgeClassName}`}
                            title={`Issued ${ageInfo.days} days ago (${new Date(inv.createdAt).toISOString().split('T')[0]})`}
                          >
                            {ageInfo.label}
                          </span>
                        </div>
                      ) : (
                        <span className="font-mono font-bold text-slate-400 block">Rs. 0.00</span>
                      )}
                    </div>
                  </div>

                  {/* Touch-Friendly Action Bar (Minimum 44x44px Tap Targets) with Complete 7-Action Desktop Parity */}
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-zinc-800/60">
                    {/* Direct 1-tap WhatsApp Dispatch */}
                    <button
                      type="button"
                      onClick={() => handleInitiateWhatsApp(inv)}
                      className="flex-1 min-h-[44px] px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer select-none active:scale-[0.98]"
                      title="Send WhatsApp Invoice Message"
                    >
                      <MessageCircle className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span>WhatsApp</span>
                    </button>

                    {/* Single-tap trigger to download official invoice PDF */}
                    <button
                      type="button"
                      onClick={() => handleDownloadPdf(inv.id)}
                      className="flex-1 min-h-[44px] px-3 py-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-400 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer select-none active:scale-[0.98]"
                      title="Download Official Invoice PDF"
                    >
                      <Download className="size-4 shrink-0 text-blue-600 dark:text-blue-400" />
                      <span>PDF</span>
                    </button>

                    {/* Quick POS Edit Action */}
                    <button
                      type="button"
                      onClick={() => navigate(`/system/quick-checkout?editInvoiceId=${inv.id}`)}
                      className="min-h-[44px] min-w-[44px] px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer select-none"
                      title="Edit Invoice in Quick Checkout"
                    >
                      <Pencil className="size-4 shrink-0" />
                      <span className="hidden sm:inline">Edit</span>
                    </button>

                    {/* Full 3-Dots DropdownMenu (All 7 Desktop Actions for 100% Mobile Parity) */}
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="min-h-[44px] min-w-[44px] px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 flex items-center justify-center transition-colors cursor-pointer select-none"
                          title="More Invoice Actions"
                        >
                          <MoreVertical className="size-4.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56 text-xs font-medium">
                        {/* Dedicated Invoice Summary & Cheques Action */}
                        <DropdownMenuItem
                          onClick={() => setSummaryModalInvoice(inv)}
                          className="gap-2.5 cursor-pointer py-2 text-blue-600 focus:text-blue-700 font-semibold"
                        >
                          <ReceiptText className="size-4 text-blue-600" />
                          <span>Invoice Summary &amp; Cheques</span>
                        </DropdownMenuItem>

                        {/* 1. A4 Print Preview */}
                        <DropdownMenuItem
                          onClick={() => {
                            setPrintInvoice(inv);
                            setPrintModalOpen(true);
                          }}
                          className="gap-2.5 cursor-pointer py-2"
                        >
                          <Printer className="size-4 text-slate-500" />
                          <span>A4 Print Preview</span>
                        </DropdownMenuItem>

                        {/* 2. Direct PDF Download */}
                        <DropdownMenuItem
                          onClick={() => handleDownloadPdf(inv.id)}
                          className="gap-2.5 cursor-pointer py-2 text-blue-600 focus:text-blue-700 font-medium"
                        >
                          <Download className="size-4 text-blue-600" />
                          <span>Direct PDF Download</span>
                        </DropdownMenuItem>

                        {/* 3. WhatsApp Invoice Slip */}
                        <DropdownMenuItem
                          onClick={() => handleInitiateWhatsApp(inv)}
                          className="gap-2.5 cursor-pointer py-2 text-emerald-600 focus:text-emerald-700 font-medium"
                        >
                          <MessageCircle className="size-4 text-emerald-600" />
                          <span>WhatsApp Invoice Slip</span>
                        </DropdownMenuItem>

                        {/* 4. Pay Due / Settle Customer Balance */}
                        <DropdownMenuItem
                          onClick={() => {
                            setSettlingInvoice(inv);
                            setSettleAmount(String(creditDue > 0 ? creditDue : customerBal));
                            setSettleMethod('CASH');
                            setSettleDateTime(getCurrentLocalISOString());
                            setSettleReference('');
                          }}
                          className="gap-2.5 cursor-pointer py-2 text-amber-600 focus:text-amber-700 font-semibold"
                        >
                          <Wallet className="size-4 text-amber-600" />
                          <span>Pay Due / Settle Balance {creditDue > 0 ? `(Rs. ${creditDue.toLocaleString()})` : ''}</span>
                        </DropdownMenuItem>

                        {/* 5. Return & Exchange */}
                        <DropdownMenuItem
                          onClick={() => handleOpenReturnModal(inv)}
                          className="gap-2.5 cursor-pointer py-2 text-indigo-600 focus:text-indigo-700 font-medium"
                        >
                          <RotateCcw className="size-4 text-indigo-600" />
                          <span>Return &amp; Exchange</span>
                        </DropdownMenuItem>

                        {/* 6. Edit Invoice */}
                        <DropdownMenuItem
                          onClick={() => navigate(`/system/quick-checkout?editInvoiceId=${inv.id}`)}
                          className="gap-2.5 cursor-pointer py-2 text-slate-700 dark:text-zinc-200 font-medium"
                        >
                          <Pencil className="size-4 text-slate-600" />
                          <span>Edit Invoice</span>
                        </DropdownMenuItem>

                        {/* 7. Delete Invoice */}
                        {canDelete && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeleteId(inv.id)}
                              className="gap-2.5 cursor-pointer py-2 text-rose-600 focus:text-rose-700 focus:bg-rose-50 dark:focus:bg-rose-950/30 font-semibold"
                            >
                              <Trash2 className="size-4 text-rose-600" />
                              <span>Delete Invoice</span>
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Desktop (lg:) Standard Full Data Table Layout ── */}
        <div className="hidden lg:block overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/40 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-3 text-center">Shipped</th>
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
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Loader2 className="size-6 animate-spin mx-auto mb-2 text-emerald-500" />
                    <span>Loading invoices...</span>
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <FileText className="size-8 opacity-30 mx-auto mb-2" />
                    <span>No invoices found matching current criteria.</span>
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => {
                  const creditDue = Math.max(0, inv.totalAmount - inv.paidAmount);
                  const isUnderpaid = creditDue > 0;
                  const ageInfo = getInvoiceAgeInfo(inv.createdAt);
                  const canDelete = canDeleteInvoice(inv);

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/30 transition-colors">
                      {/* Invoice ID, Type & Role Badge - Clickable to POS edit (matching OrdersPage layout) */}
                      <td 
                        onClick={() => navigate(`/system/quick-invoice?editInvoiceId=${inv.id}`)}
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
                          {/* Creator Role Badge inline next to Invoice Type */}
                          {inv.user?.role && (
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase border ${getRoleBadgeStyle(inv.user.role)}`}>
                              {inv.user.role}
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
                        onClick={() => navigate(`/system/quick-invoice?editInvoiceId=${inv.id}`)}
                        className="py-3 px-4 cursor-pointer group/inv-cust select-none"
                        title="Click to edit invoice in POS"
                      >
                        <div className="font-semibold text-slate-900 dark:text-white group-hover/inv-cust:text-emerald-600 dark:group-hover/inv-cust:text-emerald-400 group-hover/inv-cust:underline transition-colors">
                          {inv.customerName}
                        </div>
                        {inv.customerPhone && <span className="text-[10px] text-slate-400 font-mono">{inv.customerPhone}</span>}
                      </td>
                      {/* Shipped / Dispatch Tracking Column */}
                      <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex flex-col items-center justify-center gap-1">
                          <label className="flex items-center gap-1.5 cursor-pointer select-none">
                            <Checkbox
                              checked={!!inv.isDispatched}
                              disabled={togglingDispatchId === inv.id}
                              onCheckedChange={(checked) => handleToggleDispatch(inv, Boolean(checked))}
                              aria-label={`Toggle Shipped status for invoice ${inv.id}`}
                              className="size-4 data-[state=checked]:bg-zinc-900 data-[state=checked]:border-zinc-900 data-[state=checked]:text-white dark:data-[state=checked]:bg-white dark:data-[state=checked]:border-white dark:data-[state=checked]:text-zinc-900"
                            />
                            <span className="text-[11px] font-medium text-slate-600 dark:text-zinc-400">
                              Shipped
                            </span>
                          </label>
                          {inv.isDispatched && inv.dispatchedByRole && (
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase border leading-none ${getRoleBadgeStyle(inv.dispatchedByRole)}`}>
                              {inv.dispatchedByRole}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold uppercase ${
                            inv.paymentMethod === 'CHEQUE' || getInvoiceChequeList(inv).length > 0
                              ? 'border-amber-500 text-amber-600 bg-amber-500/10'
                              : inv.paymentMethod === 'CREDIT' || isUnderpaid
                              ? 'border-rose-500 text-rose-600 bg-rose-500/10'
                              : 'border-emerald-500 text-emerald-600 bg-emerald-500/10'
                          }`}
                        >
                          {getInvoiceChequeList(inv).length > 1
                            ? 'SPLIT'
                            : (getInvoiceChequeList(inv).length === 1 && inv.paymentMethod !== 'SPLIT'
                            ? 'CHEQUE'
                            : inv.paymentMethod)}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                        Rs. {Number(inv.totalAmount).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-600">
                        Rs. {Number(inv.paidAmount).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        {creditDue > 0 ? (
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="font-bold text-rose-600 dark:text-rose-400">
                              - Rs. {creditDue.toLocaleString()}
                            </span>
                            <span
                              className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold tracking-tight ${ageInfo.badgeClassName}`}
                              title={`Issued ${ageInfo.days} days ago on ${new Date(inv.createdAt).toISOString().split('T')[0]}`}
                            >
                              {ageInfo.label}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 dark:text-zinc-500 font-bold">Rs. 0.00</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center">
                          {/* Vertical 3-Dots Action Dropdown Menu */}
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-8 text-slate-500 hover:text-slate-900 dark:hover:text-white">
                                <MoreVertical className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52 text-xs font-medium">
                              {/* Dedicated Invoice Summary & Cheques Action */}
                              <DropdownMenuItem
                                onClick={() => setSummaryModalInvoice(inv)}
                                className="gap-2 cursor-pointer text-blue-600 focus:text-blue-700 font-semibold"
                              >
                                <ReceiptText className="size-3.5 text-blue-600" />
                                Invoice Summary &amp; Cheques
                              </DropdownMenuItem>

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

                            {/* ⭐ Pay Due Balance Action (only shown if creditDue > 0) */}
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

                            {/* Smart WhatsApp Share Action */}
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

                            {canDelete && (
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

      {/* Delete Confirmation Dialog (Admin & Scoped Rep) */}
      {(isAdmin || isRep) && (
        <Dialog open={deleteId !== null} onOpenChange={(open) => !open && !deleting && setDeleteId(null)}>
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
              <Button variant="outline" size="sm" disabled={deleting} onClick={() => setDeleteId(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={deleting}
                onClick={confirmDelete}
                className="bg-rose-600 hover:bg-rose-700 font-bold"
              >
                {deleting && <Loader2 className="size-3.5 animate-spin mr-1" />}
                {deleting ? 'Deleting...' : 'Confirm Delete'}
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
        <DialogContent className="w-full max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl">
          <DialogHeader className="pb-1">
            <DialogTitle className="flex items-center gap-2 text-base text-slate-900 dark:text-white font-bold">
              <Wallet className="size-5 text-emerald-600" />
              Settle Due for Invoice #INV{settlingInvoice?.id}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-zinc-400">
              Record customer payment against outstanding invoice balance.
            </DialogDescription>
          </DialogHeader>

          {settlingInvoice && (
            <form onSubmit={handleSettleInvoiceSubmit} className="space-y-4 pt-1">
              {/* Header Card: Wrap customer meta with proper vertical padding and distinct pills */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/70 border border-slate-200/80 dark:border-zinc-800/80 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-zinc-400 font-medium">Customer:</span>
                  <span className="font-bold text-slate-800 dark:text-zinc-200 px-2 py-0.5 rounded-md bg-white dark:bg-zinc-800 border border-slate-200/60 dark:border-zinc-700/60">
                    {settlingInvoice.customerName || 'Customer'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-zinc-400 font-medium">Invoice Total:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-zinc-200 px-2 py-0.5 rounded-md bg-white dark:bg-zinc-800 border border-slate-200/60 dark:border-zinc-700/60">
                    Rs. {Number(settlingInvoice.totalAmount).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200/70 dark:border-zinc-800/70 pt-1.5 text-xs">
                  <span className="text-slate-600 dark:text-zinc-300 font-semibold">Remaining Due Balance:</span>
                  <span className="font-mono font-extrabold text-rose-600 dark:text-rose-400 text-sm px-2.5 py-0.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200/80 dark:border-rose-900/50">
                    Rs. {(settlingInvoice.totalAmount - settlingInvoice.paidAmount).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Inputs Grid: Convert Amount and Payment Method into a responsive 2-column grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
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
                    className="h-10 font-mono font-bold text-sm bg-white dark:bg-zinc-900 rounded-xl"
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
                    className="h-10 rounded-xl"
                  />
                </div>
              </div>

              {/* Payment Timestamp Row: Ensure date picker and time inputs fit inside container boundaries without horizontal overflow */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Payment Date &amp; Timestamp *
                </label>
                <div className="flex flex-col sm:flex-row gap-2.5 w-full">
                  <DateTimePicker
                    value={settleDateTime}
                    onChange={setSettleDateTime}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Payment Reference / Cheque No
                </label>
                <Input
                  value={settleReference}
                  onChange={(e) => setSettleReference(e.target.value)}
                  placeholder="e.g. Part payment cash / Cheque #8812"
                  className="h-10 text-xs bg-white dark:bg-zinc-900 rounded-xl"
                />
              </div>

              {/* Action Footer: Add clear spacing (pt-2 space-y-2) */}
              <div className="pt-2 space-y-2">
                <Button
                  type="submit"
                  disabled={isSettling}
                  className="h-11 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-sm active:scale-[0.98] transition-all cursor-pointer inline-flex items-center justify-center gap-2"
                >
                  {isSettling ? <Loader2 className="size-4 animate-spin" /> : <Banknote className="size-4" />}
                  Confirm Payment
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSettlingInvoice(null)}
                  className="h-10 w-full border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors font-medium text-xs sm:text-sm"
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ⭐ INVOICE ITEM RETURN & RESTOCK MODAL */}
      <ReturnOrderModal
        isOpen={returnModalOpen}
        onClose={() => {
          setReturnModalOpen(false);
          setReturnInvoice(null);
        }}
        invoice={returnInvoice}
        onReturnSuccess={() => {
          fetchInvoices(page);
        }}
      />

      {/* ⭐ COMPREHENSIVE INVOICE DETAILS & CHEQUE MANAGEMENT MODAL */}
      <InvoiceDetailModal
        isOpen={!!summaryModalInvoice}
        onClose={() => setSummaryModalInvoice(null)}
        invoice={summaryModalInvoice}
        onInvoiceUpdated={() => {
          fetchInvoices(page);
          if (summaryModalInvoice) {
            get<any>(`/orders/invoices/${summaryModalInvoice.id}`)
              .then((res) => {
                if (res) setSummaryModalInvoice(res);
              })
              .catch(() => {});
          }
        }}
        onPrintPreview={(inv) => {
          setPrintInvoice(inv);
          setPrintModalOpen(true);
        }}
        onDownloadPdf={handleDownloadPdf}
        onWhatsApp={handleInitiateWhatsApp}
      />
    </div>
  );
};