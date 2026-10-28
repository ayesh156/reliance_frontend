import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ProductItem } from '../../types/product';
import { formatCurrency, getProductImageUrl, FALLBACK_IMAGE, handleImageError } from '../../lib/utils';
import { openProductWhatsAppInquiry } from '../../utils/whatsapp';
import { useAuth } from '../../contexts/AuthContext';
import { usePriceTier } from '../../utils/priceTier';
import { ShareProductModal } from './ShareProductModal';
import { toast } from 'react-toastify';
import { Eye, Link2, Check, MessageSquare } from 'lucide-react';

interface StorefrontProductCardProps {
  product: ProductItem;
  onQuickView?: (product: ProductItem) => void;
  priceTier?: 'wholesale' | 'retail' | 'w' | 'r';
}

export const StorefrontProductCard: React.FC<StorefrontProductCardProps> = ({
  product,
  onQuickView,
  priceTier,
}) => {
  const navigate = useNavigate();
  const { isWholesale: globalIsWholesale } = usePriceTier();
  const { user } = useAuth();
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Determine active tier (from prop or global tier hook)
  const isWholesaleTier = priceTier
    ? (priceTier === 'w' || priceTier === 'wholesale')
    : globalIsWholesale;

  const primaryVariant = product.variants?.[0];
  const retailPrice = primaryVariant?.retailPrice || 0;
  const wholesalePrice = primaryVariant?.wholesalePrice || retailPrice;
  const displayedPrice = isWholesaleTier ? wholesalePrice : retailPrice;

  const totalStock = product.variants?.reduce((sum, v) => sum + (v.stock || 0), 0) || 0;

  const primaryImage =
    primaryVariant?.imageUrl ||
    product.image ||
    product.images?.[0]?.imageUrl;
  const resolvedImage = getProductImageUrl(primaryImage) || FALLBACK_IMAGE;

  // Navigate to single product view page propagating active tier
  const handleCardNavigate = () => {
    const tierQuery = isWholesaleTier ? '?tier=w' : '?tier=r';
    navigate(`/product/${product.id}${tierQuery}`);
  };

  const handleWhatsAppClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const activeTier = isWholesaleTier ? 'wholesale' : 'retail';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const productUrl = `${origin}/product/${product.id}${isWholesaleTier ? '?tier=w' : '?tier=r'}`;
    openProductWhatsAppInquiry(product, primaryVariant, activeTier, productUrl);
  };

  const handleCopyLinkClick = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // Authenticated user: open Wholesale vs Retail popup modal
    if (user) {
      setShareModalOpen(true);
      return;
    }

    // Visitor: directly copy link matching active tier
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${origin}/product/${product.id}${isWholesaleTier ? '?tier=w' : '?tier=r'}`;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      setCopiedLink(true);
      toast.success(isWholesaleTier ? 'Wholesale product link copied!' : 'Retail product link copied!');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast.error('Failed to copy product link');
    }
  };

  return (
    <>
      <div
        className="group relative bg-white/80 dark:bg-zinc-900/60 backdrop-blur-md border border-[#e5e5e0]/80 dark:border-zinc-800/80 hover:border-zinc-400 dark:hover:border-zinc-700 rounded-sm transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_10px_25px_-5px_rgba(0,0,0,0.08)]"
      >
        {/* Product Image Area — Clicking navigates to Single Product View */}
        <div
          onClick={handleCardNavigate}
          className="relative aspect-[3/4] w-full overflow-hidden bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center cursor-pointer p-2"
        >
          <img
            src={resolvedImage}
            alt={product.name}
            className="w-full h-full object-contain transition-transform duration-700 ease-out group-hover:scale-105"
            loading="lazy"
            onError={handleImageError}
          />

          {/* Quick View Hover Overlay */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center p-3 sm:p-4 pointer-events-none group-hover:pointer-events-auto">
            <div className="flex flex-col gap-2 w-full max-w-[200px]">
              {onQuickView && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onQuickView(product);
                  }}
                  className="w-full py-2 px-3 bg-zinc-950/95 text-white hover:bg-zinc-900 dark:bg-white/95 dark:text-zinc-950 dark:hover:bg-white text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.2em] rounded-sm shadow-xl flex items-center justify-center gap-1.5 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Quick View</span>
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCardNavigate();
                }}
                className="w-full py-2 px-3 bg-white/90 text-zinc-900 hover:bg-white dark:bg-zinc-900/90 dark:text-white dark:hover:bg-zinc-900 text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.2em] rounded-sm shadow-xl flex items-center justify-center gap-1.5 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300 cursor-pointer"
              >
                <span>View Product</span>
              </button>
            </div>
          </div>

          {/* Style Code / SKU Badge */}
          <div className="absolute top-2 left-2 sm:top-3 sm:left-3 pointer-events-none">
            <span className="text-[8px] sm:text-[9px] uppercase tracking-widest font-mono px-1.5 sm:px-2 py-0.5 rounded-full bg-white/95 text-zinc-800 border border-zinc-200 dark:bg-zinc-950/80 dark:text-zinc-300 dark:border-zinc-800 backdrop-blur-sm shadow-sm font-medium">
              {product.searchKey || (primaryVariant?.sku ? `SKU: ${primaryVariant.sku}` : 'Reliance Cut')}
            </span>
          </div>

          {/* Crafted Edition / Stock Badge */}
          {totalStock > 0 && totalStock <= 20 && (
            <div className="absolute top-2 right-2 sm:top-3 sm:right-3 pointer-events-none">
              <span className="text-[8px] sm:text-[9px] uppercase tracking-widest font-mono px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-400 dark:border-emerald-800/60 backdrop-blur-sm shadow-sm font-medium">
                Only {totalStock} Left
              </span>
            </div>
          )}

          {/* Wholesale Mode Indicator Badge */}
          {isWholesaleTier && (
            <div className="absolute bottom-2 left-2 pointer-events-none">
              <span className="text-[8px] sm:text-[9px] uppercase tracking-wider font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/95 text-white backdrop-blur-sm shadow-md">
                Wholesale View
              </span>
            </div>
          )}
        </div>

        {/* Card Content & Action Bar */}
        <div className="p-2.5 sm:p-4 flex flex-col justify-between flex-1 bg-transparent">
          <div>
            {/* Top Meta Line: Category (left) + Action Icons */}
            <div className="flex items-center justify-between gap-1 mb-1.5">
              <span className="text-[8px] sm:text-[9px] uppercase tracking-widest text-zinc-600 dark:text-zinc-400 font-mono truncate">
                {product.category?.name || "Men's Wear"}
              </span>

              {/* Action Buttons: WhatsApp + Copy Link */}
              <div className="flex items-center gap-1 shrink-0">
                {/* WhatsApp Button */}
                <button
                  type="button"
                  onClick={handleWhatsAppClick}
                  className="p-1 sm:p-1.5 text-emerald-600 dark:text-emerald-400 hover:text-white hover:bg-emerald-600 dark:hover:bg-emerald-600 rounded-sm transition-colors border border-emerald-500/30 hover:border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30 shadow-xs cursor-pointer"
                  title="Inquire on WhatsApp"
                  aria-label="Inquire on WhatsApp"
                >
                  <MessageSquare className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                </button>

                {/* Copy Product Link Button */}
                <button
                  type="button"
                  onClick={handleCopyLinkClick}
                  className={`p-1 sm:p-1.5 rounded-sm transition-colors border shadow-xs cursor-pointer ${
                    copiedLink
                      ? 'text-emerald-600 bg-emerald-50 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-700'
                      : 'text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60'
                  }`}
                  title="Copy Product Link"
                  aria-label="Copy Product Link"
                >
                  {copiedLink ? (
                    <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Link2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Clickable Product Title */}
            <h3
              onClick={handleCardNavigate}
              className="font-serif text-xs sm:text-sm font-semibold tracking-wide uppercase text-[#09090b] dark:text-white line-clamp-1 cursor-pointer hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            >
              {product.name}
            </h3>
          </div>

          {/* Bottom Price Row: Displays ONLY Wholesale Price or ONLY Retail Price */}
          <div className="mt-2.5 pt-2 border-t border-[#e5e5e0] dark:border-zinc-900 flex items-center justify-between gap-1">
            <span className="text-[8px] sm:text-[9px] uppercase tracking-wider text-zinc-500 font-mono truncate">
              {isWholesaleTier ? 'WHOLESALE PRICE' : 'RETAIL PRICE'}
            </span>
            <span className={`whitespace-nowrap font-mono text-xs sm:text-sm font-bold ${isWholesaleTier ? 'text-amber-600 dark:text-amber-400' : 'text-[#09090b] dark:text-white'}`}>
              {formatCurrency(displayedPrice)}
            </span>
          </div>
        </div>
      </div>

      {/* Authenticated Pricing Share Dialog */}
      {shareModalOpen && (
        <ShareProductModal
          open={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          product={product}
        />
      )}
    </>
  );
};
