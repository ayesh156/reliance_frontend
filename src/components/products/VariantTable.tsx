import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import type { VariantItem } from '../../types/product';

interface VariantTableProps {
  variants: VariantItem[];
  onChange: (variants: VariantItem[]) => void;
  productName: string;
}

export const VariantTable: React.FC<VariantTableProps> = ({ variants, onChange, productName }) => {
 const addVariant = () => {
    const next = variants.length + 1;
    const cleanPrefix = (productName || 'PROD')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 4)
      .toUpperCase() || 'PROD';
    const paddedIndex = String(next).padStart(4, '0');

    onChange([
      ...variants,
      {
        key: `var-${Date.now()}-${next}`,
        size: '',
        color: '',
        sku: `${cleanPrefix}-${paddedIndex}`,
        barcode: '',
        costPrice: 0,
        retailPrice: 0,
        wholesalePrice: 0,
        comparePrice: 0,
        stock: 0,
      },
    ]);
  };

  const removeVariant = (key: string) => {
    if (variants.length <= 1) return;
    onChange(variants.filter(v => v.key !== key));
  };

  const updateField = (key: string, field: keyof VariantItem, value: any) => {
    onChange(variants.map(v => (v.key === key ? { ...v, [field]: value } : v)));
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 bg-slate-50/50 dark:bg-zinc-950/40">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-zinc-800">
        <div>
          <h4 className="text-xs font-bold">Variant &amp; Multi-Price Matrix</h4>
          <p className="text-[10px] text-slate-500 dark:text-zinc-400">Configure Barcodes, Retail (POS) and Wholesale pricing</p>
        </div>
        <Button size="sm" type="button" onClick={addVariant} className="h-7 text-xs gap-1">
          <Plus className="size-3.5" /> Add Variant
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] uppercase font-semibold text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-800">
              <th className="p-1.5 text-left">Size</th>
              <th className="p-1.5 text-left">Color</th>
              <th className="p-1.5 text-left">SKU *</th>
              <th className="p-1.5 text-left">Barcode (EAN)</th>
              <th className="p-1.5 text-left">Retail (Rs) *</th>
              <th className="p-1.5 text-left">Wholesale (Rs)</th>
              <th className="p-1.5 text-left">Compare (Rs)</th>
              <th className="p-1.5 text-left">Cost (Rs)</th>
              <th className="p-1.5 text-left">Stock</th>
              <th className="p-1.5 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-zinc-800/60">
            {variants.map(v => (
              <tr key={v.key}>
                <td className="p-1">
                  <Input 
                    value={v.size || ''} 
                    placeholder="M"
                    onFocus={handleFocus}
                    onChange={e => updateField(v.key, 'size', e.target.value)} 
                    className="w-16 h-8 text-center" 
                  />
                </td>
                <td className="p-1">
                  <Input 
                    value={v.color || ''} 
                    placeholder="Black"
                    onFocus={handleFocus}
                    onChange={e => updateField(v.key, 'color', e.target.value)} 
                    className="w-20 h-8 text-center" 
                  />
                </td>
                <td className="p-1">
                  <Input 
                    value={v.sku} 
                    onFocus={handleFocus}
                    onChange={e => updateField(v.key, 'sku', e.target.value)} 
                    className="w-28 h-8 font-mono text-[11px]" 
                  />
                </td>
                <td className="p-1">
                  <Input 
                    value={v.barcode || ''} 
                    onFocus={handleFocus}
                    onChange={e => updateField(v.key, 'barcode', e.target.value)} 
                    placeholder="Scan Barcode" 
                    className="w-28 h-8 font-mono text-[11px]" 
                  />
                </td>
                <td className="p-1">
                  <Input 
                    type="number" 
                    value={v.retailPrice === 0 ? '' : v.retailPrice} 
                    placeholder="0"
                    onFocus={handleFocus}
                    onChange={e => updateField(v.key, 'retailPrice', parseFloat(e.target.value) || 0)} 
                    className="w-20 h-8 text-emerald-600 font-semibold" 
                  />
                </td>
                <td className="p-1">
                  <Input 
                    type="number" 
                    value={v.wholesalePrice === 0 ? '' : v.wholesalePrice} 
                    placeholder="0"
                    onFocus={handleFocus}
                    onChange={e => updateField(v.key, 'wholesalePrice', parseFloat(e.target.value) || 0)} 
                    className="w-20 h-8 text-amber-600 font-semibold" 
                  />
                </td>
                <td className="p-1">
                  <Input 
                    type="number" 
                    value={!v.comparePrice ? '' : v.comparePrice} 
                    placeholder="Old" 
                    onFocus={handleFocus}
                    onChange={e => updateField(v.key, 'comparePrice', parseFloat(e.target.value) || 0)} 
                    className="w-18 h-8 opacity-75" 
                  />
                </td>
                <td className="p-1">
                  <Input 
                    type="number" 
                    value={v.costPrice === 0 ? '' : v.costPrice} 
                    placeholder="0"
                    onFocus={handleFocus}
                    onChange={e => updateField(v.key, 'costPrice', parseFloat(e.target.value) || 0)} 
                    className="w-18 h-8 text-slate-500" 
                  />
                </td>
                <td className="p-1">
                  <Input 
                    type="number" 
                    value={v.stock === 0 ? '' : v.stock} 
                    placeholder="0"
                    onFocus={handleFocus}
                    onChange={e => updateField(v.key, 'stock', parseInt(e.target.value, 10) || 0)} 
                    className="w-16 h-8 text-center font-bold" 
                  />
                </td>
                <td className="p-1 text-center">
                  <button type="button" onClick={() => removeVariant(v.key)} className="p-1 text-rose-500 hover:bg-rose-500/10 rounded-lg">
                    <Trash2 className="size-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};