import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ImageIcon, Check, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { SizeCombobox } from './SizeCombobox';
import { ColorCombobox } from './ColorCombobox';
import type { VariantItem } from '../../types/product';
import { sanitizePrice, calculateAdjustedStock } from '../../utils/validators';

interface VariantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (variant: VariantItem) => void;
  variant: VariantItem | null;
  availableSizes?: { id: number; name: string }[];
  availableColors?: { id: number; name: string; hexCode?: string | null }[];
  catalogImages?: string[];
  onSizeCreated?: (newSize: { id: number; name: string }) => void;
  onColorCreated?: (newColor: { id: number; name: string; hexCode?: string | null }) => void;
  dark?: boolean;
}

export const VariantModal: React.FC<VariantModalProps> = ({
  isOpen,
  onClose,
  onSave,
  variant,
  availableSizes = [],
  availableColors = [],
  catalogImages = [],
  onSizeCreated = () => {},
  onColorCreated = () => {},
  dark = true,
}) => {
  const [formData, setFormData] = useState<VariantItem | null>(null);
  // Stock adjustment (+/-) පාලනය සහ දෝෂ හඳුනාගැනීමේ states
  const [stockAdjustment, setStockAdjustment] = useState<string>('');
  const [stockError, setStockError] = useState<string | null>(null);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (variant) {
      setStockAdjustment('');
      setStockError(null);
      // Database ID සහ Numeric අගයන් sanitize කර තහවුරු කර ගැනීම
      setFormData({
        ...variant,
        id: variant.id ? Number(variant.id) : undefined,
        costPrice: sanitizePrice(variant.costPrice),
        wholesalePrice: sanitizePrice(variant.wholesalePrice),
        retailPrice: sanitizePrice(variant.retailPrice),
        comparePrice: variant.comparePrice ? sanitizePrice(variant.comparePrice) : 0,
        stock: Math.max(0, parseInt(String(variant.stock || 0), 10) || 0),
      });
    }
  }, [variant]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowImagePicker(false);
      }
    };
    if (showImagePicker) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showImagePicker]);

  if (!isOpen || !formData) return null;

  const updateField = (field: keyof VariantItem, value: any) => {
    setFormData(prev => (prev ? { ...prev, [field]: value } : null));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData) {
      onSave(formData);
      onClose();
    }
  };

  const displayImg = (formData.imageUrls && formData.imageUrls[0]) || formData.imageUrl;
  const apiHost = import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, '') || 'http://localhost:5000';
  const resolvedPhotoSrc = displayImg
    ? displayImg.startsWith('http') || displayImg.startsWith('data:')
      ? displayImg
      : `${apiHost}${displayImg.startsWith('/') ? '' : '/'}${displayImg}`
    : null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in-0 duration-200">
      <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-zinc-800/80">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
              {variant?.sku ? `Edit Variant (${variant.sku})` : 'Add New Product Variant'}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
              Configure inventory attributes, barcodes, and multi-tier pricing.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Modal Form Container - Changed to div to prevent bubbling to outer product form */}
        <div className="p-5 space-y-4">
          {/* Creative Identity Matrix: Left Large Image Card + Right Form Grid (Size, Color, SKU, Barcode) */}
          <div className="flex items-stretch gap-3.5">
            {/* Left Column: Large Image Card (Heights matching right fields perfectly) */}
            <div className="relative shrink-0 flex flex-col">
              <button
                type="button"
                onClick={() => setShowImagePicker(prev => !prev)}
                className="w-28 sm:w-32 h-full min-h-[125px] rounded-2xl border-2 border-dashed border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/80 flex flex-col items-center justify-center overflow-hidden hover:border-emerald-500 hover:bg-emerald-50/20 dark:hover:bg-emerald-950/20 transition-all group relative cursor-pointer shadow-xs"
                title="Click to assign variant photo"
              >
                {resolvedPhotoSrc ? (
                  <>
                    <img src={resolvedPhotoSrc} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px] font-bold">
                      Change Photo
                    </div>
                  </>
                ) : (
                  <div className="p-2 text-center flex flex-col items-center">
                    <div className="size-8 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                      <ImageIcon className="size-4 text-slate-400 group-hover:text-emerald-500" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-600 dark:text-zinc-300">Add Photo</span>
                    <span className="text-[8px] text-slate-400">Click to pick</span>
                  </div>
                )}
              </button>

              {/* Photo Picker Popover Dropdown */}
              {showImagePicker && (
                <div
                  ref={popoverRef}
                  className="absolute top-full left-0 mt-2 z-50 p-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl w-64 space-y-2 animate-in fade-in-0 zoom-in-95"
                >
                  <div className="flex items-center justify-between text-[11px] font-bold pb-1.5 border-b border-slate-100 dark:border-zinc-800">
                    <span>Select Catalog Photo</span>
                    {resolvedPhotoSrc && (
                      <button
                        type="button"
                        onClick={() => {
                          updateField('imageUrl', undefined);
                          updateField('imageUrls', []);
                          setShowImagePicker(false);
                        }}
                        className="text-rose-500 text-[10px] hover:underline cursor-pointer"
                      >
                        Clear Photo
                      </button>
                    )}
                  </div>
                  {catalogImages.length === 0 ? (
                    <p className="text-[10px] text-slate-400 text-center py-3">No catalog photos available</p>
                  ) : (
                    <div className="grid grid-cols-4 gap-1.5 max-h-40 overflow-y-auto pr-1">
                      {catalogImages.map((imgUrl, i) => {
                        const src = imgUrl.startsWith('http') || imgUrl.startsWith('data:')
                          ? imgUrl
                          : `${apiHost}${imgUrl.startsWith('/') ? '' : '/'}${imgUrl}`;
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => {
                              updateField('imageUrl', imgUrl);
                              updateField('imageUrls', [imgUrl]);
                              setShowImagePicker(false);
                            }}
                            className="aspect-square rounded-lg border overflow-hidden hover:border-emerald-500 transition-all cursor-pointer hover:scale-105"
                          >
                            <img src={src} alt="" className="w-full h-full object-cover" />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Column: 2-Row Parallel Grid (Size, Color, SKU, Barcode) */}
            <div className="flex-1 space-y-2.5">
              {/* Row 1: Size & Color */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                    Size
                  </label>
                  <SizeCombobox
                    sizes={availableSizes}
                    value={formData.size || ''}
                    onChange={val => updateField('size', val)}
                    onSizeCreated={onSizeCreated}
                    dark={dark}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                    Color
                  </label>
                  <ColorCombobox
                    colors={availableColors}
                    value={formData.color || ''}
                    onChange={val => updateField('color', val)}
                    onColorCreated={onColorCreated}
                    dark={dark}
                  />
                </div>
              </div>

              {/* Row 2: SKU & Barcode */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                    SKU *
                  </label>
                  <Input
                    value={formData.sku}
                    onChange={e => updateField('sku', e.target.value)}
                    placeholder="PROD-0001"
                    className="h-8 font-mono text-xs w-full"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                    Barcode (EAN)
                  </label>
                  <Input
                    value={formData.barcode || ''}
                    onChange={e => updateField('barcode', e.target.value)}
                    placeholder="Scan or enter barcode"
                    className="h-8 font-mono text-xs w-full"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Professional Pricing Matrix (Cost -> Wholesale -> Retail -> Compare) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100 dark:border-zinc-800/80">
            {/* 1. Cost Price */}
            <div>
              <label className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 block mb-1">
                Cost (Rs)
              </label>
              <Input
                type="number"
                min="0"
                step="any"
                value={formData.costPrice === 0 ? '' : formData.costPrice}
                onChange={e => updateField('costPrice', sanitizePrice(e.target.value))}
                placeholder="0"
                className="h-8 text-slate-600 dark:text-zinc-300 text-right text-xs"
              />
            </div>

            {/* 2. Wholesale Price */}
            <div>
              <label className="text-[10px] font-bold text-amber-600 block mb-1">
                Wholesale (Rs)
              </label>
              <Input
                type="number"
                min="0"
                step="any"
                value={formData.wholesalePrice === 0 ? '' : formData.wholesalePrice}
                onChange={e => updateField('wholesalePrice', sanitizePrice(e.target.value))}
                placeholder="0"
                className="h-8 text-amber-600 font-semibold text-right text-xs"
              />
            </div>

            {/* 3. Retail Price (POS) */}
            <div>
              <label className="text-[10px] font-bold text-emerald-600 block mb-1">
                Retail (Rs) *
              </label>
              <Input
                type="number"
                min="0"
                step="any"
                value={formData.retailPrice === 0 ? '' : formData.retailPrice}
                onChange={e => updateField('retailPrice', sanitizePrice(e.target.value))}
                placeholder="0"
                className="h-8 text-emerald-600 font-bold text-right text-xs"
                required
              />
            </div>

            {/* 4. Compare Price */}
            <div>
              <label className="text-[10px] font-semibold text-slate-400 block mb-1">
                Compare (Rs)
              </label>
              <Input
                type="number"
                min="0"
                step="any"
                value={!formData.comparePrice ? '' : formData.comparePrice}
                onChange={e => updateField('comparePrice', sanitizePrice(e.target.value))}
                placeholder="Old"
                className="h-8 opacity-80 text-right text-xs"
              />
            </div>
          </div>

          {/* Stock Display & Adjustment Matrix */}
          <div className="pt-2 border-t border-slate-100 dark:border-zinc-800/80">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-end">
              {/* Current Stock (Original color intact, disabled from typing) */}
              <div>
                <label className="text-[10px] font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                  Current Stock
                </label>
                <Input
                  type="text"
                  readOnly
                  tabIndex={-1}
                  value={formData.stock ?? 0}
                  className="h-8 font-bold text-center text-xs bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 cursor-default select-none focus-visible:ring-0"
                />
              </div>

              {/* Adjust Stock Input (+10 or -5) */}
              <div>
                <label className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 block mb-1">
                  Adjust Stock (+ / -)
                </label>
                <Input
                  type="text"
                  placeholder="+10 හෝ -5"
                  value={stockAdjustment}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^[+-]?\d*$/.test(val)) {
                      setStockAdjustment(val);
                      const res = calculateAdjustedStock(formData.stock, val);
                      setStockError(res.isValid ? null : res.error || 'වලංගු නොවන අගයකි');
                    }
                  }}
                  className={`h-8 font-mono text-center text-xs ${
                    stockError ? 'border-rose-500 focus-visible:ring-rose-500' : 'border-indigo-200 dark:border-indigo-900/60'
                  }`}
                />
              </div>

              {/* New Total Stock Preview */}
              <div>
                <label className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 block mb-1">
                  New Total Stock
                </label>
                <div className="h-8 px-2 flex items-center justify-center rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50 font-bold font-mono text-xs text-slate-800 dark:text-zinc-200">
                  {calculateAdjustedStock(formData.stock, stockAdjustment).finalStock}
                </div>
              </div>
            </div>

            {/* Negative Stock Validation Error Alert */}
            {stockError && (
              <p className="text-[11px] font-medium text-rose-500 mt-1.5 animate-in fade-in-0">
                ⚠️ {stockError}
              </p>
            )}
          </div>

          {/* Modal Footer - Professional Dynamic Add / Update Action with Payload Sanitization */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-zinc-800">
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }} 
              className="h-8 text-xs cursor-pointer"
            >
              Cancel
            </Button>
            {(() => {
              const isEditMode = Boolean(formData?.id || (variant?.sku && variant.sku === formData?.sku));
              return (
                <Button 
                  type="button" 
                  size="sm" 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!formData) return;

                    // Stock calculation එක validate කර අවසන් stock අගය ලබා ගැනීම
                    const stockCalc = calculateAdjustedStock(formData.stock, stockAdjustment);
                    if (!stockCalc.isValid) {
                      setStockError(stockCalc.error || 'වලංගු නොවන stock අගයකි');
                      return;
                    }

                    // Strict validated payload to prevent database crash
                    const sanitizedVariant: VariantItem = {
                      ...formData,
                      id: formData.id ? Number(formData.id) : undefined,
                      sku: formData.sku?.trim() || `SKU-${Date.now().toString().slice(-4)}`,
                      barcode: formData.barcode?.trim() || '',
                      costPrice: sanitizePrice(formData.costPrice),
                      wholesalePrice: sanitizePrice(formData.wholesalePrice),
                      retailPrice: sanitizePrice(formData.retailPrice),
                      comparePrice: formData.comparePrice ? sanitizePrice(formData.comparePrice) : 0,
                      stock: stockCalc.finalStock,
                    };

                    onSave(sanitizedVariant);
                    onClose();
                  }} 
                  className={`h-8 text-xs gap-1.5 text-white cursor-pointer ${
                    isEditMode 
                      ? 'bg-blue-600 hover:bg-blue-700' 
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {isEditMode ? (
                    <>
                      <RefreshCw className="size-3.5" /> Update Variant
                    </>
                  ) : (
                    <>
                      <Check className="size-3.5" /> Add Variant
                    </>
                  )}
                </Button>
              );
            })()}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};