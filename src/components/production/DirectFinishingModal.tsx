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
import { getProductImageUrl, getCurrentLocalDateTime } from '../../lib/utils';
import { post } from '../../lib/api';
import { toast } from 'react-toastify';
import {
  Shirt,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  Package,
  Layers,
  Sparkles,
  Waves,
} from 'lucide-react';

export interface FinishingTargetProductRow {
  rowId: string;
  productId: string;
  variantId?: string;
  quantity: number | '';
}

export interface DirectFinishingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productsList: any[];
  dark?: boolean;
  onSuccess: (newBatch: any) => void;
}

export const DirectFinishingModal: React.FC<DirectFinishingModalProps> = ({
  open,
  onOpenChange,
  productsList,
  dark: darkProp,
  onSuccess,
}) => {
  const { resolvedTheme } = useTheme();
  const isDark = darkProp !== undefined ? darkProp : resolvedTheme === 'dark';

  const [dateTime, setDateTime] = useState<string>(getCurrentLocalDateTime());
  const [targetProducts, setTargetProducts] = useState<FinishingTargetProductRow[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [sendToWashDirectly, setSendToWashDirectly] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Initialize form when opening
  useEffect(() => {
    if (open) {
      setDateTime(getCurrentLocalDateTime());
      setNotes('');
      setSendToWashDirectly(false);
      const defaultProductId = productsList[0] ? String(productsList[0].id) : '';
      setTargetProducts([
        {
          rowId: `df-row-${Date.now()}`,
          productId: defaultProductId,
          variantId: '',
          quantity: '',
        },
      ]);
    }
  }, [open, productsList]);

  // Options for finished garment products with thumbnail images
  const productOptions: SearchableSelectOption[] = useMemo(() => {
    return productsList
      .filter((p) => p.isActive !== false)
      .map((p) => {
        const rawImage = p.images?.[0]?.imageUrl;
        const resolvedUrl = rawImage ? getProductImageUrl(rawImage) : null;
        return {
          value: String(p.id),
          label: p.name,
          icon: resolvedUrl ? (
            <img
              src={resolvedUrl}
              alt={p.name}
              className="size-5 rounded-md object-cover border border-slate-200 dark:border-zinc-700 shrink-0"
            />
          ) : (
            <Package className="size-4 text-emerald-500 shrink-0" />
          ),
        };
      });
  }, [productsList]);

  // Variant options per row
  const getVariantOptions = (productId: string): SearchableSelectOption[] => {
    if (!productId) return [];
    const prod = productsList.find((p) => String(p.id) === String(productId));
    if (!prod || !prod.variants || prod.variants.length === 0) return [];
    return [
      { value: '', label: 'General / No Specific Variant' },
      ...prod.variants.map((v: any) => ({
        value: String(v.id),
        label: [v.size && `Size ${v.size}`, v.color && `Color ${v.color}`, v.sku && `SKU: ${v.sku}`]
          .filter(Boolean)
          .join(' • '),
      })),
    ];
  };

  const handleAddProductRow = () => {
    const defaultProductId = productsList[0] ? String(productsList[0].id) : '';
    setTargetProducts((prev) => [
      ...prev,
      {
        rowId: `df-row-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        productId: defaultProductId,
        variantId: '',
        quantity: '',
      },
    ]);
  };

  const handleRemoveProductRow = (rowId: string) => {
    if (targetProducts.length <= 1) {
      toast.warning('At least one finished garment product is required');
      return;
    }
    setTargetProducts((prev) => prev.filter((r) => r.rowId !== rowId));
  };

  const totalOutputQuantity = useMemo(() => {
    return targetProducts.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
  }, [targetProducts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const validRows = targetProducts.filter(
      (r) => r.productId && Number(r.quantity) > 0
    );

    if (validRows.length === 0) {
      toast.warn('Please specify at least one product with an output quantity greater than zero');
      return;
    }

    const primaryRow = validRows[0];
    const totalOutput = validRows.reduce((sum, r) => sum + Number(r.quantity), 0);

    setIsSubmitting(true);
    try {
      // Direct Finishing Payload: Submits empty materials: [] array
      const payload = {
        productionDate: dateTime ? new Date(dateTime).toISOString() : new Date().toISOString(),
        cutDate: dateTime ? new Date(dateTime).toISOString() : new Date().toISOString(),
        productId: Number(primaryRow.productId),
        variantId: primaryRow.variantId ? Number(primaryRow.variantId) : null,
        targetQuantity: totalOutput,
        completedQty: totalOutput,
        targetProducts: validRows.map((r) => ({
          productId: Number(r.productId),
          variantId: r.variantId ? Number(r.variantId) : null,
          plannedQty: Number(r.quantity),
        })),
        materials: [], // Explicitly empty for Finishing-First Retroactive production
        reason: sendToWashDirectly ? 'Finishing-First: Directly to Wash Plant' : 'Finishing-First Production Run',
        notes: notes.trim() || undefined,
        status: sendToWashDirectly ? 'WASHING' : 'FINISHED_PENDING_STOCK',
      };

      const res: any = await post('/production/batches', payload);
      const created = res?.data || res;
      toast.success(
        sendToWashDirectly
          ? `Production Batch #${created?.productionNo || 'created'} recorded with ${totalOutput} finished garment(s) and routed directly to Wash Plant!`
          : `Production Batch #${created?.productionNo || 'created'} recorded with ${totalOutput} finished garment(s)! Fabrics can be allocated anytime via Edit Batch.`
      );
      onSuccess(created);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || err?.message || 'Failed to record finished product batch'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] sm:max-w-2xl lg:max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0 rounded-2xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 shadow-2xl">
        {/* Header */}
        <DialogHeader className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-950 z-10">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-900/50 shadow-xs">
              <Shirt className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Record Finished Product</span>
                <Badge
                  variant="outline"
                  className="text-[10px] font-mono uppercase bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                >
                  Finishing-First
                </Badge>
              </DialogTitle>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Record completed garments directly into the system. Fabrics can be retroactively cut and allocated at any time.
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-visible">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-28 sm:pb-32 space-y-4 overflow-visible">
            {/* Info Callout */}
            <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40 text-xs flex items-center justify-between gap-3 text-emerald-900 dark:text-emerald-200">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>
                  <strong>Retroactive Production:</strong> Enter the finished garment styles and quantities completed today.
                </span>
              </div>
              <div className="font-mono font-bold text-xs shrink-0 bg-emerald-100 dark:bg-emerald-900/50 px-2.5 py-1 rounded-lg">
                Total Output: {totalOutputQuantity} Pcs
              </div>
            </div>

            {/* Date & Time Picker */}
            <div className="space-y-1.5 overflow-visible">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block uppercase tracking-wider">
                Date &amp; Time of Finishing <span className="text-rose-500">*</span>
              </label>
              <DateTimePicker
                value={dateTime}
                onChange={setDateTime}
              />
            </div>

            {/* Target Finished Products Section */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-zinc-800 overflow-visible">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Shirt className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Finished Garment Products &amp; Output Quantities</span>
                  </label>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Select target garment style and enter finished pieces count
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddProductRow}
                  className="h-7 text-xs rounded-lg text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 font-semibold cursor-pointer"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  <span>Add Another Product</span>
                </Button>
              </div>

              <div className="space-y-2.5 overflow-visible">
                {targetProducts.map((row, idx) => {
                  const variantOptions = getVariantOptions(row.productId);

                  return (
                    <div
                      key={row.rowId}
                      className="p-3 bg-slate-50 dark:bg-zinc-900/70 rounded-xl border border-slate-200/80 dark:border-zinc-800 space-y-2.5 relative overflow-visible"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-600 dark:text-zinc-400 flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5 text-slate-400" />
                          <span>Garment Item #{idx + 1}</span>
                        </span>
                        {targetProducts.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveProductRow(row.rowId)}
                            className="h-6 w-6 p-0 text-slate-400 hover:text-rose-600 rounded-md cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-start overflow-visible">
                        {/* Garment Product Select */}
                        <div className="sm:col-span-6 relative overflow-visible flex flex-col">
                          <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider h-4 flex items-center gap-1 mb-1.5 truncate">
                            <span>Garment Product</span>
                            <span className="text-rose-500">*</span>
                          </label>
                          <SearchableSelect
                            options={productOptions}
                            value={row.productId}
                            onValueChange={(val) => {
                              setTargetProducts((prev) => {
                                const copy = [...prev];
                                copy[idx].productId = val;
                                copy[idx].variantId = '';
                                return copy;
                              });
                            }}
                            placeholder="Select finished garment product..."
                            searchPlaceholder="Search product by name..."
                            dark={isDark}
                            className="!h-10 min-h-[40px] max-h-[40px] text-xs"
                          />
                        </div>

                        {/* Variant Select (if available) */}
                        <div className="sm:col-span-3 relative overflow-visible flex flex-col">
                          <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider h-4 flex items-center gap-1 mb-1.5 truncate">
                            <span>Size / Variant</span>
                            <span className="text-slate-400 font-normal">(Optional)</span>
                          </label>
                          <SearchableSelect
                            options={variantOptions}
                            value={row.variantId || ''}
                            onValueChange={(val) => {
                              setTargetProducts((prev) => {
                                const copy = [...prev];
                                copy[idx].variantId = val;
                                return copy;
                              });
                            }}
                            placeholder="General..."
                            searchPlaceholder="Filter size / color..."
                            disabled={variantOptions.length === 0}
                            dark={isDark}
                            className="!h-10 min-h-[40px] max-h-[40px] text-xs"
                          />
                        </div>

                        {/* Output Quantity */}
                        <div className="sm:col-span-3 flex flex-col">
                          <label className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider h-4 flex items-center gap-1 mb-1.5 truncate">
                            <span>Finished Pcs</span>
                            <span className="text-rose-500">*</span>
                          </label>
                          <Input
                            type="number"
                            min="1"
                            step="1"
                            required
                            value={row.quantity}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTargetProducts((prev) => {
                                const copy = [...prev];
                                copy[idx].quantity = val === '' ? '' : Number(val);
                                return copy;
                              });
                            }}
                            placeholder="e.g. 50"
                            className="!h-10 min-h-[40px] max-h-[40px] text-xs rounded-xl bg-white dark:bg-zinc-950 border-emerald-300 dark:border-emerald-800 font-mono font-bold"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Optional Enhancement: Send directly to Wash Plant Toggle */}
            <div
              onClick={() => setSendToWashDirectly(!sendToWashDirectly)}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                sendToWashDirectly
                  ? 'bg-cyan-50/80 dark:bg-cyan-950/30 border-cyan-300 dark:border-cyan-800 shadow-xs'
                  : 'bg-slate-50/60 dark:bg-zinc-900/50 border-slate-200/80 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700'
              }`}
            >
              <input
                id="sendToWashDirectly"
                type="checkbox"
                checked={sendToWashDirectly}
                onChange={(e) => setSendToWashDirectly(e.target.checked)}
                className="size-4 mt-0.5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer accent-cyan-600 shrink-0"
              />
              <div className="flex-1">
                <label
                  htmlFor="sendToWashDirectly"
                  className="text-xs font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-1.5 cursor-pointer"
                >
                  <Waves className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
                  <span>Send directly to Wash Plant</span>
                </label>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 leading-normal">
                  Creates batch immediately with status <strong>WASHING</strong> and routes garment quantities directly into the Decoupled Wash Plant queue.
                </p>
              </div>
            </div>

            {/* Optional Notes */}
            <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-zinc-800">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block">
                Finishing Notes / Batch Remarks <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <Input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Completed today's production shift; raw materials to be logged tomorrow"
                className="h-10 text-xs rounded-xl bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800"
              />
            </div>
          </div>

          {/* Footer */}
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
              disabled={isSubmitting || totalOutputQuantity <= 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer h-9 px-4 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Recording Batch...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Record Finished Batch ({totalOutputQuantity} Pcs)</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default DirectFinishingModal;
