import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useUrlFilterSync } from '../hooks/useUrlFilterSync';
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
import { TablePagination } from '../components/common/TablePagination';
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
  FolderTree,
  CornerDownRight,
  ChevronRight,
} from 'lucide-react';

interface ExpenseCategory {
  id: number;
  name: string;
  description?: string | null;
  isActive: boolean;
  parentId?: number | null;
  parent?: {
    id: number;
    name: string;
  } | null;
  subCategories?: ExpenseCategory[];
  _count?: {
    expenses?: number;
    subExpenses?: number;
    subCategories?: number;
  };
}

interface Expense {
  id: number;
  code: string;
  date: string;
  categoryId: number;
  subCategoryId?: number | null;
  description: string;
  amount: number;
  createdById?: number | null;
  category: {
    id: number;
    name: string;
  };
  subCategory?: {
    id: number;
    name: string;
  } | null;
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
  const [subCategoryId, setSubCategoryId] = useState<string>('');
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

  const [searchParams] = useSearchParams();

  // Table filters & Search (hydrated from URL query params)
  const [search, setSearch] = useState<string>(() => searchParams.get('search') || '');
  const [filterCategory, setFilterCategory] = useState<string>(() => searchParams.get('categoryId') || 'all');
  const [filterSubCategory, setFilterSubCategory] = useState<string>(() => searchParams.get('subCategoryId') || 'all');
  const [filterStartDate, setFilterStartDate] = useState<string>(() => searchParams.get('startDate') || '');
  const [filterEndDate, setFilterEndDate] = useState<string>(() => searchParams.get('endDate') || '');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const PAGE_SIZE = 15;

  // Sync active Expenses filters to URL query parameters for browser refresh persistence
  useUrlFilterSync({
    search: search.trim() || undefined,
    categoryId: filterCategory !== 'all' ? filterCategory : undefined,
    subCategoryId: filterSubCategory !== 'all' ? filterSubCategory : undefined,
    startDate: filterStartDate || undefined,
    endDate: filterEndDate || undefined,
  });

  // UX Integrity: Reset pagination to page 1 whenever any filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterCategory, filterSubCategory, filterStartDate, filterEndDate]);

  // Category Modal States (Add & Edit Primary and Sub-Categories)
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);
  const [categoryModalMode, setCategoryModalMode] = useState<'create' | 'edit'>('create');
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [categoryLevel, setCategoryLevel] = useState<'primary' | 'sub'>('primary');
  const [categoryParentId, setCategoryParentId] = useState<string>('');
  const [categoryName, setCategoryName] = useState<string>('');
  const [categoryDesc, setCategoryDesc] = useState<string>('');
  const [savingCategory, setSavingCategory] = useState<boolean>(false);

  // Delete Expense Confirmation Modal States
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<boolean>(false);

  /**
   * Format numeric currency to LKR format.
   */
  const formatRs = (val: number): string =>
    `Rs. ${(val || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  /**
   * Load active expense categories from backend (returns Primary categories with nested subCategories).
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
      if (filterSubCategory && filterSubCategory !== 'all') params.set('subCategoryId', filterSubCategory);
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
  }, [filterStartDate, filterEndDate, filterCategory, filterSubCategory, search]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  /**
   * Primary Category options for SearchableSelect components.
   */
  const primaryCategorySelectOptions: SearchableSelectOption[] = useMemo(() => {
    return categories
      .filter((cat) => !cat.parentId)
      .map((cat) => ({
        value: String(cat.id),
        label: cat.name,
        subLabel: cat.description || undefined,
      }));
  }, [categories]);

  /**
   * Active Primary Categories and Sub-Categories counts for KPI summary.
   */
  const primaryCount = useMemo(() => categories.filter((c) => !c.parentId).length, [categories]);
  const subCount = useMemo(
    () => categories.reduce((acc, c) => acc + (c.subCategories?.length || 0), 0),
    [categories]
  );

  /**
   * Currently active Primary Category record in the expense form.
   */
  const activePrimaryCategory = useMemo(() => {
    return categories.find((c) => String(c.id) === String(categoryId));
  }, [categories, categoryId]);

  /**
   * Cascading Sub-Category options dynamically filtered by the selected Primary Category.
   */
  const subCategorySelectOptions: SearchableSelectOption[] = useMemo(() => {
    if (!activePrimaryCategory || !activePrimaryCategory.subCategories) return [];
    return activePrimaryCategory.subCategories.map((sub) => ({
      value: String(sub.id),
      label: sub.name,
      subLabel: sub.description || undefined,
    }));
  }, [activePrimaryCategory]);

  /**
   * Filter options for Primary Categories in the ledger toolbar.
   */
  const filterCategoryOptions: SearchableSelectOption[] = useMemo(() => {
    return [
      { value: 'all', label: 'All Primary Categories' },
      ...categories
        .filter((cat) => !cat.parentId)
        .map((cat) => ({
          value: String(cat.id),
          label: cat.name,
        })),
    ];
  }, [categories]);

  /**
   * Cascading filter options for Sub-Categories in the ledger toolbar.
   */
  const filterSubCategoryOptions: SearchableSelectOption[] = useMemo(() => {
    if (filterCategory && filterCategory !== 'all') {
      const selectedPrimary = categories.find((c) => String(c.id) === String(filterCategory));
      return [
        { value: 'all', label: 'All Sub-Categories' },
        ...(selectedPrimary?.subCategories || []).map((sub) => ({
          value: String(sub.id),
          label: sub.name,
        })),
      ];
    }

    // When all primary categories are selected, show all sub-categories labeled with their parent
    const allSubs = categories.flatMap((c) =>
      (c.subCategories || []).map((sub) => ({
        value: String(sub.id),
        label: `${c.name} › ${sub.name}`,
      }))
    );
    return [
      { value: 'all', label: 'All Sub-Categories' },
      ...allSubs,
    ];
  }, [categories, filterCategory]);

  /**
   * Available Parent Primary Categories for Sub-Category creation/editing.
   */
  const parentCategoryOptions: SearchableSelectOption[] = useMemo(() => {
    return categories
      .filter((cat) => !cat.parentId && (editingCategoryId ? cat.id !== editingCategoryId : true))
      .map((cat) => ({
        value: String(cat.id),
        label: cat.name,
        subLabel: cat.description || undefined,
      }));
  }, [categories, editingCategoryId]);

  /**
   * Reset expense form fields to clean default state.
   */
  const resetForm = () => {
    setEditingExpenseId(null);
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setCategoryId('');
    setSubCategoryId('');
    setDescription('');
    setAmount('');
    setCode('');
  };

  /**
   * Reset category modal form state.
   */
  const resetCategoryModal = (presetParentId?: string) => {
    setCategoryModalMode('create');
    setEditingCategoryId(null);
    setCategoryLevel(presetParentId ? 'sub' : 'primary');
    setCategoryParentId(presetParentId || '');
    setCategoryName('');
    setCategoryDesc('');
  };

  /**
   * Open Category Modal to create a new Primary Category.
   */
  const openCreatePrimaryCategoryModal = () => {
    resetCategoryModal();
    setIsCategoryModalOpen(true);
  };

  /**
   * Open Category Modal to create a new Sub-Category.
   * Directly presets Sub-Category mode with the provided parent or active form category.
   */
  const openCreateSubCategoryModal = (presetParentId?: string) => {
    setCategoryModalMode('create');
    setEditingCategoryId(null);
    setCategoryLevel('sub');
    const defaultParent =
      presetParentId ||
      categoryId ||
      (categories.find((c) => !c.parentId)?.id ? String(categories.find((c) => !c.parentId)!.id) : '');
    setCategoryParentId(defaultParent);
    setCategoryName('');
    setCategoryDesc('');
    setIsCategoryModalOpen(true);
  };

  /**
   * Hydrate category modal to edit an existing Primary or Sub-Category.
   */
  const handleEditCategory = (cat: ExpenseCategory) => {
    setCategoryModalMode('edit');
    setEditingCategoryId(cat.id);
    setCategoryLevel(cat.parentId ? 'sub' : 'primary');
    setCategoryParentId(cat.parentId ? String(cat.parentId) : '');
    setCategoryName(cat.name);
    setCategoryDesc(cat.description || '');
    setIsCategoryModalOpen(true);
  };

  /**
   * Save (Create or Update) Expense Category via modal with strict level and parentId validation.
   */
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = categoryName.trim();
    if (!cleanName) {
      toast.error('Category name is required');
      return;
    }

    if (categoryLevel === 'sub') {
      const parsedParent = parseInt(categoryParentId, 10);
      if (!categoryParentId || isNaN(parsedParent) || parsedParent <= 0) {
        toast.error('Please select a Parent Primary Category');
        return;
      }
    }

    try {
      setSavingCategory(true);
      const parsedParentId = categoryLevel === 'sub' ? parseInt(categoryParentId, 10) : null;
      const payload = {
        name: cleanName,
        description: categoryDesc.trim() || undefined,
        parentId: parsedParentId,
        level: categoryLevel,
      };

      if (categoryModalMode === 'edit' && editingCategoryId) {
        await put(`/expenses/categories/${editingCategoryId}`, payload);
        toast.success(`Category "${cleanName}" updated successfully`);
      } else {
        const newCat = await post<ExpenseCategory>('/expenses/categories', payload);
        toast.success(
          `${categoryLevel === 'sub' ? 'Sub-category' : 'Primary category'} "${cleanName}" created successfully`
        );
        // Automatically hydrate expense form with the newly created category
        if (categoryLevel === 'primary' && newCat?.id) {
          setCategoryId(String(newCat.id));
          setSubCategoryId('');
        } else if (categoryLevel === 'sub' && newCat?.id) {
          setCategoryId(categoryParentId);
          setSubCategoryId(String(newCat.id));
        }
      }

      await fetchCategories();
      resetCategoryModal();
      setIsCategoryModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save expense category');
    } finally {
      setSavingCategory(false);
    }
  };

  /**
   * Record new expense or update existing expense record.
   */
  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!categoryId) {
      toast.error('Please select a Primary Expense Category');
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
        subCategoryId: subCategoryId ? parseInt(subCategoryId, 10) : null,
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
    setSubCategoryId(exp.subCategoryId ? String(exp.subCategoryId) : '');
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
            onClick={openCreatePrimaryCategoryModal}
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
            {primaryCount}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {primaryCount} Primary • {subCount} Sub
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

            {/* Primary Category Field with Adjacent Modal Trigger */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-300">
                  Primary Category <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={openCreatePrimaryCategoryModal}
                  className="text-[10px] font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="size-3" />
                  <span>New Category</span>
                </button>
              </div>
              <SearchableSelect
                value={categoryId}
                onChange={(val) => {
                  setCategoryId(val);
                  setSubCategoryId('');
                }}
                onValueChange={(val) => {
                  setCategoryId(val);
                  setSubCategoryId('');
                }}
                options={primaryCategorySelectOptions}
                placeholder="Select Primary Category..."
                searchPlaceholder="Search primary categories..."
                className="w-full h-9"
              />
            </div>

            {/* Cascading Sub-Category Field */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-300">
                  Sub-Category <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <button
                  type="button"
                  onClick={() => openCreateSubCategoryModal(categoryId)}
                  className="text-[10px] font-bold text-purple-600 hover:text-purple-700 dark:text-purple-400 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="size-3" />
                  <span>New Sub-Category</span>
                </button>
              </div>
              <SearchableSelect
                value={subCategoryId}
                onChange={(val) => setSubCategoryId(val)}
                onValueChange={(val) => setSubCategoryId(val)}
                options={subCategorySelectOptions}
                placeholder={
                  categoryId
                    ? subCategorySelectOptions.length > 0
                      ? 'Select Sub-Category (Optional)...'
                      : 'No sub-categories (Optional)'
                    : 'Select Primary Category first...'
                }
                searchPlaceholder="Search sub-categories..."
                disabled={!categoryId}
                side="bottom"
                avoidCollisions={false}
                usePortal={true}
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

            {/* Description Field (Strictly Optional) */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-300 mb-1">
                Description / Purpose <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="e.g., Factory electricity bill for October, Office tea & snacks, Thread supplier transport..."
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
          {/* Table Toolbar — flex-wrap + min-w-0 ensures filters never overflow the 8-col ledger card */}
          <div className="p-3.5 sm:p-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 flex flex-col sm:flex-row sm:flex-wrap gap-2.5 items-stretch sm:items-center justify-between min-w-0">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[180px]">
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

            {/* Cascading Category Filters & Compact Inline Refresh Container */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 w-full sm:w-auto min-w-0">
              {/* Primary Category Filter */}
              <div className="w-full sm:w-36 lg:w-40 min-w-0">
                <SearchableSelect
                  value={filterCategory}
                  onChange={(val) => {
                    setFilterCategory(val);
                    setFilterSubCategory('all');
                    setCurrentPage(1);
                  }}
                  onValueChange={(val) => {
                    setFilterCategory(val);
                    setFilterSubCategory('all');
                    setCurrentPage(1);
                  }}
                  options={filterCategoryOptions}
                  placeholder="Primary Category"
                  className="h-9"
                />
              </div>

              {/* Sub-Category Filter */}
              <div className="w-full sm:w-36 lg:w-40 min-w-0">
                <SearchableSelect
                  value={filterSubCategory}
                  onChange={(val) => {
                    setFilterSubCategory(val);
                    setCurrentPage(1);
                  }}
                  onValueChange={(val) => {
                    setFilterSubCategory(val);
                    setCurrentPage(1);
                  }}
                  options={filterSubCategoryOptions}
                  placeholder="Sub-Category"
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
                  {/* Top Row: Expense Code + Category Badges (Left) & Date (Right) */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                      <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400 truncate">
                        {exp.code}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 font-semibold border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 truncate"
                      >
                        {exp.category?.name || 'Uncategorized'}
                      </Badge>
                      {exp.subCategory?.name && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 font-semibold border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 truncate"
                        >
                          {exp.subCategory.name}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono shrink-0">
                      <Calendar className="size-3" />
                      <span>{exp.date ? exp.date.split('T')[0] : '-'}</span>
                    </div>
                  </div>

                  {/* Middle Row: Description & Recorded By Subtitle */}
                  <div className="space-y-0.5">
                    <p className="font-medium text-slate-900 dark:text-zinc-100 text-xs sm:text-sm break-words">
                      {exp.description || '-'}
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
                  <TableHead className="w-[95px] text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Code
                  </TableHead>
                  <TableHead className="w-[95px] text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Date
                  </TableHead>
                  <TableHead className="w-[130px] text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Primary Category
                  </TableHead>
                  <TableHead className="w-[125px] text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Sub-Category
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
                    <TableCell colSpan={7} className="h-48 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="size-6 animate-spin text-rose-500" />
                        <span className="text-xs">Loading expense records...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginatedExpenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-48 text-center text-slate-400">
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
                      <TableCell>
                        {exp.subCategory?.name ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-semibold border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300"
                          >
                            {exp.subCategory.name}
                          </Badge>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-slate-800 dark:text-zinc-200" title={exp.description || ''}>
                        {exp.description || '-'}
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

          {/* Standardized Table Pagination */}
          {expenses.length > 0 && (
            <div className="p-3 border-t border-slate-200 dark:border-zinc-800">
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalCount={expenses.length}
                pageSize={PAGE_SIZE}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Modal: Manage, Add & Edit Expense Categories Hierarchy ── */}
      <Dialog
        open={isCategoryModalOpen}
        onOpenChange={(open) => {
          setIsCategoryModalOpen(open);
          if (!open) resetCategoryModal();
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xl overflow-hidden">
          <DialogHeader className="pb-2 border-b border-slate-100 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FolderTree className="size-4 text-rose-500" />
                <span>
                  {categoryModalMode === 'edit'
                    ? `Edit ${categoryLevel === 'sub' ? 'Sub-Category' : 'Primary Category'}`
                    : `Create ${categoryLevel === 'sub' ? 'Sub-Category' : 'Primary Category'}`}
                </span>
              </DialogTitle>
              {categoryModalMode === 'edit' && (
                <button
                  type="button"
                  onClick={() => resetCategoryModal()}
                  className="text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="size-3" />
                  <span>Switch to New</span>
                </button>
              )}
            </div>
          </DialogHeader>

          <div className="overflow-y-auto space-y-5 pr-1 flex-1 py-1">
            {/* Form Section */}
            <form onSubmit={handleSaveCategory} className="space-y-3.5 text-xs bg-slate-50/70 dark:bg-zinc-950/60 p-3.5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80">
              {/* Category Level Toggle */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                  Category Level <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCategoryLevel('primary');
                      setCategoryParentId('');
                    }}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                      categoryLevel === 'primary'
                        ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 shadow-xs'
                        : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <Layers className="size-3.5" />
                    <span>Primary Category</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCategoryLevel('sub');
                      if (!categoryParentId && categories.length > 0) {
                        const firstPrimary = categories.find(
                          (c) => !c.parentId && (!editingCategoryId || c.id !== editingCategoryId)
                        );
                        if (firstPrimary) setCategoryParentId(String(firstPrimary.id));
                      }
                    }}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                      categoryLevel === 'sub'
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 shadow-xs'
                        : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <CornerDownRight className="size-3.5" />
                    <span>Sub-Category</span>
                  </button>
                </div>
              </div>

              {/* Parent Primary Category Select (shown only when Sub-Category is active) */}
              {categoryLevel === 'sub' && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Parent Primary Category <span className="text-rose-500">*</span>
                  </label>
                  <SearchableSelect
                    value={categoryParentId}
                    onChange={(val) => setCategoryParentId(val)}
                    onValueChange={(val) => setCategoryParentId(val)}
                    options={parentCategoryOptions}
                    placeholder="Select Parent Primary Category..."
                    searchPlaceholder="Search primary categories..."
                    side="bottom"
                    usePortal={true}
                    className="h-9 w-full bg-white dark:bg-zinc-900"
                  />
                </div>
              )}

              {/* Category Name */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Category Name <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="text"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder={
                    categoryLevel === 'sub'
                      ? 'e.g., Office Tea & Snacks, Machine Spare Parts, Courier & Shipping...'
                      : 'e.g., Utilities, Factory Maintenance, Raw Transport...'
                  }
                  required
                  autoFocus
                  className="h-9 text-xs bg-white dark:bg-zinc-900"
                />
              </div>

              {/* Category Description (Optional) */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Description <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  value={categoryDesc}
                  onChange={(e) => setCategoryDesc(e.target.value)}
                  rows={2}
                  placeholder="Optional brief explanation of costs classified under this category..."
                  className="w-full rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-rose-500 resize-none"
                />
              </div>

              {/* Form Buttons */}
              <div className="pt-1 flex items-center justify-end gap-2">
                {categoryModalMode === 'edit' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => resetCategoryModal()}
                    className="h-8 text-xs font-semibold"
                  >
                    Cancel Edit
                  </Button>
                )}
                <Button
                  type="submit"
                  size="sm"
                  disabled={savingCategory}
                  className="h-8 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white"
                >
                  {savingCategory ? (
                    <Loader2 className="size-3.5 animate-spin mr-1" />
                  ) : categoryModalMode === 'edit' ? (
                    <CheckCircle2 className="size-3.5 mr-1" />
                  ) : (
                    <Plus className="size-3.5 mr-1" />
                  )}
                  <span>{categoryModalMode === 'edit' ? 'Update Category' : 'Save Category'}</span>
                </Button>
              </div>
            </form>

            {/* Existing Categories Hierarchy List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  Existing Categories &amp; Hierarchy ({categories.filter((c) => !c.parentId).length} Primary)
                </span>
                <span className="text-[10px] text-slate-400">
                  Click Edit on any category to update it
                </span>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {categories.filter((c) => !c.parentId).length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 text-center text-slate-400 text-xs">
                    No categories created yet. Use the form above to add your first Primary Category.
                  </div>
                ) : (
                  categories
                    .filter((c) => !c.parentId)
                    .map((primary) => {
                      const subs = primary.subCategories || [];
                      const isSelectedForEdit = categoryModalMode === 'edit' && editingCategoryId === primary.id;

                      return (
                        <div
                          key={primary.id}
                          className={`rounded-xl border p-2.5 transition-colors ${
                            isSelectedForEdit
                              ? 'border-rose-400 bg-rose-50/40 dark:bg-rose-950/20'
                              : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60'
                          }`}
                        >
                          {/* Primary Category Row */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="p-1 rounded-md bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                                <Layers className="size-3.5" />
                              </span>
                              <div className="min-w-0">
                                <span className="font-bold text-xs text-slate-900 dark:text-zinc-100 truncate block">
                                  {primary.name}
                                </span>
                                {primary.description && (
                                  <span className="text-[10px] text-slate-400 dark:text-zinc-500 block truncate">
                                    {primary.description}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <Badge
                                variant="outline"
                                className="text-[10px] font-mono border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800"
                              >
                                {subs.length} {subs.length === 1 ? 'sub' : 'subs'}
                              </Badge>

                              <button
                                type="button"
                                onClick={() => openCreateSubCategoryModal(String(primary.id))}
                                className="p-1 rounded-md text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-colors text-[10px] font-semibold flex items-center gap-0.5 cursor-pointer"
                                title="Add sub-category under this primary"
                              >
                                <Plus className="size-3" />
                                <span>Sub</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleEditCategory(primary)}
                                className="p-1 rounded-md text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                                title="Edit this primary category"
                              >
                                <Edit2 className="size-3" />
                              </button>
                            </div>
                          </div>

                          {/* Nested Sub-Categories */}
                          {subs.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-zinc-800/80 space-y-1.5 pl-4 ml-2 border-l-2 border-purple-200 dark:border-purple-900/50">
                              {subs.map((sub) => {
                                const isSubSelected =
                                  categoryModalMode === 'edit' && editingCategoryId === sub.id;

                                return (
                                  <div
                                    key={sub.id}
                                    className={`flex items-center justify-between gap-2 p-1.5 rounded-lg text-xs transition-colors ${
                                      isSubSelected
                                        ? 'bg-purple-50 dark:bg-purple-950/40'
                                        : 'hover:bg-slate-50 dark:hover:bg-zinc-800/40'
                                    }`}
                                  >
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <CornerDownRight className="size-3 text-purple-500 shrink-0" />
                                      <span className="font-medium text-slate-800 dark:text-zinc-200 truncate">
                                        {sub.name}
                                      </span>
                                      {sub.description && (
                                        <span className="text-[10px] text-slate-400 dark:text-zinc-500 truncate hidden sm:inline">
                                          — {sub.description}
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => handleEditCategory(sub)}
                                        className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                                        title="Edit this sub-category"
                                      >
                                        <Edit2 className="size-3" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                resetCategoryModal();
                setIsCategoryModalOpen(false);
              }}
              className="h-8 text-xs"
            >
              Close
            </Button>
          </DialogFooter>
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

