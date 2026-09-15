import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { SearchableSelect } from '../components/ui/SearchableSelect';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import { get, post, put } from '../lib/api';
import { toast } from 'react-toastify';
import { A4InvoiceModal } from '../components/pos/A4InvoiceModal';
import { isValidSriLankanNIC, isValidSriLankanPhone } from '../lib/validators';
import { useTheme } from '../contexts/ThemeContext';
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  Barcode,
  Building,
  User,
  FileText,
  Banknote,
  CheckCircle,
  Loader2,
  Package,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  Printer,
  Save,
} from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { openWhatsAppChat, generateCustomerInvoiceWhatsAppMessage } from '../lib/whatsapp';

interface CatalogVariant {
  id: number;
  size: string;
  color: string;
  sku: string;
  barcode: string | null;
  retailPrice: number;
  wholesalePrice: number;
  stock: number;
  product: {
    id: number;
    name: string;
    searchKey?: string | null;
    category?: { name: string };
    images?: { imageUrl: string }[];
  };
}

interface CartItem {
  variantId: number;
  name: string;
  size: string;
  color: string;
  sku: string;
  imageUrl?: string;
  unitPrice: number;
  quantity: number;
  maxStock: number;
}

export const QuickCheckoutPage: React.FC = () => {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [catalog, setCatalog] = useState<CatalogVariant[]>([]);
  const [customers, setCustomers] = useState<{ id: number; name: string; phone: string; address?: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Mode: Retail vs Wholesale (Shops)
  const [pricingMode, setPricingMode] = useState<'RETAIL' | 'WHOLESALE'>('RETAIL');
  const [searchQuery, setSearchQuery] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);

  // Pagination state for product grid
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Checkout and Customer states
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('walk-in');
  const [clientGivenCash, setClientGivenCash] = useState<string>('');
  // Payment methods: Cash, Cheque, and Credit
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CHEQUE' | 'CREDIT'>('CASH');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const editInvoiceId = searchParams.get('editInvoiceId');

  // Dual-mode Discount: Default to Percentage (%), with Fixed Price (Rs) fallback
  const [discountType, setDiscountType] = useState<'FIXED' | 'PERCENT'>('PERCENT');
  const [discountInput, setDiscountInput] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);

  // Edit Mode state tracking
  const [isEditing, setIsEditing] = useState(false);
  const [originalInvoice, setOriginalInvoice] = useState<any>(null);

  // Quick Customer Add Modal states
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustNic, setNewCustNic] = useState('');
  const [creatingCustomer, setCreatingCustomer] = useState(false);

  // A4 Invoice preview state
  const [completedOrder, setCompletedOrder] = useState<any>(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);

  // Adjust Cash Modal State for Edit Mode
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [tempAdjustCash, setTempAdjustCash] = useState('');

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Track notified invoice ID to prevent duplicate toast triggers in React StrictMode
  const lastNotifiedEditIdRef = useRef<string | null>(null);

  /**
   * Fetch catalog products and registered customer records
   */
  const bootstrapPos = async () => {
    setLoading(true);
    try {
      const [catData, custData] = await Promise.all([
        get<CatalogVariant[]>('/orders/catalog'),
        get<any[]>('/customers'),
      ]);
      setCatalog(Array.isArray(catData) ? catData : []);
      setCustomers(Array.isArray(custData) ? custData : []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to initialize POS terminal');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    bootstrapPos();
  }, []);

  /**
   * Auto-fill checkout fields if user clicked Edit Invoice
   */
  useEffect(() => {
    const cleanId = editInvoiceId ? String(editInvoiceId).trim() : null;
    if (!cleanId) return;

    const loadEditInvoice = async () => {
      setLoading(true);
      try {
        const inv = await get<any>(`/orders/invoices/${cleanId}`);
        if (!inv || !inv.id) {
          throw new Error(`Invoice #${cleanId} could not be retrieved`);
        }
        setIsEditing(true);
        setOriginalInvoice(inv);

        // Pre-fill Customer with phone fallback
        setSelectedCustomerId(inv.customerId ? String(inv.customerId) : 'walk-in');
        // Pre-fill Payment method
        setPaymentMethod(inv.paymentMethod === 'CHEQUE' ? 'CHEQUE' : inv.paymentMethod === 'CREDIT' ? 'CREDIT' : 'CASH');
        // Pre-fill Cash Tendered
        setClientGivenCash(String(inv.paidAmount !== undefined ? inv.paidAmount : ''));

        // Pre-fill Cart items
        if (Array.isArray(inv.items)) {
          setCart(
            inv.items.map((i: any) => ({
              variantId: i.variantId,
              name: i.variant?.product?.name || 'Garment Item',
              size: i.variant?.size || 'FREE',
              color: i.variant?.color || 'Default',
              sku: i.variant?.sku || '',
              imageUrl: i.variant?.product?.images?.[0]?.imageUrl,
              unitPrice: Number(i.unitPrice),
              quantity: Number(i.quantity),
              maxStock: Number((i.variant?.stock || 0) + i.quantity), // Add back currently allocated units so validation succeeds
            }))
          );
        }

        // Pre-fill Discount: Preserve default PERCENT (%) mode and calculate effective discount rate
        if (inv.discount > 0 && inv.subtotal > 0) {
          setDiscountType('PERCENT');
          const effectivePercent = Math.round((Number(inv.discount) / Number(inv.subtotal)) * 100);
          setDiscountInput(effectivePercent);
        } else {
          setDiscountType('PERCENT');
          setDiscountInput(0);
        }

        // Trigger toast only once per invoice load session
        if (lastNotifiedEditIdRef.current !== cleanId) {
          toast.info(`Editing Invoice #INV${inv.id}`);
          lastNotifiedEditIdRef.current = cleanId;
        }
      } catch (err: any) {
        toast.error(err.message || 'Failed to load invoice for editing');
      } finally {
        setLoading(false);
      }
    };

    loadEditInvoice();
  }, [editInvoiceId]);

  /**
   * Add variant item to current cashier cart
   */
  const addToCart = (variant: CatalogVariant) => {
    if (variant.stock <= 0) {
      toast.error(`"${variant.product.name}" is out of stock`);
      return;
    }

    const price = pricingMode === 'WHOLESALE' ? variant.wholesalePrice : variant.retailPrice;
    const existingIndex = cart.findIndex((i) => i.variantId === variant.id);

    if (existingIndex > -1) {
      const current = cart[existingIndex];
      if (current.quantity + 1 > variant.stock) {
        toast.error(`Cannot add more. Only ${variant.stock} available in stock`);
        return;
      }
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      setCart(updated);
    } else {
      setCart([
        ...cart,
        {
          variantId: variant.id,
          name: variant.product.name,
          size: variant.size || 'FREE',
          color: variant.color || 'Default',
          sku: variant.sku,
          imageUrl: variant.product.images?.[0]?.imageUrl,
          unitPrice: price,
          quantity: 1,
          maxStock: variant.stock,
        },
      ]);
    }
  };

  /**
   * Scan barcode handler (exact match on barcode or SKU)
   */
  const handleBarcodeScan = (e: React.FormEvent) => {
    e.preventDefault();
    const query = barcodeInput.trim().toUpperCase();
    if (!query) return;

    const matched = catalog.find((v) => v.barcode?.toUpperCase() === query || v.sku.toUpperCase() === query);
    if (matched) {
      addToCart(matched);
      setBarcodeInput('');
    } else {
      toast.error(`No item found for barcode "${query}"`);
    }
  };

  /**
   * Change item quantity in cart
   */
  const updateQty = (variantId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.variantId === variantId) {
            const nextQty = item.quantity + delta;
            if (nextQty > item.maxStock) {
              toast.error(`Only ${item.maxStock} in stock`);
              return item;
            }
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  /**
   * Filter visible catalog items by search keyword
   */
  /**
   * Filter and paginate catalog items
   */
  const filteredCatalog = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return catalog;
    return catalog.filter(
      (v) =>
        v.product.name.toLowerCase().includes(q) ||
        v.sku.toLowerCase().includes(q) ||
        (v.barcode && v.barcode.toLowerCase().includes(q)) ||
        (v.product.searchKey && v.product.searchKey.toLowerCase().includes(q))
    );
  }, [catalog, searchQuery]);

  const totalPages = Math.ceil(filteredCatalog.length / itemsPerPage) || 1;
  const paginatedCatalog = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredCatalog.slice(start, start + itemsPerPage);
  }, [filteredCatalog, currentPage]);

  // Reset to first page when search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Subtotal and Net Payable Total calculation
  const subtotal = useMemo(() => cart.reduce((acc, curr) => acc + curr.unitPrice * curr.quantity, 0), [cart]);

  // Compute final discount value in Rs based on selected mode (FIXED or PERCENT)
  const discountAmount = useMemo(() => {
    if (!discountInput || discountInput <= 0) return 0;
    if (discountType === 'PERCENT') {
      const percentage = Math.min(100, Math.max(0, discountInput));
      return Math.round((subtotal * percentage) / 100);
    }
    return Math.min(subtotal, Math.max(0, discountInput));
  }, [subtotal, discountInput, discountType]);

  const total = Math.max(0, subtotal - discountAmount);

  // Client Cash calculations for change and outstanding balance
  const cashEntered = clientGivenCash === '' ? 0 : Number(clientGivenCash);
  const cashChange = cashEntered > total ? cashEntered - total : 0;
  const balanceDue = cashEntered < total && cashEntered > 0 ? total - cashEntered : cashEntered === 0 ? total : 0;

  /**
   * Live Auto-Switch Payment Method:
   * 1. If there's an underpaid balance (due amount > 0), switch automatically to CREDIT.
   * 2. If fully paid or overpaid, switch back to CASH (unless CHEQUE was explicitly chosen).
   */
  useEffect(() => {
    // Only evaluate when there are items in the cart
    if (cart.length === 0) return;

    const isUnderpaid = clientGivenCash === '' ? true : cashEntered < total;

    if (isUnderpaid) {
      // Partial payment or zero cash -> Auto select CREDIT
      if (paymentMethod !== 'CREDIT') {
        setPaymentMethod('CREDIT');
      }
    } else {
      // Full payment (cashEntered >= total) -> Switch out of CREDIT
      if (paymentMethod === 'CREDIT') {
        setPaymentMethod('CASH');
      }
      // If user selected CHEQUE, it remains CHEQUE untouched
    }
  }, [clientGivenCash, cashEntered, total, cart.length]);

  /**
   * Quick add customer modal submit handler
   */
  const handleQuickAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim() || !newCustPhone.trim()) {
      toast.error('Customer name and phone are required');
      return;
    }
    if (!isValidSriLankanPhone(newCustPhone.trim())) {
      toast.error('Invalid Sri Lankan phone number (07XXXXXXXX or landline 0XXXXXXXXX)');
      return;
    }
    if (newCustNic.trim() && !isValidSriLankanNIC(newCustNic.trim())) {
      toast.error('Invalid NIC format (9 digits + V/X or 12 digits)');
      return;
    }

    setCreatingCustomer(true);
    try {
      const created = await post<any>('/customers', {
        name: newCustName.trim(),
        phone: newCustPhone.trim(),
        address: newCustAddress.trim() || undefined,
        nic: newCustNic.trim() || undefined,
        type: pricingMode === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL',
      });
      toast.success(`Customer "${created.name}" registered!`);
      setCustomers((prev) => [created, ...prev]);
      setSelectedCustomerId(String(created.id));
      setCustomerModalOpen(false);
      setNewCustName('');
      setNewCustPhone('');
      setNewCustAddress('');
      setNewCustNic('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to add customer');
    } finally {
      setCreatingCustomer(false);
    }
  };

  /**
   * Submit transaction order or update existing invoice, sync credit balance, and conditionally trigger print
   */
  const handleCheckout = async (triggerPrint = true) => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    const isWalkIn = selectedCustomerId === 'walk-in' || !selectedCustomerId;
    const isUnderpaid = cashEntered < total;

    if (isWalkIn && (paymentMethod === 'CREDIT' || isUnderpaid)) {
      toast.error('Credit or partial payment is only allowed for registered customers. Please select or add a customer.');
      return;
    }

    setSubmitting(true);
    try {
      const selectedCust = customers.find((c) => String(c.id) === String(selectedCustomerId));

      // Accurately resolve tendered and paid cash without wiping part-payments on credit bills
      let resolvedTendered = total;
      let resolvedPaid = total;

      if (clientGivenCash !== '') {
        // If cashier typed an amount (e.g. 150), honor it as the tendered & paid amount
        resolvedTendered = cashEntered;
        resolvedPaid = Math.min(total, cashEntered);
      } else if (paymentMethod === 'CREDIT') {
        // Pure zero-down credit sale when no client cash was entered
        resolvedTendered = 0;
        resolvedPaid = 0;
      }

      const creditDue = Math.max(0, total - resolvedPaid);
      const isUnderpaid = creditDue > 0;

      const payload = {
        source: pricingMode === 'WHOLESALE' ? 'POS_WHOLESALE' : 'POS_RETAIL',
        customerId: !isWalkIn && selectedCust ? selectedCust.id : undefined,
        customerName: selectedCust ? selectedCust.name : 'Walk-in Customer',
        customerPhone: selectedCust ? selectedCust.phone : undefined,
        items: cart.map((i) => ({
          variantId: i.variantId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          price: i.unitPrice * i.quantity,
        })),
        subtotal,
        discount: discountAmount,
        discountType,
        totalAmount: total,
        paidAmount: resolvedPaid,
        paymentMethod: paymentMethod === 'CREDIT' || isUnderpaid ? 'CREDIT' : paymentMethod,
      };

      let resultOrder: any;

      if (isEditing && originalInvoice?.id) {
        // Update existing invoice using put API utility
        resultOrder = await put<any>(`/orders/invoices/${originalInvoice.id}`, payload);
        toast.success(`Invoice #INV${originalInvoice.id} updated successfully!`);
      } else {
        // Create brand new invoice order
        resultOrder = await post<any>('/orders/pos', payload);
        toast.success('Invoice generated successfully!');
      }

      setCart([]);
      setDiscountInput(0);
      setClientGivenCash('');

      if (triggerPrint) {
        setCompletedOrder({
          ...resultOrder,
          tenderedAmount: resolvedTendered,
          paidAmount: resolvedPaid,
          discount: discountAmount,
          discountType,
          discountRate: discountType === 'PERCENT' ? discountInput : undefined,
        });
        setInvoiceOpen(true);
      }

      if (isEditing) {
        navigate('/system/invoices');
      } else {
        bootstrapPos();
      }
    } catch (err: any) {
      toast.error(err.message || 'Transaction failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-5rem)] pb-4 overflow-hidden">
      {/* Left Column: Catalog Browser & Quick Scanner */}
      <div className="flex-1 flex flex-col gap-3 min-w-0 bg-white dark:bg-zinc-900/60 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800">
        {/* Top Controls: Search, Barcode & Pricing Mode */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Barcode Quick Scanner Form */}
          <form onSubmit={handleBarcodeScan} className="relative flex-1 min-w-[200px]">
            <Barcode className="absolute left-3 top-2.5 size-4 text-slate-400" />
            <Input
              ref={barcodeInputRef}
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder="Scan Barcode / SKU..."
              className="pl-9 h-9 text-xs font-mono"
            />
          </form>

          {/* Keyword Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by title, size, tags..."
              className="pl-9 h-9 text-xs"
            />
          </div>

          {/* Pricing Mode Toggle: Retail vs Wholesale */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 shrink-0">
            <button
              type="button"
              onClick={() => setPricingMode('RETAIL')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                pricingMode === 'RETAIL'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400'
              }`}
            >
              Retail
            </button>
            <button
              type="button"
              onClick={() => setPricingMode('WHOLESALE')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                pricingMode === 'WHOLESALE'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400'
              }`}
            >
              Wholesale
            </button>
          </div>

          {/* Quick Register Product Button - Passes returnUrl to route back seamlessly */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate('/system/products/new?returnUrl=/system/quick-checkout')}
            className="h-8 px-2.5 text-xs font-semibold gap-1.5 border-dashed border-emerald-500/60 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 shrink-0"
            title="Register new product and return back to POS"
          >
            <Plus className="size-3.5" /> Product
          </Button>
        </div>

        {/* Product Visual Grid (With Images) */}
        <div className="flex-1 overflow-y-auto pr-1">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center gap-2">
              <Loader2 className="size-8 animate-spin text-emerald-500" />
              <p className="text-xs text-slate-400">Loading catalog matrix...</p>
            </div>
          ) : filteredCatalog.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-400">
              <Package className="size-10 opacity-30" />
              <p className="text-xs">No products matched current search.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {paginatedCatalog.map((v) => {
                const apiHost = import.meta.env.VITE_API_URL
                  ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
                  : 'http://localhost:5000';

                // 1. Check if variant directly owns an image, 2. Match by color in product image pool, 3. Fallback to first image
                const variantDirectImage = (v as any).images?.[0]?.imageUrl;
                const productImages = v.product.images || [];
                const colorKeyword = (v.color || '').toLowerCase().trim();
                
                const matchedColorImage = productImages.find((imgObj: any) => 
                  colorKeyword && imgObj.imageUrl.toLowerCase().includes(colorKeyword)
                )?.imageUrl;

                const targetImg = variantDirectImage || matchedColorImage || productImages[0]?.imageUrl;

                const resolvedUrl = targetImg
                  ? targetImg.startsWith('http') || targetImg.startsWith('data:')
                    ? targetImg
                    : `${apiHost}${targetImg.startsWith('/') ? '' : '/'}${targetImg}`
                  : null;

                const currentPrice = pricingMode === 'WHOLESALE' ? v.wholesalePrice : v.retailPrice;

                return (
                  <button
                    key={v.id}
                    type="button"
                    disabled={v.stock <= 0}
                    onClick={() => addToCart(v)}
                    className={`flex flex-col text-left rounded-xl border p-2.5 transition-all group relative overflow-hidden ${
                      v.stock <= 0
                        ? 'opacity-40 cursor-not-allowed border-slate-200 dark:border-zinc-800'
                        : 'border-slate-200 dark:border-zinc-800 hover:border-emerald-500 hover:shadow-md bg-white dark:bg-zinc-950'
                    }`}
                  >
                    {/* Thumbnail Image */}
                    <div className="w-full aspect-square rounded-lg bg-slate-100 dark:bg-zinc-900 mb-2 overflow-hidden flex items-center justify-center">
                      {resolvedUrl ? (
                        <img src={resolvedUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      ) : (
                        <Package className="size-8 text-slate-300 dark:text-zinc-700" />
                      )}
                    </div>

                    <h4 className="font-semibold text-xs text-slate-900 dark:text-white line-clamp-1">{v.product.name}</h4>

                    <div className="flex items-center gap-1.5 my-1">
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300">
                        {v.size || 'FREE'}
                      </span>
                      <span className="text-[10px] text-slate-500">{v.color || 'Default'}</span>
                    </div>

                    <div className="flex items-center justify-between mt-auto pt-1">
                      <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                        Rs. {Number(currentPrice).toLocaleString()}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">Stock: {v.stock}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Product Grid Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-zinc-800 text-xs shrink-0">
            <span className="text-slate-400">Page {currentPage} of {totalPages} ({filteredCatalog.length} products)</span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="h-7 px-2 text-xs"
              >
                <ChevronLeft className="size-3.5" /> Prev
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="h-7 px-2 text-xs"
              >
                Next <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Right Column: Checkout Cart & A4 Billing */}
      <div className="w-full lg:w-96 flex flex-col bg-white dark:bg-zinc-900/60 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shrink-0">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <ShoppingCart className={`size-4 ${isEditing ? 'text-blue-500' : 'text-emerald-500'}`} />
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              {isEditing ? `Editing #INV${originalInvoice?.id}` : `Active Order (${cart.length})`}
            </h3>
            {isEditing && (
              <Badge variant="outline" className="text-[10px] border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-950/40">
                EDIT MODE
              </Badge>
            )}
          </div>
          {cart.length > 0 && (
            <button 
              type="button" 
              onClick={() => {
                setCart([]);
                if (isEditing) {
                  navigate('/system/quick-checkout');
                  setIsEditing(false);
                  setOriginalInvoice(null);
                }
              }} 
              className="text-xs text-rose-500 hover:underline cursor-pointer"
            >
              {isEditing ? 'Cancel Edit' : 'Clear All'}
            </button>
          )}
        </div>

        {/* Customer Selection Row with Searchable Combobox & Quick Add Button */}
        <div className="py-2 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] font-bold uppercase text-slate-400">Customer / Account</label>
            <button
              type="button"
              onClick={() => setCustomerModalOpen(true)}
              className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              <UserPlus className="size-3" /> + Add Customer
            </button>
          </div>
          <SearchableSelect
            value={selectedCustomerId}
            onValueChange={setSelectedCustomerId}
            options={[
              { value: 'walk-in', label: 'Walk-in Customer (General)' },
              ...customers.map((c) => ({
                value: String(c.id),
                label: `${c.name} (${c.phone})`,
              })),
            ]}
            placeholder="Select customer..."
            searchPlaceholder="Search by name or phone..."
            dark={dark}
          />
        </div>

        {/* Cart Item Rows */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800/60 my-2 pr-1">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-1 text-slate-400 text-xs">
              <ShoppingCart className="size-8 opacity-20" />
              <span>Order cart is empty</span>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.variantId} className="py-2 flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h5 className="font-semibold text-xs text-slate-900 dark:text-white truncate">{item.name}</h5>
                  <p className="text-[10px] text-slate-400 font-mono">
                    {item.size} / {item.color} · Rs. {item.unitPrice.toLocaleString()}
                  </p>
                </div>

                {/* Qty Stepper */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => updateQty(item.variantId, -1)}
                    className="size-6 rounded-md bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-700 dark:text-zinc-200"
                  >
                    <Minus className="size-3" />
                  </button>
                  <span className="font-mono text-xs font-bold w-5 text-center">{item.quantity}</span>
                  <button
                    type="button"
                    onClick={() => updateQty(item.variantId, 1)}
                    className="size-6 rounded-md bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-700 dark:text-zinc-200"
                  >
                    <Plus className="size-3" />
                  </button>
                </div>

                <span className="font-mono font-bold text-xs text-right w-16">
                  Rs. {(item.unitPrice * item.quantity).toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Totals & Payment Method */}
        <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Subtotal</span>
            <span className="font-mono">Rs. {subtotal.toLocaleString()}</span>
          </div>

          {/* Discount Field: [%] [Rs] toggle with left-aligned calculated discount display */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs text-slate-500 font-medium">Discount</span>
              <div className="inline-flex rounded-lg border border-slate-200 dark:border-zinc-800 p-0.5 bg-slate-100 dark:bg-zinc-900">
                <button
                  type="button"
                  onClick={() => setDiscountType('PERCENT')}
                  className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                    discountType === 'PERCENT'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400'
                  }`}
                >
                  %
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountType('FIXED')}
                  className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                    discountType === 'FIXED'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400'
                  }`}
                >
                  Rs
                </button>
              </div>
            </div>

            {/* Calculated discount preview sits to the left of the static input box */}
            <div className="flex items-center justify-end gap-1.5 flex-1 min-w-0">
              {discountType === 'PERCENT' && discountAmount > 0 && (
                <span className="text-[11px] font-mono text-emerald-600 font-bold whitespace-nowrap">
                  (-Rs. {discountAmount.toLocaleString()})
                </span>
              )}
              <Input
                type="number"
                min="0"
                max={discountType === 'PERCENT' ? 100 : undefined}
                value={discountInput || ''}
                onChange={(e) => setDiscountInput(Number(e.target.value) || 0)}
                placeholder="0"
                className="w-20 h-7 text-xs text-right font-mono shrink-0"
              />
            </div>
          </div>

          {/* Client Cash Received Field with Clear Text and Clean Adjust Button */}
          <div className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-zinc-950 p-2 rounded-xl border border-slate-200 dark:border-zinc-800">
            <div>
              <span className="text-sm font-bold text-slate-900 dark:text-white block">Client Cash (Rs)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                disabled={isEditing}
                value={clientGivenCash}
                onChange={(e) => setClientGivenCash(e.target.value)}
                placeholder={String(total)}
                className={`w-28 h-8 text-xs text-right font-mono font-bold ${
                  isEditing
                    ? 'bg-slate-100 dark:bg-zinc-900 cursor-not-allowed !text-black dark:!text-white opacity-100 font-extrabold'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              />
              {isEditing && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    // Open modal completely clean/empty for entering the newly received payment
                    setTempAdjustCash('');
                    setAdjustModalOpen(true);
                  }}
                  className="h-8 px-2.5 text-xs font-bold border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg shrink-0 cursor-pointer"
                >
                  Adjust
                </Button>
              )}
            </div>
          </div>

          {/* Payable Total */}
          <div className="flex items-center justify-between text-sm font-bold text-slate-900 dark:text-white pt-1">
            <span>Payable Total</span>
            <span className="font-mono text-base text-emerald-600 dark:text-emerald-400">
              Rs. {total.toLocaleString()}
            </span>
          </div>

          {/* Dynamic Change vs Balance Due Indicators */}
          {cashChange > 0 && (
            <div className="flex items-center justify-between text-xs font-bold text-emerald-600">
              <span>Change (Return to Client):</span>
              <span className="font-mono">Rs. {cashChange.toLocaleString()}</span>
            </div>
          )}
          {balanceDue > 0 && cashEntered > 0 && (
            <div className="flex items-center justify-between text-xs font-bold text-rose-600">
              <span>Balance Due (Credit):</span>
              <span className="font-mono">Rs. {balanceDue.toLocaleString()}</span>
            </div>
          )}

          {/* Payment Method Selector */}
          <div className="grid grid-cols-3 gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => setPaymentMethod('CASH')}
              className={`flex items-center justify-center gap-1 py-1.5 rounded-lg border text-xs font-semibold ${
                paymentMethod === 'CASH'
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600'
                  : 'border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400'
              }`}
            >
              <Banknote className="size-3.5" /> Cash
            </button>
            {/* Cheque Payment Option in place of Card */}
            <button
              type="button"
              onClick={() => setPaymentMethod('CHEQUE')}
              className={`flex items-center justify-center gap-1 py-1.5 rounded-lg border text-xs font-semibold ${
                paymentMethod === 'CHEQUE'
                  ? 'border-amber-500 bg-amber-500/10 text-amber-600'
                  : 'border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400'
              }`}
            >
              <FileText className="size-3.5" /> Cheque
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('CREDIT')}
              className={`flex items-center justify-center gap-1 py-1.5 rounded-lg border text-xs font-semibold ${
                paymentMethod === 'CREDIT'
                  ? 'border-rose-500 bg-rose-500/10 text-rose-600'
                  : 'border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400'
              }`}
            >
              <Building className="size-3.5" /> Credit
            </button>
          </div>

          {/* Action Row: Pay Now (Create Mode) OR Inline [Save Changes] + [Save & Print] (Edit Mode) */}
          {!isEditing ? (
            <Button
              type="button"
              disabled={cart.length === 0 || submitting}
              onClick={() => handleCheckout(true)}
              className="w-full mt-2 h-10 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md"
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />}
              Pay Now
            </Button>
          ) : (
            <div className="flex items-center gap-2 mt-2">
              <Button
                type="button"
                variant="outline"
                disabled={cart.length === 0 || submitting}
                onClick={() => handleCheckout(false)}
                className="flex-1 h-10 gap-1.5 font-bold text-xs border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
              >
                {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                Save Changes
              </Button>
              <Button
                type="button"
                disabled={cart.length === 0 || submitting}
                onClick={() => handleCheckout(true)}
                className="flex-1 h-10 gap-1.5 font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-md"
              >
                {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <Printer className="size-3.5" />}
                Save & Print
              </Button>
            </div>
          )}

          
        </div>
      </div>

      {/* Quick Customer Add Modal within POS Terminal */}
      <Dialog open={customerModalOpen} onOpenChange={setCustomerModalOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Quick Register Customer</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleQuickAddCustomer} className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Customer / Shop Name *</label>
              <Input
                required
                value={newCustName}
                onChange={(e) => setNewCustName(e.target.value)}
                placeholder="e.g. Kasun Perera"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Phone Number *</label>
              <Input
                required
                value={newCustPhone}
                onChange={(e) => setNewCustPhone(e.target.value)}
                placeholder="0771234567"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">NIC Number (Optional)</label>
              <Input
                value={newCustNic}
                onChange={(e) => setNewCustNic(e.target.value)}
                placeholder="e.g. 199012345678"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Address / City</label>
              <Input
                value={newCustAddress}
                onChange={(e) => setNewCustAddress(e.target.value)}
                placeholder="e.g. Makandura, Matara"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setCustomerModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={creatingCustomer}>
                {creatingCustomer && <Loader2 className="size-3.5 animate-spin mr-1" />} Save Customer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modern Shadcn Modal: Receive Additional Payment / Settle Invoice Balance */}
      <Dialog open={adjustModalOpen} onOpenChange={setAdjustModalOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Banknote className="size-5 text-emerald-600" /> Receive Additional Payment
            </DialogTitle>
          </DialogHeader>

          {(() => {
            const previouslyPaid = Number(originalInvoice?.paidAmount || 0);
            const remainingDue = Math.max(0, total - previouslyPaid);
            const newlyEntered = tempAdjustCash === '' ? 0 : Number(tempAdjustCash);
            const cumulativeTotal = previouslyPaid + newlyEntered;
            const projectedChange = cumulativeTotal > total ? cumulativeTotal - total : 0;
            const projectedRemaining = Math.max(0, total - cumulativeTotal);

            return (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (newlyEntered <= 0) {
                    toast.error('Please enter a valid payment amount');
                    return;
                  }

                  const finalCalculatedCash = previouslyPaid + newlyEntered;
                  const finalPaidAmount = Math.min(total, finalCalculatedCash);
                  const remainingDebt = Math.max(0, total - finalPaidAmount);

                  // Use defined submitting state
                  setSubmitting(true);
                  try {
                    // Instantly persist payment to Backend Database & Atomic Customer Balance Ledger
                    const updated = await put<any>(`/orders/invoices/${originalInvoice.id}`, {
                      source: originalInvoice.source || 'POS_RETAIL',
                      customerId: originalInvoice.customerId || undefined,
                      customerName: originalInvoice.customerName || 'Walk-in Customer',
                      customerPhone: originalInvoice.customerPhone || undefined,
                      items: cart.map((i) => ({
                        variantId: i.variantId,
                        quantity: i.quantity,
                        unitPrice: i.unitPrice,
                        price: i.unitPrice * i.quantity,
                      })),
                      subtotal,
                      discount: discountAmount,
                      discountType,
                      totalAmount: total,
                      paidAmount: finalPaidAmount,
                      paymentMethod: remainingDebt > 0 ? 'CREDIT' : 'CASH',
                    });

                    // Update live UI state and internal reference
                    setClientGivenCash(String(finalCalculatedCash));
                    setOriginalInvoice(updated);
                    setAdjustModalOpen(false);

                    toast.success(
                      `Payment of Rs. ${newlyEntered.toLocaleString()} saved permanently! Invoice #INV${originalInvoice.id} updated.`
                    );
                  } catch (err: any) {
                    toast.error(err.message || 'Failed to save payment to database');
                  } finally {
                    // Reset submitting state
                    setSubmitting(false);
                  }
                }}
                className="space-y-4 py-2 text-xs"
              >
                {/* Ledger Breakdown Card */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-1.5">
                  <div className="flex justify-between items-center text-slate-500">
                    <span>Invoice Total:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      Rs. {total.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-500">
                    <span>Previously Paid:</span>
                    <span className="font-mono font-bold text-emerald-600">
                      Rs. {previouslyPaid.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-slate-200 dark:border-zinc-800">
                    <span className="font-bold text-slate-700 dark:text-zinc-300">Current Due Balance:</span>
                    <span className="font-mono font-bold text-rose-600 text-sm">
                      Rs. {remainingDue.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Professional Input Field */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-900 dark:text-white block">
                    Payment Received Now (Rs) *
                  </label>
                  <Input
                    type="number"
                    min="1"
                    step="any"
                    autoFocus
                    required
                    value={tempAdjustCash}
                    onChange={(e) => setTempAdjustCash(e.target.value)}
                    placeholder={`e.g. ${remainingDue > 0 ? remainingDue : total}`}
                    className="font-mono font-bold text-base text-emerald-600 dark:text-emerald-400 h-10"
                  />
                </div>

                {/* Live Outcome Preview */}
                {newlyEntered > 0 && (
                  <div className="p-2.5 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-1">
                    <div className="flex justify-between font-semibold text-emerald-800 dark:text-emerald-300">
                      <span>Total Paid Will Become:</span>
                      <span className="font-mono font-bold">Rs. {cumulativeTotal.toLocaleString()}</span>
                    </div>
                    {projectedChange > 0 && (
                      <div className="flex justify-between font-bold text-emerald-700 dark:text-emerald-400">
                        <span>Change to Return:</span>
                        <span className="font-mono">Rs. {projectedChange.toLocaleString()}</span>
                      </div>
                    )}
                    {projectedRemaining > 0 && (
                      <div className="flex justify-between font-bold text-rose-600">
                        <span>Remaining Credit Due:</span>
                        <span className="font-mono">Rs. {projectedRemaining.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                )}

                <DialogFooter className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAdjustModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                  type="submit"
                  size="sm"
                  disabled={submitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-9 px-4"
                >
                  {submitting && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
                  Apply Payment
                </Button>
                </DialogFooter>
              </form>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Headless Direct A4 Browser Print Window Trigger (Conditional Mount Prevents Duplicate Preview Loop) */}
      {invoiceOpen && completedOrder && (
        <A4InvoiceModal
          open={invoiceOpen}
          onClose={() => {
            setInvoiceOpen(false);
            setCompletedOrder(null);
          }}
          order={completedOrder}
          autoPrint={true}
        />
      )}
    </div>
  );
};