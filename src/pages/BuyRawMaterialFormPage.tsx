import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { SearchableSelect } from '../components/ui/SearchableSelect';
import { MaterialCombobox } from '../components/materials/MaterialCombobox';
import { DatePicker } from '../components/ui/date-picker';
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
import { get, post } from '../lib/api';
import { toast } from 'react-toastify';
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

const PAYMENT_METHODS = ['CASH', 'CREDIT', 'CHEQUE', 'BANK_TRANSFER'];

export const BuyRawMaterialFormPage: React.FC = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [shops, setShops] = useState<RawMaterialShop[]>([]);
  const [materialItems, setMaterialItems] = useState<RawMaterialItem[]>([]);
  const [loadingPrereqs, setLoadingPrereqs] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

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
  const [generatingInvoice, setGeneratingInvoice] = useState<boolean>(false);

  const [lineItems, setLineItems] = useState<PurchaseLineItem[]>([
    { rawMaterialItemId: '', quantity: '', pricePerUnit: '', batchNumber: '' },
  ]);

  useEffect(() => {
    const loadPrerequisites = async () => {
      try {
        setLoadingPrereqs(true);
        const [shopsData, itemsData] = await Promise.all([
          get<RawMaterialShop[]>('/raw-material-shops'),
          get<RawMaterialItem[]>('/raw-material-items'),
        ]);
        setShops(shopsData || []);
        setMaterialItems(itemsData || []);
      } catch (err: any) {
        toast.error('Failed to load suppliers or materials catalogue');
      } finally {
        setLoadingPrereqs(false);
      }
    };
    loadPrerequisites();
  }, []);

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
        purchaseDate: purchaseDate ? purchaseDate.toISOString() : new Date().toISOString(),
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

      // ⭐ Launch WhatsApp message to Supplier Shop if phone number exists
      const currentShop = shops.find((s) => s.id === Number(selectedShopId)) as any;
      if (currentShop?.phone) {
        const enrichedItems = lineItems.map((item) => {
          const matMeta = materialItems.find((m) => m.id === Number(item.rawMaterialItemId));
          return {
            ...item,
            rawMaterialItem: matMeta,
          };
        });

        const waMessage = generateSupplierStockInWhatsAppMessage({
          invoiceNumber: invoiceNumber.trim() || undefined,
          purchaseDate,
          paymentMethod,
          totalAmount: calculatedTotalAmount,
          paidAmount: paidAmount === '' ? calculatedTotalAmount : Number(paidAmount),
          shop: currentShop,
          items: enrichedItems,
        });

        openWhatsAppChat(currentShop.phone, waMessage);
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
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <ShoppingCart className="size-6 text-indigo-600 dark:text-indigo-400" />
              New Material Purchase (Stock-In)
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Receive raw materials from suppliers, update stock inventory, and record payments.
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
            className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Confirm Stock-In
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

          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 overflow-visible">
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
                  const selectedItemMeta = materialItems.find((m) => m.id === Number(item.rawMaterialItemId));
                  const rowTotal = (Number(item.quantity) || 0) * (Number(item.pricePerUnit) || 0);

                  return (
                    <TableRow key={index}>
                      <TableCell>
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
                          className="font-mono text-xs h-9"
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
                          className="font-mono text-xs h-9"
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
                          className="size-8 text-slate-400 hover:text-rose-500"
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

        {/* Financials & Payment Card */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
              Payment &amp; Delivery Notes
            </h3>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Payment Method</label>
              <SearchableSelect
                value={paymentMethod}
                onValueChange={setPaymentMethod}
                options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))}
                placeholder="Select Payment Method"
                dark={dark}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Notes / Purchase Details</label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Received via Delivery Courier, Roll Nos #102-105"
                className="h-10 text-xs"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/60 p-5 flex flex-col justify-between space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
              Financial Summary
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center text-slate-600 dark:text-zinc-400">
                <span>Total Purchase Bill:</span>
                <span className="font-mono text-base font-bold text-slate-900 dark:text-white">
                  Rs. {calculatedTotalAmount.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <label className="font-semibold text-slate-800 dark:text-zinc-200">
                  Paid Amount (Rs):
                </label>
                <Input
                  type="number"
                  min="0"
                  max={calculatedTotalAmount}
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value ? Number(e.target.value) : '')}
                  placeholder={String(calculatedTotalAmount)}
                  className="w-40 h-9 text-right font-mono font-bold text-xs bg-white dark:bg-zinc-900"
                />
              </div>

              <div className="flex justify-between items-center border-t border-slate-200 dark:border-zinc-800 pt-3">
                <span className="font-bold text-slate-900 dark:text-white">Outstanding Debt:</span>
                <span className={`font-mono text-base font-bold ${dueDebtAmount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  Rs. {dueDebtAmount.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                disabled={isSubmitting || loadingPrereqs}
                className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700 text-white h-10"
              >
                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Confirm and Process Stock-In
              </Button>
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
    </div>
  );
};

export default BuyRawMaterialFormPage;