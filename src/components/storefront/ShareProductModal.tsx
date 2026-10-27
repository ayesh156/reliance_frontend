import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import type { ProductItem } from '../../types/product';
import { formatCurrency, getProductImageUrl, FALLBACK_IMAGE, handleImageError } from '../../lib/utils';
import { toast } from 'react-toastify';
import { Link2, Check, Tag, Building2, Copy, Sparkles, X } from 'lucide-react';

interface ShareProductModalProps {
  open: boolean;
  onClose: () => void;
  product: ProductItem | null;
}

export const ShareProductModal: React.FC<ShareProductModalProps> = ({
  open,
  onClose,
  product,
}) => {
  const [copiedType, setCopiedType] = useState<'retail' | 'wholesale' | null>(null);

  if (!product) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const primaryVariant = product.variants?.[0];
  const retailPrice = primaryVariant?.retailPrice || 0;
  const wholesalePrice = primaryVariant?.wholesalePrice || retailPrice;

  const retailUrl = `${origin}/product/${product.id}?tier=r`;
  const wholesaleUrl = `${origin}/product/${product.id}?tier=w`;

  const primaryImage =
    primaryVariant?.imageUrl ||
    product.image ||
    product.images?.[0]?.imageUrl;
  const resolvedImage = getProductImageUrl(primaryImage) || FALLBACK_IMAGE;

  const handleCopy = async (type: 'retail' | 'wholesale') => {
    const url = type === 'retail' ? retailUrl : wholesaleUrl;
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

      setCopiedType(type);
      if (type === 'retail') {
        toast.success('Retail price product link copied!');
      } else {
        toast.success('Wholesale price product link copied!');
      }

      setTimeout(() => {
        setCopiedType(null);
        onClose();
      }, 900);
    } catch {
      toast.error('Failed to copy link to clipboard');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) onClose(); }}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-[#fbfbfa] dark:bg-[#0c0c0e] text-zinc-900 dark:text-zinc-100 shadow-2xl rounded-lg">
        {/* Modal Header */}
        <div className="p-5 pb-4 border-b border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">
                <Link2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <DialogTitle className="text-sm font-semibold tracking-wide uppercase font-serif">
                Share Product Link
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Authenticated pricing link generator. Choose which price mode the recipient will see.
          </DialogDescription>
        </div>

        {/* Product Snapshot */}
        <div className="px-5 py-3.5 bg-zinc-50 dark:bg-zinc-900/30 border-b border-zinc-200/80 dark:border-zinc-800/60 flex items-center gap-3">
          <div className="w-12 h-14 rounded overflow-hidden bg-zinc-200 dark:bg-zinc-800 shrink-0 border border-zinc-200 dark:border-zinc-700">
            <img
              src={resolvedImage}
              alt={product.name}
              className="w-full h-full object-cover"
              onError={handleImageError}
            />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[9px] uppercase tracking-widest font-mono text-zinc-400 block">
              {product.category?.name || "Men's Apparel"} • {product.searchKey || `SKU #${product.id}`}
            </span>
            <h4 className="text-xs font-semibold uppercase text-zinc-900 dark:text-white truncate mt-0.5">
              {product.name}
            </h4>
            <div className="flex items-center gap-3 mt-1 text-[11px] font-mono">
              <span className="text-zinc-600 dark:text-zinc-400">
                Retail: <strong className="text-zinc-900 dark:text-zinc-100">{formatCurrency(retailPrice)}</strong>
              </span>
              <span className="text-amber-600 dark:text-amber-400">
                Wholesale: <strong>{formatCurrency(wholesalePrice)}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Link Options Grid */}
        <div className="p-5 space-y-3.5">
          {/* Option 1: Retail Price Link */}
          <div
            onClick={() => handleCopy('retail')}
            className={`group relative p-3.5 rounded-md border transition-all cursor-pointer flex flex-col gap-2 ${
              copiedType === 'retail'
                ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
                : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900/60'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center shrink-0">
                  <Tag className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-white">
                      Retail Price Link
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                      {formatCurrency(retailPrice)}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug mt-0.5">
                    Displays <strong>ONLY Retail Price</strong>. Wholesale pricing is completely hidden.
                  </p>
                </div>
              </div>

              <button
                type="button"
                className={`px-3 py-1.5 text-xs font-medium uppercase tracking-wider rounded flex items-center gap-1.5 shrink-0 transition-colors ${
                  copiedType === 'retail'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white'
                }`}
              >
                {copiedType === 'retail' ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            <div className="text-[10px] font-mono text-zinc-500 dark:text-zinc-500 truncate bg-zinc-50 dark:bg-zinc-950/60 px-2 py-1 rounded border border-zinc-100 dark:border-zinc-800/80">
              {retailUrl}
            </div>
          </div>

          {/* Option 2: Wholesale Price Link */}
          <div
            onClick={() => handleCopy('wholesale')}
            className={`group relative p-3.5 rounded-md border transition-all cursor-pointer flex flex-col gap-2 ${
              copiedType === 'wholesale'
                ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/20'
                : 'border-amber-200/80 dark:border-amber-900/40 hover:border-amber-400 dark:hover:border-amber-700 bg-amber-50/20 dark:bg-amber-950/10'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-md bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-950 dark:text-amber-300">
                      Wholesale Price Link
                    </span>
                    <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                      {formatCurrency(wholesalePrice)}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug mt-0.5">
                    Displays <strong>ONLY Wholesale Price</strong>. Retail pricing is completely hidden.
                  </p>
                </div>
              </div>

              <button
                type="button"
                className={`px-3 py-1.5 text-xs font-medium uppercase tracking-wider rounded flex items-center gap-1.5 shrink-0 transition-colors ${
                  copiedType === 'wholesale'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-500 dark:text-zinc-950 dark:hover:bg-amber-400'
                }`}
              >
                {copiedType === 'wholesale' ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            <div className="text-[10px] font-mono text-zinc-500 dark:text-zinc-500 truncate bg-zinc-50 dark:bg-zinc-950/60 px-2 py-1 rounded border border-zinc-100 dark:border-zinc-800/80">
              {wholesaleUrl}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
          >
            Cancel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
