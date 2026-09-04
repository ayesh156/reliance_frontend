import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, ImageIcon } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { SizeCombobox } from './SizeCombobox';
import { ColorCombobox } from './ColorCombobox';
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
  // Key of the variant row currently showing the image selection popover
  const [activeImagePickerKey, setActiveImagePickerKey] = useState<string | null>(null);
  // Viewport coordinates for Portal rendering above table overflows
  const [pickerCoords, setPickerCoords] = useState<{ top: number; left: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  /**
   * Close photo popover when clicking outside
   */
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setActiveImagePickerKey(null);
      }
    };
    if (activeImagePickerKey) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [activeImagePickerKey]);

  /**
   * Append new variant row with sequential SKU
   */
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

      <div className="overflow-x-auto overflow-y-visible pb-12">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] uppercase font-semibold text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-800">
              <th className="p-1.5 text-center w-8">#</th>
              <th className="p-1.5 text-center w-12">Photo</th>
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
            {variants.map((v, index) => (
              <tr key={v.key}>
                {/* Variant Sequence Number */}
                <td className="p-1 text-center font-mono text-[11px] font-bold text-slate-400">
                  #{index + 1}
                </td>

                {/* Variant Image Selector Cell (Supports Click popover & direct Ctrl+V clipboard paste) */}
                <td className="p-1 text-center">
                  <button
                    type="button"
                    tabIndex={0}
                    onPaste={(e) => onVariantPaste && onVariantPaste(v.key, e)}
                    onClick={(e) => {
                      if (activeImagePickerKey === v.key) {
                        setActiveImagePickerKey(null);
                      } else {
                        const rect = e.currentTarget.getBoundingClientRect();
                        // Open above or below based on viewport space
                        const openUpwards = window.innerHeight - rect.bottom < 200;
                        setPickerCoords({
                          top: openUpwards ? rect.top - 170 : rect.bottom + 6,
                          left: rect.left,
                        });
                        setActiveImagePickerKey(v.key);
                      }
                    }}
                    title="Click to pick photo or press Ctrl+V to paste directly into this variant"
                    className={`size-8 rounded-lg border overflow-hidden flex items-center justify-center transition-all outline-none focus:ring-2 focus:ring-emerald-500 ${
                      activeImagePickerKey === v.key
                        ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-900 hover:border-emerald-500'
                    }`}
                  >
                    {(() => {
                      const displayImg = (v.imageUrls && v.imageUrls[0]) || v.imageUrl;
                      const count = (v.imageUrls && v.imageUrls.length) || (v.imageUrl ? 1 : 0);

                      if (!displayImg) return <ImageIcon className="size-3.5 text-slate-400" />;

                      const src = displayImg.startsWith('http') || displayImg.startsWith('data:')
                        ? displayImg
                        : `${import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, '') || 'http://localhost:5000'}${
                            displayImg.startsWith('/') ? '' : '/'
                          }${displayImg}`;

                      return (
                        <div className="relative w-full h-full">
                          <img src={src} alt="" className="w-full h-full object-cover" />
                          {count > 1 && (
                            <span className="absolute bottom-0 right-0 bg-emerald-600 text-white font-mono text-[8px] font-bold px-1 rounded-tl">
                              {count}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </button>
                </td>

                <td className="p-1 min-w-[100px]">
                  <SizeCombobox
                    sizes={availableSizes}
                    value={v.size || ''}
                    onChange={(val) => updateField(v.key, 'size', val)}
                    onSizeCreated={onSizeCreated}
                    dark={dark}
                  />
                </td>
                <td className="p-1 min-w-[120px]">
                  <ColorCombobox
                    colors={availableColors}
                    value={v.color || ''}
                    onChange={(val) => updateField(v.key, 'color', val)}
                    onColorCreated={onColorCreated}
                    dark={dark}
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

      {/* Floating Photo Popover rendered via React Portal directly into body */}
      {activeImagePickerKey && pickerCoords && createPortal(
        <div
          ref={popoverRef}
          style={{
            position: 'fixed',
            top: pickerCoords.top,
            left: pickerCoords.left,
            zIndex: 99999,
          }}
          className="p-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl w-60 space-y-2 animate-in fade-in-0 zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-zinc-300 border-b border-slate-100 dark:border-zinc-800 pb-1.5">
            <span>Assign Variant Photo</span>
            {(() => {
              const activeVar = variants.find(v => v.key === activeImagePickerKey);
              const hasAssignedImg = Boolean(activeVar?.imageUrl || (activeVar?.imageUrls && activeVar.imageUrls.length > 0));

              return hasAssignedImg ? (
                <button
                  type="button"
                  onClick={() => {
                    onChange(
                      variants.map(v =>
                        v.key === activeImagePickerKey
                          ? { ...v, imageUrl: undefined, imageUrls: [], imageIndexes: [] }
                          : v
                      )
                    );
                    setActiveImagePickerKey(null);
                  }}
                  className="text-rose-500 hover:text-rose-600 text-[10px] hover:underline"
                >
                  Clear Photo
                </button>
              ) : null;
            })()}
          </div>

          {catalogImages.length === 0 ? (
            <p className="text-[10px] text-slate-400 py-3 text-center">
              No photos uploaded in "Catalog Images" yet.
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-1.5 max-h-40 overflow-y-auto pr-1">
              {catalogImages.map((imgUrl, i) => {
                const apiHost =
                  import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, '') || 'http://localhost:5000';
                const src =
                  imgUrl.startsWith('http') || imgUrl.startsWith('data:')
                    ? imgUrl
                    : `${apiHost}${imgUrl.startsWith('/') ? '' : '/'}${imgUrl}`;

                const currentVariant = variants.find(v => v.key === activeImagePickerKey);
                const isSelected = Boolean(
                  currentVariant?.imageUrl === imgUrl || 
                  (currentVariant?.imageUrls && currentVariant.imageUrls.includes(imgUrl))
                );

                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      onChange(
                        variants.map(v => {
                          if (v.key === activeImagePickerKey) {
                            // Keep multi-image array intact, making clicked image the primary preview
                            const existingUrls = v.imageUrls || (v.imageUrl ? [v.imageUrl] : []);
                            const nextUrls = existingUrls.includes(imgUrl)
                              ? existingUrls
                              : [imgUrl, ...existingUrls];
                            
                            const nextIndexes = nextUrls
                              .map(url => catalogImages.indexOf(url))
                              .filter(idx => idx !== -1);

                            return {
                              ...v,
                              imageUrl: imgUrl,
                              imageUrls: nextUrls,
                              imageIndexes: nextIndexes,
                            };
                          }
                          return v;
                        })
                      );
                      setActiveImagePickerKey(null);
                    }}
                    className={`aspect-square rounded-lg overflow-hidden border-2 transition-all group ${
                      isSelected
                        ? 'border-emerald-500 ring-2 ring-emerald-500/20 scale-105'
                        : 'border-slate-200 dark:border-zinc-800 hover:border-slate-400 dark:hover:border-zinc-600'
                    }`}
                  >
                    <img src={src} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                  </button>
                );
              })}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};