import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, ImageIcon, MoreVertical, Edit2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { SizeCombobox } from './SizeCombobox';
import { ColorCombobox } from './ColorCombobox';
import { VariantModal } from './VariantModal';
import type { VariantItem } from '../../types/product';

interface VariantTableProps {
  variants: VariantItem[];
  onChange: (variants: VariantItem[]) => void;
  productName: string;
  availableSizes?: { id: number; name: string }[];
  availableColors?: { id: number; name: string; hexCode?: string | null }[];
  // Catalog gallery photos available for direct variant assignment
  catalogImages?: string[];
  onSizeCreated?: (newSize: { id: number; name: string }) => void;
  onColorCreated?: (newColor: { id: number; name: string; hexCode?: string | null }) => void;
  // Callback to handle direct Ctrl+V clipboard paste on this variant row
  onVariantPaste?: (variantKey: string, e: React.ClipboardEvent) => void;
  dark?: boolean;
}

export const VariantTable: React.FC<VariantTableProps> = ({
  variants,
  onChange,
  productName,
  availableSizes = [],
  availableColors = [],
  catalogImages = [],
  onSizeCreated = () => {},
  onColorCreated = () => {},
  onVariantPaste,
  dark = true,
}) => {
  // Cleaned up: Floating popover states removed as image selection is handled inside VariantModal

  // Dedicated Modal State for adding/editing variant records
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeModalVariant, setActiveModalVariant] = useState<VariantItem | null>(null);

  /**
   * Open modal to create a fresh variant with auto-generated sequential SKU
   */
  const handleOpenAddModal = () => {
    const next = variants.length + 1;
    const cleanPrefix = (productName || 'PROD')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 4)
      .toUpperCase() || 'PROD';
    const paddedIndex = String(next).padStart(4, '0');

    setActiveModalVariant({
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
      imageUrl: '',
      imageUrls: [],
      imageIndexes: [],
    });
    setIsModalOpen(true);
  };

  /**
   * Open modal to edit existing variant details
   */
  const handleOpenEditModal = (variant: VariantItem) => {
    setActiveModalVariant({ ...variant });
    setIsModalOpen(true);
  };

  /**
   * Save modal changes back to the main variants list (Checks both database ID and client Key)
   */
  /**
   * Preserves database primary keys and triggers parent form dirty state for database persistence
   */
  /**
   * Synchronizes edited/created variant records with exact database ID bindings
   */
  const handleSaveModalVariant = (savedVariant: VariantItem) => {
    const existsIndex = variants.findIndex(v => 
      (savedVariant.id && v.id && Number(v.id) === Number(savedVariant.id)) || 
      (savedVariant.key && v.key && String(v.key) === String(savedVariant.key))
    );

    let nextVariants: VariantItem[];

    if (existsIndex > -1) {
      nextVariants = variants.map((item, idx) => {
        if (idx === existsIndex) {
          return {
            ...item,
            ...savedVariant,
            id: savedVariant.id ? Number(savedVariant.id) : item.id,
          };
        }
        return item;
      });
    } else {
      nextVariants = [...variants, savedVariant];
    }

    // Trigger parent form update with fresh immutable array
    onChange(nextVariants);
    setIsModalOpen(false);
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
        {/* Opens VariantModal to input new variant details cleanly */}
        <Button 
          size="sm" 
          type="button" 
          onClick={handleOpenAddModal} 
          className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
        >
          <Plus className="size-3.5" /> Add Variant
        </Button>
      </div>

    {/* Clean 1-Row Summary Table (100% Fit across Square & Widescreen Monitors) */}
      <div className="w-full overflow-hidden rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] uppercase font-semibold text-slate-500 dark:text-zinc-400 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/50">
              <th className="p-2 text-center w-8">#</th>
              <th className="p-2 text-center w-12">Photo</th>
              <th className="p-2 text-left">Variant (Click to Edit)</th>
              <th className="p-2 text-left">SKU</th>
              <th className="p-2 text-left">Barcode</th>
              <th className="p-2 text-right">Cost (Rs)</th>
              <th className="p-2 text-right">Wholesale (Rs)</th>
              <th className="p-2 text-right">Retail (Rs)</th>
              <th className="p-2 text-center">Stock</th>
              <th className="p-2 text-center w-14">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
            {variants.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-5 text-center text-slate-400 text-xs">
                  No variants added yet. Click <span className="font-semibold text-emerald-600">+ Add Variant</span> to configure options.
                </td>
              </tr>
            ) : (
              variants.map((v, index) => {
                const displayImg = (v.imageUrls && v.imageUrls[0]) || v.imageUrl;
                const apiHost = import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, '') || 'http://localhost:5000';
                const resolvedPhoto = displayImg
                  ? displayImg.startsWith('http') || displayImg.startsWith('data:')
                    ? displayImg
                    : `${apiHost}${displayImg.startsWith('/') ? '' : '/'}${displayImg}`
                  : null;

                return (
                  <tr key={v.key} className="hover:bg-slate-50/80 dark:hover:bg-zinc-900/40 transition-colors">
                    {/* Index */}
                    <td className="p-2 text-center font-mono text-[11px] font-bold text-slate-400">
                      #{index + 1}
                    </td>

                    {/* Photo Preview */}
                    <td className="p-2 text-center">
                      <div 
                        onClick={() => handleOpenEditModal(v)}
                        className="size-8 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-900 overflow-hidden flex items-center justify-center mx-auto cursor-pointer hover:border-emerald-500 transition-colors"
                      >
                        {resolvedPhoto ? (
                          <img src={resolvedPhoto} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="size-3.5 text-slate-400" />
                        )}
                      </div>
                    </td>

                    {/* Variant Name Badges (Clicking triggers Edit Modal) */}
                    <td className="p-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(v)}
                        className="font-bold text-slate-800 dark:text-zinc-200 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-1.5 transition-colors group cursor-pointer text-left"
                      >
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-[11px] font-medium border border-slate-200/60 dark:border-zinc-700/60">
                          {v.size || 'No Size'}
                        </span>
                        <span className="text-slate-400">/</span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-[11px] font-medium border border-slate-200/60 dark:border-zinc-700/60">
                          {v.color || 'No Color'}
                        </span>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                          (Edit)
                        </span>
                      </button>
                    </td>

                    {/* SKU */}
                    <td className="p-2 font-mono text-[11px] text-slate-600 dark:text-zinc-300">
                      {v.sku || '-'}
                    </td>

                    {/* Barcode */}
                    <td className="p-2 font-mono text-[11px] text-slate-500">
                      {v.barcode || '-'}
                    </td>

                    {/* Cost Price */}
                    <td className="p-2 text-right text-slate-500 dark:text-zinc-400 font-mono">
                      Rs. {Number(v.costPrice || 0).toLocaleString()}
                    </td>

                    {/* Wholesale Price */}
                    <td className="p-2 text-right font-semibold text-amber-600 dark:text-amber-400 font-mono">
                      Rs. {Number(v.wholesalePrice || 0).toLocaleString()}
                    </td>

                    {/* Retail Price */}
                    <td className="p-2 text-right font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      Rs. {Number(v.retailPrice || 0).toLocaleString()}
                    </td>

                    {/* Stock */}
                    <td className="p-2 text-center">
                      <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold ${
                        (v.stock || 0) > 0 
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400' 
                          : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400'
                      }`}>
                        {v.stock || 0}
                      </span>
                    </td>

                    {/* Action Column with Shadcn 3-Dots Dropdown Menu (modal={false} prevents layout shift / scroll lock) */}
                    <td className="p-2 text-center">
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            type="button"
                            variant="ghost" 
                            size="sm" 
                            className="size-7 p-0 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 cursor-pointer"
                          >
                            <MoreVertical className="size-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-32 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xl rounded-xl p-1 z-50">
                          <DropdownMenuItem
                            onClick={() => handleOpenEditModal(v)}
                            className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium cursor-pointer rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200"
                          >
                            <Edit2 className="size-3.5 text-slate-500" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => removeVariant(v.key)}
                            className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium cursor-pointer rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400"
                          >
                            <Trash2 className="size-3.5" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Render the Dedicated Variant Modal Dialog */}
      <VariantModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveModalVariant}
        variant={activeModalVariant}
        availableSizes={availableSizes}
        availableColors={availableColors}
        catalogImages={catalogImages}
        onSizeCreated={onSizeCreated}
        onColorCreated={onColorCreated}
        dark={dark}
      />
    </div>
  );
};