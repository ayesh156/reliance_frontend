import React, { useState, useEffect, useMemo } from 'react';
import { get } from '../../lib/api';
import type { ProductItem } from '../../types/product';
import { formatCurrency, getProductImageUrl, FALLBACK_IMAGE, handleImageError } from '../../lib/utils';
import { ProductQuickViewModal } from '../../components/storefront/ProductQuickViewModal';
import { StorefrontProductCard } from '../../components/storefront/StorefrontProductCard';
import { openWhatsAppChat } from '../../utils/whatsapp';
import {
  Search,
  SlidersHorizontal,
  X,
  Eye,
  Loader2,
  ChevronDown,
  RotateCcw,
  Sparkles,
  ShoppingBag,
  MessageSquare,
  ChevronRight,
} from 'lucide-react';

/**
 * ShopPage — Full Haute Couture catalog inspired by Chanel.com.
 * Seamlessly adapts to Light Haute Couture (Warm Alabaster Ivory #f8f8f6)
 * and Dark Haute Mode (Deep Obsidian #09090b).
 * 
 * Features:
 * - Animated artisanal denim wash & distressing workshop hero backdrop
 * - Soft matte blur (blur-[1px] opacity-25 dark:opacity-20)
 * - Zero external 404/403 console errors via local editorial assets & robust fallbacks
 * - High-contrast Deep Carbon typography and luxury frosted glass cards
 * - Optimized mobile grid (2-column) with filter drawer
 */
export const ShopPage: React.FC = () => {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSize, setSelectedSize] = useState<string>('all');
  const [selectedColor, setSelectedColor] = useState<string>('all');
  const [priceSort, setPriceSort] = useState<'default' | 'asc' | 'desc' | 'name'>('default');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const data = await get<ProductItem[]>('/products');
        if (Array.isArray(data)) {
          setProducts(data);
        }
      } catch (err) {
        console.error('Failed to load shop catalog:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCatalog();
  }, []);

  // Compute unique categories, sizes, and colors from products
  const { categories, sizes, colors } = useMemo(() => {
    const cats = new Set<string>();
    const szs = new Set<string>();
    const cls = new Set<string>();

    products.forEach((p) => {
      if (p.category?.name) cats.add(p.category.name);
      p.variants?.forEach((v) => {
        if (v.size) szs.add(v.size);
        if (v.color) cls.add(v.color);
      });
    });

    return {
      categories: Array.from(cats),
      sizes: Array.from(szs),
      colors: Array.from(cls),
    };
  }, [products]);

  // Filter & Sort Pipeline
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchesName = p.name.toLowerCase().includes(q);
          const matchesSearchKey = p.searchKey?.toLowerCase().includes(q);
          const matchesSku = p.variants?.some((v) => v.sku?.toLowerCase().includes(q));
          if (!matchesName && !matchesSearchKey && !matchesSku) return false;
        }

        // Category
        if (selectedCategory !== 'all') {
          const cat = p.category?.name || "Men's Wear";
          if (cat !== selectedCategory) return false;
        }

        // Size
        if (selectedSize !== 'all') {
          const hasSize = p.variants?.some((v) =>
            v.size?.toLowerCase().includes(selectedSize.toLowerCase())
          );
          if (!hasSize) return false;
        }

        // Color
        if (selectedColor !== 'all') {
          const hasColor = p.variants?.some((v) =>
            v.color?.toLowerCase().includes(selectedColor.toLowerCase())
          );
          if (!hasColor) return false;
        }

        // In Stock
        if (inStockOnly) {
          const totalStock = p.variants?.reduce((sum, v) => sum + (v.stock || 0), 0) || 0;
          if (totalStock <= 0) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const priceA = a.variants?.[0]?.retailPrice || 0;
        const priceB = b.variants?.[0]?.retailPrice || 0;
        if (priceSort === 'asc') return priceA - priceB;
        if (priceSort === 'desc') return priceB - priceA;
        if (priceSort === 'name') return a.name.localeCompare(b.name);
        return 0; // Default order
      });
  }, [
    products,
    searchQuery,
    selectedCategory,
    selectedSize,
    selectedColor,
    inStockOnly,
    priceSort,
  ]);

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedSize('all');
    setSelectedColor('all');
    setPriceSort('default');
    setInStockOnly(false);
  };

  const hasActiveFilters =
    searchQuery ||
    selectedCategory !== 'all' ||
    selectedSize !== 'all' ||
    selectedColor !== 'all' ||
    inStockOnly ||
    priceSort !== 'default';

  /**
   * Safely resolves product image URL, preventing empty src="" DOM warnings.
   */
  const safeImageUrl = (product: ProductItem): string => {
    const primaryVariant = product.variants?.[0];
    const primaryImage =
      primaryVariant?.imageUrl ||
      product.image ||
      product.images?.[0]?.imageUrl;
    const resolved = getProductImageUrl(primaryImage);
    return resolved || FALLBACK_IMAGE;
  };

  return (
    <div className="bg-[#f8f8f6] dark:bg-[#09090b] text-[#09090b] dark:text-zinc-50 min-h-screen transition-colors duration-300 ambient-alabaster-canvas">
      {/* ── Shop Page Hero with Animated Denim Distressing Backdrop ── */}
      <section className="relative overflow-hidden border-b border-[#e5e5e0] dark:border-zinc-900 pt-24 sm:pt-28 pb-14 sm:pb-16 mb-8 sm:mb-12">
        <div className="absolute inset-0 z-0 overflow-hidden">
          <img
            src="/images/editorial/denim-workshop.jpg"
            alt="Artisanal Denim Wash & Distressing Workshop"
            className="w-full h-full object-cover object-center blur-[1px] opacity-25 dark:opacity-20 animate-ken-burns will-change-transform"
            onError={(e) => {
              e.currentTarget.src = FALLBACK_IMAGE;
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#f8f8f6] via-[#f8f8f6]/80 to-transparent dark:from-[#09090b] dark:via-[#09090b]/80 dark:to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-[#f8f8f6]/50 to-[#f8f8f6] dark:via-[#09090b]/40 dark:to-[#09090b]" />
        </div>

        <div className="relative z-10 text-center max-w-3xl mx-auto px-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-zinc-300/80 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/60 text-emerald-600 dark:text-emerald-400 text-[10px] tracking-widest uppercase mb-4 shadow-sm backdrop-blur-md">
            <Sparkles className="w-3 h-3" />
            <span>Denim & Tee Runway Catalog</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-5xl md:text-6xl font-bold tracking-[0.2em] uppercase text-[#09090b] dark:text-white mb-4">
            The Collection
          </h1>
          <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 uppercase tracking-widest font-light leading-relaxed max-w-2xl mx-auto">
            Explore artisanal selvedge denim, premium heavyweight tees, and contemporary menswear crafted in Makandura, Matara.
          </p>
        </div>
      </section>

      {/* ── Main Catalog Grid & Controls Container ── */}
      <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-8 pb-16">
        {/* ── Filter & Search Control Bar ── */}
        <div className="border border-[#e5e5e0]/80 dark:border-zinc-900 bg-white/80 dark:bg-zinc-900/60 backdrop-blur-md p-3 sm:p-5 rounded-sm mb-10 space-y-4 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Search Bar */}
            <div className="relative w-full md:w-96">
              <Search className="w-4 h-4 text-zinc-400 dark:text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="SEARCH BY STYLE, SKU, OR TITLE..."
                className="w-full bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 pl-10 pr-4 py-2 text-xs uppercase tracking-wider text-[#09090b] dark:text-zinc-100 placeholder-zinc-500 dark:placeholder-zinc-600 rounded-sm focus:outline-none focus:border-zinc-950 dark:focus:border-white transition-colors shadow-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Right Actions: Sort + Mobile Filter Toggle */}
            <div className="flex items-center justify-between w-full md:w-auto gap-3">
              {/* Sort Dropdown */}
              <div className="relative flex-1 md:flex-none">
                <select
                  value={priceSort}
                  onChange={(e) => setPriceSort(e.target.value as typeof priceSort)}
                  className="w-full md:w-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs uppercase tracking-wider px-3.5 py-2 rounded-sm focus:outline-none focus:border-zinc-950 dark:focus:border-white transition-colors appearance-none pr-8 cursor-pointer shadow-sm"
                >
                  <option value="default">Sort: Recommended</option>
                  <option value="asc">Price: Low to High</option>
                  <option value="desc">Price: High to Low</option>
                  <option value="name">Alphabetical A-Z</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Mobile Filter Toggle */}
              <button
                onClick={() => setMobileFilterOpen(!mobileFilterOpen)}
                className="md:hidden flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs uppercase tracking-wider text-zinc-800 dark:text-zinc-200 rounded-sm shadow-sm"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Filters</span>
              </button>

              {/* Reset Action */}
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-zinc-500 hover:text-zinc-950 dark:hover:text-white transition-colors px-2 py-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span className="hidden sm:inline">Reset</span>
                </button>
              )}
            </div>
          </div>

          {/* Category Filter Pills (Desktop & Tablet) */}
          <div className="hidden md:flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-900">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 text-[10px] uppercase tracking-widest rounded-sm transition-all ${
                selectedCategory === 'all'
                  ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-semibold shadow-sm'
                  : 'bg-white/80 dark:bg-zinc-900/60 text-zinc-700 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white border border-zinc-200 dark:border-zinc-800'
              }`}
            >
              All Categories
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 text-[10px] uppercase tracking-widest rounded-sm transition-all ${
                  selectedCategory === cat
                    ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-semibold shadow-sm'
                    : 'bg-white/80 dark:bg-zinc-900/60 text-zinc-700 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white border border-zinc-200 dark:border-zinc-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile Filter Drawer */}
        {mobileFilterOpen && (
          <div className="md:hidden border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl p-4 rounded-sm mb-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
              <span className="font-serif text-xs font-bold uppercase tracking-wider text-zinc-950 dark:text-white">
                Filter Catalog
              </span>
              <button
                onClick={() => setMobileFilterOpen(false)}
                className="text-zinc-500 hover:text-zinc-950 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Categories */}
            <div>
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-2 font-mono">
                Category
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-2.5 py-1 text-[9px] uppercase tracking-wider rounded-sm ${
                    selectedCategory === 'all'
                      ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-semibold'
                      : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  All
                </button>
                {categories.map((c) => (
                  <button
                    key={c}
                    onClick={() => setSelectedCategory(c)}
                    className={`px-2.5 py-1 text-[9px] uppercase tracking-wider rounded-sm ${
                      selectedCategory === c
                        ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-semibold'
                        : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Stock Toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-900">
              <span className="text-[10px] uppercase tracking-wider text-zinc-700 dark:text-zinc-300 font-mono">
                In Stock Only
              </span>
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
                className="rounded border-zinc-300 text-zinc-950 focus:ring-0"
              />
            </div>
          </div>
        )}

        {/* ── Product Grid ── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-28 text-zinc-500">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-400 mb-3" />
            <p className="text-xs uppercase tracking-widest font-mono">
              Loading Reliance Haute Catalog...
            </p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-24 border border-[#e5e5e0] dark:border-zinc-900 rounded-sm bg-white/70 dark:bg-zinc-950/40 shadow-sm">
            <ShoppingBag className="w-8 h-8 mx-auto text-zinc-400 mb-3" />
            <p className="text-sm text-zinc-700 dark:text-zinc-400 uppercase tracking-widest mb-4">
              No garments found matching your selected criteria.
            </p>
            <button
              onClick={resetFilters}
              className="text-xs text-zinc-950 dark:text-white underline underline-offset-4 uppercase tracking-widest"
            >
              Reset all filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {filteredProducts.map((product) => (
              <StorefrontProductCard
                key={product.id}
                product={product}
                onQuickView={(p) => setSelectedProduct(p)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Quick View Modal ── */}
      <ProductQuickViewModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />
    </div>
  );
};
