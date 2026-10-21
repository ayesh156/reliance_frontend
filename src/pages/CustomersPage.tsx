import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { SearchableSelect, type SearchableSelectOption } from '../components/ui/searchable-select';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
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
import { get, post, put, del } from '../lib/api';
import { toast } from 'react-toastify';
import { isValidSriLankanNIC, isValidSriLankanPhone } from '../utils/validators';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../components/ui/dropdown-menu';
import { TooltipSimple } from '../components/ui/tooltip';
import {
  Search,
  Plus,
  Trash2,
  Edit2,
  Building,
  UserCheck,
  Users,
  Loader2,
  X,
  MoreVertical,
  Receipt,
  MessageSquare,
  FileText, // ⭐ WhatsApp Action Icon
  CreditCard,
  Download,
  SlidersHorizontal,
} from 'lucide-react';

import { openWhatsAppChat, generateCustomerDebtSummaryWhatsAppMessage } from '../utils/whatsapp';
// Enterprise Customer Itemized Due Settlement Modal
import { CustomerDueSettlementModal } from '../components/customers/CustomerDueSettlementModal';
// Universal Customer Bill History Modal
import { CustomerBillHistoryModal } from '../components/customers/CustomerBillHistoryModal';

/**
 * Filter options for customer account types
 */
const ACCOUNT_TYPE_OPTIONS: SearchableSelectOption[] = [
  { value: 'ALL', label: 'All Accounts' },
  { value: 'RETAIL', label: 'Retail' },
  { value: 'WHOLESALE', label: 'Wholesale' },
];

/**
 * Filter options for customer balance & debt status
 */
const BALANCE_STATUS_OPTIONS: SearchableSelectOption[] = [
  { value: 'ALL', label: 'All Balances' },
  { value: 'HAS_DEBT', label: 'With Due Debt' },
  { value: 'CLEAR', label: 'Settled / No Due' },
];

/**
 * Sorting preferences for customers directory
 */
const CUSTOMER_SORT_OPTIONS: SearchableSelectOption[] = [
  { value: 'NEWEST', label: 'Newest First' },
  { value: 'DEBT_DESC', label: 'Highest Due Debt' },
  { value: 'NAME_ASC', label: 'Name A-Z' },
];

interface CustomerItem {
  id: number;
  name: string;
  phone: string;
  email?: string | null;
  type: 'RETAIL' | 'WHOLESALE';
  outstandingBalance: number;
  creditLimit: number;
  address?: string | null;
  city?: string | null;
  nic?: string | null;
  notes?: string | null;
}

export const CustomersPage: React.FC = () => {
  const { resolvedTheme } = useTheme();
  const { isAdmin, isRep } = useAuth();
  const dark = resolvedTheme === 'dark';

  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'ALL' | 'RETAIL' | 'WHOLESALE'>('ALL');
  // Secondary filter for tracking active debtors vs debt-free accounts
  const [debtFilter, setDebtFilter] = useState<'ALL' | 'HAS_DEBT' | 'CLEAR'>('ALL');
  // Sorting preference state
  const [sortBy, setSortBy] = useState<'NEWEST' | 'DEBT_DESC' | 'NAME_ASC'>('NEWEST');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState<boolean>(false);

  /**
   * Count of active non-default secondary filters for badge indicator
   */
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedType !== 'ALL') count++;
    if (debtFilter !== 'ALL') count++;
    if (sortBy !== 'NEWEST') count++;
    return count;
  }, [selectedType, debtFilter, sortBy]);

  /**
   * Reset all secondary filters and search query back to default view
   */
  const handleClearAllFilters = () => {
    setSelectedType('ALL');
    setDebtFilter('ALL');
    setSortBy('NEWEST');
    setSearchQuery('');
  };

  // Modal and Form States
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState<'RETAIL' | 'WHOLESALE'>('RETAIL');
  const [nic, setNic] = useState('');
  const [creditLimit, setCreditLimit] = useState<number | ''>('');
  const [outstandingBalance, setOutstandingBalance] = useState<number | ''>('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  
  // Enterprise Itemized Bill Settlement Modal States
  const [isDueSettlementOpen, setIsDueSettlementOpen] = useState(false);
  const [selectedSettlementCustomer, setSelectedSettlementCustomer] = useState<CustomerItem | null>(null);

  // Universal Customer Bill History & Profile Modal States
  const [isBillHistoryOpen, setIsBillHistoryOpen] = useState(false);
  const [selectedBillHistoryCustomer, setSelectedBillHistoryCustomer] = useState<CustomerItem | null>(null);

  /**
   * Opens the Unified Customer Bill History & Profile modal for any customer account,
   * allowing complete inspection of customer metadata, shortcuts, metrics, and ledger records.
   *
   * @param cust - Selected customer item
   */
  const handleOpenCustomerBillHistory = (cust: CustomerItem) => {
    setSelectedBillHistoryCustomer(cust);
    setIsBillHistoryOpen(true);
  };

  /**
   * Download customer statement PDF
   */
  const handleDownloadCustomerStatement = async (cust: CustomerItem) => {
    try {
      toast.info(`Generating Statement PDF for ${cust.name}...`);
      const apiHost = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const token = localStorage.getItem('token') || localStorage.getItem('auth_token') || sessionStorage.getItem('token');

      const response = await fetch(`${apiHost}/credit/customers/${cust.id}/statement-pdf`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) throw new Error('Failed to download PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Statement-${cust.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Statement PDF for ${cust.name} downloaded!`);
    } catch (err: any) {
      toast.error(err.message || 'Download failed');
    }
  };

  /**
   * Fetch customer's pending invoices and in-hand uncleared cheques to open WhatsApp account statement.
   * Leverages comprehensive due bills endpoint with fallback to pending invoices.
   */
  const handleSendCustomerDebtWhatsApp = async (cust: CustomerItem) => {
    if (!cust.phone) {
      toast.error('This customer does not have a saved phone number');
      return;
    }

    const toastId = toast.loading(`Preparing debt statement for ${cust.name}...`);
    try {
      // 1. Fetch live credit ledger including pending in-hand cheques & active bills
      const dueData = await get<any>(`/credit/customers/${cust.id}/due-bills`);
      const bills = Array.isArray(dueData?.bills) ? dueData.bills : [];
      const pendingCheques = Array.isArray(dueData?.pendingCheques) ? dueData.pendingCheques : [];
      const waCustomer = {
        name: cust.name,
        phone: cust.phone,
        outstandingBalance: dueData?.customer?.outstandingBalance !== undefined ? dueData.customer.outstandingBalance : cust.outstandingBalance,
      };
      const waMsg = generateCustomerDebtSummaryWhatsAppMessage(waCustomer, bills, pendingCheques);
      toast.dismiss(toastId);
      openWhatsAppChat(cust.phone, waMsg);
    } catch {
      try {
        // Fallback: Fetch pending invoices endpoint
        const invoices = await get<any>(`/orders/customers/${cust.id}/pending-invoices`);
        const invList = Array.isArray(invoices) ? invoices : (invoices?.invoices || []);
        const pendingCheques = invoices?.pendingCheques || [];
        const waMsg = generateCustomerDebtSummaryWhatsAppMessage(cust, invList, pendingCheques);
        toast.dismiss(toastId);
        openWhatsAppChat(cust.phone, waMsg);
      } catch {
        toast.dismiss(toastId);
        // Clean zero/standard fallback statement
        const waMsg = generateCustomerDebtSummaryWhatsAppMessage(cust, []);
        openWhatsAppChat(cust.phone, waMsg);
      }
    }
  };

  /**
   * Fetch customer list from backend API
   */
  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const data = await get<CustomerItem[]>('/customers');
      setCustomers(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  /**
   * Reset or populate customer creation/edit modal state.
   * Automatically defaults and locks type to 'WHOLESALE' for Sales Representatives (REP).
   */
  const openModal = (cust?: CustomerItem) => {
    if (cust) {
      setEditingCustomer(cust);
      setName(cust.name);
      setPhone(cust.phone);
      // For REP, enforce WHOLESALE partner type silently; non-REP respects existing customer type
      setType(isRep ? 'WHOLESALE' : cust.type);
      setNic(cust.nic || '');
      setCreditLimit(cust.creditLimit || '');
      setOutstandingBalance(cust.outstandingBalance !== undefined ? cust.outstandingBalance : '');
      setAddress(cust.address || cust.city || '');
      setNotes(cust.notes || '');
    } else {
      setEditingCustomer(null);
      setName('');
      setPhone('');
      // Sales Representatives default strictly to wholesale partners
      setType(isRep ? 'WHOLESALE' : 'RETAIL');
      setNic('');
      setCreditLimit('');
      setOutstandingBalance('');
      setAddress('');
      setNotes('');
    }
    setModalOpen(true);
  };

  /**
   * Handle create or update customer form submission with Sri Lankan format assertions.
   * Silently enforces type: 'WHOLESALE' in payload when user has REP role.
   */
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      toast.error('Name and phone number are required');
      return;
    }

    // Verify Sri Lankan phone format
    if (!isValidSriLankanPhone(phone.trim())) {
      toast.error('Invalid phone number! Must be 10 digits (07XXXXXXXX or landline 0XXXXXXXXX) or +94 format.');
      return;
    }

    // Verify Sri Lankan NIC format if entered
    if (nic.trim() && !isValidSriLankanNIC(nic.trim())) {
      toast.error('Invalid NIC number! Must be 9 digits with V/X (old) or 12 digits (new).');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        phone: phone.trim(),
        // Silently default and enforce type: 'WHOLESALE' for Sales Representatives
        type: isRep ? 'WHOLESALE' : type,
        nic: nic.trim() || undefined,
        creditLimit: creditLimit ? Number(creditLimit) : 0,
        outstandingBalance: outstandingBalance !== '' ? Number(outstandingBalance) : 0,
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      if (editingCustomer) {
        await put(`/customers/${editingCustomer.id}`, payload);
        toast.success('Customer updated successfully');
      } else {
        await post('/customers', payload);
        toast.success('Customer registered successfully');
      }

      setModalOpen(false);
      fetchCustomers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save customer');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState<CustomerItem | null>(null);

  /**
   * Execute permanent customer deletion upon alert dialog confirmation
   */
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await del(`/customers/${deleteTarget.id}`);
      toast.success(`Customer "${deleteTarget.name}" deleted successfully`);
      setDeleteTarget(null);
      fetchCustomers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete customer');
    }
  };

  /**
   * Filter and sort customer records across keyword search, account type, and debt balance
   */
  const filteredCustomers = useMemo(() => {
    return customers
      .filter(c => {
        const matchesType = selectedType === 'ALL' || c.type === selectedType;
        const matchesDebt =
          debtFilter === 'ALL' ||
          (debtFilter === 'HAS_DEBT' && Number(c.outstandingBalance || 0) > 0) ||
          (debtFilter === 'CLEAR' && Number(c.outstandingBalance || 0) <= 0);

        const query = searchQuery.toLowerCase().trim();
        const matchesQuery =
          !query ||
          c.name.toLowerCase().includes(query) ||
          c.phone.includes(query) ||
          (c.nic && c.nic.toLowerCase().includes(query));

        return matchesType && matchesDebt && matchesQuery;
      })
      .sort((a, b) => {
        if (sortBy === 'DEBT_DESC') return (b.outstandingBalance || 0) - (a.outstandingBalance || 0);
        if (sortBy === 'NAME_ASC') return a.name.localeCompare(b.name);
        return b.id - a.id; // Default NEWEST
      });
  }, [customers, searchQuery, selectedType, debtFilter, sortBy]);

  const totalOutstanding = useMemo(() => {
    return customers.reduce((acc, curr) => acc + (curr.outstandingBalance || 0), 0);
  }, [customers]);

  return (
    <div className="space-y-4 sm:space-y-6 w-full pb-16">
      {/* Header and Summary Cards */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Customer Directory
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Manage retail shoppers, credit accounts, and wholesale client balances.
          </p>
        </div>
        <Button onClick={() => openModal()} className="gap-2 h-9">
          <Plus className="size-4" /> Add Customer
        </Button>
      </div>

      {/* ── Summary KPI Cards Grid (Dense, Zero-Overflow Responsive 3 Columns on Tablet ~534px) ── */}
      <div className="grid grid-cols-1 xs:grid-cols-3 gap-2 sm:gap-4 w-full">
        {/* Card 1: Total Customers */}
        <div className="overflow-hidden rounded-2xl border p-2.5 sm:p-4 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 shadow-xs flex justify-between items-center gap-2">
          <div className="min-w-0 flex-1 overflow-hidden">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-zinc-400 truncate block">
              Total Customers
            </span>
            <h3 className="text-lg xs:text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-0.5 sm:mt-1 truncate leading-tight">
              {customers.length}
            </h3>
            <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium truncate block">
              Registered accounts
            </span>
          </div>
          <div className="p-1.5 sm:p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg sm:rounded-xl shrink-0 self-center">
            <Users className="size-4 sm:size-5" />
          </div>
        </div>

        {/* Card 2: Retail Shoppers */}
        <div className="overflow-hidden rounded-2xl border p-2.5 sm:p-4 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 shadow-xs flex justify-between items-center gap-2">
          <div className="min-w-0 flex-1 overflow-hidden">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-zinc-400 truncate block">
              Retail Shoppers
            </span>
            <h3 className="text-lg xs:text-xl sm:text-2xl font-bold text-emerald-600 mt-0.5 sm:mt-1 truncate leading-tight">
              {customers.filter(c => c.type === 'RETAIL').length}
            </h3>
            <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium truncate block">
              Active walk-in buyers
            </span>
          </div>
          <div className="p-1.5 sm:p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-lg sm:rounded-xl shrink-0 self-center">
            <UserCheck className="size-4 sm:size-5" />
          </div>
        </div>

        {/* Card 3: Total Outstanding Credit */}
        <div className="overflow-hidden rounded-2xl border p-2.5 sm:p-4 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 shadow-xs flex justify-between items-center gap-2">
          <div className="min-w-0 flex-1 overflow-hidden">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-zinc-400 truncate block">
              Outstanding Credit
            </span>
            <h3 className="text-base xs:text-lg sm:text-2xl font-bold text-rose-600 mt-0.5 sm:mt-1 font-mono truncate leading-tight">
              Rs. {totalOutstanding.toLocaleString()}
            </h3>
            <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium truncate block">
              Accumulated balance
            </span>
          </div>
          <div className="p-1.5 sm:p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-lg sm:rounded-xl shrink-0 self-center">
            <CreditCard className="size-4 sm:size-5" />
          </div>
        </div>
      </div>

      {/* ── Mobile View (< 1024px): Search Bar + Collapsible Filters Drawer ── */}
      <div className="block lg:hidden bg-white dark:bg-zinc-900/60 p-3 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-2.5">
        <div className="flex items-center gap-2">
          {/* Primary Search Bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search customer by name, phone, or NIC..."
              className="pl-9 pr-8 h-9 text-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
              >
                <X className="size-4" />
              </button>
            )}
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

        {/* Collapsible Expansion Tray: Fluid 3-column filter row on ~534px tablets */}
        {mobileFiltersOpen && (
          <div className="pt-2.5 border-t border-slate-100 dark:border-zinc-800/80 space-y-2.5 animate-in fade-in-0 slide-in-from-top-2 duration-150">
            <div className="grid grid-cols-1 xs:grid-cols-3 gap-2 sm:gap-2.5 w-full">
              {/* Account Type Filter */}
              <div className="min-w-0">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Account Type
                </label>
                <SearchableSelect
                  options={ACCOUNT_TYPE_OPTIONS}
                  value={selectedType}
                  onValueChange={(val) => setSelectedType(val as any)}
                  placeholder="All Accounts"
                  searchPlaceholder="Search account type..."
                  dark={dark}
                  className="h-9 text-xs"
                />
              </div>

              {/* Balance Status Filter */}
              <div className="min-w-0">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Balance Status
                </label>
                <SearchableSelect
                  options={BALANCE_STATUS_OPTIONS}
                  value={debtFilter}
                  onValueChange={(val) => setDebtFilter(val as any)}
                  placeholder="All Balances"
                  searchPlaceholder="Search balance status..."
                  dark={dark}
                  className="h-9 text-xs"
                />
              </div>

              {/* Sort Order */}
              <div className="min-w-0">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Sort Order
                </label>
                <SearchableSelect
                  options={CUSTOMER_SORT_OPTIONS}
                  value={sortBy}
                  onValueChange={(val) => setSortBy(val as any)}
                  placeholder="Sort Customers..."
                  searchPlaceholder="Search sort preference..."
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

      {/* ── Desktop View (≥ 1024px): Inline Executive Filter Matrix ── */}
      <div className="hidden lg:flex items-center gap-2.5 bg-white dark:bg-zinc-900/60 p-3.5 rounded-2xl border border-slate-200 dark:border-zinc-800">
        {/* Search Bar */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search customer by name, contact phone number, or NIC..."
            className="pl-9 pr-8 h-9 text-xs w-full"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Account Type Selector */}
        <div className="w-44 xl:w-48 shrink-0">
          <SearchableSelect
            options={ACCOUNT_TYPE_OPTIONS}
            value={selectedType}
            onValueChange={(val) => setSelectedType(val as any)}
            placeholder="All Accounts"
            searchPlaceholder="Filter account type..."
            dark={dark}
          />
        </div>

        {/* Balance Status Selector */}
        <div className="w-48 xl:w-52 shrink-0">
          <SearchableSelect
            options={BALANCE_STATUS_OPTIONS}
            value={debtFilter}
            onValueChange={(val) => setDebtFilter(val as any)}
            placeholder="All Balances"
            searchPlaceholder="Filter debt balance..."
            dark={dark}
          />
        </div>

        {/* Sort Selector & Clear All Shortcut */}
        <div className="w-48 xl:w-52 shrink-0 flex items-center gap-1.5">
          <div className="flex-1 min-w-0">
            <SearchableSelect
              options={CUSTOMER_SORT_OPTIONS}
              value={sortBy}
              onValueChange={(val) => setSortBy(val as any)}
              placeholder="Sort Customers..."
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

      {/* Customer Data View (Mobile Card Grid + Desktop Table) */}
      <div className="rounded-2xl border bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 overflow-hidden">
        {/* Mobile / Tablet Responsive Customer Card Grid (< 1024px) */}
        <div className="block lg:hidden p-2 sm:p-3.5 space-y-2.5 sm:space-y-3">
          {loading ? (
            <div className="py-12 text-center">
              <Loader2 className="size-6 animate-spin mx-auto text-emerald-500" />
              <span className="text-xs text-slate-400 mt-2 block">Loading customer records...</span>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No customers found matching the search criteria.
            </div>
          ) : (
            <div className="grid grid-cols-1 xs:grid-cols-2 gap-2.5 sm:gap-3 w-full">
              {/* Customer Cards: Fluid 2 columns on tablet portrait ~534px to eliminate excessive vertical scrolling */}
              {filteredCustomers.map((cust) => {
                const hasDebt = Number(cust.outstandingBalance || 0) > 0;
                return (
                  <div
                    key={cust.id}
                    className="p-3 sm:p-3.5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 shadow-xs hover:border-slate-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between gap-2.5 sm:gap-3 w-full"
                  >
                    {/* Top Row: Name, Phone, Badge (Clickable for Unified Bill History & Profile) */}
                    <div
                      onClick={() => handleOpenCustomerBillHistory(cust)}
                      className="flex items-start justify-between gap-2 cursor-pointer group/card select-none"
                      title="Click to view customer bill history & profile"
                    >
                      <div className="min-w-0">
                        <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-zinc-100 group-hover/card:text-emerald-600 dark:group-hover/card:text-emerald-400 transition-colors truncate">
                          {cust.name}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono font-bold text-xs text-slate-700 dark:text-zinc-300">
                            {cust.phone}
                          </span>
                          {cust.nic && (
                            <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                              · {cust.nic}
                            </span>
                          )}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-semibold shrink-0 ${
                          cust.type === 'WHOLESALE'
                            ? 'border-blue-500/30 text-blue-600 bg-blue-500/10'
                            : 'border-emerald-500/30 text-emerald-600 bg-emerald-500/10'
                        }`}
                      >
                        {cust.type}
                      </Badge>
                    </div>

                    {/* Middle Row: Credit Limit & Outstanding Balance pill */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-zinc-800/80 text-[11px]">
                      <div>
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500 block">Credit Limit</span>
                        <span className="font-semibold text-slate-700 dark:text-zinc-300">
                          Rs. {Number(cust.creditLimit || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500 block">Due Balance</span>
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold font-mono ${
                            hasDebt
                              ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 shadow-xs'
                              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60'
                          }`}
                        >
                          Rs. {Number(cust.outstandingBalance || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Streamlined Icon-Only Action Bar: Compact 36x36px buttons cleanly aligned in a single row */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-zinc-800/80">
                      <span className="text-[11px] font-medium text-slate-400 dark:text-zinc-500 truncate max-w-[150px]">
                        {cust.city || 'Quick Actions'}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Bill History Icon-Only Button */}
                        <TooltipSimple content="Bill History" side="top">
                          <button
                            type="button"
                            onClick={() => handleOpenCustomerBillHistory(cust)}
                            className="size-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 flex items-center justify-center transition-colors cursor-pointer select-none active:scale-95 border border-slate-200/50 dark:border-zinc-700/50 shadow-2xs"
                            title="Bill History"
                          >
                            <FileText className="size-4 text-blue-600 dark:text-blue-400 shrink-0" />
                          </button>
                        </TooltipSimple>

                        {/* Settle Due Balance Icon-Only Button (shown when debt exists) */}
                        {hasDebt && (
                          <TooltipSimple content="Settle Due Balance" side="top">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSettlementCustomer(cust);
                                setIsDueSettlementOpen(true);
                              }}
                              className="size-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition-colors cursor-pointer select-none active:scale-95 shadow-2xs shadow-emerald-950/20"
                              title="Settle Due Balance"
                            >
                              <CreditCard className="size-4 shrink-0" />
                            </button>
                          </TooltipSimple>
                        )}

                        {/* Deduplicated 3-Dots Dropdown Menu:
                            Actions already present as direct card buttons (Bill History and Settle Due)
                            are strictly excluded from this menu to eliminate UI redundancy. */}
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="size-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 flex items-center justify-center transition-colors cursor-pointer select-none border border-slate-200/50 dark:border-zinc-700/50 shadow-2xs"
                              title="More Customer Options"
                            >
                              <MoreVertical className="size-4" />
                            </button>
                          </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52 text-xs font-medium">
                          {/* Edit Customer Profile: Accessible to both Sales Reps and Admins */}
                          <DropdownMenuItem
                            onClick={() => openModal(cust)}
                            className="gap-2 cursor-pointer text-slate-700 dark:text-zinc-300 py-2 font-medium"
                          >
                            <Edit2 className="size-3.5 text-slate-500" />
                            Edit Profile
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() => handleDownloadCustomerStatement(cust)}
                            className="gap-2 cursor-pointer text-slate-700 dark:text-zinc-300 py-2"
                          >
                            <Download className="size-3.5 text-slate-500" />
                            Download Statement PDF
                          </DropdownMenuItem>

                          {cust.phone && (
                            <DropdownMenuItem
                              onClick={() => handleSendCustomerDebtWhatsApp(cust)}
                              className="gap-2 cursor-pointer text-emerald-600 focus:text-emerald-700 py-2"
                            >
                              <MessageSquare className="size-3.5 text-emerald-600" />
                              WhatsApp Due Statement
                            </DropdownMenuItem>
                          )}

                          {isAdmin && !isRep && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setDeleteTarget(cust)}
                                className="gap-2 cursor-pointer text-rose-600 focus:text-rose-700 focus:bg-rose-50 dark:focus:bg-rose-950/30 py-2 font-semibold"
                              >
                                <Trash2 className="size-3.5 text-rose-600" />
                                Delete Account
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          )}
        </div>

        {/* Desktop Table View (>= 1024px) */}
        <div className="hidden lg:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Phone / Contact</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Credit Limit</TableHead>
                <TableHead>Outstanding</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <Loader2 className="size-6 animate-spin mx-auto text-emerald-500" />
                    <span className="text-xs text-slate-400 mt-2 block">Loading customer records...</span>
                  </TableCell>
                </TableRow>
              ) : filteredCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-slate-400 text-xs">
                    No customers found matching the search criteria.
                  </TableCell>
                </TableRow>
              ) : (
                filteredCustomers.map(cust => (
                  <TableRow key={cust.id}>
                    <TableCell>
                      {/* Interactive Clickable Target: Opens Unified Customer Bill History & Profile Modal */}
                      <div 
                        onClick={() => handleOpenCustomerBillHistory(cust)}
                        className="cursor-pointer group/cust select-none inline-block"
                        title="Click to view customer bill history & profile"
                      >
                        <div className="font-semibold text-xs text-slate-900 dark:text-white group-hover/cust:text-emerald-600 dark:group-hover/cust:text-emerald-400 group-hover/cust:underline transition-colors">
                          {cust.name}
                        </div>
                        {cust.nic && (
                          <div className="text-[10px] text-slate-400 font-mono">NIC: {cust.nic}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-slate-600 dark:text-zinc-300">
                      {cust.phone}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-semibold ${
                          cust.type === 'WHOLESALE'
                            ? 'border-blue-500/30 text-blue-600 bg-blue-500/10'
                            : 'border-emerald-500/30 text-emerald-600 bg-emerald-500/10'
                        }`}
                      >
                        {cust.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                      Rs. {Number(cust.creditLimit || 0).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`text-xs font-bold ${
                          cust.outstandingBalance > 0
                            ? 'text-rose-600'
                            : 'text-slate-500 dark:text-zinc-400'
                        }`}
                      >
                        Rs. {Number(cust.outstandingBalance || 0).toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {/* Vertical 3-Dots Action Dropdown Menu */}
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8 text-slate-500 hover:text-slate-900 dark:hover:text-white">
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 text-xs font-medium">
                          {/* Unified Bill History Option */}
                          <DropdownMenuItem
                            onClick={() => handleOpenCustomerBillHistory(cust)}
                            className="gap-2 cursor-pointer font-semibold text-slate-900 dark:text-zinc-100 py-1.5"
                          >
                            <FileText className="size-3.5 text-blue-600 dark:text-blue-400" />
                            Bill History
                          </DropdownMenuItem>

                          {/* Itemized Due Bills Settlement Modal Action (Shown when debt exists) */}
                          {Number(cust.outstandingBalance || 0) > 0 && (
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedSettlementCustomer(cust);
                                setIsDueSettlementOpen(true);
                              }}
                              className="gap-2 cursor-pointer text-emerald-600 focus:text-emerald-700 font-semibold py-1.5"
                            >
                              <Receipt className="size-3.5 text-emerald-600" />
                              Settle Due Bills
                            </DropdownMenuItem>
                          )}

                          {/* Download Statement PDF Action */}
                          <DropdownMenuItem
                            onClick={() => handleDownloadCustomerStatement(cust)}
                            className="gap-2 cursor-pointer text-slate-700 dark:text-zinc-300 font-medium py-1.5"
                          >
                            <Download className="size-3.5 text-slate-500" />
                            Download Statement PDF
                          </DropdownMenuItem>

                          {/* Direct WhatsApp Debt Notice Action */}
                          {cust.phone && (
                            <DropdownMenuItem
                              onClick={() => handleSendCustomerDebtWhatsApp(cust)}
                              className="gap-2 cursor-pointer text-emerald-600 focus:text-emerald-700 font-medium py-1.5"
                            >
                              <MessageSquare className="size-3.5 text-emerald-600" />
                              WhatsApp Due Statement
                            </DropdownMenuItem>
                          )}

                          <DropdownMenuSeparator />

                          {/* Edit Customer Profile (Accessible to Admins & Sales Reps) */}
                          <DropdownMenuItem
                            onClick={() => openModal(cust)}
                            className="gap-2 cursor-pointer text-slate-700 dark:text-zinc-300 py-1.5 font-medium"
                          >
                            <Edit2 className="size-3.5 text-slate-500" />
                            Edit Profile
                          </DropdownMenuItem>

                          {isAdmin && !isRep && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setDeleteTarget(cust)}
                                className="gap-2 cursor-pointer text-rose-600 focus:text-rose-700 focus:bg-rose-50 dark:focus:bg-rose-950/30 py-1.5 font-semibold"
                              >
                                <Trash2 className="size-3.5 text-rose-600" />
                                Delete Account
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Customer Create / Edit Dialog Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>
              {editingCustomer ? 'Edit Customer Profile' : 'Register New Customer'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveCustomer} className="space-y-3 py-2">
            {isRep ? (
              /* REP-Specific Compact 2-Column Registration Layout: Eliminates Account Type dropdown & optimizes vertical height */
              <div className="space-y-3">
                {/* Row 1 (Full Width): Customer / Shop Name * */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Customer / Shop Name *</label>
                  <Input
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Kasun Perera or Modern Textile"
                  />
                </div>

                {/* Row 2 (2 Columns): Phone Number * (left) | NIC Number (right) */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Phone Number *</label>
                    <Input
                      required
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="0771234567"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">NIC Number</label>
                    <Input
                      value={nic}
                      onChange={e => setNic(e.target.value)}
                      placeholder="e.g. 199512345678"
                    />
                  </div>
                </div>

                {/* Row 3 (2 Columns): Credit Limit (Rs) (left) | Opening / Old Due Balance (Rs) (right) */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Credit Limit (Rs)</label>
                    <Input
                      type="number"
                      value={creditLimit}
                      onChange={e => setCreditLimit(e.target.value ? Number(e.target.value) : '')}
                      placeholder="e.g. 50000"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                      Opening / Old Due Balance (Rs)
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={outstandingBalance}
                      onChange={e => setOutstandingBalance(e.target.value ? Number(e.target.value) : '')}
                      placeholder="0.00"
                      className="font-mono"
                      aria-label="Opening / Old Due Balance (Rs)"
                    />
                  </div>
                </div>

                {/* Row 4 (Full Width): Address / City */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Address / City</label>
                  <Input
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    placeholder="Street address and city"
                  />
                </div>

                {/* Row 5 (Full Width): Notes */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Notes</label>
                  <Input
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Customer preferences or credit terms"
                  />
                </div>
              </div>
            ) : (
              /* Non-REP Users (Admin / Staff): Full form with Account Type dropdown selector */
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Customer / Shop Name *</label>
                  <Input
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Kasun Perera or Modern Textile"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Phone Number *</label>
                    <Input
                      required
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="0771234567"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Account Type</label>
                    <SearchableSelect
                      value={type}
                      onValueChange={(val) => setType(val as 'RETAIL' | 'WHOLESALE')}
                      options={[
                        {
                          value: 'RETAIL',
                          label: 'Retail Shopper',
                          icon: <UserCheck className="size-3.5 text-emerald-500" />,
                        },
                        {
                          value: 'WHOLESALE',
                          label: 'Wholesale (Shop Partner)',
                          icon: <Building className="size-3.5 text-blue-500" />,
                        },
                      ]}
                      placeholder="Select Account Type"
                      searchPlaceholder="Search account type..."
                      dark={dark}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">NIC Number</label>
                    <Input
                      value={nic}
                      onChange={e => setNic(e.target.value)}
                      placeholder="e.g. 199512345678"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Credit Limit (Rs)</label>
                    <Input
                      type="number"
                      value={creditLimit}
                      onChange={e => setCreditLimit(e.target.value ? Number(e.target.value) : '')}
                      placeholder="e.g. 50000"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                    Opening / Old Due Balance (Rs)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={outstandingBalance}
                    onChange={e => setOutstandingBalance(e.target.value ? Number(e.target.value) : '')}
                    placeholder="0.00"
                    className="font-mono"
                    aria-label="Opening / Old Due Balance (Rs)"
                  />
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                    Initial debt ledger brought forward from prior invoices or legacy records.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold">Address / City</label>
                  <Input
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    placeholder="Street address and city"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold">Notes</label>
                  <Input
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Customer preferences or credit terms"
                  />
                </div>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting && <Loader2 className="size-3.5 animate-spin mr-1" />}
                {editingCustomer ? 'Update Profile' : 'Save Customer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Permanent Delete Confirmation Dialog (Admin Only) */}
      {isAdmin && (
        <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the customer account for{' '}
                <strong className="text-slate-900 dark:text-white">"{deleteTarget?.name}"</strong> and cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDelete} className="bg-rose-600 hover:bg-rose-700 text-white">
                Delete Customer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Enterprise-Grade Itemized Customer Due Settlement Modal */}
      <CustomerDueSettlementModal
        isOpen={isDueSettlementOpen}
        onClose={() => {
          setIsDueSettlementOpen(false);
          setSelectedSettlementCustomer(null);
        }}
        customerId={selectedSettlementCustomer?.id || null}
        customerName={selectedSettlementCustomer?.name}
        customerPhone={selectedSettlementCustomer?.phone}
        onPaymentSuccess={() => {
          fetchCustomers(); // ගෙවීම් වාර්තා වූ සැණින් Customers table එක auto-sync වේ
        }}
      />

      {/* Universal Customer Bill History & Profile Modal */}
      <CustomerBillHistoryModal
        isOpen={isBillHistoryOpen}
        onClose={() => {
          setIsBillHistoryOpen(false);
          setSelectedBillHistoryCustomer(null);
        }}
        customer={selectedBillHistoryCustomer}
        onOpenSettlement={(cust) => {
          setSelectedSettlementCustomer(cust as CustomerItem);
          setIsDueSettlementOpen(true);
        }}
        onEditProfile={(cust) => {
          setIsBillHistoryOpen(false);
          openModal(cust as CustomerItem);
        }}
      />
      
    </div>
  );
};