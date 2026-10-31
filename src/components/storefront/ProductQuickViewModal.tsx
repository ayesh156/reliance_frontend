import React, { useState } from 'react';
import type { ProductItem, VariantItem } from '../../types/product';
import { formatCurrency, getProductImageUrl, FALLBACK_IMAGE, handleImageError } from '../../lib/utils';
import { openWhatsAppChat } from '../../utils/whatsapp';
import { usePriceTier } from '../../utils/priceTier';
import {
  X,
  Phone,
  MessageSquare,
  Check,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Layers,
  Building2,
  Tag,
} from 'lucide-react';

interface ProductQuickViewModalProps {
  product: ProductItem | null;
  onClose: () => void;
  priceTier?: 'wholesale' | 'retail' | 'w' | 'r';
}

export const ProductQuickViewModal: React.FC<ProductQuickViewModalProps> = ({
  product,
  onClose,
  priceTier,
}) => {
  if (!product) return null;

  const { isWholesale: globalIsWholesale } = usePriceTier();
  const isWholesaleMode = priceTier
    ? (priceTier === 'w' || priceTier === 'wholesale')
    : globalIsWholesale;

  // Variants and images calculation
  const variants = product.variants || [];
  const [selectedVariant, setSelectedVariant] = useState<VariantItem | null>(
    variants.length > 0 ? variants[0] : null
  );

  // Collect all images (product images + variant imageUrls)
  const allImages: string[] = [];
  if (product.image) allImages.push(product.image);
  if (product.images && product.images.length > 0) {
    product.images.forEach((img) => {
      if (img.imageUrl && !allImages.includes(img.imageUrl)) {
        allImages.push(img.imageUrl);
      }
    });
  }
  variants.forEach((v) => {
    if (v.imageUrl && !allImages.includes(v.imageUrl)) {
      allImages.push(v.imageUrl);
    }
  });

  const [activeImageIdx, setActiveImageIdx] = useState(0);

  // Active prices based on tier
  const activeRetailPrice = selectedVariant?.retailPrice ?? (variants[0]?.retailPrice || 0);
  const activeWholesalePrice = selectedVariant?.wholesalePrice ?? (variants[0]?.wholesalePrice || activeRetailPrice);
  const displayedPrice = isWholesaleMode ? activeWholesalePrice : activeRetailPrice;

  const totalStock = variants.reduce((acc, v) => acc + (v.stock || 0), 0);
  const activeStock = selectedVariant ? selectedVariant.stock : totalStock;
  const sku = selectedVariant?.sku || variants[0]?.sku || product.searchKey || 'RL-HAUTE';

  // Distinct sizes and colors
  const availableSizes = Array.from(
    new Set(variants.map((v) => v.size).filter(Boolean))
  );
  const availableColors = Array.from(
    new Set(variants.map((v) => v.color).filter(Boolean))
  );

  const displayImage =
    allImages.length > 0
      ? getProductImageUrl(allImages[activeImageIdx])
      : FALLBACK_IMAGE;

  // Touch-safe quantity state
  const [qtyValue, setQtyValue] = useState<string>('1');
  const effectiveQty = Math.max(1, parseInt(qtyValue, 10) || 1);

  const handleQtyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '') {
      setQtyValue('');
      return;
    }
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      setQtyValue(String(parsed));
    }
  };

  const handleQtyBlur = () => {
    const parsed = parseInt(qtyValue, 10);
    if (isNaN(parsed) || parsed < 1) {
      setQtyValue('1');
    } else {
      setQtyValue(String(parsed));
    }
  };

  const handleDecrement = () => {
    const cur = parseInt(qtyValue, 10) || 1;
    setQtyValue(String(Math.max(1, cur - 1)));
  };

  const handleIncrement = () => {
    const cur = parseInt(qtyValue, 10) || 1;
    setQtyValue(String(cur + 1));
  };

  const handleWhatsAppInquiry = () => {
    const tierLabel = isWholesaleMode ? 'Wholesale Price' : 'Retail Price';
    const styleNo = product.searchKey || sku || `REL-${product.id}`;
    const totalAmount = displayedPrice * effectiveQty;
    const rawMessage = `Hello Reliance Atelier,\n\nI would like to order ${effectiveQty} ${effectiveQty === 1 ? 'piece' : 'pieces'} of [${styleNo}] - ${product.name}:\n- Size: ${selectedVariant?.size || 'Unspecified'}\n- Color: ${selectedVariant?.color || 'Standard'}\n- Unit ${tierLabel}: ${formatCurrency(displayedPrice)}\n${effectiveQty > 1 ? `- Estimated Total: ${formatCurrency(totalAmount)}\n` : ''}\nPlease confirm availability and order details.`;
    openWhatsAppChat('94711350123', rawMessage);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/60 dark:bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-4xl bg-[#f8f8f6] dark:bg-zinc-950 border border-[#e5e5e0] dark:border-zinc-800 text-[#09090b] dark:text-zinc-100 rounded-sm shadow-2xl overflow-hidden my-auto transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white bg-white/80 hover:bg-white dark:bg-zinc-900/80 dark:hover:bg-zinc-800 rounded-full transition-colors border border-zinc-200 dark:border-zinc-800 shadow-sm cursor-pointer"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Left: Image Showcase */}
          <div className="relative bg-zinc-100/70 dark:bg-zinc-900 flex flex-col items-center justify-center p-6 border-b md:border-b-0 md:border-r border-[#e5e5e0] dark:border-zinc-800">
            <div className="relative w-full aspect-[4/5] max-h-[480px] overflow-hidden rounded-sm flex items-center justify-center bg-white dark:bg-black/50 shadow-inner">
              <img
                src={displayImage}
                alt={product.name}
                className="w-full h-full object-contain p-2 transition-all duration-500"
                onError={handleImageError}
              />
              {/* Wholesale Mode Indicator Badge */}
              {isWholesaleMode && (
                <div className="absolute top-3 left-3 pointer-events-none">
                  <span className="text-[9px] uppercase tracking-wider font-mono font-bold px-2 py-0.5 rounded bg-amber-500/95 text-white backdrop-blur-sm shadow-md">
                    Wholesale View
                  </span>
                </div>
              )}
            </div>

            {/* Thumbnail Navigator */}
            {allImages.length > 1 && (
              <div className="flex items-center gap-2 mt-4 overflow-x-auto max-w-full pb-1">
                {allImages.slice(0, 6).map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImageIdx(idx)}
                    className={`w-12 h-14 rounded-sm overflow-hidden border transition-all shrink-0 cursor-pointer ${
                      activeImageIdx === idx
                        ? 'border-zinc-950 dark:border-white scale-105 shadow-sm'
                        : 'border-zinc-300 dark:border-zinc-800 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={getProductImageUrl(img)}
                      alt={`Thumb ${idx}`}
                      onError={handleImageError}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Garment Details & Inquiry */}
          <div className="p-6 sm:p-8 flex flex-col justify-between space-y-6">
            <div>
              {/* Category & Status */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400 font-mono">
                  {product.category?.name || "Men's Wear Collection"}
                </span>
                <span
                  className={`text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full font-mono font-medium ${
                    activeStock > 0
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
                      : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                  }`}
                >
                  {activeStock > 0 ? `In Stock (${activeStock})` : 'Made to Order'}
                </span>
              </div>

              {/* Product Title */}
              <h3 className="font-serif text-xl sm:text-2xl font-bold tracking-wider text-zinc-950 dark:text-white uppercase mb-2">
                {product.name}
              </h3>

              {/* Style Code / SKU */}
              <div className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 mb-4 flex items-center gap-2">
                <span>STYLE CODE: {sku}</span>
                {product.searchKey && (
                  <>
                    <span>&bull;</span>
                    <span>REF: {product.searchKey}</span>
                  </>
                )}
              </div>

              {/* Price Row: Displays ONLY Wholesale Price or ONLY Retail Price */}
              <div className="pb-4 border-b border-zinc-200 dark:border-zinc-900">
                <span className={`block text-[9px] uppercase tracking-[0.2em] font-mono font-bold mb-1 ${isWholesaleMode ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-500'}`}>
                  {isWholesaleMode ? 'WHOLESALE PRICE' : 'RETAIL PRICE'}
                </span>
                <span className={`font-serif text-2xl font-semibold ${isWholesaleMode ? 'text-amber-700 dark:text-amber-400' : 'text-zinc-950 dark:text-white'}`}>
                  {formatCurrency(displayedPrice)}
                </span>
              </div>

              {/* Garment Specifications */}
              <div className="space-y-4 pt-4">
                {/* Sizes */}
                {availableSizes.length > 0 && (
                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.2em] text-zinc-600 dark:text-zinc-400 mb-2 font-medium">
                      Select Tailored Size
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {availableSizes.map((sz) => {
                        const isMatch = selectedVariant?.size === sz;
                        return (
                          <button
                            key={sz}
                            onClick={() => {
                              const found = variants.find((v) => v.size === sz);
                              if (found) setSelectedVariant(found);
                            }}
                            className={`px-3 py-1.5 text-xs font-mono rounded-sm border transition-all cursor-pointer ${
                              isMatch
                                ? 'border-zinc-950 bg-zinc-950 text-white dark:border-white dark:bg-white dark:text-black font-semibold shadow-sm'
                                : 'border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-zinc-500'
                            }`}
                          >
                            {sz}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Colors */}
                {availableColors.length > 0 && (
                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.2em] text-zinc-600 dark:text-zinc-400 mb-2 font-medium">
                      Select Shade
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {availableColors.map((clr) => {
                        const isMatch = selectedVariant?.color === clr;
                        return (
                          <button
                            key={clr}
                            onClick={() => {
                              const found = variants.find((v) => v.color === clr);
                              if (found) setSelectedVariant(found);
                            }}
                            className={`px-3 py-1.5 text-xs uppercase tracking-wider rounded-sm border transition-all cursor-pointer ${
                              isMatch
                                ? 'border-zinc-950 bg-zinc-950 text-white dark:border-white dark:bg-white dark:text-black font-semibold shadow-sm'
                                : 'border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-zinc-500'
                            }`}
                          >
                            {clr}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Direct WhatsApp Concierge Button & Quantity */}
            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-900 space-y-3">
              {/* Quantity Selector */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-zinc-600 dark:text-zinc-400 font-mono font-medium">
                  Quantity (Pcs):
                </span>
                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-2xs">
                    <button
                      type="button"
                      onClick={handleDecrement}
                      disabled={effectiveQty <= 1}
                      className="w-8 h-8 flex items-center justify-center text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 cursor-pointer active:scale-95 transition-all"
                      aria-label="Decrease Quantity"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      min={1}
                      max={activeStock > 0 ? activeStock : 999}
                      value={qtyValue}
                      onChange={handleQtyChange}
                      onBlur={handleQtyBlur}
                      onFocus={(e) => e.target.select()}
                      className="w-12 h-8 text-center text-xs font-mono font-bold bg-transparent border-x border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      aria-label="Enter Quantity"
                      placeholder="1"
                    />
                    <button
                      type="button"
                      onClick={handleIncrement}
                      disabled={activeStock > 0 && effectiveQty >= activeStock}
                      className="w-8 h-8 flex items-center justify-center text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 cursor-pointer active:scale-95 transition-all"
                      aria-label="Increase Quantity"
                    >
                      +
                    </button>
                  </div>
                  <span className="text-[11px] text-zinc-500 font-mono min-w-[70px] text-right">
                    {formatCurrency(displayedPrice * effectiveQty)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleWhatsAppInquiry}
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold uppercase tracking-[0.2em] rounded-sm transition-all duration-300 shadow-xl flex items-center justify-center gap-2 cursor-pointer"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Inquire on WhatsApp</span>
              </button>

              <div className="flex items-center justify-center gap-4 text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-widest font-mono">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Makandura Atelier
                </span>
                <span>&bull;</span>
                <span>Direct Inquiry</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
