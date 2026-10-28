import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { SearchableSelect } from '../components/ui/searchable-select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../components/ui/dialog';
import { Drawer, DrawerContent } from '../components/ui/drawer';
import { TooltipSimple } from '../components/ui/tooltip';
import { AnimatedInlineQtyInput } from '../components/pos/AnimatedInlineQtyInput';
import { ProductPreviewModal } from '../components/pos/ProductPreviewModal';
import { ReturnSplitModal } from '../components/pos/ReturnSplitModal';
import { SalesRepCommissionCard } from '../components/pos/SalesRepCommissionCard';
import { get, post, put, downloadBlob } from '../lib/api';
import { toast } from 'react-toastify';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import {
  ArrowLeft,
  ShoppingCart,
  Plus,
  Trash2,
  Save,
  Loader2,
  User,
  Building,
  UserCheck,
  Package,
  ChevronLeft,
  ChevronRight,
  Search,
  Barcode,
  X,
  Eye,
  Percent,
  Minus,
  ArrowRightCircle,
  UserPlus,
  CheckCircle2,
  FileDown,
  MessageSquare,
  RotateCcw,
  Pencil,
} from 'lucide-react';
import { openWhatsAppChat, generateSalesOrderWhatsAppMessage } from '../utils/whatsapp';
import { resolveImageUrl, handleImageError } from '../utils/imageUrl';
import { isValidSriLankanPhone, isValidSriLankanNIC } from '../utils/validators';

interface CatalogVariantItem {
  id: number;
  productId: number;
  productName: string;
  size: string | null;
  color: string | null;
  sku: string;
  barcode: string | null;
  stock: number;
  wholesalePrice: number;
  retailPrice: number;
  imageUrl: string;
  product: {
    id?: number;
    name?: string;
    searchKey?: string | null;
    category?: { name: string };
    images?: { imageUrl: string }[];
  };
}

interface OrderCartItem {
  variantId: number;
  productId?: number;
  productName: string;
  variantName?: string;
  size: string;
  color: string;
  sku: string;
  imageUrl?: string;
  unitPrice: number;
  quantity: number;
  maxStock: number;
  discountType: 'PERCENT' | 'FIXED';
  discountInput: number | '';
  discount: number;
  showDiscount?: boolean;
  notes?: string;
  isReturn?: boolean;
  returnReason?: 'UNSOLD' | 'DAMAGED';
}

interface CustomerRecord {
  id: number;
  name: string;
  phone: string;
  address?: string;
  city?: string;
  outstandingBalance?: number;
  repId?: number;
  rep?: { id: number; name: string };
}

/**
 * OrderCreatePage Component
 *
 * Modernized Presales Order Creation Flow for Sales Representatives (REP) & Admin:
 * - Replaces legacy row-by-row table forms with high-density Product Catalog Card Grid.
 * - Flawless 3-column tablet grid (`grid-cols-3`) with zero horizontal overflow or shifting.
 * - Bottom Cart Drawer handles complete order finalization on mobile/tablet viewports.
 * - Pure presales workflow: omits invoice-specific payment tenders (cash/cheque/partial),
 *   while preserving exact customer ledger scoping, quantity adjustments, and dual-mode discounts.
 */
export const OrderCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editOrderId = searchParams.get('editOrderId');
  const editInvoiceId = searchParams.get('editInvoiceId');
  const activeEditId = editOrderId || editInvoiceId;
  const isReturnOrderMode = searchParams.get('mode') === 'return';

  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  const { user, isRep } = useAuth();
  const isRepUser = isRep || user?.role === 'REP';

  // Default billing mode / order source: Wholesale by default unless explicitly overridden
  const [billingMode, setBillingMode] = useState<'WHOLESALE' | 'RETAIL'>(() => {
    if (isRepUser) return 'WHOLESALE';
    const modeParam = searchParams.get('mode')?.toUpperCase();
    if (modeParam === 'RETAIL') return 'RETAIL';
    if (modeParam === 'WHOLESALE') return 'WHOLESALE';
    const tierParam = searchParams.get('tier')?.toLowerCase();
    if (tierParam === 'r') return 'RETAIL';
    if (tierParam === 'w') return 'WHOLESALE';
    return 'WHOLESALE';
  });

  // Mode and edit state
  const [isEditMode, setIsEditMode] = useState<boolean>(Boolean(editOrderId || editInvoiceId));
  const [editingOrderNumber, setEditingOrderNumber] = useState<string>('');
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [savedRefundedCashAmount, setSavedRefundedCashAmount] = useState<number>(0);

  // Return splitting modal state
  const [splitModalOpen, setSplitModalOpen] = useState<boolean>(false);
  const [splittingItemIndex, setSplittingItemIndex] = useState<number | null>(null);

  // Prerequisite Data
  const [catalogVariants, setCatalogVariants] = useState<CatalogVariantItem[]>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [loadingPrereqs, setLoadingPrereqs] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Search & Scanner states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Pagination for catalog grid (3x3 symmetrical layout in 3-column tablet mode)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 9;

  // Active Cart State
  const [cart, setCart] = useState<OrderCartItem[]>([]);
  const [editingQtyIndex, setEditingQtyIndex] = useState<number | null>(null);
  const [tempQtyInput, setTempQtyInput] = useState<string>('');
  const [editingPriceIndex, setEditingPriceIndex] = useState<number | null>(null);
  const [tempPriceInput, setTempPriceInput] = useState<string>('');

  // Customer Mode & Selection
  const [customerMode, setCustomerMode] = useState<'registered' | 'guest'>('registered');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | ''>('');
  const [guestName, setGuestName] = useState<string>('');
  const [guestPhone, setGuestPhone] = useState<string>('');
  const [guestAddress, setGuestAddress] = useState<string>('');
  const [guestCity, setGuestCity] = useState<string>('');

  // Dual-mode Overall Order Discount (% vs Rs)
  const [discountType, setDiscountType] = useState<'FIXED' | 'PERCENT'>('PERCENT');
  const [discountInput, setDiscountInput] = useState<number | ''>('');
  const [orderNotes, setOrderNotes] = useState<string>('');

  // Preview Modal & Mobile Drawer
  const [previewVariant, setPreviewVariant] = useState<any | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState<boolean>(false);
  const [mobileCartOpen, setMobileCartOpen] = useState<boolean>(false);

  // Quick Customer Registration Modal state
  const [customerModalOpen, setCustomerModalOpen] = useState<boolean>(false);
  const [newCustName, setNewCustName] = useState<string>('');
  const [newCustPhone, setNewCustPhone] = useState<string>('');
  const [newCustType, setNewCustType] = useState<'RETAIL' | 'WHOLESALE'>('WHOLESALE');
  const [newCustAddress, setNewCustAddress] = useState<string>('');
  const [newCustNic, setNewCustNic] = useState<string>('');
  const [newCustCreditLimit, setNewCustCreditLimit] = useState<string>('');
  const [newCustNotes, setNewCustNotes] = useState<string>('');
  const [newCustOutstandingBalance, setNewCustOutstandingBalance] = useState<string>('');
  const [creatingCustomer, setCreatingCustomer] = useState<boolean>(false);

  // Post-submit success dialog
  const [createdOrder, setCreatedOrder] = useState<any | null>(null);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState<boolean>(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);

  /**
   * Helper to accurately compute line item discount based on active mode (% vs Rs)
   */
  const calculateItemDiscount = (
    price: number,
    qty: number,
    type: 'FIXED' | 'PERCENT' = 'FIXED',
    inputVal: number | '' = ''
  ): number => {
    const gross = (Number(price) || 0) * (Number(qty) || 0);
    const num = Number(inputVal);
    if (isNaN(num) || num <= 0 || gross <= 0) return 0;
    if (type === 'PERCENT') {
      const pct = Math.min(100, Math.max(0, num));
      return Math.round((gross * pct) / 100);
    }
    return Math.min(gross, Math.max(0, num));
  };

  /**
   * Load catalog and customer database
   */
  useEffect(() => {
    let isMounted = true;
    const loadPrerequisites = async () => {
      try {
        setLoadingPrereqs(true);
        const [catData, custData] = await Promise.all([
          get<any[]>('/orders/catalog'),
          get<any[]>('/customers'),
        ]);

        if (!isMounted) return;

        // Transform catalog to CatalogVariantItem preserving SKU, barcode, and wholesale rates
        if (Array.isArray(catData)) {
          const mapped: CatalogVariantItem[] = catData.map((v) => {
            const prod = v.product || {};
            const img =
              v.imageUrl ||
              v.images?.[0]?.imageUrl ||
              prod.images?.[0]?.imageUrl ||
              '';
            return {
              id: v.id,
              productId: prod.id || 0,
              productName: prod.name || 'Product',
              size: v.size || null,
              color: v.color || null,
              sku: v.sku || '',
              barcode: v.barcode || null,
              stock: v.stock || 0,
              wholesalePrice: Number(v.wholesalePrice) || Number(v.retailPrice) || 0,
              retailPrice: Number(v.retailPrice) || 0,
              imageUrl: img,
              product: prod,
            };
          });
          setCatalogVariants(mapped);
        }

        // Map customer records
        if (Array.isArray(custData)) {
          setCustomers(
            custData.map((c) => ({
              id: c.id,
              name: c.name,
              phone: c.phone || '',
              address: c.address || '',
              city: c.city || '',
              outstandingBalance: Number(c.outstandingBalance) || 0,
              repId: c.repId,
              rep: c.rep || undefined,
            }))
          );
        }
      } catch (err: any) {
        console.error('Failed to load order prerequisites:', err);
        toast.error('Failed to load product catalog or customers');
      } finally {
        if (isMounted) setLoadingPrereqs(false);
      }
    };

    loadPrerequisites();
    return () => {
      isMounted = false;
    };
  }, []);

  /**
   * Load existing order data if in edit mode (editOrderId or editInvoiceId query parameter)
   */
  useEffect(() => {
    if (!activeEditId) return;
    let isMounted = true;

    const loadOrderToEdit = async () => {
      try {
        const order = editInvoiceId
          ? await get<any>(`/orders/invoices/${editInvoiceId}`)
          : await get<any>(`/sales-orders/${editOrderId}`);
        if (!isMounted || !order) return;

        setIsEditMode(true);
        setEditingOrder(order);
        setEditingOrderNumber(order.invoiceNumber || order.orderNumber || (editInvoiceId ? `INV-${order.id}` : `ORD-${order.id}`));
        if (order.source === 'POS_RETAIL' || order.orderType === 'RETAIL') {
          setBillingMode('RETAIL');
        } else if (order.source === 'POS_WHOLESALE' || order.orderType === 'WHOLESALE') {
          setBillingMode('WHOLESALE');
        }
        setSavedRefundedCashAmount(Number(order.refundedCashAmount) || 0);

        // 1. Populate Customer Mode & details
        if (order.customerId) {
          setCustomerMode('registered');
          setSelectedCustomerId(order.customerId);
        } else {
          setCustomerMode('guest');
          setGuestName(order.customerName || '');
          setGuestPhone(order.customerPhone || '');
          setGuestAddress(order.customerAddress || order.shippingAddress || '');
          setGuestCity(order.customerCity || order.city || '');
        }

        // 2. Populate Notes & Structured Metadata
        let parsedNotes: any = null;
        const rawNotes = order.notes || '';
        if (typeof rawNotes === 'string' && rawNotes.trim().startsWith('{')) {
          try {
            parsedNotes = JSON.parse(rawNotes);
            setOrderNotes(parsedNotes.userNotes || '');
          } catch {
            setOrderNotes(rawNotes);
          }
        } else {
          setOrderNotes(rawNotes);
        }

        // 3. Populate Cart Items with preserved discount modes and values
        if (Array.isArray(order.items) && order.items.length > 0) {
          setCart(
            order.items.map((it: any, idx: number) => {
              const metaDisc = parsedNotes?.itemDiscounts?.[idx];
              const discType: 'FIXED' | 'PERCENT' = (it.discountType as any) || metaDisc?.discountType || 'FIXED';
              const discVal = Number(it.discount) || 0;
              const discInput = it.discountInput ?? metaDisc?.discountInput ?? (discVal > 0 ? discVal : '');
              const sizeVal = it.size || it.selectedSize || it.variant?.size || 'FREE';
              const colorVal = it.color || it.selectedColor || it.variant?.color || 'Default';
              const isItemReturn = Boolean(it.isReturn || Number(it.price) < 0 || Number(it.unitPrice) < 0 || Number(it.quantity) < 0);
              const returnReason = it.returnReason || (parsedNotes?.itemReturnReasons?.[idx]) || 'UNSOLD';

              return {
                variantId: Number(it.variantId || it.variant?.id || 0),
                productId: Number(it.productId || it.variant?.productId || 0),
                productName: it.productName || it.variant?.product?.name || 'Garment Item',
                variantName: it.variantName || `${sizeVal} / ${colorVal}`,
                size: sizeVal,
                color: colorVal,
                sku: it.sku || it.variant?.sku || '',
                imageUrl: it.imageUrl || it.variant?.product?.images?.[0]?.imageUrl || '',
                unitPrice: Math.abs(Number(it.unitPrice) || 0),
                quantity: Math.abs(Number(it.quantity)) || 1,
                maxStock: Math.max(Math.abs(Number(it.quantity)) || 1, Number(it.variant?.stock || 0)),
                discountType: discType,
                discountInput: discInput,
                discount: discVal,
                showDiscount: discVal > 0,
                notes: it.notes || '',
                isReturn: isItemReturn,
                returnReason: isItemReturn ? returnReason : undefined,
              };
            })
          );
        }

        // 4. Populate Order Level Discount with exact financial hydration
        if (order.discountType || (parsedNotes?.discountType && parsedNotes?.discountInput !== undefined && parsedNotes.discountInput !== '')) {
          const dt = order.discountType === 'PERCENT' || parsedNotes?.discountType === 'PERCENT' ? 'PERCENT' : 'FIXED';
          setDiscountType(dt);
          const dv = order.discountValue !== undefined && Number(order.discountValue) > 0
            ? Number(order.discountValue)
            : parsedNotes?.discountInput !== undefined && parsedNotes.discountInput !== ''
            ? Number(parsedNotes.discountInput)
            : Number(order.discount || 0);
          setDiscountInput(dv > 0 ? dv : '');
        } else {
          const existingDisc = Number(order.discount) || 0;
          if (existingDisc > 0) {
            setDiscountType('FIXED');
            setDiscountInput(existingDisc);
          } else {
            setDiscountType('PERCENT');
            setDiscountInput('');
          }
        }

        toast.info(`Loaded ${editInvoiceId ? 'Invoice' : 'Presales Order'} ${order.invoiceNumber || order.orderNumber || `#${order.id}`} in Edit Mode`);
      } catch (err: any) {
        console.error('Failed to load order for editing:', err);
        toast.error(err.message || 'Failed to load order details for editing');
      }
    };

    loadOrderToEdit();

    return () => {
      isMounted = false;
    };
  }, [activeEditId, editInvoiceId, editOrderId]);

  /**
   * Selected registered customer helper memo:
   * Resolves active CustomerRecord by ID or returns null for guest/unselected states.
   */
  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerId || customerMode === 'guest') return null;
    return customers.find((c) => c.id === Number(selectedCustomerId)) || null;
  }, [customers, selectedCustomerId, customerMode]);

  /**
   * Outstanding previous due balance for selected customer ledger
   */
  const previousDue = useMemo(() => {
    if (!selectedCustomer) return 0;
    const custTotal = Number(selectedCustomer.outstandingBalance || 0);
    if (isEditMode && editInvoiceId && editingOrder && String(editingOrder.customerId) === String(selectedCustomerId)) {
      const origTot = Number(editingOrder.totalAmount || 0);
      const origPd = Number(editingOrder.paidAmount || 0);
      const origUnpaid = origTot < 0 ? origTot : Math.max(0, origTot - origPd);
      return Math.round((custTotal - origUnpaid) * 100) / 100;
    }
    return Math.round(custTotal * 100) / 100;
  }, [selectedCustomer, isEditMode, editInvoiceId, editingOrder, selectedCustomerId]);

  /**
   * Customer options mapped for top header SearchableSelect dropdown
   */
  const customerSelectOptions = useMemo(() => {
    return [
      { value: 'guest', label: 'Walk-in / Guest Customer' },
      ...customers.map((c) => {
        const due = Number(c.outstandingBalance || 0);
        return {
          value: String(c.id),
          label: `${c.name} (${c.phone || 'No phone'})${due > 0 ? ` · Due: Rs. ${due.toLocaleString()}` : ''}`,
        };
      }),
    ];
  }, [customers]);

  /**
   * Handle Customer selection from top header or sidebar
   */
  const handleCustomerSelect = (val: string) => {
    if (val === 'guest' || val === 'walk-in' || !val) {
      setCustomerMode('guest');
      setSelectedCustomerId('');
    } else {
      setCustomerMode('registered');
      setSelectedCustomerId(Number(val));
    }
  };

  /**
   * Universal Global Product Search Filter:
   * Inspects each catalog variant and matches search queries against product name, SKU, or barcode.
   * Fully case-insensitive and whitespace-trimmed to guarantee instant real-time filtering
   * across barcode scans, alphanumeric SKUs, and partial garment titles.
   */
  const filteredCatalog = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return catalogVariants;
    return catalogVariants.filter((v) => {
      const nameMatch = v.productName ? v.productName.toLowerCase().includes(q) : false;
      const skuMatch = v.sku ? v.sku.toLowerCase().includes(q) : false;
      const barcodeMatch = v.barcode ? v.barcode.toLowerCase().includes(q) : false;
      const searchKeyMatch = v.product?.searchKey ? v.product.searchKey.toLowerCase().includes(q) : false;
      const sizeMatch = v.size ? v.size.toLowerCase().includes(q) : false;
      const colorMatch = v.color ? v.color.toLowerCase().includes(q) : false;
      return nameMatch || skuMatch || barcodeMatch || searchKeyMatch || sizeMatch || colorMatch;
    });
  }, [catalogVariants, searchQuery]);

  const totalPages = Math.ceil(filteredCatalog.length / itemsPerPage) || 1;
  const paginatedCatalog = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredCatalog.slice(start, start + itemsPerPage);
  }, [filteredCatalog, currentPage]);

  // Reset pagination on query change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  /**
   * Retrieve current quantity of variant in active cart
   */
  const getVariantCartQty = (variantId: number): number => {
    return cart.find((i) => i.variantId === variantId)?.quantity || 0;
  };

  /**
   * Add variant directly to cart (increments quantity or initializes item)
   */
  const addItemToCart = (variant: CatalogVariantItem, qtyToAdd: number = 1) => {
    if (variant.stock <= 0 && !isReturnOrderMode) {
      toast.error(`"${variant.productName}" is out of stock`);
      return;
    }

    setCart((prev) => {
      const existingIndex = prev.findIndex((i) => i.variantId === variant.id && (isReturnOrderMode ? i.isReturn : !i.isReturn));
      const defaultPrice = Number(
        billingMode === 'RETAIL'
          ? (variant.retailPrice || variant.wholesalePrice || 0)
          : (variant.wholesalePrice || variant.retailPrice || 0)
      );

      if (existingIndex > -1) {
        const next = [...prev];
        const existing = next[existingIndex];
        const newQty = existing.quantity + qtyToAdd;
        if (newQty > variant.stock && !isReturnOrderMode) {
          toast.warn(`Only ${variant.stock} available in stock for "${variant.productName}"`);
          return prev;
        }
        const updatedDisc = calculateItemDiscount(
          existing.unitPrice,
          newQty,
          existing.discountType,
          existing.discountInput
        );
        next[existingIndex] = {
          ...existing,
          quantity: newQty,
          discount: updatedDisc,
        };
        return next;
      } else {
        return [
          ...prev,
          {
            variantId: variant.id,
            productId: variant.productId,
            productName: variant.productName,
            variantName: `${variant.size || 'FREE'} / ${variant.color || 'Default'}`,
            size: variant.size || 'FREE',
            color: variant.color || 'Default',
            sku: variant.sku,
            imageUrl: variant.imageUrl,
            unitPrice: defaultPrice,
            quantity: qtyToAdd,
            maxStock: Math.max(qtyToAdd, variant.stock),
            discountType: 'FIXED',
            discountInput: '',
            discount: 0,
            showDiscount: false,
            isReturn: isReturnOrderMode,
            returnReason: isReturnOrderMode ? 'UNSOLD' : undefined,
          },
        ];
      }
    });
  };

  /**
   * Set specific quantity for variant in cart directly (synchronized with AnimatedInlineQtyInput)
   */
  const setVariantQuantity = (variant: CatalogVariantItem, targetQty: number) => {
    if (targetQty <= 0) {
      setCart((prev) => prev.filter((i) => i.variantId !== variant.id));
      return;
    }

    if (targetQty > variant.stock && !isReturnOrderMode) {
      toast.warn(`Only ${variant.stock} available in stock for "${variant.productName}"`);
      targetQty = variant.stock;
    }

    const defaultPrice = Number(
      billingMode === 'RETAIL'
        ? (variant.retailPrice || variant.wholesalePrice || 0)
        : (variant.wholesalePrice || variant.retailPrice || 0)
    );

    setCart((prev) => {
      const existingIndex = prev.findIndex((i) => i.variantId === variant.id && (isReturnOrderMode ? i.isReturn : !i.isReturn));
      if (existingIndex > -1) {
        const next = [...prev];
        const existing = next[existingIndex];
        const updatedDisc = calculateItemDiscount(
          existing.unitPrice,
          targetQty,
          existing.discountType,
          existing.discountInput
        );
        next[existingIndex] = {
          ...existing,
          quantity: targetQty,
          discount: updatedDisc,
        };
        return next;
      } else {
        return [
          ...prev,
          {
            variantId: variant.id,
            productId: variant.productId,
            productName: variant.productName,
            variantName: `${variant.size || 'FREE'} / ${variant.color || 'Default'}`,
            size: variant.size || 'FREE',
            color: variant.color || 'Default',
            sku: variant.sku,
            imageUrl: variant.imageUrl,
            unitPrice: defaultPrice,
            quantity: targetQty,
            maxStock: Math.max(targetQty, variant.stock),
            discountType: 'FIXED',
            discountInput: '',
            discount: 0,
            showDiscount: false,
            isReturn: isReturnOrderMode,
            returnReason: isReturnOrderMode ? 'UNSOLD' : undefined,
          },
        ];
      }
    });
  };

  /**
   * Helper to check if two cart items represent the identical product variant and price
   */
  const isSameCartVariant = (a: OrderCartItem, b: OrderCartItem) => {
    const sameVariantId = Number(a.variantId) > 0 && Number(a.variantId) === Number(b.variantId);
    const sameSku = Boolean(a.sku && b.sku && a.sku === b.sku);
    const sameName = Boolean(a.productName && b.productName && a.productName === b.productName && (a.size || '') === (b.size || '') && (a.color || '') === (b.color || ''));
    const sameVariant = sameVariantId || sameSku || sameName;
    const samePrice = Math.abs(Number(a.unitPrice) - Number(b.unitPrice)) < 0.05;
    return sameVariant && samePrice;
  };

  /**
   * Toggle cart item Return Mode or trigger partial quantity return split
   */
  const toggleItemReturn = (index: number) => {
    const item = cart[index];
    if (!item) return;

    if (item.isReturn) {
      // Toggle back to regular sale item
      setCart((prev) => {
        const next = [...prev];
        const target = next[index];
        if (!target) return prev;

        // Check if there is already an existing non-return (sale) line for the same variant
        const existingSaleIndex = next.findIndex(
          (i, idx) => idx !== index && !i.isReturn && isSameCartVariant(i, target)
        );

        if (existingSaleIndex !== -1) {
          // Immediately merge/add the quantity back into that original line item
          const existingSale = next[existingSaleIndex];
          const mergedQty = existingSale.quantity + target.quantity;
          const mergedDisc = calculateItemDiscount(existingSale.unitPrice, mergedQty, existingSale.discountType, existingSale.discountInput);
          next[existingSaleIndex] = {
            ...existingSale,
            quantity: mergedQty,
            discount: mergedDisc,
          };
          next.splice(index, 1);
          toast.info(`Merged ${target.quantity} return units back into ${target.productName}`);
        } else {
          const disc = calculateItemDiscount(target.unitPrice, target.quantity, target.discountType, target.discountInput);
          next[index] = { ...target, isReturn: false, returnReason: undefined, discount: disc };
        }
        return next;
      });
      return;
    }

    // Item is not return: check quantity
    if (item.quantity > 1) {
      setSplittingItemIndex(index);
      setSplitModalOpen(true);
    } else {
      // Single quantity: toggle directly to return
      setCart((prev) => {
        const next = [...prev];
        const target = next[index];
        if (!target) return prev;

        // Check if a return line for the same variant already exists
        const existingReturnIndex = next.findIndex(
          (i, idx) => idx !== index && i.isReturn && isSameCartVariant(i, target)
        );

        if (existingReturnIndex !== -1) {
          const existingReturn = next[existingReturnIndex];
          const mergedQty = existingReturn.quantity + target.quantity;
          const mergedDisc = calculateItemDiscount(existingReturn.unitPrice, mergedQty, existingReturn.discountType, existingReturn.discountInput);
          next[existingReturnIndex] = {
            ...existingReturn,
            quantity: mergedQty,
            discount: mergedDisc,
          };
          next.splice(index, 1);
        } else {
          const disc = calculateItemDiscount(target.unitPrice, target.quantity, target.discountType, target.discountInput);
          next[index] = { ...target, isReturn: true, returnReason: 'UNSOLD', discount: disc };
        }
        return next;
      });
    }
  };

  /**
   * Handle partial quantity return split confirmation with seamless merge
   */
  const handleConfirmReturnSplit = (returnQty: number, returnReason: 'UNSOLD' | 'DAMAGED') => {
    if (splittingItemIndex === null) return;
    const item = cart[splittingItemIndex];
    if (!item) return;

    const clampedReturnQty = Math.max(1, Math.min(item.quantity, returnQty));

    setCart((prev) => {
      const next = [...prev];
      const targetItem = next[splittingItemIndex];
      if (!targetItem) return prev;

      // Check if a return line item for this variant with the same unitPrice already exists
      const existingReturnIndex = next.findIndex(
        (i, idx) => idx !== splittingItemIndex && i.variantId === targetItem.variantId && i.isReturn && i.unitPrice === targetItem.unitPrice
      );

      if (clampedReturnQty >= targetItem.quantity) {
        if (existingReturnIndex !== -1) {
          const existing = next[existingReturnIndex];
          const mergedQty = existing.quantity + targetItem.quantity;
          const mergedDisc = calculateItemDiscount(existing.unitPrice, mergedQty, existing.discountType, existing.discountInput);
          next[existingReturnIndex] = {
            ...existing,
            quantity: mergedQty,
            discount: mergedDisc,
            returnReason,
          };
          next.splice(splittingItemIndex, 1);
        } else {
          next[splittingItemIndex] = {
            ...targetItem,
            isReturn: true,
            returnReason,
          };
        }
      } else {
        const keptQty = targetItem.quantity - clampedReturnQty;
        const keptDisc = calculateItemDiscount(targetItem.unitPrice, keptQty, targetItem.discountType, targetItem.discountInput);

        next[splittingItemIndex] = {
          ...targetItem,
          quantity: keptQty,
          discount: keptDisc,
          isReturn: false,
        };

        if (existingReturnIndex !== -1) {
          const existing = next[existingReturnIndex];
          const mergedQty = existing.quantity + clampedReturnQty;
          const mergedDisc = calculateItemDiscount(existing.unitPrice, mergedQty, existing.discountType, existing.discountInput);
          next[existingReturnIndex] = {
            ...existing,
            quantity: mergedQty,
            discount: mergedDisc,
          };
        } else {
          const returnDisc = calculateItemDiscount(targetItem.unitPrice, clampedReturnQty, targetItem.discountType, targetItem.discountInput);
          const returnLineItem: OrderCartItem = {
            ...targetItem,
            quantity: clampedReturnQty,
            discount: returnDisc,
            isReturn: true,
            returnReason,
            showDiscount: returnDisc > 0,
          };
          next.splice(splittingItemIndex + 1, 0, returnLineItem);
        }
      }
      return next;
    });

    setSplitModalOpen(false);
    setSplittingItemIndex(null);
  };

  /**
   * Change Return Reason condition (UNSOLD vs DAMAGED) for a return item
   */
  const handleItemReturnReasonChange = (index: number, reason: 'UNSOLD' | 'DAMAGED') => {
    setCart((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { ...next[index], returnReason: reason };
      }
      return next;
    });
  };

  /**
   * Apply edited direct price to cart item
   */
  const handleApplyDirectPrice = (itemIndex: number) => {
    const rawVal = parseFloat(tempPriceInput.trim());
    const targetItem = cart[itemIndex];
    if (!targetItem) {
      setEditingPriceIndex(null);
      return;
    }
    if (!isNaN(rawVal) && rawVal >= 0) {
      const updatedDisc = calculateItemDiscount(rawVal, targetItem.quantity, targetItem.discountType, targetItem.discountInput);
      setCart((prev) =>
        prev.map((i, idx) => (idx === itemIndex ? { ...i, unitPrice: rawVal, discount: updatedDisc } : i))
      );
    }
    setEditingPriceIndex(null);
    setTempPriceInput('');
  };

  /**
   * Barcode scanner handler for exact barcode or SKU match
   */
  const handleBarcodeScan = (e: React.FormEvent) => {
    e.preventDefault();
    const query = barcodeInput.trim().toUpperCase();
    if (!query) return;

    const matched = catalogVariants.find(
      (v) => (v.barcode && v.barcode.toUpperCase() === query) || v.sku.toUpperCase() === query
    );

    if (matched) {
      addItemToCart(matched, 1);
      toast.success(`Scanned: ${matched.productName}`);
      setBarcodeInput('');
    } else {
      toast.warn(`No product found matching barcode "${query}"`);
    }
  };

  /**
   * Cart item stepper controls
   */
  const updateCartItemQty = (index: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item, idx) => {
          if (idx === index) {
            const nextQty = item.quantity + delta;
            if (nextQty > item.maxStock) {
              toast.warn(`Only ${item.maxStock} in stock`);
              return item;
            }
            if (nextQty > 0) {
              const updatedDisc = calculateItemDiscount(
                item.unitPrice,
                nextQty,
                item.discountType,
                item.discountInput
              );
              return { ...item, quantity: nextQty, discount: updatedDisc };
            }
            return null;
          }
          return item;
        })
        .filter(Boolean) as OrderCartItem[]
    );
  };

  /**
   * Direct numeric inline quantity input apply
   */
  const handleApplyDirectCartQty = (index: number) => {
    const parsed = parseFloat(tempQtyInput);
    if (!isNaN(parsed) && parsed > 0) {
      setCart((prev) => {
        const next = [...prev];
        const item = next[index];
        if (item) {
          const clamped = Math.min(item.maxStock, parsed);
          if (clamped < parsed) {
            toast.warn(`Only ${item.maxStock} available in stock`);
          }
          const updatedDisc = calculateItemDiscount(
            item.unitPrice,
            clamped,
            item.discountType,
            item.discountInput
          );
          next[index] = { ...item, quantity: clamped, discount: updatedDisc };
        }
        return next;
      });
    }
    setEditingQtyIndex(null);
  };

  const removeFromCart = (index: number) => {
    setCart((prev) => {
      const target = prev[index];
      if (!target) return prev;

      // If removing a RETURN row that was split from a sale item, auto-merge quantity back into original line
      if (target.isReturn) {
        const existingSaleIndex = prev.findIndex(
          (i, idx) => idx !== index && !i.isReturn && isSameCartVariant(i, target)
        );
        if (existingSaleIndex !== -1) {
          const next = [...prev];
          const existingSale = next[existingSaleIndex];
          const mergedQty = existingSale.quantity + target.quantity;
          const mergedDisc = calculateItemDiscount(
            existingSale.unitPrice,
            mergedQty,
            existingSale.discountType,
            existingSale.discountInput
          );
          next[existingSaleIndex] = {
            ...existingSale,
            quantity: mergedQty,
            discount: mergedDisc,
          };
          next.splice(index, 1);
          toast.info(`Merged ${target.quantity} return units back into ${target.productName}`);
          return next;
        }
      }

      return prev.filter((_, idx) => idx !== index);
    });
  };

  /**
   * Item-level discount controls (% vs Rs)
   */
  const toggleItemDiscount = (index: number) => {
    setCart((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { ...next[index], showDiscount: !next[index].showDiscount };
      }
      return next;
    });
  };

  const handleItemDiscountTypeChange = (index: number, type: 'PERCENT' | 'FIXED') => {
    setCart((prev) => {
      const next = [...prev];
      const item = next[index];
      if (!item) return prev;
      const currentInput = item.discountInput !== '' ? Number(item.discountInput) : '';
      const updatedDisc = calculateItemDiscount(item.unitPrice, item.quantity, type, currentInput);
      next[index] = {
        ...item,
        discountType: type,
        discount: updatedDisc,
      };
      return next;
    });
  };

  const handleItemDiscountInputChange = (index: number, valStr: string) => {
    setCart((prev) => {
      const next = [...prev];
      const item = next[index];
      if (!item) return prev;
      let type = item.discountType || 'FIXED';
      let cleanStr = valStr.trim();
      if (cleanStr.includes('%')) {
        type = 'PERCENT';
        cleanStr = cleanStr.replace(/%/g, '');
      }
      if (cleanStr === '') {
        next[index] = { ...item, discountType: type, discountInput: '', discount: 0 };
        return next;
      }
      const num = parseFloat(cleanStr);
      if (isNaN(num)) {
        next[index] = { ...item, discountType: type, discountInput: '', discount: 0 };
        return next;
      }
      const sanitized = type === 'PERCENT' ? Math.min(100, Math.max(0, num)) : Math.max(0, num);
      const updatedDisc = calculateItemDiscount(item.unitPrice, item.quantity, type, sanitized);
      next[index] = {
        ...item,
        discountType: type,
        discountInput: sanitized,
        discount: updatedDisc,
      };
      return next;
    });
  };

  /**
   * Advanced Return Discount Calculation & Financial Summary
   * - Kept items retain their full proportion of item & bill discounts.
   * - Returned items have their item discount deducted and proportionally deduct their share
   *   of the global bill discount, crediting the customer the exact net unit price originally paid.
   * - Formula: Net Return Credit = (Returned Qty * Unit Price) - ((Returned Qty * Unit Price) * Global Bill Discount %)
   *   Example: For 25 items at Rs. 2,090 with a 5% global bill discount: 52,250 - (52,250 * 0.05) = 49,637.50.
   */
  const {
    grossSaleSubtotal,
    saleItemDiscounts,
    netSaleBeforeBill,
    grossReturnSubtotal,
    returnItemDiscounts,
    netReturnBeforeBill,
    saleBillDiscount,
    returnBillDiscountDeduction,
    effectiveReturnCredit,
    effectiveNetSale,
    numericOrderDiscount,
    calculatedTotalAmount,
  } = useMemo(() => {
    const saleItems = cart.filter((i) => !i.isReturn);
    const returnItems = cart.filter((i) => Boolean(i.isReturn));

    const grossSale = saleItems.reduce((acc, i) => acc + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
    const saleDisc = saleItems.reduce((acc, i) => acc + (Number(i.discount) || 0), 0);
    const netSale = Math.max(0, grossSale - saleDisc);

    const grossReturn = returnItems.reduce((acc, i) => acc + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
    const returnDisc = returnItems.reduce((acc, i) => acc + (Number(i.discount) || 0), 0);
    const netReturn = Math.max(0, grossReturn - returnDisc);

    let saleBill = 0;
    let returnBillDiscountShare = 0;
    const rawBillDisc = Number(discountInput) || 0;
    if (rawBillDisc > 0) {
      if (discountType === 'PERCENT') {
        const p = Math.min(100, Math.max(0, rawBillDisc));
        saleBill = Math.round((netSale * p) / 100);
        returnBillDiscountShare = Math.round((netReturn * p) / 100);
      } else {
        const totalNet = netSale + netReturn;
        const effectiveRate = totalNet > 0 ? (rawBillDisc / totalNet) : 0;
        saleBill = Math.min(netSale, Math.round(netSale * effectiveRate));
        returnBillDiscountShare = Math.round(netReturn * effectiveRate);
      }
    } else if (editingOrder) {
      const origSub = Number(editingOrder.subtotal || 0);
      const origDisc = Number(editingOrder.discount || 0);
      let origPct = 0;
      if (editingOrder.discountType === 'PERCENT' && Number(editingOrder.discountValue) > 0) {
        origPct = Number(editingOrder.discountValue);
      } else if (origSub > 0 && origDisc > 0) {
        origPct = (origDisc / origSub) * 100;
      }
      if (origPct > 0) {
        returnBillDiscountShare = Math.round((netReturn * origPct) / 100);
      }
    }

    // Formula: Net Return Credit = (Returned Qty * Unit Price) - ((Returned Qty * Unit Price) * Global Bill Discount %)
    // Shop retains: returnDisc (item discount on returned units) + returnBillDiscountShare (bill discount share).
    const discountRecoveredByShop = returnDisc + returnBillDiscountShare;
    const effReturn = Math.max(0, grossReturn - discountRecoveredByShop);
    const effSale = Math.max(0, netSale - saleBill);
    const total = effSale - effReturn;

    return {
      grossSaleSubtotal: grossSale,
      saleItemDiscounts: saleDisc,
      netSaleBeforeBill: netSale,
      grossReturnSubtotal: grossReturn,
      returnItemDiscounts: returnDisc,
      netReturnBeforeBill: netReturn,
      saleBillDiscount: saleBill,
      returnBillDiscountDeduction: returnBillDiscountShare,
      discountRecoveredByShop,
      effectiveReturnCredit: effReturn,
      effectiveNetSale: effSale,
      numericOrderDiscount: saleBill,
      calculatedTotalAmount: total,
    };
  }, [cart, discountInput, discountType, editingOrder]);

  const grossSubtotal = grossSaleSubtotal;
  const calculatedItemTotalDiscount = saleItemDiscounts;
  const calculatedSubtotal = netSaleBeforeBill;

  // When return is processed on Credit (registered customer or credit invoice), do NOT prompt cash refund
  const isCreditReturn = Boolean(
    editingOrder?.paymentMethod === 'CREDIT' ||
    (customerMode === 'registered' && selectedCustomer)
  );

  const isNetCredit = calculatedTotalAmount < 0;
  const netCreditValue = isNetCredit ? Math.abs(calculatedTotalAmount) : 0;
  const liveCashRefundAmount = (!isCreditReturn && netCreditValue > 0)
    ? (previousDue <= 0 ? netCreditValue : Math.max(0, netCreditValue - previousDue))
    : 0;
  const cashRefundAmount = isCreditReturn ? 0 : (liveCashRefundAmount > 0 ? liveCashRefundAmount : savedRefundedCashAmount);

  // Total Accumulated Credit Due = Previous Due (Old Bills) + Current Net Bill Due - Paid for Current Bill
  // Signed arithmetic without clamping allows negative return credits to offset previous customer receivables.
  const currentNetBillDue = isNetCredit
    ? (isCreditReturn || billingMode === 'WHOLESALE' ? calculatedTotalAmount : calculatedTotalAmount)
    : Math.max(0, calculatedTotalAmount);
  const totalAccumulatedDue = Math.round((previousDue + currentNetBillDue) * 100) / 100;

  /**
   * Sales Rep Settlement & Commission Breakdown calculation
   */
  const repCommissionData = useMemo(() => {
    const repObj =
      selectedCustomer?.rep ||
      (editingOrder?.user?.role === 'REP' ? editingOrder.user : null) ||
      (isRepUser ? user : null);

    if (!repObj) return null;

    const commissionRate = 0.05; // 5% wholesale rep commission standard
    const initialBase = effectiveNetSale + effectiveReturnCredit;
    const initialEarning = Math.round(initialBase * commissionRate);
    const returnDeduction = Math.round(effectiveReturnCredit * commissionRate);
    const netRepPayable = Math.max(0, initialEarning - returnDeduction);

    return {
      repName: repObj.name || 'Assigned Rep',
      commissionRatePct: 5,
      initialEarning,
      returnDeduction,
      netRepPayable,
    };
  }, [selectedCustomer, editingOrder, isRepUser, user, effectiveNetSale, effectiveReturnCredit]);

  const totalPiecesQuantity = useMemo(() => {
    return cart.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
  }, [cart]);

  /**
   * Overall Order Discount (% vs Rs) Mode Toggle
   */
  const handleDiscountTypeToggle = (nextType: 'FIXED' | 'PERCENT') => {
    if (discountType === nextType) return;
    if (nextType === 'PERCENT') {
      if (calculatedSubtotal > 0 && numericOrderDiscount > 0) {
        const rawPct = (numericOrderDiscount / calculatedSubtotal) * 100;
        const roundedPct = parseFloat(rawPct.toFixed(1));
        const clampedPct = Math.min(100, Math.max(0, roundedPct));
        setDiscountType('PERCENT');
        setDiscountInput(clampedPct);
      } else {
        setDiscountType('PERCENT');
        setDiscountInput('');
      }
    } else {
      if (calculatedSubtotal > 0 && numericOrderDiscount > 0) {
        const fixedAmt = Math.min(calculatedSubtotal, Math.round(numericOrderDiscount));
        setDiscountType('FIXED');
        setDiscountInput(fixedAmt);
      } else {
        setDiscountType('FIXED');
        setDiscountInput('');
      }
    }
  };

  const handleTotalDiscountChange = (valStr: string) => {
    const trimmed = valStr.trim();
    if (trimmed === '') {
      setDiscountInput('');
      return;
    }
    let activeType = discountType;
    let cleanStr = trimmed;
    if (trimmed.includes('%')) {
      activeType = 'PERCENT';
      setDiscountType('PERCENT');
      cleanStr = cleanStr.replace(/%/g, '');
    }
    const num = parseFloat(cleanStr);
    if (isNaN(num)) {
      setDiscountInput('');
      return;
    }
    if (activeType === 'PERCENT') {
      setDiscountInput(Math.min(100, Math.max(0, num)));
    } else {
      setDiscountInput(Math.min(calculatedSubtotal, Math.max(0, num)));
    }
  };

  /**
   * Convert active order directly to Wholesale Invoice
   */
  const handleConvertToInvoice = () => {
    const validItems = cart.filter((item) => item.variantId && item.quantity > 0);
    if (validItems.length === 0) {
      toast.warn('Please add at least one product before converting to invoice');
      return;
    }

    let finalCustomerName = '';
    let finalCustomerPhone = '';
    let finalCustomerAddress = '';
    let finalCustomerCity = '';

    if (customerMode === 'registered') {
      if (selectedCustomerId && selectedCustomer) {
        finalCustomerName = selectedCustomer.name;
        finalCustomerPhone = selectedCustomer.phone;
        finalCustomerAddress = selectedCustomer.address || '';
        finalCustomerCity = selectedCustomer.city || '';
      }
    } else {
      finalCustomerName = guestName.trim();
      finalCustomerPhone = guestPhone.trim();
      finalCustomerAddress = guestAddress.trim();
      finalCustomerCity = guestCity.trim();
    }

    const orderData = {
      id: editOrderId ? Number(editOrderId) : undefined,
      orderNumber: editingOrderNumber || undefined,
      customerId: customerMode === 'registered' && selectedCustomerId ? Number(selectedCustomerId) : undefined,
      customer: selectedCustomer || undefined,
      customerName: finalCustomerName,
      customerPhone: finalCustomerPhone,
      customerAddress: finalCustomerAddress,
      customerCity: finalCustomerCity,
      subtotal: grossSubtotal,
      discount: calculatedItemTotalDiscount + numericOrderDiscount,
      discountType,
      discountInput,
      refundedCashAmount: liveCashRefundAmount,
      notes: JSON.stringify({
        userNotes: orderNotes.trim(),
        discountType,
        discountInput,
        itemDiscounts: validItems.map((item) => ({
          variantId: Number(item.variantId),
          discountType: item.discountType || 'FIXED',
          discountInput:
            item.discountInput !== undefined && item.discountInput !== ''
              ? item.discountInput
              : Number(item.discount) > 0
              ? Number(item.discount)
              : '',
          discount: Number(item.discount) || 0,
        })),
      }),
      items: validItems.map((item) => ({
        variantId: Number(item.variantId),
        productName: item.productName,
        variantName: item.variantName,
        sku: item.sku,
        imageUrl: item.imageUrl || undefined,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        isReturn: Boolean(item.isReturn),
        discountType: item.discountType || 'FIXED',
        discountInput:
          item.discountInput !== undefined && item.discountInput !== ''
            ? item.discountInput
            : Number(item.discount) > 0
            ? Number(item.discount)
            : '',
        discount: item.isReturn ? 0 : (Number(item.discount) || 0),
        totalPrice: item.isReturn
          ? -(Number(item.quantity) * Number(item.unitPrice))
          : Math.max(0, Number(item.quantity) * Number(item.unitPrice) - (Number(item.discount) || 0)),
        notes: item.notes || undefined,
      })),
    };

    const targetUrl = editOrderId
      ? `/system/quick-invoice?mode=${isReturnOrderMode ? 'return' : 'WHOLESALE'}&convertOrderId=${editOrderId}`
      : `/system/quick-invoice?mode=${isReturnOrderMode ? 'return' : 'WHOLESALE'}`;

    navigate(targetUrl, { state: { convertOrder: orderData } });
  };

  /**
   * Submit Order Handler (Create or Update)
   */
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    let finalCustomerName = '';
    let finalCustomerPhone = '';
    let finalCustomerAddress = '';
    let finalCustomerCity = '';

    if (customerMode === 'registered') {
      if (!selectedCustomerId || !selectedCustomer) {
        toast.warn('Please select a registered customer or switch to Guest Customer');
        setMobileCartOpen(true);
        return;
      }
      finalCustomerName = selectedCustomer.name;
      finalCustomerPhone = selectedCustomer.phone;
      finalCustomerAddress = selectedCustomer.address || '';
      finalCustomerCity = selectedCustomer.city || '';
    } else {
      if (!guestName.trim()) {
        toast.warn('Please enter the Guest Customer Name');
        setMobileCartOpen(true);
        return;
      }
      finalCustomerName = guestName.trim();
      finalCustomerPhone = guestPhone.trim();
      finalCustomerAddress = guestAddress.trim();
      finalCustomerCity = guestCity.trim();
    }

    const validItems = cart.filter((item) => item.variantId && item.quantity > 0);
    if (validItems.length === 0) {
      toast.warn('Please add at least one product to the order');
      return;
    }

    try {
      setIsSubmitting(true);

      const structuredNotes = JSON.stringify({
        userNotes: orderNotes.trim(),
        discountType,
        discountInput,
        itemDiscounts: validItems.map((item) => ({
          variantId: Number(item.variantId),
          discountType: item.discountType || 'FIXED',
          discountInput:
            item.discountInput !== undefined && item.discountInput !== ''
              ? item.discountInput
              : Number(item.discount) > 0
              ? Number(item.discount)
              : '',
          discount: Number(item.discount) || 0,
        })),
        itemReturnReasons: validItems.map((item) => item.returnReason || 'UNSOLD'),
      });

      const payload = {
        isReturnOrder: isReturnOrderMode || calculatedTotalAmount < 0,
        source: billingMode === 'WHOLESALE' ? 'POS_WHOLESALE' : 'POS_RETAIL',
        orderType: billingMode,
        customerId: customerMode === 'registered' && selectedCustomerId ? Number(selectedCustomerId) : undefined,
        customerName: finalCustomerName,
        customerPhone: finalCustomerPhone || undefined,
        customerAddress: finalCustomerAddress || undefined,
        customerCity: finalCustomerCity || undefined,
        shippingAddress: finalCustomerAddress || undefined,
        city: finalCustomerCity || undefined,
        subtotal: grossSubtotal,
        discount: calculatedItemTotalDiscount + numericOrderDiscount,
        discountType: discountType === 'PERCENT' ? 'PERCENT' : 'AMOUNT',
        discountValue: Number(discountInput) || 0,
        totalAmount: calculatedTotalAmount,
        refundedCashAmount: liveCashRefundAmount,
        notes: structuredNotes,
        items: validItems.map((item) => {
          const lineGross = Number(item.quantity) * Number(item.unitPrice);
          const lineItemDisc = Number(item.discount) || 0;
          const lineBillDiscShare = (discountType === 'PERCENT' && Number(discountInput) > 0)
            ? Math.round(((lineGross - lineItemDisc) * Number(discountInput)) / 100)
            : (returnBillDiscountDeduction > 0 && netReturnBeforeBill > 0
                ? Math.round(((lineGross - lineItemDisc) / netReturnBeforeBill) * returnBillDiscountDeduction)
                : 0);
          const lineTotalReclaimedDisc = lineItemDisc + lineBillDiscShare;
          const netReturnLine = Math.max(0, lineGross - lineTotalReclaimedDisc);

          return {
            variantId: Number(item.variantId),
            productName: item.productName,
            variantName: item.variantName,
            sku: item.sku,
            imageUrl: item.imageUrl || undefined,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            isReturn: Boolean(item.isReturn),
            returnReason: item.isReturn ? (item.returnReason || 'UNSOLD') : undefined,
            discount: item.isReturn ? lineTotalReclaimedDisc : lineItemDisc,
            discountType: item.discountType === 'PERCENT' ? 'PERCENT' : 'AMOUNT',
            discountValue: Number(item.discountInput) || 0,
            totalPrice: item.isReturn
              ? -netReturnLine
              : Math.max(0, lineGross - lineItemDisc),
            notes: item.notes || undefined,
          };
        }),
      };

      if (isEditMode && editInvoiceId) {
        const invoicePayload = {
          customerId: customerMode === 'registered' && selectedCustomerId ? Number(selectedCustomerId) : undefined,
          customerName: finalCustomerName,
          customerPhone: finalCustomerPhone || undefined,
          customerAddress: finalCustomerAddress || undefined,
          customerCity: finalCustomerCity || undefined,
          shippingAddress: finalCustomerAddress || undefined,
          city: finalCustomerCity || undefined,
          source: billingMode === 'WHOLESALE' ? 'POS_WHOLESALE' : 'POS_RETAIL',
          orderType: billingMode,
          subtotal: grossSubtotal,
          discount: calculatedItemTotalDiscount + numericOrderDiscount,
          discountType: discountType === 'PERCENT' ? 'PERCENT' : 'AMOUNT',
          discountValue: Number(discountInput) || 0,
          totalAmount: calculatedTotalAmount,
          refundedCashAmount: liveCashRefundAmount,
          notes: structuredNotes,
          items: validItems.map((item) => {
            const lineGross = Number(item.quantity) * Number(item.unitPrice);
            const lineItemDisc = Number(item.discount) || 0;
            const lineBillDiscShare = (discountType === 'PERCENT' && Number(discountInput) > 0)
              ? Math.round(((lineGross - lineItemDisc) * Number(discountInput)) / 100)
              : (returnBillDiscountDeduction > 0 && netReturnBeforeBill > 0
                  ? Math.round(((lineGross - lineItemDisc) / netReturnBeforeBill) * returnBillDiscountDeduction)
                  : 0);
            const lineTotalReclaimedDisc = lineItemDisc + lineBillDiscShare;
            const netReturnLine = Math.max(0, lineGross - lineTotalReclaimedDisc);

            return {
              variantId: Number(item.variantId),
              quantity: Number(item.quantity),
              unitPrice: Number(item.unitPrice),
              discount: item.isReturn ? lineTotalReclaimedDisc : lineItemDisc,
              discountType: item.discountType === 'PERCENT' ? 'PERCENT' : 'AMOUNT',
              discountValue: Number(item.discountInput) || 0,
              price: item.isReturn
                ? -netReturnLine
                : Math.max(0, lineGross - lineItemDisc),
              isReturn: Boolean(item.isReturn),
              returnReason: item.isReturn ? (item.returnReason || 'UNSOLD') : undefined,
            };
          }),
        };
        const updated = await put<any>(`/orders/invoices/${editInvoiceId}`, invoicePayload);
        setCreatedOrder(updated);
        setIsSuccessModalOpen(true);
        setMobileCartOpen(false);
        toast.success(`Invoice #${updated.invoiceNumber || updated.id} updated successfully!`);
      } else if (isEditMode && editOrderId) {
        const updated = await put<any>(`/sales-orders/${editOrderId}`, payload);
        setCreatedOrder(updated);
        setIsSuccessModalOpen(true);
        setMobileCartOpen(false);
        toast.success(`Presales Order ${updated.orderNumber || ''} updated successfully!`);
      } else {
        const created = await post<any>('/sales-orders', payload);
        setCreatedOrder(created);
        setIsSuccessModalOpen(true);
        setMobileCartOpen(false);
        toast.success(`Presales Order ${created.orderNumber || ''} created successfully!`);
      }
    } catch (err: any) {
      console.error('Order submission error:', err);
      toast.error(err.message || 'Failed to save sales order');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Quick Customer Registration Submit Handler
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
      const parsedBalance = newCustOutstandingBalance !== '' ? Number(newCustOutstandingBalance) : 0;
      const created = await post<any>('/customers', {
        name: newCustName.trim(),
        phone: newCustPhone.trim(),
        address: newCustAddress.trim() || undefined,
        nic: newCustNic.trim() || undefined,
        creditLimit: newCustCreditLimit ? Number(newCustCreditLimit) : 0,
        notes: newCustNotes.trim() || undefined,
        outstandingBalance: parsedBalance,
        // Silently default and enforce type: 'WHOLESALE' for Sales Representatives (REP)
        type: isRepUser ? 'WHOLESALE' : newCustType,
      });

      toast.success(`Customer "${created.name}" registered!`);
      const effectiveCustBal = Number(created.outstandingBalance) || parsedBalance;
      const newCustomerRecord: CustomerRecord = {
        id: created.id,
        name: created.name,
        phone: created.phone || '',
        address: created.address || '',
        city: created.city || '',
        outstandingBalance: effectiveCustBal,
      };

      setCustomers((prev) => [newCustomerRecord, ...prev]);
      setCustomerMode('registered');
      setSelectedCustomerId(created.id);
      setCustomerModalOpen(false);
      setNewCustName('');
      setNewCustPhone('');
      setNewCustType(isRepUser ? 'WHOLESALE' : 'RETAIL');
      setNewCustAddress('');
      setNewCustNic('');
      setNewCustCreditLimit('');
      setNewCustNotes('');
      setNewCustOutstandingBalance('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to add customer');
    } finally {
      setCreatingCustomer(false);
    }
  };

  const handleDownloadCreatedPdf = async () => {
    if (!createdOrder) return;
    try {
      setIsDownloadingPdf(true);
      await downloadBlob(
        `/sales-orders/${createdOrder.id}/pdf`,
        `Order-${createdOrder.orderNumber || createdOrder.id}.pdf`
      );
      toast.success('Order PDF downloaded successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to download Order PDF');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleShareCreatedWhatsApp = () => {
    if (!createdOrder) return;
    const phone = createdOrder.customerPhone || createdOrder.customer?.phone;
    if (!phone) {
      toast.warn('No contact phone available for WhatsApp');
      return;
    }
    const message = generateSalesOrderWhatsAppMessage(createdOrder);
    openWhatsAppChat(phone, message);
  };

  /**
   * Renders the shared Cart Workspace (used identically in Desktop Right Panel and Mobile Bottom Drawer)
   */
  const renderCartWorkspace = (isMobileDrawer = false) => (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Zone 1: Customer Selection & Order Header (Pinned strictly at top) */}
      <div className="p-3 pb-2 border-b border-slate-100 dark:border-zinc-800/80 shrink-0 space-y-2 sticky top-0 bg-white dark:bg-zinc-950 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`p-1.5 rounded-lg ${isEditMode ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'}`}>
              <ShoppingCart className="size-4" />
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                {isEditMode ? `Edit Order #${editingOrderNumber || ''}` : 'Presales Cart'}
              </h3>
              <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0 h-4 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
                {cart.length} {cart.length === 1 ? 'item' : 'items'}
              </Badge>
            </div>
            {isEditMode && (
              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/40">
                EDIT
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {cart.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setCart([]);
                  if (isMobileDrawer) setMobileCartOpen(false);
                }}
                className="text-xs font-semibold text-rose-500 hover:text-rose-600 dark:text-rose-400 hover:underline cursor-pointer transition-colors"
              >
                Clear All
              </button>
            )}
            {isMobileDrawer && (
              <button
                type="button"
                onClick={() => setMobileCartOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                title="Close Cart Drawer"
              >
                <X className="size-5" />
              </button>
            )}
          </div>
        </div>

        {/* Customer Mode Selection */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">Target Customer</span>
            <div className="flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-zinc-800 text-[10px]">
              <button
                type="button"
                onClick={() => setCustomerMode('registered')}
                className={`px-2 py-0.5 rounded font-semibold transition-all cursor-pointer ${
                  customerMode === 'registered'
                    ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-zinc-200'
                }`}
              >
                Registered
              </button>
              <button
                type="button"
                onClick={() => setCustomerMode('guest')}
                className={`px-2 py-0.5 rounded font-semibold transition-all cursor-pointer ${
                  customerMode === 'guest'
                    ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-zinc-200'
                }`}
              >
                Guest
              </button>
            </div>
          </div>

          {customerMode === 'registered' ? (
            <div className="flex items-center gap-1.5">
              <div className="flex-1 min-w-0">
                <SearchableSelect
                  value={String(selectedCustomerId || '')}
                  onValueChange={(val) => setSelectedCustomerId(val ? Number(val) : '')}
                  options={customers.map((c) => ({
                    value: String(c.id),
                    label: `${c.name} (${c.phone || 'No phone'}) · Due: Rs. ${Number(c.outstandingBalance || 0).toLocaleString()}`,
                  }))}
                  placeholder="Select registered customer..."
                  searchPlaceholder="Search customer by name or phone..."
                  className="h-8 text-xs w-full"
                  dark={dark}
                />
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => setCustomerModalOpen(true)}
                className="h-8 px-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg gap-1 shrink-0 shadow-2xs cursor-pointer"
                title="Register New Customer"
              >
                <UserPlus className="size-3.5" />
                <span className="hidden sm:inline">+ Cust</span>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              <Input
                required
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Guest Name *"
                className="h-8 text-xs"
              />
              <Input
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                placeholder="Phone (optional)"
                className="h-8 text-xs font-mono"
              />
            </div>
          )}

          {/* Customer Due Ledger Banner */}
          {customerMode === 'registered' && selectedCustomer && (
            <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 text-[11px]">
              <span className="font-semibold text-indigo-900 dark:text-indigo-200 truncate">{selectedCustomer.name}</span>
              <span className="font-mono font-bold text-amber-600 dark:text-amber-400 shrink-0">
                Ledger Due: Rs. {Number(selectedCustomer.outstandingBalance || 0).toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Zone 2: Scrollable Cart Workspace - Item list, '+ Add Products' ribbon, and Financial Breakdown scroll cohesively */}
      <div className="flex-1 overflow-y-auto min-h-0 p-2.5 sm:p-3 space-y-2.5 scrollbar-thin">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-1.5 text-slate-400 dark:text-zinc-500 text-xs py-8">
            <ShoppingCart className="size-10 opacity-25" />
            <span className="font-medium">Order cart is empty</span>
            <span className="text-[10.5px] opacity-75">Click catalog products to add them to this order</span>
          </div>
        ) : (() => {
          const purchasedItems = cart.map((item, idx) => ({ item, idx })).filter(({ item }) => !item.isReturn);
          const returnedItems = cart.map((item, idx) => ({ item, idx })).filter(({ item }) => Boolean(item.isReturn));

          const renderCartItem = (item: OrderCartItem, idx: number) => (
            <div
              key={`${item.variantId}_${idx}`}
              className={`py-2 px-2.5 rounded-xl border transition-colors flex flex-col gap-1.5 ${
                item.isReturn
                  ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60'
                  : 'border-slate-100 dark:border-zinc-800/80 bg-slate-50/50 dark:bg-zinc-900/40 hover:bg-slate-100/60 dark:hover:bg-zinc-800/40'
              }`}
            >
              {/* Row 1: Product Name, Variant Details, Unit Price & Delete */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h5 className="font-bold text-xs text-slate-900 dark:text-white leading-tight break-words">
                      {item.productName}
                    </h5>
                    {item.isReturn && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-rose-500 text-rose-600 bg-rose-100/60 dark:bg-rose-950/60 font-bold shrink-0">
                        RETURN
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center flex-wrap gap-1.5">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200/70 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                      {item.size} · {item.color}
                    </span>
                    {editingPriceIndex === idx ? (
                      <div className="inline-flex items-center gap-1">
                        <span className="text-[10px]">Rs.</span>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          autoFocus
                          value={tempPriceInput}
                          onChange={(e) => setTempPriceInput(e.target.value)}
                          onFocus={(e) => e.target.select()}
                          onBlur={() => handleApplyDirectPrice(idx)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleApplyDirectPrice(idx);
                            else if (e.key === 'Escape') setEditingPriceIndex(null);
                          }}
                          className="w-16 h-5 px-1 text-xs font-mono font-bold rounded border border-indigo-500 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white"
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPriceIndex(idx);
                          setTempPriceInput(String(item.unitPrice));
                        }}
                        className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono hover:underline flex items-center gap-0.5 cursor-pointer"
                        title="Click to edit unit price"
                      >
                        <span>@ Rs. {item.unitPrice.toLocaleString()}</span>
                        <Pencil className="size-2 text-slate-400" />
                      </button>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => removeFromCart(idx)}
                  className="text-slate-400 hover:text-rose-500 dark:text-zinc-500 dark:hover:text-rose-400 p-1 rounded-lg transition-colors cursor-pointer shrink-0 -mt-0.5 -mr-0.5"
                  title="Remove item"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>

              {/* Row 2: Quantity Stepper, Item Discount Toggle Button & Line Total */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-zinc-800/40">
                {/* Stepper with click-to-edit inline numerical input */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => updateCartItemQty(idx, -1)}
                    className="size-7 h-7 w-7 rounded-lg bg-slate-200/70 dark:bg-zinc-800 flex items-center justify-center text-slate-700 dark:text-zinc-200 hover:bg-slate-300 dark:hover:bg-zinc-700 transition-colors cursor-pointer select-none active:scale-95"
                    title="Decrease quantity"
                  >
                    <Minus className="size-3" />
                  </button>

                  {editingQtyIndex === idx ? (
                    <input
                      type="text"
                      inputMode="decimal"
                      autoFocus
                      value={tempQtyInput}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9.]/g, '');
                        const parts = val.split('.');
                        const cleanVal = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : val;
                        setTempQtyInput(cleanVal);
                      }}
                      onFocus={(e) => e.target.select()}
                      onBlur={() => handleApplyDirectCartQty(idx)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleApplyDirectCartQty(idx);
                        } else if (e.key === 'Escape') {
                          setEditingQtyIndex(null);
                        }
                      }}
                      className="w-12 h-7 text-center font-mono text-xs font-bold bg-white dark:bg-zinc-900 border border-indigo-500 rounded text-indigo-600 dark:text-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingQtyIndex(idx);
                        setTempQtyInput(String(item.quantity));
                      }}
                      className="min-w-8 h-7 px-1.5 rounded hover:bg-indigo-50 dark:hover:bg-indigo-950/60 font-mono text-xs font-bold text-slate-800 dark:text-zinc-200 flex items-center justify-center cursor-pointer transition-colors border border-transparent select-none"
                      title="Click to type quantity directly"
                    >
                      {item.quantity}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => updateCartItemQty(idx, 1)}
                    className="size-7 h-7 w-7 rounded-lg bg-slate-200/70 dark:bg-zinc-800 flex items-center justify-center text-slate-700 dark:text-zinc-200 hover:bg-slate-300 dark:hover:bg-zinc-700 transition-colors cursor-pointer select-none active:scale-95"
                    title="Increase quantity"
                  >
                    <Plus className="size-3" />
                  </button>
                </div>

                {/* Return Toggle Button & Line Item Discount Toggle & Line Total */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => toggleItemReturn(idx)}
                    className={`h-7 px-2 rounded-lg flex items-center gap-0.5 text-[10px] font-bold transition-all cursor-pointer select-none shrink-0 ${
                      item.isReturn
                        ? 'bg-rose-600 text-white shadow-2xs'
                        : 'bg-slate-200/70 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300 hover:bg-slate-300'
                    }`}
                    title={item.isReturn ? 'Item marked as Return' : 'Toggle as Return item'}
                  >
                    <RotateCcw className="size-2.5" />
                    <span>{item.isReturn ? 'Return' : 'Ret'}</span>
                  </button>

                  {!item.isReturn && (
                    <button
                      type="button"
                      onClick={() => toggleItemDiscount(idx)}
                      className={`size-7 h-7 w-7 rounded-lg flex items-center justify-center transition-all cursor-pointer select-none shrink-0 ${
                        item.discount && item.discount > 0
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-700 shadow-2xs'
                          : item.showDiscount
                          ? 'bg-slate-300 text-slate-800 dark:bg-zinc-700 dark:text-zinc-200'
                          : 'bg-slate-200/70 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400 hover:text-indigo-600'
                      }`}
                      title={item.showDiscount ? 'Hide item discount' : 'Add item discount'}
                    >
                      <Percent className="size-3" />
                    </button>
                  )}

                  <div className="flex items-center gap-1.5 text-right">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 dark:text-zinc-500">
                      Total:
                    </span>
                    <span className={`font-mono font-bold text-xs sm:text-sm ${
                      item.isReturn ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'
                    }`}>
                      {item.isReturn
                        ? `- Rs. ${(item.unitPrice * item.quantity).toLocaleString()}`
                        : `Rs. ${Math.max(0, item.unitPrice * item.quantity - (item.discount || 0)).toLocaleString()}`
                      }
                    </span>
                  </div>
                </div>
              </div>

              {/* Inline Item Discount Expand Tray */}
              {item.showDiscount && (
                <div className="pt-1.5 mt-1 border-t border-dashed border-slate-200 dark:border-zinc-800/80 flex items-center justify-between gap-2 text-xs bg-slate-100/60 dark:bg-zinc-900/60 p-1.5 rounded-lg">
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-zinc-300">Item Disc:</span>
                    <div className="inline-flex rounded border border-slate-200 dark:border-zinc-800 p-0.5 bg-white dark:bg-zinc-900">
                      <button
                        type="button"
                        onClick={() => handleItemDiscountTypeChange(idx, 'PERCENT')}
                        className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${
                          (item.discountType || 'PERCENT') === 'PERCENT'
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400'
                        }`}
                      >
                        %
                      </button>
                      <button
                        type="button"
                        onClick={() => handleItemDiscountTypeChange(idx, 'FIXED')}
                        className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${
                          item.discountType === 'FIXED'
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400'
                        }`}
                      >
                        Rs
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {item.discountType === 'PERCENT' && Number(item.discount || 0) > 0 && (
                      <span className="text-[10px] font-mono text-emerald-600 font-semibold">
                        (-Rs. {Number(item.discount).toLocaleString()})
                      </span>
                    )}
                    <Input
                      type="text"
                      value={item.discountInput !== undefined && item.discountInput !== '' ? String(item.discountInput) : ''}
                      onChange={(e) => handleItemDiscountInputChange(idx, e.target.value)}
                      placeholder="0"
                      className="w-16 h-7 text-xs text-right font-mono p-1 bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-700"
                    />
                  </div>
                </div>
              )}

              {/* Return Condition / Reason Selector Pill */}
              {item.isReturn && (
                <div className="pt-1.5 mt-1 border-t border-rose-200/60 dark:border-rose-900/40 flex items-center justify-between text-xs">
                  <span className="text-[10px] font-semibold text-rose-700 dark:text-rose-300">
                    Return Condition:
                  </span>
                  <div className="inline-flex rounded-lg p-0.5 bg-rose-100/60 dark:bg-zinc-800 border border-rose-200 dark:border-zinc-700">
                    <button
                      type="button"
                      onClick={() => handleItemReturnReasonChange(idx, 'UNSOLD')}
                      className={`px-1.5 py-0.5 text-[9.5px] font-bold rounded cursor-pointer transition-all ${
                        (item.returnReason || 'UNSOLD') === 'UNSOLD'
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                      }`}
                    >
                      Unsold (Good)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleItemReturnReasonChange(idx, 'DAMAGED')}
                      className={`px-1.5 py-0.5 text-[9.5px] font-bold rounded cursor-pointer transition-all ${
                        item.returnReason === 'DAMAGED'
                          ? 'bg-rose-600 text-white shadow-2xs'
                          : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                      }`}
                    >
                      Damaged / Defect
                    </button>
                  </div>
                </div>
              )}
            </div>
          );

          return (
            <div className="space-y-3">
              {/* Purchased Items Section */}
              {purchasedItems.length > 0 && (
                <div className="space-y-1.5">
                  {returnedItems.length > 0 && (
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-zinc-300 px-1 pt-0.5">
                      <span className="flex items-center gap-1.5">
                        <Package className="size-3.5 text-indigo-500" />
                        <span>Purchased Items ({purchasedItems.length})</span>
                      </span>
                    </div>
                  )}
                  {purchasedItems.map(({ item, idx }) => renderCartItem(item, idx))}
                </div>
              )}

              {/* Returned Items Section */}
              {returnedItems.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs font-bold text-rose-700 dark:text-rose-400 px-1 pt-0.5">
                    <span className="flex items-center gap-1.5">
                      <RotateCcw className="size-3.5 text-rose-600" />
                      <span>Returned Items ({returnedItems.length})</span>
                    </span>
                    <Badge variant="outline" className="text-[9px] font-bold border-rose-300 dark:border-rose-800 bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 px-1.5 py-0">
                      RETURN
                    </Badge>
                  </div>
                  {returnedItems.map(({ item, idx }) => renderCartItem(item, idx))}
                </div>
              )}
            </div>
          );
        })()}

        {/* "+ Add Products" Ribbon Action - Prominently positioned between items and financial breakdown */}
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (isMobileDrawer) setMobileCartOpen(false);
            else {
              const searchInput = document.querySelector('input[placeholder*="Search product"]') as HTMLInputElement;
              if (searchInput) searchInput.focus();
            }
          }}
          className="w-full h-9 rounded-xl border-dashed border-indigo-300 dark:border-indigo-700/60 bg-indigo-50/50 hover:bg-indigo-100/70 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-2xs my-1"
        >
          <Plus className="size-4 shrink-0" />
          <span>+ Add Products</span>
        </Button>

        {/* Financial Breakdown (Scrolls cohesively with cart items and '+ Add Products' ribbon) */}
        <div className="flex flex-col gap-1 text-xs bg-slate-50/60 dark:bg-zinc-900/40 p-2 rounded-lg border border-slate-100 dark:border-zinc-800">
          <div className="flex items-center justify-between text-slate-600 dark:text-zinc-400">
            <span className="font-semibold text-slate-700 dark:text-zinc-300">
              {grossReturnSubtotal > 0 ? 'Kept Items Gross:' : 'Sub Total:'}
            </span>
            <span className="font-mono font-bold text-slate-900 dark:text-white">Rs. {grossSaleSubtotal.toLocaleString()}</span>
          </div>

          <div className="flex items-center justify-between text-slate-600 dark:text-zinc-400 pt-1 border-t border-slate-200/60 dark:border-zinc-800/60">
            <span className="text-[11px] font-medium">
              {grossReturnSubtotal > 0 ? 'Item Discount (Kept):' : 'Item Total Discount:'}
            </span>
            <span className={`font-mono font-bold text-[11px] ${calculatedItemTotalDiscount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
              {calculatedItemTotalDiscount > 0 ? `- Rs. ${calculatedItemTotalDiscount.toLocaleString()}` : 'Rs. 0'}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-1 pt-1 border-t border-slate-200/60 dark:border-zinc-800/60">
            <div className="flex items-center gap-1">
              <span className="text-slate-600 dark:text-zinc-400 font-medium text-[11px]">
                {grossReturnSubtotal > 0 ? 'Bill Discount (Kept):' : 'Bill Discount:'}
              </span>
              <div className="inline-flex rounded border border-slate-200 dark:border-zinc-800 p-0.5 bg-slate-100 dark:bg-zinc-900 shrink-0">
                <button
                  type="button"
                  onClick={() => handleDiscountTypeToggle('PERCENT')}
                  className={`px-1.5 py-0.2 text-[8.5px] font-bold rounded transition-colors cursor-pointer ${
                    discountType === 'PERCENT'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400'
                  }`}
                >
                  %
                </button>
                <button
                  type="button"
                  onClick={() => handleDiscountTypeToggle('FIXED')}
                  className={`px-1.5 py-0.2 text-[8.5px] font-bold rounded transition-colors cursor-pointer ${
                    discountType === 'FIXED'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400'
                  }`}
                >
                  Rs
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1 ml-auto">
              {discountType === 'PERCENT' && numericOrderDiscount > 0 && (
                <span className="text-[10px] font-mono text-emerald-600 font-bold whitespace-nowrap">
                  (-Rs. {numericOrderDiscount.toLocaleString()})
                </span>
              )}
              <Input
                type="text"
                value={discountInput !== '' ? String(discountInput) : ''}
                onChange={(e) => handleTotalDiscountChange(e.target.value)}
                placeholder="0 or 10%"
                className="w-20 h-6 text-xs text-right font-mono p-1 bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-700"
              />
            </div>
          </div>

          {grossReturnSubtotal > 0 && (
            <div className="flex items-center justify-between text-slate-700 dark:text-zinc-300 pt-1 border-t border-slate-200/60 dark:border-zinc-800/60 font-semibold text-[11px]">
              <span>Kept Items Net Total:</span>
              <span className="font-mono font-bold">Rs. {effectiveNetSale.toLocaleString()}</span>
            </div>
          )}

          {/* Return Credit Breakdown Row */}
          {grossReturnSubtotal > 0 && (
            <div className="flex flex-col gap-0.5 pt-1 border-t border-slate-200/60 dark:border-zinc-800/60 bg-rose-50/60 dark:bg-rose-950/20 p-1.5 rounded">
              <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
                <span className="text-[11px] font-semibold flex items-center gap-1">
                  <RotateCcw className="size-3" />
                  <span>Returned Items:</span>
                </span>
                <span className="font-mono font-bold text-[11px]">
                  - Rs. {effectiveReturnCredit.toLocaleString()}
                </span>
              </div>
              {returnBillDiscountDeduction > 0 && (
                <span className="text-[9.5px] text-slate-400 dark:text-zinc-500 italic">
                  (Proportionally deducted Rs. {returnBillDiscountDeduction.toLocaleString()} bill discount share)
                </span>
              )}
              <div className="text-[9.5px] text-slate-500 dark:text-zinc-400 font-mono">
                Gross: Rs. {grossReturnSubtotal.toLocaleString()} | Discount Reclaimed by Shop: +Rs. {(returnItemDiscounts + returnBillDiscountDeduction).toLocaleString()}
              </div>
              <div className="text-[10px] font-bold text-rose-600 dark:text-rose-400 font-mono text-right">
                Net Return Credit: -Rs. {effectiveReturnCredit.toLocaleString()}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-1.5 border-t border-slate-200 dark:border-zinc-800 text-sm font-bold text-slate-900 dark:text-white">
            <span>{isNetCredit ? 'Customer Credit (Refund):' : 'Total Order Value:'}</span>
            <span className={`font-mono text-base font-extrabold ${isNetCredit ? 'text-rose-600 dark:text-rose-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
              {isNetCredit ? `Rs. ${Math.abs(calculatedTotalAmount).toLocaleString()}` : `Rs. ${calculatedTotalAmount.toLocaleString()}`}
            </span>
          </div>

          {/* Customer Accumulated Credit Due Section */}
          {selectedCustomer && (
            <div className="pt-1.5 border-t border-dashed border-slate-200 dark:border-zinc-800 space-y-1">
              <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-zinc-400">
                <span>Previous Due (Old Bills):</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  Rs. {previousDue.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-amber-700 dark:text-amber-300 font-extrabold">
                <span className="text-[9.5px] uppercase tracking-wider font-bold">Total Accumulated Credit Due:</span>
                <span className="font-mono font-black text-xs">
                  {totalAccumulatedDue < 0
                    ? `- Rs. ${Math.abs(totalAccumulatedDue).toLocaleString()} (Credit Balance)`
                    : `Rs. ${totalAccumulatedDue.toLocaleString()}`}
                </span>
              </div>
            </div>
          )}

          {/* Distinct Cash Refund to Customer Highlighted Box (Strictly Hidden for Credit Returns) */}
          {cashRefundAmount > 0 && !isCreditReturn && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-lg shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-rose-600 animate-pulse" />
                  <span className="text-xs font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wider">
                    Cash Refund to Customer
                  </span>
                </div>
                <span className="text-base font-black font-mono text-rose-700 dark:text-rose-400">
                  Rs. {cashRefundAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <p className="text-[10px] text-rose-600 dark:text-rose-400/80 mt-1">
                Net credit exceeds any previous due balance. Hand over this cash refund amount to the customer.
              </p>
            </div>
          )}

          {/* Credit Return Adjustment Box: Deducted from new items or customer outstanding balance */}
          {isCreditReturn && (isNetCredit || effectiveReturnCredit > 0) && (
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-lg shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
                  <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                    {effectiveNetSale > 0 ? 'Return Credit Deducted from Bill' : 'Credit Deducted from Due Balance'}
                  </span>
                </div>
                <span className="text-base font-black font-mono text-emerald-700 dark:text-emerald-400">
                  - Rs. {effectiveReturnCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <p className="text-[10px] text-emerald-700 dark:text-emerald-300/80 mt-1">
                {effectiveNetSale >= effectiveReturnCredit
                  ? 'Net return credit is automatically deducted from newly purchased items in this bill. No cash refund issued on credit.'
                  : 'Return credit is credited toward customer account ledger to offset existing receivables (Previous Due). No physical cash payout.'}
              </p>
            </div>
          )}

          {/* Dedicated Sales Rep Settlement & Commission Card */}
          {repCommissionData && (
            <div className="mt-1.5">
              <SalesRepCommissionCard
                repName={repCommissionData.repName}
                commissionRatePct={repCommissionData.commissionRatePct}
                initialEarning={repCommissionData.initialEarning}
                returnDeduction={repCommissionData.returnDeduction}
                netRepPayable={repCommissionData.netRepPayable}
              />
            </div>
          )}
        </div>

        {/* Special Instructions / Notes Input */}
        <div className="space-y-1">
          <Input
            value={orderNotes}
            onChange={(e) => setOrderNotes(e.target.value)}
            placeholder="Special instructions, target delivery, terms..."
            className="h-8 text-xs bg-slate-50/50 dark:bg-zinc-900/50"
          />
        </div>
      </div>

      {/* Zone 3: Bottom Sticky Action Bar (STRICTLY PRESALES ORDER - ZERO PAYMENT FIELDS) */}
      <div className="shrink-0 bg-white dark:bg-zinc-950 border-t border-slate-100 dark:border-zinc-800 p-2.5 sm:p-3 sticky bottom-0 z-10">
        {/* Action Buttons: Confirm Presales Order & Convert to Wholesale Invoice */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            disabled={cart.length === 0 || isSubmitting}
            onClick={() => handleSubmit()}
            className="h-10 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all active:scale-[0.98]"
          >
            {isSubmitting ? <Loader2 className="size-4 animate-spin mr-1" /> : <Save className="size-4 mr-1" />}
            <span>{isEditMode ? 'Update Order' : 'Confirm Order'}</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={cart.length === 0}
            onClick={handleConvertToInvoice}
            className="h-10 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 font-semibold text-xs rounded-xl gap-1.5 cursor-pointer shadow-2xs"
            title="Convert active order to Wholesale Invoice in POS"
          >
            <ArrowRightCircle className="size-4 text-indigo-600 dark:text-indigo-400" />
            <span>To Invoice</span>
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-3 h-[calc(100vh-5.2rem)] overflow-hidden p-0 max-w-full relative pb-16 lg:pb-0">
      {/* ── Left Column: Catalog Search, Customer Selection & Responsive 3-Column Product Grid ── */}
      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-zinc-900/70 rounded-2xl border border-slate-200 dark:border-zinc-800 p-2.5 sm:p-3 overflow-hidden shadow-xs">
        {/* Navigation & Title Bar (Barcode scanner strictly hidden on tablet mode) */}
        <div className="flex items-center justify-between gap-2 pb-1.5 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => navigate('/orders')}
              className="size-8 p-0 rounded-lg border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 shrink-0"
              title="Return to Presales Orders List"
            >
              <ArrowLeft className="size-4" />
            </Button>
            <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
              <ShoppingCart className="size-4 text-indigo-600 shrink-0" />
              <span className="truncate">{isEditMode ? `Edit #${editingOrderNumber}` : 'Presales Orders Catalog'}</span>
            </h2>
          </div>

          {/* Desktop-Only Barcode Scanner: Strictly hidden on mobile/tablet viewports */}
          <div className="hidden lg:flex items-center gap-2">
            <form onSubmit={handleBarcodeScan} className="relative w-44">
              <Barcode className="absolute left-2.5 top-2 size-4 text-slate-400" />
              <Input
                ref={barcodeInputRef}
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="Scan Barcode / SKU..."
                className="pl-8 h-8 text-xs font-mono"
              />
            </form>
          </div>
        </div>

        {/* =========================================================================
         * Top Header & Customer Selection Pattern (aligned with Quick Invoice architecture)
         * - Prominent Customer dropdown selector
         * - Inline "Due Balance" badge when a registered customer is selected
         * - Integrated "+ Add Customer" quick-action button matching the field height (h-10)
         * - Universal Catalog Keyword Search input
         * ========================================================================= */}
        <div className="flex flex-col gap-2 p-2 sm:p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-950/70 border border-slate-200/80 dark:border-zinc-800/80 shadow-2xs shrink-0 mb-1">
          {/* Prominent Customer Selection Row: Exact matching input and button heights */}
          <div className="flex items-stretch gap-2">
            <div className="flex-1 min-w-0">
              <SearchableSelect
                className="h-10 rounded-xl"
                value={customerMode === 'guest' ? 'guest' : String(selectedCustomerId || '')}
                onValueChange={handleCustomerSelect}
                options={customerSelectOptions}
                placeholder="Select customer / account..."
                searchPlaceholder="Search customer by name or phone..."
                dark={dark}
              />
            </div>

            {/* Quick Customer Registration Trigger (Height explicitly 40px to match input exactly) */}
            <Button
              type="button"
              onClick={() => setCustomerModalOpen(true)}
              className="h-10 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl gap-1.5 shrink-0 shadow-2xs active:scale-95 transition-all cursor-pointer"
              title="Register New Customer"
            >
              <UserPlus className="size-4" />
              <span className="hidden sm:inline">+ Customer</span>
            </Button>
          </div>

          {/* Inline Customer Live Status & Due Balance Strip */}
          {customerMode === 'registered' && selectedCustomer && (
            <div
              className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs transition-all ${
                previousDue > 0
                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/50 text-amber-900 dark:text-amber-200'
                  : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-200'
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <User className="size-3.5 shrink-0 opacity-70" />
                <span className="font-bold text-xs truncate">{selectedCustomer.name}</span>
                <span className="text-[10.5px] opacity-75 truncate">
                  ({selectedCustomer.phone || 'No phone'}{selectedCustomer.city ? ` · ${selectedCustomer.city}` : ''})
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">Due Balance:</span>
                <span className="font-mono font-extrabold text-xs sm:text-sm">
                  {previousDue > 0 ? `Rs. ${previousDue.toLocaleString()}` : 'Rs. 0 (Cleared)'}
                </span>
              </div>
            </div>
          )}

          {/* Catalog Keyword Search */}
          <div className="relative w-full">
            <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter catalog by product title, size, tags, SKU..."
              className="pl-9 h-9 text-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
                title="Clear search"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>

        {/* Product Catalog Card Grid: Flawless 3 Columns (`grid-cols-3`) in Tablet mode with ZERO horizontal overflow */}
        <div className="flex-1 overflow-y-auto pr-1 pt-2.5">
          {loadingPrereqs ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 py-12">
              <Loader2 className="size-8 animate-spin text-indigo-500" />
              <p className="text-xs text-slate-400">Loading presales product catalog...</p>
            </div>
          ) : filteredCatalog.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-400 py-12">
              <Package className="size-10 opacity-30" />
              <p className="text-xs">No catalog products matched current search.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 xl:grid-cols-4 gap-2">
              {paginatedCatalog.map((v) => {
                const resolvedUrl = v.imageUrl ? resolveImageUrl(v.imageUrl) : null;
                const cartQty = getVariantCartQty(v.id);
                const isMultiOption = (v.size || '').includes(',') || (v.color || '').includes(',');

                return (
                  <div
                    key={v.id}
                    className={`flex flex-col text-left rounded-xl border p-2 transition-all group relative overflow-hidden bg-white dark:bg-zinc-950 ${
                      v.stock <= 0
                        ? 'opacity-40 border-slate-200 dark:border-zinc-800'
                        : 'border-slate-200 dark:border-zinc-800 hover:border-indigo-500 hover:shadow-md'
                    }`}
                  >
                    {/* Preview Modal Trigger (Eye icon top-left) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewVariant(v);
                        setPreviewModalOpen(true);
                      }}
                      className="absolute top-1.5 left-1.5 z-10 size-6 rounded-md bg-black/40 hover:bg-black/70 text-white/90 hover:text-white backdrop-blur-xs flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95"
                      title="Quick Preview & Specs"
                    >
                      <Eye className="size-3.5" />
                    </button>

                    {/* Thumbnail Image */}
                    <div
                      onClick={() => addItemToCart(v, 1)}
                      className="w-full aspect-square rounded-lg bg-slate-100 dark:bg-zinc-900 mb-1.5 overflow-hidden flex items-center justify-center relative cursor-pointer"
                    >
                      {resolvedUrl ? (
                        <img
                          src={resolvedUrl}
                          alt=""
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onError={handleImageError}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <Package className="size-6 text-slate-300 dark:text-zinc-700" />
                      )}
                      {isMultiOption && (
                        <span className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-indigo-600/90 text-white font-bold text-[7.5px] tracking-wide uppercase backdrop-blur-xs shadow-xs">
                          Multi
                        </span>
                      )}
                    </div>

                    {/* Product Name */}
                    <h4
                      onClick={() => addItemToCart(v, 1)}
                      className="font-semibold text-[11px] text-slate-900 dark:text-white line-clamp-1 leading-tight cursor-pointer"
                      title={v.productName}
                    >
                      {v.productName}
                    </h4>

                    {/* Variant Badge & subtle Product Number / SKU badge */}
                    <div className="flex items-center justify-between gap-1 my-0.5">
                      <span className="font-mono text-[9px] font-bold px-1 py-0.5 rounded bg-slate-100 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 truncate max-w-[55%]">
                        {v.size || 'FREE'} {v.color ? `· ${v.color}` : ''}
                      </span>
                      {(v.sku || v.barcode) && (
                        <span
                          className="text-[10px] font-mono text-slate-400 dark:text-zinc-500 bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded truncate max-w-[45%] shrink-0"
                          title={`Product / SKU: ${v.sku || v.barcode}`}
                        >
                          {v.sku || v.barcode}
                        </span>
                      )}
                    </div>

                    {/* Wholesale Rate */}
                    <div className="font-mono font-bold text-[11px] text-indigo-600 dark:text-indigo-400 mt-0.5">
                      Rs. {Number(v.wholesalePrice).toLocaleString()}
                    </div>

                    {/* Bottom Row: Real-time Stock Count & Zero-Shift Animated Inline Quantity Input */}
                    <div className="flex items-center justify-between mt-auto pt-1 border-t border-slate-100 dark:border-zinc-900 min-h-[32px]">
                      <span className="text-[10px] font-mono text-slate-500 dark:text-zinc-400 font-medium">
                        Stock: {v.stock}
                      </span>

                      <AnimatedInlineQtyInput
                        maxStock={v.stock}
                        currentQty={cartQty}
                        onApplyQty={(qty) => setVariantQuantity(v, qty)}
                        productName={v.productName}
                        overlayBottom={true}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Product Catalog Pagination Controls (Synchronized with 3x3 tablet grid & 9 items per page) */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-zinc-800 text-xs shrink-0">
            <span className="text-slate-400 font-medium">
              Page {currentPage} of {totalPages} ({filteredCatalog.length} products)
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="h-9 min-h-[40px] sm:min-h-0 px-3 text-xs rounded-lg cursor-pointer"
              >
                <ChevronLeft className="size-3.5 mr-0.5" /> Prev
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="h-9 min-h-[40px] sm:min-h-0 px-3 text-xs rounded-lg cursor-pointer"
              >
                Next <ChevronRight className="size-3.5 ml-0.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Right Column: Desktop Cart Panel (>= 1024px) ── */}
      <div className="hidden lg:flex lg:w-[380px] xl:w-[420px] h-full flex-col overflow-hidden bg-white dark:bg-zinc-900/70 rounded-2xl border border-slate-200 dark:border-zinc-800 shrink-0 shadow-sm">
        {renderCartWorkspace(false)}
      </div>

      {/* ── Mobile/Tablet Sticky Bottom Floating Cart Bar (< 1024px) ── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 p-3 bg-white dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 z-40 backdrop-blur-md flex items-center justify-between gap-3 shadow-2xl">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative p-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-zinc-700 shrink-0">
            <ShoppingCart className="size-5" />
            {cart.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-indigo-600 text-white font-mono font-bold text-[10px] flex items-center justify-center shadow-xs">
                {totalPiecesQuantity}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-slate-600 dark:text-zinc-400 truncate font-medium">
              {customerMode === 'registered'
                ? (selectedCustomer ? selectedCustomer.name : 'Select Customer')
                : (guestName || 'Guest Customer')}
            </div>
            <div className="font-mono font-extrabold text-sm sm:text-base text-indigo-600 dark:text-indigo-400 leading-tight">
              Rs. {calculatedTotalAmount.toLocaleString()}
            </div>
          </div>
        </div>

        <Button
          type="button"
          onClick={() => setMobileCartOpen(true)}
          className="min-h-[44px] h-11 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-indigo-950/20 shrink-0 cursor-pointer active:scale-95 transition-all"
        >
          <ShoppingCart className="size-4" />
          <span>Review Order ({cart.length})</span>
        </Button>
      </div>

      {/* ── Mobile/Tablet Touch-Friendly Bottom Sheet Drawer (< 1024px) ── */}
      <Drawer open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
        <DrawerContent className="h-[96vh] max-h-[96vh] flex flex-col overflow-hidden p-2.5 sm:p-3.5">
          {renderCartWorkspace(true)}
        </DrawerContent>
      </Drawer>

      {/* ── Product Full Display & Specs Preview Modal ── */}
      <ProductPreviewModal
        open={previewModalOpen}
        onOpenChange={setPreviewModalOpen}
        variant={previewVariant}
        currentCartQty={previewVariant ? getVariantCartQty(previewVariant.id) : 0}
        onApplyQty={(qty) => {
          if (previewVariant) {
            setVariantQuantity(previewVariant, qty);
          }
        }}
      />

      {/* ── Quick Customer Registration Modal with REP 2-Column Compact Layout ── */}
      <Dialog open={customerModalOpen} onOpenChange={setCustomerModalOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Quick Register Customer</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleQuickAddCustomer} className="space-y-3 py-2">
            {isRepUser ? (
              /* REP-Specific Compact 2-Column Registration Layout: Eliminates Account Type dropdown & optimizes vertical height */
              <div className="space-y-3">
                {/* Row 1 (Full Width): Customer / Shop Name * */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Customer / Shop Name *</label>
                  <Input
                    required
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                    placeholder="e.g. Kasun Perera or Modern Textile"
                    autoFocus
                  />
                </div>

                {/* Row 2 (2 Columns): Phone Number * (left) | NIC Number (right) */}
                <div className="grid grid-cols-2 gap-3">
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
                    <label className="text-xs font-semibold">NIC Number</label>
                    <Input
                      value={newCustNic}
                      onChange={(e) => setNewCustNic(e.target.value)}
                      placeholder="e.g. 199012345678"
                    />
                  </div>
                </div>

                {/* Row 3 (2 Columns): Credit Limit (Rs) (left) | Opening / Old Due Balance (Rs) (right) */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Credit Limit (Rs)</label>
                    <Input
                      type="number"
                      value={newCustCreditLimit}
                      onChange={(e) => setNewCustCreditLimit(e.target.value)}
                      placeholder="e.g. 50000"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                      Opening / Old Due Balance (Rs)
                    </label>
                    <Input
                      type="number"
                      step="any"
                      min="0"
                      value={newCustOutstandingBalance}
                      onChange={(e) => setNewCustOutstandingBalance(e.target.value)}
                      placeholder="0.00"
                      className="font-mono"
                      aria-label="Opening / Old Due Balance (Rs)"
                    />
                  </div>
                </div>

                {/* Row 4 (Full Width): Address / City */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Address / City</label>
                  <Input
                    value={newCustAddress}
                    onChange={(e) => setNewCustAddress(e.target.value)}
                    placeholder="e.g. Makandura, Matara"
                  />
                </div>

                {/* Row 5 (Full Width): Notes */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Notes</label>
                  <Input
                    value={newCustNotes}
                    onChange={(e) => setNewCustNotes(e.target.value)}
                    placeholder="Customer preferences or credit terms"
                  />
                </div>
              </div>
            ) : (
              /* Non-REP Users (Admin / Staff): Full form with Account Type selectable if needed */
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Customer / Shop Name *</label>
                  <Input
                    required
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                    placeholder="e.g. Kasun Perera or Modern Textile"
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
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
                    <label className="text-xs font-semibold">Account Type</label>
                    <SearchableSelect
                      value={newCustType}
                      onValueChange={(val) => setNewCustType(val as 'RETAIL' | 'WHOLESALE')}
                      options={[
                        {
                          value: 'RETAIL',
                          label: 'Retail Shopper',
                          icon: <UserCheck className="size-3.5 text-emerald-500" />,
                        },
                        {
                          value: 'WHOLESALE',
                          label: 'Wholesale (Shop Partner)',
                          icon: <Building className="size-3.5 text-blue-500" />,
                        },
                      ]}
                      placeholder="Select Account Type"
                      searchPlaceholder="Search account type..."
                      dark={dark}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">NIC Number</label>
                    <Input
                      value={newCustNic}
                      onChange={(e) => setNewCustNic(e.target.value)}
                      placeholder="e.g. 199012345678"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Credit Limit (Rs)</label>
                    <Input
                      type="number"
                      value={newCustCreditLimit}
                      onChange={(e) => setNewCustCreditLimit(e.target.value)}
                      placeholder="e.g. 50000"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                    Opening / Old Due Balance (Rs)
                  </label>
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    value={newCustOutstandingBalance}
                    onChange={(e) => setNewCustOutstandingBalance(e.target.value)}
                    placeholder="0.00"
                    className="font-mono"
                    aria-label="Opening / Old Due Balance (Rs)"
                  />
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                    Initial debt ledger brought forward from prior invoices or legacy records.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold">Address / City</label>
                  <Input
                    value={newCustAddress}
                    onChange={(e) => setNewCustAddress(e.target.value)}
                    placeholder="e.g. Makandura, Matara"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold">Notes</label>
                  <Input
                    value={newCustNotes}
                    onChange={(e) => setNewCustNotes(e.target.value)}
                    placeholder="Customer preferences or credit terms"
                  />
                </div>
              </div>
            )}
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

      {/* ── Post-Submit Order Confirmation Dialog ── */}
      <Dialog open={isSuccessModalOpen} onOpenChange={setIsSuccessModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mb-2">
              <CheckCircle2 className="size-6" />
            </div>
            <DialogTitle className="text-center text-lg font-bold">
              {isEditMode ? 'Presales Order Updated!' : 'Presales Order Confirmed!'}
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-slate-500">
              Presales order #{createdOrder?.orderNumber || createdOrder?.id} has been saved to the pipeline.
            </DialogDescription>
          </DialogHeader>

          {createdOrder && (
            <div className="p-3.5 rounded-xl border border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/60 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Customer:</span>
                <span className="font-bold text-slate-800 dark:text-zinc-200">
                  {createdOrder.customerName || 'Guest Customer'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Line Items:</span>
                <span className="font-mono font-semibold">{createdOrder.items?.length || cart.length} items</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Order Subtotal:</span>
                <span className="font-mono">Rs. {Number(createdOrder.subtotal || grossSubtotal).toLocaleString()}</span>
              </div>
              {Number(createdOrder.discount || 0) > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Total Discount:</span>
                  <span className="font-mono">-Rs. {Number(createdOrder.discount).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm pt-2 border-t border-slate-200 dark:border-zinc-800">
                <span>Net Total:</span>
                <span className="font-mono text-indigo-600 dark:text-indigo-400">
                  Rs. {Number(createdOrder.totalAmount || calculatedTotalAmount).toLocaleString()}
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleShareCreatedWhatsApp}
              className="w-full sm:w-auto gap-1.5 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-xs"
            >
              <MessageSquare className="size-3.5 text-emerald-600" /> WhatsApp
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadCreatedPdf}
              disabled={isDownloadingPdf}
              className="w-full sm:w-auto gap-1.5 text-xs"
            >
              {isDownloadingPdf ? <Loader2 className="size-3.5 animate-spin" /> : <FileDown className="size-3.5" />} PDF
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setIsSuccessModalOpen(false);
                navigate('/orders');
              }}
              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
            >
              Orders List
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Partial Quantity Return Split Dialog */}
      {splittingItemIndex !== null && cart[splittingItemIndex] && (
        <ReturnSplitModal
          open={splitModalOpen}
          onClose={() => {
            setSplitModalOpen(false);
            setSplittingItemIndex(null);
          }}
          productName={cart[splittingItemIndex].productName}
          variantDetails={`${cart[splittingItemIndex].size || 'FREE'} · ${cart[splittingItemIndex].color || 'Default'}`}
          unitPrice={cart[splittingItemIndex].unitPrice}
          totalQuantity={cart[splittingItemIndex].quantity}
          initialReason={cart[splittingItemIndex].returnReason || 'UNSOLD'}
          onConfirmSplit={handleConfirmReturnSplit}
        />
      )}
    </div>
  );
};
