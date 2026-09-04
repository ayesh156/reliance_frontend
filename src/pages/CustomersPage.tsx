import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { SearchableSelect } from '../components/ui/SearchableSelect';
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
import { isValidSriLankanNIC, isValidSriLankanPhone } from '../lib/validators';
import { useTheme } from '../contexts/ThemeContext';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../components/ui/dropdown-menu';
import {
  Users,
  Search,
  Plus,
  Trash2,
  Edit2,
  Phone,
  CreditCard,
  Building,
  UserCheck,
  Loader2,
  X,
  Filter,
  ArrowUpDown,
  MoreVertical,
  DollarSign,
  Receipt,
  Check,
} from 'lucide-react';

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
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'ALL' | 'RETAIL' | 'WHOLESALE'>('ALL');
  // Secondary filter for tracking active debtors vs debt-free accounts
  const [debtFilter, setDebtFilter] = useState<'ALL' | 'HAS_DEBT' | 'CLEAR'>('ALL');
  // Sorting preference state
  const [sortBy, setSortBy] = useState<'NEWEST' | 'DEBT_DESC' | 'NAME_ASC'>('NEWEST');

  // Modal and Form States
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState<'RETAIL' | 'WHOLESALE'>('RETAIL');
  const [nic, setNic] = useState('');
  const [creditLimit, setCreditLimit] = useState<number | ''>('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  
  // Debt Settlement Modal States
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [settleCustomer, setSettleCustomer] = useState<CustomerItem | null>(null);
  const [pendingInvoices, setPendingInvoices] = useState<any[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [settleAmount, setSettleAmount] = useState<number | ''>('');
  const [settleStrategy, setSettleStrategy] = useState<'FULL' | 'FIFO' | 'LIFO' | 'CUSTOM'>('FULL');
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<number[]>([]);
  const [settleMethod, setSettleMethod] = useState<'CASH' | 'CHEQUE' | 'CARD'>('CASH');
  const [settling, setSettling] = useState(false);

  // Open Settle Balance dialog and fetch customer pending debt invoices
  const handleOpenSettleModal = async (cust: CustomerItem) => {
    setSettleCustomer(cust);
    setSettleAmount(cust.outstandingBalance || 0);
    setSettleStrategy('FULL');
    setSelectedInvoiceIds([]);
    setSettleMethod('CASH');
    setSettleModalOpen(true);

    // Fetch this customer's active debt invoices
    setLoadingInvoices(true);
    try {
      const res = await get<any[]>(`/orders/customers/${cust.id}/pending-invoices`);
      setPendingInvoices(Array.isArray(res) ? res : []);
    } catch (err: any) {
      toast.error('Failed to load pending invoices for this customer');
    } finally {
      setLoadingInvoices(false);
    }
  };

  // Submit Debt Settlement Transaction
  const handleConfirmSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleCustomer) return;

    const amountNum = settleStrategy === 'FULL' ? Number(settleCustomer.outstandingBalance) : Number(settleAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }

    if (settleStrategy === 'CUSTOM' && selectedInvoiceIds.length === 0) {
      toast.error('Please select at least one invoice tag to settle');
      return;
    }

    setSettling(true);
    try {
      await post(`/orders/customers/${settleCustomer.id}/settle-debt`, {
        amount: amountNum,
        strategy: settleStrategy,
        selectedInvoiceIds,
        paymentMethod: settleMethod,
      });

      toast.success(`Debt payment of Rs. ${amountNum.toLocaleString()} processed successfully!`);
      setSettleModalOpen(false);
      fetchCustomers();
    } catch (err: any) {
      toast.error(err.message || 'Settlement failed');
    } finally {
      setSettling(false);
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
   * Reset form fields for Add or Edit dialog
   */
  const openModal = (cust?: CustomerItem) => {
    if (cust) {
      setEditingCustomer(cust);
      setName(cust.name);
      setPhone(cust.phone);
      setType(cust.type);
      setNic(cust.nic || '');
      setCreditLimit(cust.creditLimit || '');
      setAddress(cust.address || '');
      setNotes(cust.notes || '');
    } else {
      setEditingCustomer(null);
      setName('');
      setPhone('');
      setType('RETAIL');
      setNic('');
      setCreditLimit('');
      setAddress('');
      setNotes('');
    }
    setModalOpen(true);
  };

  /**
   * Handle create or update customer form submission with Sri Lankan format assertions
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
        type,
        nic: nic.trim() || undefined,
        creditLimit: creditLimit ? Number(creditLimit) : 0,
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
    <div className="space-y-6 w-full pb-16">
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

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border p-4 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800">
          <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Total Customers</span>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{customers.length}</h3>
        </div>
        <div className="rounded-2xl border p-4 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800">
          <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Retail Shoppers</span>
          <h3 className="text-2xl font-bold text-emerald-600 mt-1">
            {customers.filter(c => c.type === 'RETAIL').length}
          </h3>
        </div>
        <div className="rounded-2xl border p-4 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800">
          <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Total Outstanding Credit</span>
          <h3 className="text-2xl font-bold text-rose-600 mt-1">
            Rs. {totalOutstanding.toLocaleString()}
          </h3>
        </div>
      </div>

      {/* Full-Width Search Bar & Multi-Dimensional Filters */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Full size responsive search bar */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 size-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search customer by name, contact phone number, or NIC..."
            className="pl-10 pr-9 h-10 text-xs w-full rounded-xl bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 shadow-sm"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Account Type Pills */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
            {(['ALL', 'RETAIL', 'WHOLESALE'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setSelectedType(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  selectedType === t
                    ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400'
                }`}
              >
                {t === 'ALL' ? 'All Accounts' : t === 'RETAIL' ? 'Retail' : 'Wholesale'}
              </button>
            ))}
          </div>

          {/* Outstanding Balance Filter Pill */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setDebtFilter('ALL')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold ${
                debtFilter === 'ALL' ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'
              }`}
            >
              All Balances
            </button>
            <button
              type="button"
              onClick={() => setDebtFilter('HAS_DEBT')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold ${
                debtFilter === 'HAS_DEBT' ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-500 hover:text-rose-500'
              }`}
            >
              With Due Debt
            </button>
          </div>
        </div>
      </div>

      {/* Customer Data Table */}
      <div className="rounded-2xl border bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 overflow-hidden">
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
                    <div className="font-semibold text-xs text-slate-900 dark:text-white">
                      {cust.name}
                    </div>
                    {cust.nic && (
                      <div className="text-[10px] text-slate-400 font-mono">NIC: {cust.nic}</div>
                    )}
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
                    {/* Vertical 3-Dots Action Dropdown Menu (modal={false} prevents layout shift) */}
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8 text-slate-500 hover:text-slate-900 dark:hover:text-white">
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44 text-xs font-medium">
                        {/* Settle Balance Option - highlighted if customer has active debt */}
                        {Number(cust.outstandingBalance || 0) > 0 && (
                          <>
                            <DropdownMenuItem
                              onClick={() => handleOpenSettleModal(cust)}
                              className="gap-2 cursor-pointer text-emerald-600 focus:text-emerald-700 font-semibold"
                            >
                              <DollarSign className="size-3.5 text-emerald-600" />
                              Pay Due Balance
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}

                        <DropdownMenuItem
                          onClick={() => openModal(cust)}
                          className="gap-2 cursor-pointer text-slate-700 dark:text-zinc-300"
                        >
                          <Edit2 className="size-3.5 text-slate-500" />
                          Edit Profile
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                          onClick={() => setDeleteTarget(cust)}
                          className="gap-2 cursor-pointer text-rose-600 focus:text-rose-700 focus:bg-rose-50 dark:focus:bg-rose-950/30"
                        >
                          <Trash2 className="size-3.5 text-rose-600" />
                          Delete Account
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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
                {/* SearchableSelect integration for standard Shadcn combobox appearance */}
                {/* SearchableSelect adapts dynamically to active Light or Dark system theme */}
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
              <label className="text-xs font-semibold">Address</label>
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

      {/* Permanent Delete Confirmation Dialog */}
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

{/* Debt Settlement Modal (Full vs Partial Allocation with FIFO/LIFO/Tags) */}
      <Dialog open={settleModalOpen} onOpenChange={setSettleModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <DollarSign className="size-5 text-emerald-600" /> Settle Due Balance
            </DialogTitle>
          </DialogHeader>

          {settleCustomer && (
            <form onSubmit={handleConfirmSettlement} className="space-y-3.5 py-1 text-xs">
              {/* Customer Debt Card */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 flex justify-between items-center">
                <div>
                  <div className="font-bold text-sm text-slate-900 dark:text-white">{settleCustomer.name}</div>
                  <div className="text-[11px] text-slate-500 font-mono">{settleCustomer.phone}</div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Due</span>
                  <span className="font-mono font-bold text-base text-rose-600">
                    Rs. {Number(settleCustomer.outstandingBalance).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Strategy Selector (Full vs FIFO vs LIFO vs Specific Invoices) */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-zinc-300">Settlement Strategy</label>
                <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800">
                  {(['FULL', 'FIFO', 'LIFO', 'CUSTOM'] as const).map((strat) => (
                    <button
                      key={strat}
                      type="button"
                      onClick={() => {
                        setSettleStrategy(strat);
                        if (strat === 'FULL') {
                          setSettleAmount(settleCustomer.outstandingBalance);
                        }
                      }}
                      className={`py-1 text-[10px] font-bold rounded-lg transition-all ${
                        settleStrategy === strat
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400'
                      }`}
                    >
                      {strat === 'FULL' ? 'Full Pay' : strat === 'FIFO' ? 'Oldest 1st' : strat === 'LIFO' ? 'Newest 1st' : 'Select Bills'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Amount Input (Disabled in FULL mode) */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-zinc-300">Payment Amount (Rs) *</label>
                <Input
                  type="number"
                  required
                  min="1"
                  max={settleCustomer.outstandingBalance}
                  disabled={settleStrategy === 'FULL'}
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value ? Number(e.target.value) : '')}
                  className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400 h-9"
                  placeholder="Enter amount to pay..."
                />
              </div>

              {/* Custom Multi-Select Invoice Tags (Rendered ONLY in CUSTOM mode) */}
              {settleStrategy === 'CUSTOM' && (
                <div className="space-y-1.5 pt-1">
                  <label className="font-bold text-slate-700 dark:text-zinc-300 block">
                    Select Invoices to Deduct From ({selectedInvoiceIds.length} chosen)
                  </label>
                  {loadingInvoices ? (
                    <div className="py-4 text-center text-slate-400">
                      <Loader2 className="size-4 animate-spin mx-auto mb-1" /> Loading pending invoices...
                    </div>
                  ) : pendingInvoices.length === 0 ? (
                    <div className="text-[11px] text-slate-400 p-2 border rounded-lg">No pending credit invoices found.</div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1.5 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950">
                      {pendingInvoices.map((inv) => {
                        const isSelected = selectedInvoiceIds.includes(inv.id);
                        return (
                          <button
                            key={inv.id}
                            type="button"
                            onClick={() => {
                              setSelectedInvoiceIds((prev) =>
                                isSelected ? prev.filter((id) => id !== inv.id) : [...prev, inv.id]
                              );
                            }}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-mono transition-all ${
                              isSelected
                                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold'
                                : 'border-slate-200 dark:border-zinc-800 hover:border-slate-400 text-slate-600 dark:text-zinc-400'
                            }`}
                          >
                            <Receipt className="size-3" />
                            <span>{inv.invoiceNo} (Due: Rs. {inv.due})</span>
                            {isSelected && <Check className="size-3 text-emerald-600" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Payment Method Pills */}
              <div className="space-y-1 pt-1">
                <label className="font-bold text-slate-700 dark:text-zinc-300">Payment Channel</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['CASH', 'CHEQUE', 'CARD'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setSettleMethod(m)}
                      className={`py-1.5 rounded-lg border font-semibold text-center transition-all ${
                        settleMethod === m
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600'
                          : 'border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setSettleModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={settling} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                  {settling && <Loader2 className="size-3.5 animate-spin mr-1" />} Confirm Payment
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      
    </div>
  );
};