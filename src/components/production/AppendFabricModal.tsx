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
import { SearchableSelect, type SearchableSelectOption } from '../ui/searchable-select';
import { useTheme } from '../../contexts/ThemeContext';
import { post } from '../../lib/api';
import { toast } from 'react-toastify';
import {
  Scissors,
  Plus,
  Trash2,
  AlertCircle,
  Loader2,
  Shirt,
  Layers,
  Sparkles,
} from 'lucide-react';
import { BatchStatusBadge } from './BatchStatusBadge';

export interface AppendMaterialRow {
  rowId: string;
  rawMaterialId: string;
  piecesCount: number | '';
  issuedQty: number | '';
}

export interface AppendTargetProductRow {
  rowId: string;
  productId: string;
  variantId?: string;
  plannedQty: number | '';
}

export interface AppendFabricModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: any | null;
  rawMaterialsList: any[];
  productsList: any[];
  dark?: boolean;
  onSuccess: (updatedBatch: any) => void;
}

export const AppendFabricModal: React.FC<AppendFabricModalProps> = ({
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

  const [materials, setMaterials] = useState<AppendMaterialRow[]>([]);
  const [targetProducts, setTargetProducts] = useState<AppendTargetProductRow[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Reset form when modal opens
  useEffect(() => {
    if (open && order) {
      setMaterials([
        {
          rowId: `append-mat-${Date.now()}`,
          rawMaterialId: '',
          piecesCount: 1,
          issuedQty: '',
        },
      ]);
      setTargetProducts([]);
      setNotes('');
    }
  }, [open, order]);

  // Options for Raw Materials select
  const rawMaterialOptions: SearchableSelectOption[] = useMemo(() => {
    return rawMaterialsList
      .filter((rm) => rm.isActive !== false)
      .map((rm) => ({
        value: String(rm.id),
        label: `${rm.name} (${rm.code || 'RM'}) — Stock: ${rm.currentStock} ${rm.unit}`,
      }));
  }, [rawMaterialsList]);

  // Options for Products select
  const productSelectOptions: SearchableSelectOption[] = useMemo(() => {
    return productsList
      .filter((p) => p.isActive !== false)
      .map((p) => ({
        value: String(p.id),
        label: p.name,
      }));
  }, [productsList]);

  // Add material row
  const handleAddMaterialRow = () => {
    setMaterials((prev) => [
      ...prev,
      {
        rowId: `append-mat-${Date.now()}-${Math.random()}`,
        rawMaterialId: '',
        piecesCount: 1,
        issuedQty: '',
      },
    ]);
  };

  // Remove material row
  const handleRemoveMaterialRow = (rowId: string) => {
    if (materials.length <= 1) {
      toast.warning('At least one fabric material row is required.');
      return;
    }
    setMaterials((prev) => prev.filter((m) => m.rowId !== rowId));
  };

  // Add target product row
  const handleAddTargetProductRow = () => {
    const defaultProdId = order?.productId ? String(order.productId) : (productsList[0] ? String(productsList[0].id) : '');
    setTargetProducts((prev) => [
      ...prev,
      {
        rowId: `append-tp-${Date.now()}-${Math.random()}`,
        productId: defaultProdId,
        plannedQty: '',
      },
    ]);
  };

  // Remove target product row
  const handleRemoveTargetProductRow = (rowId: string) => {
    setTargetProducts((prev) => prev.filter((tp) => tp.rowId !== rowId));
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order?.id) return;

    // Validate materials
    const validMaterials = materials.filter(
      (m) => m.rawMaterialId && m.issuedQty !== '' && Number(m.issuedQty) > 0
    );

    if (validMaterials.length === 0) {
      toast.error('Please enter at least one valid raw material line with an issued cut quantity.');
      return;
    }

    // Check stock availability
    for (const mat of validMaterials) {
      const rm = rawMaterialsList.find((r) => String(r.id) === String(mat.rawMaterialId));
      if (rm && Number(mat.issuedQty) > Number(rm.currentStock)) {
        toast.error(
          `Insufficient stock for "${rm.name}". Available: ${rm.currentStock} ${rm.unit}, Required: ${mat.issuedQty} ${rm.unit}`
        );
        return;
      }
    }

    // Format target products
    const validTargetProducts = targetProducts
      .filter((tp) => tp.productId && tp.plannedQty !== '' && Number(tp.plannedQty) > 0)
      .map((tp) => {
        const prod = productsList.find((p) => String(p.id) === String(tp.productId));
        return {
          productId: Number(tp.productId),
          variantId: tp.variantId ? Number(tp.variantId) : null,
          productName: prod?.name,
          plannedQty: Number(tp.plannedQty),
        };
      });

    setIsSubmitting(true);
    try {
      const payload = {
        materials: validMaterials.map((m) => ({
          rawMaterialId: Number(m.rawMaterialId),
          issuedQty: Number(m.issuedQty),
          piecesCount: Number(m.piecesCount) || 1,
        })),
        targetProducts: validTargetProducts.length > 0 ? validTargetProducts : undefined,
        notes: notes.trim() || undefined,
      };

      const res: any = await post(`/production/${order.id}/append-fabric`, payload);
      const updated = res?.data || res;
      toast.success(`Fabric appended successfully to Batch #${order.productionNo}`);
      onSuccess(updated);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to append fabric to batch');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] sm:max-w-3xl lg:max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 rounded-2xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 shadow-2xl">
        <DialogHeader className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-950 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200 dark:border-amber-900/50 shadow-xs">
                <Scissors className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                  <span>Append Fabric — Batch #{order.productionNo}</span>
                  <BatchStatusBadge status={order.status} isStockSynced={order.isStockSynced} />
                </DialogTitle>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Appends new raw material quantities and planned outputs without creating redundant status logs.
                </p>
              </div>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 pb-24 sm:pb-28 space-y-4">
            {/* Context Info Banner */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800 flex items-center justify-between gap-3 text-xs flex-wrap">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Product</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {order.product?.name || 'Garment Batch'}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Current Target</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {order.targetQuantity} Pcs
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Existing Materials</span>
                <span className="font-mono font-bold text-amber-600">
                  {order.materialUsages?.length || 0} Line(s)
                </span>
              </div>
            </div>

            {/* Raw Material Rows to Append */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-amber-500" />
                  <span>Fabric / Raw Materials to Append</span>
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddMaterialRow}
                  className="h-7 text-xs rounded-lg text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 font-semibold cursor-pointer"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  <span>Add Material Line</span>
                </Button>
              </div>

              <div className="space-y-2">
                {materials.map((mat, index) => {
                  const selectedRm = rawMaterialsList.find(
                    (r) => String(r.id) === String(mat.rawMaterialId)
                  );
                  const unit = selectedRm?.unit || 'Units';

                  return (
                    <div
                      key={mat.rowId}
                      className="p-3 bg-slate-50 dark:bg-zinc-900/70 rounded-xl border border-slate-200/80 dark:border-zinc-800 space-y-2 overflow-visible relative"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-slate-600 dark:text-zinc-400">
                          Material Line #{index + 1}
                        </span>
                        {materials.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveMaterialRow(mat.rowId)}
                            className="h-6 w-6 p-0 text-slate-400 hover:text-rose-600 rounded-md cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 overflow-visible">
                        <div className="sm:col-span-6 overflow-visible relative">
                          <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                            Raw Material <span className="text-rose-500">*</span>
                          </label>
                          <SearchableSelect
                            options={rawMaterialOptions}
                            value={mat.rawMaterialId}
                            onValueChange={(val) => {
                              setMaterials((prev) => {
                                const copy = [...prev];
                                copy[index].rawMaterialId = val;
                                return copy;
                              });
                            }}
                            placeholder="Select fabric or raw material..."
                            searchPlaceholder="Search material by name or code..."
                            dark={isDark}
                          />
                        </div>

                        <div className="sm:col-span-3">
                          <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                            Quantity Cut ({unit}) <span className="text-rose-500">*</span>
                          </label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0.01"
                            required
                            value={mat.issuedQty}
                            onChange={(e) => {
                              const val = e.target.value;
                              setMaterials((prev) => {
                                const copy = [...prev];
                                copy[index].issuedQty = val === '' ? '' : Number(val);
                                return copy;
                              });
                            }}
                            placeholder="0.00"
                            className="h-9 text-xs rounded-xl bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 font-mono font-bold"
                          />
                        </div>

                        <div className="sm:col-span-3">
                          <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                            Rolls / Pcs
                          </label>
                          <Input
                            type="number"
                            min="1"
                            step="1"
                            value={mat.piecesCount}
                            onChange={(e) => {
                              const val = e.target.value;
                              setMaterials((prev) => {
                                const copy = [...prev];
                                copy[index].piecesCount = val === '' ? '' : Number(val);
                                return copy;
                              });
                            }}
                            placeholder="1"
                            className="h-9 text-xs rounded-xl bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Optional Additional Target Products */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Shirt className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Additional Planned Garments (Optional)</span>
                  </label>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    If this fabric cut increases the batch target output, specify the additional planned count.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddTargetProductRow}
                  className="h-7 text-xs rounded-lg text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 font-semibold cursor-pointer"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  <span>Add Output Style</span>
                </Button>
              </div>

              {targetProducts.length > 0 && (
                <div className="space-y-2 overflow-visible">
                  {targetProducts.map((tp, idx) => (
                    <div
                      key={tp.rowId}
                      className="p-3 bg-slate-50 dark:bg-zinc-900/70 rounded-xl border border-slate-200/80 dark:border-zinc-800 flex items-center gap-2.5 overflow-visible relative"
                    >
                      <div className="flex-1 overflow-visible relative">
                        <SearchableSelect
                          options={productSelectOptions}
                          value={tp.productId}
                          onValueChange={(val) => {
                            setTargetProducts((prev) => {
                              const copy = [...prev];
                              copy[idx].productId = val;
                              return copy;
                            });
                          }}
                          placeholder="Select garment product..."
                          searchPlaceholder="Search product..."
                          dark={isDark}
                        />
                      </div>
                      <div className="w-32">
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          required
                          value={tp.plannedQty}
                          onChange={(e) => {
                            const val = e.target.value;
                            setTargetProducts((prev) => {
                              const copy = [...prev];
                              copy[idx].plannedQty = val === '' ? '' : Number(val);
                              return copy;
                            });
                          }}
                          placeholder="Planned Pcs"
                          className="h-9 text-xs rounded-xl bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 font-mono font-bold"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveTargetProductRow(tp.rowId)}
                        className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 rounded-md cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-1 pt-1">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block">
                Notes / Roll Details <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <Input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Added 2 extra rolls of Denim fabric for second cutting shift"
                className="h-9 text-xs rounded-xl bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800"
              />
            </div>
          </div>

          <DialogFooter className="px-5 py-3.5 border-t border-slate-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-950 z-10 flex-row justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs rounded-xl h-9"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer h-9 px-4"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Appending Fabric...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Append Fabric to Batch</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AppendFabricModal;
