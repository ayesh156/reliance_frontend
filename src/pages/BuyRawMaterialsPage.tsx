import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { SearchableSelect } from '../components/ui/searchable-select';
import { DateTimePicker } from '../components/ui/date-time-picker';
import { MaterialCombobox } from '../components/materials/MaterialCombobox';
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
  Download,
  Wallet,
  Edit2, // ⭐ Edit icon එක එකතු කිරීම
} from 'lucide-react';
import { openWhatsAppChat, generateSupplierStockInWhatsAppMessage } from '../utils/whatsapp';


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

export interface PurchasePaymentHistoryItem {
  id?: string | number;
  amount: number;
  method?: string;
  paymentMethod?: string;
  reference?: string;
  createdAt?: string;
  paymentDate?: string;
  chequeNumber?: string;
  bankName?: string;
}

interface PurchaseRecord {
  id: number;
  invoiceNumber: string | null;
  totalAmount: number;
  paidAmount: number;
  paymentMethod: string;
  paymentStatus: 'PAID' | 'PARTIAL' | 'DUE' | 'PENDING';
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
  paymentHistory?: PurchasePaymentHistoryItem[];
}

const PAYMENT_METHODS = ['CASH', 'CREDIT', 'CHEQUE', 'BANK_TRANSFER'];

export const BuyRawMaterialsPage: React.FC = () => {
  const { resolvedTheme } = useTheme();
  const { isAdmin } = useAuth();
  const dark = resolvedTheme === 'dark';
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [shops, setShops] = useState<RawMaterialShop[]>([]);
  const [materialItems, setMaterialItems] = useState<RawMaterialItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>(() => searchParams.get('search') || '');

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [selectedShopId, setSelectedShopId] = useState<number | ''>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [purchaseDate, setPurchaseDate] = useState<string>(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  });
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [paidAmount, setPaidAmount] = useState<number | ''>('');
  const [notes, setNotes] = useState<string>('');
  const [lineItems, setLineItems] = useState<PurchaseLineItem[]>([
    { rawMaterialItemId: '', quantity: '', pricePerUnit: '', batchNumber: '' },
  ]);

  // Detail Modal & Delete Alert States
  const [viewingPurchase, setViewingPurchase] = useState<PurchaseRecord | null>(null);
  const [historyPurchase, setHistoryPurchase] = useState<PurchaseRecord | null>(null);
  const [deletingPurchase, setDeletingPurchase] = useState<PurchaseRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Helper for current local ISO string
  const getCurrentLocalISOString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // ⭐ Part Payment Settlement State
  const [settlingPurchase, setSettlingPurchase] = useState<PurchaseRecord | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [settleMethod, setSettleMethod] = useState<string>('CASH');
  const [settleDateTime, setSettleDateTime] = useState<string>(getCurrentLocalISOString());
  const [settleReference, setSettleReference] = useState<string>('');
  const [isSettling, setIsSettling] = useState<boolean>(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

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

  /**
   * Download Goods Received Note (GRN) A4 PDF
   */
  const handleDownloadGrnPdf = async (purchase: PurchaseRecord) => {
    try {
      setDownloadingId(purchase.id);
      
      // LocalStorage හි ඇති සියලුම auth keys පරීක්ෂා කිරීම
      const token =
        localStorage.getItem('token') ||
        localStorage.getItem('authToken') ||
        localStorage.getItem('access_token') ||
        localStorage.getItem('auth_token');

      // Base URL එක නිවැරදිව ලබා ගැනීම (Vite env හෝ current origin)
      const baseUrl = import.meta.env.VITE_API_URL || '/api';
      const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      const downloadUrl = `${cleanBase}/buy-raw-materials/${purchase.id}/pdf`;

      const response = await fetch(downloadUrl, {
        method: 'GET',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const contentType = response.headers.get('content-type') || '';

      // යම් හෙයකින් server එකෙන් Error එකක් ආවොත් එය PDF ලෙස save වීම වළක්වා alert එකක් පෙන්වීම
      if (!response.ok || !contentType.includes('application/pdf')) {
        let errorText = 'Failed to generate PDF';
        try {
          const errJson = await response.json();
          errorText = errJson.message || errJson.error || errorText;
        } catch {
          errorText = await response.text();
        }
        throw new Error(`Server returned error: ${errorText.slice(0, 120)}`);
      }

      const blob = await response.blob();

      if (blob.size < 2000) {
        throw new Error('Downloaded file is too small, likely an error response');
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `GRN-${purchase.invoiceNumber || purchase.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('GRN Note (A4 PDF) downloaded successfully');
    } catch (err: any) {
      toast.error(err.message || 'Error downloading GRN PDF');
    } finally {
      setDownloadingId(null);
    }
  };

  /**
   * Submit Part / Full Payment Settlement
   */
  const handleSettlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingPurchase) return;

    const payNum = parseFloat(paymentAmount);
    const dueAmount = settlingPurchase.totalAmount - settlingPurchase.paidAmount;

    if (isNaN(payNum) || payNum <= 0) {
      toast.error('Please enter a valid positive payment amount');
      return;
    }

    if (payNum > dueAmount) {
      toast.error(`Amount cannot exceed the remaining due of Rs. ${dueAmount.toLocaleString()}`);
      return;
    }

    try {
      setIsSettling(true);
      await post('/buy-raw-materials/settle-payment', {
        purchaseId: settlingPurchase.id,
        amount: payNum,
        paymentMethod: settleMethod,
        paymentDate: settleDateTime ? new Date(settleDateTime).toISOString() : new Date().toISOString(),
        reference: settleReference.trim() || undefined,
      });

      toast.success(`Payment of Rs. ${payNum.toLocaleString()} recorded successfully`);
      setSettlingPurchase(null);
      setPaymentAmount('');
      setSettleReference('');
      fetchPurchases(searchQuery);
    } catch (err: any) {
      toast.error(err.message || 'Payment settlement failed');
    } finally {
      setIsSettling(false);
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

      {/* Purchases Table (Desktop Viewport >= 1024px) */}
      <div className="hidden lg:block rounded-2xl border bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 overflow-hidden">
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
                    {/* Interactive Clickable Invoice / PO No: Navigates to Edit Page */}
                    <TableCell className="select-none">
                      <div 
                        onClick={() => navigate(`/system/buy-raw-materials/edit/${purchase.id}`)}
                        className="font-semibold text-xs text-primary cursor-pointer hover:underline flex items-center gap-1.5 w-fit"
                        title="Click to edit purchase order"
                      >
                        <Receipt className="size-3.5 text-primary" />
                        <span>{purchase.invoiceNumber || `PO-${purchase.id}`}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 font-mono">
                        <Calendar className="size-3" />
                        {(() => {
                          const d = new Date(purchase.purchaseDate);
                          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                        })()}
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
                        <DropdownMenuContent align="end" className="w-52 text-xs font-medium">
                          <DropdownMenuItem
                            onClick={() => setViewingPurchase(purchase)}
                            className="gap-2 cursor-pointer text-slate-700 dark:text-zinc-300"
                          >
                            <Eye className="size-3.5 text-slate-500" />
                            View Items
                          </DropdownMenuItem>

                          {/* ⭐ Payment History Ledger Action */}
                          <DropdownMenuItem
                            onClick={() => setHistoryPurchase(purchase)}
                            className="gap-2 cursor-pointer text-indigo-600 focus:text-indigo-700 focus:bg-indigo-50 dark:focus:bg-indigo-950/30"
                          >
                            <Receipt className="size-3.5 text-indigo-600" />
                            Payment History
                          </DropdownMenuItem>

                          {/* ⭐ Edit Purchase Order Action */}
                          <DropdownMenuItem
                            onClick={() => navigate(`/system/buy-raw-materials/edit/${purchase.id}`)}
                            className="gap-2 cursor-pointer text-slate-700 dark:text-zinc-300"
                          >
                            <Edit2 className="size-3.5 text-slate-500" />
                            Edit Purchase Order
                          </DropdownMenuItem>

                          {/* ⭐ Download A4 GRN PDF Note */}
                          <DropdownMenuItem
                            onClick={() => handleDownloadGrnPdf(purchase)}
                            disabled={downloadingId === purchase.id}
                            className="gap-2 cursor-pointer text-indigo-600 focus:text-indigo-700 focus:bg-indigo-50 dark:focus:bg-indigo-950/30"
                          >
                            {downloadingId === purchase.id ? (
                              <Loader2 className="size-3.5 animate-spin text-indigo-600" />
                            ) : (
                              <Download className="size-3.5 text-indigo-600" />
                            )}
                            Download GRN (PDF)
                          </DropdownMenuItem>

                          {/* ⭐ Pay Due Balance (if unpaid) */}
                          {due > 0 && (
                            <DropdownMenuItem
                              onClick={() => {
                                setSettlingPurchase(purchase);
                                setPaymentAmount(String(due));
                                setSettleDateTime(getCurrentLocalISOString());
                                setSettleMethod('CASH');
                                setSettleReference('');
                              }}
                              className="gap-2 cursor-pointer text-amber-600 focus:text-amber-700 focus:bg-amber-50 dark:focus:bg-amber-950/30"
                            >
                              <Wallet className="size-3.5 text-amber-600" />
                              Pay Due Balance
                            </DropdownMenuItem>
                          )}

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

                          {isAdmin && (
                            <DropdownMenuItem
                              onClick={() => setDeletingPurchase(purchase)}
                              className="gap-2 cursor-pointer text-rose-600 focus:text-rose-700 focus:bg-rose-50 dark:focus:bg-rose-950/30"
                            >
                              <Trash2 className="size-3.5 text-rose-600" />
                              Cancel &amp; Rollback
                            </DropdownMenuItem>
                          )}
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

      {/* ── Touch-Friendly Supplier Purchase Card Grid (Mobile & Tablet Viewports < 1024px) ── */}
      <div className="block lg:hidden space-y-3.5">
        {loading ? (
          <div className="rounded-2xl border bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 p-8 text-center">
            <Loader2 className="size-6 animate-spin mx-auto text-indigo-500 mb-2" />
            <span className="text-xs text-slate-400 block font-medium">Loading purchase records...</span>
          </div>
        ) : purchases.length === 0 ? (
          <div className="rounded-2xl border bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 p-8 text-center text-slate-400 text-xs">
            No stock purchase records found.
          </div>
        ) : (
          purchases.map((purchase) => {
            const due = purchase.totalAmount - purchase.paidAmount;
            const formattedDate = (() => {
              const d = new Date(purchase.purchaseDate);
              return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            })();

            // Normalize payment status for badge display (DUE -> PENDING)
            const displayStatus = purchase.paymentStatus === 'DUE' ? 'PENDING' : purchase.paymentStatus;

            return (
              <div
                key={purchase.id}
                className="rounded-2xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 p-4 shadow-xs transition-all space-y-3.5 hover:border-slate-300 dark:hover:border-zinc-700"
              >
                {/* Header: PO Badge (#PO-XXXX), Supplier Name, Purchase Date, and Status Badge */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => navigate(`/system/buy-raw-materials/edit/${purchase.id}`)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-mono font-bold text-xs transition-colors cursor-pointer"
                        title="Edit purchase order"
                      >
                        <Receipt className="size-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <span>{purchase.invoiceNumber || `#PO-${purchase.id}`}</span>
                      </button>

                      {/* Status Badges: PAID, PARTIAL, PENDING */}
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-bold px-2 py-0.5 ${
                          displayStatus === 'PAID'
                            ? 'border-emerald-500/30 text-emerald-600 bg-emerald-500/10'
                            : displayStatus === 'PARTIAL'
                            ? 'border-amber-500/30 text-amber-600 bg-amber-500/10'
                            : 'border-rose-500/30 text-rose-600 bg-rose-500/10'
                        }`}
                      >
                        {displayStatus}
                      </Badge>
                    </div>

                    {/* Supplier Name */}
                    <button
                      type="button"
                      onClick={() => setViewingPurchase(purchase)}
                      className="text-left font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors pt-0.5 truncate cursor-pointer group"
                    >
                      <Building2 className="size-4 text-slate-400 group-hover:text-indigo-600 shrink-0" />
                      <span className="truncate group-hover:underline">{purchase.shop.name}</span>
                    </button>
                    {purchase.shop.phone && (
                      <span className="text-[11px] text-slate-400 font-mono pl-5 block">
                        {purchase.shop.phone}
                      </span>
                    )}
                  </div>

                  {/* Purchase Date */}
                  <div className="flex flex-col items-end shrink-0 text-right">
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-zinc-400 font-mono bg-slate-100 dark:bg-zinc-800/80 px-2 py-0.5 rounded-md">
                      <Calendar className="size-3 text-slate-400" />
                      {formattedDate}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-1">
                      {purchase.items.length} line item(s)
                    </span>
                  </div>
                </div>

                {/* Financial Breakdown Pill Grid (High Contrast Due Debt Pill) */}
                <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-100 dark:border-zinc-800/70 text-center">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Total Bill
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white font-mono block">
                      Rs. {purchase.totalAmount.toLocaleString()}
                    </span>
                  </div>

                  <div className="space-y-0.5 border-x border-slate-200/70 dark:border-zinc-800">
                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                      Paid Amount
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono block">
                      Rs. {purchase.paidAmount.toLocaleString()}
                    </span>
                  </div>

                  <div className={`space-y-0.5 rounded-lg px-1.5 py-0.5 ${
                    due > 0 
                      ? 'bg-rose-100/90 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500/30' 
                      : 'bg-emerald-100/60 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                  }`}>
                    <span className="text-[10px] font-bold uppercase tracking-wider block">
                      Due Debt
                    </span>
                    <span className="text-xs sm:text-sm font-extrabold font-mono block">
                      Rs. {due.toLocaleString()}
                    </span>
                  </div>
                </div>

                {purchase.notes && (
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 italic bg-slate-50/50 dark:bg-zinc-950/30 p-2 rounded-lg border border-slate-100 dark:border-zinc-800/50 line-clamp-2">
                    "{purchase.notes}"
                  </p>
                )}

                {/* ── Touch Action Bar: Payment History, Add Payment, View Items, Admin-only Delete ── */}
                <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-1.5 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* 1. Payment History Button */}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setHistoryPurchase(purchase)}
                      className="h-8 px-2.5 text-xs font-semibold rounded-xl gap-1.5 cursor-pointer text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                    >
                      <Receipt className="size-3.5" />
                      <span>Payment History</span>
                    </Button>

                    {/* 2. Add Payment Button */}
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setSettlingPurchase(purchase);
                        setPaymentAmount(due > 0 ? String(due) : '');
                        setSettleDateTime(getCurrentLocalISOString());
                        setSettleMethod('CASH');
                        setSettleReference('');
                      }}
                      className={`h-8 px-2.5 text-xs font-bold rounded-xl gap-1.5 cursor-pointer shadow-xs ${
                        due > 0
                          ? 'bg-amber-600 hover:bg-amber-700 text-white'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                      title={due > 0 ? 'Settle pending due balance' : 'Record additional payment'}
                    >
                      <Wallet className="size-3.5" />
                      <span>Add Payment</span>
                    </Button>

                    {/* 3. View Items Button */}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setViewingPurchase(purchase)}
                      className="h-8 px-2.5 text-xs font-semibold rounded-xl gap-1.5 cursor-pointer"
                    >
                      <Eye className="size-3.5 text-slate-500" />
                      <span>View Items</span>
                    </Button>
                  </div>

                  <div className="flex items-center gap-1 ml-auto">
                    {/* 4. Admin-only Delete */}
                    {isAdmin && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletingPurchase(purchase)}
                        className="h-8 px-2 text-xs font-semibold rounded-xl gap-1 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                        title="Cancel & Rollback Purchase (Admin Only)"
                      >
                        <Trash2 className="size-3.5" />
                        <span>Delete</span>
                      </Button>
                    )}
                  </div>
                </div>

                {/* Secondary Actions: Quick Edit, Download GRN, WhatsApp */}
                <div className="pt-1.5 border-t border-slate-100/80 dark:border-zinc-800/60 flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400">
                  <button
                    type="button"
                    onClick={() => navigate(`/system/buy-raw-materials/edit/${purchase.id}`)}
                    className="hover:text-indigo-600 flex items-center gap-1 cursor-pointer"
                  >
                    <Edit2 className="size-3" />
                    <span>Edit Order</span>
                  </button>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleDownloadGrnPdf(purchase)}
                      disabled={downloadingId === purchase.id}
                      className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {downloadingId === purchase.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Download className="size-3" />
                      )}
                      <span>GRN PDF</span>
                    </button>

                    {purchase.shop?.phone && (
                      <button
                        type="button"
                        onClick={() => {
                          const waMsg = generateSupplierStockInWhatsAppMessage(purchase);
                          openWhatsAppChat(purchase.shop.phone!, waMsg);
                        }}
                        className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <MessageSquare className="size-3" />
                        <span>WhatsApp</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* New Stock Purchase Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="w-full max-w-lg sm:max-w-2xl lg:max-w-3xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
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
                <label className="text-xs font-semibold">Purchase Date & Time</label>
                <DateTimePicker
                  value={purchaseDate}
                  onChange={setPurchaseDate}
                  className="w-full"
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

              {/* ── Mobile Viewport (< 1024px) Line Items Cards ── */}
              <div className="block lg:hidden space-y-3">
                {lineItems.map((item, index) => {
                  const selectedItemMeta = materialItems.find((m) => m.id === Number(item.rawMaterialItemId));
                  const rowTotal = (Number(item.quantity) || 0) * (Number(item.pricePerUnit) || 0);

                  return (
                    <div
                      key={index}
                      className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 p-3.5 sm:p-4 shadow-xs space-y-3"
                    >
                      {/* Card Header: Item # and Delete button */}
                      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-zinc-800/80">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-400">Item #{index + 1}</span>
                          {selectedItemMeta && (
                            <span className="text-[11px] text-slate-500 font-medium">
                              Stock: <strong className="font-mono text-slate-700 dark:text-zinc-300">{selectedItemMeta.currentStock} {selectedItemMeta.unit}</strong>
                            </span>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveLineItem(index)}
                          disabled={lineItems.length === 1}
                          className="size-8 p-0 text-slate-400 hover:text-rose-500 disabled:opacity-40 cursor-pointer"
                          title="Remove item"
                        >
                          <X className="size-4" />
                        </Button>
                      </div>

                      {/* Material Combobox */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                          Material Item *
                        </label>
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
                      </div>

                      {/* Quantity & Unit Price in 2-Col Grid */}
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                            Quantity ({selectedItemMeta?.unit || 'Units'}) *
                          </label>
                          <Input
                            type="number"
                            min="0.01"
                            step="any"
                            required
                            value={item.quantity}
                            onChange={(e) => handleLineItemChange(index, 'quantity', e.target.value)}
                            placeholder="0.00"
                            className="font-mono text-xs h-9 bg-slate-50/50 dark:bg-zinc-950/50"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                            Cost / Unit (Rs) *
                          </label>
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            required
                            value={item.pricePerUnit}
                            onChange={(e) => handleLineItemChange(index, 'pricePerUnit', e.target.value)}
                            placeholder="0.00"
                            className="font-mono text-xs h-9 bg-slate-50/50 dark:bg-zinc-950/50"
                          />
                        </div>
                      </div>

                      {/* Subtotal calculation pill */}
                      <div className="flex items-center justify-between pt-1 text-xs">
                        <span className="text-slate-500 dark:text-zinc-400 font-semibold">Row Subtotal:</span>
                        <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-900/60">
                          Rs. {rowTotal.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Desktop Viewport (>= 1024px) Table ── */}
              <div className="hidden lg:block rounded-xl border border-slate-200 dark:border-zinc-800 overflow-visible relative z-20">
                <Table className="min-w-[560px]">
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
                        <TableRow key={index} className="align-top">
                          <TableCell className="align-top relative pb-6">
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
                              <span className="text-xs text-muted-foreground mt-1 absolute -bottom-5 left-0 pl-4 block whitespace-nowrap">
                                Current stock: {selectedItemMeta.currentStock} {selectedItemMeta.unit.toLowerCase()}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="align-top pb-6">
                            <Input
                              type="number"
                              min="0.01"
                              step="any"
                              required
                              value={item.quantity}
                              onChange={(e) => handleLineItemChange(index, 'quantity', e.target.value)}
                              placeholder="Qty"
                              className="font-mono text-xs h-9"
                            />
                          </TableCell>
                          <TableCell className="align-top pb-6">
                            <Input
                              type="number"
                              min="0"
                              step="any"
                              required
                              value={item.pricePerUnit}
                              onChange={(e) => handleLineItemChange(index, 'pricePerUnit', e.target.value)}
                              placeholder="Unit Price"
                              className="font-mono text-xs h-9"
                            />
                          </TableCell>
                          <TableCell className="align-top pt-2.5 text-right font-mono font-bold text-xs text-slate-900 dark:text-white pb-6">
                            Rs. {rowTotal.toLocaleString()}
                          </TableCell>
                          <TableCell className="align-top text-right pb-6">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveLineItem(index)}
                              className="size-9 text-slate-400 hover:text-rose-500 cursor-pointer"
                            >
                              <X className="size-4" />
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

            <DialogFooter className="sticky bottom-0 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm pt-3 pb-1 border-t border-slate-100 dark:border-zinc-800 mt-3 flex items-center justify-end gap-2">
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
        <DialogContent className="w-full max-w-lg sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
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
                  <span className="font-mono">
                    {(() => {
                      const d = new Date(viewingPurchase.purchaseDate);
                      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                    })()}
                  </span>
                </div>
              </div>

              <div className="rounded-xl border overflow-x-auto">
                <Table className="min-w-[420px]">
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

              <DialogFooter className="sticky bottom-0 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm pt-3 pb-1 border-t border-slate-100 dark:border-zinc-800 mt-2 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setViewingPurchase(null)}
                >
                  Close
                </Button>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={() => handleDownloadGrnPdf(viewingPurchase)}
                  disabled={downloadingId === viewingPurchase.id}
                  className="gap-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {downloadingId === viewingPurchase.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Download className="size-3.5" />
                  )}
                  Download GRN Note (A4 PDF)
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel/Rollback Confirmation Alert (Admin Only) */}
      {isAdmin && (
        <AlertDialog open={Boolean(deletingPurchase)} onOpenChange={(open) => !open && setDeletingPurchase(null)}>
          <AlertDialogContent className="w-full max-w-lg sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel and rollback this purchase order?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the purchase record, decrement the material quantities from inventory stock, and reverse any outstanding supplier debt balance.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="sticky bottom-0 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm pt-3 pb-1 border-t border-slate-100 dark:border-zinc-800 mt-2">
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
      )}

      {/* ⭐ Partial Payment Settlement Modal with POS Date & Time */}
      <Dialog open={Boolean(settlingPurchase)} onOpenChange={(open) => !open && setSettlingPurchase(null)}>
        <DialogContent className="w-full max-w-lg sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Wallet className="size-5 text-emerald-600" />
              Settle Due for {settlingPurchase?.invoiceNumber || `PO-${settlingPurchase?.id}`}
            </DialogTitle>
          </DialogHeader>

          {settlingPurchase && (
            <form onSubmit={handleSettlePaymentSubmit} className="space-y-3.5 py-1">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950 border text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Supplier:</span>
                  <span className="font-bold text-slate-800 dark:text-zinc-200">{settlingPurchase.shop.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Remaining Due Balance:</span>
                  <span className="font-mono font-bold text-rose-600">
                    Rs. {(settlingPurchase.totalAmount - settlingPurchase.paidAmount).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    Pay Amount (Rs.) *
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    required
                    max={settlingPurchase.totalAmount - settlingPurchase.paidAmount}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    placeholder="0.00"
                    className="h-9 font-mono font-bold text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    Payment Method *
                  </label>
                  <SearchableSelect
                    value={settleMethod}
                    onValueChange={setSettleMethod}
                    options={[
                      { value: 'CASH', label: 'CASH' },
                      { value: 'BANK_TRANSFER', label: 'BANK TRANSFER' },
                      { value: 'CHEQUE', label: 'CHEQUE' },
                    ]}
                    placeholder="Select Method"
                    dark={dark}
                    className="h-9"
                  />
                </div>
              </div>

              {/* POS DateTimePicker */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Payment Date &amp; Timestamp *
                </label>
                <DateTimePicker
                  value={settleDateTime}
                  onChange={setSettleDateTime}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Payment Reference / Cheque No
                </label>
                <Input
                  value={settleReference}
                  onChange={(e) => setSettleReference(e.target.value)}
                  placeholder="e.g. Part payment cash / Cheque #8812"
                  className="h-9 text-xs"
                />
              </div>

              <DialogFooter className="sticky bottom-0 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm pt-3 pb-1 border-t border-slate-100 dark:border-zinc-800 mt-3 flex items-center justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setSettlingPurchase(null)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSettling}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isSettling && <Loader2 className="size-3.5 animate-spin mr-1" />}
                  Confirm Payment
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ⭐ Supplier Purchase Payment History Ledger Modal */}
      <Dialog open={Boolean(historyPurchase)} onOpenChange={(open) => !open && setHistoryPurchase(null)}>
        <DialogContent className="w-full max-w-lg sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
              <Receipt className="size-5 text-indigo-600" />
              Payment History — {historyPurchase?.invoiceNumber || `#PO-${historyPurchase?.id}`}
            </DialogTitle>
          </DialogHeader>

          {historyPurchase && (() => {
            const due = historyPurchase.totalAmount - historyPurchase.paidAmount;
            const historyList = historyPurchase.paymentHistory || [];

            return (
              <div className="space-y-4 py-2">
                {/* Supplier & Date Overview */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Supplier</span>
                    <strong className="text-slate-900 dark:text-white text-sm">{historyPurchase.shop.name}</strong>
                    {historyPurchase.shop.phone && (
                      <span className="text-[11px] text-slate-400 font-mono block">{historyPurchase.shop.phone}</span>
                    )}
                  </div>
                  <div className="sm:text-right">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Purchase Date</span>
                    <span className="font-mono text-slate-700 dark:text-zinc-300">
                      {new Date(historyPurchase.purchaseDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                </div>

                {/* Financial Summary Pill Grid */}
                <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-center text-xs">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Total Bill</span>
                    <span className="text-sm font-bold font-mono text-slate-900 dark:text-white block mt-0.5">
                      Rs. {historyPurchase.totalAmount.toLocaleString()}
                    </span>
                  </div>
                  <div className="border-x border-slate-200 dark:border-zinc-800">
                    <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider block">Total Paid</span>
                    <span className="text-sm font-bold font-mono text-emerald-600 block mt-0.5">
                      Rs. {historyPurchase.paidAmount.toLocaleString()}
                    </span>
                  </div>
                  <div className={due > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                    <span className="text-[10px] font-semibold uppercase tracking-wider block">Remaining Due</span>
                    <span className="text-sm font-extrabold font-mono block mt-0.5">
                      Rs. {due.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Payment Transactions Ledger */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
                    Payment Ledger Transactions ({historyList.length})
                  </h4>

                  {historyList.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400 dark:text-zinc-500 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800">
                      No payment transactions recorded for this order.
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 dark:border-zinc-800 overflow-x-auto">
                      <Table className="min-w-[480px]">
                        <TableHeader>
                          <TableRow className="bg-slate-50 dark:bg-zinc-900/50">
                            <TableHead className="text-[11px] font-bold">Date &amp; Time</TableHead>
                            <TableHead className="text-[11px] font-bold">Method</TableHead>
                            <TableHead className="text-[11px] font-bold">Reference / Notes</TableHead>
                            <TableHead className="text-[11px] font-bold text-right">Amount Paid</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {historyList.map((entry, idx) => {
                            const entryDate = entry.createdAt || entry.paymentDate || historyPurchase.purchaseDate;
                            return (
                              <TableRow key={entry.id || idx}>
                                <TableCell className="text-xs font-mono">
                                  {new Date(entryDate).toLocaleString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-[10px] font-semibold">
                                    {entry.method || entry.paymentMethod || 'CASH'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-slate-600 dark:text-zinc-400">
                                  {entry.reference || entry.chequeNumber ? (
                                    <span>
                                      {entry.reference || `Cheque #${entry.chequeNumber}`}
                                      {entry.bankName && ` (${entry.bankName})`}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 italic">Settlement Entry</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-xs font-bold font-mono text-emerald-600 text-right">
                                  Rs. {Number(entry.amount).toLocaleString()}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                <DialogFooter className="sticky bottom-0 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm pt-3 pb-1 border-t border-slate-100 dark:border-zinc-800 mt-3 flex items-center justify-between gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setHistoryPurchase(null)}>
                    Close
                  </Button>
                  {due > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        const target = historyPurchase;
                        setHistoryPurchase(null);
                        setSettlingPurchase(target);
                        setPaymentAmount(String(due));
                        setSettleDateTime(getCurrentLocalISOString());
                        setSettleMethod('CASH');
                        setSettleReference('');
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs font-bold"
                    >
                      <Wallet className="size-3.5" />
                      <span>Add Payment (Pay Rs. {due.toLocaleString()})</span>
                    </Button>
                  )}
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BuyRawMaterialsPage;