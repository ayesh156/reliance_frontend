import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { DatePicker } from '../components/ui/date-picker';
import { SearchableSelect, type SearchableSelectOption } from '../components/ui/searchable-select';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
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
import {
  ReceiptText,
  Plus,
  Search,
  Calendar,
  DollarSign,
  Tag,
  FileText,
  Edit2,
  Trash2,
  Loader2,
  RotateCcw,
  TrendingDown,
  Layers,
  CheckCircle2,
  AlertCircle,
  X,
  CreditCard,
  Hash,
} from 'lucide-react';

interface ExpenseCategory {
  id: number;
  name: string;
  description?: string | null;
  isActive: boolean;
  _count?: {
    expenses: number;
  };
}

interface Expense {
  id: number;
  code: string;
  date: string;
  categoryId: number;
  description: string;
  amount: number;
  createdById?: number | null;
  category: {
    id: number;
    name: string;
  };
  createdBy?: {
    id: number;
    name: string;
    role?: string;
  } | null;
  createdAt: string;
}

interface ExpensesSummary {
  totalAmount: number;
  transactionCount: number;
  categoryCount: number;
  categoryBreakdown: Array<{ name: string; count: number; total: number }>;
}

export const ExpensesPage: React.FC = () => {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  // Data states
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [summary, setSummary] = useState<ExpensesSummary>({
    totalAmount: 0,
    transactionCount: 0,
    categoryCount: 0,
    categoryBreakdown: [],
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Form states for Recording/Editing Expense
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
  const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [categoryId, setCategoryId] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [code, setCode] = useState<string>('');

  /**
   * Convert YYYY-MM-DD string to local Date object for the DatePicker component.
   */
  const selectedDate = useMemo(() => {
    if (!date) return undefined;
    const [year, month, day] = date.split('-').map(Number);
    return new Date(year, month - 1, day);
  }, [date]);

  /**
   * Defensive Date Change Handler for Expenses DatePicker.
   * Formats the selected Date into local YYYY-MM-DD to avoid timezone shifts.
   */
  const handleDateChange = (newDate: Date | undefined) => {
    if (!newDate) {
      setDate(format(new Date(), 'yyyy-MM-dd'));
      return;
    }
    const yyyy = newDate.getFullYear();
    const mm = String(newDate.getMonth() + 1).padStart(2, '0');
    const dd = String(newDate.getDate()).padStart(2, '0');
    setDate(`${yyyy}-${mm}-${dd}`);
  };

  // Table filters & Search
  const [search, setSearch] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const PAGE_SIZE = 15;

  // Add Category Modal States
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [newCategoryDesc, setNewCategoryDesc] = useState<string>('');
  const [creatingCategory, setCreatingCategory] = useState<boolean>(false);

  // Delete Expense Confirmation Modal States
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<boolean>(false);

  /**
   * Format numeric currency to LKR format.
   */
  const formatRs = (val: number): string =>
    `Rs. ${(val || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  /**
   * Load active expense categories from backend.
   */
  const fetchCategories = useCallback(async () => {
    try {
      const data = await get<ExpenseCategory[]>('/expenses/categories');
      setCategories(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('[ExpensesPage] Failed to fetch expense categories:', err);
    }
  }, []);

  /**
   * Load expenses with current filters and date bounds.
   */
  const fetchExpenses = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterStartDate) params.set('startDate', filterStartDate);
      if (filterEndDate) params.set('endDate', filterEndDate);
      if (filterCategory && filterCategory !== 'all') params.set('categoryId', filterCategory);
      if (search.trim()) params.set('search', search.trim());

      const queryStr = params.toString() ? `?${params.toString()}` : '';
      const response = await get<{ expenses: Expense[]; summary: ExpensesSummary }>(`/expenses${queryStr}`);

      if (response && response.expenses) {
        setExpenses(response.expenses);
        if (response.summary) setSummary(response.summary);
      } else if (Array.isArray(response)) {
        setExpenses(response as any);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch expense records');
    } finally {
      setLoading(false);
    }
  }, [filterStartDate, filterEndDate, filterCategory, search]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  /**
   * Category options for SearchableSelect components.
   */
  const categorySelectOptions: SearchableSelectOption[] = useMemo(() => {
    return categories.map((cat) => ({
      value: String(cat.id),
      label: cat.name,
      subLabel: cat.description || undefined,
    }));
  }, [categories]);

  const filterCategoryOptions: SearchableSelectOption[] = useMemo(() => {
    return [
      { value: 'all', label: 'All Categories' },
      ...categories.map((cat) => ({
        value: String(cat.id),
        label: cat.name,
      })),
    ];
  }, [categories]);

  /**
   * Reset form fields to clean default state.
   */
  const resetForm = () => {
    setEditingExpenseId(null);
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setCategoryId('');
    setDescription('');
    setAmount('');
    setCode('');
  };

  /**
   * Create new expense category via modal and immediately select it in form.
   */
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newCategoryName.trim();
    if (!cleanName) {
      toast.error('Please enter a valid category name');
      return;
    }

    try {
      setCreatingCategory(true);
      const newCat = await post<ExpenseCategory>('/expenses/categories', {
        name: cleanName,
        description: newCategoryDesc.trim() || undefined,
      });

      toast.success(`Category "${newCat.name}" created successfully`);
      await fetchCategories();
      setCategoryId(String(newCat.id));
      setNewCategoryName('');
      setNewCategoryDesc('');
      setIsCategoryModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create category');
    } finally {
      setCreatingCategory(false);
    }
  };

  /**
   * Record new expense or update existing expense record.
   */
  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!categoryId) {
      toast.error('Please select an Expense Category');
      return;
    }

    if (!description.trim()) {
      toast.error('Please enter a description for the expense');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Please enter a valid expense amount greater than 0');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        date,
        categoryId: parseInt(categoryId, 10),
        description: description.trim(),
        amount: numAmount,
        code: code.trim() || undefined,
      };

      if (editingExpenseId) {
        await put(`/expenses/${editingExpenseId}`, payload);
        toast.success('Expense record updated successfully');
      } else {
        await post('/expenses', payload);
        toast.success('Expense recorded successfully');
      }

      resetForm();
      await fetchExpenses();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save expense');
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Populate form to edit an existing expense.
   */
  const handleEditClick = (exp: Expense) => {
    setEditingExpenseId(exp.id);
    setDate(exp.date ? exp.date.split('T')[0] : format(new Date(), 'yyyy-MM-dd'));
    setCategoryId(String(exp.categoryId));
    setDescription(exp.description || '');
    setAmount(String(exp.amount || ''));
    setCode(exp.code || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /**
   * Confirm and execute deletion of selected expense.
   */
  const confirmDeleteExpense = async () => {
    if (!expenseToDelete) return;

    try {
      setDeletingExpense(true);
      await del(`/expenses/${expenseToDelete.id}`);
      toast.success(`Expense ${expenseToDelete.code} deleted`);
      setExpenseToDelete(null);
      await fetchExpenses();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete expense');
    } finally {
      setDeletingExpense(false);
    }
  };

  // Paginated expenses
  const paginatedExpenses = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return expenses.slice(start, start + PAGE_SIZE);
  }, [expenses, currentPage]);

  const totalPages = Math.ceil(expenses.length / PAGE_SIZE) || 1;

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Top Header Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400">
              <ReceiptText className="size-5 sm:size-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
                Expenses &amp; Operational Payments
              </h1>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Record overheads, manage dynamic expense categories, and monitor company outflows.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Header Action: Add Category Modal Trigger */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsCategoryModalOpen(true)}
            className="h-9 text-xs font-semibold gap-1.5 border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800"
          >
            <Plus className="size-3.5 text-rose-500" />
            <span>Add Category</span>
          </Button>
        </div>
      </div>

      {/* ── KPI Summary Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Expenses */}
        <div
          className={`p-4 rounded-2xl border ${
            dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Expenses</span>
            <TrendingDown className="size-4 text-rose-500" />
          </div>
          <p className="text-xl md:text-2xl font-bold mt-1 text-rose-600 dark:text-rose-400">
            {formatRs(summary.totalAmount)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Across all filtered records</p>
        </div>

        {/* Transaction Count */}
        <div
          className={`p-4 rounded-2xl border ${
            dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Transactions</span>
            <ReceiptText className="size-4 text-blue-500" />
          </div>
          <p className="text-xl md:text-2xl font-bold mt-1 text-slate-900 dark:text-white">
            {summary.transactionCount || expenses.length}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Recorded expense items</p>
        </div>

        {/* Active Categories */}
        <div
          className={`p-4 rounded-2xl border ${
            dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Categories</span>
            <Layers className="size-4 text-purple-500" />
          </div>
          <p className="text-xl md:text-2xl font-bold mt-1 text-slate-900 dark:text-white">
            {categories.length}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Top: {summary.categoryBreakdown[0]?.name || 'N/A'}
          </p>
        </div>

        {/* Average Expense */}
        <div
          className={`p-4 rounded-2xl border ${
            dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Average Ticket</span>
            <DollarSign className="size-4 text-emerald-500" />
          </div>
          <p className="text-xl md:text-2xl font-bold mt-1 text-slate-900 dark:text-white">
            {formatRs(
              summary.transactionCount > 0
                ? Math.round((summary.totalAmount / summary.transactionCount) * 100) / 100
                : 0
            )}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Per transaction average</p>
        </div>
      </div>

      {/* ── Main Two-Column Workflow: Form & Ledger ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Form: Record Expense */}
        <div className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-zinc-800">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CreditCard className="size-4 text-rose-500" />
              <span>{editingExpenseId ? 'Edit Expense Record' : 'Record New Expense'}</span>
            </h2>
            {editingExpenseId && (
              <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-600 dark:text-amber-400">
                Editing
              </Badge>
            )}
          </div>

          <form onSubmit={handleSubmitExpense} className="space-y-4 text-xs">
            {/* Date Field with Modern Popover Date Picker */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-300 mb-1">
                Date <span className="text-rose-500">*</span>
              </label>
              <DatePicker
                date={selectedDate}
                onDateChange={handleDateChange}
                placeholder="Select expense date..."
                className="h-9 text-xs"
              />
            </div>

            {/* Expense Category Field with Adjacent Modal Trigger */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-300">
                  Expense Category <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(true)}
                  className="text-[10px] font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="size-3" />
                  <span>New Category</span>
                </button>
              </div>
              <SearchableSelect
                value={categoryId}
                onChange={(val) => setCategoryId(val)}
                options={categorySelectOptions}
                placeholder="Select Expense Category..."
                searchPlaceholder="Search categories..."
                className="w-full h-9"
              />
            </div>

            {/* Amount Field */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-300 mb-1">
                Amount (Rs.) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  required
                  className="h-9 text-xs pl-8 font-mono font-bold bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800"
                />
                <span className="text-xs font-bold text-slate-400 absolute left-2.5 top-2.5 pointer-events-none">
                  Rs.
                </span>
              </div>
            </div>

            {/* Description Field */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-300 mb-1">
                Description / Purpose <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="e.g., Factory electricity bill for October, Office tea & snacks, Thread supplier transport..."
                required
                className="w-full rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 p-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-rose-500 resize-none"
              />
            </div>

            {/* Code / Reference ID (Optional or Auto) */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-300 mb-1">
                Reference Code <span className="text-slate-400 font-normal">(Auto if empty)</span>
              </label>
              <div className="relative">
                <Input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Auto-generated (e.g. EXP-0001)"
                  className="h-9 text-xs pl-8 font-mono bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800"
                />
                <Hash className="size-3.5 text-slate-400 absolute left-2.5 top-3 pointer-events-none" />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center gap-2">
              <Button
                type="submit"
                disabled={submitting}
                className="flex-1 h-9 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-xs cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : editingExpenseId ? (
                  <CheckCircle2 className="size-3.5 mr-1" />
                ) : (
                  <Plus className="size-3.5 mr-1" />
                )}
                <span>{editingExpenseId ? 'Update Expense' : 'Record Expense'}</span>
              </Button>

              {editingExpenseId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                  className="h-9 text-xs font-semibold px-3 border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800"
                >
                  <X className="size-3.5" />
                  <span>Cancel</span>
                </Button>
              )}
            </div>
          </form>
        </div>

        {/* Right Ledger Table: Filterable Expense List */}
        <div className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
          {/* Table Toolbar */}
          <div className="p-3.5 sm:p-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="size-3.5 text-slate-400 absolute left-2.5 top-3 pointer-events-none" />
              <Input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by code, description, or category..."
                className="h-9 text-xs pl-8 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Category Filter & Compact Inline Refresh Container */}
            <div className="flex flex-row items-center gap-2 w-full sm:w-auto">
              <div className="flex-1 sm:w-48">
                <SearchableSelect
                  value={filterCategory}
                  onChange={(val) => {
                    setFilterCategory(val);
                    setCurrentPage(1);
                  }}
                  options={filterCategoryOptions}
                  placeholder="Category Filter"
                  className="h-9"
                />
              </div>

              {/* Compact Inline Refresh Button (Strictly to the right on all screens) */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={fetchExpenses}
                disabled={loading}
                className="h-9 w-9 p-0 shrink-0 border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800"
                title="Refresh ledger"
              >
                <RotateCcw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* ── Mobile Card View (block md:hidden) ── */}
          <div className="block md:hidden p-3.5 space-y-3">
            {loading ? (
              <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                <Loader2 className="size-6 animate-spin text-rose-500" />
                <span>Loading expense records...</span>
              </div>
            ) : paginatedExpenses.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                <AlertCircle className="size-6 text-slate-300 dark:text-zinc-700" />
                <span className="font-semibold text-slate-800 dark:text-zinc-200">No expense records found</span>
                <span className="text-[11px] text-slate-400">
                  Use the form on the left to record your first operational expense.
                </span>
              </div>
            ) : (
              paginatedExpenses.map((exp) => (
                <div
                  key={exp.id}
                  className="p-3.5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 shadow-xs space-y-2.5 text-xs select-none"
                >
                  {/* Top Row: Expense Code + Category Badge (Left) & Date (Right) */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400 truncate">
                        {exp.code}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 font-semibold border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 truncate"
                      >
                        {exp.category?.name || 'Uncategorized'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono shrink-0">
                      <Calendar className="size-3" />
                      <span>{exp.date ? exp.date.split('T')[0] : '-'}</span>
                    </div>
                  </div>

                  {/* Middle Row: Description & Recorded By Subtitle */}
                  <div className="space-y-0.5">
                    <p className="font-bold text-slate-900 dark:text-zinc-100 text-xs sm:text-sm break-words">
                      {exp.description}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-zinc-500 truncate">
                      Recorded by: {exp.createdBy?.name || 'Staff'} ({exp.createdBy?.role || 'STAFF'})
                    </p>
                  </div>

                  {/* Bottom Row: Outflow Amount & Touch-Friendly Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-zinc-800/80">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 dark:text-zinc-500">
                        Outflow
                      </span>
                      <span className="font-mono font-bold text-rose-600 dark:text-rose-400 text-sm">
                        {formatRs(exp.amount)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleEditClick(exp)}
                        className="p-2 rounded-xl text-slate-600 dark:text-zinc-300 hover:text-blue-600 bg-slate-100 dark:bg-zinc-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                        title="Edit expense"
                      >
                        <Edit2 className="size-3.5" />
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => setExpenseToDelete(exp)}
                          className="p-2 rounded-xl text-slate-600 dark:text-zinc-300 hover:text-rose-600 bg-slate-100 dark:bg-zinc-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          title="Delete expense"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ── Desktop Table View (hidden md:block) ── */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200 dark:border-zinc-800 hover:bg-transparent">
                  <TableHead className="w-[100px] text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Code
                  </TableHead>
                  <TableHead className="w-[100px] text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Date
                  </TableHead>
                  <TableHead className="w-[130px] text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Category
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Description
                  </TableHead>
                  <TableHead className="w-[110px] text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Amount
                  </TableHead>
                  <TableHead className="w-[80px] text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-48 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="size-6 animate-spin text-rose-500" />
                        <span className="text-xs">Loading expense records...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginatedExpenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-48 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <AlertCircle className="size-6 text-slate-300 dark:text-zinc-700" />
                        <span className="text-xs font-semibold">No expense records found</span>
                        <span className="text-[11px] text-slate-400">
                          Use the form on the left to record your first operational expense.
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedExpenses.map((exp) => (
                    <TableRow
                      key={exp.id}
                      className="border-b border-slate-100 dark:border-zinc-800/80 hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 text-xs"
                    >
                      <TableCell className="font-mono font-bold text-slate-900 dark:text-white">
                        {exp.code}
                      </TableCell>
                      <TableCell className="text-slate-600 dark:text-zinc-400">
                        {exp.date ? exp.date.split('T')[0] : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="text-[10px] font-semibold border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300"
                        >
                          {exp.category?.name || 'Uncategorized'}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-slate-800 dark:text-zinc-200" title={exp.description}>
                        {exp.description}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                        {formatRs(exp.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleEditClick(exp)}
                            className="p-1 rounded-md text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                            title="Edit expense"
                          >
                            <Edit2 className="size-3.5" />
                          </button>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => setExpenseToDelete(exp)}
                              className="p-1 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                              title="Delete expense"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Table Pagination */}
          {expenses.length > PAGE_SIZE && (
            <div className="p-3 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between text-xs text-slate-500">
              <span>
                Showing {(currentPage - 1) * PAGE_SIZE + 1} to{' '}
                {Math.min(currentPage * PAGE_SIZE, expenses.length)} of {expenses.length} records
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="h-8 px-2.5 text-xs"
                >
                  Previous
                </Button>
                <span className="font-semibold text-slate-700 dark:text-zinc-300">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="h-8 px-2.5 text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal: Create New Expense Category ── */}
      <Dialog open={isCategoryModalOpen} onOpenChange={setIsCategoryModalOpen}>
        <DialogContent className="max-w-md p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Tag className="size-4 text-rose-500" />
              <span>Create New Expense Category</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateCategory} className="space-y-4 pt-2 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                Category Name <span className="text-rose-500">*</span>
              </label>
              <Input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g., Utilities, Factory Maintenance, Raw Transport..."
                required
                autoFocus
                className="h-9 text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                Description <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <textarea
                value={newCategoryDesc}
                onChange={(e) => setNewCategoryDesc(e.target.value)}
                rows={2}
                placeholder="Brief explanation of costs included under this category..."
                className="w-full rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 p-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-rose-500 resize-none"
              />
            </div>

            <DialogFooter className="pt-2 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCategoryModalOpen(false)}
                className="h-9 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={creatingCategory}
                className="h-9 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white"
              >
                {creatingCategory ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Plus className="size-3.5 mr-1" />
                )}
                <span>Save Category</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Alert Dialog: Delete Expense Confirmation ── */}
      <AlertDialog
        open={!!expenseToDelete}
        onOpenChange={(open) => !open && setExpenseToDelete(null)}
      >
        <AlertDialogContent className="max-w-md p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <AlertCircle className="size-4 text-rose-600" />
              <span>Delete Expense Record</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              Are you sure you want to permanently delete expense{' '}
              <strong className="text-slate-900 dark:text-white">{expenseToDelete?.code}</strong> for{' '}
              <strong className="text-rose-600 font-mono">
                {expenseToDelete ? formatRs(expenseToDelete.amount) : ''}
              </strong>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-2">
            <AlertDialogCancel disabled={deletingExpense} className="text-xs h-9">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteExpense}
              disabled={deletingExpense}
              className="text-xs h-9 font-semibold bg-rose-600 hover:bg-rose-700 text-white"
            >
              {deletingExpense ? <Loader2 className="size-3.5 animate-spin" /> : 'Yes, Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ExpensesPage;

