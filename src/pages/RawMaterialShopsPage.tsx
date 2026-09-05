import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
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
import { isValidSriLankanPhone } from '../lib/validators';
import {
  Building2,
  Plus,
  Search,
  Phone,
  MapPin,
  User,
  Edit2,
  Trash2,
  ReceiptText,
  Wallet,
  Loader2,
  X,
  MoreVertical,
} from 'lucide-react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface RawMaterialShop {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  contactPerson: string | null;
  creditBalance: number;
  _count?: {
    purchases: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface FormData {
  name: string;
  phone: string;
  contactPerson: string;
  address: string;
}

const INITIAL_FORM_DATA: FormData = {
  name: '',
  phone: '',
  contactPerson: '',
  address: '',
};

/**
 * Raw Material Suppliers Management Page
 * Handles Supplier directory, real-time search, credit balance tracking, and CRUD modals.
 */
export const RawMaterialShopsPage: React.FC = () => {
  const [shops, setShops] = useState<RawMaterialShop[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Dialog and form states
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingShop, setEditingShop] = useState<RawMaterialShop | null>(null);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Deletion dialog states
  const [deletingShop, setDeletingShop] = useState<RawMaterialShop | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // ============================================================================
  // DATA FETCHING & FILTERING
  // ============================================================================

  /**
   * Load suppliers from API with optional search keyword using standard get helper
   */
  const fetchShops = async (query = '') => {
    try {
      setLoading(true);
      const endpoint = query ? `/raw-material-shops?search=${encodeURIComponent(query)}` : '/raw-material-shops';
      const data = await get<RawMaterialShop[]>(endpoint);
      setShops(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load supplier shops');
    } finally {
      setLoading(false);
    }
  };

  // Debounced search trigger (300ms) matching CustomersPage pattern
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchShops(searchQuery);
    }, 300);

    return () => clearTimeout(handler);
  }, [searchQuery]);

  // ============================================================================
  // FORM HANDLERS
  // ============================================================================

  const handleOpenAddModal = () => {
    setEditingShop(null);
    setFormData(INITIAL_FORM_DATA);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (shop: RawMaterialShop) => {
    setEditingShop(shop);
    setFormData({
      name: shop.name || '',
      phone: shop.phone || '',
      contactPerson: shop.contactPerson || '',
      address: shop.address || '',
    });
    setIsModalOpen(true);
  };

  /**
   * Handle create or update supplier shop submission using post and put helpers
   */
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Shop/Supplier name is required');
      return;
    }

    // Phone number ඇතුළත් කර ඇත්නම් ශ්‍රී ලාංකික අංකයක්දැයි පරීක්ෂා කිරීම (07XXXXXXXX, 0XXXXXXXXX හෝ +94)
    if (formData.phone.trim() && !isValidSriLankanPhone(formData.phone.trim())) {
      toast.error('Invalid phone number! Must be a valid 10-digit Sri Lankan number (e.g. 0771234567) or +94 format.');
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingShop) {
        // Update existing shop
        const updated = await put<RawMaterialShop>(`/raw-material-shops/${editingShop.id}`, formData);
        setShops((prev) => prev.map((s) => (s.id === editingShop.id ? { ...s, ...updated } : s)));
        toast.success('Supplier details updated successfully');
      } else {
        // Create new shop
        const created = await post<RawMaterialShop>('/raw-material-shops', formData);
        setShops((prev) => [created, ...prev]);
        toast.success('Supplier shop registered successfully');
      }
      setIsModalOpen(false);
      setFormData(INITIAL_FORM_DATA);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save supplier details');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Delete supplier confirmation handler using del helper
   */
  const handleDeleteConfirm = async () => {
    if (!deletingShop) return;

    try {
      setIsDeleting(true);
      await del(`/raw-material-shops/${deletingShop.id}`);
      setShops((prev) => prev.filter((s) => s.id !== deletingShop.id));
      toast.success('Supplier deleted successfully');
      setDeletingShop(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete supplier');
    } finally {
      setIsDeleting(false);
    }
  };

  // Memoized total payable credit calculation
  const totalPayableDebt = useMemo(() => {
    return shops.reduce((sum, s) => sum + (s.creditBalance || 0), 0);
  }, [shops]);

  return (
    <div className="space-y-6 w-full pb-16">
      {/* Header and Add Action Button styled identically to CustomersPage */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Raw Material Suppliers
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Manage fabric and accessories suppliers, shops, and credit balances.
          </p>
        </div>
        <Button onClick={handleOpenAddModal} className="gap-2 h-9">
          <Plus className="size-4" /> Add Supplier Shop
        </Button>
      </div>

      {/* Metrics Row styled with rounded-2xl borders matching CustomersPage */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl border p-4 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800">
          <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Total Suppliers</span>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{shops.length}</h3>
        </div>
        <div className="rounded-2xl border p-4 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800">
          <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Outstanding Debt (To Pay)</span>
          <h3 className="text-2xl font-bold text-rose-600 mt-1">
            Rs. {totalPayableDebt.toLocaleString()}
          </h3>
        </div>
      </div>

      {/* Full-Width Search Bar with X clear button matching CustomersPage */}
      <div className="relative flex-1">
        <Search className="absolute left-3.5 top-3 size-4 text-slate-400" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search supplier by shop name, contact person, phone number, or address..."
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

      {/* Shadcn Table & DropdownMenu Actions matching CustomersPage */}
      <div className="rounded-2xl border bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Supplier / Shop</TableHead>
              <TableHead>Contact Info</TableHead>
              <TableHead>Address</TableHead>
              <TableHead className="text-center">Purchases</TableHead>
              <TableHead>Credit Balance</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <Loader2 className="size-6 animate-spin mx-auto text-emerald-500" />
                  <span className="text-xs text-slate-400 mt-2 block">Loading supplier records...</span>
                </TableCell>
              </TableRow>
            ) : shops.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-slate-400 text-xs">
                  No suppliers found matching your query.
                </TableCell>
              </TableRow>
            ) : (
              shops.map((shop) => (
                <TableRow key={shop.id}>
                  <TableCell>
                    <div className="font-semibold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                      <Building2 className="size-4 text-slate-400" />
                      <span>{shop.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs space-y-0.5">
                    {shop.contactPerson && (
                      <div className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-300">
                        <User className="size-3 text-slate-400" />
                        <span>{shop.contactPerson}</span>
                      </div>
                    )}
                    {shop.phone ? (
                      <div className="flex items-center gap-1.5 text-slate-500 font-mono text-[11px]">
                        <Phone className="size-3 text-slate-400" />
                        <span>{shop.phone}</span>
                      </div>
                    ) : (
                      <span className="text-slate-400 italic text-[11px]">No phone</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-slate-500 max-w-[200px] truncate">
                    {shop.address ? (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="size-3 text-slate-400 shrink-0" />
                        <span className="truncate">{shop.address}</span>
                      </div>
                    ) : (
                      <span className="italic text-slate-400">No address</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="text-[10px] font-semibold gap-1">
                      <ReceiptText className="size-3" />
                      {shop._count?.purchases || 0}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`text-xs font-bold ${
                        shop.creditBalance > 0 ? 'text-rose-600' : 'text-emerald-600'
                      }`}
                    >
                      {shop.creditBalance > 0
                        ? `Rs. ${Number(shop.creditBalance).toLocaleString()}`
                        : 'Cleared'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {/* Vertical 3-Dots Dropdown Menu (modal={false} prevents layout shifting) */}
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
                          onClick={() => handleOpenEditModal(shop)}
                          className="gap-2 cursor-pointer text-slate-700 dark:text-zinc-300"
                        >
                          <Edit2 className="size-3.5 text-slate-500" />
                          Edit Shop
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setDeletingShop(shop)}
                          className="gap-2 cursor-pointer text-rose-600 focus:text-rose-700 focus:bg-rose-50 dark:focus:bg-rose-950/30"
                        >
                          <Trash2 className="size-3.5 text-rose-600" />
                          Delete Shop
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

      {/* Dialog for Register/Edit Shop using Shadcn Input & Button */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>
              {editingShop ? 'Edit Supplier Shop' : 'Register New Supplier Shop'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleFormSubmit} className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Shop / Supplier Name *</label>
              <Input
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Modern Fabrics or Denim World"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold">Contact Person</label>
                <Input
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  placeholder="e.g. Sunil Perera"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold">Phone Number</label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="0771234567"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold">Shop Address</label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="No. 45, Main Street, Pettah"
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
                {editingShop ? 'Update Supplier' : 'Save Supplier'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={!!deletingShop} onOpenChange={() => setDeletingShop(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this supplier?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deletingShop?.name}</strong>. If there are any purchase history records linked to this shop, deletion will be blocked to maintain data integrity.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isDeleting ? 'Deleting...' : 'Delete Supplier'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default RawMaterialShopsPage;