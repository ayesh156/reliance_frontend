import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { DateTimePicker } from '../ui/date-time-picker';
import { SearchableSelect, type SearchableSelectOption } from '../ui/searchable-select';
import { getProductImageUrl, getCurrentLocalDateTime, formatToLocalInputDateTime } from '../../lib/utils';
import { post, put } from '../../lib/api';
import { toast } from 'react-toastify';
import { Shirt, Package, Loader2, Calendar, Hash, Pencil, Sparkles } from 'lucide-react';

export interface FinishingProductItem {
  id: number;
  name: string;
  images?: Array<{ imageUrl?: string | null }>;
  variants?: Array<any>;
  isActive?: boolean;
}

export interface FinishingLogEditData {
  id: number;
  productId: number;
  actionType: 'IRON' | 'PACK';
  quantity: number;
  date: string;
}

interface FinishingModalProps {
  open: boolean;
  onClose: () => void;
  actionType: 'IRON' | 'PACK';
  onSuccess: () => void;
  products: FinishingProductItem[];
  editData?: FinishingLogEditData | null;
}

export const FinishingModal: React.FC<FinishingModalProps> = ({
  open,
  onClose,
  actionType,
  onSuccess,
  products,
  editData,
}) => {
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [dateTime, setDateTime] = useState<string>(getCurrentLocalDateTime());
  const [currentActionType, setCurrentActionType] = useState<'IRON' | 'PACK'>(actionType);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Sync form state whenever modal opens or editData/actionType changes
  useEffect(() => {
    if (open) {
      if (editData) {
        setSelectedProductId(String(editData.productId));
        setQuantity(String(editData.quantity));
        setDateTime(formatToLocalInputDateTime(editData.date));
        setCurrentActionType(editData.actionType);
      } else {
        setSelectedProductId('');
        setQuantity('');
        setDateTime(getCurrentLocalDateTime());
        setCurrentActionType(actionType);
      }
      setIsSubmitting(false);
    }
  }, [open, editData, actionType]);

  const isEdit = Boolean(editData);
  const isIron = currentActionType === 'IRON';

  // Product dropdown options with thumbnail image and name
  const productOptions: SearchableSelectOption[] = useMemo(() => {
    return products
      .filter((p) => p.isActive !== false)
      .map((p) => {
        const rawImg = p.images?.[0]?.imageUrl;
        const resolvedUrl = rawImg ? getProductImageUrl(rawImg) : undefined;
        return {
          value: String(p.id),
          label: p.name,
          imageUrl: resolvedUrl,
          icon: isIron ? (
            <Shirt className="size-4 text-blue-500 shrink-0" />
          ) : (
            <Package className="size-4 text-emerald-500 shrink-0" />
          ),
          subLabel: p.variants && p.variants.length > 0 ? `${p.variants.length} variant${p.variants.length > 1 ? 's' : ''}` : undefined,
        };
      });
  }, [products, isIron]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProductId) {
      toast.error('Please select a finished product');
      return;
    }

    const qtyNumber = parseInt(quantity, 10);
    if (isNaN(qtyNumber) || qtyNumber <= 0) {
      toast.error('Please enter a valid positive quantity');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        productId: Number(selectedProductId),
        actionType: currentActionType,
        quantity: qtyNumber,
        date: dateTime ? new Date(dateTime).toISOString() : new Date().toISOString(),
      };

      if (isEdit && editData) {
        await put(`/finishing/${editData.id}`, payload);
        toast.success('Finishing record updated successfully');
      } else {
        await post('/finishing', payload);
        const prodName = products.find((p) => String(p.id) === selectedProductId)?.name || 'garment';
        toast.success(
          isIron
            ? `Successfully logged ${qtyNumber.toLocaleString()} ironed pieces of ${prodName}!`
            : `Successfully logged ${qtyNumber.toLocaleString()} packed pieces of ${prodName}!`
        );
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || `Failed to ${isEdit ? 'update' : 'log'} finishing record`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto sm:overflow-visible p-5 sm:p-6 rounded-2xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 shadow-xl">
        <DialogHeader className="space-y-1.5 pb-2 border-b border-slate-100 dark:border-zinc-800/80">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl shrink-0 ${
                isIron
                  ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40'
                  : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40'
              }`}
            >
              {isEdit ? (
                <Pencil className="size-5" />
              ) : isIron ? (
                <Shirt className="size-5" />
              ) : (
                <Package className="size-5" />
              )}
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-zinc-100">
                {isEdit
                  ? isIron
                    ? 'Edit Ironed'
                    : 'Edit Packed'
                  : isIron
                  ? 'Add Ironed'
                  : 'Add Packed'}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-zinc-400">
                {isEdit
                  ? `Update finishing record #${editData?.id} details`
                  : isIron
                  ? 'Track ironed, pressed, and quality-inspected garments'
                  : 'Track folded, tagged, and packed garments ready for inventory'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-3">
          {/* Action Type Selector (Available in Edit mode for flexibility) */}
          {isEdit && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-slate-400" />
                <span>Action Type</span>
                <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-zinc-900 rounded-xl">
                <button
                  type="button"
                  onClick={() => setCurrentActionType('IRON')}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isIron
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Shirt className="size-3.5" />
                  <span>Ironed (IRON)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentActionType('PACK')}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    !isIron
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Package className="size-3.5" />
                  <span>Packed (PACK)</span>
                </button>
              </div>
            </div>
          )}

          {/* Date & Time Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
              <Calendar className="size-3.5 text-slate-400" />
              <span>Date &amp; Time</span>
              <span className="text-rose-500">*</span>
            </label>
            <DateTimePicker
              value={dateTime}
              onChange={setDateTime}
              className="w-full"
            />
          </div>

          {/* Product Selector and Inline Quantity */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            {/* Product Combobox (Takes 2 cols on tablet/desktop) */}
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                {isIron ? (
                  <Shirt className="size-3.5 text-blue-500" />
                ) : (
                  <Package className="size-3.5 text-emerald-500" />
                )}
                <span>Finished Product</span>
                <span className="text-rose-500">*</span>
              </label>
              <SearchableSelect
                options={productOptions}
                value={selectedProductId}
                onValueChange={setSelectedProductId}
                placeholder="Select finished garment..."
                searchPlaceholder="Search product by name..."
                emptyMessage="No matching products found"
                usePortal={true}
              />
            </div>

            {/* Quantity Input (Takes 1 col directly next to product selector) */}
            <div className="sm:col-span-1 space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Hash className="size-3.5 text-slate-400" />
                <span>Quantity (Pcs)</span>
                <span className="text-rose-500">*</span>
              </label>
              <Input
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g. 150"
                className="h-10 text-xs font-mono font-medium rounded-xl bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 focus:border-indigo-500"
                required
              />
            </div>
          </div>

          <DialogFooter className="pt-4 border-t border-slate-100 dark:border-zinc-800/80 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto h-9 text-xs rounded-xl border-slate-200 dark:border-zinc-800 font-medium"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className={`w-full sm:w-auto h-9 text-xs font-semibold rounded-xl text-white shadow-xs gap-1.5 cursor-pointer ${
                isIron
                  ? 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700'
                  : 'bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>{isEdit ? 'Updating...' : 'Saving...'}</span>
                </>
              ) : isEdit ? (
                <>
                  <Pencil className="size-3.5" />
                  <span>Update Changes</span>
                </>
              ) : isIron ? (
                <>
                  <Shirt className="size-3.5" />
                  <span>Save Ironed</span>
                </>
              ) : (
                <>
                  <Package className="size-3.5" />
                  <span>Save Packed</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default FinishingModal;
