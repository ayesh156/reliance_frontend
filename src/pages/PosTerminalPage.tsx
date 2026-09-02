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
import { get, post } from '../lib/api';
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
  CreditCard,
  Banknote,
  CheckCircle,
  Loader2,
  Package,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  Printer,
} from 'lucide-react';

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

export const PosTerminalPage: React.FC = () => {
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
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'CREDIT'>('CASH');
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);

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

  const barcodeInputRef = useRef<HTMLInputElement>(null);

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
  const total = Math.max(0, subtotal - (Number(discountAmount) || 0));

  // Client Cash calculations for change and outstanding balance
  const cashEntered = clientGivenCash === '' ? 0 : Number(clientGivenCash);
  const cashChange = cashEntered > total ? cashEntered - total : 0;
  const balanceDue = cashEntered < total && cashEntered > 0 ? total - cashEntered : cashEntered === 0 ? total : 0;

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
   * Checkout and submit order to backend database
   */
  /**
   * Submit transaction order, register credit balance if underpaid, and launch print window
   */
  const handleCheckout = async () => {
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
      
      // Determine actual paid amount (Cash given or Total if card/full cash without explicit input)
      let resolvedPaid = total;
      if (paymentMethod === 'CREDIT') {
        resolvedPaid = 0;
      } else if (clientGivenCash !== '') {
        resolvedPaid = Math.min(total, cashEntered);
      }

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
        totalAmount: total,
        paidAmount: resolvedPaid,
        paymentMethod: paymentMethod === 'CREDIT' || isUnderpaid ? 'CREDIT' : paymentMethod,
      };

      const created = await post('/orders/pos', payload);
      toast.success('Invoice generated successfully!');
      setCart([]);
      setDiscountAmount(0);
      setClientGivenCash('');
      setCompletedOrder(created);
      setInvoiceOpen(true); // ⭐ Automatically triggers Print Dialog
      bootstrapPos(); // Refresh live stock counts
    } catch (err: any) {
      toast.error(err.message || 'Payment failed');
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
                const img = v.product.images?.[0]?.imageUrl;
                const resolvedUrl = img
                  ? img.startsWith('http') || img.startsWith('data:')
                    ? img
                    : `${apiHost}${img.startsWith('/') ? '' : '/'}${img}`
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
            <ShoppingCart className="size-4 text-emerald-500" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Active Order ({cart.length})</h3>
          </div>
          {cart.length > 0 && (
            <button type="button" onClick={() => setCart([])} className="text-xs text-rose-500 hover:underline">
              Clear All
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

          {/* Discount Field */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-slate-500">Discount (Rs)</span>
            <Input
              type="number"
              value={discountAmount || ''}
              onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)}
              placeholder="0"
              className="w-24 h-7 text-xs text-right font-mono"
            />
          </div>

          {/* Client Cash Received Field */}
          <div className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-zinc-950 p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800">
            <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Client Cash (Rs)</span>
            <Input
              type="number"
              value={clientGivenCash}
              onChange={(e) => setClientGivenCash(e.target.value)}
              placeholder={String(total)}
              className="w-28 h-7 text-xs text-right font-mono font-bold text-emerald-600 dark:text-emerald-400"
            />
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
            <button
              type="button"
              onClick={() => setPaymentMethod('CARD')}
              className={`flex items-center justify-center gap-1 py-1.5 rounded-lg border text-xs font-semibold ${
                paymentMethod === 'CARD'
                  ? 'border-blue-500 bg-blue-500/10 text-blue-600'
                  : 'border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400'
              }`}
            >
              <CreditCard className="size-3.5" /> Card
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

          {/* Pay Now Button (Direct One-Click Checkout & Print) */}
          <Button
            type="button"
            disabled={cart.length === 0 || submitting}
            onClick={handleCheckout}
            className="w-full mt-2 h-10 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />}
            Pay Now
          </Button>

          
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

      {/* Headless Direct A4 Browser Print Window Trigger */}
      <A4InvoiceModal
        open={invoiceOpen}
        onClose={() => {
          setInvoiceOpen(false);
          setCompletedOrder(null);
        }}
        order={completedOrder}
        autoPrint={true}
      />
    </div>
  );
};