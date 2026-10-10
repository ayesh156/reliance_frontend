import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate,useParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { SearchableSelect } from '../components/ui/searchable-select';
import { MaterialCombobox } from '../components/materials/MaterialCombobox';
import { DatePicker } from '../components/ui/date-picker';
import { DateTimePicker } from '../components/ui/date-time-picker';
import { QuickAddShopModal } from '../components/materials/QuickAddShopModal'; // ⭐ New Shop Modal
import { QuickAddMaterialModal } from '../components/materials/QuickAddMaterialModal'; // ⭐ New Material Modal
import { useTheme } from '../contexts/ThemeContext';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '../components/ui/table';
import { get, post, put } from '../lib/api';
import { toast } from 'react-toastify';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../components/ui/dialog';
import {
  ArrowLeft,
  ShoppingCart,
  PlusCircle,
  X,
  Sparkles,
  Loader2,
  Building2,
  Receipt,
  Calendar,
  Save,
  Plus,
  MessageSquare,
  Trash2,
  Landmark,
  FileText,
  Pencil,
  Banknote,
  CreditCard,
  CheckCircle2,
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

export interface ChequeEntry {
  id: string;
  chequeNumber: string;
  bankName: string;
  chequeDate: string;
  amount: string;
}

const getCurrentLocalISOString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const mins = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${mins}`;
};

export type PurchasePaymentMethod = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CHEQUE';

export interface PurchasePaymentRow {
  id: string;
  method: PurchasePaymentMethod;
  amount: string;
  paymentDate: string;
  reference?: string;
  chequeNumber?: string;
  bankName?: string;
}

const PAYMENT_METHODS = ['CASH', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'CREDIT'];

export const BuyRawMaterialFormPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>(); // ⭐ URL parameter eක ලබා ගැනීම
  const isEditMode = Boolean(id); // ⭐ Edit Mode එකක්දැයි හඳුනාගැනීම

  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [shops, setShops] = useState<RawMaterialShop[]>([]);
  const [materialItems, setMaterialItems] = useState<RawMaterialItem[]>([]);
  const [loadingPrereqs, setLoadingPrereqs] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isLoadingEditData, setIsLoadingEditData] = useState<boolean>(false);

  // Form states
  const [selectedShopId, setSelectedShopId] = useState<number | ''>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  
  // Quick Add Modal Trigger States
  const [isShopModalOpen, setIsShopModalOpen] = useState<boolean>(false);
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState<boolean>(false);
  const [activeMaterialRowIndex, setActiveMaterialRowIndex] = useState<number | null>(null);
  const [purchaseDate, setPurchaseDate] = useState<Date | undefined>(new Date());
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [paidAmount, setPaidAmount] = useState<number | ''>('');
  const [notes, setNotes] = useState<string>('');
  // Multi-cheque dynamic split list state
  const [cheques, setCheques] = useState<ChequeEntry[]>([
    { id: '1', chequeNumber: '', bankName: '', chequeDate: new Date().toISOString().split('T')[0], amount: '' },
  ]);
  // Multi-Payment rows state (hydrated on edit, editable on create/edit)
  const [paymentRows, setPaymentRows] = useState<PurchasePaymentRow[]>([]);
  // Dedicated single entry form state for GRN payments
  const [entryMethod, setEntryMethod] = useState<PurchasePaymentMethod>('CASH');
  const [entryAmount, setEntryAmount] = useState<string>('');
  const [entryDate, setEntryDate] = useState<string>(getCurrentLocalISOString);
  const [entryChequeNumber, setEntryChequeNumber] = useState<string>('');
  const [entryBankName, setEntryBankName] = useState<string>('');
  const [entryReference, setEntryReference] = useState<string>('');

  // Editing state for GRN payment row modal
  const [editingPaymentRow, setEditingPaymentRow] = useState<PurchasePaymentRow | null>(null);
  const [editMethod, setEditMethod] = useState<PurchasePaymentMethod>('CASH');
  const [editAmount, setEditAmount] = useState<string>('');
  const [editDate, setEditDate] = useState<string>(getCurrentLocalISOString);
  const [editChequeNumber, setEditChequeNumber] = useState<string>('');
  const [editBankName, setEditBankName] = useState<string>('');
  const [editReference, setEditReference] = useState<string>('');

  // ⭐ Preserve existing payment history ledger when updating notes in Edit Mode
  const [existingPaymentsLedger, setExistingPaymentsLedger] = useState<any[]>([]);
  const [generatingInvoice, setGeneratingInvoice] = useState<boolean>(false);

  const [lineItems, setLineItems] = useState<PurchaseLineItem[]>([
    { rawMaterialItemId: '', quantity: '', pricePerUnit: '', batchNumber: '' },
  ]);

  // 🟢 Comment Update: Edit Mode හිදී පවතින Order දත්ත ලබා ගැනීම සහ Prerequisites load කිරීම
  useEffect(() => {
    const loadPrerequisitesAndData = async () => {
      try {
        setLoadingPrereqs(true);
        const [shopsData, itemsData] = await Promise.all([
          get<RawMaterialShop[]>('/raw-material-shops'),
          get<RawMaterialItem[]>('/raw-material-items'),
        ]);
        setShops(shopsData || []);
        setMaterialItems(itemsData || []);

        // ⭐ Edit Mode එකක් නම් පවතින Purchase Order එක fetch කර form එක පිරීම
        if (id) {
          setIsLoadingEditData(true);
          const orderData = await get<any>(`/buy-raw-materials/${id}`);
          if (orderData) {
            setSelectedShopId(orderData.shop?.id || orderData.rawMaterialShopId || '');
            setInvoiceNumber(orderData.invoiceNumber || '');
            setPurchaseDate(orderData.purchaseDate ? new Date(orderData.purchaseDate) : new Date());
            setPaymentMethod(orderData.paymentMethod || 'CASH');
            setPaidAmount(orderData.paidAmount ?? '');

            // ⭐ Safely parse user note text and extract background payments & cheques ledger
            let displayNote = '';
            let parsedLedger: any[] = [];
            let parsedCheques: any[] = [];
            if (orderData.notes) {
              try {
                if (orderData.notes.startsWith('{')) {
                  const parsed = JSON.parse(orderData.notes);
                  displayNote = parsed.userNotes || '';
                  parsedLedger = Array.isArray(parsed.payments) ? parsed.payments : [];
                  if (Array.isArray(parsed.cheques) && parsed.cheques.length > 0) {
                    parsedCheques = parsed.cheques;
                    setCheques(
                      parsed.cheques.map((c: any, idx: number) => ({
                        id: String(idx + 1),
                        chequeNumber: c.chequeNumber || '',
                        bankName: c.bankName || '',
                        chequeDate: c.chequeDate ? new Date(c.chequeDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                        amount: String(c.amount || ''),
                      }))
                    );
                  }
                } else {
                  displayNote = orderData.notes;
                }
              } catch {
                displayNote = orderData.notes;
              }
            }
            setNotes(displayNote);
            setExistingPaymentsLedger(parsedLedger);

            // ⭐ Hydrate recorded payments list for visible editing
            let hydratedPaymentRows: PurchasePaymentRow[] = [];
            if (Array.isArray(orderData.payments) && orderData.payments.length > 0) {
              hydratedPaymentRows = orderData.payments.map((p: any, idx: number) => {
                let chq = p.chequeNumber || '';
                let bName = p.bankName || '';
                if (p.method === 'CHEQUE' && p.reference && !chq) {
                  const match = p.reference.match(/Cheque #([^\s(]+)(?:\s*\(([^)]+)\))?/i);
                  if (match) {
                    chq = match[1] || '';
                    bName = match[2] || '';
                  }
                }
                return {
                  id: String(p.id || idx + 1),
                  method: p.method === 'CHEQUE' ? 'CHEQUE' : p.method === 'BANK_TRANSFER' ? 'BANK_TRANSFER' : 'CASH',
                  amount: String(p.amount || ''),
                  paymentDate: p.paymentDate ? new Date(p.paymentDate).toISOString().split('T')[0] : (p.createdAt ? new Date(p.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
                  reference: p.reference || '',
                  chequeNumber: chq,
                  bankName: bName,
                };
              });
            } else if (parsedLedger.length > 0) {
              hydratedPaymentRows = parsedLedger.map((p: any, idx: number) => ({
                id: String(p.id || idx + 1),
                method: p.method === 'CHEQUE' ? 'CHEQUE' : p.method === 'BANK_TRANSFER' ? 'BANK_TRANSFER' : 'CASH',
                amount: String(p.amount || ''),
                paymentDate: p.createdAt ? new Date(p.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                reference: p.reference || '',
                chequeNumber: p.chequeNumber || '',
                bankName: p.bankName || '',
              }));
            } else if (parsedCheques.length > 0) {
              hydratedPaymentRows = parsedCheques.map((c: any, idx: number) => ({
                id: String(idx + 1),
                method: 'CHEQUE',
                amount: String(c.amount || ''),
                paymentDate: c.chequeDate ? new Date(c.chequeDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                chequeNumber: c.chequeNumber || '',
                bankName: c.bankName || '',
                reference: `Cheque #${c.chequeNumber || ''}`,
              }));
            } else if (orderData.paidAmount > 0) {
              hydratedPaymentRows = [
                {
                  id: '1',
                  method: (orderData.paymentMethod as any) || 'CASH',
                  amount: String(orderData.paidAmount),
                  paymentDate: orderData.purchaseDate ? new Date(orderData.purchaseDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                  reference: 'Initial Down Payment',
                },
              ];
            }
            setPaymentRows(hydratedPaymentRows);

            if (Array.isArray(orderData.items) && orderData.items.length > 0) {
              setLineItems(
                orderData.items.map((item: any) => ({
                  rawMaterialItemId: item.rawMaterialItem?.id || item.rawMaterialItemId,
                  quantity: item.quantity,
                  pricePerUnit: item.pricePerUnit,
                  batchNumber: item.batchNumber || '',
                }))
              );
            }
          }
        }
      } catch (err: any) {
        toast.error(err.message || 'Failed to load purchase details or catalogue');
      } finally {
        setLoadingPrereqs(false);
        setIsLoadingEditData(false);
      }
    };
    loadPrerequisitesAndData();
  }, [id]);

  const handleAddLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      { rawMaterialItemId: '', quantity: '', pricePerUnit: '', batchNumber: '' },
    ]);
  };

  const handleRemoveLineItem = (index: number) => {
    if (lineItems.length === 1) {
      toast.warn('At least one item is required in the purchase order');
      return;
    }
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleLineItemChange = (index: number, field: keyof PurchaseLineItem, value: any) => {
    setLineItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };

      if (field === 'rawMaterialItemId') {
        const found = materialItems.find((m) => m.id === Number(value));
        if (found && !updated[index].pricePerUnit && found.unitCostAverage > 0) {
          updated[index].pricePerUnit = found.unitCostAverage;
        }
      }
      return updated;
    });
  };

  // Multi-Payment Rows calculations and helpers
  const totalPaymentRowsAmount = useMemo(() => {
    return paymentRows.reduce((sum, row) => sum + (Math.max(0, Number(row.amount)) || 0), 0);
  }, [paymentRows]);

  const handleAddPaymentEntry = (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    const num = parseFloat(entryAmount);
    if (isNaN(num) || num <= 0) {
      toast.error('Please enter a valid positive payment amount');
      return;
    }

    if (entryMethod === 'CHEQUE' && !entryChequeNumber.trim()) {
      toast.warn('Please enter Cheque Number');
    }

    const newRow: PurchasePaymentRow = {
      id: `pay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      method: entryMethod,
      amount: String(num),
      paymentDate: entryDate || new Date().toISOString().split('T')[0],
      chequeNumber: entryChequeNumber.trim() || undefined,
      bankName: entryBankName.trim() || undefined,
      reference: entryReference.trim() || undefined,
    };

    setPaymentRows((prev) => {
      const updated = [...prev, newRow];
      const sum = updated.reduce((s, r) => s + (Math.max(0, Number(r.amount)) || 0), 0);
      setPaidAmount(sum);
      return updated;
    });
    
    // Clear single entry form
    const nextRemaining = Math.max(0, dueDebtAmount - num);
    setEntryAmount(nextRemaining > 0 ? String(nextRemaining) : '');
    setEntryChequeNumber('');
    setEntryBankName('');
    setEntryReference('');
    toast.success(`Payment of Rs. ${num.toLocaleString()} added to purchase`);
  };

  const handleFillEntryRemaining = () => {
    setEntryAmount(dueDebtAmount > 0 ? String(dueDebtAmount) : '0');
  };

  const handleRemovePaymentRow = (id: string) => {
    setPaymentRows((prev) => {
      const updated = prev.filter((r) => r.id !== id);
      const sum = updated.reduce((s, r) => s + (Math.max(0, Number(r.amount)) || 0), 0);
      setPaidAmount(sum > 0 ? sum : '');
      return updated;
    });
    toast.info('Payment entry removed');
  };

  const handleInitiateEditPaymentRow = (row: PurchasePaymentRow) => {
    setEditingPaymentRow(row);
    setEditMethod(row.method);
    setEditAmount(row.amount);
    setEditDate(row.paymentDate || new Date().toISOString().split('T')[0]);
    setEditChequeNumber(row.chequeNumber || '');
    setEditBankName(row.bankName || '');
    setEditReference(row.reference || '');
  };

  const handleSaveEditPaymentRow = (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    if (!editingPaymentRow) return;
    const num = parseFloat(editAmount);
    if (isNaN(num) || num <= 0) {
      toast.error('Please enter a valid positive payment amount');
      return;
    }

    setPaymentRows((prev) => {
      const updated = prev.map((r) =>
        r.id === editingPaymentRow.id
          ? {
              ...r,
              method: editMethod,
              amount: String(num),
              paymentDate: editDate,
              chequeNumber: editChequeNumber.trim() || undefined,
              bankName: editBankName.trim() || undefined,
              reference: editReference.trim() || undefined,
            }
          : r
      );
      const sum = updated.reduce((s, r) => s + (Math.max(0, Number(r.amount)) || 0), 0);
      setPaidAmount(sum);
      return updated;
    });

    setEditingPaymentRow(null);
    toast.success('Payment record updated');
  };

  const handleDeleteFromEditPaymentRow = () => {
    if (!editingPaymentRow) return;
    setPaymentRows((prev) => {
      const updated = prev.filter((r) => r.id !== editingPaymentRow.id);
      const sum = updated.reduce((s, r) => s + (Math.max(0, Number(r.amount)) || 0), 0);
      setPaidAmount(sum > 0 ? sum : '');
      return updated;
    });
    setEditingPaymentRow(null);
    toast.info('Payment record removed');
  };

  // Multi-Cheque Split helpers
  const totalChequeAmount = useMemo(() => {
    if (paymentMethod !== 'CHEQUE') return 0;
    return cheques.reduce((acc, curr) => acc + (Math.max(0, Number(curr.amount)) || 0), 0);
  }, [cheques, paymentMethod]);

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

  const handleSelectPaymentMethod = (method: string) => {
    setPaymentMethod(method);
  };

  const calculatedTotalAmount = useMemo(() => {
    return lineItems.reduce((sum, item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.pricePerUnit) || 0;
      return sum + qty * price;
    }, 0);
  }, [lineItems]);

  const effectivePaidAmount = useMemo(() => {
    if (paymentRows.length > 0) {
      return totalPaymentRowsAmount;
    }
    if (paymentMethod === 'CHEQUE') return totalChequeAmount;
    if (paidAmount === '') return 0;
    return Number(paidAmount) || 0;
  }, [paymentRows.length, totalPaymentRowsAmount, paymentMethod, totalChequeAmount, paidAmount]);

  const dueDebtAmount = useMemo(() => {
    return Math.max(0, calculatedTotalAmount - effectivePaidAmount);
  }, [calculatedTotalAmount, effectivePaidAmount]);

  // ⭐ Auto-Switch Payment Method:
  // 1. Paid amount is empty or less than total bill -> Automatically switch to CREDIT
  // 2. Paid amount meets or exceeds total bill -> If previously CREDIT, auto-switch to CASH (preserves CHEQUE/BANK_TRANSFER)
  useEffect(() => {
    if (calculatedTotalAmount <= 0) return;
    if (paymentRows.length > 0) return;
    if (paymentMethod === 'CHEQUE' || paymentMethod === 'BANK_TRANSFER') return;

    // Empty input box denotes Rs. 0 payment (Pure Credit Purchase)
    const numericPaid = paidAmount === '' ? 0 : Number(paidAmount);

    if (numericPaid < calculatedTotalAmount) {
      if (paymentMethod !== 'CREDIT') {
        setPaymentMethod('CREDIT');
      }
    } else {
      if (paymentMethod === 'CREDIT') {
        setPaymentMethod('CASH');
      }
    }
  }, [paidAmount, calculatedTotalAmount, paymentMethod, paymentRows.length]);

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

  // 🟢 Comment Update: Create (POST) සහ Edit (PUT) දෙකම සපෝට් වන ලෙස Submit handler එක වෙනස් කිරීම
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

      let resolvedPayments: any[] | undefined = undefined;
      let resolvedCheques: any[] | undefined = undefined;
      let resolvedPaidAmount = 0;

      if (paymentRows.length > 0) {
        resolvedPayments = paymentRows
          .filter((r) => Number(r.amount) > 0 || r.reference || r.chequeNumber)
          .map((r) => ({
            method: r.method,
            amount: Number(r.amount) || 0,
            paymentDate: r.paymentDate || new Date().toISOString().split('T')[0],
            reference: r.reference || r.bankName || undefined,
            chequeNumber: r.chequeNumber || undefined,
            bankName: r.bankName || undefined,
          }));

        resolvedCheques = resolvedPayments
          .filter((p) => p.method === 'CHEQUE')
          .map((p) => ({
            chequeNumber: p.chequeNumber || '',
            bankName: p.bankName || '',
            chequeDate: p.paymentDate,
            amount: p.amount,
          }));

        resolvedPaidAmount = resolvedPayments.reduce((sum, p) => sum + p.amount, 0);
      } else if (paymentMethod === 'CHEQUE') {
        resolvedCheques = cheques
          .filter((c) => Number(c.amount) > 0 || c.chequeNumber.trim() !== '')
          .map((c) => ({
            chequeNumber: c.chequeNumber.trim(),
            bankName: c.bankName.trim(),
            chequeDate: c.chequeDate,
            amount: Number(c.amount) || 0,
          }));
        resolvedPaidAmount = totalChequeAmount;
        resolvedPayments = resolvedCheques.map((c) => ({
          method: 'CHEQUE',
          amount: c.amount,
          paymentDate: c.chequeDate,
          reference: c.bankName,
          chequeNumber: c.chequeNumber,
          bankName: c.bankName,
        }));
      } else {
        resolvedPaidAmount = paidAmount === '' ? 0 : Number(paidAmount);
        if (resolvedPaidAmount > 0) {
          resolvedPayments = [
            {
              method: paymentMethod,
              amount: resolvedPaidAmount,
              paymentDate: purchaseDate ? purchaseDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            },
          ];
        }
      }

      // Automatically determine primary payment method
      let effectivePaymentMethod = paymentMethod;
      if (paymentRows.length > 0) {
        if (resolvedPaidAmount === 0) {
          effectivePaymentMethod = 'CREDIT';
        } else if (paymentRows.length === 1) {
          effectivePaymentMethod = paymentRows[0].method;
        } else {
          effectivePaymentMethod = resolvedPaidAmount >= calculatedTotalAmount ? 'SPLIT' : 'CREDIT';
        }
      }

      // ⭐ Pack notes: If existing payments ledger or cheques exist, retain it alongside updated note
      let finalNotesPayload: string | undefined = undefined;
      const cleanUserNote = notes.trim();

      if (
        (resolvedPayments && resolvedPayments.length > 0) ||
        (resolvedCheques && resolvedCheques.length > 0) ||
        existingPaymentsLedger.length > 0
      ) {
        finalNotesPayload = JSON.stringify({
          userNotes: cleanUserNote,
          cheques: resolvedCheques && resolvedCheques.length > 0 ? resolvedCheques : undefined,
          payments: resolvedPayments && resolvedPayments.length > 0 ? resolvedPayments : existingPaymentsLedger,
        });
      } else if (cleanUserNote) {
        finalNotesPayload = cleanUserNote;
      }

      const payload = {
        rawMaterialShopId: Number(selectedShopId),
        invoiceNumber: invoiceNumber.trim() || undefined,
        purchaseDate: purchaseDate ? purchaseDate.toISOString() : new Date().toISOString(),
        paymentMethod: effectivePaymentMethod,
        paidAmount: resolvedPaidAmount,
        payments: resolvedPayments,
        cheques: resolvedCheques && resolvedCheques.length > 0 ? resolvedCheques : undefined,
        notes: finalNotesPayload,
        items: lineItems.map((item) => ({
          rawMaterialItemId: Number(item.rawMaterialItemId),
          quantity: Number(item.quantity),
          pricePerUnit: Number(item.pricePerUnit),
          batchNumber: item.batchNumber?.trim() || undefined,
        })),
      };

      if (isEditMode && id) {
        // Edit Mode එකේදී PUT request එක යැවීම
        await put(`/buy-raw-materials/${id}`, payload);
        toast.success('Purchase order updated successfully');
      } else {
        // New Purchase එකක් සෑදීමේදී POST request එක යැවීම
        await post('/buy-raw-materials', payload);
        toast.success('Raw materials received and stock updated successfully');
      }

      navigate('/system/buy-raw-materials');
    } catch (err: any) {
      toast.error(err.message || 'Failed to process purchase');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-6xl mx-auto pb-20">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => navigate('/system/buy-raw-materials')}
            className="size-9"
          >
            <ArrowLeft className="size-4" />
          </Button>
          {/* 🟢 Comment Update: Dynamic title based on isEditMode */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <ShoppingCart className="size-6 text-indigo-600 dark:text-indigo-400" />
              {isEditMode ? `Edit Purchase Order #${id}` : 'New Material Purchase (Stock-In)'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              {isEditMode
                ? 'Update supplier purchase order details and update stock accordingly.'
                : 'Receive raw materials from suppliers, update stock inventory, and record payments.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate('/system/buy-raw-materials')}
          >
            Cancel
          </Button>
          <Button
            form="stock-in-form"
            type="submit"
            size="sm"
            disabled={isSubmitting || loadingPrereqs}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer shadow-xs"
          >
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {isEditMode ? 'Update Purchase Order' : 'Confirm Stock-In'}
          </Button>
        </div>
      </div>

      <form id="stock-in-form" onSubmit={handleFormSubmit} className="space-y-6">
        {/* Supplier & Invoice Card */}
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-5 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 flex items-center gap-2">
            <Building2 className="size-4 text-indigo-600" /> Supplier &amp; Invoice Information
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            {/* 1. Supplier Shop Selector */}
            <div className="space-y-1.5 flex flex-col justify-end">
              <div className="flex items-center justify-between h-5">
                <label className="text-xs font-semibold">Supplier Shop *</label>
                <button
                  type="button"
                  onClick={() => setIsShopModalOpen(true)}
                  className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <PlusCircle className="size-3" /> + Add Shop
                </button>
              </div>
              <SearchableSelect
                value={String(selectedShopId)}
                onValueChange={(val) => setSelectedShopId(Number(val))}
                options={shops.map((s) => ({ value: String(s.id), label: s.name }))}
                placeholder="Select Supplier Shop"
                searchPlaceholder="Search shop..."
                className="h-10" // ⭐ Explicitly pass h-10 only for this form row
                dark={dark}
              />
            </div>

            {/* 2. Supplier Invoice Number */}
            <div className="space-y-1.5 flex flex-col justify-end">
              <div className="flex items-center h-5">
                <label className="text-xs font-semibold">Supplier Invoice No</label>
              </div>
              <div className="relative flex items-center">
                <Input
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="Enter Invoice No or click to generate"
                  className="pr-10 font-mono text-xs uppercase h-10"
                />
                {invoiceNumber.trim() ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setInvoiceNumber('')}
                    className="absolute right-1 size-8 text-slate-400 hover:text-rose-500 hover:bg-transparent"
                    title="Clear invoice number"
                  >
                    <X className="size-4" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={generatingInvoice}
                    onClick={async () => {
                      const inv = await fetchNextInvoiceFromBackend();
                      setInvoiceNumber(inv);
                    }}
                    className="absolute right-1 size-8 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                    title="Auto generate PO number"
                  >
                    {generatingInvoice ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Sparkles className="size-4 animate-pulse" />
                    )}
                  </Button>
                )}
              </div>
            </div>

            {/* 3. Purchase Date Picker */}
            <div className="space-y-1.5 flex flex-col justify-end">
              <div className="flex items-center h-5">
                <label className="text-xs font-semibold">Purchase Date</label>
              </div>
              <DatePicker
                date={purchaseDate}
                onDateChange={setPurchaseDate}
                placeholder="Select purchase date"
                className="h-10"
              />
            </div>
          </div>
        </div>

        {/* Materials Table Card */}
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 flex items-center gap-2">
              <Receipt className="size-4 text-indigo-600" /> Materials Received (Line Items)
            </h3>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setActiveMaterialRowIndex(null);
                  setIsMaterialModalOpen(true);
                }}
                className="gap-1.5 h-8 text-xs font-semibold border-indigo-200 dark:border-indigo-900/50 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
              >
                <Plus className="size-3.5" /> Register New Item
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddLineItem}
                className="gap-1.5 h-8 text-xs font-semibold"
              >
                <PlusCircle className="size-3.5 text-indigo-600" /> Add Row
              </Button>
            </div>
          </div>

          {/* ── Mobile / Tablet Adaptive Purchase Item Cards (< 1024px) ── */}
          <div className="block lg:hidden space-y-3">
            {lineItems.map((item, index) => {
              const rowTotal = (Number(item.quantity) || 0) * (Number(item.pricePerUnit) || 0);
              const selectedMat = materialItems.find((m) => m.id === Number(item.rawMaterialItemId));

              return (
                <div
                  key={index}
                  className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 p-3.5 sm:p-4 shadow-xs space-y-3"
                >
                  {/* Card Header: Item # and Delete button */}
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-zinc-800/80">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-400">Item #{index + 1}</span>
                      {selectedMat && (
                        <span className="text-[11px] text-slate-500 font-medium">
                          Stock: <strong className="font-mono text-slate-700 dark:text-zinc-300">{selectedMat.currentStock} {selectedMat.unit}</strong>
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
                      <Trash2 className="size-4" />
                    </Button>
                  </div>

                  {/* Material Dropdown / Combobox */}
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

                  {/* Quantity and Unit Price in 2-Col Grid */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                        Quantity ({selectedMat?.unit || 'Units'}) *
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

          {/* ── Desktop Viewport (>= 1024px) Standard Table ── */}
          <div className="hidden lg:block rounded-xl border border-slate-200 dark:border-zinc-800 overflow-visible">
            <Table className="overflow-visible">
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-zinc-900/50">
                  <TableHead className="w-[40%]">Material Item *</TableHead>
                  <TableHead className="w-[18%]">Quantity *</TableHead>
                  <TableHead className="w-[20%]">Cost / Unit (Rs) *</TableHead>
                  <TableHead className="w-[16%] text-right">Row Total</TableHead>
                  <TableHead className="w-[6%]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineItems.map((item, index) => {
                  const rowTotal = (Number(item.quantity) || 0) * (Number(item.pricePerUnit) || 0);

                  return (
                    <TableRow key={index} className="items-center">
                      <TableCell className="align-middle py-2.5">
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
                      </TableCell>
                      <TableCell className="align-middle py-2.5">
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
                      <TableCell className="align-middle py-2.5">
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
                      <TableCell className="align-middle py-2.5 text-right font-mono font-bold text-xs text-slate-900 dark:text-white">
                        Rs. {rowTotal.toLocaleString()}
                      </TableCell>
                      <TableCell className="align-middle py-2.5 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveLineItem(index)}
                          disabled={lineItems.length === 1}
                          className="size-8 text-slate-400 hover:text-rose-500 disabled:opacity-40 cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Financials & Recorded Payments / Cheques Card */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Recorded Payments / Payment Splits */}
          <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                  <Landmark className="size-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-zinc-200">
                    Recorded Payments &amp; Cheques
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    {paymentRows.length > 0
                      ? `${paymentRows.length} payment entries recorded for this purchase`
                      : 'Single payment method or split across multiple dates/cheques'}
                  </p>
                </div>
              </div>

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleFillEntryRemaining}
                className="h-8 px-3 text-xs font-bold border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg gap-1.5 cursor-pointer whitespace-nowrap self-start sm:self-auto"
              >
                <Plus className="size-3.5" /> + New Payment
              </Button>
            </div>

            {/* Dedicated Single Entry Form at Top for GRN Payments */}
            <div
              className="p-3 sm:p-3.5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/40 space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-200 flex items-center gap-1.5 whitespace-nowrap">
                  <Plus className="size-3.5 text-indigo-600 dark:text-indigo-400" />
                  Add Payment Entry
                </span>
                {dueDebtAmount > 0 && (
                  <button
                    type="button"
                    onClick={handleFillEntryRemaining}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 inline-flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1 rounded-md border border-indigo-200 dark:border-indigo-900/60 cursor-pointer whitespace-normal text-left sm:text-right"
                  >
                    <Sparkles className="size-3 shrink-0" />
                    <span>Fill Remaining Due (Rs. {dueDebtAmount.toLocaleString()})</span>
                  </button>
                )}
              </div>

              {/* Inputs Form: Responsive Grid Container (Zero Mobile Overflow) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 items-end w-full">
                {/* Method */}
                <div className="sm:col-span-1 lg:col-span-3 space-y-1 w-full">
                  <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-300 block whitespace-nowrap">Method *</label>
                  <SearchableSelect
                    value={entryMethod}
                    onValueChange={(val) => setEntryMethod(val as PurchasePaymentMethod)}
                    options={[
                      { value: 'CASH', label: 'Cash', icon: <Banknote className="size-3.5 text-emerald-500" /> },
                      { value: 'CARD', label: 'Card / POS', icon: <CreditCard className="size-3.5 text-purple-500" /> },
                      { value: 'BANK_TRANSFER', label: 'Bank T', icon: <Landmark className="size-3.5 text-blue-500" /> },
                      { value: 'CHEQUE', label: 'Cheque', icon: <FileText className="size-3.5 text-amber-500" /> },
                    ]}
                    placeholder="Select Method"
                    searchPlaceholder="Search method..."
                    dark={dark}
                    className="h-9 py-0 rounded-lg text-xs w-full"
                  />
                </div>

                {/* Amount */}
                <div className="sm:col-span-1 lg:col-span-3 space-y-1 w-full">
                  <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-300 block whitespace-nowrap">Amount (Rs.) *</label>
                  <div className="relative flex items-center w-full">
                    <span className="absolute left-2.5 text-xs font-mono font-bold text-slate-400">Rs.</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={entryAmount}
                      onChange={(e) => setEntryAmount(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddPaymentEntry(e);
                        }
                      }}
                      onFocus={(e) => e.target.select()}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      placeholder="0.00"
                      className="pl-8 h-9 font-mono font-bold text-xs text-right bg-white dark:bg-zinc-900 rounded-lg border-indigo-200 dark:border-indigo-900 text-indigo-700 dark:text-indigo-300 w-full"
                    />
                  </div>
                </div>

                {/* Date & Time */}
                <div className="sm:col-span-2 lg:col-span-4 space-y-1 w-full min-w-0">
                  <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-300 block whitespace-nowrap">Date & Time *</label>
                  <DateTimePicker
                    value={entryDate}
                    onChange={setEntryDate}
                    className="h-9 w-full"
                  />
                </div>

                {/* Add Button */}
                <div className="sm:col-span-2 lg:col-span-2 w-full">
                  <Button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      handleAddPaymentEntry(e);
                    }}
                    disabled={!entryAmount || parseFloat(entryAmount) <= 0}
                    title="Add Payment Entry"
                    className="w-full h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white flex items-center justify-center gap-1.5 shadow-sm cursor-pointer text-xs font-semibold"
                  >
                    <Plus className="size-4" /> Add Entry
                  </Button>
                </div>
              </div>

              {/* Method Specific Extra fields */}
              {entryMethod === 'CHEQUE' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-amber-200/40 dark:border-amber-900/40 animate-in fade-in duration-100">
                  <Input
                    type="text"
                    value={entryChequeNumber}
                    onChange={(e) => setEntryChequeNumber(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddPaymentEntry(e);
                      }
                    }}
                    placeholder="Cheque No (e.g. CHQ-48201) *"
                    className="h-8 text-xs font-mono bg-white dark:bg-zinc-900 rounded-xl border-amber-200 dark:border-amber-800/60"
                  />
                  <Input
                    type="text"
                    value={entryBankName}
                    onChange={(e) => setEntryBankName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddPaymentEntry(e);
                      }
                    }}
                    placeholder="Bank & Branch Name (e.g. Commercial Bank)"
                    className="h-8 text-xs bg-white dark:bg-zinc-900 rounded-xl border-amber-200 dark:border-amber-800/60"
                  />
                </div>
              )}

              {entryMethod === 'BANK_TRANSFER' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-blue-200/40 dark:border-blue-900/40 animate-in fade-in duration-100">
                  <Input
                    type="text"
                    value={entryBankName}
                    onChange={(e) => setEntryBankName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddPaymentEntry(e);
                      }
                    }}
                    placeholder="Bank Name (e.g. Sampath Bank)"
                    className="h-8 text-xs bg-white dark:bg-zinc-900 rounded-xl border-blue-200 dark:border-blue-800/60"
                  />
                  <Input
                    type="text"
                    value={entryReference}
                    onChange={(e) => setEntryReference(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddPaymentEntry(e);
                      }
                    }}
                    placeholder="Transfer Reference / Deposit Slip No"
                    className="h-8 text-xs font-mono bg-white dark:bg-zinc-900 rounded-xl border-blue-200 dark:border-blue-800/60"
                  />
                </div>
              )}

              {entryMethod === 'CASH' && (
                <div className="pt-0.5">
                  <Input
                    type="text"
                    value={entryReference}
                    onChange={(e) => setEntryReference(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddPaymentEntry(e);
                      }
                    }}
                    placeholder="Optional reference / payment note..."
                    className="h-7 text-[11px] bg-white dark:bg-zinc-900 rounded-xl border-slate-200 dark:border-zinc-800"
                  />
                </div>
              )}
            </div>

            {/* Render Recorded Payments in Single-line Ledger Rows with Edit & Delete */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  Recorded Payments Ledger ({paymentRows.length})
                </span>
                {paymentRows.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentRows([]);
                      setPaidAmount('');
                    }}
                    className="text-[11px] font-semibold text-rose-500 hover:text-rose-700 cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {paymentRows.length === 0 ? (
                <div className="py-6 text-center rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 bg-slate-50/40 dark:bg-zinc-950/20">
                  <Landmark className="size-7 text-slate-300 dark:text-zinc-600 mx-auto mb-1.5" />
                  <p className="text-xs font-semibold text-slate-600 dark:text-zinc-400">No payment entries recorded yet</p>
                  <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                    Add cash, cheque, or bank transfer payments above or enter down payment in the summary.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {paymentRows.map((row) => (
                    <div
                      key={row.id}
                      className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 group hover:border-slate-300 dark:hover:border-zinc-700 transition-colors shadow-xs"
                    >
                      {/* Left: Method Badge, Amount, Details */}
                      <div className="flex items-center gap-2 flex-wrap min-w-0 w-full sm:w-auto">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold inline-flex items-center gap-1 border ${
                            row.method === 'CHEQUE'
                              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                              : row.method === 'BANK_TRANSFER'
                              ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800'
                              : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                          }`}
                        >
                          {row.method === 'CHEQUE' ? (
                            <FileText className="size-3" />
                          ) : row.method === 'BANK_TRANSFER' ? (
                            <Landmark className="size-3" />
                          ) : (
                            <Banknote className="size-3" />
                          )}
                          {row.method}
                        </span>

                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm">
                          Rs. {Number(row.amount || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                        </span>

                        {row.chequeNumber && (
                          <span className="font-mono text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200/60 dark:border-amber-800/40">
                            #{row.chequeNumber}
                          </span>
                        )}

                        {row.bankName && (
                          <span
                            className="text-slate-500 dark:text-zinc-400 text-[11px] truncate max-w-[140px] sm:max-w-[200px]"
                            title={row.bankName}
                          >
                            ({row.bankName})
                          </span>
                        )}

                        {row.reference && !row.chequeNumber && (
                          <span
                            className="text-slate-500 dark:text-zinc-400 text-[11px] truncate max-w-[140px] sm:max-w-[200px]"
                            title={row.reference}
                          >
                            ({row.reference})
                          </span>
                        )}
                      </div>

                      {/* Right: Date, Edit & Delete Icons */}
                      <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-2.5 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-zinc-800/80 shrink-0">
                        <span className="text-slate-500 dark:text-zinc-400 text-[11px] font-mono">
                          {row.paymentDate ? row.paymentDate.replace('T', ' ') : ''}
                        </span>

                        <div className="flex items-center gap-1 border-l border-slate-200 dark:border-zinc-800 pl-2">
                          <button
                            type="button"
                            onClick={() => handleInitiateEditPaymentRow(row)}
                            className="p-1 rounded text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer"
                            title="Edit Payment Record"
                          >
                            <Pencil className="size-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRemovePaymentRow(row.id)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                            title="Delete Payment Record"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-zinc-800">
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Notes / Purchase Details</label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Received via Delivery Courier, Roll Nos #102-105"
                className="h-9 text-xs"
              />
            </div>
          </div>

          {/* Financial Summary Card */}
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/60 p-5 flex flex-col justify-between space-y-4">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 mb-4">
                Financial Summary
              </h3>

              <div className="space-y-3.5 text-xs">
                <div className="flex justify-between items-center text-slate-600 dark:text-zinc-400">
                  <span className="font-medium">Total Purchase Bill:</span>
                  <span className="font-mono text-base font-bold text-slate-900 dark:text-white">
                    Rs. {calculatedTotalAmount.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div>
                    <label className="font-semibold text-slate-800 dark:text-zinc-200 block">
                      Paid Amount (Rs):
                    </label>
                    {paymentRows.length > 0 && (
                      <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                        Auto-sum of recorded payments
                      </span>
                    )}
                  </div>
                  {paymentRows.length > 0 ? (
                    <div className="w-40 h-9 px-3 flex items-center justify-end font-mono font-bold text-xs bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-md text-indigo-700 dark:text-indigo-300">
                      Rs. {totalPaymentRowsAmount.toLocaleString()}
                    </div>
                  ) : paymentMethod === 'CHEQUE' ? (
                    <div className="w-40 h-9 px-3 flex items-center justify-end font-mono font-bold text-xs bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-md text-amber-700 dark:text-amber-300">
                      Rs. {totalChequeAmount.toLocaleString()}
                    </div>
                  ) : (
                    <Input
                      type="number"
                      min="0"
                      max={calculatedTotalAmount}
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value ? Number(e.target.value) : '')}
                      onFocus={(e) => e.target.select()}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      placeholder={String(calculatedTotalAmount)}
                      className="w-40 h-9 text-right font-mono font-bold text-xs bg-white dark:bg-zinc-900"
                    />
                  )}
                </div>

                <div className="flex justify-between items-center border-t border-slate-200 dark:border-zinc-800 pt-3">
                  <span className="font-bold text-slate-900 dark:text-white">Outstanding Debt:</span>
                  <span className={`font-mono text-base font-bold ${dueDebtAmount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    Rs. {dueDebtAmount.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-[11px] text-slate-500 space-y-1">
              <div className="flex justify-between">
                <span>Supplier Balance Mode:</span>
                <span className="font-semibold text-slate-800 dark:text-zinc-200">
                  {dueDebtAmount > 0 ? 'Credit (Payable Added)' : 'Fully Settled'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Effective Method:</span>
                <span className="font-semibold text-slate-800 dark:text-zinc-200">
                  {paymentRows.length > 1
                    ? (effectivePaidAmount >= calculatedTotalAmount ? 'SPLIT' : 'SPLIT + CREDIT')
                    : paymentMethod}
                </span>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Quick Add Supplier Shop Modal Component */}
      <QuickAddShopModal
        open={isShopModalOpen}
        onOpenChange={setIsShopModalOpen}
        onShopCreated={(newShop) => {
          setShops((prev) => [...prev, newShop]);
          setSelectedShopId(newShop.id); // Auto-select created shop instantly
        }}
      />

      {/* Quick Add Raw Material Item Modal Component */}
      <QuickAddMaterialModal
        open={isMaterialModalOpen}
        onOpenChange={setIsMaterialModalOpen}
        dark={dark}
        onMaterialCreated={(newMat) => {
          setMaterialItems((prev) => [...prev, newMat]);
          // If a row was waiting for item creation, auto-populate it
          if (activeMaterialRowIndex !== null && lineItems[activeMaterialRowIndex]) {
            handleLineItemChange(activeMaterialRowIndex, 'rawMaterialItemId', newMat.id);
          } else {
            // Otherwise, if the first row is empty, assign it
            const emptyIndex = lineItems.findIndex((r) => !r.rawMaterialItemId);
            if (emptyIndex !== -1) {
              handleLineItemChange(emptyIndex, 'rawMaterialItemId', newMat.id);
            }
          }
        }}
      />

      {/* Edit Payment Record Modal in GRN Form */}
      <Dialog open={!!editingPaymentRow} onOpenChange={(open) => !open && setEditingPaymentRow(null)}>
        <DialogContent className="w-full max-w-full sm:max-w-md max-h-[90vh] overflow-y-auto bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-2xl z-[80]">
          <DialogHeader className="pb-2 border-b border-slate-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Pencil className="size-4 text-amber-600 dark:text-amber-400" />
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">
                Edit Payment Record
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Update recorded payment amount, method, date, or cheque reference.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEditPaymentRow} className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-300 block">Method *</label>
                <SearchableSelect
                  value={editMethod}
                  onValueChange={(val) => setEditMethod(val as PurchasePaymentMethod)}
                  options={[
                    { value: 'CASH', label: 'Cash', icon: <Banknote className="size-3.5 text-emerald-500" /> },
                    { value: 'CARD', label: 'Card / POS', icon: <CreditCard className="size-3.5 text-purple-500" /> },
                    { value: 'BANK_TRANSFER', label: 'Bank Transfer', icon: <Landmark className="size-3.5 text-blue-500" /> },
                    { value: 'CHEQUE', label: 'Cheque', icon: <FileText className="size-3.5 text-amber-500" /> },
                  ]}
                  placeholder="Select Method"
                  searchPlaceholder="Search method..."
                  dark={dark}
                  className="h-8 py-0 rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-300 block">Amount (Rs.) *</label>
                <div className="relative flex items-center">
                  <span className="absolute left-2.5 text-xs font-mono font-bold text-slate-400">Rs.</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    placeholder="0.00"
                    className="pl-9 h-8 font-mono font-bold text-xs text-right bg-white dark:bg-zinc-900 rounded-xl"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-300 block">Date & Time *</label>
              <DateTimePicker
                value={editDate}
                onChange={setEditDate}
                className="h-8 text-xs font-mono rounded-xl bg-white dark:bg-zinc-900"
              />
            </div>

            {editMethod === 'CHEQUE' && (
              <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-zinc-800">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-300 block">Cheque Number *</label>
                  <Input
                    type="text"
                    value={editChequeNumber}
                    onChange={(e) => setEditChequeNumber(e.target.value)}
                    placeholder="e.g. CHQ-48201"
                    className="h-8 text-xs font-mono bg-white dark:bg-zinc-900 rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-300 block">Bank Name / Branch</label>
                  <Input
                    type="text"
                    value={editBankName}
                    onChange={(e) => setEditBankName(e.target.value)}
                    placeholder="e.g. Commercial Bank"
                    className="h-8 text-xs bg-white dark:bg-zinc-900 rounded-xl"
                  />
                </div>
              </div>
            )}

            {editMethod === 'BANK_TRANSFER' && (
              <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-zinc-800">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-300 block">Bank Name</label>
                  <Input
                    type="text"
                    value={editBankName}
                    onChange={(e) => setEditBankName(e.target.value)}
                    placeholder="e.g. Sampath Bank"
                    className="h-8 text-xs bg-white dark:bg-zinc-900 rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-300 block">Transfer Ref / Slip No</label>
                  <Input
                    type="text"
                    value={editReference}
                    onChange={(e) => setEditReference(e.target.value)}
                    placeholder="e.g. REF-88129"
                    className="h-8 text-xs font-mono bg-white dark:bg-zinc-900 rounded-xl"
                  />
                </div>
              </div>
            )}

            {editMethod === 'CASH' && (
              <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-zinc-800">
                <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-300 block">Reference / Note</label>
                <Input
                  type="text"
                  value={editReference}
                  onChange={(e) => setEditReference(e.target.value)}
                  placeholder="Optional payment reference note"
                  className="h-8 text-xs bg-white dark:bg-zinc-900 rounded-xl"
                />
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-zinc-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDeleteFromEditPaymentRow}
                className="h-8 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-200 dark:border-rose-900 rounded-xl gap-1"
              >
                <Trash2 className="size-3.5" /> Delete
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingPaymentRow(null)}
                  className="h-8 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="h-8 text-xs font-bold px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm cursor-pointer"
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BuyRawMaterialFormPage;