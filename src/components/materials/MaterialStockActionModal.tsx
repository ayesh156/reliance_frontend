import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { DateTimePicker } from '../ui/date-time-picker';
import { post, put } from '../../lib/api';
import { toast } from 'react-toastify';
import { Loader2, Scissors, CornerDownLeft, AlertTriangle } from 'lucide-react';
import type { RawMaterialItem } from '../../pages/RawMaterialItemsPage';

export interface MovementRecordToEdit {
  id: number;
  movementType: 'STOCK_IN' | 'PRODUCTION_USE' | 'SCRAP_RETURN' | 'DAMAGE_WASTE' | 'AUDIT_ADJUST';
  quantity: number;
  reference: string | null;
  createdAt: string;
}

interface MaterialStockActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  material: RawMaterialItem | null;
  mode: 'DEDUCT' | 'SCRAP_RETURN';
  editingMovement?: MovementRecordToEdit | null;
  onSuccess: () => void;
}

export const MaterialStockActionModal: React.FC<MaterialStockActionModalProps> = ({
  isOpen,
  onClose,
  material,
  mode,
  editingMovement = null,
  onSuccess,
}) => {
  // Helper function to get current local datetime in ISO format (YYYY-MM-DDTHH:mm)
  const getCurrentLocalISOString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const [quantity, setQuantity] = useState<string>('');
  const [reference, setReference] = useState<string>('');
  const [customDateTime, setCustomDateTime] = useState<string>(getCurrentLocalISOString());
  const [submitting, setSubmitting] = useState<boolean>(false);

  // ⭐ Modal open zalyavar pratyek veli tya kshanacha current time auto-fill hone
  useEffect(() => {
    if (isOpen) {
      if (editingMovement) {
        setQuantity(String(editingMovement.quantity));
        setReference(editingMovement.reference || '');
        const d = new Date(editingMovement.createdAt);
        const yr = d.getFullYear();
        const mo = String(d.getMonth() + 1).padStart(2, '0');
        const dy = String(d.getDate()).padStart(2, '0');
        const hr = String(d.getHours()).padStart(2, '0');
        const mn = String(d.getMinutes()).padStart(2, '0');
        setCustomDateTime(`${yr}-${mo}-${dy}T${hr}:${mn}`);
      } else {
        setCustomDateTime(getCurrentLocalISOString());
        setQuantity('');
        setReference('');
      }
    }
  }, [isOpen, editingMovement]);

  if (!material) return null;

  const isDeduct = mode === 'DEDUCT';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numQty = parseFloat(quantity);

    if (isNaN(numQty) || numQty <= 0) {
      toast.error('Please enter a valid positive quantity');
      return;
    }

    if (isDeduct && numQty > material.currentStock) {
      toast.error(`Cannot deduct more than current available stock (${material.currentStock} ${material.unit})`);
      return;
    }

    try {
      setSubmitting(true);

      if (editingMovement) {
        await put(`/raw-material-items/movements/${editingMovement.id}`, {
          quantity: numQty,
          reference: reference.trim() || undefined,
          customDate: customDateTime ? new Date(customDateTime).toISOString() : new Date().toISOString(),
        });
        toast.success('Movement record updated successfully');
      } else {
        const endpoint = isDeduct ? '/raw-material-items/deduct' : '/raw-material-items/scrap-return';
        
        await post(endpoint, {
          rawMaterialItemId: material.id,
          quantity: numQty,
          movementType: isDeduct ? 'PRODUCTION_USE' : undefined,
          reference: reference.trim() || undefined,
          customDate: customDateTime ? new Date(customDateTime).toISOString() : new Date().toISOString(),
        });

        toast.success(
          isDeduct
            ? `Successfully deducted ${numQty} ${material.unit} for production`
            : `Successfully returned ${numQty} ${material.unit} scrap to inventory`
        );
      }

      setQuantity('');
      setReference('');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {isDeduct ? (
              <Scissors className="size-5 text-amber-600" />
            ) : (
              <CornerDownLeft className="size-5 text-emerald-600" />
            )}
            <DialogTitle>
              {editingMovement
                ? 'Edit Stock Movement Record'
                : isDeduct
                ? 'Deduct Material for Production'
                : 'Return Scrap to Stock'}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Item: <strong className="text-slate-800 dark:text-zinc-200">{material.name}</strong> | Available Stock:{' '}
            <strong className="text-slate-800 dark:text-zinc-200 font-mono">
              {material.currentStock} {material.unit}
            </strong>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5 py-2">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
              Quantity ({material.unit}) *
            </label>
            <Input
              type="number"
              step="0.01"
              required
              max={isDeduct ? material.currentStock : undefined}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0.00"
              className="h-9 text-sm font-mono font-bold"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
              Date & Timestamp *
            </label>
            {/* ⭐ Unified Custom DatePicker + Shadcn Time Input */}
            <DateTimePicker
              value={customDateTime}
              onChange={setCustomDateTime}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
              Reference / Batch / Cut-piece Notes
            </label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={isDeduct ? 'e.g. Batch #42 - Cargo shorts cutting' : 'e.g. Lot 3 remaining cut pieces'}
              className="h-9 text-xs"
            />
          </div>

          {isDeduct && (
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-center gap-2 text-[11px] text-amber-800 dark:text-amber-300">
              <AlertTriangle className="size-4 shrink-0" />
              <span>Deductions will immediately update active warehouse inventory balance.</span>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting}
              className={
                isDeduct
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }
            >
              {submitting && <Loader2 className="size-3.5 animate-spin mr-1" />}
              {editingMovement
                ? 'Update Record'
                : isDeduct
                ? 'Confirm Deduction'
                : 'Add to Stock'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};