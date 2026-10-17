import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { DateRangePicker } from '../components/ui/date-range-picker';
import { OrderDetailModal } from '../components/orders/OrderDetailModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { get, downloadBlob, post, del } from '../lib/api';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSSE } from '../hooks/useSSE';
import { openWhatsAppChat, generateSalesOrderWhatsAppMessage } from '../utils/whatsapp';
import { SearchableSelect, type SearchableSelectOption } from '../components/ui/searchable-select';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../components/ui/dropdown-menu';
import {
  Search,
  Plus,
  RefreshCw,
  FileDown,
  MessageSquare,
  ArrowRightCircle,
  Eye,
  Loader2,
  Calendar,
  User,
  Phone,
  Package,
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Edit,
  Banknote,
  Clock,
  SlidersHorizontal,
  X,
  Trash2,
} from 'lucide-react';

/**
 * Filter options for order status with label and value definitions for SearchableSelect
 */
const STATUS_OPTIONS: SearchableSelectOption[] = [
  { value: 'ALL', label: 'All Orders' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'CONVERTED', label: 'Converted' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

/**
 * Sorting options matching InvoicesPage architecture adapted for orders
 */
const SORT_OPTIONS: SearchableSelectOption[] = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'highest_amount', label: 'Highest Amount' },
  { value: 'lowest_amount', label: 'Lowest Amount' },
];

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

export const OrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isRep } = useAuth();
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';

  // Primary Data State
  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<{ id: number; name: string; phone: string }[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filter States matching InvoicesPage Standard
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [sortBy, setSortBy] = useState<string>('newest');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState<boolean>(false);

  // Pagination State
  const [page, setPage] = useState<number>(1);
  const [pagination, setPagination] = useState<{
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  // Modal inspection state
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [activePdfLoadingId, setActivePdfLoadingId] = useState<number | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Fetch Customers for customer filter dropdown
  useEffect(() => {
    get<any[]>('/customers')
      .then((data) => setCustomers(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // Customer options for SearchableSelect
  const customerOptions: SearchableSelectOption[] = useMemo(() => [
    { value: 'all', label: 'All Customers' },
    { value: 'walkin', label: 'Walk-in / Guest Customer' },
    ...customers.map((c) => ({
      value: String(c.id),
      label: `${c.name} (${c.phone || 'No phone'})`,
    })),
  ], [customers]);

  /**
   * Count of active non-default secondary filters for badge indicator
   */
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== 'ALL') count++;
    if (selectedCustomerId !== 'all') count++;
    if (startDate) count++;
    if (endDate) count++;
    if (sortBy !== 'newest') count++;
    return count;
  }, [statusFilter, selectedCustomerId, startDate, endDate, sortBy]);

  /**
   * Reset all secondary filters and search query back to default view
   */
  const handleClearAllFilters = () => {
    setStatusFilter('ALL');
    setSelectedCustomerId('all');
    setStartDate(undefined);
    setEndDate(undefined);
    setSortBy('newest');
    setSearch('');
    setPage(1);
  };

  /**
   * Unified Orders Fetcher with search, status, customer, date range, and sorting params
   */
  const fetchOrders = useCallback(async (targetPage = page) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(targetPage));
      params.set('limit', '20');
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (selectedCustomerId !== 'all') params.set('customerId', selectedCustomerId);
      if (sortBy) params.set('sortBy', sortBy);

      const sDateStr = formatLocalDate(startDate);
      const eDateStr = formatLocalDate(endDate);
      if (sDateStr) params.set('startDate', sDateStr);
      if (eDateStr) params.set('endDate', eDateStr);

      const res = await get<any>(`/sales-orders?${params.toString()}`);
      if (res && Array.isArray(res.orders)) {
        setOrders(res.orders);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      } else {
        setOrders([]);
      }
    } catch (err: any) {
      console.error('Failed to fetch sales orders:', err);
      toast.error('Failed to load orders list');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, selectedCustomerId, sortBy, startDate, endDate]);

  // Flag to differentiate initial load vs typing in search
  const isFirstRender = useRef(true);

  /**
   * Debounced filter and search coordinator matching InvoicesPage
   */
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      fetchOrders(page);
      return;
    }

    const delay = search ? 350 : 0;
    const timer = setTimeout(() => {
      fetchOrders(page);
    }, delay);

    return () => clearTimeout(timer);
  }, [page, statusFilter, selectedCustomerId, startDate, endDate, sortBy, search, fetchOrders]);

  // Real-time SSE synchronization: live refetch when orders are created, updated, or deleted
  useSSE({
    events: {
      order_created: () => {
        fetchOrders(page);
      },
      order_updated: () => {
        fetchOrders(page);
      },
      order_deleted: () => {
        fetchOrders(page);
      },
    },
  });

  // Summary KPI Calculations
  const totalOrdersCount = pagination.total;
  const totalPipelineValue = useMemo(() => {
    return orders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
  }, [orders]);

  const { pendingTotalValue, pendingCount } = useMemo(() => {
    const pendingOrders = orders.filter((o) => o.status === 'PENDING');
    const total = pendingOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
    return { pendingTotalValue: total, pendingCount: pendingOrders.length };
  }, [orders]);

  // Handle PDF download
  const handleDownloadPdf = async (e: React.MouseEvent, order: any) => {
    e.stopPropagation();
    try {
      setActivePdfLoadingId(order.id);
      await downloadBlob(
        `/sales-orders/${order.id}/pdf`,
        `Order-${order.orderNumber || order.id}.pdf`
      );
      toast.success('Order PDF downloaded');
    } catch (err: any) {
      toast.error(err.message || 'Failed to download Order PDF');
    } finally {
      setActivePdfLoadingId(null);
    }
  };

  // Handle WhatsApp Share
  const handleShareWhatsApp = (e: React.MouseEvent, order: any) => {
    e.stopPropagation();
    const phone = order.customerPhone || order.customer?.phone;
    if (!phone) {
      toast.warn('No contact phone available for WhatsApp');
      return;
    }
    const message = generateSalesOrderWhatsAppMessage(order);
    openWhatsAppChat(phone, message);
  };

  /**
   * Confirms and executes atomic deletion of a sales order via modern state-driven modal workflow.
   * Calls the backend deletion route which safely rolls back reserved inventory
   * and any customer financial balance adjustments within a transaction.
   */
  const handleConfirmDelete = async () => {
    if (!orderToDelete) return;
    const orderRef = orderToDelete.orderNumber || `ORD-${orderToDelete.id}`;

    try {
      setIsDeleting(true);
      await del<any>(`/sales-orders/${orderToDelete.id}`);
      toast.success(`Order ${orderRef} deleted successfully`);
      setOrderToDelete(null);
      fetchOrders(page);
    } catch (err: any) {
      console.error('Failed to delete order:', err);
      toast.error(err.message || 'Failed to delete order');
    } finally {
      setIsDeleting(false);
    }
  };

  /**
   * Navigate to Quick Invoice page loaded with Wholesale pricing and cart items
   */
  const handleConvertToInvoice = (e: React.MouseEvent, order: any) => {
    e.stopPropagation();
    navigate(`/system/quick-invoice?mode=WHOLESALE&convertOrderId=${order.id}`, {
      state: { convertOrder: order },
    });
  };

  /**
   * Navigate to Order Create page in Edit Mode with existing order data
   */
  const handleEditOrder = (e: React.MouseEvent, order: any) => {
    e.stopPropagation();
    navigate(`/system/orders/new?editOrderId=${order.id}`);
  };

  /**
   * Visual badge displaying role of the user who booked the presales order
   */
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

  /**
   * Action Popup Menu with View, Edit, Convert, Download PDF, and WhatsApp options
   */
  const renderActionMenu = (order: any) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="size-8 p-0 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="size-4" />
          <span className="sr-only">Open actions menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            setSelectedOrder(order);
            setIsDetailModalOpen(true);
          }}
          className="gap-2.5 cursor-pointer"
        >
          <Eye className="size-4 text-slate-500" />
          <span>View Details</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={(e) => handleEditOrder(e, order)}
          className="gap-2.5 cursor-pointer text-indigo-600 dark:text-indigo-400 focus:text-indigo-700 font-medium"
        >
          <Edit className="size-4 text-indigo-600 dark:text-indigo-400" />
          <span>Edit Order</span>
        </DropdownMenuItem>

        {order.status !== 'CONVERTED' && (
          <DropdownMenuItem
            onClick={(e) => handleConvertToInvoice(e, order)}
            className="gap-2.5 cursor-pointer text-emerald-600 dark:text-emerald-400 focus:text-emerald-700 font-medium"
          >
            <ArrowRightCircle className="size-4 text-emerald-600 dark:text-emerald-400" />
            <span>Convert to Invoice</span>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          disabled={activePdfLoadingId === order.id}
          onClick={(e) => handleDownloadPdf(e, order)}
          className="gap-2.5 cursor-pointer"
        >
          {activePdfLoadingId === order.id ? (
            <Loader2 className="size-4 animate-spin text-slate-500" />
          ) : (
            <FileDown className="size-4 text-slate-500" />
          )}
          <span>Download PDF</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={(e) => handleShareWhatsApp(e, order)}
          className="gap-2.5 cursor-pointer text-emerald-600 dark:text-emerald-400"
        >
          <MessageSquare className="size-4 text-emerald-600" />
          <span>WhatsApp Share</span>
        </DropdownMenuItem>

        {(user?.role === 'ADMIN' || (user?.role === 'REP' && (Number(order.userId) === Number(user?.id) || Number(order.userId) === Number((user as any)?.userId)))) && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                setOrderToDelete(order);
              }}
              className="gap-2.5 cursor-pointer text-rose-600 dark:text-rose-400 focus:text-rose-700 dark:focus:text-rose-300 font-medium"
            >
              <Trash2 className="size-4 text-rose-600 dark:text-rose-400" />
              <span>Delete Order</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="flex flex-col gap-2.5 sm:gap-4 p-0 min-h-[calc(100vh-5rem)] w-full max-w-7xl mx-auto pb-12">
      {/* ── 1. Top Header Card (Matching InvoicesPage Bordered Architecture) ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-zinc-900/60 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-zinc-800">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShoppingCart className="size-5 text-indigo-600" /> Presales Orders
          </h2>
          <p className="text-xs text-slate-500">Presales booking pipeline managed by field sales representatives.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchOrders()}
            disabled={loading}
            className="h-9 gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button
            onClick={() => navigate('/system/orders/new')}
            className="h-9 gap-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Plus className="size-4" /> New Order
          </Button>
        </div>
      </div>

      {/* ── 2. Summary KPI Cards Grid (3 Columns Matching InvoicesPage Architecture) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4 w-full">
        {/* Card 1: Total Presales Orders */}
        <div className="rounded-2xl border p-3 sm:p-4 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 shadow-xs flex justify-between items-center">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Total Presales Orders</span>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{totalOrdersCount}</h3>
            <span className="text-[11px] text-slate-400 font-medium">All registered bookings</span>
          </div>
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <ShoppingCart className="size-5" />
          </div>
        </div>

        {/* Card 2: Total Pipeline Value */}
        <div className="rounded-2xl border p-3 sm:p-4 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 shadow-xs flex justify-between items-center">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Total Pipeline Value</span>
            <h3 className="text-2xl font-bold text-emerald-600 mt-1 font-mono">
              Rs. {totalPipelineValue.toLocaleString('en-LK')}
            </h3>
            <span className="text-[11px] text-slate-400 font-medium">Active pipeline orders</span>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <Banknote className="size-5" />
          </div>
        </div>

        {/* Card 3: Pending Conversion Value */}
        <div className="rounded-2xl border p-3 sm:p-4 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 shadow-xs flex justify-between items-center">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Pending Conversion Value</span>
            <h3 className="text-2xl font-bold mt-1 font-mono text-amber-600 dark:text-amber-400">
              Rs. {pendingTotalValue.toLocaleString('en-LK')}
            </h3>
            <span className="text-[11px] text-slate-400 font-medium">
              {pendingCount} {pendingCount === 1 ? 'order pending' : 'orders pending'}
            </span>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl">
            <Clock className="size-5" />
          </div>
        </div>
      </div>

      {/* ── 3. Mobile View (< 1024px): Search Bar + Collapsible Filters Drawer ── */}
      <div className="block lg:hidden bg-white dark:bg-zinc-900/60 p-3 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-2.5">
        <div className="flex items-center gap-2">
          {/* Primary Search Bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (page !== 1) setPage(1);
              }}
              placeholder="Search order #, customer, phone..."
              className="pl-9 h-9 text-xs"
            />
          </div>

          {/* Sleek Filters Toggle Button with Active Badge */}
          <button
            type="button"
            onClick={() => setMobileFiltersOpen((prev) => !prev)}
            className={`h-9 px-3 rounded-xl border flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-all shrink-0 select-none ${
              mobileFiltersOpen || activeFiltersCount > 0
                ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                : 'bg-slate-50 dark:bg-zinc-800/60 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800'
            }`}
          >
            <SlidersHorizontal className="size-3.5" />
            <span>Filters</span>
            {activeFiltersCount > 0 && (
              <span className="size-4 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center ml-0.5">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>

        {/* Collapsible Expansion Tray */}
        {mobileFiltersOpen && (
          <div className="pt-2.5 border-t border-slate-100 dark:border-zinc-800/80 space-y-2.5 animate-in fade-in-0 slide-in-from-top-2 duration-150">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
              {/* 1. Status Filter */}
              <div className="min-w-0">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Order Status
                </label>
                <SearchableSelect
                  value={statusFilter}
                  onValueChange={(val) => {
                    setStatusFilter(val);
                    if (page !== 1) setPage(1);
                  }}
                  options={STATUS_OPTIONS}
                  placeholder="All Orders"
                  searchPlaceholder="Search order status..."
                  dark={dark}
                  className="h-9 text-xs"
                />
              </div>

              {/* 2. Customer Filter */}
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
                  options={customerOptions}
                  placeholder="All Customers"
                  searchPlaceholder="Search customer..."
                  dark={dark}
                  className="h-9 text-xs"
                />
              </div>

              {/* 3. Date Range */}
              <div className="min-w-0">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Order Date Range
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
                  placeholder="Sort Orders..."
                  searchPlaceholder="Search sort order..."
                  dark={dark}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Clear All Filters Shortcut */}
            {(activeFiltersCount > 0 || search) && (
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

      {/* ── 4. Desktop View (≥ 1024px): Inline Executive Filter Matrix ── */}
      <div className="hidden lg:flex items-center gap-2.5 bg-white dark:bg-zinc-900/60 p-3.5 rounded-2xl border border-slate-200 dark:border-zinc-800">
        {/* Search Bar */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (page !== 1) setPage(1);
            }}
            placeholder="Search order #, customer, phone..."
            className="pl-9 h-9 text-xs w-full"
          />
        </div>

        {/* Status Selector */}
        <div className="w-36 xl:w-40 shrink-0">
          <SearchableSelect
            value={statusFilter}
            onValueChange={(val) => {
              setStatusFilter(val);
              if (page !== 1) setPage(1);
            }}
            options={STATUS_OPTIONS}
            placeholder="All Orders"
            searchPlaceholder="Filter status..."
            dark={dark}
          />
        </div>

        {/* Customer Select */}
        <div className="w-44 xl:w-48 shrink-0">
          <SearchableSelect
            value={selectedCustomerId}
            onValueChange={(val) => {
              setSelectedCustomerId(val);
              if (page !== 1) setPage(1);
            }}
            options={customerOptions}
            placeholder="All Customers"
            searchPlaceholder="Search customer..."
            dark={dark}
          />
        </div>

        {/* Date Range Picker */}
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

        {/* Sort Selector & Clear All Shortcut */}
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
          {(activeFiltersCount > 0 || search) && (
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

      {/* ── 5. Mobile & Tablet (< 1024px) Responsive Touch-Friendly Card View ── */}
      <div className="block lg:hidden space-y-3">
        {loading ? (
          <div className="py-12 text-center text-slate-400 bg-white dark:bg-zinc-900/60 rounded-2xl border border-slate-200 dark:border-zinc-800">
            <Loader2 className="size-6 animate-spin mx-auto mb-2 text-indigo-500" />
            <span>Loading presales orders...</span>
          </div>
        ) : orders.length === 0 ? (
          <div className="py-12 text-center text-slate-400 bg-white dark:bg-zinc-900/60 rounded-2xl border border-slate-200 dark:border-zinc-800">
            <ShoppingCart className="size-8 opacity-30 mx-auto mb-2" />
            <span>No orders found matching your current filters.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {orders.map((order) => {
              const statusClass =
                statusColors[order.status] ||
                'bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-300';

              return (
                <div
                  key={order.id}
                  onClick={() => {
                    setSelectedOrder(order);
                    setIsDetailModalOpen(true);
                  }}
                  className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 p-4 shadow-xs space-y-3 cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md transition-all active:scale-[0.99] flex flex-col justify-between"
                >
                  {/* Card Header: Clickable Order Ref, Role Badge, Date, Status & Action Menu */}
                  <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-zinc-800">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Interactive Clickable Order ID for direct navigation to Edit Order */}
                        <button
                          type="button"
                          onClick={(e) => handleEditOrder(e, order)}
                          className="font-mono text-xs font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline cursor-pointer text-left transition-colors"
                          title="Click to edit order"
                        >
                          {order.orderNumber || `ORD-${order.id}`}
                        </button>
                        {getRoleBadge(order.user?.role)}
                      </div>
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        {new Date(order.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${statusClass}`}>
                        {order.status}
                      </span>
                      {renderActionMenu(order)}
                    </div>
                  </div>

                  {/* Customer Information & Sales Rep */}
                  <div className="space-y-1 text-xs">
                    <p className="font-bold text-slate-900 dark:text-white truncate">
                      {order.customerName || order.customer?.name || 'Guest Customer'}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400">
                      <span className="font-mono flex items-center gap-1">
                        <Phone className="size-3 text-slate-400" />
                        {order.customerPhone || order.customer?.phone || 'No phone'}
                      </span>
                      {order.user?.name && (
                        <span className="flex items-center gap-1 text-slate-600 dark:text-zinc-400 font-medium truncate max-w-[130px]">
                          <User className="size-3 text-slate-400 shrink-0" />
                          <span className="truncate">{order.user.name}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Financial & Items Summary */}
                  <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 dark:border-zinc-800 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Package className="size-3.5 text-slate-400" />
                      <span>{order.items?.length || 0} line items</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block leading-tight">Total</span>
                      <span className="text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        Rs. {Number(order.totalAmount || 0).toLocaleString('en-LK')}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 6. Desktop (≥ 1024px) High-Density Structured Table Layout & Empty State ── */}
      <div className="hidden lg:block overflow-hidden rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-zinc-800 bg-slate-50/75 dark:bg-zinc-900/90 text-slate-500 dark:text-zinc-400 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Order Ref</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Sales Rep</th>
                <th className="py-3 px-4 text-center">Items</th>
                <th className="py-3 px-4 text-right">Total Amount</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center w-14">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Loader2 className="size-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    <span>Loading presales orders...</span>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <ShoppingCart className="size-8 opacity-30 mx-auto mb-2" />
                    <span>No orders found matching your current filters.</span>
                  </td>
                </tr>
              ) : (
                orders.map((order) => {
                  const statusClass =
                    statusColors[order.status] ||
                    'bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-300';

                  return (
                    <tr
                      key={order.id}
                      onClick={() => {
                        setSelectedOrder(order);
                        setIsDetailModalOpen(true);
                      }}
                      className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer group"
                    >
                      {/* Order Ref & Role Badge - Clickable to Direct Edit */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={(e) => handleEditOrder(e, order)}
                            className="font-mono font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline cursor-pointer text-left transition-colors"
                            title="Click to edit order"
                          >
                            {order.orderNumber || `ORD-${order.id}`}
                          </button>
                          {getRoleBadge(order.user?.role)}
                        </div>
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                        {new Date(order.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>

                      {/* Customer */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white truncate max-w-[200px]">
                          {order.customerName || order.customer?.name || 'Guest Customer'}
                        </div>
                        {(order.customerPhone || order.customer?.phone) && (
                          <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                            <Phone className="size-3 text-slate-400 shrink-0" />
                            <span>{order.customerPhone || order.customer?.phone}</span>
                          </div>
                        )}
                      </td>

                      {/* Sales Rep */}
                      <td className="py-3.5 px-4">
                        {order.user?.name ? (
                          <div className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-300 font-medium truncate max-w-[150px]">
                            <User className="size-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{order.user.name}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">—</span>
                        )}
                      </td>

                      {/* Items Count */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                          {order.items?.length || 0}
                        </span>
                      </td>

                      {/* Total Amount */}
                      <td className="py-3.5 px-4 text-right">
                        <span className="font-mono font-bold text-sm text-indigo-600 dark:text-indigo-400">
                          Rs. {Number(order.totalAmount || 0).toLocaleString('en-LK')}
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${statusClass}`}>
                          {order.status}
                        </span>
                      </td>

                      {/* 3-Dots Action Menu */}
                      <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        {renderActionMenu(order)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 7. Pagination Controls ── */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-3 text-xs text-slate-500">
          <span>
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total orders)
          </span>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="size-8 p-0"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              className="size-8 p-0"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Order Detail Modal ── */}
      <OrderDetailModal
        order={selectedOrder}
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedOrder(null);
        }}
        onStatusUpdated={fetchOrders}
      />

      {/* ── Destructive Delete Order Confirmation Dialog ── */}
      <AlertDialog
        open={Boolean(orderToDelete)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setOrderToDelete(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="size-10 rounded-full bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                <Trash2 className="size-5" />
              </div>
              <AlertDialogTitle className="text-lg font-bold text-slate-900 dark:text-white">
                Delete Order {orderToDelete?.orderNumber || (orderToDelete?.id ? `ORD-${orderToDelete.id}` : '')}?
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed pt-1">
              This will safely rollback any associated reserved stock or financial balances. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2 sm:gap-0">
            <AlertDialogCancel
              disabled={isDeleting}
              onClick={() => setOrderToDelete(null)}
              className="cursor-pointer"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(e) => {
                e.preventDefault();
                handleConfirmDelete();
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white dark:bg-rose-600 dark:hover:bg-rose-700 font-semibold cursor-pointer inline-flex items-center justify-center gap-2"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="size-4" />
                  <span>Delete Order</span>
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
