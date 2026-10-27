import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Loader2,
  Shirt,
  Calendar,
  Layers,
  Sparkles,
  Boxes,
} from 'lucide-react';
import { MaterialFormModal, type CreatedMaterialResult } from '../materials/MaterialFormModal';

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
  cutQty?: number | '';
  plannedQty?: number | '';
}

export interface CuttingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingOrder: any | null;
  rawMaterialsList: any[];
  productsList: any[];
  dark?: boolean;
  onSuccess: () => void;
  onMaterialAdded?: (material: any) => void;
}

export const CuttingModal: React.FC<CuttingModalProps> = ({
  open,
  onOpenChange,
  editingOrder,
  rawMaterialsList,
  productsList,
  dark: darkProp,
  onSuccess,
  onMaterialAdded,
}) => {
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const isDark = darkProp !== undefined ? darkProp : resolvedTheme === 'dark';

  // Master catalog local states for seamless dynamic updates without reset
  const [localMaterialsList, setLocalMaterialsList] = useState<any[]>(rawMaterialsList || []);
  const [localProductsList, setLocalProductsList] = useState<any[]>(productsList || []);

  useEffect(() => {
    setLocalMaterialsList(rawMaterialsList || []);
  }, [rawMaterialsList]);

  useEffect(() => {
    setLocalProductsList(productsList || []);
  }, [productsList]);

  // Inline Material Creation Modal state
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [activeMaterialRowIndex, setActiveMaterialRowIndex] = useState<number | null>(null);

  const [cuttingNumber, setCuttingNumber] = useState<string>('');
  const [generatingCuttingNo, setGeneratingCuttingNo] = useState<boolean>(false);
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
      cutQty: '',
    },
  ]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Auto-generate sequential cutting number
  const handleAutoGenerateCuttingNumber = async () => {
    setGeneratingCuttingNo(true);
    try {
      const res: any = await get('/production/next-batch-number');
      const nextNo = res?.data?.productionNo || res?.productionNo;
      if (nextNo) {
        setCuttingNumber(nextNo);
      } else {
        const todayStr = getCurrentDateFormattedYYYYMMDD();
        setCuttingNumber(`CUT-${todayStr}-${Math.floor(100 + Math.random() * 900)}`);
      }
    } catch {
      const todayStr = getCurrentDateFormattedYYYYMMDD();
      setCuttingNumber(`CUT-${todayStr}-${Math.floor(100 + Math.random() * 900)}`);
    } finally {
      setGeneratingCuttingNo(false);
    }
  };

  /**
   * Rehydrate Cutting Form state:
   * 1. Checks if a saved draft exists in sessionStorage (saved before navigating to Add Product)
   * 2. Rehydrates all filled form values and auto-selects newly created product if available
   * 3. Falls back to editingOrder or fresh cutting form
   */
  useEffect(() => {
    if (open) {
      const savedDraftStr = sessionStorage.getItem('CUTTING_FORM_DRAFT');
      if (!editingOrder && savedDraftStr) {
        try {
          const draft = JSON.parse(savedDraftStr);
          if (draft) {
            if (draft.cuttingNumber) setCuttingNumber(draft.cuttingNumber);
            if (draft.productionDateTime) setProductionDateTime(draft.productionDateTime);
            if (draft.notes !== undefined) setNotes(draft.notes);
            if (Array.isArray(draft.materials) && draft.materials.length > 0) {
              setMaterials(draft.materials);
            }

            // Check if newly created product ID exists to auto-select
            const newlyCreatedId =
              sessionStorage.getItem('NEWLY_CREATED_PRODUCT_ID') ||
              new URLSearchParams(window.location.search).get('newlyCreatedProductId');

            if (Array.isArray(draft.targetProducts) && draft.targetProducts.length > 0) {
              const restoredProducts = [...draft.targetProducts];
              const targetIdx = draft.targetProductIndex ?? 0;

              if (newlyCreatedId && restoredProducts[targetIdx]) {
                restoredProducts[targetIdx] = {
                  ...restoredProducts[targetIdx],
                  productId: String(newlyCreatedId),
                };
              }
              setTargetProducts(restoredProducts);
            }

            // Clean up storage and URL query params
            sessionStorage.removeItem('CUTTING_FORM_DRAFT');
            sessionStorage.removeItem('NEWLY_CREATED_PRODUCT_ID');

            const url = new URL(window.location.href);
            if (url.searchParams.has('openAddCutting') || url.searchParams.has('newlyCreatedProductId')) {
              url.searchParams.delete('openAddCutting');
              url.searchParams.delete('newlyCreatedProductId');
              window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
            }

            toast.info('Restored your Cutting batch draft seamlessly!');
            return;
          }
        } catch (e) {
          console.warn('Failed to parse draft state:', e);
          sessionStorage.removeItem('CUTTING_FORM_DRAFT');
        }
      }

      if (editingOrder) {
        setCuttingNumber(editingOrder.productionNo || '');
        setProductionDateTime(
          formatToLocalInputDateTime(editingOrder.productionDate || editingOrder.createdAt)
        );
        setNotes(editingOrder.notes || '');

        // Hydrate materials
        if (editingOrder.materialUsages && editingOrder.materialUsages.length > 0) {
          setMaterials(
            editingOrder.materialUsages.map((usage: any, idx: number) => ({
              rowId: `mat-${idx}-${usage.id || Date.now()}`,
              rawMaterialId: String(usage.rawMaterialId || usage.materialId || ''),
              piecesCount: usage.piecesCount !== undefined ? usage.piecesCount : (usage.pieces || 1),
              issuedQty: usage.issuedQty !== undefined ? usage.issuedQty : (usage.cuttingQty || ''),
              priorPiecesCount: usage.piecesCount !== undefined ? usage.piecesCount : usage.pieces,
              priorIssuedQty: usage.issuedQty !== undefined ? usage.issuedQty : usage.cuttingQty,
            }))
          );
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

        // Hydrate target products with per-product cut pieces
        let rawTp = editingOrder.targetProducts;
        if (typeof rawTp === 'string') {
          try {
            rawTp = JSON.parse(rawTp);
          } catch {
            rawTp = null;
          }
        }

        if (Array.isArray(rawTp) && rawTp.length > 0) {
          setTargetProducts(
            rawTp.map((tp: any, idx: number) => ({
              rowId: `prod-${idx}-${Date.now()}`,
              productId: String(tp.productId || tp.id || ''),
              variantId: tp.variantId ? String(tp.variantId) : '',
              cutQty: tp.cutQty !== undefined && tp.cutQty !== null ? tp.cutQty : (tp.plannedQty ?? ''),
            }))
          );
        } else if (editingOrder.productId) {
          setTargetProducts([
            {
              rowId: 'prod-1',
              productId: String(editingOrder.productId),
              variantId: editingOrder.variantId ? String(editingOrder.variantId) : '',
              cutQty: editingOrder.cutQty || editingOrder.targetQuantity || '',
            },
          ]);
        } else {
          setTargetProducts([
            {
              rowId: 'prod-1',
              productId: '',
              cutQty: '',
            },
          ]);
        }
      } else {
        // New cutting
        handleAutoGenerateCuttingNumber();
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
            cutQty: '',
          },
        ]);
      }
    }
  }, [open, editingOrder]);

  // Options for Raw Materials select
  const rawMaterialOptions: SearchableSelectOption[] = useMemo(() => {
    return localMaterialsList.map((m) => {
      const stock = Number(m.currentStock) || 0;
      return {
        value: String(m.id),
        label: `${m.name} (${m.code || 'No Code'})`,
        subLabel: `Available: ${stock} ${m.unit}`,
      };
    });
  }, [localMaterialsList]);

  // Options for Target Garment Products select
  const productOptions: SearchableSelectOption[] = useMemo(() => {
    return localProductsList.map((p) => {
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
  }, [localProductsList]);

  // Handle Material Modal Opening
  const handleOpenMaterialModal = (rowIndex: number) => {
    setActiveMaterialRowIndex(rowIndex);
    setIsMaterialModalOpen(true);
  };

  // Callback after Material is created in MaterialFormModal
  const handleMaterialCreated = (newMat: CreatedMaterialResult) => {
    // 1. Dynamically append new material to options list with stock
    setLocalMaterialsList((prev) => {
      const exists = prev.some((m) => m.id === newMat.id);
      if (exists) return prev;
      return [newMat, ...prev];
    });

    onMaterialAdded?.(newMat);

    // 2. Auto-select into the active material row without resetting any other form field
    if (activeMaterialRowIndex !== null && activeMaterialRowIndex < materials.length) {
      handleMaterialChange(activeMaterialRowIndex, 'rawMaterialId', String(newMat.id));
    }

    setIsMaterialModalOpen(false);
    setActiveMaterialRowIndex(null);
  };

  // Handle Add New Product: Serialize current Cutting Form state and navigate to Add Product page
  const handleAddNewProduct = (targetProdRowIndex: number) => {
    const draftState = {
      cuttingNumber,
      productionDateTime,
      notes,
      materials,
      targetProducts,
      targetProductIndex: targetProdRowIndex,
      savedAt: Date.now(),
    };

    sessionStorage.setItem('CUTTING_FORM_DRAFT', JSON.stringify(draftState));
    onOpenChange(false);
    navigate('/system/products/new?returnTo=/system/cutting?openAddCutting=true');
  };

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
    field: keyof MaterialInputRow,
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
      },
    ]);
  };

  const handleRemoveTargetProductRow = (index: number) => {
    setTargetProducts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleTargetProductChange = (
    index: number,
    field: keyof TargetProductRow,
    value: any
  ) => {
    setTargetProducts((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // Client-side validations
  const validationError = useMemo((): string | null => {
    if (!cuttingNumber.trim()) return 'Cutting Number is required';

    // 1. Materials validation
    if (materials.length === 0) return 'Please add at least one raw material allocation';

    const selectedMaterialIds = new Set<string>();
    for (let i = 0; i < materials.length; i++) {
      const row = materials[i];
      if (!row.rawMaterialId) {
        return `Please select a raw material for Line #${i + 1}`;
      }
      if (selectedMaterialIds.has(row.rawMaterialId)) {
        const mat = localMaterialsList.find((m) => m.id === Number(row.rawMaterialId));
        return `Material "${mat?.name || row.rawMaterialId}" is allocated multiple times. Please combine into a single row.`;
      }
      selectedMaterialIds.add(row.rawMaterialId);

      const qty = Number(row.issuedQty);
      if (row.issuedQty === '' || isNaN(qty) || qty <= 0) {
        return `Please enter a valid positive quantity for Material Line #${i + 1}`;
      }

      // Warehouse stock check
      const mat = localMaterialsList.find((m) => m.id === Number(row.rawMaterialId));
      if (mat) {
        const available = Number(mat.currentStock) || 0;
        const initialUsage = editingOrder
          ? editingOrder.materialUsages?.find(
              (u: any) => (u.rawMaterialId || u.materialId) === Number(row.rawMaterialId)
            )
          : null;
        const initialIssued = initialUsage ? Number(initialUsage.issuedQty) : 0;
        const maxStock = editingOrder ? available + initialIssued : available;

        if (qty > maxStock) {
          return `Insufficient warehouse stock for "${mat.name}". Available: ${maxStock} ${mat.unit}, entered: ${qty} ${mat.unit}.`;
        }
      }
    }

    // 2. Target Products validation
    if (targetProducts.length === 0) return 'Please add at least one target garment product';

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
  }, [cuttingNumber, materials, targetProducts, localMaterialsList, editingOrder]);

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

      // Target products payload with explicit Cut Qty per product
      const sanitizedTargetProducts = targetProducts
        .filter((tp) => tp.productId)
        .map((tp) => {
          const prod = localProductsList.find((p) => p.id === Number(tp.productId));
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
            sewnQty: 0,
            sentToLineQty: 0,
            lineSentQty: 0,
            sentToWashQty: 0,
            washedQty: 0,
          };
        });

      const totalCutPieces = sanitizedTargetProducts.reduce((sum, tp) => sum + tp.cutQty, 0);
      const primaryProductId =
        sanitizedTargetProducts.length > 0 ? sanitizedTargetProducts[0].productId : undefined;
      const primaryVariantId =
        sanitizedTargetProducts.length > 0 ? sanitizedTargetProducts[0].variantId : null;

      if (editingOrder) {
        await put<any>(`/production/${editingOrder.id}`, {
          productionNo: cuttingNumber.trim(),
          productId: primaryProductId || editingOrder.productId,
          variantId: primaryVariantId || editingOrder.variantId,
          targetQuantity: totalCutPieces || editingOrder.targetQuantity || 0,
          cutQty: totalCutPieces,
          productionDate: formattedDate,
          cuttingDate: formattedDate,
          notes: notes.trim() || null,
          reason: editingOrder.reason || 'Cutting Run',
          materials: sanitizedMaterials,
          targetProducts: sanitizedTargetProducts,
          products: sanitizedTargetProducts,
          status: editingOrder.status,
        });
        toast.success(`Cutting #${editingOrder.productionNo} updated successfully!`);
      } else {
        await post<any>('/production/cut-batch', {
          productionNo: cuttingNumber.trim(),
          productId: primaryProductId,
          variantId: primaryVariantId,
          targetQuantity: totalCutPieces,
          cutQty: totalCutPieces,
          cuttingDate: formattedDate,
          cutDate: formattedDate,
          productionDate: formattedDate,
          notes: notes.trim() || null,
          reason: 'Garment Cutting Run',
          materials: sanitizedMaterials,
          targetProducts: sanitizedTargetProducts,
          products: sanitizedTargetProducts,
        });
        toast.success(`Cutting #${cuttingNumber} recorded successfully! Material inventory updated.`);
      }

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error('Failed to save cutting:', err);
      toast.error(
        err?.response?.data?.message || err?.message || 'Failed to record cutting run'
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
                      : 'New Garment Cutting'}
                  </span>
                </DialogTitle>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Production Workflow: Raw Material &rarr; Cutting &rarr; Sewing Line &rarr; Wash &rarr; Stock
                </p>
              </div>
            </div>

            {/* Header Product Count Badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-700 dark:text-amber-300 shadow-2xs mr-8">
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

          {/* Top Controls: Cutting No & Cutting Date Time */}
          <div className="pt-2.5 border-t border-slate-100 dark:border-zinc-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Cutting No Input with Auto-Generate Sparkle */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Cutting No <span className="text-rose-500">*</span></span>
                </label>
                <span className="text-[10px] text-slate-400 font-mono">Sequential Number</span>
              </div>
              <div className="relative flex items-center">
                <Input
                  value={cuttingNumber}
                  onChange={(e) => setCuttingNumber(e.target.value)}
                  placeholder="e.g. CUT-YYYYMMDD-XXX"
                  className="h-9 text-xs font-mono font-bold pr-10 rounded-xl"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleAutoGenerateCuttingNumber}
                  disabled={generatingCuttingNo}
                  className="absolute right-1 size-7 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition-colors cursor-pointer"
                  title="Auto generate sequential cutting number"
                >
                  {generatingCuttingNo ? (
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
                            onValueChange={(val: string) => {
                              if (val === '__ADD_NEW_MATERIAL__') {
                                handleOpenMaterialModal(idx);
                                return;
                              }
                              handleMaterialChange(idx, 'rawMaterialId', val);
                            }}
                            actionOption={{
                              label: 'Add New Material',
                              onSelect: () => handleOpenMaterialModal(idx),
                            }}
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
                              placeholder={qtyPlaceholder}
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
                            onValueChange={(val: string) => {
                              if (val === '__ADD_NEW_PRODUCT__') {
                                handleAddNewProduct(pIdx);
                                return;
                              }
                              handleTargetProductChange(pIdx, 'productId', val);
                            }}
                            actionOption={{
                              label: 'Add New Product',
                              onSelect: () => handleAddNewProduct(pIdx),
                            }}
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
                placeholder="e.g. Marker efficiency 88%, 4 plies laid, pattern adjustments..."
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
                  <span>Saving Cutting...</span>
                </>
              ) : (
                <>
                  <Scissors className="w-4 h-4" />
                  <span>{editingOrder ? 'Update Cutting' : 'Record Cutting'}</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>

        {/* Inline Material Creation Modal with Initial Stock Addition */}
        <MaterialFormModal
          open={isMaterialModalOpen}
          onOpenChange={setIsMaterialModalOpen}
          onMaterialCreated={handleMaterialCreated}
          dark={isDark}
        />
      </DialogContent>
    </Dialog>
  );
};

export default CuttingModal;
