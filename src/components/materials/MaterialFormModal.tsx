import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { post, get } from '../../lib/api';
import { toast } from 'react-toastify';
import { Boxes, Sparkles, X, Loader2, Layers, DollarSign, AlertCircle } from 'lucide-react';
import { SearchableSelect } from '../ui/searchable-select';

export interface CreatedMaterialResult {
  id: number;
  name: string;
  code: string | null;
  unit: string;
  currentStock: number;
  unitCostAverage: number;
  alertThreshold?: number;
  description?: string;
}

interface MaterialFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMaterialCreated: (material: CreatedMaterialResult) => void;
  dark?: boolean;
}

const UNIT_OPTIONS = [
  { value: 'METERS', label: 'Meters (m)' },
  { value: 'YARDS', label: 'Yards (yd)' },
  { value: 'KILOGRAMS', label: 'Kilograms (kg)' },
  { value: 'PCS', label: 'Pieces (pcs)' },
  { value: 'ROLLS', label: 'Rolls' },
  { value: 'CONES', label: 'Cones' },
  { value: 'PACKS', label: 'Packs' },
];

/**
 * Enterprise Material Creation Modal with Initial Stock Addition Capabilities.
 * Allows instant inline creation of raw materials directly from Cutting/Production
 * without leaving the page or losing existing form state.
 */
export const MaterialFormModal: React.FC<MaterialFormModalProps> = ({
  open,
  onOpenChange,
  onMaterialCreated,
  dark = false,
}) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [unit, setUnit] = useState('METERS');
  const [currentStock, setCurrentStock] = useState<number | ''>('');
  const [unitCostAverage, setUnitCostAverage] = useState<number | ''>('');
  const [alertThreshold, setAlertThreshold] = useState<number | ''>(10);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);

  // Auto-generate next item code from backend sequence
  const handleFetchNextCode = async () => {
    try {
      setGeneratingCode(true);
      const res = await get<{ code: string }>('/raw-material-items/next-code');
      setCode(res?.code || 'RM-0001');
    } catch {
      setCode(`RM-${Math.floor(1000 + Math.random() * 9000)}`);
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleReset = () => {
    setName('');
    setCode('');
    setUnit('METERS');
    setCurrentStock('');
    setUnitCostAverage('');
    setAlertThreshold(10);
    setDescription('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Material name is required');
      return;
    }

    setLoading(true);
    try {
      const stockNum = currentStock === '' ? 0 : Math.max(0, Number(currentStock));
      const costNum = unitCostAverage === '' ? 0 : Math.max(0, Number(unitCostAverage));
      const thresholdNum = alertThreshold === '' ? 10 : Math.max(0, Number(alertThreshold));

      const created = await post<any>('/raw-material-items', {
        name: name.trim(),
        code: code.trim() || undefined,
        unit,
        currentStock: stockNum,
        unitCostAverage: costNum,
        alertThreshold: thresholdNum,
        description: description.trim() || undefined,
      });

      toast.success(
        `Material "${created.name}" created successfully${
          stockNum > 0 ? ` with ${stockNum} ${unit} initial stock!` : '!'
        }`
      );

      onMaterialCreated({
        id: created.id,
        name: created.name,
        code: created.code,
        unit: created.unit,
        currentStock: Number(created.currentStock) || stockNum,
        unitCostAverage: Number(created.unitCostAverage) || costNum,
        alertThreshold: created.alertThreshold,
        description: created.description,
      });

      handleReset();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create raw material item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-lg sm:max-w-xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 rounded-2xl">
        <DialogHeader className="pb-3 border-b border-slate-200 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                <Layers className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">
                  Add New Raw Material
                </DialogTitle>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Quickly register fabric / accessories and add initial warehouse stock
                </p>
              </div>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-3">
          {/* Material Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
              Material Name <span className="text-rose-500">*</span>
            </label>
            <Input
              required
              placeholder="e.g. 100% Cotton Denim 12oz, Rib Knit, Black Pocketing"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 text-xs"
              autoFocus
            />
          </div>

          {/* Item Code & Generate Button */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Item Code / Reference (Optional)
              </label>
              <button
                type="button"
                onClick={handleFetchNextCode}
                disabled={generatingCode}
                className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                {generatingCode ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Sparkles className="size-3" />
                )}
                <span>Auto-Generate Code</span>
              </button>
            </div>
            <Input
              placeholder="e.g. RM-DNM-001 or click Auto-Generate"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="h-9 text-xs font-mono uppercase"
            />
          </div>

          {/* Unit of Measurement */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
              Unit of Measurement <span className="text-rose-500">*</span>
            </label>
            <SearchableSelect
              options={UNIT_OPTIONS}
              value={unit}
              onValueChange={setUnit}
              placeholder="Select measurement unit..."
              searchPlaceholder="Filter units..."
              dark={dark}
              className="h-9 text-xs"
            />
          </div>

          {/* Initial Warehouse Stock Addition Capabilities */}
          <div className="p-3.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 space-y-3">
            <div className="flex items-center gap-2">
              <Boxes className="size-4 text-amber-600 dark:text-amber-400" />
              <h5 className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wide">
                Initial Stock &amp; Cost Allocation
              </h5>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Initial Stock */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300">
                  Opening Stock Quantity ({unit})
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    placeholder="0.00"
                    value={currentStock}
                    onChange={(e) =>
                      setCurrentStock(e.target.value === '' ? '' : parseFloat(e.target.value))
                    }
                    className="h-9 text-xs font-mono pr-14"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono font-bold text-slate-400 uppercase pointer-events-none">
                    {unit}
                  </span>
                </div>
              </div>

              {/* Unit Cost Average */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300">
                  Unit Cost (Rs.)
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400 pointer-events-none">
                    Rs.
                  </span>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    placeholder="0.00"
                    value={unitCostAverage}
                    onChange={(e) =>
                      setUnitCostAverage(e.target.value === '' ? '' : parseFloat(e.target.value))
                    }
                    className="h-9 text-xs font-mono pl-9"
                  />
                </div>
              </div>
            </div>

            <p className="text-[10px] text-amber-700/80 dark:text-amber-300/70">
              Entering opening stock immediately adds available yardage/units for cutting allocations.
            </p>
          </div>

          {/* Alert Threshold & Description */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Low Stock Alert Threshold
              </label>
              <Input
                type="number"
                min={0}
                placeholder="10"
                value={alertThreshold}
                onChange={(e) =>
                  setAlertThreshold(e.target.value === '' ? '' : parseInt(e.target.value, 10))
                }
                className="h-9 text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Description / Color Notes
              </label>
              <Input
                placeholder="e.g. Navy Blue Shade #04"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="pt-3 border-t border-slate-200 dark:border-zinc-800 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="text-xs h-9 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !name.trim()}
              className="text-xs h-9 gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold cursor-pointer shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Saving Material...</span>
                </>
              ) : (
                <>
                  <Boxes className="size-3.5" />
                  <span>Create Material &amp; Select</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
