import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { SearchableSelect } from '../components/ui/searchable-select';
import { DatePicker } from '../components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import {
  Drawer,
  DrawerContent,
} from '../components/ui/drawer';
import { get, post, put } from '../lib/api';
import { toast } from 'react-toastify';
import { A4InvoiceModal } from '../components/pos/A4InvoiceModal';
import { SplitPaymentModal, type SplitPaymentItem } from '../components/pos/SplitPaymentModal';
import { isValidSriLankanNIC, isValidSriLankanPhone } from '../utils/validators';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
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
  CreditCard,
  Landmark,
  Pencil,
  RotateCcw,
  Check,
  X,
  Layers,
  FileDown,
} from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { openWhatsAppChat, generateCustomerInvoiceWhatsAppMessage } from '../utils/whatsapp';
import { resolveImageUrl } from '../utils/imageUrl';


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
  selectedSize?: string;
  selectedColor?: string;
  sku: string;
  imageUrl?: string;
  unitPrice: number;
  quantity: number;
  maxStock: number;
  itemKey?: string;
}

interface PosCustomer {
  id: number;
  name: string;
  phone: string;
  address?: string;
  city?: string;
  creditLimit?: number;
  outstandingBalance?: number;
}

export interface ChequeEntry {
  id: string;
  chequeNumber: string;
  bankName: string;
  chequeDate: string;
  amount: string;
}

export const QuickCheckoutPage: React.FC = () => {
  const { theme } = useTheme();
  const { user, isRep } = useAuth();
  const dark = theme === 'dark';

  const [catalog, setCatalog] = useState<CatalogVariant[]>([]);
  const [customers, setCustomers] = useState<PosCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCustomerBalance, setLoadingCustomerBalance] = useState(false);

  // Mode: Retail vs Wholesale (Locked to Wholesale for REP)
  const isRepUser = isRep || user?.role === 'REP';
  const [pricingMode, setPricingMode] = useState<'RETAIL' | 'WHOLESALE'>(() => isRepUser ? 'WHOLESALE' : 'RETAIL');

  useEffect(() => {
    if (isRepUser) {
      setPricingMode('WHOLESALE');
    }
  }, [isRepUser]);
  const [searchQuery, setSearchQuery] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  // ⭐ Inline quantity edit state with decimal support
  const [editingQtyIndex, setEditingQtyIndex] = useState<number | null>(null);
  const [tempQtyInput, setTempQtyInput] = useState<string>('');


  // Pagination state for product grid
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Checkout and Customer states
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('walk-in');
  const [clientGivenCash, setClientGivenCash] = useState<string>('');
  const [excessMode, setExcessMode] = useState<'CHANGE' | 'SETTLE_DUE'>('CHANGE');
  // Payment methods: Cash, Card, Bank Transfer, Cheque, and Credit (default to CREDIT when no cash is tendered)
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CHEQUE' | 'CREDIT'>('CREDIT');
  const [paymentNote, setPaymentNote] = useState<string>('');
  const [showNoteInput, setShowNoteInput] = useState<boolean>(false);
  const [previousDue, setPreviousDue] = useState<number>(0);

  // Multi-method split payment & cheques modal states
  const [splitModalOpen, setSplitModalOpen] = useState<boolean>(false);
  const [splitPayments, setSplitPayments] = useState<SplitPaymentItem[]>([]);
  const [cheques, setCheques] = useState<ChequeEntry[]>([
    { id: '1', chequeNumber: '', bankName: '', chequeDate: new Date().toISOString().split('T')[0], amount: '' },
  ]);

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
  const [newCustOutstandingBalance, setNewCustOutstandingBalance] = useState('');
  const [creatingCustomer, setCreatingCustomer] = useState(false);

  // Inline edit previous due state
  const [editingPrevDue, setEditingPrevDue] = useState(false);
  const [tempPrevDueInput, setTempPrevDueInput] = useState('');
  const [updatingPrevDue, setUpdatingPrevDue] = useState(false);

  // A4 Invoice preview state
  const [completedOrder, setCompletedOrder] = useState<any>(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Track notified invoice ID to prevent duplicate toast triggers in React StrictMode
  const lastNotifiedEditIdRef = useRef<string | null>(null);

  // Derive active selected customer
  const selectedCustomer = useMemo(() => {
    if (selectedCustomerId === 'walk-in' || !selectedCustomerId) return null;
    return customers.find((c) => String(c.id) === String(selectedCustomerId)) || null;
  }, [customers, selectedCustomerId]);

  /**
   * Real-time live customer record and balance fetch when attached to cart
   */
  useEffect(() => {
    if (selectedCustomerId === 'walk-in' || !selectedCustomerId) {
      setLoadingCustomerBalance(false);
      return;
    }
    const custId = parseInt(selectedCustomerId, 10);
    if (isNaN(custId) || custId <= 0) return;

    let isMounted = true;
    setLoadingCustomerBalance(true);

    get<any>(`/customers/${custId}`)
      .then((freshCustomer) => {
        if (!isMounted || !freshCustomer) return;
        setCustomers((prev) => {
          const exists = prev.some((c) => c.id === freshCustomer.id);
          const updatedRecord: PosCustomer = {
            id: freshCustomer.id,
            name: freshCustomer.name,
            phone: freshCustomer.phone,
            address: freshCustomer.address,
            city: freshCustomer.city,
            creditLimit: Number(freshCustomer.creditLimit) || 0,
            outstandingBalance: Number(freshCustomer.outstandingBalance) || 0,
          };
          if (exists) {
            return prev.map((c) => (c.id === freshCustomer.id ? { ...c, ...updatedRecord } : c));
          }
          return [updatedRecord, ...prev];
        });
      })
      .catch((err) => {
        console.warn('Real-time balance synchronization notice:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingCustomerBalance(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedCustomerId]);

  /**
   * Universal helper to accurately compute customer previous due across Dropdown, Badges, and Financial Summary
   */
  const computeCustomerPreviousDue = (
    cust: PosCustomer | null | undefined,
    isEditMode: boolean,
    origInv: any
  ): number => {
    if (!cust) return 0;
    const custTotal = Number(cust.outstandingBalance ?? (cust as any).due ?? 0);
    if (custTotal <= 0) return 0;

    if (isEditMode && origInv && String(origInv.customerId) === String(cust.id)) {
      const origUnpaid = Math.max(0, Number(origInv.totalAmount || 0) - Number(origInv.paidAmount || 0));
      const origSettled = Number(origInv.settledDueAmount || 0);

      // Account for historical settled due amount recorded on this invoice
      const rawDiff = custTotal - origUnpaid + origSettled;
      const calcDue = Math.max(0, Math.round(rawDiff * 100) / 100);

      // If the difference evaluates to 0 but customer has existing outstanding balance > 0, preserve customer balance correctly
      if (calcDue === 0 && custTotal > 0) {
        return origSettled > 0 ? origSettled : custTotal;
      }
      return calcDue;
    }

    return custTotal;
  };

  /**
   * Synchronize customer previous due credit balance accurately
   */
  useEffect(() => {
    if (!selectedCustomer || selectedCustomerId === 'walk-in') {
      setPreviousDue(0);
      return;
    }
    const truePreviousDue = computeCustomerPreviousDue(selectedCustomer, isEditing, originalInvoice);
    setPreviousDue(truePreviousDue);
  }, [selectedCustomerId, selectedCustomer, isEditing, originalInvoice]);

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
      setCustomers((prev) => {
        if (!Array.isArray(custData)) return prev;
        const map = new Map<number, PosCustomer>();
        custData.forEach((c: any) => {
          map.set(c.id, {
            id: c.id,
            name: c.name,
            phone: c.phone || '',
            address: c.address || '',
            city: c.city || '',
            creditLimit: Number(c.creditLimit) || 0,
            outstandingBalance: Number(c.outstandingBalance) || 0,
          });
        });
        prev.forEach((c) => {
          if (map.has(c.id)) {
            map.set(c.id, { ...map.get(c.id)!, ...c });
          } else {
            map.set(c.id, c);
          }
        });
        return Array.from(map.values());
      });
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

        // Pre-fill Pricing Mode based on order source (Wholesale vs Retail)
        if (inv.source === 'POS_WHOLESALE' || inv.orderType === 'WHOLESALE') {
          setPricingMode('WHOLESALE');
        } else {
          setPricingMode('RETAIL');
        }

        // Pre-fill Customer with phone fallback and sync historical debt
        const custIdStr = inv.customerId ? String(inv.customerId) : 'walk-in';
        setSelectedCustomerId(custIdStr);

        if (inv.customerId) {
          let customerTotalDue = 0;
          let loadedCustomerRecord: PosCustomer | null = null;
          try {
            const freshCust = await get<any>(`/customers/${inv.customerId}`);
            if (freshCust && freshCust.id) {
              customerTotalDue = Number(freshCust.outstandingBalance ?? freshCust.due ?? 0);
              loadedCustomerRecord = {
                id: freshCust.id,
                name: freshCust.name,
                phone: freshCust.phone || '',
                address: freshCust.address || '',
                city: freshCust.city || '',
                creditLimit: Number(freshCust.creditLimit) || 0,
                outstandingBalance: customerTotalDue,
              };
              setCustomers((prev) => {
                const exists = prev.some((c) => c.id === loadedCustomerRecord!.id);
                if (exists) {
                  return prev.map((c) => (c.id === loadedCustomerRecord!.id ? { ...c, ...loadedCustomerRecord } : c));
                }
                return [loadedCustomerRecord!, ...prev];
              });
            }
          } catch (custErr) {
            console.warn('Could not fetch fresh customer in loadEditInvoice:', custErr);
            if (inv.customer && inv.customer.id) {
              customerTotalDue = Number(inv.customer.outstandingBalance ?? inv.customer.due ?? 0);
              loadedCustomerRecord = {
                id: inv.customer.id,
                name: inv.customer.name,
                phone: inv.customer.phone || '',
                address: inv.customer.address || '',
                city: inv.customer.city || '',
                creditLimit: Number(inv.customer.creditLimit) || 0,
                outstandingBalance: customerTotalDue,
              };
              setCustomers((prev) => {
                const exists = prev.some((c) => c.id === loadedCustomerRecord!.id);
                if (exists) {
                  return prev.map((c) => (c.id === loadedCustomerRecord!.id ? { ...c, ...loadedCustomerRecord } : c));
                }
                return [loadedCustomerRecord!, ...prev];
              });
            }
          }

          if (loadedCustomerRecord) {
            const truePreviousDue = computeCustomerPreviousDue(loadedCustomerRecord, true, inv);
            setPreviousDue(truePreviousDue);
          }
        }

        // Pre-fill Payment method
        const loadedMethod: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CHEQUE' | 'CREDIT' =
          inv.paymentMethod === 'CHEQUE'
            ? 'CHEQUE'
            : inv.paymentMethod === 'CARD'
            ? 'CARD'
            : inv.paymentMethod === 'BANK_TRANSFER'
            ? 'BANK_TRANSFER'
            : inv.paymentMethod === 'CREDIT'
            ? 'CREDIT'
            : 'CASH';
        setPaymentMethod(loadedMethod);
        
        // Clean Parse of JSON Notes, Split Payments, and Multi-Cheques on Invoice Edit
        let displayNote = '';
        let extractedSplits: SplitPaymentItem[] = [];
        let extractedCheques: ChequeEntry[] = [];

        if (typeof inv.userNotes === 'string') {
          displayNote = inv.userNotes;
        }

        if (Array.isArray(inv.splitPayments) && inv.splitPayments.length > 0) {
          extractedSplits = inv.splitPayments.map((s: any, idx: number) => ({
            id: s.id || String(idx + 1),
            method: s.method || 'CASH',
            amount: String(s.amount || ''),
            date: s.date || new Date().toISOString().split('T')[0],
            chequeNumber: s.chequeNumber || '',
            bankName: s.bankName || '',
            reference: s.reference || '',
          }));
        }

        if (Array.isArray(inv.cheques) && inv.cheques.length > 0) {
          extractedCheques = inv.cheques.map((c: any, idx: number) => ({
            id: String(idx + 1),
            chequeNumber: c.chequeNumber || '',
            bankName: c.bankName || '',
            chequeDate: c.chequeDate ? new Date(c.chequeDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            amount: String(c.amount || ''),
          }));
        }

        if (inv.notes) {
          try {
            const parsed = typeof inv.notes === 'string' ? JSON.parse(inv.notes) : inv.notes;
            if (parsed && typeof parsed === 'object') {
              displayNote = parsed.userNotes || (typeof parsed === 'string' ? parsed : '');

              if (Array.isArray(parsed.splitPayments) && parsed.splitPayments.length > 0 && extractedSplits.length === 0) {
                extractedSplits = parsed.splitPayments.map((s: any, idx: number) => ({
                  id: s.id || String(idx + 1),
                  method: s.method || 'CASH',
                  amount: String(s.amount || ''),
                  date: s.date || new Date().toISOString().split('T')[0],
                  chequeNumber: s.chequeNumber || '',
                  bankName: s.bankName || '',
                  reference: s.reference || '',
                }));
              }

              if (Array.isArray(parsed.cheques) && parsed.cheques.length > 0 && extractedCheques.length === 0) {
                extractedCheques = parsed.cheques.map((c: any, idx: number) => ({
                  id: String(idx + 1),
                  chequeNumber: c.chequeNumber || '',
                  bankName: c.bankName || '',
                  chequeDate: c.chequeDate ? new Date(c.chequeDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                  amount: String(c.amount || ''),
                }));
              }
            } else if (typeof parsed === 'string') {
              displayNote = parsed;
            }
          } catch {
            displayNote = typeof inv.notes === 'string' && inv.notes.trim().startsWith('{') ? '' : inv.notes;
          }
        }

        if (typeof displayNote === 'string' && displayNote.trim().startsWith('{')) {
          displayNote = '';
        }

        setPaymentNote(displayNote);
        setShowNoteInput(!!displayNote || loadedMethod === 'CHEQUE');

        if (extractedSplits.length > 0) {
          setSplitPayments(extractedSplits);
        }

        if (extractedCheques.length > 0) {
          setCheques(extractedCheques);
        }

        // If invoice has payments in database payments ledger, populate splitPayments & cheques if not already set from notes
        if (Array.isArray(inv.payments) && inv.payments.length > 0) {
          setSplitPayments((prev) => {
            if (prev.length === 0) {
              return inv.payments.map((p: any, idx: number) => {
                let chqNo = '';
                let bName = '';
                if (p.method === 'CHEQUE' && p.reference) {
                  const match = p.reference.match(/Cheque #([^\s(]+)(?:\s*\(([^)]+)\))?/i);
                  if (match) {
                    chqNo = match[1] || '';
                    bName = match[2] || '';
                  }
                }
                return {
                  id: String(p.id || idx + 1),
                  method: p.method === 'CHEQUE' ? 'CHEQUE' : p.method === 'BANK_TRANSFER' ? 'BANK_TRANSFER' : p.method === 'CARD' ? 'CARD' : 'CASH',
                  amount: String(p.amount || ''),
                  date: p.chequeDate ? new Date(p.chequeDate).toISOString().split('T')[0] : (p.createdAt ? new Date(p.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
                  chequeNumber: chqNo,
                  bankName: bName,
                  reference: p.reference || '',
                };
              });
            }
            return prev;
          });

          const chqPayments = inv.payments.filter((p: any) => p.method === 'CHEQUE');
          if (chqPayments.length > 0) {
            setCheques((prev) => {
              if (prev.length === 1 && !prev[0].chequeNumber && !prev[0].amount) {
                return chqPayments.map((p: any, idx: number) => ({
                  id: String(p.id || idx + 1),
                  chequeNumber: p.reference || '',
                  bankName: '',
                  chequeDate: p.chequeDate ? new Date(p.chequeDate).toISOString().split('T')[0] : new Date(p.createdAt || Date.now()).toISOString().split('T')[0],
                  amount: String(p.amount || ''),
                }));
              }
              return prev;
            });
          }
        }

        // Pre-fill Cash Tendered
        setClientGivenCash(String(inv.paidAmount !== undefined ? inv.paidAmount : ''));

        // Pre-fill Cart items
        if (Array.isArray(inv.items)) {
          let parsedItemVariants: any[] = [];
          if (inv.notes) {
            try {
              let current: any = inv.notes;
              while (typeof current === 'string' && current.trim().startsWith('{')) {
                current = JSON.parse(current);
              }
              if (typeof current === 'object' && current !== null && Array.isArray(current.itemVariants)) {
                parsedItemVariants = current.itemVariants;
              }
            } catch {}
          }

          setCart(
            inv.items.map((i: any, idx: number) => {
              const chosenSize = i.size || i.selectedSize || parsedItemVariants[idx]?.size || i.variant?.size || 'FREE';
              const chosenColor = i.color || i.selectedColor || parsedItemVariants[idx]?.color || i.variant?.color || 'Default';
              return {
                variantId: i.variantId,
                name: i.variant?.product?.name || 'Garment Item',
                size: chosenSize,
                color: chosenColor,
                selectedSize: chosenSize,
                selectedColor: chosenColor,
                sku: i.variant?.sku || '',
                imageUrl: i.variant?.product?.images?.[0]?.imageUrl,
                unitPrice: Number(i.unitPrice),
                quantity: Number(i.quantity),
                maxStock: Number((i.variant?.stock || 0) + i.quantity), // Add back currently allocated units so validation succeeds
                itemKey: `${i.variantId}_${chosenSize}_${chosenColor}_${idx}`,
              };
            })
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
   * Add specific variant item to current cashier cart with consolidated sizes & colors
   */
  const addItemToCart = (variant: CatalogVariant, qtyToAdd: number = 1) => {
    if (variant.stock <= 0) {
      toast.error(`"${variant.product.name}" is out of stock`);
      return;
    }

    const price = pricingMode === 'WHOLESALE' ? variant.wholesalePrice : variant.retailPrice;

    // Check total quantity of this physical variant row in cart
    const currentTotalQtyForVariant = cart
      .filter((i) => i.variantId === variant.id)
      .reduce((sum, i) => sum + i.quantity, 0);

    if (currentTotalQtyForVariant + qtyToAdd > variant.stock) {
      toast.error(`Cannot add more. Only ${variant.stock} total in stock for this product.`);
      return;
    }

    const existingIndex = cart.findIndex((i) => i.variantId === variant.id);

    const sizeText = (variant as any).sizes || variant.size || '';
    const colorText = (variant as any).colors || variant.color || '';

    if (existingIndex > -1) {
      const updated = [...cart];
      updated[existingIndex].quantity += qtyToAdd;
      setCart(updated);
    } else {
      setCart([
        ...cart,
        {
          variantId: variant.id,
          name: variant.product.name,
          size: sizeText,
          color: colorText,
          selectedSize: sizeText,
          selectedColor: colorText,
          sku: variant.sku,
          imageUrl: variant.product.images?.[0]?.imageUrl,
          unitPrice: price,
          quantity: qtyToAdd,
          maxStock: variant.stock,
          itemKey: `${variant.id}_${Date.now()}`,
        },
      ]);
    }
  };

  /**
   * Handle Click on Catalog Product:
   * Immediately adds product variant to cart without prompt.
   */
  const handleCatalogItemClick = (variant: CatalogVariant) => {
    if (variant.stock <= 0) {
      toast.error(`"${variant.product.name}" is out of stock`);
      return;
    }
    addItemToCart(variant, 1);
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
      handleCatalogItemClick(matched);
      setBarcodeInput('');
    } else {
      toast.error(`No item found for barcode "${query}"`);
    }
  };

  /**
   * Change item quantity in cart by index
   */
  const updateQty = (itemIndex: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item, idx) => {
          if (idx === itemIndex) {
            const nextQty = item.quantity + delta;
            const otherTotal = prev
              .filter((o, oIdx) => oIdx !== itemIndex && o.variantId === item.variantId)
              .reduce((sum, o) => sum + o.quantity, 0);

            if (otherTotal + nextQty > item.maxStock) {
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
   * Remove variant item directly from cart by index
   */
  const removeFromCart = (itemIndex: number) => {
    setCart((prev) => prev.filter((_, idx) => idx !== itemIndex));
  };

  /**
   * ⭐ Directly update item quantity with full decimal support (e.g. 1.5, 2.25)
   * Validates against maximum stock and non-negative numbers
   */
  const handleApplyDirectQty = (itemIndex: number) => {
    const rawVal = parseFloat(tempQtyInput.trim());
    const targetItem = cart[itemIndex];

    if (!targetItem) {
      setEditingQtyIndex(null);
      return;
    }

    if (isNaN(rawVal) || rawVal <= 0) {
      setCart((prev) => prev.filter((_, idx) => idx !== itemIndex));
      toast.info(`Removed "${targetItem.name}" from order`);
    } else {
      const otherTotal = cart
        .filter((o, oIdx) => oIdx !== itemIndex && o.variantId === targetItem.variantId)
        .reduce((sum, o) => sum + o.quantity, 0);

      if (otherTotal + rawVal > targetItem.maxStock) {
        toast.error(`Only ${targetItem.maxStock} available in stock`);
        const allowed = Math.max(1, targetItem.maxStock - otherTotal);
        setCart((prev) =>
          prev.map((i, idx) => (idx === itemIndex ? { ...i, quantity: allowed } : i))
        );
      } else {
        // Round to maximum 2 decimal places to avoid floating point issues
        const roundedQty = Math.round(rawVal * 100) / 100;
        setCart((prev) =>
          prev.map((i, idx) => (idx === itemIndex ? { ...i, quantity: roundedQty } : i))
        );
      }
    }

    setEditingQtyIndex(null);
    setTempQtyInput('');
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

  // Real-time sum calculation for all split payments
  const totalSplitAmount = useMemo(() => {
    if (splitPayments.length === 0) return 0;
    return splitPayments.reduce((acc, curr) => acc + (Math.max(0, Number(curr.amount)) || 0), 0);
  }, [splitPayments]);

  // Real-time sum calculation for all cheques in multi-cheque split
  const totalChequeAmount = useMemo(() => {
    if (splitPayments.length > 0) {
      return splitPayments
        .filter((s) => s.method === 'CHEQUE')
        .reduce((acc, curr) => acc + (Math.max(0, Number(curr.amount)) || 0), 0);
    }
    if (paymentMethod !== 'CHEQUE') return 0;
    return cheques.reduce((acc, curr) => acc + (Math.max(0, Number(curr.amount)) || 0), 0);
  }, [cheques, paymentMethod, splitPayments]);

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

  // Client Cash parsing (dynamically treat empty, negative, or invalid input as 0)
  const parsedClientCash = Math.max(0, Number(clientGivenCash) || 0);

  // Dynamic real-time balance calculations supporting Cash, Split Multi-Payments, Cheques & Credit
  const tenderedAmount = splitPayments.length > 0
    ? totalSplitAmount
    : (paymentMethod === 'CHEQUE'
      ? totalChequeAmount
      : (clientGivenCash !== ''
        ? parsedClientCash
        : (paymentMethod === 'CREDIT' ? 0 : total)));

  const paidAmount = splitPayments.length > 0
    ? Math.min(total, totalSplitAmount)
    : (paymentMethod === 'CHEQUE'
      ? Math.min(total, totalChequeAmount)
      : (clientGivenCash !== ''
        ? Math.min(total, parsedClientCash)
        : (paymentMethod === 'CREDIT' ? 0 : total)));

  const excessAmount = Math.max(0, tenderedAmount - total);
  const currentBillDue = Math.max(0, total - paidAmount);

  // Outstanding Balance calculations (Previous Due & Accumulated Credit)
  const rawCustomerOutstanding = selectedCustomer ? Number(selectedCustomer.outstandingBalance || 0) : 0;
  
  // In edit mode, subtract original invoice's credit due from live database balance if editing the same customer
  const currentInvoiceUnpaidDebt = isEditing && originalInvoice && String(originalInvoice.customerId) === String(selectedCustomerId)
    ? Math.max(0, Number(originalInvoice.totalAmount || 0) - Number(originalInvoice.paidAmount || 0))
    : 0;

  // Excess Cash Settlement Mode logic
  const canSettleDue = excessAmount > 0 && previousDue > 0;
  const isSettlingDue = excessMode === 'SETTLE_DUE' && canSettleDue;
  const settledDueAmount = isSettlingDue ? Math.min(previousDue, excessAmount) : 0;
  const remainingChange = isSettlingDue ? Math.max(0, excessAmount - settledDueAmount) : excessAmount;

  // Grand cumulative total credit due (TOTAL ACCUMULATED BALANCE DUE = previousDue - settledDueAmount + currentBillDue)
  const totalAccumulatedDue = Math.max(0, Math.round((previousDue - settledDueAmount + currentBillDue) * 100) / 100);

  // Multi-Cheque Split row helpers
  const handleAddCheque = () => {
    setCheques((prev) => [
      ...prev,
      {
        id: Date.now().toString() + Math.random().toString().slice(2, 6),
        chequeNumber: '',
        bankName: '',
        chequeDate: new Date().toISOString().split('T')[0],
        amount: '',
      },
    ]);
  };

  const handleRemoveCheque = (id: string) => {
    setCheques((prev) => {
      const next = prev.filter((c) => c.id !== id);
      return next.length > 0 ? next : [
        {
          id: Date.now().toString(),
          chequeNumber: '',
          bankName: '',
          chequeDate: new Date().toISOString().split('T')[0],
          amount: '',
        },
      ];
    });
  };

  const handleUpdateCheque = (id: string, field: keyof ChequeEntry, value: string) => {
    setCheques((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const handleApplySplitPayments = (appliedSplits: SplitPaymentItem[]) => {
    setSplitPayments(appliedSplits);
    const hasCheque = appliedSplits.some((s) => s.method === 'CHEQUE');
    if (hasCheque) {
      setPaymentMethod('CHEQUE');
      setCheques(
        appliedSplits
          .filter((s) => s.method === 'CHEQUE')
          .map((s, idx) => ({
            id: s.id || String(idx + 1),
            chequeNumber: s.chequeNumber || '',
            bankName: s.bankName || '',
            chequeDate: s.date || new Date().toISOString().split('T')[0],
            amount: s.amount,
          }))
      );
    } else if (appliedSplits.length === 1 && appliedSplits[0].method === 'CASH') {
      setPaymentMethod('CASH');
      setClientGivenCash(String(appliedSplits[0].amount));
    }
  };

  /**
   * Cashier payment method selection:
   * - If Cash is clicked and client cash is empty or 0, auto-fill with exact PAYABLE TOTAL.
   * - If Cheque is clicked, open Split Payment Modal for detailed cheque/split entry.
   * - Cashier can switch to any payment method at any point.
   */
  const handleSelectPaymentMethod = (method: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CHEQUE' | 'CREDIT') => {
    setPaymentMethod(method);
    if (method === 'CASH' || method === 'CARD' || method === 'BANK_TRANSFER') {
      setSplitPayments([]);
      if (!clientGivenCash || Number(clientGivenCash) === 0) {
        if (total > 0) {
          setClientGivenCash(String(total));
        }
      }
    } else if (method === 'CHEQUE') {
      setShowNoteInput(true);
      setSplitModalOpen(true);
    } else if (method === 'CREDIT') {
      setSplitPayments([]);
      setClientGivenCash('');
    }
  };

  /**
   * Cash Tendered Input Change Handler:
   * - If cash >= total and mode was CREDIT, auto-switch to CASH.
   * - If partial cash (< total) and mode was CASH, auto-switch to CREDIT.
   * - If cash is cleared and mode was CASH, return to CREDIT.
   */
  const handleClientCashChange = (val: string) => {
    setClientGivenCash(val);
    const num = Number(val);
    if (val !== '' && !isNaN(num) && num > 0) {
      if (num >= total && paymentMethod === 'CREDIT') {
        setPaymentMethod('CASH');
      } else if (num < total && paymentMethod === 'CASH') {
        setPaymentMethod('CREDIT');
      }
    } else if (val === '' || num === 0) {
      if (paymentMethod === 'CASH') {
        setPaymentMethod('CREDIT');
      }
    }
  };

  /**
   * Inline save customer previous due
   */
  const handleSaveInlinePreviousDue = async () => {
    if (!selectedCustomer) return;
    const newBal = parseFloat(tempPrevDueInput.trim());
    if (isNaN(newBal) || newBal < 0) {
      toast.error('Please enter a valid non-negative number');
      return;
    }
    setUpdatingPrevDue(true);
    try {
      // In edit mode, the total customer outstanding in database must include the original invoice credit due
      // so that previousDue = outstandingBalance - currentInvoiceUnpaidDebt accurately preserves the entered newBal.
      const targetOutstanding = isEditing && originalInvoice && String(originalInvoice.customerId) === String(selectedCustomer.id)
        ? Math.max(0, Math.round((newBal + currentInvoiceUnpaidDebt) * 100) / 100)
        : newBal;

      await put(`/customers/${selectedCustomer.id}`, {
        outstandingBalance: targetOutstanding,
      });
      setCustomers((prev) =>
        prev.map((c) => (c.id === selectedCustomer.id ? { ...c, outstandingBalance: targetOutstanding } : c))
      );
      setPreviousDue(newBal);
      toast.success(`Previous due for ${selectedCustomer.name} updated to Rs. ${newBal.toLocaleString()}`);
      setEditingPrevDue(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update previous due');
    } finally {
      setUpdatingPrevDue(false);
    }
  };

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
        outstandingBalance: newCustOutstandingBalance ? Number(newCustOutstandingBalance) : 0,
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
      setNewCustOutstandingBalance('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to add customer');
    } finally {
      setCreatingCustomer(false);
    }
  };

  /**
   * Stream generated Invoice PDF directly from backend endpoint with auth token fallback
   */
  const handleDownloadPdf = async (invoiceId: number) => {
    try {
      toast.info(`Generating Invoice #INV${invoiceId} PDF...`);
      const apiHost = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const token = localStorage.getItem('token') || localStorage.getItem('auth_token') || sessionStorage.getItem('token');

      const response = await fetch(`${apiHost}/orders/invoices/${invoiceId}/pdf`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => null);
        throw new Error(errJson?.message || `HTTP error ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice-INV${invoiceId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Invoice #INV${invoiceId} PDF downloaded!`);
    } catch (err: any) {
      console.error('PDF download error:', err);
      toast.error(err.message || 'Failed to download Invoice PDF');
    }
  };

  /**
   * Submit transaction order or update existing invoice:
   * - 'SAVE_ONLY': Saves invoice, updates balance/stock, toasts, and resets cart for next sale
   * - 'SAVE_AND_PDF': Atomically saves invoice AND triggers backend PDF streaming download in one tap
   * - 'SAVE_AND_PRINT': Saves invoice and opens A4InvoiceModal preview
   */
  const handleCheckout = async (mode: 'SAVE_ONLY' | 'SAVE_AND_PDF' | 'SAVE_AND_PRINT' = 'SAVE_ONLY') => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    const isWalkIn = selectedCustomerId === 'walk-in' || !selectedCustomerId;
    const isUnderpaid = clientGivenCash !== '' ? parsedClientCash < total : paymentMethod === 'CREDIT';

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
      let resolvedCheques: any[] | undefined = undefined;
      let resolvedSplitPayments: any[] | undefined = undefined;

      if (splitPayments.length > 0) {
        resolvedSplitPayments = splitPayments
          .filter((s) => Number(s.amount) > 0 || (s.method === 'CHEQUE' && s.chequeNumber?.trim()))
          .map((s) => ({
            id: s.id,
            method: s.method,
            amount: Number(s.amount) || 0,
            date: s.date,
            chequeNumber: s.chequeNumber?.trim() || undefined,
            bankName: s.bankName?.trim() || undefined,
            reference: s.reference?.trim() || undefined,
          }));

        const chqList = resolvedSplitPayments.filter((s) => s.method === 'CHEQUE');
        if (chqList.length > 0) {
          resolvedCheques = chqList.map((c) => ({
            chequeNumber: c.chequeNumber || '',
            bankName: c.bankName || '',
            chequeDate: c.date,
            amount: c.amount,
          }));
        }

        resolvedTendered = totalSplitAmount;
        resolvedPaid = Math.min(total, totalSplitAmount);
      } else if (paymentMethod === 'CHEQUE') {
        resolvedCheques = cheques
          .filter((c) => Number(c.amount) > 0 || c.chequeNumber.trim() !== '')
          .map((c) => ({
            chequeNumber: c.chequeNumber.trim(),
            bankName: c.bankName.trim(),
            chequeDate: c.chequeDate,
            amount: Number(c.amount) || 0,
          }));
        resolvedTendered = totalChequeAmount;
        resolvedPaid = Math.min(total, totalChequeAmount);
      } else if (clientGivenCash !== '') {
        // If cashier typed an amount (e.g. 150), honor it as the tendered & paid amount
        resolvedTendered = parsedClientCash;
        resolvedPaid = Math.min(total, parsedClientCash);
      } else if (paymentMethod === 'CREDIT') {
        // Pure zero-down credit sale when no client cash was entered
        resolvedTendered = 0;
        resolvedPaid = 0;
      }

      const creditDue = Math.max(0, total - resolvedPaid);
      const isUnderpaidDue = creditDue > 0;
      const finalSettledDue = isSettlingDue ? settledDueAmount : (excessMode === 'SETTLE_DUE' ? Math.min(previousDue, excessAmount) : 0);

      let cleanUserNote = paymentNote ? paymentNote.trim() : '';
      while (typeof cleanUserNote === 'string' && cleanUserNote.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(cleanUserNote);
          cleanUserNote = parsed.userNotes || '';
        } catch {
          break;
        }
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
          size: i.size,
          color: i.color,
          selectedSize: i.size,
          selectedColor: i.color,
        })),
        subtotal,
        discount: discountAmount,
        discountType,
        totalAmount: total,
        paidAmount: resolvedPaid,
        settledDueAmount: finalSettledDue,
        excessMode: finalSettledDue > 0 ? 'SETTLE_DUE' : excessMode,
        paymentMethod: paymentMethod === 'CREDIT' || isUnderpaidDue ? 'CREDIT' : paymentMethod,
        splitPayments: resolvedSplitPayments && resolvedSplitPayments.length > 0 ? resolvedSplitPayments : undefined,
        cheques: resolvedCheques && resolvedCheques.length > 0 ? resolvedCheques : undefined,
        notes: cleanUserNote || undefined,
      };

      console.log('[POS CHECKOUT PAYLOAD]:', payload);

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

      const checkoutCartSnapshot = cart.map((i) => ({ ...i }));

      setCart([]);
      setDiscountInput(0);
      setClientGivenCash('');
      setExcessMode('CHANGE');
      setPaymentNote('');
      setShowNoteInput(false);
      setPaymentMethod('CREDIT');
      setSplitPayments([]);

      // Synchronize local customer cache with fresh outstanding balance
      if (selectedCust) {
        const freshOutstanding = resultOrder?.customer?.outstandingBalance !== undefined
          ? Number(resultOrder.customer.outstandingBalance)
          : Math.max(0, (selectedCust.outstandingBalance || 0) + (isEditing && String(originalInvoice?.customerId) === String(selectedCust.id) ? (creditDue - currentInvoiceUnpaidDebt) : creditDue) - finalSettledDue);

        setCustomers((prev) =>
          prev.map((c) => (c.id === selectedCust.id ? { ...c, outstandingBalance: freshOutstanding } : c))
        );
      }

      // Immediately re-fetch customers and catalog from server so all views have zero-drift real-time data
      try {
        const [freshCustData, freshCatData] = await Promise.all([
          get<any[]>('/customers'),
          get<CatalogVariant[]>('/orders/catalog'),
        ]);
        if (Array.isArray(freshCustData)) setCustomers(freshCustData);
        if (Array.isArray(freshCatData)) setCatalog(freshCatData);
      } catch (refreshErr) {
        console.warn('Background data refresh notice:', refreshErr);
      }

      const invId = resultOrder?.id || originalInvoice?.id;

      if (mode === 'SAVE_AND_PDF') {
        // Atomically trigger PDF download for saved invoice
        if (invId) {
          await handleDownloadPdf(invId);
        }
        if (isEditing) {
          navigate('/system/invoices');
        }
      } else if (mode === 'SAVE_AND_PRINT') {
        // Accurately pass resolved customer with updated outstandingBalance to A4InvoiceModal
        const targetCustomer = customers.find((c) => String(c.id) === String(selectedCustomerId));
        const updatedCustomerBal = resultOrder?.customer?.outstandingBalance !== undefined
          ? Number(resultOrder.customer.outstandingBalance)
          : Math.max(0, (targetCustomer?.outstandingBalance || 0) + (isEditing ? 0 : creditDue) - finalSettledDue);

        setCompletedOrder({
          ...resultOrder,
          items: (resultOrder?.items || []).map((ri: any, rIdx: number) => ({
            ...ri,
            size: checkoutCartSnapshot[rIdx]?.size || ri.size || ri.variant?.size,
            color: checkoutCartSnapshot[rIdx]?.color || ri.color || ri.variant?.color,
            selectedSize: checkoutCartSnapshot[rIdx]?.size || ri.size || ri.variant?.size,
            selectedColor: checkoutCartSnapshot[rIdx]?.color || ri.color || ri.variant?.color,
          })),
          customer: resultOrder.customer || (targetCustomer ? {
            id: targetCustomer.id,
            name: targetCustomer.name,
            phone: targetCustomer.phone,
            address: targetCustomer.address,
            outstandingBalance: updatedCustomerBal,
          } : undefined),
          notes: payload.notes || resultOrder.notes,
          tenderedAmount: resolvedTendered,
          paidAmount: resolvedPaid,
          settledDueAmount: finalSettledDue,
          discount: discountAmount,
          discountType,
          discountRate: discountType === 'PERCENT' ? discountInput : undefined,
        });
        setInvoiceOpen(true);
        setMobileCartOpen(false);
      } else {
        // 'SAVE_ONLY': Reset cart for next sale and redirect if editing
        setMobileCartOpen(false);
        if (isEditing) {
          navigate('/system/invoices');
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Transaction failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-5rem)] pb-20 lg:pb-0 overflow-y-auto lg:overflow-hidden">
      {/* Left Column: Catalog Browser & Quick Scanner */}
      <div className="flex-1 flex flex-col gap-3 min-w-0 bg-white dark:bg-zinc-900/60 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-zinc-800">
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
            {isRepUser ? (
              <span className="px-3 py-1.5 min-h-[44px] sm:min-h-[36px] text-xs font-bold rounded-lg bg-blue-600 text-white shadow-sm flex items-center justify-center gap-1.5 select-none" title="Pricing mode locked to Wholesale for Representatives">
                Wholesale (Locked)
              </span>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setPricingMode('RETAIL');
                    // Dynamically reprice cart items to Retail prices
                    setCart(prev => prev.map(item => {
                      const matched = catalog.find(c => c.id === item.variantId);
                      const newPrice = matched ? matched.retailPrice : item.unitPrice;
                      return { ...item, unitPrice: newPrice };
                    }));
                  }}
                  className={`px-3 py-1.5 min-h-[44px] sm:min-h-[36px] text-xs font-bold rounded-lg transition-colors cursor-pointer ${pricingMode === 'RETAIL'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400'
                    }`}
                >
                  Retail
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPricingMode('WHOLESALE');
                    // Dynamically reprice cart items to Wholesale prices
                    setCart(prev => prev.map(item => {
                      const matched = catalog.find(c => c.id === item.variantId);
                      const newPrice = matched ? matched.wholesalePrice : item.unitPrice;
                      return { ...item, unitPrice: newPrice };
                    }));
                  }}
                  className={`px-3 py-1.5 min-h-[44px] sm:min-h-[36px] text-xs font-bold rounded-lg transition-colors cursor-pointer ${pricingMode === 'WHOLESALE'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400'
                    }`}
                >
                  Wholesale
                </button>
              </>
            )}
          </div>

          {/* Quick Register Product Button - Hidden for REP (read-only catalog) */}
          {!isRepUser && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate('/system/products/new?returnUrl=/system/quick-checkout')}
              className="h-9 min-h-[44px] sm:min-h-0 px-2.5 text-xs font-semibold gap-1.5 border-dashed border-emerald-500/60 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 shrink-0"
              title="Register new product and return back to POS"
            >
              <Plus className="size-3.5" /> Product
            </Button>
          )}
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
                // Production-safe dynamic API URL resolution
                const apiHost = import.meta.env.VITE_API_URL
                  ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
                  : window.location.origin;

                // Priority 1: Variant directly bound imageUrl or images array
                const variantDirectImage = (v as any).imageUrl || (v as any).images?.[0]?.imageUrl;

                // Priority 2: Match product images pool by variant ID linkage
                const productImages = v.product?.images || [];
                const matchedVariantImage = productImages.find((imgObj: any) =>
                  imgObj.variantId && Number(imgObj.variantId) === Number(v.id)
                )?.imageUrl;

                // Priority 3: Match by color keyword fallback
                const colorKeyword = (v.color || '').toLowerCase().trim();
                const matchedColorImage = productImages.find((imgObj: any) =>
                  colorKeyword && colorKeyword !== 'default' && imgObj.imageUrl.toLowerCase().includes(colorKeyword)
                )?.imageUrl;

                // Priority 4: Fallback to primary product catalog photo
                const targetImg = variantDirectImage || matchedVariantImage || matchedColorImage || productImages[0]?.imageUrl;
                const resolvedUrl = targetImg ? resolveImageUrl(targetImg) : null;

                const currentPrice = pricingMode === 'WHOLESALE' ? v.wholesalePrice : v.retailPrice;

                const sizesList = (v.size || '').split(',').map((s) => s.trim()).filter(Boolean);
                const colorsList = (v.color || '').split(',').map((c) => c.trim()).filter(Boolean);
                const isMultiOption = sizesList.length > 1 || colorsList.length > 1;

                return (
                  <button
                    key={v.id}
                    type="button"
                    disabled={v.stock <= 0}
                    onClick={() => handleCatalogItemClick(v)}
                    className={`flex flex-col text-left rounded-xl border p-2.5 transition-all group relative overflow-hidden cursor-pointer ${v.stock <= 0
                        ? 'opacity-40 cursor-not-allowed border-slate-200 dark:border-zinc-800'
                        : 'border-slate-200 dark:border-zinc-800 hover:border-emerald-500 hover:shadow-md bg-white dark:bg-zinc-950'
                      }`}
                  >
                    {/* Thumbnail Image */}
                    <div className="w-full aspect-square rounded-lg bg-slate-100 dark:bg-zinc-900 mb-2 overflow-hidden flex items-center justify-center relative">
                      {resolvedUrl ? (
                        <img 
                          src={resolvedUrl} 
                          alt="" 
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                        />
                      ) : (
                        <Package className="size-8 text-slate-300 dark:text-zinc-700" />
                      )}
                      {isMultiOption && (
                        <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md bg-emerald-600/90 text-white font-bold text-[8px] tracking-wide uppercase backdrop-blur-xs shadow-xs">
                          Multi-Option
                        </span>
                      )}
                    </div>

                    <h4 className="font-semibold text-xs text-slate-900 dark:text-white line-clamp-1">{v.product.name}</h4>

                    <div className="flex flex-wrap items-center gap-1 my-1">
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 truncate max-w-[110px]" title={v.size || 'FREE'}>
                        {sizesList.length > 2 ? `${sizesList.slice(0, 2).join(', ')}...` : (v.size || 'FREE')}
                      </span>
                      <span className="text-[10px] text-slate-500 truncate max-w-[90px]" title={v.color || 'Default'}>
                        {colorsList.length > 2 ? `${colorsList.slice(0, 2).join(', ')}...` : (v.color || 'Default')}
                      </span>
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
                className="h-9 min-h-[44px] sm:min-h-0 px-3 text-xs"
              >
                <ChevronLeft className="size-3.5" /> Prev
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="h-9 min-h-[44px] sm:min-h-0 px-3 text-xs"
              >
                Next <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Right Column: Checkout Cart & A4 Billing (Desktop Layout) */}
      <div className="hidden lg:flex lg:w-[380px] xl:w-[410px] h-full flex flex-col justify-between overflow-hidden bg-white dark:bg-zinc-900/70 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shrink-0 shadow-sm">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-zinc-800/80 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`p-1.5 rounded-lg ${isEditing ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>
              <ShoppingCart className="size-4" />
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                {isEditing ? `Edit #INV${originalInvoice?.id}` : 'Active Order'}
              </h3>
              <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0 h-4 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
                {cart.length} {cart.length === 1 ? 'item' : 'items'}
              </Badge>
            </div>
            {isEditing && (
              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-950/40">
                EDIT
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
              className="text-xs font-semibold text-rose-500 hover:text-rose-600 dark:text-rose-400 hover:underline cursor-pointer transition-colors"
            >
              {isEditing ? 'Cancel' : 'Clear All'}
            </button>
          )}
        </div>

        {/* Customer Selection Row with Searchable Combobox & Streamlined Live Status */}
        <div className="py-2 border-b border-slate-100 dark:border-zinc-800/80 shrink-0">
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Customer / Account</label>
            <button
              type="button"
              onClick={() => setCustomerModalOpen(true)}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer min-h-[44px] sm:min-h-0"
            >
              <UserPlus className="size-3.5" /> + Add Customer
            </button>
          </div>
          <SearchableSelect
            value={selectedCustomerId}
            onValueChange={setSelectedCustomerId}
            options={[
              { value: 'walk-in', label: 'Walk-in Customer (General)' },
              ...customers.map((c) => {
                const effectiveDue = computeCustomerPreviousDue(c, isEditing, originalInvoice);
                return {
                  value: String(c.id),
                  label: `${c.name} (${c.phone})${effectiveDue > 0 ? ` · Due: Rs. ${Number(effectiveDue).toLocaleString()}` : ''}`,
                };
              }),
            ]}
            placeholder="Select customer..."
            searchPlaceholder="Search by name or phone..."
            dark={dark}
          />

          {/* Consolidated Customer Live Status Banner (Single Compact Pill) */}
          {selectedCustomer && (
            <div className={`mt-1.5 px-2.5 py-1.5 rounded-xl border flex items-center justify-between gap-2 text-xs transition-all ${
              previousDue > 0
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/50 text-amber-900 dark:text-amber-200'
                : 'bg-slate-50 dark:bg-zinc-950/60 border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-200'
            }`}>
              <div className="flex items-center gap-1.5 min-w-0">
                <div className={`size-5 rounded-full flex items-center justify-center shrink-0 ${
                  previousDue > 0 ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300' : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                }`}>
                  <User className="size-3" />
                </div>
                <div className="min-w-0">
                  <span className={`font-semibold text-xs truncate block ${
                    previousDue > 0 ? 'text-amber-950 dark:text-amber-100' : 'text-slate-900 dark:text-white'
                  }`}>
                    {selectedCustomer.name}
                  </span>
                  <span className={`text-[10px] font-mono block leading-none truncate ${
                    previousDue > 0 ? 'text-amber-700/80 dark:text-amber-300/70' : 'text-slate-500 dark:text-zinc-400'
                  }`}>
                    {selectedCustomer.phone} {selectedCustomer.city ? `· ${selectedCustomer.city}` : ''}
                  </span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="flex items-center justify-end gap-1">
                  <span className={`text-[9px] font-bold uppercase tracking-wider ${
                    previousDue > 0 ? 'text-amber-800 dark:text-amber-400' : 'text-slate-400 dark:text-zinc-500'
                  }`}>
                    Previous Due
                  </span>
                  {loadingCustomerBalance && <Loader2 className="size-2.5 animate-spin text-amber-500" />}
                  {!editingPrevDue && (
                    <button
                      type="button"
                      onClick={() => {
                        setTempPrevDueInput(String(previousDue));
                        setEditingPrevDue(true);
                      }}
                      className="p-0.5 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 rounded transition-colors"
                      title="Edit Customer Old Due / Opening Balance"
                    >
                      <Pencil className="size-2.5" />
                    </button>
                  )}
                </div>

                {editingPrevDue ? (
                  <div className="flex items-center gap-1.5 mt-1 justify-end">
                    <span className="text-xs text-slate-500 font-mono">Rs.</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={tempPrevDueInput}
                      onChange={(e) => setTempPrevDueInput(e.target.value)}
                      placeholder="0"
                      autoFocus
                      className="w-24 h-8 px-2.5 text-sm font-semibold rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    />
                    <button
                      type="button"
                      disabled={updatingPrevDue}
                      onClick={handleSaveInlinePreviousDue}
                      className="w-7 h-7 flex items-center justify-center rounded-md bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                      title="Save"
                    >
                      {updatingPrevDue ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                    </button>
                    <button
                      type="button"
                      disabled={updatingPrevDue}
                      onClick={() => setEditingPrevDue(false)}
                      className="w-7 h-7 flex items-center justify-center rounded-md bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 transition-all cursor-pointer"
                      title="Cancel"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ) : (
                  <span className={`font-mono text-xs font-bold block ${
                    previousDue > 0
                      ? 'text-amber-700 dark:text-amber-300'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}>
                    {previousDue > 0 ? `Rs. ${previousDue.toLocaleString()}` : 'Cleared (Rs. 0)'}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Central Order Cart Items - Flexible Scrollable Container */}
        <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800/50 my-1.5 pr-1 space-y-0.5">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-1 text-slate-400 dark:text-zinc-500 text-xs py-4">
              <ShoppingCart className="size-8 opacity-25" />
              <span className="font-medium">Order cart is empty</span>
              <span className="text-[10px] opacity-75">Click products or scan barcode to add</span>
            </div>
          ) : (
            cart.map((item, idx) => {
              const sizeVal = (item as any).sizes || item.size || '';
              const colorVal = (item as any).colors || item.color || '';
              const variantDesc = (sizeVal || colorVal)
                ? `Size: ${sizeVal || 'FREE'} | Color: ${colorVal || 'Default'}`
                : '';

              return (
                <div
                  key={item.itemKey || `${item.variantId}_${idx}`}
                  className="py-1.5 flex items-center justify-between gap-2 group hover:bg-slate-50/60 dark:hover:bg-zinc-800/30 px-1 rounded-lg transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <h5 className="font-semibold text-xs text-slate-900 dark:text-white truncate" title={item.name}>
                      {item.name}
                    </h5>
                    {variantDesc && (
                      <p
                        className="truncate max-w-[180px] text-xs text-muted-foreground text-slate-500 dark:text-zinc-400 mt-0.5"
                        title={variantDesc}
                      >
                        {variantDesc}
                      </p>
                    )}
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      @ Rs. {item.unitPrice.toLocaleString()}
                    </div>
                  </div>

                  {/* Qty Stepper with Decimal Click-to-Edit Input (min 44x44px Touch Targets) */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => updateQty(idx, -1)}
                      className="size-8 sm:size-7 md:size-8 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 md:min-h-[44px] md:min-w-[44px] rounded-lg bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-700 dark:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer select-none active:scale-95"
                      title="Decrease quantity"
                    >
                      <Minus className="size-3.5" />
                    </button>

                    {/* Click-to-Edit Decimal Quantity Input Box */}
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
                        onBlur={() => handleApplyDirectQty(idx)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleApplyDirectQty(idx);
                          } else if (e.key === 'Escape') {
                            setEditingQtyIndex(null);
                          }
                        }}
                        className="w-12 h-8 sm:h-7 md:h-8 min-h-[44px] sm:min-h-0 md:min-h-[44px] text-center font-mono text-xs font-bold bg-white dark:bg-zinc-900 border border-emerald-500 rounded text-emerald-600 dark:text-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingQtyIndex(idx);
                          setTempQtyInput(String(item.quantity));
                        }}
                        className="min-w-8 h-8 sm:h-7 md:h-8 min-h-[44px] sm:min-h-0 md:min-h-[44px] px-1.5 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950/60 font-mono text-xs font-bold text-slate-800 dark:text-zinc-200 flex items-center justify-center cursor-pointer transition-colors border border-transparent hover:border-emerald-300 dark:hover:border-emerald-700 select-none"
                        title="Click to type quantity directly"
                      >
                        {item.quantity}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => updateQty(idx, 1)}
                      className="size-8 sm:size-7 md:size-8 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 md:min-h-[44px] md:min-w-[44px] rounded-lg bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-700 dark:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer select-none active:scale-95"
                      title="Increase quantity"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>

                  {/* Line Total & Remove button (Touch Friendly Min 44x44px target) */}
                  <div className="flex items-center gap-1.5 shrink-0 pl-1">
                    <span className="font-mono font-bold text-xs text-right text-slate-900 dark:text-white min-w-[55px]">
                      Rs. {(item.unitPrice * item.quantity).toLocaleString()}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFromCart(idx)}
                      className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 text-slate-400 hover:text-rose-500 p-2 rounded-lg transition-all cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                      title="Remove item"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Totals, Financial Status & Payment Method - Fixed Bottom Area */}
        <div className="shrink-0 pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-2">
          {/* Subtotal & Discount Row */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400">
              <span className="font-semibold text-slate-700 dark:text-zinc-300">Sub Total:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">Rs. {subtotal.toLocaleString()}</span>
            </div>

            {/* Discount with Type Toggle */}
            <div className="flex items-center justify-end gap-1">
              <span className="text-slate-500 dark:text-zinc-400">Disc:</span>
              <div className="inline-flex rounded border border-slate-200 dark:border-zinc-800 p-0.5 bg-slate-100 dark:bg-zinc-900">
                <button
                  type="button"
                  onClick={() => setDiscountType('PERCENT')}
                  className={`px-1 py-0.2 text-[9px] font-bold rounded ${
                    discountType === 'PERCENT'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400'
                  }`}
                >
                  %
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountType('FIXED')}
                  className={`px-1 py-0.2 text-[9px] font-bold rounded ${
                    discountType === 'FIXED'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400'
                  }`}
                >
                  Rs
                </button>
              </div>
              {discountType === 'PERCENT' && discountAmount > 0 && (
                <span className="text-[10px] font-mono text-emerald-600 font-semibold">
                  (-{discountAmount.toLocaleString()})
                </span>
              )}
              <Input
                type="number"
                min="0"
                max={discountType === 'PERCENT' ? 100 : undefined}
                value={discountInput || ''}
                onChange={(e) => setDiscountInput(Number(e.target.value) || 0)}
                placeholder="0"
                className="w-14 h-6 text-xs text-right font-mono p-1"
              />
            </div>
          </div>

          {/* Current Bill Total & Tendered Input */}
          <div className="flex items-center justify-between py-1.5 px-2.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block leading-tight">Total Due (Current Bill)</span>
              <span className="font-mono text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                Rs. {total.toLocaleString()}
              </span>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block leading-tight">
                Customer Tendered ({paymentMethod})
              </span>
              <Input
                type="number"
                disabled={isEditing}
                value={clientGivenCash}
                onChange={(e) => handleClientCashChange(e.target.value)}
                onFocus={(e) => e.target.select()}
                onClick={(e) => (e.target as HTMLInputElement).select()}
                placeholder={String(total)}
                className={`w-28 h-6 text-xs text-right font-mono font-bold mt-0.5 p-1 ${
                  isEditing
                    ? 'bg-slate-100 dark:bg-zinc-900 cursor-not-allowed !text-black dark:!text-white opacity-100 font-extrabold'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              />
            </div>
          </div>

          {/* Structured Financial Ledger Breakdown */}
          <div className="space-y-1 bg-slate-50/80 dark:bg-zinc-950/60 rounded-xl p-2.5 border border-slate-200/80 dark:border-zinc-800/80 text-xs">
            {/* Paid for Current Bill */}
            <div className="flex items-center justify-between">
              <span className="w-[58%] text-slate-600 dark:text-zinc-400 font-medium">Paid for Current Bill:</span>
              <span className="w-[42%] text-right font-mono font-bold text-slate-900 dark:text-white">
                Rs. {paidAmount.toLocaleString()}
              </span>
            </div>

            {/* Conditionally hide settledDueAmount if 0 */}
            {settledDueAmount > 0 && (
              <div className="flex items-center justify-between text-blue-600 dark:text-blue-400">
                <div className="w-[58%] flex items-center gap-1 font-medium">
                  <span>Due Settled from Tendered:</span>
                  {canSettleDue && (
                    <button
                      type="button"
                      onClick={() => setExcessMode('CHANGE')}
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.2 text-[9px] font-bold rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 transition-colors cursor-pointer"
                      title="Switch to return change to client"
                    >
                      <RotateCcw className="size-2" /> Change
                    </button>
                  )}
                </div>
                <span className="w-[42%] text-right font-mono font-bold">
                  - Rs. {settledDueAmount.toLocaleString()}
                </span>
              </div>
            )}

            {/* Conditionally hide remainingChange if 0 */}
            {remainingChange > 0 && (
              <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                <div className="w-[58%] flex items-center gap-1 font-medium">
                  <span>Change Returned:</span>
                  {canSettleDue && !isSettlingDue && (
                    <button
                      type="button"
                      onClick={() => setExcessMode('SETTLE_DUE')}
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.2 text-[9px] font-bold rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-950 dark:text-blue-300 border border-blue-300 dark:border-blue-800 transition-colors cursor-pointer"
                      title="Settle customer outstanding balance with excess cash"
                    >
                      <RotateCcw className="size-2" /> Settle
                    </button>
                  )}
                </div>
                <span className="w-[42%] text-right font-mono font-bold">
                  Rs. {remainingChange.toLocaleString()}
                </span>
              </div>
            )}

            {/* Previous Due (Old Bills) and Total Accumulated Credit Due */}
            {selectedCustomer && (
              <>
                <div className="border-t border-dashed border-slate-200 dark:border-zinc-800 my-1 pt-1 flex items-center justify-between text-slate-600 dark:text-zinc-400">
                  <span className="w-[58%] font-medium">Previous Due (Old Bills):</span>
                  <span className="w-[42%] text-right font-mono font-bold text-slate-900 dark:text-white">
                    Rs. {previousDue.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-0.5 text-amber-700 dark:text-amber-300 font-extrabold">
                  <span className="w-[58%] text-[10.5px] uppercase tracking-wider font-bold">Total Accumulated Credit Due:</span>
                  <span className="w-[42%] text-right font-mono text-xs font-black">
                    Rs. {totalAccumulatedDue.toLocaleString()}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Payment Method Controls & Note / Cheque Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                Payment Method
              </label>
              <button
                type="button"
                onClick={() => setShowNoteInput((prev) => !prev)}
                className={`text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                  showNoteInput || paymentNote.trim()
                    ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                    : 'text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300'
                }`}
                title={showNoteInput ? 'Collapse note field' : 'Add transaction note / reference'}
              >
                <Pencil className="size-2.5" />
                <span>{paymentNote.trim() ? 'Edit Note' : showNoteInput ? 'Hide Note' : '+ Note'}</span>
              </button>
            </div>

            {/* Optional General Note Field */}
            {showNoteInput && (
              <div className="relative flex items-center animate-in fade-in duration-150">
                <FileText className="absolute left-2.5 size-3.5 text-slate-400 dark:text-zinc-500 pointer-events-none" />
                <Input
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="Payment note, ref no, or transaction details..."
                  className="pl-8 pr-7 h-7 text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-black dark:text-white font-medium placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus-visible:ring-1 focus-visible:ring-emerald-500 transition-colors"
                />
                {paymentNote && (
                  <button
                    type="button"
                    onClick={() => setPaymentNote('')}
                    className="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 text-xs p-0.5 cursor-pointer"
                    title="Clear note"
                  >
                    ×
                  </button>
                )}
              </div>
            )}

            {/* Split Payment Banner / Status */}
            {splitPayments.length > 0 ? (
              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-[11px] animate-in fade-in duration-150">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Layers className="size-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <div className="truncate">
                    <span className="font-bold text-indigo-900 dark:text-indigo-200">
                      Split Active ({splitPayments.length} methods):{' '}
                    </span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      Rs. {totalSplitAmount.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSplitModalOpen(true)}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 underline cursor-pointer"
                  >
                    Edit Splits
                  </button>
                  <span className="text-slate-300 dark:text-zinc-700">·</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSplitPayments([]);
                      setCheques([{ id: '1', chequeNumber: '', bankName: '', chequeDate: new Date().toISOString().split('T')[0], amount: '' }]);
                      setPaymentMethod('CASH');
                      setClientGivenCash(String(total));
                    }}
                    className="text-[10px] font-bold text-rose-500 hover:text-rose-700 cursor-pointer"
                    title="Clear split configuration"
                  >
                    Clear
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-100/70 dark:bg-zinc-900/60 border border-slate-200/60 dark:border-zinc-800/60 text-[11px]">
                <span className="text-slate-500 dark:text-zinc-400 text-[10px] sm:text-[11px]">
                  Need split payment (Cash / Card / Cheque)?
                </span>
                <button
                  type="button"
                  onClick={() => setSplitModalOpen(true)}
                  className="text-[10px] sm:text-[11px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Layers className="size-3" />
                  <span>Split Payment →</span>
                </button>
              </div>
            )}

            {/* Payment Method Selector Buttons (5 Methods) */}
            <div className="grid grid-cols-5 gap-1">
              <button
                type="button"
                onClick={() => handleSelectPaymentMethod('CASH')}
                className={`flex items-center justify-center gap-1 py-1.5 min-h-[44px] sm:min-h-0 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer ${
                  paymentMethod === 'CASH' && splitPayments.length === 0
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold shadow-xs'
                    : 'border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/50'
                }`}
                title="Cash Payment"
              >
                <Banknote className="size-3.5" /> <span className="hidden sm:inline">Cash</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectPaymentMethod('CARD')}
                className={`flex items-center justify-center gap-1 py-1.5 min-h-[44px] sm:min-h-0 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer ${
                  paymentMethod === 'CARD' && splitPayments.length === 0
                    ? 'border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold shadow-xs'
                    : 'border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/50'
                }`}
                title="Credit/Debit Card POS Payment"
              >
                <CreditCard className="size-3.5" /> <span className="hidden sm:inline">Card</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectPaymentMethod('BANK_TRANSFER')}
                className={`flex items-center justify-center gap-1 py-1.5 min-h-[44px] sm:min-h-0 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer ${
                  paymentMethod === 'BANK_TRANSFER' && splitPayments.length === 0
                    ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold shadow-xs'
                    : 'border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/50'
                }`}
                title="Bank Transfer Payment"
              >
                <Landmark className="size-3.5" /> <span className="hidden sm:inline">Bank</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectPaymentMethod('CHEQUE')}
                className={`flex items-center justify-center gap-1 py-1.5 min-h-[44px] sm:min-h-0 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer ${
                  paymentMethod === 'CHEQUE' && splitPayments.length === 0
                    ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold shadow-xs'
                    : 'border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/50'
                }`}
                title="Cheque Payment"
              >
                <FileText className="size-3.5" /> <span className="hidden sm:inline">Cheque</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectPaymentMethod('CREDIT')}
                className={`flex items-center justify-center gap-1 py-1.5 min-h-[44px] sm:min-h-0 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer ${
                  paymentMethod === 'CREDIT'
                    ? 'border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold shadow-xs'
                    : 'border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/50'
                }`}
                title="Credit Account / Payable Later"
              >
                <Building className="size-3.5" /> <span className="hidden sm:inline">Credit</span>
              </button>
            </div>
          </div>

          {/* Action Buttons: Dual Checkout Triggers ("Save Invoice Only" & "Save & Download PDF") */}
          <div className="flex flex-col sm:flex-row items-stretch gap-2 w-full pt-1">
            <Button
              type="button"
              disabled={cart.length === 0 || submitting}
              onClick={() => handleCheckout('SAVE_ONLY')}
              className="flex-1 min-h-[48px] h-12 gap-2 bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-100 dark:border-zinc-700 dark:border-zinc-750 font-bold text-xs sm:text-sm rounded-xl shadow-xs cursor-pointer transition-all active:scale-[0.98]"
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4 text-slate-700 dark:text-zinc-300" />}
              <span>{isEditing ? 'Save Changes Only' : 'Save Invoice Only'}</span>
            </Button>
            <Button
              type="button"
              disabled={cart.length === 0 || submitting}
              onClick={() => handleCheckout('SAVE_AND_PDF')}
              className="flex-1 min-h-[48px] h-12 gap-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-sm cursor-pointer transition-all active:scale-[0.98]"
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4 text-white" />}
              <span>Save &amp; Download PDF</span>
            </Button>
          </div>
          {/* Optional Print Preview Modal Trigger */}
          <div className="flex justify-center pt-0.5">
            <button
              type="button"
              disabled={cart.length === 0 || submitting}
              onClick={() => handleCheckout('SAVE_AND_PRINT')}
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200 inline-flex items-center gap-1 cursor-pointer hover:underline disabled:opacity-50 min-h-[36px] sm:min-h-0"
            >
              <Printer className="size-3" />
              <span>Or Save &amp; Print Preview</span>
            </button>
          </div>
        </div>
      </div>

      {/* Floating Bottom Sticky Cart Bar (< 1024px) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 p-3 bg-zinc-950/90 border-t border-zinc-800 z-40 backdrop-blur-md flex items-center justify-between gap-3 shadow-2xl">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative p-2 rounded-xl bg-zinc-900 text-emerald-400 border border-zinc-800 shrink-0">
            <ShoppingCart className="size-5" />
            {cart.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-emerald-600 text-white font-mono font-bold text-[10px] flex items-center justify-center shadow-xs">
                {cart.reduce((sum, item) => sum + item.quantity, 0)}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-zinc-400 truncate font-medium">
              {selectedCustomer ? selectedCustomer.name : 'Walk-in Customer'}
            </div>
            <div className="font-mono font-extrabold text-sm sm:text-base text-emerald-400 leading-tight">
              Rs. {total.toLocaleString()}
            </div>
          </div>
        </div>

        <Button
          type="button"
          onClick={() => setMobileCartOpen(true)}
          className="min-h-[48px] h-12 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-emerald-950/40 shrink-0 cursor-pointer active:scale-95 transition-all"
        >
          <ShoppingCart className="size-4" />
          <span>Review Order &amp; Checkout</span>
        </Button>
      </div>

      {/* Touch-Friendly Bottom Sheet Drawer for Mobile/Tablet (< 1024px) */}
      <Drawer open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
        <DrawerContent className="h-[92vh] max-h-[92vh] flex flex-col overflow-hidden p-3.5 sm:p-4">
          <div className="flex-1 min-h-0 flex flex-col justify-between overflow-y-auto">
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-zinc-800/80 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className={`p-1.5 rounded-lg ${isEditing ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>
                  <ShoppingCart className="size-4" />
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                    {isEditing ? `Edit #INV${originalInvoice?.id}` : 'Active Order'}
                  </h3>
                  <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0 h-4 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
                    {cart.length} {cart.length === 1 ? 'item' : 'items'}
                  </Badge>
                </div>
                {isEditing && (
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-950/40">
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
                      if (isEditing) {
                        navigate('/system/quick-checkout');
                        setIsEditing(false);
                        setOriginalInvoice(null);
                      }
                      setMobileCartOpen(false);
                    }}
                    className="text-xs font-semibold text-rose-500 hover:text-rose-600 dark:text-rose-400 hover:underline cursor-pointer transition-colors"
                  >
                    {isEditing ? 'Cancel' : 'Clear All'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setMobileCartOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                  title="Close Cart Drawer"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            {/* Customer Selection in Mobile Drawer */}
            <div className="py-2 border-b border-slate-100 dark:border-zinc-800/80 shrink-0">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Customer / Account</label>
                <button
                  type="button"
                  onClick={() => {
                    setCustomerModalOpen(true);
                  }}
                  className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer min-h-[44px] sm:min-h-0"
                >
                  <UserPlus className="size-3.5" /> + Add Customer
                </button>
              </div>
              <SearchableSelect
                value={selectedCustomerId}
                onValueChange={setSelectedCustomerId}
                options={[
                  { value: 'walk-in', label: 'Walk-in Customer (General)' },
                  ...customers.map((c) => {
                    const effectiveDue = computeCustomerPreviousDue(c, isEditing, originalInvoice);
                    return {
                      value: String(c.id),
                      label: `${c.name} (${c.phone})${effectiveDue > 0 ? ` · Due: Rs. ${Number(effectiveDue).toLocaleString()}` : ''}`,
                    };
                  }),
                ]}
                placeholder="Select customer..."
                searchPlaceholder="Search by name or phone..."
                dark={dark}
              />

              {/* Customer Live Status Banner */}
              {selectedCustomer && (
                <div className={`mt-1.5 px-2.5 py-1.5 rounded-xl border flex items-center justify-between gap-2 text-xs transition-all ${
                  previousDue > 0
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/50 text-amber-900 dark:text-amber-200'
                    : 'bg-slate-50 dark:bg-zinc-950/60 border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-200'
                }`}>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className={`size-5 rounded-full flex items-center justify-center shrink-0 ${
                      previousDue > 0 ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300' : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                    }`}>
                      <User className="size-3" />
                    </div>
                    <div className="min-w-0">
                      <span className={`font-semibold text-xs truncate block ${
                        previousDue > 0 ? 'text-amber-950 dark:text-amber-100' : 'text-slate-900 dark:text-white'
                      }`}>
                        {selectedCustomer.name}
                      </span>
                      <span className={`text-[10px] font-mono block leading-none truncate ${
                        previousDue > 0 ? 'text-amber-700/80 dark:text-amber-300/70' : 'text-slate-500 dark:text-zinc-400'
                      }`}>
                        {selectedCustomer.phone} {selectedCustomer.city ? `· ${selectedCustomer.city}` : ''}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="flex items-center justify-end gap-1">
                      <span className={`text-[9px] font-bold uppercase tracking-wider ${
                        previousDue > 0 ? 'text-amber-800 dark:text-amber-400' : 'text-slate-400 dark:text-zinc-500'
                      }`}>
                        Previous Due
                      </span>
                      {loadingCustomerBalance && <Loader2 className="size-2.5 animate-spin text-amber-500" />}
                      {!editingPrevDue && (
                        <button
                          type="button"
                          onClick={() => {
                            setTempPrevDueInput(String(previousDue));
                            setEditingPrevDue(true);
                          }}
                          className="p-0.5 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 rounded transition-colors"
                          title="Edit Customer Old Due"
                        >
                          <Pencil className="size-2.5" />
                        </button>
                      )}
                    </div>

                    {editingPrevDue ? (
                      <div className="flex items-center gap-1.5 mt-1 justify-end">
                        <span className="text-xs text-slate-500 font-mono">Rs.</span>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={tempPrevDueInput}
                          onChange={(e) => setTempPrevDueInput(e.target.value)}
                          placeholder="0"
                          autoFocus
                          className="w-24 h-8 px-2.5 text-sm font-semibold rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                        />
                        <button
                          type="button"
                          disabled={updatingPrevDue}
                          onClick={handleSaveInlinePreviousDue}
                          className="w-7 h-7 flex items-center justify-center rounded-md bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                          title="Save"
                        >
                          {updatingPrevDue ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                        </button>
                        <button
                          type="button"
                          disabled={updatingPrevDue}
                          onClick={() => setEditingPrevDue(false)}
                          className="w-7 h-7 flex items-center justify-center rounded-md bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 transition-all cursor-pointer"
                          title="Cancel"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className={`font-mono text-xs font-bold block ${
                        previousDue > 0
                          ? 'text-amber-700 dark:text-amber-300'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {previousDue > 0 ? `Rs. ${previousDue.toLocaleString()}` : 'Cleared (Rs. 0)'}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Cart Line Items in Mobile Drawer */}
            <div className="flex-1 min-h-[140px] max-h-[35vh] overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800/50 my-1.5 pr-1 space-y-0.5">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-1 text-slate-400 dark:text-zinc-500 text-xs py-6">
                  <ShoppingCart className="size-8 opacity-25" />
                  <span className="font-medium">Order cart is empty</span>
                  <span className="text-[10px] opacity-75">Add products from catalog</span>
                </div>
              ) : (
                cart.map((item, idx) => {
                  const sizeVal = (item as any).sizes || item.size || '';
                  const colorVal = (item as any).colors || item.color || '';
                  const variantDesc = (sizeVal || colorVal)
                    ? `Size: ${sizeVal || 'FREE'} | Color: ${colorVal || 'Default'}`
                    : '';

                  return (
                    <div
                      key={`mob_${item.itemKey || `${item.variantId}_${idx}`}`}
                      className="py-1.5 flex items-center justify-between gap-2 hover:bg-slate-50/60 dark:hover:bg-zinc-800/30 px-1 rounded-lg transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <h5 className="font-semibold text-xs text-slate-900 dark:text-white truncate" title={item.name}>
                          {item.name}
                        </h5>
                        {variantDesc && (
                          <p className="truncate max-w-[180px] text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                            {variantDesc}
                          </p>
                        )}
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          @ Rs. {item.unitPrice.toLocaleString()}
                        </div>
                      </div>

                      {/* Stepper with 44px min touch target */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => updateQty(idx, -1)}
                          className="size-9 min-h-[44px] min-w-[44px] rounded-lg bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-700 dark:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer select-none active:scale-95"
                          title="Decrease quantity"
                        >
                          <Minus className="size-3.5" />
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
                            onBlur={() => handleApplyDirectQty(idx)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleApplyDirectQty(idx);
                              } else if (e.key === 'Escape') {
                                setEditingQtyIndex(null);
                              }
                            }}
                            className="w-12 h-9 min-h-[44px] text-center font-mono text-xs font-bold bg-white dark:bg-zinc-900 border border-emerald-500 rounded text-emerald-600 dark:text-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingQtyIndex(idx);
                              setTempQtyInput(String(item.quantity));
                            }}
                            className="min-w-9 h-9 min-h-[44px] px-1.5 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950/60 font-mono text-xs font-bold text-slate-800 dark:text-zinc-200 flex items-center justify-center cursor-pointer transition-colors border border-transparent select-none"
                            title="Click to type quantity directly"
                          >
                            {item.quantity}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => updateQty(idx, 1)}
                          className="size-9 min-h-[44px] min-w-[44px] rounded-lg bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-700 dark:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer select-none active:scale-95"
                          title="Increase quantity"
                        >
                          <Plus className="size-3.5" />
                        </button>
                      </div>

                      {/* Line total & remove */}
                      <div className="flex items-center gap-1.5 shrink-0 pl-1">
                        <span className="font-mono font-bold text-xs text-right text-slate-900 dark:text-white min-w-[55px]">
                          Rs. {(item.unitPrice * item.quantity).toLocaleString()}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFromCart(idx)}
                          className="text-slate-400 hover:text-rose-500 p-2 rounded-lg transition-all cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                          title="Remove item"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Financial Ledger & Payment Method in Mobile Drawer */}
            <div className="shrink-0 pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-2">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400">
                  <span className="font-semibold text-slate-700 dark:text-zinc-300">Sub Total:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">Rs. {subtotal.toLocaleString()}</span>
                </div>

                <div className="flex items-center justify-end gap-1">
                  <span className="text-slate-500 dark:text-zinc-400">Disc:</span>
                  <div className="inline-flex rounded border border-slate-200 dark:border-zinc-800 p-0.5 bg-slate-100 dark:bg-zinc-900">
                    <button
                      type="button"
                      onClick={() => setDiscountType('PERCENT')}
                      className={`px-1 py-0.2 text-[9px] font-bold rounded ${
                        discountType === 'PERCENT'
                          ? 'bg-emerald-600 text-white'
                          : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400'
                      }`}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType('FIXED')}
                      className={`px-1 py-0.2 text-[9px] font-bold rounded ${
                        discountType === 'FIXED'
                          ? 'bg-emerald-600 text-white'
                          : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400'
                      }`}
                    >
                      Rs
                    </button>
                  </div>
                  {discountType === 'PERCENT' && discountAmount > 0 && (
                    <span className="text-[10px] font-mono text-emerald-600 font-semibold">
                      (-{discountAmount.toLocaleString()})
                    </span>
                  )}
                  <Input
                    type="number"
                    min="0"
                    max={discountType === 'PERCENT' ? 100 : undefined}
                    value={discountInput || ''}
                    onChange={(e) => setDiscountInput(Number(e.target.value) || 0)}
                    placeholder="0"
                    className="w-14 h-6 text-xs text-right font-mono p-1"
                  />
                </div>
              </div>

              {/* Bill Total & Tendered Input */}
              <div className="flex items-center justify-between py-1.5 px-2.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block leading-tight">Total Due (Current Bill)</span>
                  <span className="font-mono text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                    Rs. {total.toLocaleString()}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block leading-tight">
                    Customer Tendered ({paymentMethod})
                  </span>
                  <Input
                    type="number"
                    disabled={isEditing}
                    value={clientGivenCash}
                    onChange={(e) => handleClientCashChange(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    placeholder={String(total)}
                    className={`w-28 h-6 text-xs text-right font-mono font-bold mt-0.5 p-1 ${
                      isEditing
                        ? 'bg-slate-100 dark:bg-zinc-900 cursor-not-allowed !text-black dark:!text-white opacity-100 font-extrabold'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  />
                </div>
              </div>

              {/* Financial Ledger Breakdown */}
              <div className="space-y-1 bg-slate-50/80 dark:bg-zinc-950/60 rounded-xl p-2.5 border border-slate-200/80 dark:border-zinc-800/80 text-xs">
                <div className="flex items-center justify-between">
                  <span className="w-[58%] text-slate-600 dark:text-zinc-400 font-medium">Paid for Current Bill:</span>
                  <span className="w-[42%] text-right font-mono font-bold text-slate-900 dark:text-white">
                    Rs. {paidAmount.toLocaleString()}
                  </span>
                </div>

                {settledDueAmount > 0 && (
                  <div className="flex items-center justify-between text-blue-600 dark:text-blue-400">
                    <div className="w-[58%] flex items-center gap-1 font-medium">
                      <span>Due Settled from Tendered:</span>
                      {canSettleDue && (
                        <button
                          type="button"
                          onClick={() => setExcessMode('CHANGE')}
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.2 text-[9px] font-bold rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 transition-colors cursor-pointer"
                        >
                          <RotateCcw className="size-2" /> Change
                        </button>
                      )}
                    </div>
                    <span className="w-[42%] text-right font-mono font-bold">
                      - Rs. {settledDueAmount.toLocaleString()}
                    </span>
                  </div>
                )}

                {remainingChange > 0 && (
                  <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                    <div className="w-[58%] flex items-center gap-1 font-medium">
                      <span>Change Returned:</span>
                      {canSettleDue && !isSettlingDue && (
                        <button
                          type="button"
                          onClick={() => setExcessMode('SETTLE_DUE')}
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.2 text-[9px] font-bold rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-950 dark:text-blue-300 border border-blue-300 dark:border-blue-800 transition-colors cursor-pointer"
                        >
                          <RotateCcw className="size-2" /> Settle
                        </button>
                      )}
                    </div>
                    <span className="w-[42%] text-right font-mono font-bold">
                      Rs. {remainingChange.toLocaleString()}
                    </span>
                  </div>
                )}

                {selectedCustomer && (
                  <>
                    <div className="border-t border-dashed border-slate-200 dark:border-zinc-800 my-1 pt-1 flex items-center justify-between text-slate-600 dark:text-zinc-400">
                      <span className="w-[58%] font-medium">Previous Due (Old Bills):</span>
                      <span className="w-[42%] text-right font-mono font-bold text-slate-900 dark:text-white">
                        Rs. {previousDue.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-0.5 text-amber-700 dark:text-amber-300 font-extrabold">
                      <span className="w-[58%] text-[10.5px] uppercase tracking-wider font-bold">Total Accumulated Credit Due:</span>
                      <span className="w-[42%] text-right font-mono text-xs font-black">
                        Rs. {totalAccumulatedDue.toLocaleString()}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Payment Methods */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                    Payment Method
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowNoteInput((prev) => !prev)}
                    className={`text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                      showNoteInput || paymentNote.trim()
                        ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                        : 'text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300'
                    }`}
                  >
                    <Pencil className="size-2.5" />
                    <span>{paymentNote.trim() ? 'Edit Note' : showNoteInput ? 'Hide Note' : '+ Note'}</span>
                  </button>
                </div>

                {showNoteInput && (
                  <div className="relative flex items-center animate-in fade-in duration-150">
                    <FileText className="absolute left-2.5 size-3.5 text-slate-400 dark:text-zinc-500 pointer-events-none" />
                    <Input
                      value={paymentNote}
                      onChange={(e) => setPaymentNote(e.target.value)}
                      placeholder="Payment note, ref no, or transaction details..."
                      className="pl-8 pr-7 h-7 text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-black dark:text-white font-medium placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus-visible:ring-1 focus-visible:ring-emerald-500 transition-colors"
                    />
                    {paymentNote && (
                      <button
                        type="button"
                        onClick={() => setPaymentNote('')}
                        className="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 text-xs p-0.5 cursor-pointer"
                        title="Clear note"
                      >
                        ×
                      </button>
                    )}
                  </div>
                )}

                {splitPayments.length > 0 ? (
                  <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-[11px]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Layers className="size-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <div className="truncate">
                        <span className="font-bold text-indigo-900 dark:text-indigo-200">
                          Split Active ({splitPayments.length} methods):{' '}
                        </span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          Rs. {totalSplitAmount.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setSplitModalOpen(true)}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 underline cursor-pointer"
                      >
                        Edit Splits
                      </button>
                      <span className="text-slate-300 dark:text-zinc-700">·</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSplitPayments([]);
                          setCheques([{ id: '1', chequeNumber: '', bankName: '', chequeDate: new Date().toISOString().split('T')[0], amount: '' }]);
                          setPaymentMethod('CASH');
                          setClientGivenCash(String(total));
                        }}
                        className="text-[10px] font-bold text-rose-500 hover:text-rose-700 cursor-pointer"
                        title="Clear split configuration"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-100/70 dark:bg-zinc-900/60 border border-slate-200/60 dark:border-zinc-800/60 text-[11px]">
                    <span className="text-slate-500 dark:text-zinc-400 text-[10px] sm:text-[11px]">
                      Need split payment (Cash / Card / Cheque)?
                    </span>
                    <button
                      type="button"
                      onClick={() => setSplitModalOpen(true)}
                      className="text-[10px] sm:text-[11px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <Layers className="size-3" />
                      <span>Split Payment →</span>
                    </button>
                  </div>
                )}

                {/* 5 Payment method triggers */}
                <div className="grid grid-cols-5 gap-1">
                  <button
                    type="button"
                    onClick={() => handleSelectPaymentMethod('CASH')}
                    className={`flex items-center justify-center gap-1 py-1.5 min-h-[44px] rounded-lg border text-[11px] font-semibold transition-all cursor-pointer ${
                      paymentMethod === 'CASH' && splitPayments.length === 0
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold shadow-xs'
                        : 'border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/50'
                    }`}
                  >
                    <Banknote className="size-3.5" /> <span>Cash</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPaymentMethod('CARD')}
                    className={`flex items-center justify-center gap-1 py-1.5 min-h-[44px] rounded-lg border text-[11px] font-semibold transition-all cursor-pointer ${
                      paymentMethod === 'CARD' && splitPayments.length === 0
                        ? 'border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold shadow-xs'
                        : 'border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/50'
                    }`}
                  >
                    <CreditCard className="size-3.5" /> <span>Card</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPaymentMethod('BANK_TRANSFER')}
                    className={`flex items-center justify-center gap-1 py-1.5 min-h-[44px] rounded-lg border text-[11px] font-semibold transition-all cursor-pointer ${
                      paymentMethod === 'BANK_TRANSFER' && splitPayments.length === 0
                        ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold shadow-xs'
                        : 'border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/50'
                    }`}
                  >
                    <Landmark className="size-3.5" /> <span>Bank</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPaymentMethod('CHEQUE')}
                    className={`flex items-center justify-center gap-1 py-1.5 min-h-[44px] rounded-lg border text-[11px] font-semibold transition-all cursor-pointer ${
                      paymentMethod === 'CHEQUE' && splitPayments.length === 0
                        ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold shadow-xs'
                        : 'border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/50'
                    }`}
                  >
                    <FileText className="size-3.5" /> <span>Cheque</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPaymentMethod('CREDIT')}
                    className={`flex items-center justify-center gap-1 py-1.5 min-h-[44px] rounded-lg border text-[11px] font-semibold transition-all cursor-pointer ${
                      paymentMethod === 'CREDIT'
                        ? 'border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold shadow-xs'
                        : 'border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/50'
                    }`}
                  >
                    <Building className="size-3.5" /> <span>Credit</span>
                  </button>
                </div>
              </div>

              {/* Action Buttons in Mobile Drawer */}
              <div className="flex flex-col sm:flex-row items-stretch gap-2 w-full pt-1">
                <Button
                  type="button"
                  disabled={cart.length === 0 || submitting}
                  onClick={() => handleCheckout('SAVE_ONLY')}
                  className="flex-1 min-h-[48px] h-12 gap-2 bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-100 dark:border-zinc-700 dark:border-zinc-750 font-bold text-xs sm:text-sm rounded-xl shadow-xs cursor-pointer transition-all active:scale-[0.98]"
                >
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4 text-slate-700 dark:text-zinc-300" />}
                  <span>{isEditing ? 'Save Changes Only' : 'Save Invoice Only'}</span>
                </Button>
                <Button
                  type="button"
                  disabled={cart.length === 0 || submitting}
                  onClick={() => handleCheckout('SAVE_AND_PDF')}
                  className="flex-1 min-h-[48px] h-12 gap-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-sm cursor-pointer transition-all active:scale-[0.98]"
                >
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4 text-white" />}
                  <span>Save &amp; Download PDF</span>
                </Button>
              </div>
              <div className="flex justify-center pt-0.5 pb-1">
                <button
                  type="button"
                  disabled={cart.length === 0 || submitting}
                  onClick={() => handleCheckout('SAVE_AND_PRINT')}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200 inline-flex items-center gap-1 cursor-pointer hover:underline disabled:opacity-50 min-h-[36px] flex items-center"
                >
                  <Printer className="size-3" />
                  <span>Or Save &amp; Print Preview</span>
                </button>
              </div>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

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
            <div className="space-y-1">
              <label className="text-xs font-semibold text-amber-700 dark:text-amber-400">Opening / Old Due Balance (Rs)</label>
              <Input
                type="number"
                step="any"
                min="0"
                value={newCustOutstandingBalance}
                onChange={(e) => setNewCustOutstandingBalance(e.target.value)}
                placeholder="0.00"
                className="font-mono"
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

      {/* Split / Multi-Method Payment Modal */}
      <SplitPaymentModal
        open={splitModalOpen}
        onOpenChange={setSplitModalOpen}
        totalBill={total}
        initialSplits={
          splitPayments.length > 0
            ? splitPayments
            : cheques.some((c) => Number(c.amount) > 0 || c.chequeNumber.trim())
            ? cheques.map((c) => ({
                id: c.id,
                method: 'CHEQUE',
                amount: c.amount,
                date: c.chequeDate,
                chequeNumber: c.chequeNumber,
                bankName: c.bankName,
              }))
            : undefined
        }
        onApply={handleApplySplitPayments}
        dark={dark}
      />


      {/* Headless Direct A4 Browser Print Window Trigger (Conditional Mount Prevents Duplicate Preview Loop) */}
      {invoiceOpen && completedOrder && (
        <A4InvoiceModal
          open={invoiceOpen}
          onClose={() => {
            setInvoiceOpen(false);
            setCompletedOrder(null);
            // ⭐ මුද්‍රණ සංවාද කවුළුව වැසුණු විගස ආරක්ෂිතව Invoices ලැයිස්තුවට යවයි
            if (isEditing) {
              navigate('/system/invoices');
            } else {
              bootstrapPos();
            }
          }}
          order={completedOrder}
          autoPrint={true}
        />
      )}
    </div>
  );
};