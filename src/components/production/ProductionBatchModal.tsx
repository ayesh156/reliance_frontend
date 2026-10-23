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
import { Badge } from '../ui/badge';
import { DateTimePicker } from '../ui/date-time-picker';
import { SearchableSelect, type SearchableSelectOption } from '../ui/searchable-select';
import { useTheme } from '../../contexts/ThemeContext';
import {
  getProductImageUrl,
  getCurrentLocalDateTime,
  formatToLocalInputDateTime,
  getCurrentDateFormattedYYYYMMDD,
} from '../../lib/utils';
import { get, post, put } from '../../lib/api';
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

export interface MaterialInputRow {
  rowId: string;
  rawMaterialId: string;
  piecesCount: number | '';
  issuedQty: number | '';
  priorPiecesCount?: number;
  priorIssuedQty?: number;
}

export interface TargetProductRow {
  rowId: string;
  productId: string;
  variantId?: string;
  plannedQty?: number | '';
}

export interface ProductionBatchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingOrder: any | null;
  rawMaterialsList: any[];
  productsList: any[];
  dark?: boolean;
  onSuccess: () => void;
}

export const ProductionBatchModal: React.FC<ProductionBatchModalProps> = ({
  open,
  onOpenChange,
  editingOrder,
  rawMaterialsList,
  productsList,
  dark: darkProp,
  onSuccess,
}) => {
  const { resolvedTheme } = useTheme();
  const isDark = darkProp !== undefined ? darkProp : resolvedTheme === 'dark';

  const [batchNumber, setBatchNumber] = useState<string>('');
  const [generatingBatchNo, setGeneratingBatchNo] = useState<boolean>(false);
  const [productionDateTime, setProductionDateTime] = useState<string>(
    getCurrentLocalDateTime()
  );
  const [notes, setNotes] = useState<string>('');
  const [materials, setMaterials] = useState<MaterialInputRow[]>([
    {
      rowId: 'mat-1',
      rawMaterialId: '',
      piecesCount: 1,
      issuedQty: '',
    },
  ]);
  const [targetProducts, setTargetProducts] = useState<TargetProductRow[]>([
    {
      rowId: 'prod-1',
      productId: '',
    },
  ]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Auto-generate sequential batch number
  const handleAutoGenerateBatchNumber = async () => {
    setGeneratingBatchNo(true);
    try {
      const res: any = await get('/production/next-batch-number');
      const nextNo = res?.data?.productionNo || res?.productionNo;
      if (nextNo) {
        setBatchNumber(nextNo);
      } else {
        throw new Error('No number returned from server');
      }
    } catch {
      // Fallback sequential formatting: PRD-YYYYMMDD-XXX
      const dateStr = getCurrentDateFormattedYYYYMMDD();
      const rand = Math.floor(100 + Math.random() * 900);
      setBatchNumber(`PRD-${dateStr}-${rand}`);
    } finally {
      setGeneratingBatchNo(false);
    }
  };

  // Initialize or pre-populate modal when opened
  useEffect(() => {
    if (open) {
      if (editingOrder) {
        setBatchNumber(editingOrder.productionNo || '');
        setProductionDateTime(
          formatToLocalInputDateTime(editingOrder.productionDate)
        );
        setNotes(editingOrder.notes || '');

        // 1. Pre-populate Materials with prior saved quantities
        if (editingOrder.materialUsages && editingOrder.materialUsages.length > 0) {
          const loadedMaterials: MaterialInputRow[] = editingOrder.materialUsages.map(
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

              const rmId = String(usage.rawMaterialId || usage.materialId || '');

              return {
                rowId: `edit-mat-${usage.id || idx}`,
                rawMaterialId: rmId,
                piecesCount: pieces,
                issuedQty: issued,
                priorPiecesCount: typeof pieces === 'number' ? pieces : undefined,
                priorIssuedQty: typeof issued === 'number' ? issued : Number(issued) || undefined,
              };
            }
          );
          setMaterials(loadedMaterials);
        } else {
          setMaterials([
            {
              rowId: 'mat-1',
              rawMaterialId: '',
              piecesCount: 1,
              issuedQty: '',
            },
          ]);
        }

        // 2. Pre-populate Target Finished Products
        let loadedTargetProds: TargetProductRow[] = [];
        let parsedTargetProds = editingOrder.targetProducts;
        if (typeof parsedTargetProds === 'string') {
          try {
            parsedTargetProds = JSON.parse(parsedTargetProds);
          } catch {
            parsedTargetProds = null;
          }
        }

        if (Array.isArray(parsedTargetProds) && parsedTargetProds.length > 0) {
          loadedTargetProds = parsedTargetProds
            .filter((tp: any) => tp && (tp.productId || tp.id))
            .map((tp: any, idx: number) => ({
              rowId: `edit-prod-${idx}`,
              productId: String(tp.productId || tp.id),
              variantId: tp.variantId ? String(tp.variantId) : '',
            }));
        } else if (editingOrder.materialUsages && editingOrder.materialUsages.length > 0) {
          const extracted: TargetProductRow[] = [];
          editingOrder.materialUsages.forEach((u: any, uIdx: number) => {
            let uProds = u.targetProducts;
            if (typeof uProds === 'string') {
              try {
                uProds = JSON.parse(uProds);
              } catch {
                uProds = null;
              }
            }
            if (Array.isArray(uProds)) {
              uProds.forEach((tp: any, tpIdx: number) => {
                if (tp && (tp.productId || tp.id)) {
                  extracted.push({
                    rowId: `usage-prod-${uIdx}-${tpIdx}`,
                    productId: String(tp.productId || tp.id),
                    variantId: tp.variantId ? String(tp.variantId) : '',
                  });
                }
              });
            }
          });
          if (extracted.length > 0) {
            loadedTargetProds = extracted;
          }
        }

        if (loadedTargetProds.length === 0 && editingOrder.productId) {
          loadedTargetProds = [
            {
              rowId: 'edit-prod-single',
              productId: String(editingOrder.productId),
              variantId: editingOrder.variantId ? String(editingOrder.variantId) : '',
            },
          ];
        }

        if (loadedTargetProds.length === 0) {
          loadedTargetProds = [
            {
              rowId: 'prod-1',
              productId: '',
            },
          ];
        }

        setTargetProducts(loadedTargetProds);
      } else {
        // Create mode: fresh state & auto-fetch batch number if empty
        setProductionDateTime(getCurrentLocalDateTime());
        setNotes('');
        setMaterials([
          {
            rowId: 'mat-1',
            rawMaterialId: '',
            piecesCount: 1,
            issuedQty: '',
          },
        ]);
        setTargetProducts([
          {
            rowId: 'prod-1',
            productId: '',
          },
        ]);
        handleAutoGenerateBatchNumber();
      }
    }
  }, [open, editingOrder]);

  // Product SearchableSelect options with image thumbnail, SKU, and barcode
  const productOptions: SearchableSelectOption[] = useMemo(() => {
    return productsList.map((p) => {
      const rawImage = p.images?.[0]?.imageUrl || (p as any).image;
      const resolvedUrl = rawImage ? getProductImageUrl(rawImage) : null;
      const skus = p.variants?.map((v: any) => v.sku).filter(Boolean).join(', ');
      const barcodes = p.variants?.map((v: any) => v.barcode).filter(Boolean).join(', ');

      let searchLabel = p.name;
      if (skus) searchLabel += ` • SKU: ${skus}`;
      if (barcodes) searchLabel += ` • Barcode: ${barcodes}`;

      return {
        value: String(p.id),
        label: searchLabel,
        icon: resolvedUrl ? (
          <img
            src={resolvedUrl}
            alt={p.name}
            className="size-7 rounded-md object-cover border border-slate-200 dark:border-zinc-700 shrink-0"
          />
        ) : (
          <div className="size-7 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 flex items-center justify-center shrink-0">
            <Shirt className="size-3.5 text-amber-600 dark:text-amber-400" />
          </div>
        ),
      };
    });
  }, [productsList]);

  // Raw material options displaying material name and current available warehouse stock
  const rawMaterialOptions: SearchableSelectOption[] = useMemo(() => {
    return rawMaterialsList.map((rm) => ({
      value: String(rm.id),
      label: `${rm.name} (${rm.code || 'RM'}) — Stock: ${Number(rm.currentStock ?? 0).toLocaleString()} ${rm.unit}`,
    }));
  }, [rawMaterialsList]);

  // Section A: Materials Handlers
  const handleAddMaterialRow = () => {
    setMaterials((prev) => [
      ...prev,
      {
        rowId: `mat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        rawMaterialId: '',
        piecesCount: 1,
        issuedQty: '',
      },
    ]);
  };

  const handleRemoveMaterialRow = (idx: number) => {
    if (materials.length <= 1) return;
    setMaterials((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleMaterialChange = (idx: number, field: keyof MaterialInputRow, value: any) => {
    setMaterials((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  // Section B: Target Products Handlers
  const handleAddTargetProductRow = () => {
    setTargetProducts((prev) => [
      ...prev,
      {
        rowId: `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        productId: '',
      },
    ]);
  };

  const handleRemoveTargetProductRow = (idx: number) => {
    if (targetProducts.length <= 1) return;
    setTargetProducts((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleTargetProductChange = (idx: number, field: keyof TargetProductRow, value: any) => {
    setTargetProducts((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  // Form Validation
  const validationError = useMemo(() => {
    // 1. Batch number
    if (!batchNumber.trim()) {
      return 'Please provide or auto-generate a Batch Number';
    }

    // 2. Materials validation
    if (materials.length === 0) return 'Please add at least one material line';

    for (let i = 0; i < materials.length; i++) {
      const matRow = materials[i];
      if (!matRow.rawMaterialId) {
        return `Please select a material for Material Line #${i + 1}`;
      }
      const issuedNum = Number(matRow.issuedQty);
      if (matRow.issuedQty === '' || isNaN(issuedNum) || issuedNum <= 0) {
        return `Please enter a valid Units Qty (> 0) for Material Line #${i + 1}`;
      }

      const mat = rawMaterialsList.find((m) => m.id === Number(matRow.rawMaterialId));
      if (mat) {
        const initialUsage = editingOrder
          ? editingOrder.materialUsages?.find(
              (u: any) => (u.rawMaterialId || u.materialId) === Number(matRow.rawMaterialId)
            )
          : null;
        const initialIssued = initialUsage ? Number(initialUsage.issuedQty) : 0;
        const availableWarehouse = Number(mat.currentStock) || 0;
        const maxStock = editingOrder ? availableWarehouse + initialIssued : availableWarehouse;

        if (issuedNum > maxStock) {
          return `Material Line #${i + 1} (${mat.name}) units quantity (${issuedNum} ${mat.unit}) exceeds available stock (${maxStock} ${mat.unit})`;
        }
      }
    }

    // 3. Target Products validation
    if (targetProducts.length === 0) return 'Please add at least one target garment product';

    for (let j = 0; j < targetProducts.length; j++) {
      const prodRow = targetProducts[j];
      if (!prodRow.productId) {
        return `Please select a target garment product for Line #${j + 1}`;
      }
    }

    return null;
  }, [batchNumber, materials, targetProducts, rawMaterialsList, editingOrder]);

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validationError) {
      toast.warn(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      const formattedDate = productionDateTime
        ? new Date(productionDateTime).toISOString()
        : new Date().toISOString();

      // Materials payload
      const sanitizedMaterials = materials.map((m) => {
        const initialUsage = editingOrder
          ? editingOrder.materialUsages?.find(
              (u: any) => (u.rawMaterialId || u.materialId) === Number(m.rawMaterialId)
            )
          : null;

        const piecesVal = m.piecesCount !== '' ? Math.max(1, Number(m.piecesCount)) : 1;
        const issuedVal = Number(m.issuedQty);

        return {
          materialId: Number(m.rawMaterialId),
          rawMaterialId: Number(m.rawMaterialId),
          pieces: piecesVal,
          piecesCount: piecesVal,
          cuttingQty: issuedVal,
          issuedQty: issuedVal,
          returnedQty: initialUsage ? initialUsage.returnedQty : 0,
          returnReason: initialUsage ? initialUsage.returnReason : null,
        };
      });

      // Target products payload (Planned output Qty decoupled, defaults to 0)
      const sanitizedTargetProducts = targetProducts
        .filter((tp) => tp.productId)
        .map((tp) => {
          const prod = productsList.find((p) => p.id === Number(tp.productId));
          const firstVariant = prod?.variants?.[0];
          return {
            productId: Number(tp.productId),
            variantId: tp.variantId ? Number(tp.variantId) : (firstVariant?.id || null),
            productName: prod?.name || `Product #${tp.productId}`,
            sku: firstVariant?.sku || '',
            barcode: firstVariant?.barcode || '',
            plannedQty: 0,
          };
        });

      const primaryProductId =
        sanitizedTargetProducts.length > 0 ? sanitizedTargetProducts[0].productId : undefined;
      const primaryVariantId =
        sanitizedTargetProducts.length > 0 ? sanitizedTargetProducts[0].variantId : null;

      if (editingOrder) {
        await put<any>(`/production/${editingOrder.id}`, {
          productionNo: batchNumber.trim(),
          productId: primaryProductId || editingOrder.productId,
          variantId: primaryVariantId || editingOrder.variantId,
          targetQuantity: editingOrder.targetQuantity || 0,
          productionDate: formattedDate,
          cuttingDate: formattedDate,
          notes: notes.trim() || null,
          reason: editingOrder.reason || 'Cutting Run',
          materials: sanitizedMaterials,
          targetProducts: sanitizedTargetProducts,
          products: sanitizedTargetProducts,
          status: editingOrder.status,
        });
        toast.success(`Cutting Batch #${editingOrder.productionNo} updated successfully!`);
      } else {
        await post<any>('/production/cut-batch', {
          productionNo: batchNumber.trim(),
          productId: primaryProductId,
          variantId: primaryVariantId,
          targetQuantity: 0,
          cuttingDate: formattedDate,
          cutDate: formattedDate,
          productionDate: formattedDate,
          notes: notes.trim() || null,
          reason: 'Garment Cutting Batch',
          materials: sanitizedMaterials,
          targetProducts: sanitizedTargetProducts,
          products: sanitizedTargetProducts,
        });
        toast.success(`Cutting batch #${batchNumber.trim()} started successfully in CUTTING stage!`);
      }

      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      console.error('Failed to submit cutting batch:', err);
      toast.error(
        err.message || 'Failed to save cutting batch. Please check inventory stock levels.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

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
                  <span>
                    {editingOrder
                      ? `Edit Cutting #${editingOrder.productionNo}`
                      : 'Add Cutting'}
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-[11px] font-bold tracking-wide uppercase px-2.5 py-0.5 rounded-md ${
                      editingOrder
                        ? 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200 border-blue-400 dark:border-blue-700'
                        : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-amber-400 dark:border-amber-700'
                    }`}
                  >
                    {editingOrder ? 'EDIT CUTTING' : 'STAGE 1: CUTTING'}
                  </Badge>
                </DialogTitle>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Standard Factory Workflow: Fabric &rarr; Cutting &rarr; Line &rarr; Wash &rarr; Stock
                </p>
              </div>
            </div>

            {/* Header Product Count Badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-700 dark:text-amber-300 shadow-2xs">
              <Shirt className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="text-right">
                <div className="text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  TARGET STYLES
                </div>
                <div className="text-xs sm:text-sm font-extrabold font-mono leading-none">
                  {targetProducts.filter((tp) => tp.productId).length} Style(s)
                </div>
              </div>
            </div>
          </div>

          {/* Top Controls: Batch Number & Cutting Date Time */}
          <div className="pt-2.5 border-t border-slate-100 dark:border-zinc-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Batch Number Input with Auto-Generate Sparkle / Dice Icon */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Batch Number <span className="text-rose-500">*</span></span>
                </label>
                <span className="text-[10px] text-slate-400 font-mono">Sequential Code</span>
              </div>
              <div className="relative flex items-center">
                <Input
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  placeholder="e.g. PRD-YYYYMMDD-XXX"
                  className="h-9 text-xs font-mono font-bold pr-10 rounded-xl"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleAutoGenerateBatchNumber}
                  disabled={generatingBatchNo}
                  className="absolute right-1 size-7 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition-colors cursor-pointer"
                  title="Auto generate sequential batch code"
                >
                  {generatingBatchNo ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="size-3.5 animate-pulse" />
                  )}
                </Button>
              </div>
            </div>

            {/* Cutting Date & Time Picker */}
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
                      Allocate fabric materials, roll counts, and cutting yardage from stock
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
                  const initialUsage = editingOrder
                    ? editingOrder.materialUsages?.find(
                        (u: any) => (u.rawMaterialId || u.materialId) === Number(matRow.rawMaterialId)
                      )
                    : null;
                  const initialIssued = initialUsage ? Number(initialUsage.issuedQty) : 0;
                  const availableWarehouse = selectedMat ? Number(selectedMat.currentStock) || 0 : 0;
                  const maxStock = editingOrder ? availableWarehouse + initialIssued : availableWarehouse;
                  const enteredQty = Number(matRow.issuedQty) || 0;
                  const isOverStock = selectedMat && matRow.issuedQty !== '' && enteredQty > maxStock;

                  // Placeholders preserve prior saved values during edit if field is cleared
                  const rollsPlaceholder =
                    matRow.priorPiecesCount !== undefined ? String(matRow.priorPiecesCount) : '1';
                  const qtyPlaceholder =
                    matRow.priorIssuedQty !== undefined ? String(matRow.priorIssuedQty) : '0.00';

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

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                        {/* 1. Material (SearchableSelect) */}
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

                        {/* 2. Rolls (numeric) */}
                        <div className="sm:col-span-3 space-y-1">
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                            Rolls
                          </label>
                          <Input
                            type="number"
                            min={1}
                            placeholder={rollsPlaceholder}
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

                        {/* 3. Units Qty (numeric with unit badge) */}
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
                              placeholder={qtyPlaceholder}
                              value={matRow.issuedQty}
                              onChange={(e) =>
                                handleMaterialChange(
                                  idx,
                                  'issuedQty',
                                  e.target.value === '' ? '' : parseFloat(e.target.value)
                                )
                              }
                              className={`h-9 text-xs font-mono pr-14 ${
                                isOverStock
                                  ? 'border-rose-400 focus-visible:ring-rose-400 bg-rose-50/30'
                                  : ''
                              }`}
                            />
                            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none font-semibold">
                              {selectedMat?.unit || 'Units'}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Overstock Warning */}
                      {isOverStock && (
                        <div className="flex items-center gap-1.5 text-[11px] text-rose-600 dark:text-rose-400 font-semibold pt-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            Quantity ({enteredQty} {selectedMat.unit}) exceeds maximum available stock ({maxStock} {selectedMat.unit}).
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ═════════════════════════════════════════════════════════════════
                SECTION B: TARGET PRODUCTS (FULL WIDTH)
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
                      <span>TARGET PRODUCTS</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                      Map garment styles and styles to produce from this cutting batch
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

                      {/* Full-width Product Selector (Planned Output Qty removed) */}
                      <div className="w-full space-y-1">
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
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Optional Cutting Batch Notes */}
            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Cutting Batch Notes &amp; Work Order Instructions:
              </label>
              <Input
                placeholder="e.g. Marker ratio, table #1, cutting instructions"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </div>

          {/* Footer */}
          <DialogFooter className="px-5 py-3.5 border-t border-slate-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-950 z-10 flex-row justify-between items-center gap-2">
            <div className="text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>
                {materials.length} Material Line(s) &rarr; {targetProducts.filter((p) => p.productId).length} Target Product(s)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                className="h-9 text-xs rounded-xl"
              >
                Cancel
              </Button>

              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting || Boolean(validationError)}
                className={`h-9 text-xs font-bold rounded-xl gap-2 shadow-sm cursor-pointer ${
                  editingOrder
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-amber-600 hover:bg-amber-700 text-white'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving Cutting Batch...</span>
                  </>
                ) : (
                  <>
                    <Scissors className="w-3.5 h-3.5" />
                    <span>{editingOrder ? 'Update Cutting' : 'Add Cutting'}</span>
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ProductionBatchModal;
