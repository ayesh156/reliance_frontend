import React, { useState } from 'react';
import type { ProductItem, VariantItem } from '../../types/product';
import { formatCurrency, getProductImageUrl, FALLBACK_IMAGE } from '../../lib/utils';
import {
  X,
  Phone,
  MessageSquare,
  Check,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Layers,
} from 'lucide-react';

interface ProductQuickViewModalProps {
  product: ProductItem | null;
  onClose: () => void;
}

export const ProductQuickViewModal: React.FC<ProductQuickViewModalProps> = ({
  product,
  onClose,
}) => {
  if (!product) return null;

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

  // Active prices
  const activePrice = selectedVariant?.retailPrice ?? (variants[0]?.retailPrice || 0);
  const wholesalePrice = selectedVariant?.wholesalePrice ?? (variants[0]?.wholesalePrice || 0);
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

  const handleWhatsAppInquiry = () => {
    const text = encodeURIComponent(
      `Hello Reliance Atelier,\n\nI am interested in acquiring:\n- Garment: ${product.name}\n- SKU/Ref: ${sku}\n- Size: ${selectedVariant?.size || 'Unspecified'}\n- Color: ${selectedVariant?.color || 'Standard'}\n- Retail Price: ${formatCurrency(activePrice)}\n\nPlease advise on current availability and bespoke fittings.`
    );
    window.open(`https://wa.me/94711350123?text=${text}`, '_blank');
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
          className="absolute top-4 right-4 z-20 p-2 text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white bg-white/80 hover:bg-white dark:bg-zinc-900/80 dark:hover:bg-zinc-800 rounded-full transition-colors border border-zinc-200 dark:border-zinc-800 shadow-sm"
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
                className="w-full h-full object-cover transition-all duration-500"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
                }}
              />

              {allImages.length > 1 && (
                <>
                  <button
                    onClick={() =>
                      setActiveImageIdx((prev) =>
                        prev === 0 ? allImages.length - 1 : prev - 1
                      )
                    }
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/60 hover:bg-black text-white rounded-full transition-colors shadow-md"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() =>
                      setActiveImageIdx((prev) =>
                        prev === allImages.length - 1 ? 0 : prev + 1
                      )
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/60 hover:bg-black text-white rounded-full transition-colors shadow-md"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnails */}
            {allImages.length > 1 && (
              <div className="flex items-center gap-2 mt-4 overflow-x-auto max-w-full pb-1">
                {allImages.slice(0, 6).map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImageIdx(idx)}
                    className={`w-12 h-14 rounded-sm overflow-hidden border transition-all shrink-0 ${
                      activeImageIdx === idx
                        ? 'border-zinc-950 dark:border-white scale-105 shadow-sm'
                        : 'border-zinc-300 dark:border-zinc-800 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={getProductImageUrl(img)}
                      alt={`Thumb ${idx}`}
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

              {/* Price */}
              <div className="flex items-baseline gap-3 pb-4 border-b border-zinc-200 dark:border-zinc-900">
                <span className="font-serif text-2xl font-semibold text-zinc-950 dark:text-white">
                  {formatCurrency(activePrice)}
                </span>
                {wholesalePrice > 0 && (
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                    Wholesale: {formatCurrency(wholesalePrice)}
                  </span>
                )}
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
                            className={`px-3 py-1.5 text-xs font-mono rounded-sm border transition-all ${
                              isMatch
                                ? 'border-zinc-950 bg-zinc-950 text-white dark:border-white dark:bg-white dark:text-black font-semibold shadow-sm'
                                : 'border-zinc-300 bg-white dark:border-zinc-800 dark:bg-zinc-900/60 text-zinc-700 dark:text-zinc-300 hover:border-zinc-500 dark:hover:border-zinc-600'
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
                      Color Palette
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
                            className={`px-3 py-1.5 text-xs rounded-sm border transition-all ${
                              isMatch
                                ? 'border-zinc-950 bg-zinc-100 text-zinc-950 dark:border-white dark:bg-zinc-800 dark:text-white font-medium'
                                : 'border-zinc-300 bg-white text-zinc-600 hover:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400 dark:hover:border-zinc-700'
                            }`}
                          >
                            {clr}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Tailoring Guarantee */}
                <div className="p-3 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-900 rounded-sm text-[11px] text-zinc-600 dark:text-zinc-400 space-y-1">
                  <div className="flex items-center gap-1.5 text-zinc-800 dark:text-zinc-300 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Makandura Atelier Standard</span>
                  </div>
                  <p className="text-[10px] leading-relaxed">
                    Custom-finished seams, reinforced stress points, and pre-shrunk premium textile matrix.
                  </p>
                </div>
              </div>
            </div>

            {/* Actions: WhatsApp Concierge + Phone Call */}
            <div className="space-y-2.5 pt-4 border-t border-zinc-200 dark:border-zinc-900">
              <button
                onClick={handleWhatsAppInquiry}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold uppercase tracking-[0.2em] rounded-sm transition-all shadow-lg shadow-emerald-950/20"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Order Inquiry via WhatsApp</span>
              </button>

              <div className="flex gap-2">
                <a
                  href="tel:0711350123"
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-medium uppercase tracking-wider rounded-sm transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call 071 135 0123</span>
                </a>
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-800 text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white text-xs uppercase tracking-wider rounded-sm transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
