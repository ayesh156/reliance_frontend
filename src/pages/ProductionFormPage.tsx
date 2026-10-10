import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { DateTimePicker } from '../components/ui/date-time-picker';
import { SearchableSelect, type SearchableSelectOption } from '../components/ui/searchable-select';
import { MaterialCombobox, type MaterialOption } from '../components/materials/MaterialCombobox';
import { ProductCombobox, type ProductComboboxOption } from '../components/production/ProductCombobox';
import { VariantCombobox, type VariantOption } from '../components/production/VariantCombobox';
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
  ArrowLeft,
  Factory,
  PlusCircle,
  Trash2,
  Boxes,
  AlertCircle,
  Save,
  Loader2,
  Layers,
  Shirt,
  RotateCcw,
} from 'lucide-react';

interface MaterialLineItemState {
  rawMaterialId: number | '';
  issuedQty: number | '';
  returnedQty: number | '';
  returnReason: string;
}

const REASON_OPTIONS: SearchableSelectOption[] = [
  { value: 'Regular Bulk', label: 'Regular Bulk Production' },
  { value: 'Urgent Order', label: 'Urgent Customer Order' },
  { value: 'Sample Collection', label: 'Sample Collection' },
  { value: 'Custom Tailoring', label: 'Custom Tailoring' },
  { value: 'Stock Replenishment', label: 'Stock Replenishment' },
];

export const ProductionFormPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEditMode = Boolean(id);
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';

  // Master catalog states
  const [productsList, setProductsList] = useState<ProductComboboxOption[]>([]);
  const [rawMaterialsList, setRawMaterialsList] = useState<MaterialOption[]>([]);
  const [loadingPrereqs, setLoadingPrereqs] = useState(true);
  const [loadingEditData, setLoadingEditData] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [batchNo, setBatchNo] = useState<string>('');
  const [formProductId, setFormProductId] = useState<number | ''>('');
  const [formVariantId, setFormVariantId] = useState<number | ''>('');
  const [formCompletedQty, setFormCompletedQty] = useState<number | ''>('');
  const [formTargetQty, setFormTargetQty] = useState<number | ''>('');
  const [formReason, setFormReason] = useState<string>('Regular Bulk');
  const [formProductionDate, setFormProductionDate] = useState<string>(new Date().toISOString());
  const [formNotes, setFormNotes] = useState<string>('');
  const [formMaterials, setFormMaterials] = useState<MaterialLineItemState[]>([
    { rawMaterialId: '', issuedQty: '', returnedQty: 0, returnReason: '' },
  ]);

  // Load master products & raw materials
  const fetchPrerequisites = useCallback(async () => {
    try {
      setLoadingPrereqs(true);
      const [prodRes, matRes] = await Promise.all([
        get<any>('/products'),
        get<any>('/raw-material-items'),
      ]);

      const prods = prodRes?.data || prodRes || [];
      const mats = matRes?.data || matRes || [];

      setProductsList(
        prods.map((p: any) => ({
          id: p.id,
          name: p.name,
          slug: p.slug || null,
          variants: (p.variants || []).map((v: any) => ({
            id: v.id,
            size: v.size || null,
            color: v.color || null,
            sku: v.sku || '',
            stock: Number(v.stock) || 0,
          })),
        }))
      );

      setRawMaterialsList(
        mats.map((m: any) => ({
          id: m.id,
          name: m.name,
          code: m.code || null,
          unit: m.unit || 'METERS',
          currentStock: Number(m.currentStock) || 0,
        }))
      );
    } catch (err: any) {
      console.error('Error loading production catalogs:', err);
      toast.error('Failed to load master catalogs');
    } finally {
      setLoadingPrereqs(false);
    }
  }, []);

  // Hydrate form in Edit Mode
  const fetchEditData = useCallback(async () => {
    if (!id) return;
    try {
      setLoadingEditData(true);
      const order = await get<any>(`/production/${id}`);
      if (order) {
        setBatchNo(order.productionNo || '');
        setFormProductId(order.productId || '');
        setFormVariantId(order.variantId || '');
        setFormCompletedQty(order.completedQty ?? '');
        setFormTargetQty(order.targetQuantity ?? '');
        setFormReason(order.reason || 'Regular Bulk');
        setFormProductionDate(
          order.productionDate
            ? new Date(order.productionDate).toISOString()
            : new Date().toISOString()
        );
        setFormNotes(order.notes || '');

        if (Array.isArray(order.materialUsages) && order.materialUsages.length > 0) {
          setFormMaterials(
            order.materialUsages.map((u: any) => ({
              rawMaterialId: u.rawMaterialId,
              issuedQty: u.issuedQty,
              returnedQty: u.returnedQty ?? 0,
              returnReason: u.returnReason || '',
            }))
          );
        }
      }
    } catch (err: any) {
      console.error('Error fetching production order:', err);
      toast.error(err.message || 'Failed to load production order for editing');
    } finally {
      setLoadingEditData(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPrerequisites();
  }, [fetchPrerequisites]);

  useEffect(() => {
    if (id) {
      fetchEditData();
    }
  }, [id, fetchEditData]);

  // Available variants for selected finished product
  const availableVariants = useMemo<VariantOption[]>(() => {
    if (!formProductId) return [];
    const prod = productsList.find((p) => p.id === Number(formProductId));
    return prod?.variants || [];
  }, [formProductId, productsList]);

  // Add / Remove material line
  const handleAddMaterialLine = () => {
    setFormMaterials((prev) => [
      ...prev,
      { rawMaterialId: '', issuedQty: '', returnedQty: 0, returnReason: '' },
    ]);
  };

  const handleRemoveMaterialLine = (index: number) => {
    if (formMaterials.length <= 1) {
      toast.warn('At least one raw material line is required');
      return;
    }
    setFormMaterials((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMaterialLineChange = (
    index: number,
    field: keyof MaterialLineItemState,
    value: any
  ) => {
    setFormMaterials((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Live yardage calculations & stock checks
  const calculations = useMemo(() => {
    let totalIssued = 0;
    let totalReturned = 0;
    let totalNetConsumed = 0;
    let stockError = '';

    formMaterials.forEach((line) => {
      const issued = Number(line.issuedQty) || 0;
      const returned = Number(line.returnedQty) || 0;
      const net = Math.max(0, issued - returned);

      totalIssued += issued;
      totalReturned += returned;
      totalNetConsumed += net;

      if (line.rawMaterialId) {
        const mat = rawMaterialsList.find((m) => m.id === Number(line.rawMaterialId));
        if (mat && !isEditMode && net > mat.currentStock) {
          stockError = `Insufficient stock for "${mat.name}". Available: ${mat.currentStock} ${mat.unit}, Required: ${net} ${mat.unit}`;
        }
      }
    });

    return {
      totalIssued: totalIssued.toFixed(2),
      totalReturned: totalReturned.toFixed(2),
      totalNetConsumed: totalNetConsumed.toFixed(2),
      stockError,
    };
  }, [formMaterials, rawMaterialsList, isEditMode]);

  // Form submit handler (POST on create, PUT on edit)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formProductId) {
      toast.error('Please select a finished garment product');
      return;
    }

    const completed = Number(formCompletedQty);
    if (isNaN(completed) || completed <= 0) {
      toast.error('Please enter a valid completed garment quantity greater than 0');
      return;
    }

    // Validate material rows
    for (let i = 0; i < formMaterials.length; i++) {
      const line = formMaterials[i];
      if (!line.rawMaterialId) {
        toast.error(`Please select a raw material for row #${i + 1}`);
        return;
      }
      const issued = Number(line.issuedQty);
      if (isNaN(issued) || issued <= 0) {
        toast.error(`Please enter a valid issued quantity for row #${i + 1}`);
        return;
      }
      const returned = Number(line.returnedQty) || 0;
      if (returned > issued) {
        toast.error(`Returned scrap quantity cannot exceed issued quantity on row #${i + 1}`);
        return;
      }
    }

    if (calculations.stockError) {
      toast.error(calculations.stockError);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        productId: Number(formProductId),
        variantId: formVariantId ? Number(formVariantId) : null,
        targetQuantity: formTargetQty ? Number(formTargetQty) : completed,
        completedQty: completed,
        reason: formReason,
        notes: formNotes,
        productionDate: formProductionDate,
        materials: formMaterials.map((m) => ({
          rawMaterialId: Number(m.rawMaterialId),
          issuedQty: Number(m.issuedQty),
          returnedQty: Number(m.returnedQty) || 0,
          returnReason: m.returnReason,
        })),
      };

      if (isEditMode) {
        const res = await put<any>(`/production/${id}`, payload);
        const updated = res?.data || res;
        toast.success(
          `Production batch #${updated.productionNo || batchNo} updated successfully!`
        );
      } else {
        const res = await post<any>('/production', payload);
        const created = res?.data || res;
        toast.success(
          `Production batch #${created.productionNo} recorded successfully! Inventory updated.`
        );
      }

      navigate('/system/production');
    } catch (err: any) {
      console.error('Error submitting production:', err);
      toast.error(err.message || 'Failed to save production run');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingPrereqs || loadingEditData) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3 max-w-5xl mx-auto">
        <Loader2 className="w-8 h-8 animate-spin text-slate-900 dark:text-white" />
        <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
          Loading production form data &amp; catalogs...
        </span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* ── Page Header Bar (Matching Products Page Visual System) ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900/60 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs">
        <div className="flex items-center gap-3.5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => navigate('/system/production')}
            className="size-9 rounded-xl border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 shrink-0 cursor-pointer"
            title="Back to Production Ledger"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>

          <div className="size-10 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white flex items-center justify-center border border-slate-200 dark:border-zinc-700 shadow-xs shrink-0">
            <Factory className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                {isEditMode ? `Edit Production Batch #${batchNo}` : 'New Garment Production Run'}
              </h1>
              {isEditMode && (
                <Badge variant="outline" className="text-[10px] font-mono">
                  Editing Mode
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Select finished product, enter completed output units, and allocate raw material yardages
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/system/production')}
            className="text-xs h-9 px-3.5 rounded-xl flex-1 sm:flex-initial cursor-pointer"
          >
            Cancel
          </Button>

          <Button
            type="submit"
            disabled={isSubmitting || Boolean(calculations.stockError)}
            className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 font-semibold text-xs h-9 px-4 rounded-xl shadow-xs flex items-center gap-2 flex-1 sm:flex-initial justify-center cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{isEditMode ? 'Updating Batch...' : 'Processing Batch...'}</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>{isEditMode ? 'Update & Sync Inventory' : 'Confirm & Record Production'}</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ── Section 1: Finished Product & Batch Metadata Card ── */}
      <div className="bg-white dark:bg-zinc-900/60 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800/80 pb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 flex items-center gap-2">
            <Shirt className="w-4 h-4 text-emerald-500" />
            Finished Garment Target &amp; Batch Specifications
          </h2>
          <span className="text-[11px] text-slate-400 font-medium">Fields with * are mandatory</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-start">
          {/* 1. Target Finished Product via Combobox */}
          <div className="space-y-1.5 lg:col-span-4">
            <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
              Target Finished Product <span className="text-rose-500">*</span>
            </label>
            <ProductCombobox
              value={formProductId}
              onChange={(newProdId) => {
                setFormProductId(newProdId);
                setFormVariantId('');
              }}
              options={productsList}
              placeholder="Search product from catalog..."
            />
          </div>

          {/* 2. Specific Variant via Combobox */}
          <div className="space-y-1.5 lg:col-span-3">
            <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
              Specific Variant (Size / Color)
            </label>
            <VariantCombobox
              value={formVariantId}
              onChange={(newVarId) => setFormVariantId(newVarId)}
              options={availableVariants}
              disabled={!formProductId || availableVariants.length === 0}
              placeholder={
                !formProductId
                  ? 'Choose product first'
                  : availableVariants.length === 0
                  ? 'No variants'
                  : 'Select variant...'
              }
            />
          </div>

          {/* 3. Completed Units Output */}
          <div className="space-y-1.5 lg:col-span-2">
            <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
              Completed Units <span className="text-rose-500">*</span>
            </label>
            <Input
              type="number"
              min="1"
              step="1"
              value={formCompletedQty}
              onChange={(e) => setFormCompletedQty(Number(e.target.value) || '')}
              placeholder="e.g. 100"
              required
              className="h-10 text-xs font-semibold rounded-xl bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800"
            />
          </div>

          {/* 4. Batch Category / Reason via SearchableSelect */}
          <div className="space-y-1.5 lg:col-span-3">
            <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
              Batch Category / Reason
            </label>
            <SearchableSelect
              options={REASON_OPTIONS}
              value={formReason}
              onValueChange={(val) => setFormReason(val)}
              placeholder="Select batch reason..."
              searchPlaceholder="Search reason..."
              dark={dark}
              className="h-10"
            />
          </div>
        </div>

        {/* Second Row: Date picker & Notes */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 pt-2">
          <div className="space-y-1.5 sm:col-span-4">
            <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
              Production Date &amp; Time <span className="text-rose-500">*</span>
            </label>
            <DateTimePicker
              value={formProductionDate}
              onChange={(val) => setFormProductionDate(val)}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-8">
            <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
              Batch Remarks / Tailoring Notes
            </label>
            <Input
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Optional remarks regarding cutter name, roll batch numbers, pattern changes..."
              className="h-10 text-xs rounded-xl bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800"
            />
          </div>
        </div>
      </div>

      {/* ── Section 2: Raw Materials Allocation (GRN Table Layout) ── */}
      <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-5 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 flex items-center gap-2">
              <Boxes className="w-4 h-4 text-emerald-500" />
              Allocated Raw Materials &amp; Yardage Consumption
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
              Specify raw materials issued for cutting, plus any leftover scrap returned to warehouse
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddMaterialLine}
            className="gap-1.5 h-8 text-xs font-semibold cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" /> Add Material Row
          </Button>
        </div>

        {/* ── Mobile / Tablet Adaptive Consumption Cards (< 1024px) ── */}
        <div className="block lg:hidden space-y-3">
          {formMaterials.map((line, idx) => {
            const selectedMat = rawMaterialsList.find(
              (m) => m.id === Number(line.rawMaterialId)
            );
            const issued = Number(line.issuedQty) || 0;
            const returned = Number(line.returnedQty) || 0;
            const net = Math.max(0, issued - returned);
            const isOverStock = selectedMat && net > selectedMat.currentStock && !isEditMode;

            return (
              <div
                key={idx}
                className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 p-3.5 sm:p-4 shadow-xs space-y-3 transition-shadow hover:shadow-sm"
              >
                {/* Card Header: Material Line #, Available stock pill, Delete button */}
                <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-zinc-800/80">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-slate-400">
                      Material #{idx + 1}
                    </span>
                    {selectedMat && (
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-md font-medium border ${
                          isOverStock
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200 dark:border-rose-900/60'
                            : 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300 border-slate-200/80 dark:border-zinc-700/80'
                        }`}
                      >
                        Avail: <strong className="font-mono">{selectedMat.currentStock} {selectedMat.unit}</strong>
                      </span>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveMaterialLine(idx)}
                    disabled={formMaterials.length <= 1}
                    className="size-8 p-0 text-slate-400 hover:text-rose-500 disabled:opacity-40 cursor-pointer"
                    title="Remove material row"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>

                {/* Material Selector */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                    Raw Material Item *
                  </label>
                  <div className="w-full">
                    <MaterialCombobox
                      value={line.rawMaterialId}
                      onChange={(val) => handleMaterialLineChange(idx, 'rawMaterialId', val)}
                      options={rawMaterialsList}
                      placeholder="Select raw material..."
                    />
                  </div>
                </div>

                {/* Issued and Scrap Inputs: grid grid-cols-2 gap-2.5 */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                      Issued Units *
                    </label>
                    <Input
                      type="number"
                      min="0.01"
                      step="any"
                      required
                      value={line.issuedQty}
                      onChange={(e) => handleMaterialLineChange(idx, 'issuedQty', e.target.value)}
                      placeholder="0.00"
                      className="h-9 font-mono text-xs w-full bg-slate-50/50 dark:bg-zinc-950/50"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                      Scrap Returned
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={line.returnedQty}
                      onChange={(e) => handleMaterialLineChange(idx, 'returnedQty', e.target.value)}
                      placeholder="0.00"
                      className="h-9 font-mono text-xs w-full bg-slate-50/50 dark:bg-zinc-950/50"
                    />
                  </div>
                </div>

                {/* Scrap Return Reason / Note (if scrap returned > 0) */}
                {returned > 0 && (
                  <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-zinc-800/80">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      Scrap Reason / Roll Notes
                    </label>
                    <Input
                      type="text"
                      value={line.returnReason}
                      onChange={(e) => handleMaterialLineChange(idx, 'returnReason', e.target.value)}
                      placeholder="e.g. Clean scrap roll cut piece"
                      className="h-8 text-xs w-full bg-white dark:bg-zinc-950"
                    />
                  </div>
                )}

                {/* Net Consumed Calculation Pill */}
                <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-zinc-800/80 text-xs">
                  <span className="text-slate-500 dark:text-zinc-400 font-semibold">Net Consumed:</span>
                  <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/60">
                    {net.toFixed(2)} {selectedMat?.unit || 'Units'}
                  </span>
                </div>

                {/* Insufficient Stock Warning */}
                {isOverStock && (
                  <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-center gap-1.5 text-[11px] text-rose-600 dark:text-rose-400 font-semibold">
                    <AlertCircle className="size-3.5 shrink-0" />
                    <span>Net required ({net.toFixed(2)}) exceeds available stock ({selectedMat.currentStock} {selectedMat.unit})</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Desktop Viewport (>= 1024px) Standard Table ── */}
        <div className="hidden lg:block rounded-xl border border-slate-200 dark:border-zinc-800 overflow-visible">
          <Table className="overflow-visible">
            <TableHeader>
              <TableRow className="bg-slate-50 dark:bg-zinc-900/50 hover:bg-transparent">
                <TableHead className="w-[38%] text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                  Raw Material Item *
                </TableHead>
                <TableHead className="w-[18%] text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                  Issued (Units) *
                </TableHead>
                <TableHead className="w-[18%] text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                  Returned Scrap
                </TableHead>
                <TableHead className="w-[20%] text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 text-center">
                  Net Consumed
                </TableHead>
                <TableHead className="w-[6%]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {formMaterials.map((line, idx) => {
                const selectedMat = rawMaterialsList.find(
                  (m) => m.id === Number(line.rawMaterialId)
                );
                const issued = Number(line.issuedQty) || 0;
                const returned = Number(line.returnedQty) || 0;
                const net = Math.max(0, issued - returned);

                return (
                  <React.Fragment key={idx}>
                    <TableRow className="items-center hover:bg-slate-50/50 dark:hover:bg-zinc-800/30">
                      {/* Material Combobox */}
                      <TableCell className="align-middle py-2.5">
                        <MaterialCombobox
                          value={line.rawMaterialId}
                          onChange={(val) => handleMaterialLineChange(idx, 'rawMaterialId', val)}
                          options={rawMaterialsList}
                          placeholder="Select raw material..."
                        />
                      </TableCell>

                      {/* Issued Input */}
                      <TableCell className="align-middle py-2.5">
                        <Input
                          type="number"
                          min="0.01"
                          step="any"
                          required
                          value={line.issuedQty}
                          onChange={(e) =>
                            handleMaterialLineChange(idx, 'issuedQty', e.target.value)
                          }
                          placeholder="0.00"
                          className="font-mono text-xs h-9 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800"
                        />
                      </TableCell>

                      {/* Returned Scrap Input */}
                      <TableCell className="align-middle py-2.5">
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={line.returnedQty}
                          onChange={(e) =>
                            handleMaterialLineChange(idx, 'returnedQty', e.target.value)
                          }
                          placeholder="0.00"
                          className="font-mono text-xs h-9 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800"
                        />
                      </TableCell>

                      {/* Net Consumed Live Output */}
                      <TableCell className="align-middle py-2.5 text-center">
                        <div className="h-9 px-3 rounded-lg bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center text-xs font-bold text-slate-900 dark:text-white font-mono">
                          {net.toFixed(2)} {selectedMat?.unit || ''}
                        </div>
                      </TableCell>

                      {/* Remove Row Button */}
                      <TableCell className="align-middle py-2.5 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveMaterialLine(idx)}
                          className="size-8 text-slate-400 hover:text-rose-500 cursor-pointer"
                          title="Remove material row"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>

                    {/* Secondary Row: Stock Alert & Scrap Note */}
                    {(selectedMat || returned > 0) && (
                      <TableRow className="bg-slate-50/40 dark:bg-zinc-950/40 border-b border-slate-100 dark:border-zinc-800/60">
                        <TableCell colSpan={5} className="py-1.5 px-4 text-[11px]">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            {selectedMat ? (
                              <div className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400">
                                <span>Warehouse Available Stock:</span>
                                <strong
                                  className={
                                    net > selectedMat.currentStock && !isEditMode
                                      ? 'text-rose-500 font-bold'
                                      : 'text-slate-900 dark:text-white font-mono'
                                  }
                                >
                                  {selectedMat.currentStock} {selectedMat.unit}
                                </strong>
                                {net > selectedMat.currentStock && !isEditMode && (
                                  <span className="text-rose-500 font-semibold flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" /> Insufficient stock
                                  </span>
                                )}
                              </div>
                            ) : null}

                            {returned > 0 && (
                              <div className="flex items-center gap-2 flex-1 max-w-md ml-auto">
                                <span className="text-slate-500 dark:text-zinc-400 shrink-0 font-medium">
                                  Scrap Note:
                                </span>
                                <Input
                                  type="text"
                                  value={line.returnReason}
                                  onChange={(e) =>
                                    handleMaterialLineChange(idx, 'returnReason', e.target.value)
                                  }
                                  placeholder="Reason for leftover/scrap return (e.g. uncut end roll saved)"
                                  className="h-7 text-[11px] rounded bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800"
                                />
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* ── Calculation Summary Banner ── */}
        <div className="p-4 bg-slate-50 dark:bg-zinc-950/60 rounded-xl border border-slate-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <span className="text-slate-500 dark:text-zinc-400 block text-[10px] uppercase font-bold tracking-wider">
                Total Issued
              </span>
              <span className="font-bold text-slate-900 dark:text-white text-sm font-mono">
                {calculations.totalIssued} Units
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-zinc-400 block text-[10px] uppercase font-bold tracking-wider">
                Scrap Returned
              </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm font-mono flex items-center gap-1">
                <RotateCcw className="w-3 h-3" />
                {calculations.totalReturned} Units
              </span>
            </div>
            <div className="pl-4 border-l border-slate-200 dark:border-zinc-800">
              <span className="text-slate-500 dark:text-zinc-400 block text-[10px] uppercase font-bold tracking-wider">
                Net Consumed Yardage
              </span>
              <span className="font-black text-slate-900 dark:text-white text-base font-mono">
                {calculations.totalNetConsumed} Units
              </span>
            </div>
          </div>

          {calculations.stockError && (
            <div className="text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/50 px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/50">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{calculations.stockError}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom Action Footer Bar ── */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate('/system/production')}
          className="text-xs h-10 px-5 rounded-xl cursor-pointer"
        >
          Cancel
        </Button>

        <Button
          type="submit"
          disabled={isSubmitting || Boolean(calculations.stockError)}
          className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 font-semibold text-xs h-10 px-6 rounded-xl shadow-xs flex items-center gap-2 cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{isEditMode ? 'Updating Batch...' : 'Processing Batch...'}</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>{isEditMode ? 'Save & Sync Inventory' : 'Confirm & Update Stock'}</span>
            </>
          )}
        </Button>
      </div>
    </form>
  );
};

export default ProductionFormPage;
