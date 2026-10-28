import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { toast } from 'react-toastify';
import { Link2, Check, Tag, Building2, Copy, Sparkles, MessageSquare, Layers } from 'lucide-react';

interface ShareCatalogModalProps {
  open: boolean;
  onClose: () => void;
  totalProducts?: number;
  activeCategory?: string;
}

/**
 * ShareCatalogModal — Global Haute Couture catalog pricing share generator.
 * Allows sales reps, staff, and administrators to share deep-linked catalog views
 * configured for either standard Retail pricing or verified Wholesale trade pricing.
 */
export const ShareCatalogModal: React.FC<ShareCatalogModalProps> = ({
  open,
  onClose,
  totalProducts = 0,
  activeCategory = 'All Categories',
}) => {
  const [copiedType, setCopiedType] = useState<'retail' | 'wholesale' | null>(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const retailUrl = `${origin}/shop?tier=r`;
  const wholesaleUrl = `${origin}/shop?tier=w`;

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
        toast.success('Retail price catalog link copied!');
      } else {
        toast.success('Wholesale trade price catalog link copied!');
      }

      setTimeout(() => {
        setCopiedType(null);
        onClose();
      }, 900);
    } catch {
      toast.error('Failed to copy link to clipboard');
    }
  };

  const handleWhatsAppShare = (type: 'retail' | 'wholesale', e: React.MouseEvent) => {
    e.stopPropagation();
    const url = type === 'retail' ? retailUrl : wholesaleUrl;
    const tierName = type === 'retail' ? 'Retail Catalog' : 'Wholesale Trade Catalog';
    const message = encodeURIComponent(
      `Hello! View our official Reliance ${tierName} with updated styles & pricing:\n\n${url}\n\nCrafted with premium quality in Makandura, Matara.`
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) onClose(); }}>
      <DialogContent className="w-[95vw] sm:w-full sm:max-w-md mx-auto p-0 overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-[#fbfbfa] dark:bg-[#0c0c0e] text-zinc-900 dark:text-zinc-100 shadow-2xl rounded-xl">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 pr-12 pb-3 sm:pb-4 border-b border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">
              <Link2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <DialogTitle className="text-sm font-semibold tracking-wide uppercase font-serif">
              Share Catalog Pricing
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Authenticated global catalog pricing generator. Select which pricing tier recipients will view across the entire collection.
          </DialogDescription>
        </div>

        {/* Catalog Scope Snapshot */}
        <div className="px-4 sm:px-5 py-3 bg-zinc-50 dark:bg-zinc-900/30 border-b border-zinc-200/80 dark:border-zinc-800/60 flex items-center gap-3">
          <div className="w-10 h-10 rounded-md overflow-hidden bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 border border-emerald-500/20 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[9px] uppercase tracking-widest font-mono text-zinc-400 block truncate">
                Reliance Haute Collection
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold">
                {totalProducts} Styles
              </span>
            </div>
            <h4 className="text-xs font-semibold uppercase text-zinc-900 dark:text-white truncate mt-0.5">
              {activeCategory === 'all' ? 'Full Product Runway Catalog' : activeCategory}
            </h4>
          </div>
        </div>

        {/* Link Options Grid */}
        <div className="p-4 sm:p-5 space-y-3">
          {/* Option 1: Retail Price Catalog Link */}
          <div
            onClick={() => handleCopy('retail')}
            className={`group relative p-3 sm:p-3.5 rounded-lg border transition-all cursor-pointer flex flex-col gap-2 ${
              copiedType === 'retail'
                ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
                : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900/60'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center shrink-0">
                  <Tag className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-white">
                      Retail Catalog Link
                    </span>
                    <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-semibold">
                      Public Tier
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug mt-0.5">
                    Displays standard retail prices across all items. Wholesale pricing is completely hidden.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={(e) => handleWhatsAppShare('retail', e)}
                  title="Share via WhatsApp"
                  className="p-1.5 text-zinc-500 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  className={`inline-flex items-center justify-center gap-1 text-[11px] font-semibold uppercase tracking-wider px-3 py-1.5 rounded transition-all duration-200 ${
                    copiedType === 'retail'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 group-hover:bg-zinc-800 dark:group-hover:bg-white'
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
            </div>

            {/* Truncated URL Preview */}
            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500 truncate select-all">
                {retailUrl}
              </span>
            </div>
          </div>

          {/* Option 2: Wholesale Trade Catalog Link */}
          <div
            onClick={() => handleCopy('wholesale')}
            className={`group relative p-3 sm:p-3.5 rounded-lg border transition-all cursor-pointer flex flex-col gap-2 ${
              copiedType === 'wholesale'
                ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/20'
                : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900/60'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-white">
                      Wholesale Catalog Link
                    </span>
                    <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-semibold">
                      Trade Tier
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug mt-0.5">
                    Displays verified wholesale trade prices across the entire catalog for registered retail partners.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={(e) => handleWhatsAppShare('wholesale', e)}
                  title="Share via WhatsApp"
                  className="p-1.5 text-zinc-500 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  className={`inline-flex items-center justify-center gap-1 text-[11px] font-semibold uppercase tracking-wider px-3 py-1.5 rounded transition-all duration-200 ${
                    copiedType === 'wholesale'
                      ? 'bg-amber-600 text-white'
                      : 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 group-hover:bg-zinc-800 dark:group-hover:bg-white'
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
            </div>

            {/* Truncated URL Preview */}
            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500 truncate select-all">
                {wholesaleUrl}
              </span>
            </div>
          </div>
        </div>

        {/* Security / Confidentiality Footer */}
        <div className="px-4 sm:px-5 py-2.5 bg-zinc-100/70 dark:bg-zinc-900/40 border-t border-zinc-200/80 dark:border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
          <span className="font-mono flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500" />
            Wholesale links show verified dealer pricing
          </span>
          <button
            type="button"
            onClick={onClose}
            className="hover:text-zinc-900 dark:hover:text-white font-medium uppercase tracking-wider"
          >
            Done
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
