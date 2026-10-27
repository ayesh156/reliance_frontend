import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import { get } from '../../lib/api';
import type { ProductItem, ProductVariant } from '../../types/product';
import { formatCurrency, getProductImageUrl, FALLBACK_IMAGE, handleImageError } from '../../lib/utils';
import { openProductWhatsAppInquiry } from '../../utils/whatsapp';
import { useAuth } from '../../contexts/AuthContext';
import { StorefrontProductCard } from '../../components/storefront/StorefrontProductCard';
import { ShareProductModal } from '../../components/storefront/ShareProductModal';
import { toast } from 'react-toastify';
import {
  ChevronRight,
  MessageSquare,
  Share2,
  Check,
  ShieldCheck,
  Scissors,
  Truck,
  RotateCcw,
  Sparkles,
  Loader2,
  Layers,
  ArrowLeft,
  ShoppingBag,
  Building2,
  Tag,
  Copy,
} from 'lucide-react';

export const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [product, setProduct] = useState<ProductItem | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Gallery state
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });

  // Variant selection
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);

  // Sharing & feedback
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // ── Pricing Tier Mode Enforcement ──
  // When tier=w or price=wholesale: wholesale ONLY mode
  // When tier=r or price=retail or no param: retail ONLY mode
  const tierParam = searchParams.get('tier') || searchParams.get('price');
  const isWholesaleMode = tierParam === 'w' || tierParam === 'wholesale';

  // 1. Fetch Product by ID or slug
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

    const fetchProduct = async () => {
      try {
        const data = await get<ProductItem>(`/products/${id}`);
        if (data && data.id) {
          setProduct(data);
          // Set initial variant selections
          if (Array.isArray(data.variants) && data.variants.length > 0) {
            const first = data.variants[0];
            setSelectedSize(first.size || '');
            setSelectedColor(first.color || '');
          }
        } else {
          setError('Product not found or currently unavailable.');
        }
      } catch (err: any) {
        console.error('Failed to fetch product:', err);
        setError('Failed to load product details.');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  // 2. Fetch Catalog for Related Products
  useEffect(() => {
    if (!product) return;
    const fetchRelated = async () => {
      try {
        const all = await get<ProductItem[]>('/products');
        if (Array.isArray(all)) {
          // Exclude current product, prioritize same category
          const filtered = all
            .filter((p) => p.id !== product.id)
            .sort((a, b) => {
              const aSameCat = a.categoryId === product.categoryId ? -1 : 1;
              const bSameCat = b.categoryId === product.categoryId ? -1 : 1;
              return aSameCat - bSameCat;
            })
            .slice(0, 8);
          setRelatedProducts(filtered);
        }
      } catch {
        // Silent fallback
      }
    };
    fetchRelated();
  }, [product?.id, product?.categoryId]);

  // Aggregate all gallery images
  const galleryImages = useMemo(() => {
    if (!product) return [FALLBACK_IMAGE];
    const urls: string[] = [];
    const seen = new Set<string>();

    const addImg = (rawUrl?: string | null) => {
      if (!rawUrl) return;
      const resolved = getProductImageUrl(rawUrl);
      if (resolved && !seen.has(resolved)) {
        seen.add(resolved);
        urls.push(resolved);
      }
    };

    // 1. Product Images relation
    if (Array.isArray(product.images) && product.images.length > 0) {
      product.images.forEach((img) => addImg(img.imageUrl));
    }

    // 2. Variants custom images
    if (Array.isArray(product.variants)) {
      product.variants.forEach((v) => addImg(v.imageUrl));
    }

    // 3. Fallback product image field
    if (product.image) addImg(product.image);

    return urls.length > 0 ? urls : [FALLBACK_IMAGE];
  }, [product]);

  // Unique sizes and colors available for this product
  const { availableSizes, availableColors } = useMemo(() => {
    if (!product?.variants) return { availableSizes: [], availableColors: [] };
    const szs = new Set<string>();
    const cls = new Set<string>();

    product.variants.forEach((v) => {
      if (v.size) szs.add(v.size);
      if (v.color) cls.add(v.color);
    });

    return {
      availableSizes: Array.from(szs),
      availableColors: Array.from(cls),
    };
  }, [product]);

  // Active matching variant
  const activeVariant: ProductVariant | undefined = useMemo(() => {
    if (!product?.variants || product.variants.length === 0) return undefined;

    // Strict match both size & color
    let matched = product.variants.find(
      (v) =>
        (!selectedSize || v.size === selectedSize) &&
        (!selectedColor || v.color === selectedColor)
    );

    // Fallback: match size only
    if (!matched && selectedSize) {
      matched = product.variants.find((v) => v.size === selectedSize);
    }

    // Fallback: match color only
    if (!matched && selectedColor) {
      matched = product.variants.find((v) => v.color === selectedColor);
    }

    return matched || product.variants[0];
  }, [product, selectedSize, selectedColor]);

  // When variant changes, auto-switch gallery image if variant has its own image
  useEffect(() => {
    if (activeVariant?.imageUrl) {
      const resolved = getProductImageUrl(activeVariant.imageUrl);
      const idx = galleryImages.findIndex((url) => url === resolved);
      if (idx !== -1) {
        setActiveImageIndex(idx);
      }
    }
  }, [activeVariant, galleryImages]);

  // Active pricing based on mode
  const retailPrice = activeVariant?.retailPrice || 0;
  const wholesalePrice = activeVariant?.wholesalePrice || retailPrice;
  const activeStock = activeVariant?.stock || 0;
  const totalCatalogStock = product?.variants?.reduce((sum, v) => sum + (v.stock || 0), 0) || 0;

  // Zoom lens handler
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setZoomPos({ x, y });
  };

  // WhatsApp Inquiry CTA Action
  const handleWhatsAppInquiry = () => {
    if (!product) return;
    const tier = isWholesaleMode ? 'wholesale' : 'retail';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const productUrl = `${origin}/product/${product.id}${isWholesaleMode ? '?tier=w' : '?tier=r'}`;
    openProductWhatsAppInquiry(product, activeVariant, tier, productUrl);
  };

  // Share Link Action
  const handleCopyLink = async () => {
    if (!product) return;

    if (user) {
      setShareModalOpen(true);
      return;
    }

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${origin}/product/${product.id}${isWholesaleMode ? '?tier=w' : '?tier=r'}`;

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
      toast.success(isWholesaleMode ? 'Wholesale price product link copied!' : 'Retail price product link copied!');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast.error('Failed to copy product link');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center bg-[#f8f8f6] dark:bg-[#09090b] text-zinc-600 dark:text-zinc-400">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400 mb-3" />
        <p className="text-xs uppercase tracking-widest font-mono">
          Loading Reliance Product Atelier...
        </p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 bg-[#f8f8f6] dark:bg-[#09090b] text-center">
        <ShoppingBag className="w-12 h-12 text-zinc-400 mb-4" />
        <h2 className="font-serif text-xl font-bold uppercase tracking-wide text-zinc-900 dark:text-white mb-2">
          {error || 'Product Not Found'}
        </h2>
        <p className="text-xs text-zinc-500 max-w-sm mb-6">
          The requested garment might have been archived or is temporarily out of runway catalog circulation.
        </p>
        <Link
          to="/shop"
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 text-xs uppercase tracking-widest font-semibold rounded-sm hover:opacity-90 transition-opacity"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Shop</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f8f6] dark:bg-[#09090b] text-[#09090b] dark:text-[#f8f8f6] transition-colors duration-300">
      {/* ── Breadcrumbs Bar ── */}
      <div className="border-b border-[#e5e5e0] dark:border-zinc-900 bg-white/50 dark:bg-zinc-950/40 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400 truncate">
            <Link to="/" className="hover:text-zinc-950 dark:hover:text-white transition-colors">
              Home
            </Link>
            <ChevronRight className="w-3 h-3 shrink-0" />
            <Link to="/shop" className="hover:text-zinc-950 dark:hover:text-white transition-colors">
              Shop
            </Link>
            <ChevronRight className="w-3 h-3 shrink-0" />
            {product.category?.name && (
              <>
                <span className="text-zinc-600 dark:text-zinc-400 truncate">
                  {product.category.name}
                </span>
                <ChevronRight className="w-3 h-3 shrink-0" />
              </>
            )}
            <span className="text-zinc-900 dark:text-zinc-100 font-semibold truncate">
              {product.name}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-4">
            {isWholesaleMode && (
              <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded bg-amber-500/95 text-white font-mono shadow-xs">
                Wholesale Pricing Active
              </span>
            )}
            <button
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] uppercase tracking-wider rounded border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-colors"
              title="Share / Copy Link"
            >
              {copiedLink ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              <span className="hidden sm:inline">Share</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Product Display Area ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          
          {/* ── Left Column: AliExpress-Style Multi-Image Interactive Gallery (5/12 cols) ── */}
          <div className="lg:col-span-6 flex flex-col-reverse sm:flex-row gap-3 sm:gap-4">
            {/* Thumbnail Strip */}
            {galleryImages.length > 1 && (
              <div className="flex sm:flex-col gap-2 overflow-x-auto sm:overflow-y-auto max-h-[560px] pb-2 sm:pb-0 scrollbar-thin">
                {galleryImages.map((imgUrl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveImageIndex(idx)}
                    className={`relative w-14 h-16 sm:w-16 sm:h-20 shrink-0 rounded-sm overflow-hidden border transition-all ${
                      activeImageIndex === idx
                        ? 'border-zinc-950 dark:border-white ring-1 ring-zinc-950 dark:ring-white shadow-md'
                        : 'border-zinc-200 dark:border-zinc-800 opacity-70 hover:opacity-100 hover:border-zinc-400'
                    }`}
                  >
                    <img
                      src={imgUrl}
                      alt={`${product.name} - ${idx + 1}`}
                      className="w-full h-full object-cover"
                      onError={handleImageError}
                    />
                  </button>
                ))}
              </div>
            )}

            {/* Main Crisp Preview with Zoomable Lens */}
            <div
              className="relative aspect-[3/4] flex-1 w-full rounded-sm overflow-hidden bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-md group cursor-crosshair"
              onMouseEnter={() => setIsZoomed(true)}
              onMouseLeave={() => setIsZoomed(false)}
              onMouseMove={handleMouseMove}
            >
              <img
                src={galleryImages[activeImageIndex] || FALLBACK_IMAGE}
                alt={product.name}
                className="w-full h-full object-cover transition-transform duration-300"
                style={
                  isZoomed
                    ? {
                        transformOrigin: `${zoomPos.x}% ${zoomPos.y}%`,
                        transform: 'scale(1.9)',
                      }
                    : { transform: 'scale(1)' }
                }
                onError={handleImageError}
              />

              {/* SKU Badge */}
              <div className="absolute top-3 left-3 pointer-events-none">
                <span className="text-[9px] uppercase tracking-widest font-mono px-2 py-0.5 rounded-full bg-white/95 text-zinc-900 border border-zinc-200 dark:bg-zinc-950/85 dark:text-zinc-200 dark:border-zinc-800 backdrop-blur-sm shadow-sm font-semibold">
                  {activeVariant?.sku || product.searchKey || `SKU #${product.id}`}
                </span>
              </div>

              {/* Stock Warning Badge */}
              {activeStock > 0 && activeStock <= 15 && (
                <div className="absolute top-3 right-3 pointer-events-none">
                  <span className="text-[9px] uppercase tracking-widest font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-400 dark:border-emerald-800 backdrop-blur-sm shadow-sm font-bold">
                    Only {activeStock} Left
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── Right Column: Product Info, Variant Selectors & CTAs (6/12 cols) ── */}
          <div className="lg:col-span-6 space-y-6">
            
            {/* Header / Category / Brand */}
            <div>
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-mono mb-2">
                <span>{product.category?.name || "Men's Apparel"}</span>
                <span>•</span>
                <span>Reliance Branded Clothing</span>
              </div>
              <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#09090b] dark:text-white uppercase leading-snug">
                {product.name}
              </h1>
              {product.searchKey && (
                <div className="mt-1 text-xs font-mono text-zinc-500 dark:text-zinc-400">
                  Style Code / Model: <span className="font-semibold text-zinc-900 dark:text-zinc-200">{product.searchKey}</span>
                </div>
              )}
            </div>

            {/* ── Price Section (Strictly Enforces Wholesale vs. Retail Tier Mode) ── */}
            <div className="p-4 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/60 backdrop-blur-md shadow-sm">
              <div className="flex items-baseline gap-3">
                {isWholesaleMode ? (
                  // WHOLESALE MODE: Show ONLY Wholesale Price
                  <div>
                    <span className="text-[9px] uppercase tracking-[0.2em] font-mono text-amber-600 dark:text-amber-400 font-bold mb-0.5 flex items-center gap-1.5">
                      <Building2 className="w-3 h-3" />
                      Wholesale Price (Authorized B2B)
                    </span>
                    <div className="text-2xl sm:text-3xl font-bold font-mono text-amber-700 dark:text-amber-400 tracking-tight">
                      {formatCurrency(wholesalePrice)}
                    </div>
                  </div>
                ) : (
                  // RETAIL MODE: Show ONLY Retail Price
                  <div>
                    <span className="text-[9px] uppercase tracking-[0.2em] font-mono text-zinc-500 font-semibold mb-0.5 flex items-center gap-1.5">
                      <Tag className="w-3 h-3 text-zinc-400" />
                      Retail Price
                    </span>
                    <div className="text-2xl sm:text-3xl font-bold font-mono text-zinc-950 dark:text-white tracking-tight">
                      {formatCurrency(retailPrice)}
                    </div>
                  </div>
                )}
              </div>

              {/* Stock Status Pill */}
              <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-500">Inventory Status:</span>
                {activeStock > 0 ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    In Stock ({activeStock} available)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold">
                    <span className="size-1.5 rounded-full bg-rose-500" />
                    Currently Out of Stock
                  </span>
                )}
              </div>
            </div>

            {/* ── Interactive Variant Selectors ── */}
            <div className="space-y-4 pt-2">
              {/* Size Selector Pills */}
              {availableSizes.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-900 dark:text-zinc-100 font-mono">
                      Select Size: <span className="font-bold text-emerald-600 dark:text-emerald-400">{selectedSize || 'Any'}</span>
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {availableSizes.map((size) => {
                      const isSelected = selectedSize === size;
                      const hasStockForSize = product.variants?.some(
                        (v) => v.size === size && (v.stock || 0) > 0
                      );

                      return (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setSelectedSize(size)}
                          className={`min-w-[44px] h-10 px-3.5 text-xs font-mono uppercase tracking-wider rounded-sm border transition-all flex items-center justify-center font-bold ${
                            isSelected
                              ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950 dark:border-white shadow-md'
                              : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-600'
                          } ${!hasStockForSize ? 'opacity-40 line-through' : ''}`}
                        >
                          {size}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Color Selector Pills */}
              {availableColors.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-900 dark:text-zinc-100 font-mono">
                      Select Color: <span className="font-bold text-emerald-600 dark:text-emerald-400">{selectedColor || 'Original'}</span>
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {availableColors.map((color) => {
                      const isSelected = selectedColor === color;
                      return (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setSelectedColor(color)}
                          className={`h-9 px-3.5 text-xs font-mono rounded-sm border transition-all flex items-center gap-2 font-medium ${
                            isSelected
                              ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950 dark:border-white shadow-md'
                              : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400'
                          }`}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full border border-black/20 shrink-0"
                            style={{
                              backgroundColor: color.toLowerCase().includes('black')
                                ? '#18181b'
                                : color.toLowerCase().includes('white')
                                ? '#ffffff'
                                : color.toLowerCase().includes('blue') || color.toLowerCase().includes('denim')
                                ? '#1d4ed8'
                                : color.toLowerCase().includes('grey') || color.toLowerCase().includes('gray')
                                ? '#6b7280'
                                : color.toLowerCase().includes('navy')
                                ? '#0f172a'
                                : color.toLowerCase().includes('brown')
                                ? '#78350f'
                                : color.toLowerCase().includes('green')
                                ? '#15803d'
                                : '#a1a1aa',
                            }}
                          />
                          <span>{color}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quantity Counter */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-900 dark:text-zinc-100 font-mono block mb-2">
                  Quantity (Pcs):
                </label>
                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      disabled={quantity <= 1}
                      className="w-9 h-9 flex items-center justify-center text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40"
                    >
                      -
                    </button>
                    <span className="w-12 text-center text-xs font-mono font-bold text-zinc-900 dark:text-white">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.min(activeStock > 0 ? activeStock : 999, q + 1))}
                      className="w-9 h-9 flex items-center justify-center text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      +
                    </button>
                  </div>
                  <span className="text-[11px] text-zinc-500 font-mono">
                    Total: <strong className="text-zinc-900 dark:text-white font-mono">{formatCurrency((isWholesaleMode ? wholesalePrice : retailPrice) * quantity)}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* ── Action Buttons: WhatsApp Primary CTA + Copy Link ── */}
            <div className="pt-4 space-y-3">
              {/* Primary CTA: Inquire / Order on WhatsApp */}
              <button
                type="button"
                onClick={handleWhatsAppInquiry}
                className="w-full py-3.5 px-6 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs uppercase tracking-[0.2em] shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer"
              >
                <MessageSquare className="w-4 h-4 fill-white" />
                <span>Inquire / Order on WhatsApp</span>
              </button>

              {/* Secondary CTA: Copy Share Link */}
              <button
                type="button"
                onClick={handleCopyLink}
                className="w-full py-3 px-6 rounded border border-zinc-300 hover:border-zinc-950 dark:border-zinc-800 dark:hover:border-white bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-900 dark:text-white font-semibold text-xs uppercase tracking-[0.2em] shadow-xs flex items-center justify-center gap-2 transition-all"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Product Link Copied!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" />
                    <span>Share / Copy Product Link</span>
                  </>
                )}
              </button>
            </div>

            {/* Product Details & Specifications */}
            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
              <h4 className="font-serif text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-200">
                Atelier Craftsmanship &amp; Garment Details
              </h4>
              <p>
                {product.description ||
                  'Crafted with premium Sri Lankan industrial stitching, reinforced bar-tacks, and bespoke finishing. Designed for durability and refined masculine style.'}
              </p>

              {/* Pillars */}
              <div className="grid grid-cols-2 gap-3 pt-2 font-mono text-[11px]">
                <div className="flex items-center gap-2">
                  <Scissors className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  <span>Master Tailored Fit</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  <span>Quality Inspected</span>
                </div>
                <div className="flex items-center gap-2">
                  <Truck className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  <span>Islandwide Delivery</span>
                </div>
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  <span>Wholesale &amp; Retail</span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ── AliExpress-Inspired "Related / Similar Products" Grid ── */}
        <section className="mt-16 sm:mt-24 pt-10 border-t border-[#e5e5e0] dark:border-zinc-900">
          <div className="flex items-end justify-between mb-8">
            <div>
              <span className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 font-mono block mb-1">
                Explore More From The Runway
              </span>
              <h3 className="font-serif text-xl sm:text-2xl font-bold uppercase tracking-wide text-[#09090b] dark:text-white">
                Related &amp; Similar Styles
              </h3>
            </div>
            <Link
              to="/shop"
              className="text-xs uppercase tracking-widest font-mono text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white flex items-center gap-1 transition-colors"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {relatedProducts.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {relatedProducts.map((relProduct) => (
                <StorefrontProductCard
                  key={relProduct.id}
                  product={relProduct}
                  priceTier={isWholesaleMode ? 'wholesale' : 'retail'}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-xs font-mono text-zinc-500">
              No additional similar products available at this time.
            </div>
          )}
        </section>
      </div>

      {/* Authenticated Pricing Share Dialog */}
      {shareModalOpen && (
        <ShareProductModal
          open={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          product={product}
        />
      )}
    </div>
  );
};
