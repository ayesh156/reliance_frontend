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
import { SearchableSelect } from '../ui/SearchableSelect';
import { post, get } from '../../lib/api';
import { toast } from 'react-toastify';
import { Boxes, Sparkles, X, Loader2 } from 'lucide-react';

interface QuickAddMaterialModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMaterialCreated: (material: {
    id: number;
    name: string;
    code: string | null;
    unit: string;
    currentStock: number;
    unitCostAverage: number;
  }) => void;
  dark?: boolean;
}

const UNITS = ['METERS', 'YARDS', 'KILOGRAMS', 'PCS', 'ROLLS', 'CONES', 'PACKS'];

export const QuickAddMaterialModal: React.FC<QuickAddMaterialModalProps> = ({
  open,
  onOpenChange,
  onMaterialCreated,
  dark = false,
}) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [unit, setUnit] = useState('METERS');
  const [alertThreshold, setAlertThreshold] = useState<number | ''>(10);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);

  // Auto-generate code handler directly from DB
  const handleFetchNextCode = async () => {
    try {
      setGeneratingCode(true);
      const res = await get<{ code: string }>('/raw-material-items/next-code');
      setCode(res?.code || 'RM-0001');
    } catch {
      setCode('RM-0001');
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Material name is required');
      return;
    }

    setLoading(true);
    try {
      const created = await post<any>('/raw-material-items', {
        name: name.trim(),
        code: code.trim() || undefined,
        unit,
        alertThreshold: alertThreshold === '' ? 10 : Number(alertThreshold),
        description: description.trim() || undefined,
      });

      toast.success(`Material "${created.name}" created!`);
      onMaterialCreated({
        id: created.id,
        name: created.name,
        code: created.code,
        unit: created.unit,
        currentStock: created.currentStock || 0,
        unitCostAverage: created.unitCostAverage || 0,
      });

      onOpenChange(false);
      setName('');
      setCode('');
      setUnit('METERS');
      setDescription('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create material item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Boxes className="size-4 text-indigo-600" /> Quick Add Material Item
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 py-1">
          <div className="space-y-1">
            <label className="text-xs font-semibold">Material Name *</label>
            <Input
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Denim Fabric 12oz"
              className="h-9 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Item Code</label>
              <div className="relative flex items-center">
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. RM-0001"
                  className="h-9 text-xs pr-8 font-mono uppercase"
                />
                {code.trim() ? (
                  <button
                    type="button"
                    onClick={() => setCode('')}
                    className="absolute right-2 text-slate-400 hover:text-rose-500"
                  >
                    <X className="size-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={generatingCode}
                    onClick={handleFetchNextCode}
                    className="absolute right-2 text-indigo-600 hover:text-indigo-700"
                    title="Auto generate code"
                  >
                    {generatingCode ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold">Unit</label>
              <SearchableSelect
                value={unit}
                onValueChange={setUnit}
                options={UNITS.map((u) => ({ value: u, label: u }))}
                placeholder="Select Unit"
                dark={dark}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold">Alert Threshold</label>
            <Input
              type="number"
              min="0"
              value={alertThreshold}
              onChange={(e) => setAlertThreshold(e.target.value ? Number(e.target.value) : '')}
              placeholder="10"
              className="h-9 text-xs"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
              {loading && <Loader2 className="size-3.5 animate-spin mr-1.5" />} Save Material
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};