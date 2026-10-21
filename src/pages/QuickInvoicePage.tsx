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
import { printInvoiceDirectly, print80mmThermalReceiptDirectly } from '../utils/print';
import { ThermalReceipt80mm } from '../components/pos/ThermalReceipt80mm';
import { ProductPreviewModal } from '../components/pos/ProductPreviewModal';
import { AnimatedInlineQtyInput } from '../components/pos/AnimatedInlineQtyInput';
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
  MessageSquare,
  Percent,
  Eye,
} from 'lucide-react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { openWhatsAppChat, generateCustomerInvoiceWhatsAppMessage } from '../utils/whatsapp';
import { resolveImageUrl, handleImageError } from '../utils/imageUrl';


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
  id?: number | string;
  variantId: number;
  productId?: number;
  name: string;
  size: string;
  color: string;
  selectedSize?: string;
  selectedColor?: string;
  sku: string;
  imageUrl?: string;
  unitPrice: number;
  sellingPrice?: number;
  quantity: number;
  qty?: number;
  maxStock: number;
  itemKey?: string;
  // ⭐ Item-wise discount support
  discount?: number;
  discountInput?: number | '';
  discountType?: 'FIXED' | 'PERCENT';
  showDiscount?: boolean;
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

/**
 * Quick Invoice POS Terminal Page
 * Provides dual retail/wholesale invoicing with instant catalog search, barcode scanning,
 * customer credit ledger settlement, dynamic discounts, and device-adaptive checkout.
 * On mobile/tablet (<1024px), features an expanded 97vh bottom-sheet drawer with 46vh
 * cart line-item capacity, compact p-2 financial breakdown, and ultra-sleek h-7 payment pills.
 */
export const QuickInvoicePage: React.FC = () => {
  const { resolvedTheme } = useTheme();
  const { user, isRep } = useAuth();
  const dark = resolvedTheme === 'dark';

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


  // Pagination state for product grid:
  // Set to 9 items per page to achieve an exact, symmetrical 3x3 layout in 3-column tablet view (grid-cols-3)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;

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
  const location = useLocation();
  const editInvoiceId = searchParams.get('editInvoiceId');
  const convertOrderId = searchParams.get('convertOrderId');

  // Dual-mode Discount: Default to Percentage (%), with Fixed Price (Rs) fallback
  const [discountType, setDiscountType] = useState<'FIXED' | 'PERCENT'>('PERCENT');
  const [discountInput, setDiscountInput] = useState<number>(0);
  // ⭐ Raw string state for auto-detecting discount input type (% vs pure number)
  const [discountRawInput, setDiscountRawInput] = useState<string>('');
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
  const [newCustCreditLimit, setNewCustCreditLimit] = useState('');
  const [newCustNotes, setNewCustNotes] = useState('');
  const [newCustOutstandingBalance, setNewCustOutstandingBalance] = useState('');
  const [creatingCustomer, setCreatingCustomer] = useState(false);

  // Inline edit previous due state
  const [editingPrevDue, setEditingPrevDue] = useState(false);
  const [tempPrevDueInput, setTempPrevDueInput] = useState('');
  const [updatingPrevDue, setUpdatingPrevDue] = useState(false);

  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  // ⭐ Tablet Viewport (534x893) REP Optimizations: Preview Modal & 80mm Print Layout States
  const [previewVariant, setPreviewVariant] = useState<CatalogVariant | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState<boolean>(false);
  const [savedOrderForPrint, setSavedOrderForPrint] = useState<any | null>(null);

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

        // Pre-fill Pricing Mode based on order source (Wholesale vs Retail), strictly locked to Wholesale for REP
        if (isRepUser || inv.source === 'POS_WHOLESALE' || inv.orderType === 'WHOLESALE') {
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

        // Pre-fill Cart items with complete line-item discount state hydration
        if (Array.isArray(inv.items)) {
          let parsedNotes: any = null;
          let parsedItemVariants: any[] = [];
          if (inv.notes) {
            try {
              let current: any = inv.notes;
              while (typeof current === 'string' && current.trim().startsWith('{')) {
                current = JSON.parse(current);
              }
              if (typeof current === 'object' && current !== null) {
                parsedNotes = current;
                if (Array.isArray(current.itemVariants)) {
                  parsedItemVariants = current.itemVariants;
                }
              }
            } catch {}
          }

          setCart(
            inv.items.map((i: any, idx: number) => {
              const chosenSize = i.size || i.selectedSize || parsedItemVariants[idx]?.size || i.variant?.size || 'FREE';
              const chosenColor = i.color || i.selectedColor || parsedItemVariants[idx]?.color || i.variant?.color || 'Default';
              const lineDisc = Number(i.discount || 0);
              const gross = (Number(i.unitPrice) || 0) * (Number(i.quantity) || 0);

              /**
               * Line-Item Discount Hydration Specification:
               * 1. Inspect direct item properties (`discountType`, `discountInput`), fallback to
               *    invoice-level structured notes metadata (`parsedNotes.itemDiscounts[idx]`).
               * 2. If discountType is 'PERCENT', compute or hydrate the exact percentage rate (0-100%).
               * 3. If discountType is 'FIXED', preserve the flat currency discount amount without rounding artifacts.
               * 4. For legacy records where only `lineDisc` exists, default to 'FIXED' to maintain 100% numerical parity.
               */
              const metaDisc = parsedNotes?.itemDiscounts?.[idx] || (inv.itemDiscounts && inv.itemDiscounts[idx]);
              let itemDiscType: 'PERCENT' | 'FIXED' = 'FIXED';
              let itemDiscInput: number | '' = '';

              const candidateType = (i.discountType || metaDisc?.discountType)?.toUpperCase();
              if (candidateType === 'PERCENT') {
                itemDiscType = 'PERCENT';
                if (metaDisc?.discountInput !== undefined && metaDisc?.discountInput !== '') {
                  itemDiscInput = Number(metaDisc.discountInput);
                } else if (i.discountInput !== undefined && i.discountInput !== '') {
                  itemDiscInput = Number(i.discountInput);
                } else if (gross > 0 && lineDisc > 0) {
                  itemDiscInput = parseFloat(((lineDisc / gross) * 100).toFixed(1));
                }
              } else if (candidateType === 'FIXED') {
                itemDiscType = 'FIXED';
                if (metaDisc?.discountInput !== undefined && metaDisc?.discountInput !== '') {
                  itemDiscInput = Number(metaDisc.discountInput);
                } else if (i.discountInput !== undefined && i.discountInput !== '') {
                  itemDiscInput = Number(i.discountInput);
                } else if (lineDisc > 0) {
                  itemDiscInput = lineDisc;
                }
              } else if (lineDisc > 0) {
                // Fallback for legacy invoice lines without explicit discount mode
                itemDiscType = 'FIXED';
                itemDiscInput = lineDisc;
              }

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
                discount: lineDisc,
                discountInput: itemDiscInput,
                discountType: itemDiscType,
                showDiscount: lineDisc > 0 || (itemDiscInput !== '' && Number(itemDiscInput) > 0),
              };
            })
          );
        }

        /**
         * Overall Order Discount Hydration Specification:
         * 1. Inspect structured notes or invoice root for saved discount mode (`discountType`: 'PERCENT' | 'FIXED').
         * 2. If 'PERCENT': hydrate percentage rate (`discountInput` & `${effectivePercent}%` in `discountRawInput`),
         *    preventing it from defaulting to fixed Rs or causing calculation mismatches.
         * 3. If 'FIXED': preserve flat currency discount amount without artificial % conversion or fractional drift.
         * 4. For legacy records without stored discount mode: check if explicit `discountRate` exists; otherwise default
         *    to 'FIXED' with exact `invDiscountAmt` so the customer bill matches the original down to the cent.
         */
        const invDiscountAmt = Number((inv as any).discountAmount ?? inv.discount ?? 0);
        const invSubtotalAmt = Number(inv.subtotal ?? (Number(inv.totalAmount || 0) + invDiscountAmt));

        let loadedNotes: any = null;
        if (inv.notes) {
          try {
            let cur = inv.notes;
            while (typeof cur === 'string' && cur.trim().startsWith('{')) {
              cur = JSON.parse(cur);
            }
            if (typeof cur === 'object' && cur !== null) {
              loadedNotes = cur;
            }
          } catch {}
        }

        const savedDiscType: 'FIXED' | 'PERCENT' | undefined =
          loadedNotes?.discountType ||
          (inv as any).discountType ||
          ((inv as any).discountRate !== undefined && Number((inv as any).discountRate) > 0 ? 'PERCENT' : undefined);

        const savedDiscInput = loadedNotes?.discountInput ?? (inv as any).discountInput;

        if (savedDiscType === 'PERCENT') {
          setDiscountType('PERCENT');
          let effectivePercent = 0;
          if (savedDiscInput !== undefined && savedDiscInput !== '' && !isNaN(Number(savedDiscInput))) {
            effectivePercent = Number(savedDiscInput);
          } else if ((inv as any).discountRate !== undefined && Number((inv as any).discountRate) > 0) {
            effectivePercent = Number((inv as any).discountRate);
          } else if (invDiscountAmt > 0 && invSubtotalAmt > 0) {
            effectivePercent = parseFloat(((invDiscountAmt / invSubtotalAmt) * 100).toFixed(1));
          }
          setDiscountInput(effectivePercent);
          setDiscountRawInput(effectivePercent > 0 ? `${effectivePercent}%` : '');
        } else if (savedDiscType === 'FIXED') {
          setDiscountType('FIXED');
          const fixedVal = savedDiscInput !== undefined && savedDiscInput !== '' && !isNaN(Number(savedDiscInput))
            ? Number(savedDiscInput)
            : invDiscountAmt;
          setDiscountInput(fixedVal);
          setDiscountRawInput(fixedVal > 0 ? String(fixedVal) : '');
        } else if (invDiscountAmt > 0) {
          if ((inv as any).discountRate !== undefined && Number((inv as any).discountRate) > 0) {
            const pct = Number((inv as any).discountRate);
            setDiscountType('PERCENT');
            setDiscountInput(pct);
            setDiscountRawInput(`${pct}%`);
          } else {
            setDiscountType('FIXED');
            setDiscountInput(invDiscountAmt);
            setDiscountRawInput(String(invDiscountAmt));
          }
        } else {
          setDiscountType('PERCENT');
          setDiscountInput(0);
          setDiscountRawInput('');
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
   * Convert Presales Order to Quick Invoice Flow:
   * Automatically sets mode to WHOLESALE, maps order line items (preserving net rate/discounts),
   * Convert Presales Order to Quick Invoice Flow:
   * Sets mode to WHOLESALE, hydrates customer, and fully preserves item-wise discounts
   * (amount, input, discountType) and order-level discount for 100% financial fidelity.
   */
  useEffect(() => {
    const rawConvertId = convertOrderId ? String(convertOrderId).trim() : null;
    const convertOrderData = (location.state as any)?.convertOrder;

    if (!rawConvertId && !convertOrderData) return;

    const loadConvertOrder = async () => {
      setLoading(true);
      try {
        let order = convertOrderData;
        if (!order && rawConvertId) {
          order = await get<any>(`/sales-orders/${rawConvertId}`);
        }
        if (!order) return;

        // 1. Set Wholesale mode
        setPricingMode('WHOLESALE');

        // 2. Hydrate Customer: Preserve customer if present in order
        if (order.customerId) {
          const custIdStr = String(order.customerId);
          setSelectedCustomerId(custIdStr);

          // If customer object exists on order, ensure it's in customers list
          if (order.customer) {
            setCustomers((prev) => {
              const exists = prev.some((c) => c.id === order.customer.id);
              if (!exists) {
                return [
                  {
                    id: order.customer.id,
                    name: order.customer.name,
                    phone: order.customer.phone || '',
                    address: order.customer.address || '',
                    city: order.customer.city || '',
                    creditLimit: Number(order.customer.creditLimit) || 0,
                    outstandingBalance: Number(order.customer.outstandingBalance) || 0,
                  },
                  ...prev,
                ];
              }
              return prev;
            });
          }
        } else {
          setSelectedCustomerId('walk-in');
        }

        // 3. Hydrate Notes & Structured Metadata
        let parsedNotes: any = null;
        let plainUserNote = order.notes || '';
        if (typeof order.notes === 'string' && order.notes.trim().startsWith('{')) {
          try {
            parsedNotes = JSON.parse(order.notes);
            plainUserNote = parsedNotes.userNotes || '';
          } catch {}
        } else if (typeof order.notes === 'object' && order.notes !== null) {
          parsedNotes = order.notes;
          plainUserNote = parsedNotes.userNotes || '';
        }
        setPaymentNote(plainUserNote);
        setShowNoteInput(!!plainUserNote);

        // Reset payment tenders for cashier settlement
        setClientGivenCash('');
        setSplitPayments([]);
        setCheques([{ id: '1', chequeNumber: '', bankName: '', chequeDate: new Date().toISOString().split('T')[0], amount: '' }]);
        setPaymentMethod('CREDIT');

        // 4. Hydrate Line Items and their specific discount properties cleanly matching CartItem schema
        let convertedCart: CartItem[] = [];
        if (Array.isArray(order.items) && order.items.length > 0) {
          convertedCart = order.items.map((i: any, idx: number) => {
            const qty = Number(i.quantity ?? i.qty) || 1;
            const rawRate = Number(i.unitPrice ?? i.sellingPrice ?? i.price) || 0;
            const lineDiscount = Number(i.discount || 0);
            const gross = qty * rawRate;

            // Determine item discount mode and input from item or structured metadata
            let itemDiscType: 'PERCENT' | 'FIXED' = (i.discountType as any) || 'FIXED';
            let itemDiscInput: number | '' = i.discountInput !== undefined && i.discountInput !== '' ? i.discountInput : '';

            // Check item-level notes JSON if available
            if (i.notes) {
              try {
                const itemMeta = typeof i.notes === 'string' ? JSON.parse(i.notes) : i.notes;
                if (itemMeta && typeof itemMeta === 'object') {
                  if (itemMeta.discountType) itemDiscType = itemMeta.discountType;
                  if (itemMeta.discountInput !== undefined) itemDiscInput = itemMeta.discountInput;
                }
              } catch {}
            }

            // Check order structured notes for per-item discounts
            if (parsedNotes?.itemDiscounts && Array.isArray(parsedNotes.itemDiscounts)) {
              const metaDisc = parsedNotes.itemDiscounts[idx];
              if (metaDisc) {
                if (metaDisc.discountType) itemDiscType = metaDisc.discountType;
                if (metaDisc.discountInput !== undefined) itemDiscInput = metaDisc.discountInput;
              }
            }

            // Fallback: If input is still empty but line discount exists
            if (itemDiscInput === '' && lineDiscount > 0) {
              if (itemDiscType === 'PERCENT' && gross > 0) {
                itemDiscInput = parseFloat(((lineDiscount / gross) * 100).toFixed(1));
              } else {
                itemDiscType = 'FIXED';
                itemDiscInput = lineDiscount;
              }
            }

            const v = i.variant;
            const productName = i.productName || v?.product?.name || i.name || 'Garment Item';
            const size = i.size || i.selectedSize || i.variantName || v?.size || 'FREE';
            const color = i.color || i.selectedColor || v?.color || 'Default';
            const sku = i.sku || v?.sku || '';
            const imageUrl = i.imageUrl || v?.product?.images?.[0]?.imageUrl || '';
            const resolvedVariantId = Number(i.variantId || v?.id || i.id || 0);
            const resolvedProductId = Number(i.productId || v?.productId || v?.product?.id || 0);
            const resolvedItemId = i.id ? Number(i.id) : (resolvedVariantId || idx + 1);

            return {
              id: resolvedItemId,
              variantId: resolvedVariantId,
              productId: resolvedProductId,
              name: productName,
              size,
              color,
              selectedSize: size,
              selectedColor: color,
              sku,
              imageUrl,
              unitPrice: rawRate,
              sellingPrice: rawRate,
              quantity: qty,
              qty: qty,
              maxStock: Math.max(qty, Number(v?.stock || 0)),
              itemKey: `convert_${resolvedVariantId}_${size}_${color}_${idx}`,
              discount: lineDiscount,
              discountInput: itemDiscInput,
              discountType: itemDiscType,
              showDiscount: lineDiscount > 0, // Expand discount line if pre-existing discount exists (matching editInvoiceId behavior)
            };
          });

          setCart(convertedCart);
        }

        // 5. Hydrate Overall Order Discount into Bill Summary section
        const orderDiscountAmt = Number(order.discount) || 0;
        const cartSubtotal = convertedCart.reduce((sum, item) => {
          return sum + Math.max(0, item.quantity * item.unitPrice - (Number(item.discount) || 0));
        }, 0);
        const effectiveSubtotal = cartSubtotal > 0 ? cartSubtotal : (Number(order.subtotal) || 0);

        let orderDiscType: 'PERCENT' | 'FIXED' = (order.discountType as any) || parsedNotes?.discountType || 'FIXED';
        let orderDiscInput: number = 0;
        let rawInputStr = '';

        if (orderDiscountAmt > 0) {
          if (parsedNotes?.discountInput !== undefined && parsedNotes.discountInput !== '') {
            orderDiscInput = Number(parsedNotes.discountInput);
            orderDiscType = parsedNotes.discountType || 'FIXED';
            rawInputStr = orderDiscType === 'PERCENT' ? `${orderDiscInput}%` : String(orderDiscInput);
          } else if (orderDiscType === 'PERCENT') {
            orderDiscInput = order.discountInput !== undefined && order.discountInput !== ''
              ? Number(order.discountInput)
              : (effectiveSubtotal > 0 ? parseFloat(((orderDiscountAmt / effectiveSubtotal) * 100).toFixed(1)) : 0);
            rawInputStr = `${orderDiscInput}%`;
          } else {
            // FIXED mode default: preserve stored rupee discount as exact flat amount (never guess percentage)
            orderDiscType = 'FIXED';
            orderDiscInput = orderDiscountAmt;
            rawInputStr = String(orderDiscountAmt);
          }
        } else {
          orderDiscType = 'PERCENT';
          orderDiscInput = 0;
          rawInputStr = '';
        }

        setDiscountType(orderDiscType);
        setDiscountInput(orderDiscInput);
        setDiscountRawInput(rawInputStr);

        toast.info(
          `Loaded Presales Order #${order.orderNumber || order.id} into Wholesale Invoice. All discounts & line items preserved.`
        );
      } catch (err: any) {
        console.error('Failed to convert order to invoice:', err);
        toast.error(err.message || 'Failed to load presales order for conversion');
      } finally {
        setLoading(false);
      }
    };

    loadConvertOrder();
  }, [convertOrderId, location.state]);

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
   * ⭐ Retrieve the current quantity of a specific variant already assigned to the order cart
   */
  const getVariantCartQty = (variantId: number): number => {
    return cart.find((i) => i.variantId === variantId)?.quantity || 0;
  };

  /**
   * ⭐ Set specific quantity for variant in cart directly with full inventory validation
   * Seamlessly synchronized with both AnimatedInlineQtyInput (3-col grid) and ProductPreviewModal.
   */
  const setVariantQuantity = (variant: CatalogVariant, targetQty: number) => {
    if (targetQty <= 0) {
      setCart((prev) => prev.filter((i) => i.variantId !== variant.id));
      return;
    }

    if (targetQty > variant.stock) {
      toast.warn(`Only ${variant.stock} available in stock for "${variant.product.name}"`);
      targetQty = variant.stock;
    }

    const price = pricingMode === 'WHOLESALE' ? variant.wholesalePrice : variant.retailPrice;
    const sizeText = (variant as any).sizes || variant.size || '';
    const colorText = (variant as any).colors || variant.color || '';

    setCart((prev) => {
      const existingIndex = prev.findIndex((i) => i.variantId === variant.id);
      if (existingIndex > -1) {
        const next = [...prev];
        const existing = next[existingIndex];
        const updatedDisc = calculateLineDiscount(
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
            name: variant.product.name,
            size: sizeText,
            color: colorText,
            selectedSize: sizeText,
            selectedColor: colorText,
            sku: variant.sku,
            imageUrl: variant.product.images?.[0]?.imageUrl,
            unitPrice: price,
            quantity: targetQty,
            maxStock: variant.stock,
            itemKey: `${variant.id}_${Date.now()}`,
          },
        ];
      }
    });
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
   * Calculate line discount based on unitPrice, quantity, mode (FIXED vs PERCENT), and input value
   */
  const calculateLineDiscount = (
    unitPrice: number,
    qty: number,
    type: 'FIXED' | 'PERCENT' = 'FIXED',
    discInput?: number | ''
  ): number => {
    const gross = unitPrice * qty;
    const num = Number(discInput) || 0;
    if (num <= 0 || gross <= 0) return 0;
    if (type === 'PERCENT') {
      const pct = Math.min(100, Math.max(0, num));
      return Math.round((gross * pct) / 100);
    }
    return Math.min(gross, Math.max(0, num));
  };

  /**
   * ⭐ Toggle inline discount visibility for an item in cart
   */
  const toggleItemDiscount = (itemIndex: number) => {
    setCart((prev) =>
      prev.map((item, idx) =>
        idx === itemIndex ? { ...item, showDiscount: !item.showDiscount } : item
      )
    );
  };

  /**
   * ⭐ Update item discount type (% vs Fixed Rs) with Bidirectional Recalculation:
   * - When switching from FIXED (Rs) -> PERCENT (%): Calculates equivalent percentage based on line gross.
   * - When switching from PERCENT (%) -> FIXED (Rs): Calculates equivalent currency discount in Rs.
   * Guarantees zero value mismatch and keeps item subtotal and bill total completely synchronized.
   */
  const handleItemDiscountTypeChange = (itemIndex: number, nextType: 'PERCENT' | 'FIXED') => {
    setCart((prev) => {
      const next = [...prev];
      const item = next[itemIndex];
      if (!item) return prev;

      const currentType = item.discountType || 'FIXED';
      if (currentType === nextType) return prev;

      const gross = (Number(item.unitPrice) || 0) * (Number(item.quantity) || 0);
      const currentDisc = Number(item.discount) || 0;
      const currentInput = item.discountInput !== undefined && item.discountInput !== '' ? Number(item.discountInput) : 0;

      let convertedInput: number | '' = '';
      let calculatedDisc = 0;

      if (nextType === 'PERCENT') {
        // Switching from FIXED -> PERCENT: compute percentage from current discount amount
        if (gross > 0 && currentDisc > 0) {
          const rawPct = (currentDisc / gross) * 100;
          const roundedPct = parseFloat(rawPct.toFixed(1));
          convertedInput = Math.min(100, Math.max(0, isNaN(roundedPct) ? 0 : roundedPct));
          calculatedDisc = Math.round((gross * convertedInput) / 100);
        } else {
          convertedInput = '';
          calculatedDisc = 0;
        }
      } else {
        // Switching from PERCENT -> FIXED: compute exact Rs amount from current percentage or currentDisc
        if (gross > 0 && (currentDisc > 0 || currentInput > 0)) {
          const effectiveAmt = currentDisc > 0 ? currentDisc : Math.round((gross * Math.min(100, currentInput)) / 100);
          const clampedAmt = Math.min(gross, Math.max(0, isNaN(effectiveAmt) ? 0 : effectiveAmt));
          convertedInput = clampedAmt;
          calculatedDisc = clampedAmt;
        } else {
          convertedInput = '';
          calculatedDisc = 0;
        }
      }

      next[itemIndex] = {
        ...item,
        discountType: nextType,
        discountInput: convertedInput,
        discount: calculatedDisc,
      };
      return next;
    });
  };

  /**
   * ⭐ Handle item discount input change with auto-detection of '%'
   * Sanitizes numeric input and immediately updates line-item discount calculation.
   */
  const handleItemDiscountInputChange = (itemIndex: number, valStr: string) => {
    setCart((prev) => {
      const next = [...prev];
      const item = next[itemIndex];
      if (!item) return prev;

      let type = item.discountType || 'FIXED';
      let cleanStr = valStr.trim();
      if (cleanStr.includes('%')) {
        type = 'PERCENT';
        cleanStr = cleanStr.replace(/%/g, '');
      }

      if (cleanStr === '') {
        next[itemIndex] = {
          ...item,
          discountType: type,
          discountInput: '',
          discount: 0,
        };
        return next;
      }

      const num = parseFloat(cleanStr);
      if (isNaN(num)) {
        next[itemIndex] = {
          ...item,
          discountType: type,
          discountInput: '',
          discount: 0,
        };
        return next;
      }

      const sanitizedNum = type === 'PERCENT' ? Math.min(100, Math.max(0, num)) : Math.max(0, num);
      const nextDisc = calculateLineDiscount(item.unitPrice, item.quantity, type, sanitizedNum);

      next[itemIndex] = {
        ...item,
        discountType: type,
        discountInput: sanitizedNum,
        discount: nextDisc,
      };
      return next;
    });
  };

  /**
   * ⭐ Handle Total Order Discount input change:
   * Auto-detects percentage if '%' is typed, while preserving active discountType
   * if the user is typing pure numbers in either mode.
   */
  const handleTotalDiscountChange = (valStr: string) => {
    setDiscountRawInput(valStr);
    const trimmed = valStr.trim();
    if (trimmed === '') {
      setDiscountInput(0);
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
      setDiscountInput(0);
      return;
    }

    if (activeType === 'PERCENT') {
      const pct = Math.min(100, Math.max(0, num));
      setDiscountInput(pct);
    } else {
      setDiscountInput(Math.max(0, num));
    }
  };

  /**
   * ⭐ Bidirectional Manual Toggle for Overall Order Discount Type (PERCENT vs FIXED):
   * Converts existing discount value between % and Rs so Subtotal, Total Due,
   * and Net Payable amounts update reactively without value mismatches or NaN issues.
   */
  const handleDiscountTypeToggle = (nextType: 'FIXED' | 'PERCENT') => {
    if (discountType === nextType) return;

    if (nextType === 'PERCENT') {
      // Switching from FIXED (Rs) -> PERCENT (%): Convert rupee discount into percentage of subtotal
      if (subtotal > 0 && discountAmount > 0) {
        const rawPct = (discountAmount / subtotal) * 100;
        const roundedPct = parseFloat(rawPct.toFixed(1));
        const clampedPct = Math.min(100, Math.max(0, isNaN(roundedPct) ? 0 : roundedPct));
        setDiscountType('PERCENT');
        setDiscountInput(clampedPct);
        setDiscountRawInput(`${clampedPct}%`);
      } else {
        setDiscountType('PERCENT');
        setDiscountInput(0);
        setDiscountRawInput('');
      }
    } else {
      // Switching from PERCENT (%) -> FIXED (Rs): Convert percentage discount into fixed currency amount
      if (subtotal > 0 && discountAmount > 0) {
        const fixedAmt = Math.min(subtotal, Math.max(0, Math.round(discountAmount)));
        setDiscountType('FIXED');
        setDiscountInput(fixedAmt);
        setDiscountRawInput(String(fixedAmt));
      } else {
        setDiscountType('FIXED');
        setDiscountInput(0);
        setDiscountRawInput('');
      }
    }
  };

  /**
   * Change item quantity in cart by index with auto recalculation of item discount
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
            if (nextQty > 0) {
              const updatedDisc = calculateLineDiscount(item.unitPrice, nextQty, item.discountType, item.discountInput);
              return { ...item, quantity: nextQty, discount: updatedDisc };
            }
            return null;
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
        const updatedDisc = calculateLineDiscount(targetItem.unitPrice, allowed, targetItem.discountType, targetItem.discountInput);
        setCart((prev) =>
          prev.map((i, idx) => (idx === itemIndex ? { ...i, quantity: allowed, discount: updatedDisc } : i))
        );
      } else {
        // Round to maximum 2 decimal places to avoid floating point issues
        const roundedQty = Math.round(rawVal * 100) / 100;
        const updatedDisc = calculateLineDiscount(targetItem.unitPrice, roundedQty, targetItem.discountType, targetItem.discountInput);
        setCart((prev) =>
          prev.map((i, idx) => (idx === itemIndex ? { ...i, quantity: roundedQty, discount: updatedDisc } : i))
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
  /**
   * Universal Global Product Search Filter:
   * Inspects each catalog variant and matches search queries against product name, SKU, or barcode.
   * Fully case-insensitive and whitespace-trimmed to guarantee instant real-time filtering
   * across barcode scans, alphanumeric SKUs, and partial garment titles.
   */
  const filteredCatalog = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return catalog;
    return catalog.filter((v) => {
      const nameMatch = v.product?.name ? v.product.name.toLowerCase().includes(q) : false;
      const skuMatch = v.sku ? v.sku.toLowerCase().includes(q) : false;
      const barcodeMatch = v.barcode ? v.barcode.toLowerCase().includes(q) : false;
      const searchKeyMatch = v.product?.searchKey ? v.product.searchKey.toLowerCase().includes(q) : false;
      const sizeMatch = v.size ? v.size.toLowerCase().includes(q) : false;
      const colorMatch = v.color ? v.color.toLowerCase().includes(q) : false;
      return nameMatch || skuMatch || barcodeMatch || searchKeyMatch || sizeMatch || colorMatch;
    });
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
  // Gross Subtotal (sum of unitPrice * quantity across all items)
  const grossSubtotal = useMemo(() => cart.reduce((acc, curr) => acc + curr.unitPrice * curr.quantity, 0), [cart]);
  // Total Item-level discounts (sum of all line-item discounts)
  const totalItemDiscounts = useMemo(
    () => cart.reduce((acc, curr) => acc + (Number((curr as any).discountAmount ?? curr.discount ?? 0)), 0),
    [cart]
  );
  // Net Subtotal after deducting item-level discounts
  const subtotal = Math.max(0, grossSubtotal - totalItemDiscounts);

  // Compute final order discount value in Rs based on selected mode (FIXED or PERCENT)
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
      const parsedBalance = newCustOutstandingBalance !== '' ? Number(newCustOutstandingBalance) : 0;
      const created = await post<any>('/customers', {
        name: newCustName.trim(),
        phone: newCustPhone.trim(),
        address: newCustAddress.trim() || undefined,
        nic: newCustNic.trim() || undefined,
        creditLimit: newCustCreditLimit ? Number(newCustCreditLimit) : 0,
        notes: newCustNotes.trim() || undefined,
        outstandingBalance: parsedBalance,
        // REP users strictly create wholesale customer partner accounts
        type: isRepUser ? 'WHOLESALE' : (pricingMode === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL'),
      });
      toast.success(`Customer "${created.name}" registered!`);
      const effectiveCustBal = Number(created.outstandingBalance) || parsedBalance;
      const newCustomerObj: PosCustomer = {
        id: created.id,
        name: created.name,
        phone: created.phone || '',
        address: created.address || '',
        city: created.city || '',
        creditLimit: Number(created.creditLimit) || 0,
        outstandingBalance: effectiveCustBal,
      };
      setCustomers((prev) => [newCustomerObj, ...prev]);
      setSelectedCustomerId(String(created.id));
      setPreviousDue(effectiveCustBal);
      setCustomerModalOpen(false);
      setNewCustName('');
      setNewCustPhone('');
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
   * Device-Adaptive POS checkout execution engine:
   * 
   * Viewport Execution Matrix:
   * - Desktop Viewports (≥1024px): Primary action defaults to 'SAVE_AND_PRINT' ('Pay Now & Print' / 'Update & Print').
   *   Saves/updates order via api.post('/orders/pos') or api.put('/orders/invoices/:id') and immediately
   *   triggers native browser printing via headless hidden iframe helper, completely eliminating any intermediate preview modal popup.
   *   Secondary action is 'SAVE_ONLY'.
   * - Mobile / Tablet Viewports (<1024px): Primary action defaults to 'SAVE_AND_PDF' (touch-first direct binary PDF streaming download).
   *   Secondary action is 'SAVE_ONLY', Tertiary action is 'SAVE_AND_PRINT' (Pay Now & Print / Update & Print).
   * 
   * @param mode - 'SAVE_ONLY' | 'SAVE_AND_PDF' | 'SAVE_AND_PRINT' | 'SAVE_AND_WHATSAPP'
   */
  const handleCheckout = async (mode: 'SAVE_ONLY' | 'SAVE_AND_PDF' | 'SAVE_AND_PRINT' | 'SAVE_AND_WHATSAPP' = 'SAVE_ONLY') => {
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
        source: isRepUser ? 'POS_WHOLESALE' : (pricingMode === 'WHOLESALE' ? 'POS_WHOLESALE' : 'POS_RETAIL'),
        customerId: !isWalkIn && selectedCust ? selectedCust.id : undefined,
        customerName: selectedCust ? selectedCust.name : 'Walk-in Customer',
        customerPhone: selectedCust ? selectedCust.phone : undefined,
        items: cart.map((i) => ({
          variantId: i.variantId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discount: i.discount || 0,
          discountType: i.discountType || 'FIXED',
          discountInput: i.discountInput !== undefined && i.discountInput !== '' ? Number(i.discountInput) : 0,
          price: Math.max(0, (i.unitPrice * i.quantity) - (i.discount || 0)),
          size: i.size,
          color: i.color,
          selectedSize: i.size,
          selectedColor: i.color,
        })),
        subtotal: grossSubtotal,
        discount: totalItemDiscounts + discountAmount,
        discountType,
        discountInput,
        discountRate: discountType === 'PERCENT' ? (discountInput > 0 ? discountInput : undefined) : undefined,
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
      setDiscountRawInput('');
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
        // Accurately resolve updated customer balance and construct fully hydrated complete order entity
        const targetCustomer = customers.find((c) => String(c.id) === String(selectedCustomerId));
        const updatedCustomerBal = resultOrder?.customer?.outstandingBalance !== undefined
          ? Number(resultOrder.customer.outstandingBalance)
          : Math.max(0, (targetCustomer?.outstandingBalance || 0) + (isEditing ? 0 : creditDue) - finalSettledDue);

        const completeOrderObj = {
          ...resultOrder,
          items: (resultOrder?.items || []).map((ri: any, rIdx: number) => {
            const snap = checkoutCartSnapshot[rIdx] as any;
            const resolvedName =
              snap?.name ||
              snap?.productName ||
              snap?.product?.name ||
              ri.variant?.product?.name ||
              ri.product?.name ||
              ri.name ||
              ri.title ||
              'Item';
            return {
              ...ri,
              name: resolvedName,
              title: resolvedName,
              productName: resolvedName,
              product: {
                ...(ri.product || {}),
                name: resolvedName,
              },
              unitPrice: snap?.unitPrice || ri.unitPrice || ri.wholesalePrice || (ri.quantity ? ((ri.price || 0) + (ri.discount || 0)) / ri.quantity : 0),
              wholesalePrice: snap?.unitPrice || ri.wholesalePrice || ri.unitPrice,
              discount: snap?.discount !== undefined ? snap?.discount : (ri.discount || 0),
              discountType: snap?.discountType || ri.discountType,
              discountInput: snap?.discountInput,
              price: snap?.unitPrice ? Math.max(0, (snap.unitPrice * snap.quantity) - (snap.discount || 0)) : ri.price,
              size: snap?.size || ri.size || ri.variant?.size,
              color: snap?.color || ri.color || ri.variant?.color,
              selectedSize: snap?.size || ri.size || ri.variant?.size,
              selectedColor: snap?.color || ri.color || ri.variant?.color,
            };
          }),
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
          subtotal: grossSubtotal,
          discount: totalItemDiscounts + discountAmount,
          discountAmount: discountAmount,
          discountType,
          discountRate: discountType === 'PERCENT' ? (discountInput > 0 ? discountInput : undefined) : undefined,
        };

        setMobileCartOpen(false);
        setSavedOrderForPrint(completeOrderObj);

        // Technical Print Trigger: Immediately open native browser print dialogue via headless hidden iframe.
        // For Sales Reps (REP role), targets dedicated 80mm thermal receipt layout (X-Printer format).
        // For Cashier/Desktop users, targets standard A4 invoice document.
        if (isRepUser) {
          print80mmThermalReceiptDirectly(completeOrderObj, () => {
            if (isEditing) {
              navigate('/system/invoices');
            } else {
              bootstrapPos();
            }
          });
        } else {
          printInvoiceDirectly(completeOrderObj, () => {
            if (isEditing) {
              navigate('/system/invoices');
            } else {
              bootstrapPos();
            }
          });
        }
      } else if (mode === 'SAVE_AND_WHATSAPP') {
        const targetCustomer = customers.find((c) => String(c.id) === String(selectedCustomerId));
        const updatedCustomerBal = resultOrder?.customer?.outstandingBalance !== undefined
          ? Number(resultOrder.customer.outstandingBalance)
          : Math.max(0, (targetCustomer?.outstandingBalance || 0) + (isEditing ? 0 : creditDue) - finalSettledDue);

        const completeOrderObj = {
          ...resultOrder,
          items: (resultOrder?.items || []).map((ri: any, rIdx: number) => ({
            ...ri,
            discount: checkoutCartSnapshot[rIdx]?.discount !== undefined ? checkoutCartSnapshot[rIdx]?.discount : (ri.discount || 0),
            discountType: checkoutCartSnapshot[rIdx]?.discountType || ri.discountType,
            discountInput: checkoutCartSnapshot[rIdx]?.discountInput,
            price: checkoutCartSnapshot[rIdx]?.unitPrice ? Math.max(0, (checkoutCartSnapshot[rIdx].unitPrice * checkoutCartSnapshot[rIdx].quantity) - (checkoutCartSnapshot[rIdx].discount || 0)) : ri.price,
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
          subtotal: grossSubtotal,
          discount: totalItemDiscounts + discountAmount,
          discountAmount: discountAmount,
          discountType,
          discountRate: discountType === 'PERCENT' ? (discountInput > 0 ? discountInput : undefined) : undefined,
        };

        const custPhone = resultOrder?.customerPhone || completeOrderObj.customer?.phone;
        const waMsg = generateCustomerInvoiceWhatsAppMessage(completeOrderObj);

        if (custPhone) {
          openWhatsAppChat(custPhone, waMsg);
        } else {
          const manualPhone = window.prompt('Enter customer mobile number for WhatsApp receipt:');
          if (manualPhone && manualPhone.trim()) {
            openWhatsAppChat(manualPhone.trim(), waMsg);
          }
        }

        setMobileCartOpen(false);
        if (isEditing) {
          navigate('/system/invoices');
        } else {
          bootstrapPos();
        }
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
    <div className="flex flex-col lg:flex-row gap-2.5 sm:gap-3 h-[calc(100vh-64px)] max-h-[calc(100vh-64px)] -mx-2 -my-3 sm:-mx-4 sm:-my-4 lg:-mx-8 lg:-my-8 p-2 sm:p-2.5 lg:p-3 overflow-hidden pb-16 lg:pb-0">
      {/* Left Column: Catalog Browser & Quick Scanner */}
      <div className="flex-1 flex flex-col gap-2 min-w-0 bg-white dark:bg-zinc-900/60 p-2.5 sm:p-3 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
        {/* Top Controls: Conditional Header Architecture */}
        {isRepUser ? (
          /* =========================================================================
           * 1. Top Header & Customer Selection Overhaul for REP (534px Tablet Viewport):
           * Completely hides "Scan Barcode" input and "Wholesale (Locked)" toggle.
           * Features a highly prominent Customer Selection component with inline Due Balance.
           * ========================================================================= */
          <div className="flex flex-col gap-2 p-2 sm:p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-950/70 border border-slate-200/80 dark:border-zinc-800/80 shadow-2xs">
            {/* Prominent Customer Selection Row: Exact matching input and button heights */}
            <div className="flex items-stretch gap-2">
              <div className="flex-1 min-w-0">
                <SearchableSelect
                  className="h-10 rounded-xl"
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
            {selectedCustomer && (
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
                    ({selectedCustomer.phone}{selectedCustomer.city ? ` · ${selectedCustomer.city}` : ''})
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
                placeholder="Filter catalog by product title, size, tags..."
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
        ) : (
          /* Standard Cashier Desktop Top Controls */
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
                onClick={() => {
                  setPricingMode('RETAIL');
                  setCart((prev) =>
                    prev.map((item) => {
                      const matched = catalog.find((c) => c.id === item.variantId);
                      const newPrice = matched ? matched.retailPrice : item.unitPrice;
                      return { ...item, unitPrice: newPrice };
                    })
                  );
                }}
                className={`px-3 py-1.5 min-h-[44px] sm:min-h-[36px] text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  pricingMode === 'RETAIL'
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
                  setCart((prev) =>
                    prev.map((item) => {
                      const matched = catalog.find((c) => c.id === item.variantId);
                      const newPrice = matched ? matched.wholesalePrice : item.unitPrice;
                      return { ...item, unitPrice: newPrice };
                    })
                  );
                }}
                className={`px-3 py-1.5 min-h-[44px] sm:min-h-[36px] text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  pricingMode === 'WHOLESALE'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400'
                }`}
              >
                Wholesale
              </button>
            </div>

            {/* Quick Register Product Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate('/system/products/new?returnUrl=/system/quick-invoice')}
              className="h-9 min-h-[44px] sm:min-h-0 px-2.5 text-xs font-semibold gap-1.5 border-dashed border-emerald-500/60 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 shrink-0"
              title="Register new product and return back to POS"
            >
              <Plus className="size-3.5" /> Product
            </Button>
          </div>
        )}

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
            /* =========================================================================
             * 2. Forced 3-Column Product Grid in 534px Tablet Viewport (`grid-cols-3`):
             * Features a subtle top-left "Eye" icon to open the full-display preview modal.
             * 3. Animated Inline Quantity Input:
             * Current Stock placed clearly at bottom-left, modern Add/Input icon with smooth
             * right-to-left slide/expand numerical input box at bottom-right.
             * ========================================================================= */
            <div className="grid grid-cols-3 xl:grid-cols-4 gap-2">
              {paginatedCatalog.map((v) => {
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
                const cartQty = getVariantCartQty(v.id);

                const sizesList = (v.size || '').split(',').map((s) => s.trim()).filter(Boolean);
                const colorsList = (v.color || '').split(',').map((c) => c.trim()).filter(Boolean);
                const isMultiOption = sizesList.length > 1 || colorsList.length > 1;

                return (
                  <div
                    key={v.id}
                    className={`flex flex-col text-left rounded-xl border p-2 transition-all group relative overflow-hidden bg-white dark:bg-zinc-950 ${
                      v.stock <= 0
                        ? 'opacity-40 border-slate-200 dark:border-zinc-800'
                        : 'border-slate-200 dark:border-zinc-800 hover:border-emerald-500 hover:shadow-md'
                    }`}
                  >
                    {/* Subtle Eye Icon for Full Specs & Preview Modal (Top-Left) */}
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
                      onClick={() => handleCatalogItemClick(v)}
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
                        <span className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-emerald-600/90 text-white font-bold text-[7.5px] tracking-wide uppercase backdrop-blur-xs shadow-xs">
                          Multi
                        </span>
                      )}
                    </div>

                    {/* Product Name */}
                    <h4
                      onClick={() => handleCatalogItemClick(v)}
                      className="font-semibold text-[11px] text-slate-900 dark:text-white line-clamp-1 leading-tight cursor-pointer"
                      title={v.product.name}
                    >
                      {v.product.name}
                    </h4>

                    {/* Variants pill & subtle Product Number / SKU badge */}
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

                    {/* Price display */}
                    <div className="font-mono font-bold text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                      Rs. {Number(currentPrice).toLocaleString()}
                    </div>

                    {/* Bottom Row: Current Stock & Zero-Shift Animated Inline Quantity Input */}
                    <div className="flex items-center justify-between mt-auto pt-1 border-t border-slate-100 dark:border-zinc-900 min-h-[32px]">
                      <span className="text-[10px] font-mono text-slate-500 dark:text-zinc-400 font-medium">
                        Stock: {v.stock}
                      </span>

                      {/* Zero-Layout-Shift Inline Quantity Input */}
                      <AnimatedInlineQtyInput
                        maxStock={v.stock}
                        currentQty={cartQty}
                        onApplyQty={(qty) => setVariantQuantity(v, qty)}
                        productName={v.product.name}
                        overlayBottom={true}
                      />
                    </div>
                  </div>
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

      {/* Right Column: Checkout Cart & A4 Billing (Desktop Layout - Viewport Locked 3-Zone Architecture) */}
      <div className="hidden lg:flex lg:w-[380px] xl:w-[410px] h-full flex-col overflow-hidden bg-white dark:bg-zinc-900/70 rounded-2xl border border-slate-200 dark:border-zinc-800 shrink-0 shadow-sm">
        {/* Zone 1: Top Sticky Header (shrink-0) - Order Title & Customer Selector (Pinned strictly at top) */}
        <div className="p-3 pb-2 border-b border-slate-100 dark:border-zinc-800/80 shrink-0 space-y-2 sticky top-0 bg-white dark:bg-zinc-900 z-10">
          {/* Order Title Row */}
          <div className="flex items-center justify-between">
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
                    navigate('/system/quick-invoice');
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

          {/* Customer Selection Row */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">Customer / Account</label>
              <button
                type="button"
                onClick={() => setCustomerModalOpen(true)}
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer min-h-[30px] sm:min-h-0"
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
          </div>
        </div>

        {/* Zone 2: Middle Scrollable Workspace (flex-1 overflow-y-auto min-h-0 px-3 py-2 space-y-3) */}
        {/* Unifies Previous Due banner, Cart items, '+ Add Products' ribbon, Subtotal/Discounts, Ledger, and Payment Methods */}
        <div className="flex-1 overflow-y-auto min-h-0 px-3 py-2 space-y-3 scrollbar-thin">
          {/* Consolidated Customer Live Status Banner */}
          {selectedCustomer && (
            <div className={`px-2 py-1.5 rounded-lg border flex items-center justify-between gap-1.5 text-xs transition-all ${
              previousDue > 0
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/50 text-amber-900 dark:text-amber-200'
                : 'bg-slate-50 dark:bg-zinc-950/60 border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-200'
            }`}>
              <div className="flex items-center gap-1.5 min-w-0">
                <div className={`size-4 rounded-full flex items-center justify-center shrink-0 ${
                  previousDue > 0 ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300' : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                }`}>
                  <User className="size-2.5" />
                </div>
                <div className="min-w-0 leading-tight">
                  <span className={`font-semibold text-[11px] truncate block ${
                    previousDue > 0 ? 'text-amber-950 dark:text-amber-100' : 'text-slate-900 dark:text-white'
                  }`}>
                    {selectedCustomer.name}
                  </span>
                  <span className={`text-[9.5px] font-mono block leading-none truncate opacity-80 ${
                    previousDue > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500 dark:text-zinc-400'
                  }`}>
                    {selectedCustomer.phone} {selectedCustomer.city ? `· ${selectedCustomer.city}` : ''}
                  </span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="flex items-center justify-end gap-1">
                  <span className={`text-[8.5px] font-bold uppercase tracking-wider ${
                    previousDue > 0 ? 'text-amber-800 dark:text-amber-400' : 'text-slate-400 dark:text-zinc-500'
                  }`}>
                    Prev Due
                  </span>
                  {loadingCustomerBalance && <Loader2 className="size-2 animate-spin text-amber-500" />}
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
                  <div className="flex items-center gap-1 mt-0.5 justify-end">
                    <span className="text-[10px] text-slate-500 font-mono">Rs.</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={tempPrevDueInput}
                      onChange={(e) => setTempPrevDueInput(e.target.value)}
                      placeholder="0"
                      autoFocus
                      className="w-20 h-6 px-1.5 text-xs font-semibold rounded-md border border-amber-300 dark:border-amber-700 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-100 shadow-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      disabled={updatingPrevDue}
                      onClick={handleSaveInlinePreviousDue}
                      className="w-6 h-6 flex items-center justify-center rounded-md bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                      title="Save"
                    >
                      {updatingPrevDue ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                    </button>
                    <button
                      type="button"
                      disabled={updatingPrevDue}
                      onClick={() => setEditingPrevDue(false)}
                      className="w-6 h-6 flex items-center justify-center rounded-md bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 transition-all cursor-pointer"
                      title="Cancel"
                    >
                      <X className="size-3" />
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

          {/* Cart Items List */}
          <div className="divide-y divide-slate-100 dark:divide-zinc-800/50 space-y-0.5">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-1 text-slate-400 dark:text-zinc-500 text-xs py-8">
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
                    className="py-1.5 flex flex-col group hover:bg-slate-50/60 dark:hover:bg-zinc-800/30 px-1 rounded-lg transition-colors"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      {/* Product Name & Variant Details */}
                      <div className="min-w-0 flex-1 pr-1.5">
                        <h5 className="font-semibold text-xs text-slate-900 dark:text-white leading-tight break-words line-clamp-2" title={item.name}>
                          {item.name}
                        </h5>
                        {variantDesc && (
                          <p
                            className="truncate max-w-[170px] text-[11px] text-muted-foreground text-slate-500 dark:text-zinc-400 mt-0.5"
                            title={variantDesc}
                          >
                            {variantDesc}
                          </p>
                        )}
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center flex-wrap gap-1">
                          <span>@ Rs. {item.unitPrice.toLocaleString()}</span>
                          {Number(item.discount || 0) > 0 && (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold font-mono">
                              (-Rs. {Number(item.discount).toLocaleString()})
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Compact Quantity Stepper */}
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => updateQty(idx, -1)}
                          className="size-6 rounded-md bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer select-none active:scale-95"
                          title="Decrease quantity"
                        >
                          <Minus className="size-3" />
                        </button>

                        {/* Direct Decimal Quantity Input */}
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
                            className="w-10 h-6 text-center font-mono text-xs font-bold bg-white dark:bg-zinc-900 border border-emerald-500 rounded text-emerald-600 dark:text-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingQtyIndex(idx);
                              setTempQtyInput(String(item.quantity));
                            }}
                            className="min-w-6 h-6 px-1 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950/60 font-mono text-xs font-bold text-slate-800 dark:text-zinc-200 flex items-center justify-center cursor-pointer transition-colors border border-transparent hover:border-emerald-300 dark:hover:border-emerald-700 select-none"
                            title="Click to type quantity directly"
                          >
                            {item.quantity}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => updateQty(idx, 1)}
                          className="size-6 rounded-md bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer select-none active:scale-95"
                          title="Increase quantity"
                        >
                          <Plus className="size-3" />
                        </button>
                      </div>

                      {/* Small Minimal "Add Discount" Icon Button */}
                      <button
                        type="button"
                        onClick={() => toggleItemDiscount(idx)}
                        className={`size-6 rounded-md flex items-center justify-center transition-all cursor-pointer select-none shrink-0 ${
                          item.discount && item.discount > 0
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-700 shadow-2xs'
                            : item.showDiscount
                            ? 'bg-slate-200 text-slate-800 dark:bg-zinc-700 dark:text-zinc-200'
                            : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-zinc-800'
                        }`}
                        title={item.showDiscount ? "Hide discount input" : "Add / Edit item discount"}
                      >
                        <Percent className="size-3" />
                      </button>

                      {/* Line Total & Remove button */}
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="font-mono font-bold text-xs text-right text-slate-900 dark:text-white min-w-[50px]">
                          Rs. {Math.max(0, (item.unitPrice * item.quantity) - (item.discount || 0)).toLocaleString()}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFromCart(idx)}
                          className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 text-slate-400 hover:text-rose-500 p-1 rounded-md transition-all cursor-pointer flex items-center justify-center"
                          title="Remove item"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Smoothly expandable inline discount bar */}
                    {item.showDiscount && (
                      <div className="mt-1 pt-1.5 border-t border-dashed border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-2 text-xs bg-slate-100/70 dark:bg-zinc-900/60 p-1.5 rounded-lg transition-all animate-in fade-in duration-150">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">Item Disc:</span>
                          <div className="inline-flex rounded border border-slate-200 dark:border-zinc-800 p-0.5 bg-white dark:bg-zinc-900">
                            <button
                              type="button"
                              onClick={() => handleItemDiscountTypeChange(idx, 'PERCENT')}
                              className={`px-1.5 py-0.5 text-[9px] font-bold rounded transition-colors ${
                                (item.discountType || 'PERCENT') === 'PERCENT'
                                  ? 'bg-emerald-600 text-white'
                                  : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400'
                              }`}
                            >
                              %
                            </button>
                            <button
                              type="button"
                              onClick={() => handleItemDiscountTypeChange(idx, 'FIXED')}
                              className={`px-1.5 py-0.5 text-[9px] font-bold rounded transition-colors ${
                                item.discountType === 'FIXED'
                                  ? 'bg-emerald-600 text-white'
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
                              (-{Number(item.discount).toLocaleString()})
                            </span>
                          )}
                          <Input
                            type="text"
                            value={item.discountInput !== undefined && item.discountInput !== '' ? String(item.discountInput) : ''}
                            onChange={(e) => handleItemDiscountInputChange(idx, e.target.value)}
                            placeholder="0"
                            className="w-16 h-6 text-xs text-right font-mono p-1 bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-700 focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* '+ Add Products' Ribbon Action - Desktop prominent compact button */}
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const searchInput = document.querySelector('input[placeholder*="Search product"]') as HTMLInputElement;
              if (searchInput) searchInput.focus();
            }}
            className="w-full h-8.5 rounded-xl border-dashed border-emerald-300 dark:border-emerald-700/60 bg-emerald-50/50 hover:bg-emerald-100/70 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-2xs"
          >
            <Plus className="size-4 shrink-0" />
            <span>+ Add Products</span>
          </Button>

          {/* Subtotal & Discount Breakdown: Visually separated into Item Total Discount and Bill Discount */}
          <div className="flex flex-col gap-1.5 text-xs bg-slate-50/60 dark:bg-zinc-950/40 p-2.5 rounded-lg border border-slate-100 dark:border-zinc-800">
            {/* Row 1: Sub Total (Gross before line discounts) */}
            <div className="flex items-center justify-between text-slate-600 dark:text-zinc-400">
              <span className="font-semibold text-slate-700 dark:text-zinc-300">Sub Total:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">Rs. {grossSubtotal.toLocaleString()}</span>
            </div>

            {/* Row 2: Item Total Discount (Sum of all line-item discounts) */}
            <div className="flex items-center justify-between text-slate-600 dark:text-zinc-400 pt-1 border-t border-slate-200/60 dark:border-zinc-800/60">
              <span className="text-[11px] font-medium text-slate-600 dark:text-zinc-400">Item Total Discount:</span>
              <span className={`font-mono font-bold text-[11px] ${totalItemDiscounts > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                {totalItemDiscounts > 0 ? `- Rs. ${totalItemDiscounts.toLocaleString()}` : 'Rs. 0'}
              </span>
            </div>

            {/* Row 3: Bill Discount Controls (Order-level discount) */}
            <div className="flex flex-wrap items-center justify-between gap-1 pt-1 border-t border-slate-200/60 dark:border-zinc-800/60">
              <div className="flex items-center gap-1">
                <span className="text-slate-600 dark:text-zinc-400 font-medium text-[11px]">Bill Discount:</span>
                <div 
                  className="inline-flex rounded border border-slate-200 dark:border-zinc-800 p-0.5 bg-slate-100 dark:bg-zinc-900 shrink-0"
                  title={`Bill Discount Mode: ${discountType === 'PERCENT' ? 'Percentage (%)' : 'Fixed Amount (Rs)'} (Auto-detected)`}
                >
                  <button
                    type="button"
                    onClick={() => handleDiscountTypeToggle('PERCENT')}
                    className={`px-1 py-0.2 text-[8.5px] font-bold rounded transition-colors cursor-pointer ${
                      discountType === 'PERCENT'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400'
                    }`}
                  >
                    %
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDiscountTypeToggle('FIXED')}
                    className={`px-1 py-0.2 text-[8.5px] font-bold rounded transition-colors cursor-pointer ${
                      discountType === 'FIXED'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400'
                    }`}
                  >
                    Rs
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1 ml-auto">
                {discountType === 'PERCENT' && discountAmount > 0 && (
                  <span className="text-[10px] font-mono text-emerald-600 font-bold whitespace-nowrap">
                    (-Rs. {discountAmount.toLocaleString()})
                  </span>
                )}
                <Input
                  type="text"
                  value={discountRawInput}
                  onChange={(e) => handleTotalDiscountChange(e.target.value)}
                  placeholder="0 or 10%"
                  className="w-20 h-6 text-xs text-right font-mono p-1 bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-700 focus:ring-1 focus:ring-emerald-500"
                  title="Type a number for fixed Rs, or include '%' for percentage discount (e.g. 10%)"
                />
              </div>
            </div>
          </div>

          {/* Current Bill Total & Tendered Input */}
          <div className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
            <div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block leading-tight">Total Due (Current Bill)</span>
              <span className="font-mono text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                Rs. {total.toLocaleString()}
              </span>
            </div>

            <div className="text-right">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block leading-tight">
                Tendered ({paymentMethod})
              </span>
              <Input
                type="number"
                disabled={isEditing}
                value={clientGivenCash}
                onChange={(e) => handleClientCashChange(e.target.value)}
                onFocus={(e) => e.target.select()}
                onClick={(e) => (e.target as HTMLInputElement).select()}
                placeholder={String(total)}
                className={`w-24 h-5.5 text-xs text-right font-mono font-bold mt-0.5 p-0.5 ${
                  isEditing
                    ? 'bg-slate-100 dark:bg-zinc-900 cursor-not-allowed !text-black dark:!text-white opacity-100 font-extrabold'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              />
            </div>
          </div>

          {/* Structured Financial Ledger Breakdown */}
          <div className="space-y-0.5 bg-slate-50/80 dark:bg-zinc-950/60 rounded-lg p-1.5 border border-slate-200/80 dark:border-zinc-800/80 text-[10.5px]">
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
                  <span>Due Settled:</span>
                  {canSettleDue && (
                    <button
                      type="button"
                      onClick={() => setExcessMode('CHANGE')}
                      className="inline-flex items-center gap-0.5 px-1 py-0.1 text-[8.5px] font-bold rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 transition-colors cursor-pointer"
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
                      className="inline-flex items-center gap-0.5 px-1 py-0.1 text-[8.5px] font-bold rounded bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-950 dark:text-blue-300 border border-blue-300 dark:border-blue-800 transition-colors cursor-pointer"
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
                <div className="border-t border-dashed border-slate-200 dark:border-zinc-800 my-0.5 pt-0.5 flex items-center justify-between text-slate-600 dark:text-zinc-400">
                  <span className="w-[58%] font-medium">Previous Due (Old Bills):</span>
                  <span className="w-[42%] text-right font-mono font-bold text-slate-900 dark:text-white">
                    Rs. {previousDue.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-0.5 text-amber-700 dark:text-amber-300 font-extrabold">
                  <span className="w-[58%] text-[9.5px] uppercase tracking-wider font-bold">Total Accumulated Credit Due:</span>
                  <span className="w-[42%] text-right font-mono text-[11px] font-black">
                    Rs. {totalAccumulatedDue.toLocaleString()}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Payment Method Controls & Note / Cheque Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                Payment Method
              </label>
              <button
                type="button"
                onClick={() => setShowNoteInput((prev) => !prev)}
                className={`text-[9.5px] font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                  showNoteInput || paymentNote.trim()
                    ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                    : 'text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300'
                }`}
                title={showNoteInput ? 'Collapse note field' : 'Add transaction note / reference'}
              >
                <Pencil className="size-2" />
                <span>{paymentNote.trim() ? 'Edit Note' : showNoteInput ? 'Hide Note' : '+ Note'}</span>
              </button>
            </div>

            {/* Optional General Note Field */}
            {showNoteInput && (
              <div className="relative flex items-center animate-in fade-in duration-150">
                <FileText className="absolute left-2 size-3 text-slate-400 dark:text-zinc-500 pointer-events-none" />
                <Input
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="Payment note, ref no, or transaction details..."
                  className="pl-7 pr-6 h-6 text-xs rounded-md border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-black dark:text-white font-medium placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus-visible:ring-1 focus-visible:ring-emerald-500 transition-colors"
                />
                {paymentNote && (
                  <button
                    type="button"
                    onClick={() => setPaymentNote('')}
                    className="absolute right-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 text-xs p-0.5 cursor-pointer"
                    title="Clear note"
                  >
                    ×
                  </button>
                )}
              </div>
            )}

            {/* Split Payment Banner / Status */}
            {splitPayments.length > 0 ? (
              <div className="flex items-center justify-between px-2 py-1 rounded-md bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-[10.5px] animate-in fade-in duration-150">
                <div className="flex items-center gap-1 min-w-0">
                  <Layers className="size-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <div className="truncate">
                    <span className="font-bold text-indigo-900 dark:text-indigo-200">
                      Split ({splitPayments.length}):{' '}
                    </span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      Rs. {totalSplitAmount.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSplitModalOpen(true)}
                    className="text-[9.5px] font-bold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 underline cursor-pointer"
                  >
                    Edit
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
                    className="text-[9.5px] font-bold text-rose-500 hover:text-rose-700 cursor-pointer"
                    title="Clear split configuration"
                  >
                    Clear
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between px-2 py-1 rounded-md bg-slate-100/70 dark:bg-zinc-900/60 border border-slate-200/60 dark:border-zinc-800/60 text-[10.5px]">
                <span className="text-slate-500 dark:text-zinc-400 text-[10px]">
                  Need split payment (Cash/Card/Cheque)?
                </span>
                <button
                  type="button"
                  onClick={() => setSplitModalOpen(true)}
                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 hover:underline cursor-pointer flex items-center gap-0.5"
                >
                  <Layers className="size-2.5" />
                  <span>Split →</span>
                </button>
              </div>
            )}

            {/* Payment Method Selector Buttons (5 Methods) */}
            <div className="grid grid-cols-5 gap-1">
              <button
                type="button"
                onClick={() => handleSelectPaymentMethod('CASH')}
                className={`flex items-center justify-center gap-1 h-7 min-h-[28px] py-1 px-1 rounded-md border text-[10px] font-semibold transition-all cursor-pointer ${
                  paymentMethod === 'CASH' && splitPayments.length === 0
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold shadow-2xs'
                    : 'border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/50'
                }`}
                title="Cash Payment"
              >
                <Banknote className="size-3" /> <span className="hidden sm:inline">Cash</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectPaymentMethod('CARD')}
                className={`flex items-center justify-center gap-1 h-7 min-h-[28px] py-1 px-1 rounded-md border text-[10px] font-semibold transition-all cursor-pointer ${
                  paymentMethod === 'CARD' && splitPayments.length === 0
                    ? 'border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold shadow-2xs'
                    : 'border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/50'
                }`}
                title="Credit/Debit Card POS Payment"
              >
                <CreditCard className="size-3" /> <span className="hidden sm:inline">Card</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectPaymentMethod('BANK_TRANSFER')}
                className={`flex items-center justify-center gap-1 h-7 min-h-[28px] py-1 px-1 rounded-md border text-[10px] font-semibold transition-all cursor-pointer ${
                  paymentMethod === 'BANK_TRANSFER' && splitPayments.length === 0
                    ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold shadow-2xs'
                    : 'border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/50'
                }`}
                title="Bank Transfer Payment"
              >
                <Landmark className="size-3" /> <span className="hidden sm:inline">Bank</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectPaymentMethod('CHEQUE')}
                className={`flex items-center justify-center gap-1 h-7 min-h-[28px] py-1 px-1 rounded-md border text-[10px] font-semibold transition-all cursor-pointer ${
                  paymentMethod === 'CHEQUE' && splitPayments.length === 0
                    ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold shadow-2xs'
                    : 'border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/50'
                }`}
                title="Cheque Payment"
              >
                <FileText className="size-3" /> <span className="hidden sm:inline">Cheque</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectPaymentMethod('CREDIT')}
                className={`flex items-center justify-center gap-1 h-7 min-h-[28px] py-1 px-1 rounded-md border text-[10px] font-semibold transition-all cursor-pointer ${
                  paymentMethod === 'CREDIT'
                    ? 'border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold shadow-2xs'
                    : 'border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/50'
                }`}
                title="Credit Account / Payable Later"
              >
                <Building className="size-3" /> <span className="hidden sm:inline">Credit</span>
              </button>
            </div>
          </div>
        </div>

        {/* Zone 3: Bottom Sticky Action Bar (shrink-0 sticky bottom-0 bg-white dark:bg-zinc-900 border-t pt-2.5 pb-3 px-3 z-10 shadow-sm) */}
        {/* Guaranteed 100% visible and anchored at the bottom limit of the panel at all times */}
        <div className="shrink-0 sticky bottom-0 bg-white dark:bg-zinc-900 border-t border-slate-100 dark:border-zinc-800 pt-2.5 pb-3 px-3 z-10 shadow-sm space-y-1.5">
          {/* Action Buttons: Desktop Adaptive Checkout Triggers (Compact h-9) */}
          <div className="flex flex-col sm:flex-row items-stretch gap-1.5 w-full">
            <Button
              type="button"
              disabled={cart.length === 0 || submitting}
              onClick={() => handleCheckout('SAVE_ONLY')}
              className="flex-1 min-h-[36px] h-9 gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-100 dark:border-zinc-700 font-bold text-xs rounded-xl shadow-2xs cursor-pointer transition-all active:scale-[0.98]"
            >
              {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5 text-slate-700 dark:text-zinc-300" />}
              <span>{isEditing ? 'Save Changes' : 'Save Invoice Only'}</span>
            </Button>
            <Button
              type="button"
              disabled={cart.length === 0 || submitting}
              onClick={() => handleCheckout('SAVE_AND_PRINT')}
              className="flex-1 min-h-[36px] h-9 gap-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-all active:scale-[0.98]"
            >
              {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <Printer className="size-3.5 text-white" />}
              <span>{isEditing ? 'Update & Print' : 'Pay Now & Print'}</span>
            </Button>
          </div>
          {/* Direct WhatsApp Share & PDF Download Triggers for Desktop */}
          <div className="flex items-center justify-center gap-2.5 pt-0.5">
            <button
              type="button"
              disabled={cart.length === 0 || submitting}
              onClick={() => handleCheckout('SAVE_AND_WHATSAPP')}
              className="text-[10.5px] font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 inline-flex items-center gap-1 cursor-pointer hover:underline disabled:opacity-50 min-h-[22px]"
              title="Save Invoice & Share Receipt on WhatsApp"
            >
              <MessageSquare className="size-2.5" />
              <span>Save &amp; WhatsApp</span>
            </button>
            <span className="text-slate-300 dark:text-zinc-700 text-xs">|</span>
            <button
              type="button"
              disabled={cart.length === 0 || submitting}
              onClick={() => handleCheckout('SAVE_AND_PDF')}
              className="text-[10.5px] font-semibold text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200 inline-flex items-center gap-1 cursor-pointer hover:underline disabled:opacity-50 min-h-[22px]"
            >
              <FileDown className="size-2.5" />
              <span>Save &amp; PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Floating Bottom Sticky Cart Bar (< 1024px) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 p-3 bg-white dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 z-40 backdrop-blur-md flex items-center justify-between gap-3 shadow-2xl">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative p-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 border border-slate-200 dark:border-zinc-700 shrink-0">
            <ShoppingCart className="size-5" />
            {cart.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-emerald-600 text-white font-mono font-bold text-[10px] flex items-center justify-center shadow-xs">
                {cart.reduce((sum, item) => sum + item.quantity, 0)}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-slate-600 dark:text-zinc-400 truncate font-medium">
              {selectedCustomer ? selectedCustomer.name : 'Walk-in Customer'}
            </div>
            <div className="font-mono font-extrabold text-sm sm:text-base text-emerald-600 dark:text-emerald-400 leading-tight">
              Rs. {total.toLocaleString()}
            </div>
          </div>
        </div>

        <Button
          type="button"
          onClick={() => setMobileCartOpen(true)}
          className="min-h-[48px] h-12 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-emerald-950/20 dark:shadow-emerald-950/40 shrink-0 cursor-pointer active:scale-95 transition-all"
        >
          <ShoppingCart className="size-4" />
          <span>Review Order &amp; Checkout</span>
        </Button>
      </div>

      {/* Touch-Friendly Bottom Sheet Drawer for Mobile/Tablet (< 1024px) */}
      <Drawer open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
        <DrawerContent className="h-[97vh] max-h-[97vh] flex flex-col overflow-hidden p-2.5 sm:p-3.5">
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-zinc-800/80 shrink-0">
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
                        navigate('/system/quick-invoice');
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
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                  title="Close Cart Drawer"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            {/* Customer Selection in Mobile Drawer (Pinned strictly at top) */}
            <div className="py-1.5 border-b border-slate-100 dark:border-zinc-800/80 shrink-0 sticky top-0 bg-white dark:bg-zinc-950 z-10">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">Customer / Account</label>
                <button
                  type="button"
                  onClick={() => {
                    setCustomerModalOpen(true);
                  }}
                  className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer min-h-[30px] sm:min-h-0"
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
            </div>

            {/* Zone 2: Middle Scrollable Workspace (flex-1 overflow-y-auto min-h-0 px-3 py-2 space-y-3) */}
            <div className="flex-1 overflow-y-auto min-h-0 px-3 py-2 space-y-3 scrollbar-thin">
              {/* Customer Live Status Banner (Sleek Compact Pill) */}
              {selectedCustomer && (
                <div className={`px-2 py-1 rounded-lg border flex items-center justify-between gap-1.5 text-xs transition-all shrink-0 ${
                  previousDue > 0
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/50 text-amber-900 dark:text-amber-200'
                    : 'bg-slate-50 dark:bg-zinc-950/60 border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-200'
                }`}>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className={`size-4 rounded-full flex items-center justify-center shrink-0 ${
                      previousDue > 0 ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300' : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                    }`}>
                      <User className="size-2.5" />
                    </div>
                    <div className="min-w-0 leading-tight">
                      <span className={`font-semibold text-[11px] truncate block ${
                        previousDue > 0 ? 'text-amber-950 dark:text-amber-100' : 'text-slate-900 dark:text-white'
                      }`}>
                        {selectedCustomer.name}
                      </span>
                      <span className={`text-[9.5px] font-mono block leading-none truncate opacity-80 ${
                        previousDue > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500 dark:text-zinc-400'
                      }`}>
                        {selectedCustomer.phone} {selectedCustomer.city ? `· ${selectedCustomer.city}` : ''}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="flex items-center justify-end gap-1">
                      <span className={`text-[8.5px] font-bold uppercase tracking-wider ${
                        previousDue > 0 ? 'text-amber-800 dark:text-amber-400' : 'text-slate-400 dark:text-zinc-500'
                      }`}>
                        Prev Due
                      </span>
                      {loadingCustomerBalance && <Loader2 className="size-2 animate-spin text-amber-500" />}
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
                      <div className="flex items-center gap-1 mt-0.5 justify-end">
                        <span className="text-[10px] text-slate-500 font-mono">Rs.</span>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={tempPrevDueInput}
                          onChange={(e) => setTempPrevDueInput(e.target.value)}
                          placeholder="0"
                          autoFocus
                          className="w-20 h-6 px-1.5 text-xs font-semibold rounded-md border border-amber-300 dark:border-amber-700 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-100 shadow-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                        <button
                          type="button"
                          disabled={updatingPrevDue}
                          onClick={handleSaveInlinePreviousDue}
                          className="w-6 h-6 flex items-center justify-center rounded-md bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                          title="Save"
                        >
                          {updatingPrevDue ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                        </button>
                        <button
                          type="button"
                          disabled={updatingPrevDue}
                          onClick={() => setEditingPrevDue(false)}
                          className="w-6 h-6 flex items-center justify-center rounded-md bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 transition-all cursor-pointer"
                          title="Cancel"
                        >
                          <X className="size-3" />
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

              {/* Cart Line Items in Mobile Drawer */}
              <div className="space-y-1.5">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-1 text-slate-400 dark:text-zinc-500 text-xs py-6">
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
                      className="py-2 px-2.5 rounded-xl border border-slate-100 dark:border-zinc-800/80 bg-slate-50/50 dark:bg-zinc-900/40 hover:bg-slate-100/60 dark:hover:bg-zinc-800/40 transition-colors flex flex-col gap-1.5"
                    >
                      {/* Row 1: Full-width Product Name, Variant Badge, Unit Rate, and Delete Trash Icon */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1 space-y-1">
                          <h5 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white leading-tight break-words">
                            {item.name}
                          </h5>
                          <div className="flex items-center flex-wrap gap-1.5">
                            {variantDesc && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200/70 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                                {variantDesc}
                              </span>
                            )}
                            <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
                              @ Rs. {item.unitPrice.toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {/* Top-Right Delete Trash Icon */}
                        <button
                          type="button"
                          onClick={() => removeFromCart(idx)}
                          className="text-slate-400 hover:text-rose-500 dark:text-zinc-500 dark:hover:text-rose-400 p-1.5 rounded-lg transition-colors cursor-pointer shrink-0 -mt-0.5 -mr-0.5"
                          title="Remove item"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>

                      {/* Row 2: Compact Quantity Stepper, Item Discount Toggle Button, and Line Total */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-zinc-800/40">
                        {/* Compact Stepper */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => updateQty(idx, -1)}
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
                              onBlur={() => handleApplyDirectQty(idx)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleApplyDirectQty(idx);
                                } else if (e.key === 'Escape') {
                                  setEditingQtyIndex(null);
                                }
                              }}
                              className="w-12 h-7 text-center font-mono text-xs font-bold bg-white dark:bg-zinc-900 border border-emerald-500 rounded text-emerald-600 dark:text-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingQtyIndex(idx);
                                setTempQtyInput(String(item.quantity));
                              }}
                              className="min-w-8 h-7 px-1.5 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950/60 font-mono text-xs font-bold text-slate-800 dark:text-zinc-200 flex items-center justify-center cursor-pointer transition-colors border border-transparent select-none"
                              title="Click to type quantity directly"
                            >
                              {item.quantity}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => updateQty(idx, 1)}
                            className="size-7 h-7 w-7 rounded-lg bg-slate-200/70 dark:bg-zinc-800 flex items-center justify-center text-slate-700 dark:text-zinc-200 hover:bg-slate-300 dark:hover:bg-zinc-700 transition-colors cursor-pointer select-none active:scale-95"
                            title="Increase quantity"
                          >
                            <Plus className="size-3" />
                          </button>
                        </div>

                        {/* Item Discount Toggle Button & Line Total */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleItemDiscount(idx)}
                            className={`size-7 h-7 w-7 rounded-lg flex items-center justify-center transition-all cursor-pointer select-none shrink-0 ${
                              item.discount && item.discount > 0
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-700 shadow-2xs'
                                : item.showDiscount
                                ? 'bg-slate-300 text-slate-800 dark:bg-zinc-700 dark:text-zinc-200'
                                : 'bg-slate-200/70 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400 hover:text-emerald-600'
                            }`}
                            title={item.showDiscount ? "Hide item discount" : "Add item discount"}
                          >
                            <Percent className="size-3" />
                          </button>

                          <div className="flex items-center gap-1.5 text-right">
                            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 dark:text-zinc-500">
                              Total:
                            </span>
                            <span className="font-mono font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                              Rs. {Math.max(0, (item.unitPrice * item.quantity) - (item.discount || 0)).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Mobile Inline Item Discount Bar */}
                      {item.showDiscount && (
                        <div className="pt-1.5 mt-1 border-t border-dashed border-slate-200 dark:border-zinc-800/80 flex items-center justify-between gap-2 text-xs bg-slate-100/60 dark:bg-zinc-900/60 p-1.5 rounded-lg animate-in fade-in duration-150">
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] font-semibold text-slate-600 dark:text-zinc-300">Item Disc:</span>
                            <div className="inline-flex rounded border border-slate-200 dark:border-zinc-800 p-0.5 bg-white dark:bg-zinc-900">
                              <button
                                type="button"
                                onClick={() => handleItemDiscountTypeChange(idx, 'PERCENT')}
                                className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${
                                  (item.discountType || 'PERCENT') === 'PERCENT'
                                    ? 'bg-emerald-600 text-white'
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
                                    ? 'bg-emerald-600 text-white'
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
                                (-{Number(item.discount).toLocaleString()})
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
                    </div>
                  );
                })
              )}
            </div>

            {/* "+ Add Products" Ribbon Action - Dismisses mobile cart drawer to return reps smoothly to catalog */}
            <Button
              type="button"
              variant="outline"
              onClick={() => setMobileCartOpen(false)}
              className="w-full h-9 rounded-xl border-dashed border-emerald-300 dark:border-emerald-700/60 bg-emerald-50/50 hover:bg-emerald-100/70 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-2xs my-1"
            >
              <Plus className="size-4 shrink-0" />
              <span>+ Add Products</span>
            </Button>

            {/* Financial Ledger & Payment Method in Mobile Drawer (Zone 2 scrollable workspace) */}
            <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-2">
              {/* Subtotal & Discount Breakdown: Visually separated into Item Total Discount and Bill Discount */}
              <div className="flex flex-col gap-1.5 text-xs bg-slate-50/60 dark:bg-zinc-950/40 p-2 rounded-lg border border-slate-100 dark:border-zinc-800">
                {/* Row 1: Sub Total (Gross) */}
                <div className="flex items-center justify-between text-slate-600 dark:text-zinc-400">
                  <span className="font-semibold text-slate-700 dark:text-zinc-300">Sub Total:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">Rs. {grossSubtotal.toLocaleString()}</span>
                </div>

                {/* Row 2: Item Total Discount */}
                <div className="flex items-center justify-between text-slate-600 dark:text-zinc-400 pt-1 border-t border-slate-200/60 dark:border-zinc-800/60">
                  <span className="text-[11px] font-medium text-slate-600 dark:text-zinc-400">Item Total Discount:</span>
                  <span className={`font-mono font-bold text-[11px] ${totalItemDiscounts > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                    {totalItemDiscounts > 0 ? `- Rs. ${totalItemDiscounts.toLocaleString()}` : 'Rs. 0'}
                  </span>
                </div>

                {/* Row 3: Bill Discount Controls & Dynamic Badge in Mobile Drawer */}
                <div className="flex flex-wrap items-center justify-between gap-1 pt-1 border-t border-slate-200/60 dark:border-zinc-800/60">
                  <div className="flex items-center gap-1">
                    <span className="text-slate-600 dark:text-zinc-400 font-medium text-[11px]">Bill Discount:</span>
                    <div 
                      className="inline-flex rounded border border-slate-200 dark:border-zinc-800 p-0.5 bg-slate-100 dark:bg-zinc-900 shrink-0"
                      title={`Bill Discount Mode: ${discountType === 'PERCENT' ? 'Percentage (%)' : 'Fixed Amount (Rs)'} (Auto-detected)`}
                    >
                      <button
                        type="button"
                        onClick={() => handleDiscountTypeToggle('PERCENT')}
                        className={`px-1 py-0.2 text-[8.5px] font-bold rounded transition-colors cursor-pointer ${
                          discountType === 'PERCENT'
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400'
                        }`}
                      >
                        %
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDiscountTypeToggle('FIXED')}
                        className={`px-1 py-0.2 text-[8.5px] font-bold rounded transition-colors cursor-pointer ${
                          discountType === 'FIXED'
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400'
                        }`}
                      >
                        Rs
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 ml-auto">
                    {discountType === 'PERCENT' && discountAmount > 0 && (
                      <span className="text-[10px] font-mono text-emerald-600 font-bold whitespace-nowrap">
                        (-Rs. {discountAmount.toLocaleString()})
                      </span>
                    )}
                    <Input
                      type="text"
                      value={discountRawInput}
                      onChange={(e) => handleTotalDiscountChange(e.target.value)}
                      placeholder="0 or 10%"
                      className="w-20 h-6 text-xs text-right font-mono p-1 bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-700 focus:ring-1 focus:ring-emerald-500"
                      title="Type a number for fixed Rs, or include '%' for percentage discount (e.g. 10%)"
                    />
                  </div>
                </div>
              </div>

              {/* Bill Total & Tendered Input */}
              <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block leading-tight">Total Due (Current Bill)</span>
                  <span className="font-mono text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                    Rs. {total.toLocaleString()}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block leading-tight">
                    Tendered ({paymentMethod})
                  </span>
                  <Input
                    type="number"
                    disabled={isEditing}
                    value={clientGivenCash}
                    onChange={(e) => handleClientCashChange(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    placeholder={String(total)}
                    className={`w-24 h-5.5 text-xs text-right font-mono font-bold mt-0.5 p-0.5 ${
                      isEditing
                        ? 'bg-slate-100 dark:bg-zinc-900 cursor-not-allowed !text-black dark:!text-white opacity-100 font-extrabold'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  />
                </div>
              </div>

              {/* Financial Ledger Breakdown */}
              <div className="space-y-0.5 bg-slate-50/80 dark:bg-zinc-950/60 rounded-lg p-1.5 border border-slate-200/80 dark:border-zinc-800/80 text-[10.5px]">
                <div className="flex items-center justify-between">
                  <span className="w-[58%] text-slate-600 dark:text-zinc-400 font-medium">Paid for Current Bill:</span>
                  <span className="w-[42%] text-right font-mono font-bold text-slate-900 dark:text-white">
                    Rs. {paidAmount.toLocaleString()}
                  </span>
                </div>

                {settledDueAmount > 0 && (
                  <div className="flex items-center justify-between text-blue-600 dark:text-blue-400">
                    <div className="w-[58%] flex items-center gap-1 font-medium">
                      <span>Due Settled:</span>
                      {canSettleDue && (
                        <button
                          type="button"
                          onClick={() => setExcessMode('CHANGE')}
                          className="inline-flex items-center gap-0.5 px-1 py-0.1 text-[8.5px] font-bold rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 transition-colors cursor-pointer"
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
                          className="inline-flex items-center gap-0.5 px-1 py-0.1 text-[8.5px] font-bold rounded bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-950 dark:text-blue-300 border border-blue-300 dark:border-blue-800 transition-colors cursor-pointer"
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
                    <div className="border-t border-dashed border-slate-200 dark:border-zinc-800 my-0.5 pt-0.5 flex items-center justify-between text-slate-600 dark:text-zinc-400">
                      <span className="w-[58%] font-medium">Previous Due (Old Bills):</span>
                      <span className="w-[42%] text-right font-mono font-bold text-slate-900 dark:text-white">
                        Rs. {previousDue.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-0.5 text-amber-700 dark:text-amber-300 font-extrabold">
                      <span className="w-[58%] text-[9.5px] uppercase tracking-wider font-bold">Total Accumulated Credit Due:</span>
                      <span className="w-[42%] text-right font-mono text-[11px] font-black">
                        Rs. {totalAccumulatedDue.toLocaleString()}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Payment Methods */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                    Payment Method
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowNoteInput((prev) => !prev)}
                    className={`text-[9.5px] font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                      showNoteInput || paymentNote.trim()
                        ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                        : 'text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300'
                    }`}
                  >
                    <Pencil className="size-2" />
                    <span>{paymentNote.trim() ? 'Edit Note' : showNoteInput ? 'Hide Note' : '+ Note'}</span>
                  </button>
                </div>

                {showNoteInput && (
                  <div className="relative flex items-center animate-in fade-in duration-150">
                    <FileText className="absolute left-2 size-3 text-slate-400 dark:text-zinc-500 pointer-events-none" />
                    <Input
                      value={paymentNote}
                      onChange={(e) => setPaymentNote(e.target.value)}
                      placeholder="Payment note, ref no, or transaction details..."
                      className="pl-7 pr-6 h-6 text-xs rounded-md border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-black dark:text-white font-medium placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus-visible:ring-1 focus-visible:ring-emerald-500 transition-colors"
                    />
                    {paymentNote && (
                      <button
                        type="button"
                        onClick={() => setPaymentNote('')}
                        className="absolute right-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 text-xs p-0.5 cursor-pointer"
                        title="Clear note"
                      >
                        ×
                      </button>
                    )}
                  </div>
                )}

                {splitPayments.length > 0 ? (
                  <div className="flex items-center justify-between px-2 py-1 rounded-md bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-[10.5px]">
                    <div className="flex items-center gap-1 min-w-0">
                      <Layers className="size-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <div className="truncate">
                        <span className="font-bold text-indigo-900 dark:text-indigo-200">
                          Split ({splitPayments.length}):{' '}
                        </span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          Rs. {totalSplitAmount.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setSplitModalOpen(true)}
                        className="text-[9.5px] font-bold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 underline cursor-pointer"
                      >
                        Edit
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
                        className="text-[9.5px] font-bold text-rose-500 hover:text-rose-700 cursor-pointer"
                        title="Clear split configuration"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between px-2 py-1 rounded-md bg-slate-100/70 dark:bg-zinc-900/60 border border-slate-200/60 dark:border-zinc-800/60 text-[10.5px]">
                    <span className="text-slate-500 dark:text-zinc-400 text-[10px]">
                      Need split payment (Cash/Card/Cheque)?
                    </span>
                    <button
                      type="button"
                      onClick={() => setSplitModalOpen(true)}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 hover:underline cursor-pointer flex items-center gap-0.5"
                    >
                      <Layers className="size-2.5" />
                      <span>Split →</span>
                    </button>
                  </div>
                )}

                {/* 5 Payment method triggers */}
                <div className="grid grid-cols-5 gap-1">
                  <button
                    type="button"
                    onClick={() => handleSelectPaymentMethod('CASH')}
                    className={`flex items-center justify-center gap-1 h-7 min-h-[28px] py-1 px-1 text-[10px] rounded-md border font-semibold transition-all cursor-pointer ${
                      paymentMethod === 'CASH' && splitPayments.length === 0
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold shadow-2xs'
                        : 'border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/50'
                    }`}
                  >
                    <Banknote className="size-3" /> <span>Cash</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPaymentMethod('CARD')}
                    className={`flex items-center justify-center gap-1 h-7 min-h-[28px] py-1 px-1 text-[10px] rounded-md border font-semibold transition-all cursor-pointer ${
                      paymentMethod === 'CARD' && splitPayments.length === 0
                        ? 'border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold shadow-2xs'
                        : 'border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/50'
                    }`}
                  >
                    <CreditCard className="size-3" /> <span>Card</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPaymentMethod('BANK_TRANSFER')}
                    className={`flex items-center justify-center gap-1 h-7 min-h-[28px] py-1 px-1 text-[10px] rounded-md border font-semibold transition-all cursor-pointer ${
                      paymentMethod === 'BANK_TRANSFER' && splitPayments.length === 0
                        ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold shadow-2xs'
                        : 'border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/50'
                    }`}
                  >
                    <Landmark className="size-3" /> <span>Bank</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPaymentMethod('CHEQUE')}
                    className={`flex items-center justify-center gap-1 h-7 min-h-[28px] py-1 px-1 text-[10px] rounded-md border font-semibold transition-all cursor-pointer ${
                      paymentMethod === 'CHEQUE' && splitPayments.length === 0
                        ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold shadow-2xs'
                        : 'border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/50'
                    }`}
                  >
                    <FileText className="size-3" /> <span>Cheque</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPaymentMethod('CREDIT')}
                    className={`flex items-center justify-center gap-1 h-7 min-h-[28px] py-1 px-1 text-[10px] rounded-md border font-semibold transition-all cursor-pointer ${
                      paymentMethod === 'CREDIT'
                        ? 'border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold shadow-2xs'
                        : 'border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/50'
                    }`}
                  >
                    <Building className="size-3" /> <span>Credit</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Zone 3: Bottom Sticky Action Bar (shrink-0 sticky bottom-0 bg-white dark:bg-zinc-950 border-t pt-2.5 pb-3 px-3 z-10 shadow-sm) */}
            <div className="shrink-0 sticky bottom-0 bg-white dark:bg-zinc-950 border-t border-slate-100 dark:border-zinc-800 pt-2.5 pb-3 px-3 z-10 shadow-sm space-y-1.5">
              {/* =========================================================================
               * 6. "Pay Now & Print" Workflow:
               * In the checkout drawer for REPs, replace standard "Save Invoice" with primary
               * "Pay Now & Print" action button triggering save API & 80mm thermal receipt print.
               * ========================================================================= */}
              {isRepUser ? (
                <div className="space-y-1.5 w-full">
                  {/* Primary "Pay Now & Print" and "Save & PDF" Action Buttons Row */}
                  <div className="grid grid-cols-2 gap-2 w-full">
                    {/* Pay Now & Print Button */}
                    <Button
                      type="button"
                      disabled={cart.length === 0 || submitting}
                      onClick={() => handleCheckout('SAVE_AND_PRINT')}
                      className="h-11 min-h-[44px] gap-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-emerald-950/20 cursor-pointer transition-all active:scale-[0.98] px-2 truncate"
                    >
                      {submitting ? (
                        <Loader2 className="size-4 animate-spin shrink-0" />
                      ) : (
                        <Printer className="size-4 text-white shrink-0" />
                      )}
                      <span className="truncate">{isEditing ? 'Update & Print' : 'Pay Now & Print'}</span>
                    </Button>

                    {/* Save & PDF Button */}
                    <Button
                      type="button"
                      disabled={cart.length === 0 || submitting}
                      onClick={() => handleCheckout('SAVE_AND_PDF')}
                      className="h-11 min-h-[44px] gap-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-blue-950/20 cursor-pointer transition-all active:scale-[0.98] px-2 truncate"
                    >
                      {submitting ? (
                        <Loader2 className="size-4 animate-spin shrink-0" />
                      ) : (
                        <FileDown className="size-4 text-white shrink-0" />
                      )}
                      <span className="truncate">Save &amp; PDF</span>
                    </Button>
                  </div>

                  {/* Secondary REP Fast Actions */}
                  <div className="grid grid-cols-2 gap-1.5 w-full">
                    <Button
                      type="button"
                      disabled={cart.length === 0 || submitting}
                      onClick={() => handleCheckout('SAVE_ONLY')}
                      className="h-8 min-h-[32px] gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 dark:border-zinc-700 text-xs font-semibold rounded-lg shadow-2xs cursor-pointer transition-all"
                    >
                      <Save className="size-3" />
                      <span>Save Only</span>
                    </Button>
                    <Button
                      type="button"
                      disabled={cart.length === 0 || submitting}
                      onClick={() => handleCheckout('SAVE_AND_WHATSAPP')}
                      className="h-8 min-h-[32px] gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800 text-xs font-semibold rounded-lg shadow-2xs cursor-pointer transition-all"
                    >
                      <MessageSquare className="size-3" />
                      <span>WhatsApp</span>
                    </Button>
                  </div>
                </div>
              ) : (
                /* Standard Desktop/Cashier Drawer Action Buttons */
                <>
                  <div className="grid grid-cols-2 gap-2 w-full">
                    <Button
                      type="button"
                      disabled={cart.length === 0 || submitting}
                      onClick={() => handleCheckout('SAVE_AND_PRINT')}
                      className="h-10 min-h-[40px] gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-2xs cursor-pointer transition-all active:scale-[0.98]"
                    >
                      {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <Printer className="size-3.5 text-white" />}
                      <span className="truncate">{isEditing ? 'Update & Print' : 'Pay Now & Print'}</span>
                    </Button>
                    <Button
                      type="button"
                      disabled={cart.length === 0 || submitting}
                      onClick={() => handleCheckout('SAVE_AND_PDF')}
                      className="h-10 min-h-[40px] gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-2xs cursor-pointer transition-all active:scale-[0.98]"
                    >
                      {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <FileDown className="size-3.5 text-white" />}
                      <span className="truncate">Save &amp; PDF</span>
                    </Button>
                  </div>
                  <div className="flex items-center justify-center gap-2.5 pt-0.5 pb-0">
                    <button
                      type="button"
                      disabled={cart.length === 0 || submitting}
                      onClick={() => handleCheckout('SAVE_ONLY')}
                      className="text-[10.5px] font-semibold text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200 inline-flex items-center gap-1 cursor-pointer hover:underline disabled:opacity-50 min-h-[22px] py-0"
                    >
                      <Save className="size-2.5" />
                      <span>{isEditing ? 'Save Only' : 'Save Invoice'}</span>
                    </button>
                    <span className="text-slate-300 dark:text-zinc-700 text-xs">|</span>
                    <button
                      type="button"
                      disabled={cart.length === 0 || submitting}
                      onClick={() => handleCheckout('SAVE_AND_WHATSAPP')}
                      className="text-[10.5px] font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 inline-flex items-center gap-1 cursor-pointer hover:underline disabled:opacity-50 min-h-[22px] py-0"
                    >
                      <MessageSquare className="size-2.5" />
                      <span>Save &amp; WhatsApp</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Quick Customer Add Modal within POS Terminal */}
      <Dialog open={customerModalOpen} onOpenChange={setCustomerModalOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Quick Register Customer</DialogTitle>
          </DialogHeader>
          {/* Compact 2-column layout to eliminate unnecessary height */}
          <form onSubmit={handleQuickAddCustomer} className="space-y-3 py-2">
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

      {/* Product Detailed Specs & Preview Modal (Eye Icon Trigger) */}
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

      {/* Dedicated Hidden 80mm Thermal Receipt Layout (X-Printer format) */}
      <ThermalReceipt80mm order={savedOrderForPrint} />
    </div>
  );
};