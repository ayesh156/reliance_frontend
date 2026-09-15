import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { SearchableSelect } from '../components/ui/SearchableSelect';
import { MaterialCombobox } from '../components/materials/MaterialCombobox';
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
} from '../components/ui/dropdown-menu';
import { get, post, del } from '../lib/api';
import { toast } from 'react-toastify';
import {
  ShoppingCart,
  Plus,
  Search,
  Trash2,
  Calendar,
  Building2,
  Receipt,
  Eye,
  Loader2,
  X,
  MoreVertical,
  PlusCircle,
  FileText,
  Sparkles,
  CreditCard,
  CircleAlert,
  MessageSquare,
} from 'lucide-react';
import { openWhatsAppChat, generateSupplierStockInWhatsAppMessage } from '../lib/whatsapp';

interface RawMaterialShop {
  id: number;
  name: string;
}

interface RawMaterialItem {
  id: number;
  name: string;
  code: string | null;
  unit: string;
  currentStock: number;
  unitCostAverage: number;
}

interface PurchaseLineItem {
  rawMaterialItemId: number | '';
  quantity: number | '';
  pricePerUnit: number | '';
  batchNumber?: string;
}

interface PurchaseRecord {
  id: number;
  invoiceNumber: string | null;
  totalAmount: number;
  paidAmount: number;
  paymentMethod: string;
  paymentStatus: 'PAID' | 'PARTIAL' | 'DUE';
  purchaseDate: string;
  notes: string | null;
  shop: {
    id: number;
    name: string;
    phone: string | null;
    contactPerson: string | null;
  };
  items: {
    id: number;
    quantity: number;
    pricePerUnit: number;
    rowTotal: number;
    batchNumber: string | null;
    rawMaterialItem: {
      id: number;
      name: string;
      code: string | null;
      unit: string;
    };
  }[];
}

const PAYMENT_METHODS = ['CASH', 'CREDIT', 'CHEQUE', 'BANK_TRANSFER'];

export const BuyRawMaterialsPage: React.FC = () => {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const navigate = useNavigate();

  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [shops, setShops] = useState<RawMaterialShop[]>([]);
  const [materialItems, setMaterialItems] = useState<RawMaterialItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [selectedShopId, setSelectedShopId] = useState<number | ''>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [purchaseDate, setPurchaseDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [paidAmount, setPaidAmount] = useState<number | ''>('');
  const [notes, setNotes] = useState<string>('');
  const [lineItems, setLineItems] = useState<PurchaseLineItem[]>([
    { rawMaterialItemId: '', quantity: '', pricePerUnit: '', batchNumber: '' },
  ]);

  // Detail Modal & Delete Alert States
  const [viewingPurchase, setViewingPurchase] = useState<PurchaseRecord | null>(null);
  const [deletingPurchase, setDeletingPurchase] = useState<PurchaseRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  /**
   * Fetch purchase history
   */
  const fetchPurchases = async (query = '') => {
    try {
      setLoading(true);
      const url = query ? `/buy-raw-materials?search=${encodeURIComponent(query)}` : '/buy-raw-materials';
      const data = await get<PurchaseRecord[]>(url);
      setPurchases(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load purchase records');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch dropdown prerequisites (Shops and Material Items)
   */
  const loadPrerequisites = async () => {
    try {
      const [shopsData, itemsData] = await Promise.all([
        get<RawMaterialShop[]>('/raw-material-shops'),
        get<RawMaterialItem[]>('/raw-material-items'),
      ]);
      setShops(shopsData || []);
      setMaterialItems(itemsData || []);
    } catch (err: any) {
      toast.error('Failed to load suppliers or materials catalogue');
    }
  };

  useEffect(() => {
    loadPrerequisites();
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchPurchases(searchQuery);
    }, 300);

    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Add line item row
  const handleAddLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      { rawMaterialItemId: '', quantity: '', pricePerUnit: '', batchNumber: '' },
    ]);
  };

  // Remove line item row
  const handleRemoveLineItem = (index: number) => {
    if (lineItems.length === 1) {
      toast.warn('At least one item is required in the purchase order');
      return;
    }
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Update line item property
  const handleLineItemChange = (index: number, field: keyof PurchaseLineItem, value: any) => {
    setLineItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };

      // Pre-fill last known average unit cost when material item is selected
      if (field === 'rawMaterialItemId') {
        const found = materialItems.find((m) => m.id === Number(value));
        if (found && !updated[index].pricePerUnit && found.unitCostAverage > 0) {
          updated[index].pricePerUnit = found.unitCostAverage;
        }
      }
      return updated;
    });
  };

  // Calculations
  const calculatedTotalAmount = useMemo(() => {
    return lineItems.reduce((sum, item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.pricePerUnit) || 0;
      return sum + qty * price;
    }, 0);
  }, [lineItems]);

  const dueDebtAmount = useMemo(() => {
    const paid = Number(paidAmount) || 0;
    return Math.max(0, calculatedTotalAmount - paid);
  }, [calculatedTotalAmount, paidAmount]);

  // Overall Purchase Summary Calculations
  const totalPurchaseOrders = purchases.length;
  const totalPurchasedValue = useMemo(() => {
    return purchases.reduce((sum, p) => sum + (Number(p.totalAmount) || 0), 0);
  }, [purchases]);
  const totalOutstandingDue = useMemo(() => {
    return purchases.reduce((sum, p) => {
      const due = (Number(p.totalAmount) || 0) - (Number(p.paidAmount) || 0);
      return sum + Math.max(0, due);
    }, 0);
  }, [purchases]);

  const [generatingInvoice, setGeneratingInvoice] = useState<boolean>(false);

  /**
   * Fetch latest sequential invoice number from DB
   */
  const fetchNextInvoiceFromBackend = async (): Promise<string> => {
    try {
      setGeneratingInvoice(true);
      const res = await get<{ invoiceNumber: string }>('/buy-raw-materials/next-invoice');
      return res?.invoiceNumber || 'PO-0001';
    } catch {
      return 'PO-0001';
    } finally {
      setGeneratingInvoice(false);
    }
  };

  const handleOpenAddModal = () => {
    setSelectedShopId('');
    setInvoiceNumber(''); // ⭐ Kept empty by default for manual entry or on-demand generation
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setPaymentMethod('CASH');
    setPaidAmount('');
    setNotes('');
    setLineItems([{ rawMaterialItemId: '', quantity: '', pricePerUnit: '', batchNumber: '' }]);
    setIsModalOpen(true);
  };

  /**
   * Submit purchase form
   */
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShopId) {
      toast.error('Please select a supplier shop');
      return;
    }

    const invalidRow = lineItems.find(
      (item) => !item.rawMaterialItemId || Number(item.quantity) <= 0 || Number(item.pricePerUnit) < 0
    );
    if (invalidRow) {
      toast.error('Please fill all item rows with valid material, quantity, and unit price');
      return;
    }

    try {
      setIsSubmitting(true);
      await post('/buy-raw-materials', {
        rawMaterialShopId: Number(selectedShopId),
        invoiceNumber: invoiceNumber.trim() || undefined,
        purchaseDate,
        paymentMethod,
        paidAmount: paidAmount === '' ? calculatedTotalAmount : Number(paidAmount),
        notes: notes.trim() || undefined,
        items: lineItems.map((item) => ({
          rawMaterialItemId: Number(item.rawMaterialItemId),
          quantity: Number(item.quantity),
          pricePerUnit: Number(item.pricePerUnit),
          batchNumber: item.batchNumber?.trim() || undefined,
        })),
      });

      toast.success('Raw materials received and stock updated successfully');
      setIsModalOpen(false);
      fetchPurchases();
    } catch (err: any) {
      toast.error(err.message || 'Failed to process purchase');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Confirm deletion and rollback
   */
  const handleDeleteConfirm = async () => {
    if (!deletingPurchase) return;

    try {
      setIsDeleting(true);
      await del(`/buy-raw-materials/${deletingPurchase.id}`);
      setPurchases((prev) => prev.filter((p) => p.id !== deletingPurchase.id));
      toast.success('Purchase cancelled and stock rolled back');
      setDeletingPurchase(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel purchase');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 w-full pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <ShoppingCart className="size-6 text-indigo-600 dark:text-indigo-400" />
            Raw Material Purchases (Stock-In)
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Receive materials from suppliers, increment stock levels, and track payables.
          </p>
        </div>
        <Button onClick={() => navigate('/system/buy-raw-materials/new')} className="gap-2 h-9">
          <Plus className="size-4" /> New Stock Purchase
        </Button>
      </div>

      {/* Metrics Row - CustomersPage matching heights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
        {/* Total Purchase Orders */}
        <div className="rounded-2xl border p-4 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 shadow-xs flex justify-between items-center">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Total Purchase Orders</span>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{totalPurchaseOrders}</h3>
          </div>
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <Receipt className="size-5" />
          </div>
        </div>

        {/* Total Purchases Cost */}
        <div className="rounded-2xl border p-4 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 shadow-xs flex justify-between items-center">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Total Stock Value Purchased</span>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1 font-mono">
              Rs. {totalPurchasedValue.toLocaleString()}
            </h3>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <CreditCard className="size-5" />
          </div>
        </div>

        {/* Total Outstanding Payables */}
        <div className="rounded-2xl border p-4 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 shadow-xs flex justify-between items-center">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Supplier Payables (Due)</span>
            <h3 className={`text-2xl font-bold mt-1 font-mono ${totalOutstandingDue > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              Rs. {totalOutstandingDue.toLocaleString()}
            </h3>
          </div>
          <div className={`p-3 rounded-xl ${totalOutstandingDue > 0 ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600' : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600'}`}>
            <CircleAlert className="size-5" />
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative flex-1">
        <Search className="absolute left-3.5 top-3 size-4 text-slate-400" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by supplier name or invoice number..."
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

      {/* Purchases Table */}
      <div className="rounded-2xl border bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice / Date</TableHead>
              <TableHead>Supplier Shop</TableHead>
              <TableHead className="text-center">Items Received</TableHead>
              <TableHead>Total Bill</TableHead>
              <TableHead>Paid / Due</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <Loader2 className="size-6 animate-spin mx-auto text-indigo-500" />
                  <span className="text-xs text-slate-400 mt-2 block">Loading purchase records...</span>
                </TableCell>
              </TableRow>
            ) : purchases.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-slate-400 text-xs">
                  No stock purchase records found.
                </TableCell>
              </TableRow>
            ) : (
              purchases.map((purchase) => {
                const due = purchase.totalAmount - purchase.paidAmount;
                return (
                  <TableRow key={purchase.id}>
                    {/* Interactive Clickable Invoice / PO No: Opens Items Breakdown Modal */}
                    <TableCell 
                      onClick={() => setViewingPurchase(purchase)}
                      className="cursor-pointer group/po select-none"
                      title="Click to view purchase order breakdown"
                    >
                      <div className="font-semibold text-xs text-slate-900 dark:text-white flex items-center gap-1.5 group-hover/po:text-indigo-600 dark:group-hover/po:text-indigo-400 transition-colors">
                        <Receipt className="size-3.5 text-slate-400 group-hover/po:text-indigo-600" />
                        <span className="group-hover/po:underline">{purchase.invoiceNumber || `PO-${purchase.id}`}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 font-mono">
                        <Calendar className="size-3" />
                        {new Date(purchase.purchaseDate).toLocaleDateString()}
                      </div>
                    </TableCell>

                    {/* Interactive Clickable Supplier Shop: Opens Items Breakdown Modal */}
                    <TableCell 
                      onClick={() => setViewingPurchase(purchase)}
                      className="cursor-pointer group/po-shop select-none"
                      title="Click to view purchase order breakdown"
                    >
                      <div className="font-semibold text-xs text-slate-900 dark:text-white flex items-center gap-1.5 group-hover/po-shop:text-indigo-600 dark:group-hover/po-shop:text-indigo-400 transition-colors">
                        <Building2 className="size-3.5 text-slate-400 group-hover/po-shop:text-indigo-600" />
                        <span className="group-hover/po-shop:underline">{purchase.shop.name}</span>
                      </div>
                      {purchase.shop.phone && (
                        <span className="text-[11px] text-slate-400 font-mono block">
                          {purchase.shop.phone}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-[10px] font-semibold">
                        {purchase.items.length} line item(s)
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-bold text-slate-900 dark:text-white">
                      Rs. {purchase.totalAmount.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs font-semibold text-emerald-600">
                        Paid: Rs. {purchase.paidAmount.toLocaleString()}
                      </div>
                      {due > 0 && (
                        <div className="text-[11px] font-bold text-rose-600">
                          Due: Rs. {due.toLocaleString()}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-bold ${
                          purchase.paymentStatus === 'PAID'
                            ? 'border-emerald-500/30 text-emerald-600 bg-emerald-500/10'
                            : purchase.paymentStatus === 'PARTIAL'
                            ? 'border-amber-500/30 text-amber-600 bg-amber-500/10'
                            : 'border-rose-500/30 text-rose-600 bg-rose-500/10'
                        }`}
                      >
                        {purchase.paymentStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8 text-slate-500">
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44 text-xs font-medium">
                          <DropdownMenuItem
                            onClick={() => setViewingPurchase(purchase)}
                            className="gap-2 cursor-pointer text-slate-700 dark:text-zinc-300"
                          >
                            <Eye className="size-3.5 text-slate-500" />
                            View Items
                          </DropdownMenuItem>

                          {/* Direct WhatsApp Purchase Slip Action */}
                          <DropdownMenuItem
                            onClick={() => {
                              if (!purchase.shop?.phone) {
                                toast.error('This supplier shop does not have a saved phone number');
                                return;
                              }
                              const waMsg = generateSupplierStockInWhatsAppMessage(purchase);
                              openWhatsAppChat(purchase.shop.phone, waMsg);
                            }}
                            className="gap-2 cursor-pointer text-emerald-600 focus:text-emerald-700"
                          >
                            <MessageSquare className="size-3.5 text-emerald-600" />
                            WhatsApp Purchase Slip
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() => setDeletingPurchase(purchase)}
                            className="gap-2 cursor-pointer text-rose-600 focus:text-rose-700 focus:bg-rose-50 dark:focus:bg-rose-950/30"
                          >
                            <Trash2 className="size-3.5 text-rose-600" />
                            Cancel Order
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

      {/* New Stock Purchase Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="size-5 text-indigo-600" /> Record Raw Material Stock-In
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleFormSubmit} className="space-y-4 py-2">
            {/* Header Information */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold">Supplier Shop *</label>
                <SearchableSelect
                  value={String(selectedShopId)}
                  onValueChange={(val) => setSelectedShopId(Number(val))}
                  options={shops.map((s) => ({ value: String(s.id), label: s.name }))}
                  placeholder="Select Supplier Shop"
                  searchPlaceholder="Search shop..."
                  dark={dark}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">Supplier Invoice No</label>
                <div className="relative flex items-center">
                  <Input
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="Enter Invoice No or click to generate"
                    className="pr-10 font-mono text-xs uppercase"
                  />
                  {invoiceNumber.trim() ? (
                    // Close/Clear action button when text exists
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setInvoiceNumber('')}
                      className="absolute right-1 size-7 text-slate-400 hover:text-rose-500 hover:bg-transparent"
                      title="Clear invoice number"
                    >
                      <X className="size-3.5" />
                    </Button>
                  ) : (
                    // Generate action button when empty
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={generatingInvoice}
                      onClick={async () => {
                        const inv = await fetchNextInvoiceFromBackend();
                        setInvoiceNumber(inv);
                      }}
                      className="absolute right-1 size-7 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                      title="Auto generate next PO number"
                    >
                      {generatingInvoice ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="size-3.5 animate-pulse" />
                      )}
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">Purchase Date</label>
                <Input
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                />
              </div>
            </div>

            {/* Line Items Section elevated with relative z-index */}
            <div className="space-y-2 pt-2 relative z-20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                  Materials Received
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddLineItem}
                  className="gap-1.5 h-8 text-xs font-semibold"
                >
                  <PlusCircle className="size-3.5 text-indigo-600" /> Add Material Row
                </Button>
              </div>

              {/* Set overflow-visible and relative z-index so that SearchableSelect dropdown floats over bottom fields */}
              <div className="rounded-xl border border-slate-200 dark:border-zinc-800 overflow-visible relative z-20">
                <Table className="overflow-visible">
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-zinc-900/50">
                      <TableHead className="w-[38%]">Material Item *</TableHead>
                      <TableHead className="w-[18%]">Quantity *</TableHead>
                      <TableHead className="w-[20%]">Cost / Unit (Rs) *</TableHead>
                      <TableHead className="w-[16%] text-right">Row Total</TableHead>
                      <TableHead className="w-[8%]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineItems.map((item, index) => {
                      const selectedItemMeta = materialItems.find((m) => m.id === Number(item.rawMaterialItemId));
                      const rowTotal = (Number(item.quantity) || 0) * (Number(item.pricePerUnit) || 0);

                      return (
                        <TableRow key={index}>
                          <TableCell>
                            {/* High-Performance Portal Combobox that floats over entire Dialog */}
                            <MaterialCombobox
                              value={item.rawMaterialItemId}
                              onChange={(id) => handleLineItemChange(index, 'rawMaterialItemId', id)}
                              options={materialItems.map((m) => ({
                                id: m.id,
                                name: m.name,
                                code: m.code,
                                unit: m.unit,
                                currentStock: m.currentStock,
                              }))}
                              placeholder="Select Material..."
                            />
                            {selectedItemMeta && (
                              <span className="text-[10px] text-slate-400 mt-1 block">
                                Current stock: {selectedItemMeta.currentStock} {selectedItemMeta.unit.toLowerCase()}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0.01"
                              step="any"
                              required
                              value={item.quantity}
                              onChange={(e) => handleLineItemChange(index, 'quantity', e.target.value)}
                              placeholder="Qty"
                              className="font-mono text-xs"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              step="any"
                              required
                              value={item.pricePerUnit}
                              onChange={(e) => handleLineItemChange(index, 'pricePerUnit', e.target.value)}
                              placeholder="Unit Price"
                              className="font-mono text-xs"
                            />
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-xs text-slate-900 dark:text-white">
                            Rs. {rowTotal.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveLineItem(index)}
                              className="size-7 text-slate-400 hover:text-rose-500"
                            >
                              <X className="size-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Financial Summary & Payment */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Payment Method</label>
                  <SearchableSelect
                    value={paymentMethod}
                    onValueChange={setPaymentMethod}
                    options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))}
                    placeholder="Select Payment Method"
                    dark={dark}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold">Notes / Purchase Details</label>
                  <Input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Received via Delivery Courier, Roll Nos #102-105"
                  />
                </div>
              </div>

              <div className="rounded-xl border p-3.5 bg-slate-50 dark:bg-zinc-950 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Purchase Amount:</span>
                  <span className="font-bold text-slate-900 dark:text-white font-mono">
                    Rs. {calculatedTotalAmount.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <label className="font-semibold text-slate-700 dark:text-zinc-300">Paid Amount (Rs):</label>
                  <Input
                    type="number"
                    min="0"
                    max={calculatedTotalAmount}
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value ? Number(e.target.value) : '')}
                    placeholder={String(calculatedTotalAmount)}
                    className="w-32 h-8 text-right font-mono font-bold text-xs"
                  />
                </div>

                <div className="flex justify-between border-t pt-2">
                  <span className="font-bold text-slate-700 dark:text-zinc-300">Outstanding Debt:</span>
                  <span className={`font-mono font-bold ${dueDebtAmount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    Rs. {dueDebtAmount.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="size-3.5 animate-spin mr-1" />}
                Confirm Stock-In
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Items Breakdown Modal */}
      <Dialog open={Boolean(viewingPurchase)} onOpenChange={(open) => !open && setViewingPurchase(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <FileText className="size-4 text-indigo-600" />
              Purchase Order Breakdown — {viewingPurchase?.invoiceNumber || `PO-${viewingPurchase?.id}`}
            </DialogTitle>
          </DialogHeader>

          {viewingPurchase && (
            <div className="space-y-4 py-2 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-50 dark:bg-zinc-950 border">
                <div>
                  <span className="text-slate-400 block text-[10px]">Supplier:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{viewingPurchase.shop.name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Date:</span>
                  <span className="font-mono">{new Date(viewingPurchase.purchaseDate).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="rounded-xl border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-zinc-900/50">
                      <TableHead>Material</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewingPurchase.items.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell className="font-semibold text-slate-900 dark:text-white">
                          {i.rawMaterialItem.name}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {i.quantity} {i.rawMaterialItem.unit.toLowerCase()}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          Rs. {i.pricePerUnit.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold">
                          Rs. {i.rowTotal.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-between items-center px-1 font-semibold">
                <span>Total Amount: Rs. {viewingPurchase.totalAmount.toLocaleString()}</span>
                <span className="text-emerald-600">Paid: Rs. {viewingPurchase.paidAmount.toLocaleString()}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel/Rollback Confirmation Alert */}
      <AlertDialog open={Boolean(deletingPurchase)} onOpenChange={(open) => !open && setDeletingPurchase(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel and rollback this purchase order?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the purchase record, decrement the material quantities from inventory stock, and reverse any outstanding supplier debt balance.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Keep Order</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isDeleting ? 'Reversing...' : 'Cancel & Revert Stock'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default BuyRawMaterialsPage;