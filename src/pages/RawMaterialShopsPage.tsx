import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { isValidSriLankanPhone } from '../utils/validators';
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
  MessageSquare, // ⭐ WhatsApp Icon
  CreditCard,    // ⭐ Added for Pay Due action
} from 'lucide-react';
import { openWhatsAppChat, generateSupplierCreditSummaryWhatsAppMessage } from '../utils/whatsapp';

// ⭐ Import Supplier Due Settlement Modal
import { SupplierDueSettlementModal } from '../components/materials/SupplierDueSettlementModal';

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
  const navigate = useNavigate();
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

  // ⭐ Supplier Due Settlement Modal state
  const [settlementShop, setSettlementShop] = useState<RawMaterialShop | null>(null);

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

      {/* Metrics Row - Full Width Half Layout matching Customers Page Size */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
        <div className="rounded-2xl border p-4 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 shadow-xs flex justify-between items-center">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Total Suppliers</span>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{shops.length}</h3>
          </div>
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <Building2 className="size-5" />
          </div>
        </div>

        <div className="rounded-2xl border p-4 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 shadow-xs flex justify-between items-center">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Outstanding Debt (To Pay)</span>
            <h3 className={`text-2xl font-bold mt-1 font-mono ${totalPayableDebt > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              Rs. {totalPayableDebt.toLocaleString()}
            </h3>
          </div>
          <div className={`p-3 rounded-xl ${totalPayableDebt > 0 ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600' : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600'}`}>
            <ReceiptText className="size-5" />
          </div>
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

      {loading ? (
        <div className="rounded-2xl border bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 p-12 text-center">
          <Loader2 className="size-6 animate-spin mx-auto text-emerald-500" />
          <span className="text-xs text-slate-400 mt-2 block">Loading supplier records...</span>
        </div>
      ) : shops.length === 0 ? (
        <div className="rounded-2xl border bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 p-12 text-center text-slate-400 text-xs">
          No suppliers found matching your query.
        </div>
      ) : (
        <>
          {/* ── Mobile Supplier Cards Viewport (< 1024px) ── */}
          <div className="block lg:hidden space-y-3">
            {shops.map((shop) => (
              <div
                key={shop.id}
                className="rounded-2xl border bg-white dark:bg-zinc-900/70 border-slate-200 dark:border-zinc-800 p-4 shadow-xs space-y-3.5 transition-all"
              >
                {/* Header: Shop Name & Status */}
                <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-zinc-800/80">
                  <div
                    onClick={() => handleOpenEditModal(shop)}
                    className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2 cursor-pointer group/shop select-none"
                    title="Click to edit supplier shop"
                  >
                    <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 shrink-0">
                      <Building2 className="size-4" />
                    </div>
                    <span className="group-hover/shop:text-indigo-600 dark:group-hover/shop:text-indigo-400 group-hover/shop:underline transition-colors">
                      {shop.name}
                    </span>
                  </div>

                  {/* High-contrast Outstanding Credit Balance pill */}
                  <span
                    className={`text-xs font-bold font-mono px-2.5 py-1 rounded-lg shrink-0 border ${
                      shop.creditBalance > 0
                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                    }`}
                  >
                    {shop.creditBalance > 0
                      ? `Rs. ${Number(shop.creditBalance).toLocaleString()}`
                      : 'Cleared'}
                  </span>
                </div>

                {/* Contact, Phone & Physical Address */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {shop.contactPerson && (
                    <div className="flex items-center gap-2 text-slate-700 dark:text-zinc-300">
                      <User className="size-3.5 text-slate-400 shrink-0" />
                      <span className="font-medium truncate">{shop.contactPerson}</span>
                    </div>
                  )}

                  {shop.phone ? (
                    <a
                      href={`tel:${shop.phone}`}
                      className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-mono text-[11px] hover:underline"
                    >
                      <Phone className="size-3.5 text-slate-400 shrink-0" />
                      <span>{shop.phone}</span>
                    </a>
                  ) : (
                    <div className="flex items-center gap-2 text-slate-400 italic text-[11px]">
                      <Phone className="size-3.5 text-slate-400 shrink-0" />
                      <span>No phone</span>
                    </div>
                  )}

                  <div className="sm:col-span-2 text-slate-500 dark:text-zinc-400">
                    {shop.address ? (
                      <div className="flex items-start gap-2">
                        <MapPin className="size-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="break-words">{shop.address}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 italic text-slate-400">
                        <MapPin className="size-3.5 text-slate-400 shrink-0" />
                        <span>No address specified</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800/80">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/60 dark:border-zinc-700/60">
                    <ReceiptText className="size-4 text-indigo-500 shrink-0" />
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-zinc-400 block font-semibold">Total Purchases</span>
                      <span className="font-mono text-xs font-bold text-slate-800 dark:text-zinc-200">
                        {shop._count?.purchases || 0}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/60 dark:border-zinc-700/60">
                    <Wallet className={`size-4 shrink-0 ${shop.creditBalance > 0 ? 'text-rose-500' : 'text-emerald-500'}`} />
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-zinc-400 block font-semibold">Credit Status</span>
                      <span className={`font-mono text-xs font-bold ${shop.creditBalance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {shop.creditBalance > 0 ? 'Due Pending' : 'Cleared'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Bar: Touch Targets */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800/80">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/system/buy-raw-materials?search=${encodeURIComponent(shop.name)}`)}
                    className="flex-1 min-w-[120px] h-8 text-xs font-medium gap-1.5 border-indigo-200 dark:border-indigo-900 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                  >
                    <ReceiptText className="size-3.5" /> View Purchases / Ledger
                  </Button>

                  {shop.creditBalance > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setSettlementShop(shop)}
                      className="h-8 text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <CreditCard className="size-3.5" /> Pay Due
                    </Button>
                  )}

                  <div className="flex items-center gap-1 shrink-0 ml-auto">
                    {shop.creditBalance > 0 && shop.phone && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const waMsg = generateSupplierCreditSummaryWhatsAppMessage(shop);
                          openWhatsAppChat(shop.phone!, waMsg);
                        }}
                        className="size-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                        title="Send WhatsApp Credit Notice"
                      >
                        <MessageSquare className="size-3.5" />
                      </Button>
                    )}

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenEditModal(shop)}
                      className="size-8 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                      title="Edit Supplier Shop"
                    >
                      <Edit2 className="size-3.5" />
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeletingShop(shop)}
                      className="size-8 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      title="Delete Supplier Shop"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Desktop Viewport (>= 1024px) Table ── */}
          <div className="hidden lg:block rounded-2xl border bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 overflow-hidden">
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
                {shops.map((shop) => (
                  <TableRow key={shop.id}>
                    <TableCell>
                      {/* Interactive Clickable Target: Opens Edit Supplier Modal */}
                      <div
                        onClick={() => handleOpenEditModal(shop)}
                        className="font-semibold text-xs text-slate-900 dark:text-white flex items-center gap-2 cursor-pointer group/shop select-none"
                        title="Click to edit supplier shop"
                      >
                        <Building2 className="size-4 text-slate-400 group-hover/shop:text-indigo-600 transition-colors" />
                        <span className="group-hover/shop:text-indigo-600 dark:group-hover/shop:text-indigo-400 group-hover/shop:underline transition-colors">
                          {shop.name}
                        </span>
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
                        <DropdownMenuContent align="end" className="w-48 text-xs font-medium">
                          {/* Settle Supplier Outstanding Due */}
                          {shop.creditBalance > 0 && (
                            <DropdownMenuItem
                              onClick={() => setSettlementShop(shop)}
                              className="gap-2 cursor-pointer text-emerald-600 focus:text-emerald-700 focus:bg-emerald-50 dark:focus:bg-emerald-950/30 font-semibold"
                            >
                              <CreditCard className="size-3.5 text-emerald-600" />
                              Pay Due / Settle
                            </DropdownMenuItem>
                          )}

                          {/* View Purchases / Ledger navigation */}
                          <DropdownMenuItem
                            onClick={() => navigate(`/system/buy-raw-materials?search=${encodeURIComponent(shop.name)}`)}
                            className="gap-2 cursor-pointer text-indigo-600 focus:text-indigo-700 font-medium"
                          >
                            <ReceiptText className="size-3.5 text-indigo-600" />
                            View Purchases
                          </DropdownMenuItem>

                          {/* WhatsApp Outstanding Credit Notice */}
                          {shop.creditBalance > 0 && (
                            <>
                              <DropdownMenuItem
                                onClick={() => {
                                  if (!shop.phone) {
                                    toast.error('This supplier does not have a saved phone number');
                                    return;
                                  }
                                  const waMsg = generateSupplierCreditSummaryWhatsAppMessage(shop);
                                  openWhatsAppChat(shop.phone, waMsg);
                                }}
                                className="gap-2 cursor-pointer text-emerald-600 focus:text-emerald-700 font-medium"
                              >
                                <MessageSquare className="size-3.5 text-emerald-600" />
                                WhatsApp Credit Notice
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                            </>
                          )}

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
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Dialog for Register/Edit Shop using Shadcn Input & Button */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="w-full max-w-lg sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>
              {editingShop ? 'Edit Supplier Shop' : 'Register New Supplier Shop'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleFormSubmit} className="space-y-3.5 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Shop / Supplier Name *</label>
              <Input
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Modern Fabrics or Denim World"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                {editingShop ? 'Update Supplier' : 'Save Supplier'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={!!deletingShop} onOpenChange={() => setDeletingShop(null)}>
        <AlertDialogContent className="w-full max-w-lg sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this supplier?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deletingShop?.name}</strong>. If there are any purchase history records linked to this shop, deletion will be blocked to maintain data integrity.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sticky bottom-0 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm pt-3 pb-1 border-t border-slate-100 dark:border-zinc-800 mt-2">
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
      
      {/* ⭐ Supplier Due Settlement Modal */}
      <SupplierDueSettlementModal
        isOpen={Boolean(settlementShop)}
        onClose={() => setSettlementShop(null)}
        shop={settlementShop}
        onSuccess={() => fetchShops(searchQuery)}
      />
    </div>
  );
};

export default RawMaterialShopsPage;