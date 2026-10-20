import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { SearchableSelect } from '../components/ui/searchable-select';
import {
  ProductVariantCombobox,
  type ProductVariantOption,
} from '../components/orders/ProductVariantCombobox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../components/ui/dialog';
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
  Users,
  Building,
  MapPin,
  Phone,
  FileText,
  Package,
  PlusCircle,
  Sparkles,
  MessageSquare,
  FileDown,
  CheckCircle2,
  Minus,
  AlertCircle,
  Edit,
  ArrowRightCircle,
} from 'lucide-react';
import { openWhatsAppChat, generateSalesOrderWhatsAppMessage } from '../utils/whatsapp';
import { resolveImageUrl } from '../utils/imageUrl';

interface CustomerRecord {
  id: number;
  name: string;
  phone: string;
  address?: string;
  city?: string;
  outstandingBalance?: number;
}

interface OrderLineItem {
  variantId: number | '';
  productName: string;
  variantName: string;
  sku: string;
  imageUrl?: string;
  quantity: number | '';
  unitPrice: number | '';
  discountType?: 'FIXED' | 'PERCENT';
  discountInput?: number | '';
  discount: number | '';
  notes?: string;
  stock?: number;
}

export const OrderCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editOrderId = searchParams.get('editOrderId') || searchParams.get('editId');
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [editingOrderNumber, setEditingOrderNumber] = useState<string>('');

  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  const { user } = useAuth();

  // Prerequisite data
  const [catalogVariants, setCatalogVariants] = useState<ProductVariantOption[]>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [loadingPrereqs, setLoadingPrereqs] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Customer Mode: 'registered' vs 'guest'
  const [customerMode, setCustomerMode] = useState<'registered' | 'guest'>('registered');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | ''>('');
  const [guestName, setGuestName] = useState<string>('');
  const [guestPhone, setGuestPhone] = useState<string>('');
  const [guestAddress, setGuestAddress] = useState<string>('');
  const [guestCity, setGuestCity] = useState<string>('');

  // Order Items (similar to Material section in BuyRawMaterialFormPage)
  const [lineItems, setLineItems] = useState<OrderLineItem[]>([
    {
      variantId: '',
      productName: '',
      variantName: '',
      sku: '',
      imageUrl: '',
      quantity: 1,
      unitPrice: '',
      discountType: 'FIXED', // Default active discount state is 'Rs' (FIXED)
      discountInput: '',
      discount: '',
      notes: '',
    },
  ]);

  // Dual-mode Order Discount: Default to Percentage (%), with Fixed Price (Rs) fallback (matching Quick Invoice flow)
  const [discountType, setDiscountType] = useState<'FIXED' | 'PERCENT'>('PERCENT');
  const [discountInput, setDiscountInput] = useState<number | ''>('');
  const [orderNotes, setOrderNotes] = useState<string>('');

  // Post-submit success dialog
  const [createdOrder, setCreatedOrder] = useState<any | null>(null);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState<boolean>(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);

  // Load catalog and customer database
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

        // Transform catalog to unified ProductVariantOption
        if (Array.isArray(catData)) {
          const mapped: ProductVariantOption[] = catData.map((v) => {
            const prod = v.product || {};
            const img =
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
              stock: v.stock || 0,
              wholesalePrice: Number(v.wholesalePrice) || Number(v.retailPrice) || 0,
              retailPrice: Number(v.retailPrice) || 0,
              imageUrl: img,
            };
          });
          setCatalogVariants(mapped);
        }

        // Map customers
        if (Array.isArray(custData)) {
          setCustomers(
            custData.map((c) => ({
              id: c.id,
              name: c.name,
              phone: c.phone || '',
              address: c.address || '',
              city: c.city || '',
              outstandingBalance: Number(c.outstandingBalance) || 0,
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

  // Load existing order data if in edit mode (editOrderId query parameter)
  useEffect(() => {
    if (!editOrderId) return;
    let isMounted = true;

    const loadOrderToEdit = async () => {
      try {
        const order = await get<any>(`/sales-orders/${editOrderId}`);
        if (!isMounted || !order) return;

        setIsEditMode(true);
        setEditingOrderNumber(order.orderNumber || `ORD-${order.id}`);

        // 1. Populate Customer Mode & details
        if (order.customerId) {
          setCustomerMode('registered');
          setSelectedCustomerId(order.customerId);
        } else {
          setCustomerMode('guest');
          setGuestName(order.customerName || '');
          setGuestPhone(order.customerPhone || '');
          setGuestAddress(order.customerAddress || '');
          setGuestCity(order.customerCity || '');
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

        // 3. Populate Line Items with preserved discount mode and inputs
        if (Array.isArray(order.items) && order.items.length > 0) {
          setLineItems(
            order.items.map((it: any, idx: number) => {
              const metaDisc = parsedNotes?.itemDiscounts?.[idx];
              const discType: 'FIXED' | 'PERCENT' = (it.discountType as any) || metaDisc?.discountType || 'FIXED';
              const discVal = Number(it.discount) || 0;
              const discInput = it.discountInput ?? metaDisc?.discountInput ?? (discVal > 0 ? discVal : '');

              return {
                variantId: it.variantId || '',
                productName: it.productName || it.variant?.product?.name || 'Garment Item',
                variantName: it.variantName || (it.variant ? `${it.variant.size || 'FREE'} / ${it.variant.color || 'Default'}` : ''),
                sku: it.sku || it.variant?.sku || '',
                imageUrl: it.imageUrl || it.variant?.product?.images?.[0]?.imageUrl || '',
                quantity: it.quantity || 1,
                unitPrice: it.unitPrice || 0,
                discountType: discType,
                discountInput: discInput,
                discount: discVal,
                notes: it.notes || '',
                stock: it.variant?.stock,
              };
            })
          );
        }

        // 4. Populate Order Level Discount with exact financial hydration
        // Only hydrate what was explicitly entered. Never guess or auto-convert flat Rs into a percentage.
        if (parsedNotes?.discountType && parsedNotes?.discountInput !== undefined && parsedNotes.discountInput !== '') {
          setDiscountType(parsedNotes.discountType);
          setDiscountInput(Number(parsedNotes.discountInput));
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

        toast.info(`Loaded Presales Order ${order.orderNumber || `#${order.id}`} in Edit Mode`);
      } catch (err: any) {
        console.error('Failed to load order for editing:', err);
        toast.error(err.message || 'Failed to load order details for editing');
      }
    };

    loadOrderToEdit();

    return () => {
      isMounted = false;
    };
  }, [editOrderId]);

  // Selected registered customer helper
  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerId) return null;
    return customers.find((c) => c.id === Number(selectedCustomerId)) || null;
  }, [customers, selectedCustomerId]);

  // Helper to accurately compute line discount amount based on mode and input
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

  // Line item handlers
  const handleAddLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      {
        variantId: '',
        productName: '',
        variantName: '',
        sku: '',
        imageUrl: '',
        quantity: 1,
        unitPrice: '',
        discountType: 'FIXED', // Default active discount state is 'Rs' (FIXED)
        discountInput: '',
        discount: 0,
        notes: '',
      },
    ]);
  };

  const handleRemoveLineItem = (index: number) => {
    setLineItems((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0
        ? next
        : [
            {
              variantId: '',
              productName: '',
              variantName: '',
              sku: '',
              imageUrl: '',
              quantity: 1,
              unitPrice: '',
              discountType: 'FIXED',
              discountInput: '',
              discount: 0,
              notes: '',
            },
          ];
    });
  };

  const handleSelectVariant = (index: number, variant: ProductVariantOption) => {
    setLineItems((prev) => {
      const next = [...prev];
      const defaultPrice = variant.wholesalePrice || variant.retailPrice || 0;
      const qty = Number(next[index].quantity) || 1;
      const discType = next[index].discountType || 'FIXED';
      const discInput = next[index].discountInput ?? '';
      const calculatedLineDisc = calculateItemDiscount(defaultPrice, qty, discType, discInput);

      next[index] = {
        ...next[index],
        variantId: variant.id,
        productName: variant.productName,
        variantName: `${variant.size || 'FREE'} / ${variant.color || 'Default'}`,
        sku: variant.sku,
        imageUrl: variant.imageUrl || '',
        unitPrice: defaultPrice,
        discountType: discType,
        discountInput: discInput,
        discount: calculatedLineDisc,
        stock: variant.stock,
      };
      return next;
    });
  };

  const handleLineItemChange = (index: number, field: keyof OrderLineItem, value: any) => {
    setLineItems((prev) => {
      const next = [...prev];
      const updatedItem = { ...next[index], [field]: value };

      // Recalculate line discount reactively whenever quantity or unitPrice changes
      if (field === 'quantity' || field === 'unitPrice') {
        const qty = Number(field === 'quantity' ? value : updatedItem.quantity) || 1;
        const price = Number(field === 'unitPrice' ? value : updatedItem.unitPrice) || 0;
        const discType = updatedItem.discountType || 'FIXED';
        const discInput = updatedItem.discountInput ?? '';
        updatedItem.discount = calculateItemDiscount(price, qty, discType, discInput);
      }

      next[index] = updatedItem;
      return next;
    });
  };

  // Line item dual discount mode toggle (% vs Rs)
  const handleLineItemDiscountTypeChange = (index: number, type: 'PERCENT' | 'FIXED') => {
    setLineItems((prev) => {
      const next = [...prev];
      const item = next[index];
      const qty = Number(item.quantity) || 1;
      const price = Number(item.unitPrice) || 0;
      const currentInput = item.discountInput !== undefined && item.discountInput !== '' 
        ? item.discountInput 
        : (Number(item.discount) > 0 ? Number(item.discount) : '');

      const newDiscount = calculateItemDiscount(price, qty, type, currentInput);

      next[index] = {
        ...item,
        discountType: type,
        discountInput: currentInput,
        discount: newDiscount,
      };
      return next;
    });
  };

  // Line item discount input change with automatic reactive calculation
  const handleLineItemDiscountInputChange = (index: number, valStr: string) => {
    setLineItems((prev) => {
      const next = [...prev];
      const item = next[index];
      const val = valStr === '' ? '' : Math.max(0, parseFloat(valStr));
      const qty = Number(item.quantity) || 1;
      const price = Number(item.unitPrice) || 0;
      const discType = item.discountType || 'FIXED';
      const calculatedDiscount = calculateItemDiscount(price, qty, discType, val);

      next[index] = {
        ...item,
        discountInput: val,
        discount: calculatedDiscount,
      };
      return next;
    });
  };

  // Adjust quantity (+ / -) for mobile/tablet touch ergonomics
  const handleAdjustQuantity = (index: number, delta: number) => {
    setLineItems((prev) => {
      const next = [...prev];
      const current = Number(next[index].quantity) || 1;
      const updated = Math.max(1, current + delta);
      const updatedItem = { ...next[index], quantity: updated };
      const price = Number(updatedItem.unitPrice) || 0;
      const discType = updatedItem.discountType || 'FIXED';
      const discInput = updatedItem.discountInput ?? '';

      updatedItem.discount = calculateItemDiscount(price, updated, discType, discInput);
      next[index] = updatedItem;
      return next;
    });
  };

  // Financial calculations
  const calculatedSubtotal = useMemo(() => {
    return lineItems.reduce((acc, item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unitPrice) || 0;
      const lineDisc = Number(item.discount) || 0;
      return acc + Math.max(0, qty * price - lineDisc);
    }, 0);
  }, [lineItems]);

  // Dual-mode Order Discount calculation (Percentage or Fixed Rs)
  // Ensures strictly explicit user-provided discount is applied and does not exceed subtotal
  const numericOrderDiscount = useMemo(() => {
    if (discountInput === '' || Number(discountInput) <= 0 || calculatedSubtotal <= 0) return 0;
    const val = Number(discountInput);
    if (discountType === 'PERCENT') {
      const percentage = Math.min(100, Math.max(0, val));
      return Math.round((calculatedSubtotal * percentage) / 100);
    }
    return Math.min(calculatedSubtotal, Math.max(0, val));
  }, [calculatedSubtotal, discountInput, discountType]);

  const calculatedTotalAmount = Math.max(0, calculatedSubtotal - numericOrderDiscount);

  /**
   * Metrics calculations for Distinct Products and Total Pieces Quantity:
   * Provides real-time distinct catalog items count and sum of all garment units
   * for responsive display in the Order Financials summary and mobile sticky bar.
   */
  const distinctProductsCount = useMemo(() => {
    const validWithVariant = lineItems.filter((i) => Boolean(i.variantId));
    const uniqueIdentifiers = new Set(
      validWithVariant.map((i) => i.productName || i.variantId)
    );
    return uniqueIdentifiers.size || validWithVariant.length;
  }, [lineItems]);

  const totalPiecesQuantity = useMemo(() => {
    return lineItems.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
  }, [lineItems]);

  // Normalizes 'PERCENT' / 'FIXED' internal state with 'percentage' / 'fixed' UI toggles
  const orderDiscountType = discountType === 'PERCENT' ? 'percentage' : 'fixed';
  const orderDiscountInput = discountInput;
  const calculatedOrderDiscountRs = numericOrderDiscount;

  // Seamless mode switch with mathematical value preservation
  const handleOrderDiscountTypeChange = (type: 'percentage' | 'fixed') => {
    const newType = type === 'percentage' ? 'PERCENT' : 'FIXED';
    if (newType === discountType) return;
    setDiscountType(newType);

    if (discountInput !== '') {
      if (newType === 'PERCENT') {
        const pct = calculatedSubtotal > 0 ? parseFloat(((Number(discountInput) / calculatedSubtotal) * 100).toFixed(1)) : 0;
        setDiscountInput(Math.min(100, Math.max(0, pct)));
      } else {
        const rs = Math.round((calculatedSubtotal * Number(discountInput)) / 100);
        setDiscountInput(Math.min(calculatedSubtotal, Math.max(0, rs)));
      }
    }
  };

  const handleOrderDiscountInputChange = (valStr: string) => {
    if (valStr === '') {
      setDiscountInput('');
      return;
    }
    const num = parseFloat(valStr);
    if (isNaN(num) || num < 0) {
      setDiscountInput('');
      return;
    }
    if (discountType === 'PERCENT') {
      setDiscountInput(Math.min(100, num));
    } else {
      setDiscountInput(Math.min(calculatedSubtotal, num));
    }
  };

  /**
   * Top Header "Convert to Invoice" Action:
   * Instantly transitions the active order (New or Edit) to the Wholesale Quick Invoice screen
   * without needing to save first or scroll down. Perfectly preserves customer, line items,
   * item discounts, and order discount in location state and query params.
   */
  const handleConvertToInvoice = () => {
    const validItems = lineItems.filter((item) => item.variantId !== '');
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
      subtotal: calculatedSubtotal,
      discount: numericOrderDiscount,
      discountType,
      discountInput,
      notes: JSON.stringify({
        userNotes: orderNotes.trim(),
        discountType,
        discountInput,
        itemDiscounts: validItems.map((item) => ({
          variantId: Number(item.variantId),
          discountType: item.discountType || 'FIXED',
          discountInput: item.discountInput !== undefined && item.discountInput !== '' ? item.discountInput : (Number(item.discount) > 0 ? Number(item.discount) : ''),
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
        discountType: item.discountType || 'FIXED',
        discountInput: item.discountInput !== undefined && item.discountInput !== '' ? item.discountInput : (Number(item.discount) > 0 ? Number(item.discount) : ''),
        discount: Number(item.discount) || 0,
        totalPrice: Math.max(0, Number(item.quantity) * Number(item.unitPrice) - (Number(item.discount) || 0)),
        notes: item.notes || undefined,
      })),
    };

    const targetUrl = editOrderId
      ? `/system/quick-invoice?mode=WHOLESALE&convertOrderId=${editOrderId}`
      : `/system/quick-invoice?mode=WHOLESALE`;

    navigate(targetUrl, { state: { convertOrder: orderData } });
  };

  // Form submit handler (Supports both New Order Creation and Order Edit)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Customer validation
    let finalCustomerName = '';
    let finalCustomerPhone = '';
    let finalCustomerAddress = '';
    let finalCustomerCity = '';

    if (customerMode === 'registered') {
      if (!selectedCustomerId || !selectedCustomer) {
        toast.warn('Please select a registered customer or switch to Guest Customer');
        return;
      }
      finalCustomerName = selectedCustomer.name;
      finalCustomerPhone = selectedCustomer.phone;
      finalCustomerAddress = selectedCustomer.address || '';
      finalCustomerCity = selectedCustomer.city || '';
    } else {
      if (!guestName.trim()) {
        toast.warn('Please enter the Guest Customer Name');
        return;
      }
      finalCustomerName = guestName.trim();
      finalCustomerPhone = guestPhone.trim();
      finalCustomerAddress = guestAddress.trim();
      finalCustomerCity = guestCity.trim();
    }

    // 2. Validate line items
    const validItems = lineItems.filter((item) => item.variantId !== '');
    if (validItems.length === 0) {
      toast.warn('Please select at least one product for this order');
      return;
    }

    for (const item of validItems) {
      if (!item.quantity || Number(item.quantity) <= 0) {
        toast.warn(`Please enter a valid quantity for "${item.productName}"`);
        return;
      }
      if (item.unitPrice === '' || Number(item.unitPrice) < 0) {
        toast.warn(`Please enter a valid unit price for "${item.productName}"`);
        return;
      }
    }

    try {
      setIsSubmitting(true);

      // Structured notes to ensure seamless discount mode and rate preservation
      const structuredNotes = JSON.stringify({
        userNotes: orderNotes.trim(),
        discountType,
        discountInput,
        itemDiscounts: validItems.map((item) => ({
          variantId: Number(item.variantId),
          discountType: item.discountType || 'FIXED',
          discountInput: item.discountInput !== undefined && item.discountInput !== '' ? item.discountInput : (Number(item.discount) > 0 ? Number(item.discount) : ''),
          discount: Number(item.discount) || 0,
        })),
      });

      const payload = {
        customerId: customerMode === 'registered' && selectedCustomerId ? Number(selectedCustomerId) : undefined,
        customerName: finalCustomerName,
        customerPhone: finalCustomerPhone || undefined,
        customerAddress: finalCustomerAddress || undefined,
        customerCity: finalCustomerCity || undefined,
        subtotal: calculatedSubtotal,
        discount: numericOrderDiscount,
        totalAmount: calculatedTotalAmount,
        notes: structuredNotes,
        items: validItems.map((item) => ({
          variantId: Number(item.variantId),
          productName: item.productName,
          variantName: item.variantName,
          sku: item.sku,
          imageUrl: item.imageUrl || undefined,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          discount: Number(item.discount) || 0,
          totalPrice: Math.max(0, (Number(item.quantity) * Number(item.unitPrice)) - (Number(item.discount) || 0)),
          notes: item.notes || undefined,
        })),
      };

      if (isEditMode && editOrderId) {
        const updated = await put<any>(`/sales-orders/${editOrderId}`, payload);
        setCreatedOrder(updated);
        setIsSuccessModalOpen(true);
        toast.success(`Presales Order ${updated.orderNumber || ''} updated successfully!`);
      } else {
        const created = await post<any>('/sales-orders', payload);
        setCreatedOrder(created);
        setIsSuccessModalOpen(true);
        toast.success(`Presales Order ${created.orderNumber || ''} created successfully!`);
      }
    } catch (err: any) {
      console.error('Order submission error:', err);
      toast.error(err.message || 'Failed to save sales order');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Download PDF from success dialog
  const handleDownloadCreatedPdf = async () => {
    if (!createdOrder) return;
    try {
      setIsDownloadingPdf(true);
      await downloadBlob(
        `/sales-orders/${createdOrder.id}/pdf`,
        `Order-${createdOrder.orderNumber || createdOrder.id}.pdf`
      );
      toast.success('Order PDF downloaded successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to download PDF');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Share WhatsApp from success dialog
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

  return (
    <div className="space-y-4 sm:space-y-6 pb-20 lg:pb-12 max-w-6xl mx-auto">
      {/* ── Page Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigate('/orders')}
            className="size-9 p-0 rounded-xl border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <ShoppingCart className="size-5 text-indigo-600" />
              <span>{isEditMode ? `Edit Order #${editingOrderNumber || ''}` : 'New Presales Order'}</span>
              {isEditMode && (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
                  Edit Mode
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              {isEditMode
                ? 'Update order items, rates, dual discounts, and customer details'
                : 'Field rep booking module for retail & wholesale store presales'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate('/orders')}
            className="h-9 text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleConvertToInvoice}
            disabled={loadingPrereqs}
            className="h-9 gap-1.5 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 font-semibold cursor-pointer text-xs px-3.5 shadow-2xs"
            title="Convert this order directly to a Wholesale Invoice"
          >
            <ArrowRightCircle className="size-4 text-indigo-600 dark:text-indigo-400" />
            <span>Convert to Invoice</span>
          </Button>
          <Button
            form="sales-order-form"
            type="submit"
            size="sm"
            disabled={isSubmitting || loadingPrereqs}
            className="h-9 gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer shadow-xs text-xs px-4"
          >
            {isSubmitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            <span>{isEditMode ? 'Update Order' : 'Confirm Order'}</span>
          </Button>
        </div>
      </div>

      <form id="sales-order-form" onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        {/* ── CARD 1: CUSTOMER SELECTION ── */}
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-3.5 sm:p-5 space-y-3 sm:space-y-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-zinc-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 flex items-center gap-2">
              <Users className="size-4 text-indigo-600" /> 1. Customer Selection
            </h3>

            {/* Registered vs Guest Customer Pill Toggle */}
            <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs">
              <button
                type="button"
                onClick={() => setCustomerMode('registered')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  customerMode === 'registered'
                    ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-zinc-200'
                }`}
              >
                Existing Customer
              </button>
              <button
                type="button"
                onClick={() => setCustomerMode('guest')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  customerMode === 'guest'
                    ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-zinc-200'
                }`}
              >
                Guest / One-Time
              </button>
            </div>
          </div>

          {customerMode === 'registered' ? (
            /* Registered Customer Section using existing SearchableSelect */
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Select Registered Customer *
                </label>
                <SearchableSelect
                  value={String(selectedCustomerId)}
                  onValueChange={(val) => setSelectedCustomerId(val ? Number(val) : '')}
                  options={customers.map((c) => ({
                    value: String(c.id),
                    label: `${c.name} (${c.phone || 'No Phone'}) · Due: Rs. ${c.outstandingBalance?.toLocaleString() || 0}`,
                  }))}
                  placeholder="Search customer by name or phone..."
                  searchPlaceholder="Search registered customer..."
                  className="h-10"
                  dark={dark}
                />
              </div>

              {selectedCustomer && (
                /* Customer Summary Details: Fluid 3 columns on tablet portrait (~534px) instead of vertical stacking */
                <div className="p-3.5 rounded-xl border border-indigo-100 dark:border-indigo-950/60 bg-indigo-50/50 dark:bg-indigo-950/20 text-xs grid grid-cols-1 xs:grid-cols-3 gap-2">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Name</span>
                    <p className="font-bold text-slate-900 dark:text-white">{selectedCustomer.name}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Phone</span>
                    <p className="font-mono text-slate-700 dark:text-zinc-300">{selectedCustomer.phone || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Current Ledger Due</span>
                    <p className="font-mono font-bold text-amber-600 dark:text-amber-400">
                      Rs. {selectedCustomer.outstandingBalance?.toLocaleString('en-LK') || 0}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Guest Customer Section: Fluid 2x2 grid on ~500-600px tablet screens */
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
                <AlertCircle className="size-4 shrink-0 mt-0.5 text-amber-600" />
                <span>
                  Guest Customer Mode: Enter the customer’s details on the fly. This order will record this information directly without creating a permanent account in the customer database.
                </span>
              </div>

              <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    Guest Customer Name *
                  </label>
                  <Input
                    required
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="e.g. Ruwan Perera"
                    className="h-10 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    Contact Phone
                  </label>
                  <Input
                    type="tel"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    placeholder="e.g. 0771234567"
                    className="h-10 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    Delivery Address
                  </label>
                  <Input
                    value={guestAddress}
                    onChange={(e) => setGuestAddress(e.target.value)}
                    placeholder="e.g. Main Street, Matara"
                    className="h-10 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    City / Town
                  </label>
                  <Input
                    value={guestCity}
                    onChange={(e) => setGuestCity(e.target.value)}
                    placeholder="e.g. Matara"
                    className="h-10 text-xs"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── CARD 2: PRODUCT SELECTION INTERFACE (SIMILAR TO MATERIAL SECTION) ── */}
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-3.5 sm:p-5 space-y-3 sm:space-y-4 shadow-xs">
          {/* Section Header: Full-width title without top Add Row button (action kept exclusively at bottom) */}
          <div className="w-full flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
            <h3 className="w-full text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 flex items-center gap-2">
              <Package className="size-4 text-indigo-600" /> 2. Order Line Items
            </h3>
          </div>

          {/* ── Responsive Touch-Friendly Line Item Cards (Mobile, Tablet & Desktop) ── */}
          <div className="space-y-3 sm:space-y-3.5">
            {lineItems.map((item, index) => {
              const rowTotal = Math.max(
                0,
                (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0) - (Number(item.discount) || 0)
              );

              return (
                <div
                  key={index}
                  className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 p-2.5 sm:p-3.5 space-y-2 sm:space-y-2.5 shadow-xs transition-all hover:border-slate-300 dark:hover:border-zinc-700"
                >
                  {/* Card Header: Item Number, SKU, Variant Descriptor & Quick Remove */}
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-zinc-800/80">
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                      <span className="font-mono text-xs font-bold text-slate-600 dark:text-zinc-300">
                        Item #{index + 1}
                      </span>
                      {item.sku && (
                        <span className="text-[10px] font-mono bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-zinc-300 font-semibold truncate max-w-[120px]">
                          {item.sku}
                        </span>
                      )}
                      {item.variantName && (
                        <span className="text-[11px] text-slate-500 dark:text-zinc-400 truncate max-w-[140px]">
                          {item.variantName}
                        </span>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveLineItem(index)}
                      disabled={lineItems.length === 1}
                      className="size-7 sm:size-8 p-0 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg disabled:opacity-40 cursor-pointer transition-colors shrink-0"
                      title="Remove line item"
                    >
                      <Trash2 className="size-3.5 sm:size-4" />
                    </Button>
                  </div>

                  {/* Product Variant Selector */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block">
                      Product Variant *
                    </label>
                    <ProductVariantCombobox
                      value={item.variantId}
                      onChange={(variant) => handleSelectVariant(index, variant)}
                      options={catalogVariants}
                      placeholder="Select Garment Item..."
                    />
                  </div>

                  {/* Dense Fluid Grid: 2 columns on Mobile, 4 columns on Tablet & Desktop */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-0.5">
                    {/* 1. Unit Price Input */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block">
                        Price (Rs) *
                      </label>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        required
                        value={item.unitPrice}
                        onChange={(e) =>
                          handleLineItemChange(
                            index,
                            'unitPrice',
                            e.target.value === '' ? '' : Number(e.target.value)
                          )
                        }
                        placeholder="0.00"
                        className="font-mono text-xs h-8 sm:h-9 bg-white dark:bg-zinc-900"
                      />
                    </div>

                    {/* 2. Quantity with Touch Stepper (+ / -) */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block">
                        Quantity *
                      </label>
                      <div className="flex items-center rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/50 overflow-hidden h-8 sm:h-9">
                        <button
                          type="button"
                          onClick={() => handleAdjustQuantity(index, -1)}
                          className="size-8 sm:size-9 flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-zinc-800 cursor-pointer active:scale-95 transition-all shrink-0"
                          title="Decrease quantity"
                        >
                          <Minus className="size-3.5" />
                        </button>
                        <input
                          type="number"
                          min="1"
                          required
                          value={item.quantity}
                          onChange={(e) =>
                            handleLineItemChange(
                              index,
                              'quantity',
                              e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value, 10))
                            )
                          }
                          className="w-full text-center font-mono font-bold text-xs bg-transparent border-0 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleAdjustQuantity(index, 1)}
                          className="size-8 sm:size-9 flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-zinc-800 cursor-pointer active:scale-95 transition-all shrink-0"
                          title="Increase quantity"
                        >
                          <Plus className="size-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* 3. Dual Discount Controls (% / Rs) */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                          Discount
                        </label>
                        <div className="flex items-center rounded-md bg-slate-100 dark:bg-zinc-800 p-0.5 text-[9px] font-bold">
                          <button
                            type="button"
                            onClick={() => handleLineItemDiscountTypeChange(index, 'PERCENT')}
                            className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                              item.discountType === 'PERCENT'
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            %
                          </button>
                          <button
                            type="button"
                            onClick={() => handleLineItemDiscountTypeChange(index, 'FIXED')}
                            className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                              item.discountType !== 'PERCENT'
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            Rs
                          </button>
                        </div>
                      </div>
                      <div className="relative">
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={item.discountInput !== undefined && item.discountInput !== '' ? item.discountInput : (Number(item.discount) > 0 ? item.discount : '')}
                          onChange={(e) => handleLineItemDiscountInputChange(index, e.target.value)}
                          placeholder="0.00"
                          className="font-mono text-xs h-8 sm:h-9 pr-14 bg-white dark:bg-zinc-900"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-mono pointer-events-none truncate max-w-[50px]">
                          {item.discountType === 'PERCENT' ? '%' : 'Rs'}
                        </span>
                      </div>
                    </div>

                    {/* 4. Line Total Display */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block">
                        Line Total
                      </label>
                      <div className="h-8 sm:h-9 px-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/60 flex items-center justify-between font-mono font-bold text-xs">
                        <span className="text-[9px] text-slate-400 font-sans font-semibold">Total:</span>
                        <span className="text-slate-900 dark:text-white truncate">
                          Rs. {rowTotal.toLocaleString('en-LK')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ⭐ Bottom Secondary Add Row Button: Eliminates tedious upward scrolling on mobile/tablet devices */}
          <div className="pt-2 flex items-center justify-center">
            <Button
              type="button"
              variant="outline"
              onClick={handleAddLineItem}
              className="w-full sm:w-auto h-9 px-4 gap-2 border-dashed border-indigo-200 dark:border-indigo-900/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 font-semibold text-xs rounded-xl shadow-2xs cursor-pointer transition-all"
            >
              <PlusCircle className="size-4" />
              <span>+ Add Row</span>
            </Button>
          </div>
        </div>

        {/* ── CARD 3: NOTES & FINANCIAL SUMMARY ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          {/* Notes */}
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-3.5 sm:p-5 space-y-2 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 flex items-center gap-2">
              <FileText className="size-4 text-indigo-600" /> 3. Special Instructions / Notes
            </h3>
            <textarea
              rows={4}
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              placeholder="Enter customer requests, target delivery date, or shop instructions..."
              className="w-full text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/50 p-3 outline-none focus:border-indigo-500 text-slate-900 dark:text-white"
            />
          </div>

          {/* Financial Breakdown */}
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-3.5 sm:p-5 space-y-3 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
              4. Order Financials
            </h3>

            {/* Distinct Metrics Ribbon: Total Items/Units & Total Quantity */}
            <div className="grid grid-cols-2 gap-2 pb-2.5 border-b border-slate-100 dark:border-zinc-800">
              <div className="p-2 sm:p-2.5 rounded-xl bg-slate-50/80 dark:bg-zinc-950/60 border border-slate-200/70 dark:border-zinc-800/80 flex flex-col justify-center text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  Total Items / Units
                </span>
                <span className="font-mono text-sm sm:text-base font-bold text-slate-900 dark:text-white mt-0.5">
                  {distinctProductsCount} <span className="text-[11px] font-normal text-slate-500">units</span>
                </span>
              </div>
              <div className="p-2 sm:p-2.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 flex flex-col justify-center text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Total Qty
                </span>
                <span className="font-mono text-sm sm:text-base font-bold text-indigo-700 dark:text-indigo-300 mt-0.5">
                  {totalPiecesQuantity} <span className="text-[11px] font-normal text-indigo-500">pcs</span>
                </span>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-600 dark:text-zinc-400">
                <span>Items Subtotal:</span>
                <span className="font-mono font-semibold">
                  Rs. {calculatedSubtotal.toLocaleString('en-LK')}
                </span>
              </div>

              <div className="flex justify-between items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-slate-600 dark:text-zinc-400">Order Discount:</span>
                  <div className="flex items-center rounded-lg bg-slate-100 dark:bg-zinc-800 p-0.5 text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => handleOrderDiscountTypeChange('percentage')}
                      className={`px-2 py-0.5 rounded-md transition-colors ${
                        orderDiscountType === 'percentage'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-zinc-400'
                      }`}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOrderDiscountTypeChange('fixed')}
                      className={`px-2 py-0.5 rounded-md transition-colors ${
                        orderDiscountType === 'fixed'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-zinc-400'
                      }`}
                    >
                      Rs
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {orderDiscountType === 'percentage' && calculatedOrderDiscountRs > 0 && (
                    <span className="text-[11px] font-mono text-slate-400">
                      (-Rs. {calculatedOrderDiscountRs.toLocaleString('en-LK')})
                    </span>
                  )}
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={orderDiscountInput}
                    onChange={(e) => handleOrderDiscountInputChange(e.target.value)}
                    placeholder="0.00"
                    className="w-24 h-8 text-right font-mono text-xs"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-zinc-800 flex justify-between items-center text-base font-bold text-slate-900 dark:text-white">
                <span>Net Total:</span>
                <span className="font-mono text-indigo-600 dark:text-indigo-400">
                  Rs. {calculatedTotalAmount.toLocaleString('en-LK')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Fixed Mobile Bottom Action Bar (< 1024px) ── */}
        <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden p-3 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3 shadow-lg">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-slate-500 dark:text-zinc-400">
              <span>{distinctProductsCount} items</span>
              <span>•</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-mono">{totalPiecesQuantity} pcs</span>
            </div>
            <span className="text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400">
              Rs. {calculatedTotalAmount.toLocaleString('en-LK')}
            </span>
          </div>

          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting || loadingPrereqs}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer shadow-md text-xs px-5 h-10"
          >
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {isEditMode ? 'Update Order' : 'Confirm Order'}
          </Button>
        </div>
      </form>

      {/* ── SUCCESS MODAL WITH PDF & WHATSAPP ACTIONS ── */}
      {createdOrder && (
        <Dialog open={isSuccessModalOpen} onOpenChange={setIsSuccessModalOpen}>
          <DialogContent className="max-w-md p-6 text-center space-y-4 rounded-2xl">
            <div className="size-14 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="size-8" />
            </div>

            <DialogHeader className="space-y-1">
              <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white">
                Order Booked Successfully!
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-zinc-400 font-mono">
                Order No: #{createdOrder.orderNumber || createdOrder.id}
              </DialogDescription>
            </DialogHeader>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 text-xs space-y-1 text-left">
              <div className="flex justify-between">
                <span className="text-slate-500">Customer:</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {createdOrder.customerName || 'Guest Customer'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Items:</span>
                <span className="font-bold">{createdOrder.items?.length || 0} items</span>
              </div>
              <div className="flex justify-between font-bold pt-1 border-t border-slate-200/80 dark:border-zinc-800">
                <span className="text-slate-700 dark:text-zinc-300">Total Value:</span>
                <span className="font-mono text-indigo-600 dark:text-indigo-400">
                  Rs. {Number(createdOrder.totalAmount || 0).toLocaleString('en-LK')}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleShareCreatedWhatsApp}
                className="gap-1.5 h-10 text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800"
              >
                <MessageSquare className="size-4" /> Share WhatsApp
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isDownloadingPdf}
                onClick={handleDownloadCreatedPdf}
                className="gap-1.5 h-10 text-xs font-semibold text-slate-700 dark:text-zinc-300"
              >
                {isDownloadingPdf ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FileDown className="size-4" />
                )}
                Download PDF
              </Button>
            </div>

            <div className="pt-2 flex justify-between items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsSuccessModalOpen(false);
                  navigate('/orders');
                }}
                className="text-xs w-full"
              >
                Go to Orders List
              </Button>

              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => {
                  setIsSuccessModalOpen(false);
                  setCreatedOrder(null);
                  setSelectedCustomerId('');
                  setGuestName('');
                  setGuestPhone('');
                  setGuestAddress('');
                  setGuestCity('');
                  setLineItems([
                    {
                      variantId: '',
                      productName: '',
                      variantName: '',
                      sku: '',
                      imageUrl: '',
                      quantity: 1,
                      unitPrice: '',
                      discountType: 'FIXED',
                      discountInput: '',
                      discount: 0,
                      notes: '',
                    },
                  ]);
                  // ⭐ Reset order discount state cleanly using defined setters
                  setDiscountInput('');
                  setDiscountType('PERCENT');
                  setOrderNotes('');
                }}
                className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white w-full"
              >
                Create Another
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
