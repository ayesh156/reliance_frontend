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
import { getProductImageUrl, getCurrentLocalDateTime, getCurrentDateFormattedYYYYMMDD } from '../../lib/utils';
import { get, post } from '../../lib/api';
import { toast } from 'react-toastify';
import {
  Shirt,
  Calendar,
  Loader2,
  Layers,
  Sparkles,
  ArrowRight,
  Info,
  Plus,
  Trash2,
  RefreshCw,
  Clock,
  Package,
} from 'lucide-react';

export interface CreateLineBatchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productsList?: any[];
  dark?: boolean;
  onSuccess?: () => void;
}

interface ProductDispatchRow {
  rowId: string;
  productId: string;
  variantId: string;
  sentQty: number | '';
}

export const CreateLineBatchModal: React.FC<CreateLineBatchModalProps> = ({
  open,
  onOpenChange,
  productsList = [],
  dark = false,
  onSuccess,
}) => {
  const [batchNumber, setBatchNumber] = useState<string>('');
  const [generatingBatchNo, setGeneratingBatchNo] = useState<boolean>(false);
  const [lineDateTime, setLineDateTime] = useState<string>(getCurrentLocalDateTime());
  const [lineNotes, setLineNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const [productRows, setProductRows] = useState<ProductDispatchRow[]>([
    {
      rowId: 'row-1',
      productId: '',
      variantId: '',
      sentQty: '',
    },
  ]);

  // Auto-generate next batch number when opening in create mode
  const fetchNextBatchNumber = async () => {
    setGeneratingBatchNo(true);
    try {
      const res = await get<any>('/production/next-batch-number');
      const data = res?.data || res;
      if (data?.productionNo) {
        setBatchNumber(data.productionNo);
      }
    } catch {
      const dateStr = getCurrentDateFormattedYYYYMMDD();
      const rand = Math.floor(100 + Math.random() * 900);
      setBatchNumber(`PRD-${dateStr}-${rand}`);
    } finally {
      setGeneratingBatchNo(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchNextBatchNumber();
      setLineDateTime(getCurrentLocalDateTime());
      setLineNotes('');
      setProductRows([
        {
          rowId: 'row-1',
          productId: '',
          variantId: '',
          sentQty: '',
        },
      ]);
    }
  }, [open]);

  // Product options for SearchableSelect
  const productOptions: SearchableSelectOption[] = useMemo(() => {
    return productsList.map((p) => {
      const rawImage = p.images?.[0]?.imageUrl || p.image;
      const resolvedUrl = rawImage ? getProductImageUrl(rawImage) : null;
      return {
        value: String(p.id),
        label: p.name,
        icon: resolvedUrl ? (
          <img
            src={resolvedUrl}
            alt={p.name}
            className="size-6 rounded-md object-cover border border-slate-200 dark:border-zinc-700 shrink-0"
          />
        ) : (
          <Package className="size-4 text-slate-400 shrink-0" />
        ),
      };
    });
  }, [productsList]);

  // Add target product row
  const handleAddProductRow = () => {
    setProductRows((prev) => [
      ...prev,
      {
        rowId: `row-${Date.now()}-${Math.random()}`,
        productId: '',
        variantId: '',
        sentQty: '',
      },
    ]);
  };

  // Remove target product row
  const handleRemoveProductRow = (index: number) => {
    setProductRows((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Update target product row field
  const handleProductRowChange = (
    index: number,
    field: keyof ProductDispatchRow,
    value: any
  ) => {
    setProductRows((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };

      if (field === 'productId') {
        const prod = productsList.find((p) => String(p.id) === String(value));
        if (prod?.variants?.[0]?.id) {
          updated[index].variantId = String(prod.variants[0].id);
        } else {
          updated[index].variantId = '';
        }
      }

      return updated;
    });
  };

  // Total Dispatched Units
  const totalSentQty = useMemo(() => {
    return productRows.reduce((sum, r) => {
      const q = typeof r.sentQty === 'number' && !isNaN(r.sentQty) ? r.sentQty : 0;
      return sum + q;
    }, 0);
  }, [productRows]);

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!batchNumber.trim()) {
      toast.warn('Please enter or generate a production batch number');
      return;
    }

    const items = productRows
      .filter((r) => r.productId && typeof r.sentQty === 'number' && r.sentQty > 0)
      .map((r) => ({
        productId: Number(r.productId),
        variantId: r.variantId ? Number(r.variantId) : null,
        sentQty: Number(r.sentQty),
      }));

    if (items.length === 0) {
      toast.warn('Please select at least one product with a dispatched quantity greater than 0');
      return;
    }

    setIsSubmitting(true);
    try {
      const formattedDate = lineDateTime
        ? new Date(lineDateTime).toISOString()
        : new Date().toISOString();

      await post<any>('/production/line-batch', {
        productionNo: batchNumber.trim(),
        productionDate: formattedDate,
        notes: lineNotes.trim() || undefined,
        items,
      });

      toast.success(
        `Batch #${batchNumber} created and dispatched directly to Sewing Line with ${totalSentQty} pcs!`
      );
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to dispatch batch to line');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] sm:max-w-2xl lg:max-w-3xl max-h-[92vh] flex flex-col p-0 gap-0 rounded-2xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 shadow-2xl">
        {/* Header */}
        <DialogHeader className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-950 z-10 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-900/50 shadow-xs">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                  <span>Send to Line (Direct Batch Dispatch)</span>
                </DialogTitle>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Direct Line-First creation · Fabric cutting can be recorded retroactively
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 text-indigo-800 dark:text-indigo-300 shadow-2xs shrink-0">
              <Shirt className="size-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
              <div className="text-right">
                <div className="text-[9px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  LINE INTAKE
                </div>
                <div className="text-xs sm:text-sm font-extrabold font-mono leading-none">
                  {totalSentQty} Pcs
                </div>
              </div>
            </div>
          </div>

          {/* Batch Number & Date Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Batch Number */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                  Production Batch Number <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={fetchNextBatchNumber}
                  disabled={generatingBatchNo}
                  className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${generatingBatchNo ? 'animate-spin' : ''}`} />
                  <span>Auto-Gen</span>
                </button>
              </div>
              <Input
                type="text"
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                placeholder="e.g. PRD-261022001"
                className="h-9 text-xs font-mono font-bold bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800"
              />
            </div>

            {/* Date & Time Picker */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                  Line Dispatch Date &amp; Time
                </label>
                <button
                  type="button"
                  onClick={() => setLineDateTime(getCurrentLocalDateTime())}
                  className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Clock className="w-3 h-3" />
                  <span>Now</span>
                </button>
              </div>
              <DateTimePicker
                value={lineDateTime}
                onChange={setLineDateTime}
              />
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 pb-4 sm:pb-5 space-y-4">
            {/* Info Banner */}
            <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-900/50 text-indigo-950 dark:text-indigo-200 text-xs flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-semibold block">Line-First Dispatch Workflow:</span>
                <p className="text-[11px] text-indigo-800/80 dark:text-indigo-300/80">
                  This batch will be immediately sent to the <strong>Sewing Line</strong> floor. Operators can start stitching garments right away. Later, raw fabric rolls and cutting logs can be allocated retroactively by clicking <strong>Edit Cutting</strong> in the batch options menu.
                </p>
              </div>
            </div>

            {/* Target Products Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Shirt className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Target Garment Products &amp; Dispatch Quantities ({productRows.length})</span>
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddProductRow}
                  className="h-7 text-xs gap-1.5 rounded-lg border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer font-semibold shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Product</span>
                </Button>
              </div>

              <div className="space-y-2.5">
                {productRows.map((row, idx) => {
                  const selectedProduct = productsList.find((p) => String(p.id) === String(row.productId));
                  const rawImage = selectedProduct?.images?.[0]?.imageUrl || selectedProduct?.image;
                  const resolvedImg = rawImage ? getProductImageUrl(rawImage) : null;

                  return (
                    <div
                      key={row.rowId}
                      className="p-3 bg-slate-50/90 dark:bg-zinc-900/60 rounded-xl border border-slate-200/90 dark:border-zinc-800 space-y-2.5 shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                          Product #{idx + 1}
                        </span>
                        {productRows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveProductRow(idx)}
                            className="text-slate-400 hover:text-rose-600 transition-colors p-1 rounded-md cursor-pointer"
                            title="Remove product row"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                        {/* Product Selector */}
                        <div className="sm:col-span-8 space-y-1">
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                            Garment Product <span className="text-rose-500">*</span>
                          </label>
                          <SearchableSelect
                            options={productOptions}
                            value={row.productId}
                            onValueChange={(val: string) => handleProductRowChange(idx, 'productId', val)}
                            placeholder="Select garment product style..."
                            searchPlaceholder="Search product by name, SKU..."
                            dark={dark}
                            className="h-10 text-xs"
                          />
                        </div>

                        {/* Dispatch Quantity Input */}
                        <div className="sm:col-span-4 space-y-1">
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                            Dispatched Line Qty (Pcs) <span className="text-rose-500">*</span>
                          </label>
                          <Input
                            type="number"
                            min="1"
                            step="1"
                            value={row.sentQty}
                            onChange={(e) =>
                              handleProductRowChange(
                                idx,
                                'sentQty',
                                e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 0)
                              )
                            }
                            placeholder="0"
                            className="h-10 text-xs font-mono font-bold text-indigo-700 dark:text-indigo-300 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-right pr-3"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Optional Dispatch Notes */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block">
                Dispatch Remarks &amp; Floor Notes <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <Input
                type="text"
                value={lineNotes}
                onChange={(e) => setLineNotes(e.target.value)}
                placeholder="e.g. Dispatched to Line 1 for immediate assembly"
                className="h-9 text-xs rounded-xl bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800"
              />
            </div>
          </div>

          {/* Footer */}
          <DialogFooter className="px-5 py-3 border-t border-slate-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-950 flex-row justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs rounded-xl cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || totalSentQty <= 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-xl font-semibold shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Dispatching to Line...</span>
                </>
              ) : (
                <>
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>Dispatch to Sewing Line ({totalSentQty} Pcs)</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateLineBatchModal;
