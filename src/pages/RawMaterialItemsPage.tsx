import React, { useState, useEffect, useMemo } from 'react';
// Shadcn UI standard component primitives
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
// Shadcn searchable combobox component
import { SearchableSelect, type SearchableSelectOption } from '../components/ui/searchable-select';
import { useTheme } from '../contexts/ThemeContext';
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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../components/ui/dropdown-menu';
import { get, post, put, del } from '../lib/api';
import { toast } from 'react-toastify';
import {
  Boxes,
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  Loader2,
  X,
  MoreVertical,
  CheckCircle2,
  Tag,
  Sparkles,
  Scissors,       // ⭐ Added for Production Deduction
  CornerDownLeft, // ⭐ Added for Scrap Return
  History,        // ⭐ Added for Stock Movement Ledger
  SlidersHorizontal,
} from 'lucide-react';

/**
 * Filter options for raw material stock alert status
 */
const STOCK_ALERT_OPTIONS: SearchableSelectOption[] = [
  { value: 'ALL', label: 'All Stock' },
  { value: 'LOW_STOCK', label: 'Low Stock Only' },
  { value: 'OPTIMAL', label: 'Optimal Stock' },
];

/**
 * Filter options for raw material unit types
 */
const UNIT_OPTIONS: SearchableSelectOption[] = [
  { value: 'ALL', label: 'All Units' },
  { value: 'METERS', label: 'METERS' },
  { value: 'YARDS', label: 'YARDS' },
  { value: 'KILOGRAMS', label: 'KG (Kilograms)' },
  { value: 'PCS', label: 'PCS (Pieces)' },
  { value: 'ROLLS', label: 'ROLLS' },
  { value: 'CONES', label: 'CONES' },
  { value: 'PACKS', label: 'PACKS' },
];

/**
 * Sorting preferences for raw materials inventory
 */
const MATERIAL_SORT_OPTIONS: SearchableSelectOption[] = [
  { value: 'newest', label: 'Newest First' },
  { value: 'stock_asc', label: 'Stock: Low to High' },
  { value: 'stock_desc', label: 'Stock: High to Low' },
  { value: 'cost_desc', label: 'Avg Cost: High to Low' },
];

// ⭐ Import Material Modals
import { MaterialStockActionModal } from '../components/materials/MaterialStockActionModal';
import { MaterialMovementHistoryModal } from '../components/materials/MaterialMovementHistoryModal';

export type RawMaterialUnit = 'METERS' | 'YARDS' | 'KILOGRAMS' | 'PCS' | 'ROLLS' | 'CONES' | 'PACKS';

export interface RawMaterialItem {
  id: number;
  name: string;
  code: string | null;
  description: string | null;
  unit: RawMaterialUnit;
  currentStock: number;
  alertThreshold: number;
  unitCostAverage: number;
  _count?: {
    purchaseItems: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface FormData {
  name: string;
  code: string;
  description: string;
  unit: RawMaterialUnit;
  alertThreshold: number | '';
}

const INITIAL_FORM_DATA: FormData = {
  name: '',
  code: '',
  description: '',
  unit: 'METERS',
  alertThreshold: 10,
};

const UNITS: RawMaterialUnit[] = [
  'METERS',
  'YARDS',
  'KILOGRAMS',
  'PCS',
  'ROLLS',
  'CONES',
  'PACKS',
];

/**
 * Raw Material Items & Inventory Directory Page
 * Provides full catalog of raw inputs, unit assignments, threshold alerts, and CRUD operations.
 */
export const RawMaterialItemsPage: React.FC = () => {
  // Theme state for adaptive combobox dropdown styling
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';

  const [items, setItems] = useState<RawMaterialItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Filter & Sort States matching unified standard
  const [stockAlertStatus, setStockAlertStatus] = useState<string>('ALL');
  const [selectedUnit, setSelectedUnit] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState<boolean>(false);

  // Modal and form states
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<RawMaterialItem | null>(null);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Deletion alert states
  const [deletingItem, setDeletingItem] = useState<RawMaterialItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // ⭐ Material Stock Action Modals state (Deduct / Scrap Return)
  const [stockActionModal, setStockActionModal] = useState<{
    isOpen: boolean;
    material: RawMaterialItem | null;
    mode: 'DEDUCT' | 'SCRAP_RETURN';
  }>({
    isOpen: false,
    material: null,
    mode: 'DEDUCT',
  });

  // ⭐ Material Movement History Modal state
  const [historyModal, setHistoryModal] = useState<{
    isOpen: boolean;
    material: RawMaterialItem | null;
  }>({
    isOpen: false,
    material: null,
  });

  /**
   * Count of active non-default secondary filters for badge indicator
   */
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (stockAlertStatus !== 'ALL') count++;
    if (selectedUnit !== 'ALL') count++;
    if (sortBy !== 'newest') count++;
    return count;
  }, [stockAlertStatus, selectedUnit, sortBy]);

  /**
   * Reset all secondary filters and search query back to default view
   */
  const handleClearAllFilters = () => {
    setStockAlertStatus('ALL');
    setSelectedUnit('ALL');
    setSortBy('newest');
    setSearchQuery('');
  };

  /**
   * Load raw material items from backend API
   */
  const fetchItems = async () => {
    try {
      setLoading(true);
      const data = await get<RawMaterialItem[]>('/raw-material-items');
      setItems(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load raw material items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  /**
   * Reactive client-side filtering and sorting for raw materials
   */
  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        // 1. Search Query (name, code, description)
        const q = searchQuery.toLowerCase().trim();
        const matchesSearch =
          !q ||
          item.name.toLowerCase().includes(q) ||
          (item.code && item.code.toLowerCase().includes(q)) ||
          (item.description && item.description.toLowerCase().includes(q));

        // 2. Stock Alert Status
        const isLow = item.currentStock <= item.alertThreshold;
        let matchesAlert = true;
        if (stockAlertStatus === 'LOW_STOCK') {
          matchesAlert = isLow;
        } else if (stockAlertStatus === 'OPTIMAL') {
          matchesAlert = !isLow;
        }

        // 3. Unit Type
        const matchesUnit =
          selectedUnit === 'ALL' || item.unit === selectedUnit;

        return matchesSearch && matchesAlert && matchesUnit;
      })
      .sort((a, b) => {
        if (sortBy === 'stock_asc') {
          return a.currentStock - b.currentStock;
        }
        if (sortBy === 'stock_desc') {
          return b.currentStock - a.currentStock;
        }
        if (sortBy === 'cost_desc') {
          return (Number(b.unitCostAverage) || 0) - (Number(a.unitCostAverage) || 0);
        }
        // Default: newest first
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
          b.id - a.id
        );
      });
  }, [items, searchQuery, stockAlertStatus, selectedUnit, sortBy]);

  const [generatingCode, setGeneratingCode] = useState<boolean>(false);

  /**
   * Fetch real-time auto generated sequential code directly from Backend Database
   */
  const fetchNextItemCodeFromBackend = async (): Promise<string> => {
    try {
      setGeneratingCode(true);
      const res = await get<{ code: string }>('/raw-material-items/next-code');
      return res?.code || 'RM-0001';
    } catch {
      return 'RM-0001';
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleOpenAddModal = async () => {
    setEditingItem(null);
    setFormData(INITIAL_FORM_DATA);
    setIsModalOpen(true);

    // Fetch accurate code from DB immediately upon modal opening
    const nextCode = await fetchNextItemCodeFromBackend();
    setFormData((prev) => ({ ...prev, code: nextCode }));
  };

  const handleOpenEditModal = (item: RawMaterialItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      code: item.code || '',
      description: item.description || '',
      unit: item.unit,
      alertThreshold: item.alertThreshold,
    });
    setIsModalOpen(true);
  };

  /**
   * Handle Create / Update Item form submission
   */
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Item name is required');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        name: formData.name.trim(),
        code: formData.code.trim() || null,
        description: formData.description.trim() || null,
        unit: formData.unit,
        alertThreshold: formData.alertThreshold === '' ? 10 : Number(formData.alertThreshold),
      };

      if (editingItem) {
        const updated = await put<RawMaterialItem>(`/raw-material-items/${editingItem.id}`, payload);
        setItems((prev) => prev.map((item) => (item.id === editingItem.id ? { ...item, ...updated } : item)));
        toast.success('Raw material updated successfully');
      } else {
        const created = await post<RawMaterialItem>('/raw-material-items', payload);
        setItems((prev) => [created, ...prev]);
        toast.success('Raw material registered successfully');
      }
      setIsModalOpen(false);
      setFormData(INITIAL_FORM_DATA);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save item');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Confirm Item Deletion
   */
  const handleDeleteConfirm = async () => {
    if (!deletingItem) return;

    try {
      setIsDeleting(true);
      await del(`/raw-material-items/${deletingItem.id}`);
      setItems((prev) => prev.filter((i) => i.id !== deletingItem.id));
      toast.success('Raw material item deleted successfully');
      setDeletingItem(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete item');
    } finally {
      setIsDeleting(false);
    }
  };

  // Metrics
  const totalItems = items.length;
  const lowStockCount = useMemo(
    () => items.filter((i) => i.currentStock <= i.alertThreshold).length,
    [items]
  );

  return (
    <div className="space-y-6 w-full pb-16">
      {/* Header and Add Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Boxes className="size-6 text-indigo-600 dark:text-indigo-400" />
            Raw Material Inventory
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Manage fabric and trim specifications, units, and inventory threshold alerts.
          </p>
        </div>
        <Button onClick={handleOpenAddModal} className="gap-2 h-9">
          <Plus className="size-4" /> Add Material Item
        </Button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border p-4 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 flex items-center gap-4">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 rounded-xl">
            <Boxes className="size-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Total Materials Catalogued</span>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">{totalItems}</h3>
          </div>
        </div>
        <div className="rounded-2xl border p-4 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 flex items-center gap-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 rounded-xl">
            <AlertTriangle className="size-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Low Stock Alerts</span>
            <h3 className="text-2xl font-bold text-amber-600 mt-0.5">{lowStockCount}</h3>
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
              placeholder="Search name, code, description..."
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

        {/* Collapsible Expansion Tray */}
        {mobileFiltersOpen && (
          <div className="pt-2.5 border-t border-slate-100 dark:border-zinc-800/80 space-y-2.5 animate-in fade-in-0 slide-in-from-top-2 duration-150">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full">
              {/* Stock Alert Status Filter */}
              <div className="min-w-0">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Stock Alert Status
                </label>
                <SearchableSelect
                  options={STOCK_ALERT_OPTIONS}
                  value={stockAlertStatus}
                  onValueChange={(val) => setStockAlertStatus(val)}
                  placeholder="All Stock"
                  searchPlaceholder="Filter stock status..."
                  dark={dark}
                  className="h-9 text-xs"
                />
              </div>

              {/* Unit Type Filter */}
              <div className="min-w-0">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Unit Type
                </label>
                <SearchableSelect
                  options={UNIT_OPTIONS}
                  value={selectedUnit}
                  onValueChange={(val) => setSelectedUnit(val)}
                  placeholder="All Units"
                  searchPlaceholder="Filter unit type..."
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
                  options={MATERIAL_SORT_OPTIONS}
                  value={sortBy}
                  onValueChange={(val) => setSortBy(val)}
                  placeholder="Sort Materials..."
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
            placeholder="Search material by name, item code, or description..."
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

        {/* Stock Alert Status Selector */}
        <div className="w-48 xl:w-52 shrink-0">
          <SearchableSelect
            options={STOCK_ALERT_OPTIONS}
            value={stockAlertStatus}
            onValueChange={(val) => setStockAlertStatus(val)}
            placeholder="All Stock"
            searchPlaceholder="Filter alert status..."
            dark={dark}
          />
        </div>

        {/* Unit Type Selector */}
        <div className="w-44 xl:w-48 shrink-0">
          <SearchableSelect
            options={UNIT_OPTIONS}
            value={selectedUnit}
            onValueChange={(val) => setSelectedUnit(val)}
            placeholder="All Units"
            searchPlaceholder="Filter unit..."
            dark={dark}
          />
        </div>

        {/* Sort Selector & Clear All Shortcut */}
        <div className="w-48 xl:w-52 shrink-0 flex items-center gap-1.5">
          <div className="flex-1 min-w-0">
            <SearchableSelect
              options={MATERIAL_SORT_OPTIONS}
              value={sortBy}
              onValueChange={(val) => setSortBy(val)}
              placeholder="Sort Materials..."
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

      {loading ? (
        <div className="rounded-2xl border bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 p-12 text-center">
          <Loader2 className="size-6 animate-spin mx-auto text-indigo-500" />
          <span className="text-xs text-slate-400 mt-2 block">Loading materials...</span>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-2xl border bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 p-12 text-center text-slate-400 text-xs">
          No raw material items found matching criteria.
        </div>
      ) : (
        <>
          {/* ── Mobile & Tablet Touch Cards (< 1024px) ── */}
          <div className="block lg:hidden space-y-3">
            {filteredItems.map((item) => {
              const isLow = item.currentStock <= item.alertThreshold;
              const totalValuation = item.currentStock * item.unitCostAverage;

              return (
                <div
                  key={item.id}
                  className="rounded-2xl border bg-white dark:bg-zinc-900/70 border-slate-200 dark:border-zinc-800 p-4 shadow-xs space-y-3.5 transition-all"
                >
                  {/* Header: Title, Item Code badge, Unit pill, Status chip */}
                  <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-zinc-800/80">
                    <div
                      onClick={() => handleOpenEditModal(item)}
                      className="cursor-pointer group/mat select-none min-w-0"
                      title="Click to edit material item"
                    >
                      <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 shrink-0">
                          <Tag className="size-4" />
                        </div>
                        <span className="group-hover/mat:text-indigo-600 dark:group-hover/mat:text-indigo-400 group-hover/mat:underline transition-colors truncate">
                          {item.name}
                        </span>
                      </div>
                      {item.description && (
                        <div className="text-[11px] text-slate-400 truncate max-w-[280px] mt-0.5">
                          {item.description}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.code && (
                        <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
                          {item.code}
                        </span>
                      )}
                      <Badge variant="outline" className="text-[10px] font-semibold">
                        {item.unit}
                      </Badge>
                    </div>
                  </div>

                  {/* Stock & Cost Pill Grid (2-column) */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* Current Available Stock with threshold & low stock warning */}
                    <div
                      className={`p-3 rounded-xl border flex flex-col justify-between ${
                        isLow
                          ? 'bg-rose-50/50 dark:bg-rose-950/30 border-rose-200/80 dark:border-rose-900/60 text-rose-700 dark:text-rose-400'
                          : 'bg-slate-50 dark:bg-zinc-800/60 border-slate-200/60 dark:border-zinc-700/60 text-slate-800 dark:text-zinc-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                          Available Stock
                        </span>
                        {isLow ? (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-rose-600 bg-rose-100 dark:bg-rose-900/50 px-1.5 py-0.5 rounded-full">
                            <AlertTriangle className="size-2.5" /> Low
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-medium text-emerald-600 bg-emerald-100 dark:bg-emerald-900/50 px-1.5 py-0.5 rounded-full">
                            <CheckCircle2 className="size-2.5" /> Optimal
                          </span>
                        )}
                      </div>
                      <div className="mt-1">
                        <span className={`font-mono text-sm sm:text-base font-extrabold ${isLow ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
                          {item.currentStock.toLocaleString()}
                        </span>
                        <span className="text-[10px] ml-1 text-slate-500 font-medium">{item.unit.toLowerCase()}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5 block">
                        Min threshold: {item.alertThreshold} {item.unit.toLowerCase()}
                      </span>
                    </div>

                    {/* Avg Unit Cost & Total Valuation */}
                    <div className="p-3 rounded-xl border bg-slate-50 dark:bg-zinc-800/60 border-slate-200/60 dark:border-zinc-700/60 flex flex-col justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                        Avg Unit Cost
                      </span>
                      <div className="mt-1">
                        <span className="font-mono text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                          Rs. {item.unitCostAverage.toLocaleString()}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono mt-0.5 block truncate" title={`Valuation: Rs. ${totalValuation.toLocaleString()}`}>
                        Valuation: Rs. {totalValuation.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Touch Action Bar */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800/80">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setStockActionModal({
                          isOpen: true,
                          material: item,
                          mode: 'DEDUCT',
                        })
                      }
                      className="flex-1 min-w-[95px] h-8 text-xs font-semibold gap-1.5 border-amber-200 dark:border-amber-900/60 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                    >
                      <Scissors className="size-3.5" /> Deduct
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setStockActionModal({
                          isOpen: true,
                          material: item,
                          mode: 'SCRAP_RETURN',
                        })
                      }
                      className="flex-1 min-w-[110px] h-8 text-xs font-semibold gap-1.5 border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                    >
                      <CornerDownLeft className="size-3.5" /> Scrap Return
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setHistoryModal({
                          isOpen: true,
                          material: item,
                        })
                      }
                      className="flex-1 min-w-[90px] h-8 text-xs font-medium gap-1.5 border-indigo-200 dark:border-indigo-900/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                    >
                      <History className="size-3.5" /> History
                    </Button>

                    <div className="flex items-center gap-1 shrink-0 ml-auto">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEditModal(item)}
                        className="size-8 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                        title="Edit Material"
                      >
                        <Edit2 className="size-3.5" />
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletingItem(item)}
                        className="size-8 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                        title="Delete Material"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Desktop Viewport (>= 1024px) Table ── */}
          <div className="hidden lg:block rounded-2xl border bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material / Item</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Current Stock</TableHead>
                  <TableHead>Avg Cost</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => {
                  const isLow = item.currentStock <= item.alertThreshold;
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        {/* Interactive Clickable Target: Opens Edit Material Modal */}
                        <div 
                          onClick={() => handleOpenEditModal(item)}
                          className="cursor-pointer group/mat select-none inline-block"
                          title="Click to edit material item"
                        >
                          <div className="font-semibold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                            <Tag className="size-3.5 text-slate-400 group-hover/mat:text-indigo-600 transition-colors" />
                            <span className="group-hover/mat:text-indigo-600 dark:group-hover/mat:text-indigo-400 group-hover/mat:underline transition-colors">
                              {item.name}
                            </span>
                          </div>
                          {item.description && (
                            <div className="text-[11px] text-slate-400 truncate max-w-[250px]">
                              {item.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-slate-600 dark:text-zinc-300">
                        {item.code || <span className="italic text-slate-400 text-[11px]">N/A</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-semibold">
                          {item.unit}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs font-bold ${isLow ? 'text-rose-600' : 'text-slate-900 dark:text-white'}`}>
                          {item.currentStock.toLocaleString()} {item.unit.toLowerCase()}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          Min threshold: {item.alertThreshold}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs font-medium text-slate-700 dark:text-zinc-300">
                        Rs. {item.unitCostAverage.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">
                        {isLow ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full">
                            <AlertTriangle className="size-3" /> Low Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="size-3" /> Optimal
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                            >
                              <MoreVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 text-xs font-medium">
                            {/* Deduct stock for production cutting */}
                            <DropdownMenuItem
                              onClick={() =>
                                setStockActionModal({
                                  isOpen: true,
                                  material: item,
                                  mode: 'DEDUCT',
                                })
                              }
                              className="gap-2 cursor-pointer text-amber-600 focus:text-amber-700 focus:bg-amber-50 dark:focus:bg-amber-950/30"
                            >
                              <Scissors className="size-3.5 text-amber-600" />
                              Deduct for Production
                            </DropdownMenuItem>

                            {/* Return leftover scrap pieces back to stock */}
                            <DropdownMenuItem
                              onClick={() =>
                                setStockActionModal({
                                  isOpen: true,
                                  material: item,
                                  mode: 'SCRAP_RETURN',
                                })
                              }
                              className="gap-2 cursor-pointer text-emerald-600 focus:text-emerald-700 focus:bg-emerald-50 dark:focus:bg-emerald-950/30"
                            >
                              <CornerDownLeft className="size-3.5 text-emerald-600" />
                              Return Scrap Pieces
                            </DropdownMenuItem>

                            {/* View stock movement history log */}
                            <DropdownMenuItem
                              onClick={() =>
                                setHistoryModal({
                                  isOpen: true,
                                  material: item,
                                })
                              }
                              className="gap-2 cursor-pointer text-indigo-600 focus:text-indigo-700 focus:bg-indigo-50 dark:focus:bg-indigo-950/30"
                            >
                              <History className="size-3.5 text-indigo-600" />
                              Stock Movement Log
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                              onClick={() => handleOpenEditModal(item)}
                              className="gap-2 cursor-pointer text-slate-700 dark:text-zinc-300"
                            >
                              <Edit2 className="size-3.5 text-slate-500" />
                              Edit Item
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeletingItem(item)}
                              className="gap-2 cursor-pointer text-rose-600 focus:text-rose-700 focus:bg-rose-50 dark:focus:bg-rose-950/30"
                            >
                              <Trash2 className="size-3.5 text-rose-600" />
                              Delete Item
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Add / Edit Material Item Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="w-full max-w-lg sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Edit Material Item' : 'Register New Material Item'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleFormSubmit} className="space-y-3.5 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Material Name *</label>
              <Input
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Denim Fabric 12oz, Cotton Thread White"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold">Item Code / SKU</label>
                <div className="relative flex items-center">
                  <Input
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="e.g. RM-0001"
                    className="pr-10 font-mono text-xs uppercase"
                  />
                  {formData.code.trim() ? (
                    // Clear action button when text exists
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setFormData({ ...formData, code: '' })}
                      className="absolute right-1 size-7 text-slate-400 hover:text-rose-500 hover:bg-transparent"
                      title="Clear code"
                    >
                      <X className="size-3.5" />
                    </Button>
                  ) : (
                    // Generate action button when empty - triggers real-time DB code lookup
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={generatingCode}
                      onClick={async () => {
                        const code = await fetchNextItemCodeFromBackend();
                        setFormData((prev) => ({ ...prev, code }));
                      }}
                      className="absolute right-1 size-7 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                      title="Fetch latest code from database"
                    >
                      {generatingCode ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="size-3.5 animate-pulse" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold">Measurement Unit</label>
                {/* Searchable Combobox adapting dynamically to light/dark themes */}
                <SearchableSelect
                  value={formData.unit}
                  onValueChange={(val) => setFormData({ ...formData, unit: val as RawMaterialUnit })}
                  options={UNITS.map((u) => ({
                    value: u,
                    label: u,
                  }))}
                  placeholder="Select Unit"
                  searchPlaceholder="Search unit (e.g. METERS)..."
                  dark={dark}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold">Alert Threshold (Minimum Stock)</label>
              <Input
                type="number"
                min="0"
                value={formData.alertThreshold}
                onChange={(e) => setFormData({ ...formData, alertThreshold: e.target.value ? Number(e.target.value) : '' })}
                placeholder="10"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold">Description / Notes</label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Material specifications, GSM, color codes..."
              />
            </div>

            <DialogFooter className="sticky bottom-0 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm pt-3 pb-1 border-t border-slate-100 dark:border-zinc-800 mt-4 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="size-3.5 animate-spin mr-1" />}
                {editingItem ? 'Update Material' : 'Save Material'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={Boolean(deletingItem)} onOpenChange={(open) => !open && setDeletingItem(null)}>
        <AlertDialogContent className="w-full max-w-lg sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{' '}
              <strong className="text-slate-900 dark:text-white">"{deletingItem?.name}"</strong>. 
              Materials linked to previous purchase orders cannot be deleted to safeguard historical stock calculations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sticky bottom-0 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm pt-3 pb-1 border-t border-slate-100 dark:border-zinc-800 mt-2">
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isDeleting ? 'Deleting...' : 'Delete Material'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
   {/* ⭐ Production Material Deduction & Scrap Return Modal */}
      <MaterialStockActionModal
        isOpen={stockActionModal.isOpen}
        onClose={() => setStockActionModal((prev) => ({ ...prev, isOpen: false }))}
        material={stockActionModal.material}
        mode={stockActionModal.mode}
        onSuccess={() => fetchItems()}
      />

      {/* ⭐ Stock Movement & Audit History Ledger Modal with Instant Live Sync */}
      <MaterialMovementHistoryModal
        isOpen={historyModal.isOpen}
        onClose={() => setHistoryModal((prev) => ({ ...prev, isOpen: false }))}
        material={historyModal.material}
        onSuccess={async () => {
          // 1. Fetch and update full materials catalog in real-time
          await fetchItems();

          // 2. Also keep the active modal's material state synchronized
          if (historyModal.material) {
            try {
              const freshItem = await get<RawMaterialItem>(`/raw-material-items/${historyModal.material.id}`);
              if (freshItem) {
                setHistoryModal((prev) => ({
                  ...prev,
                  material: freshItem,
                }));
              }
            } catch {
              // Ignore background sync errors
            }
          }
        }}
      />
    </div>
  );
};

export default RawMaterialItemsPage;