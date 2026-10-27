import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { DateTimePicker } from '../ui/date-time-picker';
import { SearchableSelect, type SearchableSelectOption } from '../ui/searchable-select';
import { useTheme } from '../../contexts/ThemeContext';
import { getProductImageUrl, getCurrentLocalDateTime, formatToLocalInputDateTime } from '../../lib/utils';
import { put } from '../../lib/api';
import { toast } from 'react-toastify';
import {
  Scissors,
  Plus,
  Trash2,
  AlertCircle,
  Loader2,
  Shirt,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react';

export interface EditMaterialRow {
  rowId: string;
  rawMaterialId: string;
  piecesCount: number | '';
  issuedQty: number | '';
  returnedQty?: number;
  returnReason?: string | null;
}

export interface EditTargetProductRow {
  rowId: string;
  productId: string;
  variantId?: string;
  cutQty: number | '';
  plannedQty: number | '';
}

export interface CuttingEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: any | null;
  rawMaterialsList: any[];
  productsList: any[];
  dark?: boolean;
  onSuccess: () => void;
}

export const CuttingEditModal: React.FC<CuttingEditModalProps> = ({
  open,
  onOpenChange,
  order,
  rawMaterialsList,
  productsList,
  dark: darkProp,
  onSuccess,
}) => {
  const { resolvedTheme } = useTheme();
  const isDark = darkProp !== undefined ? darkProp : resolvedTheme === 'dark';
  const [productionDateTime, setProductionDateTime] = useState<string>(
    getCurrentLocalDateTime()
  );
  const [notes, setNotes] = useState<string>('');
  const [materials, setMaterials] = useState<EditMaterialRow[]>([]);
  const [targetProducts, setTargetProducts] = useState<EditTargetProductRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Full hydration when modal opens with order
  useEffect(() => {
    if (open && order) {
      setProductionDateTime(formatToLocalInputDateTime(order.productionDate || order.createdAt));
      setNotes(order.notes || '');

      // 1. Raw Materials hydration
      if (order.materialUsages && order.materialUsages.length > 0) {
        const loadedMaterials: EditMaterialRow[] = order.materialUsages.map(
          (usage: any, idx: number) => {
            const pieces =
              usage.piecesCount !== undefined && usage.piecesCount !== null
                ? Number(usage.piecesCount)
                : usage.pieces !== undefined && usage.pieces !== null
                ? Number(usage.pieces)
                : 1;

            const issued =
              usage.issuedQty !== undefined && usage.issuedQty !== null
                ? usage.issuedQty
                : usage.cuttingQty !== undefined && usage.cuttingQty !== null
                ? usage.cuttingQty
                : '';

            return {
              rowId: `mat-${idx}-${usage.id || Date.now()}`,
              rawMaterialId: String(usage.rawMaterialId || usage.materialId || ''),
              piecesCount: pieces,
              issuedQty: issued,
              returnedQty: Number(usage.returnedQty || 0),
              returnReason: usage.returnReason || null,
            };
          }
        );
        setMaterials(loadedMaterials);
      } else {
        setMaterials([]);
      }

      // 2. Target Products hydration with per-product Cut Qty
      let parsedTargetProducts: any[] = [];
      if (order.targetProducts) {
        if (typeof order.targetProducts === 'string') {
          try {
            parsedTargetProducts = JSON.parse(order.targetProducts);
          } catch {
            parsedTargetProducts = [];
          }
        } else if (Array.isArray(order.targetProducts)) {
          parsedTargetProducts = order.targetProducts;
        }
      }

      if (parsedTargetProducts.length > 0) {
        const loadedTargetProducts: EditTargetProductRow[] = parsedTargetProducts.map(
          (tp: any, idx: number) => {
            const cutPieces =
              tp.cutQty !== undefined && tp.cutQty !== null
                ? Number(tp.cutQty)
                : tp.plannedQty !== undefined && tp.plannedQty !== null
                ? Number(tp.plannedQty)
                : tp.targetQuantity !== undefined && tp.targetQuantity !== null
                ? Number(tp.targetQuantity)
                : '';

            return {
              rowId: `prod-${idx}-${Date.now()}`,
              productId: String(tp.productId || tp.id || ''),
              variantId: tp.variantId ? String(tp.variantId) : '',
              cutQty: cutPieces,
              plannedQty: cutPieces,
            };
          }
        );
        setTargetProducts(loadedTargetProducts);
      } else if (order.productId) {
        const cutPieces = order.cutQty || order.targetQuantity || 0;
        setTargetProducts([
          {
            rowId: `prod-0-${Date.now()}`,
            productId: String(order.productId),
            variantId: order.variantId ? String(order.variantId) : '',
            cutQty: cutPieces,
            plannedQty: cutPieces,
          },
        ]);
      } else {
        setTargetProducts([]);
      }
    }
  }, [open, order]);

  // Options for Raw Materials select
  const rawMaterialOptions: SearchableSelectOption[] = useMemo(() => {
    return rawMaterialsList.map((m) => {
      const stock = Number(m.currentStock) || 0;
      return {
        value: String(m.id),
        label: `${m.name} (${m.code || 'No Code'})`,
        subLabel: `Available: ${stock} ${m.unit}`,
      };
    });
  }, [rawMaterialsList]);

  // Options for Target Garment Products select
  const productOptions: SearchableSelectOption[] = useMemo(() => {
    return productsList.map((p) => {
      const firstVariant = p.variants?.[0];
      const sku = firstVariant?.sku || '';
      const barcode = firstVariant?.barcode || '';
      const rawImg = p.images?.[0]?.imageUrl || p.image;
      const resolvedImg = rawImg ? getProductImageUrl(rawImg) : undefined;

      const subParts: string[] = [];
      if (sku) subParts.push(`SKU: ${sku}`);
      if (barcode) subParts.push(`Barcode: ${barcode}`);

      return {
        value: String(p.id),
        label: p.name,
        subLabel: subParts.length > 0 ? subParts.join(' • ') : undefined,
        imageUrl: resolvedImg,
      };
    });
  }, [productsList]);

  // Handle Material Row operations
  const handleAddMaterialRow = () => {
    setMaterials((prev) => [
      ...prev,
      {
        rowId: `mat-${Date.now()}-${prev.length + 1}`,
        rawMaterialId: '',
        piecesCount: 1,
        issuedQty: '',
      },
    ]);
  };

  const handleRemoveMaterialRow = (index: number) => {
    setMaterials((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMaterialChange = (
    index: number,
    field: keyof EditMaterialRow,
    value: any
  ) => {
    setMaterials((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // Handle Target Product Row operations
  const handleAddTargetProductRow = () => {
    setTargetProducts((prev) => [
      ...prev,
      {
        rowId: `prod-${Date.now()}-${prev.length + 1}`,
        productId: '',
        cutQty: '',
        plannedQty: '',
      },
    ]);
  };

  const handleRemoveTargetProductRow = (index: number) => {
    setTargetProducts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleTargetProductChange = (
    index: number,
    field: keyof EditTargetProductRow,
    value: any
  ) => {
    setTargetProducts((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      if (field === 'cutQty') {
        next[index].plannedQty = value;
      }
      return next;
    });
  };

  // Validation
  const validationError = useMemo((): string | null => {
    if (!order) return 'No cutting record selected for editing';

    if (materials.length === 0) {
      return 'Please allocate at least one fabric or raw material';
    }

    const selectedMaterialIds = new Set<string>();
    for (let i = 0; i < materials.length; i++) {
      const row = materials[i];
      if (!row.rawMaterialId) {
        return `Please select a raw material for Line #${i + 1}`;
      }
      if (selectedMaterialIds.has(row.rawMaterialId)) {
        const mat = rawMaterialsList.find((m) => m.id === Number(row.rawMaterialId));
        return `Material "${mat?.name || row.rawMaterialId}" is allocated multiple times. Combine into a single row.`;
      }
      selectedMaterialIds.add(row.rawMaterialId);

      const qty = Number(row.issuedQty);
      if (row.issuedQty === '' || isNaN(qty) || qty <= 0) {
        return `Please enter a valid positive quantity for Material Line #${i + 1}`;
      }

      // Warehouse stock check
      const mat = rawMaterialsList.find((m) => m.id === Number(row.rawMaterialId));
      if (mat) {
        const available = Number(mat.currentStock) || 0;
        const initialUsage = order.materialUsages?.find(
          (u: any) => (u.rawMaterialId || u.materialId) === Number(row.rawMaterialId)
        );
        const initialIssued = initialUsage ? Number(initialUsage.issuedQty) : 0;
        const maxStock = available + initialIssued;

        if (qty > maxStock) {
          return `Insufficient warehouse stock for "${mat.name}". Available: ${maxStock} ${mat.unit}, entered: ${qty} ${mat.unit}.`;
        }
      }
    }

    if (targetProducts.length === 0) {
      return 'Please specify at least one target garment product';
    }

    for (let j = 0; j < targetProducts.length; j++) {
      const prodRow = targetProducts[j];
      if (!prodRow.productId) {
        return `Please select a target garment product for Line #${j + 1}`;
      }
      const cQty = Number(prodRow.cutQty);
      if (prodRow.cutQty === '' || isNaN(cQty) || cQty <= 0) {
        return `Please enter valid Pieces / Cut Qty for Target Product #${j + 1}`;
      }
    }

    return null;
  }, [order, materials, targetProducts, rawMaterialsList]);

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;

    if (validationError) {
      toast.warn(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      const formattedDate = productionDateTime
        ? new Date(productionDateTime).toISOString()
        : new Date().toISOString();

      const sanitizedMaterials = materials.map((m) => {
        const initialUsage = order.materialUsages?.find(
          (u: any) => (u.rawMaterialId || u.materialId) === Number(m.rawMaterialId)
        );

        const piecesVal = m.piecesCount !== '' ? Math.max(1, Number(m.piecesCount)) : 1;
        const issuedVal = Number(m.issuedQty);

        return {
          id: initialUsage?.id,
          materialId: Number(m.rawMaterialId),
          rawMaterialId: Number(m.rawMaterialId),
          pieces: piecesVal,
          piecesCount: piecesVal,
          cuttingQty: issuedVal,
          issuedQty: issuedVal,
          returnedQty: initialUsage ? Number(initialUsage.returnedQty || 0) : 0,
          returnReason: initialUsage ? initialUsage.returnReason : null,
        };
      });

      const sanitizedTargetProducts = targetProducts
        .filter((tp) => tp.productId)
        .map((tp) => {
          const prod = productsList.find((p) => p.id === Number(tp.productId));
          const firstVariant = prod?.variants?.[0];
          const cutPieces = Number(tp.cutQty) || 0;

          return {
            productId: Number(tp.productId),
            variantId: tp.variantId ? Number(tp.variantId) : (firstVariant?.id || null),
            productName: prod?.name || `Product #${tp.productId}`,
            sku: firstVariant?.sku || '',
            barcode: firstVariant?.barcode || '',
            cutQty: cutPieces,
            plannedQty: cutPieces,
          };
        });

      const totalCutPieces = sanitizedTargetProducts.reduce((sum, tp) => sum + tp.cutQty, 0);
      const primaryProductId =
        sanitizedTargetProducts.length > 0 ? sanitizedTargetProducts[0].productId : order.productId;
      const primaryVariantId =
        sanitizedTargetProducts.length > 0 ? sanitizedTargetProducts[0].variantId : order.variantId;

      const payload = {
        productionNo: order.productionNo,
        productId: primaryProductId,
        variantId: primaryVariantId,
        targetQuantity: totalCutPieces,
        cutQty: totalCutPieces,
        productionDate: formattedDate,
        cuttingDate: formattedDate,
        notes: notes.trim() || null,
        reason: order.reason || 'Cutting Run',
        materials: sanitizedMaterials,
        targetProducts: sanitizedTargetProducts,
        products: sanitizedTargetProducts,
        status: order.status,
      };

      await put<any>(`/production/${order.id}`, payload);
      toast.success(`Cutting #${order.productionNo} updated successfully!`);
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error('Failed to update cutting:', err);
      toast.error(
        err?.response?.data?.message || err?.message || 'Failed to update cutting record'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-4xl lg:max-w-5xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 shadow-2xl">
        {/* Header */}
        <DialogHeader className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-950 z-10 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20 shadow-xs">
                <Scissors className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                  <span>Edit Cutting #{order.productionNo}</span>
                </DialogTitle>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Production Workflow: Raw Material &rarr; Cutting &rarr; Sewing Line &rarr; Wash &rarr; Stock
                </p>
              </div>
            </div>

            <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white border border-slate-200 dark:border-zinc-700 mr-8">
              #{order.productionNo}
            </span>
          </div>

          {/* Cutting No & Date Time */}
          <div className="pt-2.5 border-t border-slate-100 dark:border-zinc-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Cutting No</span>
                </label>
                <span className="text-[10px] text-slate-400 font-mono">Immutable Identifier</span>
              </div>
              <Input
                value={order.productionNo}
                disabled
                className="h-9 text-xs font-mono font-bold bg-slate-100/70 dark:bg-zinc-900/60 rounded-xl cursor-not-allowed"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-zinc-300 h-4">
                <Calendar className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Cutting Date &amp; Time:</span>
              </div>
              <DateTimePicker
                value={productionDateTime}
                onChange={setProductionDateTime}
              />
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 pb-4 sm:pb-5 space-y-5">
            {/* ═════════════════════════════════════════════════════════════════
                SECTION A: RAW MATERIALS (INPUTS)
                Reordered columns: 1) Material select, 2) Units Qty, 3) Rolls
            ═════════════════════════════════════════════════════════════════ */}
            <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800 space-y-3.5 shadow-2xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-xs">
                    A
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-amber-500" />
                      <span>RAW MATERIAL ALLOCATIONS</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                      Allocate fabric materials, cutting yardage, and roll counts from warehouse stock
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddMaterialRow}
                  className="h-8 text-xs gap-1.5 rounded-lg border-amber-300 dark:border-amber-800/80 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer font-semibold shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Material Line</span>
                </Button>
              </div>

              {/* Material Rows */}
              <div className="space-y-3">
                {materials.map((matRow, idx) => {
                  const selectedMat = rawMaterialsList.find(
                    (m) => m.id === Number(matRow.rawMaterialId)
                  );
                  const initialUsage = order.materialUsages?.find(
                    (u: any) => (u.rawMaterialId || u.materialId) === Number(matRow.rawMaterialId)
                  );
                  const initialIssued = initialUsage ? Number(initialUsage.issuedQty) : 0;
                  const availableWarehouse = selectedMat ? Number(selectedMat.currentStock) || 0 : 0;
                  const maxStock = availableWarehouse + initialIssued;
                  const enteredQty = Number(matRow.issuedQty) || 0;
                  const isOverStock = selectedMat && matRow.issuedQty !== '' && enteredQty > maxStock;

                  return (
                    <div
                      key={matRow.rowId}
                      className={`p-3 rounded-xl border transition-all space-y-2.5 ${
                        isOverStock
                          ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900/60'
                          : 'bg-white dark:bg-zinc-950 border-slate-200/90 dark:border-zinc-800 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center justify-center size-5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 text-[10px] font-bold font-mono">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                            Line #{idx + 1}
                          </span>
                          {selectedMat && (
                            <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono">
                              (Warehouse: {availableWarehouse} {selectedMat.unit}
                              {initialIssued > 0 && ` + ${initialIssued} allocated`})
                            </span>
                          )}
                        </div>

                        {materials.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMaterialRow(idx)}
                            className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer p-1 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            title="Remove material line"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Reordered input columns: 1) Material select (left), 2) Units Qty (middle), 3) Rolls count (right) */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                        {/* 1. Material (Left - 6 cols) */}
                        <div className="sm:col-span-6 space-y-1">
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                            Material <span className="text-rose-500">*</span>
                          </label>
                          <SearchableSelect
                            options={rawMaterialOptions}
                            value={matRow.rawMaterialId}
                            onValueChange={(val: string) => handleMaterialChange(idx, 'rawMaterialId', val)}
                            placeholder="Select material..."
                            searchPlaceholder="Type material name or code..."
                            dark={isDark}
                            className="h-9 text-xs"
                          />
                        </div>

                        {/* 2. Units Qty (Middle - 3 cols) */}
                        <div className="sm:col-span-3 space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                              Units Qty <span className="text-rose-500">*</span>
                            </label>
                            {selectedMat && (
                              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                {selectedMat.unit}
                              </span>
                            )}
                          </div>
                          <div className="relative">
                            <Input
                              type="number"
                              min={0.01}
                              step="any"
                              placeholder="0.00"
                              value={matRow.issuedQty}
                              onChange={(e) =>
                                handleMaterialChange(
                                  idx,
                                  'issuedQty',
                                  e.target.value === '' ? '' : parseFloat(e.target.value)
                                )
                              }
                              className={`h-9 text-xs font-mono pr-12 ${
                                isOverStock
                                  ? 'border-rose-400 focus-visible:ring-rose-400 bg-rose-50/30'
                                  : ''
                              }`}
                            />
                            {selectedMat && (
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold font-mono text-slate-400 pointer-events-none uppercase">
                                {selectedMat.unit}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 3. Rolls (Right - 3 cols) */}
                        <div className="sm:col-span-3 space-y-1">
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                            Rolls Count
                          </label>
                          <Input
                            type="number"
                            min={1}
                            placeholder="1"
                            value={matRow.piecesCount}
                            onChange={(e) =>
                              handleMaterialChange(
                                idx,
                                'piecesCount',
                                e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1)
                              )
                            }
                            className="h-9 text-xs font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ═════════════════════════════════════════════════════════════════
                SECTION B: TARGET PRODUCTS
                Product selector on left, Pieces / Cut Qty input on right
            ═════════════════════════════════════════════════════════════════ */}
            <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800 space-y-3.5 shadow-2xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">
                    B
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Shirt className="w-3.5 h-3.5 text-emerald-500" />
                      <span>TARGET PRODUCTS &amp; CUT PIECES</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                      Map garment styles and specify the exact number of pieces cut for each product
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddTargetProductRow}
                  className="h-8 text-xs gap-1.5 rounded-lg border-emerald-300 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer font-semibold shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Target Product</span>
                </Button>
              </div>

              {/* Product Rows */}
              <div className="space-y-3">
                {targetProducts.map((prodRow, pIdx) => {
                  return (
                    <div
                      key={prodRow.rowId}
                      className="p-3 rounded-xl bg-white dark:bg-zinc-950 border border-slate-200/90 dark:border-zinc-800 shadow-2xs space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center justify-center size-5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold font-mono">
                            {pIdx + 1}
                          </span>
                          <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                            Target Product #{pIdx + 1}
                          </span>
                        </div>

                        {targetProducts.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveTargetProductRow(pIdx)}
                            className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer p-1 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            title="Remove target product row"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Product Selector (left) + Pieces / Cut Qty input (right) */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                        <div className="sm:col-span-8 space-y-1">
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                            Target Garment Product <span className="text-rose-500">*</span>
                          </label>
                          <SearchableSelect
                            options={productOptions}
                            value={prodRow.productId}
                            onValueChange={(val: string) => handleTargetProductChange(pIdx, 'productId', val)}
                            placeholder="Select target garment style (thumbnail, SKU, barcode)..."
                            searchPlaceholder="Type product name, SKU, or barcode..."
                            dark={isDark}
                            className="h-9 text-xs w-full"
                          />
                        </div>

                        <div className="sm:col-span-4 space-y-1">
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400 flex items-center justify-between">
                            <span>Pieces / Cut Qty <span className="text-rose-500">*</span></span>
                            <span className="text-[10px] font-mono text-emerald-600 font-bold">PIECES</span>
                          </label>
                          <Input
                            type="number"
                            min={1}
                            placeholder="e.g. 100"
                            value={prodRow.cutQty}
                            onChange={(e) =>
                              handleTargetProductChange(
                                pIdx,
                                'cutQty',
                                e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value, 10) || 1)
                              )
                            }
                            className="h-9 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Notes / Instructions */}
            <div className="space-y-1.5 p-3.5 rounded-xl bg-slate-50/80 dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800">
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Cutting Notes / Factory Instructions <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Marker efficiency 88%, pattern adjustments..."
                className="h-9 text-xs"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <DialogFooter className="px-5 py-3.5 border-t border-slate-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-950 z-10 flex flex-row items-center justify-between sm:justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="rounded-xl text-xs h-9"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="rounded-xl text-xs h-9 bg-amber-600 hover:bg-amber-700 text-white font-semibold flex items-center gap-2 shadow-xs cursor-pointer px-4"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Updating Cutting...</span>
                </>
              ) : (
                <>
                  <Scissors className="w-4 h-4" />
                  <span>Update Cutting</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CuttingEditModal;
