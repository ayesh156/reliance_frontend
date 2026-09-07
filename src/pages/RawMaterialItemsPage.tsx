import React, { useState, useEffect, useMemo } from 'react';
// Shadcn UI standard component primitives
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
// Shadcn searchable combobox component
import { SearchableSelect } from '../components/ui/SearchableSelect';
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
} from 'lucide-react';

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
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [items, setItems] = useState<RawMaterialItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedUnit, setSelectedUnit] = useState<string>('ALL');
  const [lowStockFilter, setLowStockFilter] = useState<boolean>(false);

  // Modal and form states
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<RawMaterialItem | null>(null);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Deletion alert states
  const [deletingItem, setDeletingItem] = useState<RawMaterialItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  /**
   * Load raw material items from backend API with debounced filters
   */
  const fetchItems = async (query = '', unit = 'ALL', lowStock = false) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (query.trim()) params.append('search', query.trim());
      if (unit !== 'ALL') params.append('unit', unit);
      if (lowStock) params.append('lowStockOnly', 'true');

      const queryString = params.toString() ? `?${params.toString()}` : '';
      const data = await get<RawMaterialItem[]>(`/raw-material-items${queryString}`);
      setItems(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load raw material items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchItems(searchQuery, selectedUnit, lowStockFilter);
    }, 300);

    return () => clearTimeout(handler);
  }, [searchQuery, selectedUnit, lowStockFilter]);

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

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 size-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search material by name, item code, or description..."
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

        {/* Low Stock Toggle Pill matching CustomersPage filter design */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setLowStockFilter(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                !lowStockFilter
                  ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              All Stock
            </button>
            <button
              type="button"
              onClick={() => setLowStockFilter(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                lowStockFilter
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-amber-600'
              }`}
            >
              Low Stock Only
            </button>
          </div>
        </div>
      </div>

      {/* Materials Table */}
      <div className="rounded-2xl border bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 overflow-hidden">
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
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <Loader2 className="size-6 animate-spin mx-auto text-indigo-500" />
                  <span className="text-xs text-slate-400 mt-2 block">Loading materials...</span>
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-slate-400 text-xs">
                  No raw material items found matching criteria.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => {
                const isLow = item.currentStock <= item.alertThreshold;
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-semibold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                        <Tag className="size-3.5 text-slate-400" />
                        <span>{item.name}</span>
                      </div>
                      {item.description && (
                        <div className="text-[11px] text-slate-400 truncate max-w-[250px]">
                          {item.description}
                        </div>
                      )}
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
                        <DropdownMenuContent align="end" className="w-40 text-xs font-medium">
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
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add / Edit Material Item Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Edit Material Item' : 'Register New Material Item'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleFormSubmit} className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Material Name *</label>
              <Input
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Denim Fabric 12oz, Cotton Thread White"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
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

            <DialogFooter className="pt-2">
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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{' '}
              <strong className="text-slate-900 dark:text-white">"{deletingItem?.name}"</strong>. 
              Materials linked to previous purchase orders cannot be deleted to safeguard historical stock calculations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
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
    </div>
  );
};

export default RawMaterialItemsPage;