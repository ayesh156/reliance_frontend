import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, del } from '../lib/api';
import { toast } from 'react-toastify';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { SearchableSelect } from '../components/ui/SearchableSelect';
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
  MessageSquare, // ⭐ WhatsApp Icon
} from 'lucide-react';
import { openWhatsAppChat, generateCustomerInvoiceWhatsAppMessage } from '../lib/whatsapp';

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
}

export const InvoicesPage: React.FC = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
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
                      {/* Interactive Clickable Invoice ID: Direct jump to Quick Checkout in Edit Mode */}
                      <td 
                        onClick={() => navigate(`/system/quick-checkout?editInvoiceId=${inv.id}`)}
                        className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline select-none"
                        title="Click to edit invoice in POS"
                      >
                        INV{inv.id}
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
                        {/* Vertical 3-Dots Action Dropdown Menu (modal={false} prevents layout shifting and scroll lock) */}
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8 text-slate-500 hover:text-slate-900 dark:hover:text-white">
                              <MoreVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44 text-xs font-medium">
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

                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                              onClick={() => setDeleteId(inv.id)}
                              className="gap-2 cursor-pointer text-rose-600 focus:text-rose-700 focus:bg-rose-50 dark:focus:bg-rose-950/30"
                            >
                              <Trash2 className="size-3.5 text-rose-600" />
                              Delete Invoice
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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

      {/* Delete Confirmation Dialog */}
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
    </div>
  );
};