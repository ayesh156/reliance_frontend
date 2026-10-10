import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { get } from '../../lib/api';
import type { ProductItem } from '../../types/product';
import { formatCurrency, getProductImageUrl, FALLBACK_IMAGE } from '../../lib/utils';
import { ProductQuickViewModal } from '../../components/storefront/ProductQuickViewModal';
import {
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Scissors,
  CheckCircle2,
  ChevronRight,
  Eye,
  Loader2,
  Layers,
  Award,
  Compass,
  MessageSquare,
} from 'lucide-react';

/**
 * HomePage — Haute Couture editorial storefront landing page inspired by Chanel.com.
 * Seamlessly adapts to Light Haute Couture (Warm Alabaster Ivory #f8f8f6)
 * and Dark Haute Mode (Deep Obsidian #09090b).
 * 
 * Features:
 * - Hardware-accelerated Ken Burns animated raw selvedge denim hero backdrop
 * - Zero external 404/403 console errors via local editorial assets & robust fallbacks
 * - Elegant Alabaster & Champagne Ivory atmosphere without stark white glare
 * - Deep carbon high-contrast typography
 * - Dynamic product showcase and craftsmanship pillars
 */
export const HomePage: React.FC = () => {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'denim' | 'tees' | 'shorts' | 'trousers'>('all');
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [vipEmail, setVipEmail] = useState('');
  const [vipSubmitted, setVipSubmitted] = useState(false);

  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const data = await get<ProductItem[]>('/products');
        if (Array.isArray(data)) {
          setProducts(data);
        }
      } catch (err) {
        console.error('Failed to fetch home products:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCatalog();
  }, []);

  // Filter products by tab
  const filteredProducts = products.filter((p) => {
    if (activeTab === 'all') return true;
    const nameLower = p.name.toLowerCase();
    const catLower = (p.category?.name || '').toLowerCase();
    if (activeTab === 'denim') return nameLower.includes('denim') || catLower.includes('denim');
    if (activeTab === 'tees') return nameLower.includes('tee') || nameLower.includes('t-shirt') || nameLower.includes('tshirt') || catLower.includes('tee') || catLower.includes('t-shirt');
    if (activeTab === 'shorts') return nameLower.includes('short');
    if (activeTab === 'trousers') return nameLower.includes('trouser') || nameLower.includes('fold');
    return true;
  });

  const handleVipSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (vipEmail.trim()) {
      setVipSubmitted(true);
      setVipEmail('');
    }
  };

  /**
   * Safely resolves product image URL, preventing empty src="" DOM warnings.
   * Falls back to brand logo when no image is available.
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
    <div className="bg-[#f8f8f6] dark:bg-[#09090b] text-[#09090b] dark:text-zinc-50 overflow-hidden transition-colors duration-300 ambient-alabaster-canvas min-h-screen">
      {/* ── 1. Full-Bleed Cinematic Hero — Denim & Tee Editorial ── */}
      <section className="relative min-h-[92vh] flex items-center justify-center border-b border-[#e5e5e0] dark:border-zinc-900 overflow-hidden">
        {/* Background Editorial Visual — Hardware-Accelerated Ken Burns Selvedge Denim Texture */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <img
            src="/images/editorial/hero-denim.jpg"
            alt="Raw Selvedge Denim Editorial Texture"
            className="w-full h-full object-cover object-center animate-ken-burns opacity-35 dark:opacity-35 filter brightness-105 contrast-110 dark:brightness-80 dark:contrast-125 will-change-transform"
            onError={(e) => {
              e.currentTarget.src = FALLBACK_IMAGE;
            }}
          />
          {/* Dual Luxury Gradient Vignettes dynamically styled for Alabaster vs Obsidian */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#f8f8f6] via-[#f8f8f6]/75 to-transparent dark:from-[#09090b] dark:via-[#09090b]/70 dark:to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-[#f8f8f6]/50 to-[#f8f8f6] dark:via-[#09090b]/40 dark:to-[#09090b]" />
        </div>

        {/* Content Container — Ample Vertical Top Spacing for Sticky Navbar */}
        <div className="relative z-10 max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 text-center pt-24 sm:pt-28 pb-20 sm:pb-24">
          {/* Haute Couture Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-zinc-300/80 dark:border-zinc-700/80 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md text-[10px] sm:text-xs uppercase tracking-[0.3em] text-zinc-800 dark:text-zinc-200 mb-8 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Autumn / Winter 2026 Denim & Tee Collection</span>
          </div>

          {/* Main Cinematic Title */}
          <h1 className="font-serif text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-[0.2em] uppercase text-[#09090b] dark:text-white leading-tight sm:leading-tight mb-6">
            RELIANCE
            <span className="block text-xl sm:text-2xl md:text-3xl font-light tracking-[0.35em] text-zinc-700 dark:text-zinc-300 mt-3">
              DENIM & HEAVYWEIGHT TEES
            </span>
          </h1>

          {/* Editorial Subline */}
          <p className="max-w-2xl mx-auto text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 uppercase tracking-[0.22em] font-light leading-relaxed mb-10">
            Raw selvedge denim, washed finishes, and premium heavyweight cotton tees — precision-engineered in Makandura, Matara.
          </p>

          {/* Editorial CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
            <Link
              to="/shop"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 text-xs font-semibold uppercase tracking-[0.24em] rounded-sm transition-all duration-300 shadow-xl"
            >
              <span>Explore Collection</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>

            <Link
              to="/about"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-white/90 hover:bg-white border border-zinc-300 text-zinc-950 dark:bg-zinc-900/80 dark:hover:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200 text-xs font-medium uppercase tracking-[0.24em] rounded-sm transition-all duration-300 shadow-sm"
            >
              <span>The Atelier Story</span>
            </Link>
          </div>

          {/* Tailoring Attributes Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto mt-16 pt-10 border-t border-[#e5e5e0] dark:border-zinc-800/80 text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-zinc-700 dark:text-zinc-400 font-mono">
            <div>&bull; 100% Sri Lankan Made</div>
            <div>&bull; Heavy Selvedge Denim</div>
            <div>&bull; Premium Cotton Tees</div>
            <div>&bull; Wholesale & Retail</div>
          </div>
        </div>
      </section>

      {/* ── 2. Featured Collections (Dynamic GET /api/products) ── */}
      <section className="py-20 sm:py-28 px-2 sm:px-4 md:px-8 max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 border-b border-[#e5e5e0] dark:border-zinc-900 pb-8">
          <div>
            <div className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-400 font-mono mb-2">
              Curated Garment Showcase
            </div>
            <h2 className="font-serif text-2xl sm:text-4xl font-bold tracking-[0.16em] uppercase text-[#09090b] dark:text-white">
              Featured Collections
            </h2>
          </div>

          {/* Minimalist Filter Tabs — Denim & Tee focused */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {(
              [
                { id: 'all', label: 'All Garments' },
                { id: 'denim', label: 'Selvedge Denim' },
                { id: 'tees', label: 'Heavyweight Tees' },
                { id: 'shorts', label: 'Denim Shorts' },
                { id: 'trousers', label: 'Utility Trousers' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-[10px] sm:text-xs uppercase tracking-[0.2em] rounded-sm transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-semibold shadow-sm'
                    : 'bg-white/80 dark:bg-zinc-900/60 text-zinc-700 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white border border-[#e5e5e0] dark:border-zinc-800 shadow-sm'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Products Grid — Mobile-optimized 2-column */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-zinc-500">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-400 mb-3" />
            <p className="text-xs uppercase tracking-widest font-mono">
              Loading Reliance Runway Catalog...
            </p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20 border border-[#e5e5e0] dark:border-zinc-900 rounded-sm bg-white/70 dark:bg-zinc-950/40 shadow-sm">
            <p className="text-sm text-zinc-700 dark:text-zinc-400 uppercase tracking-widest mb-4">
              No garments found matching this selection.
            </p>
            <button
              onClick={() => setActiveTab('all')}
              className="text-xs text-zinc-950 dark:text-white underline underline-offset-4 uppercase tracking-widest"
            >
              Reset to all collections
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {filteredProducts.slice(0, 8).map((product) => {
              const primaryVariant = product.variants?.[0];
              const price = primaryVariant?.retailPrice || 0;
              const imageUrl = safeImageUrl(product);
              const totalStock = product.variants?.reduce((sum, v) => sum + (v.stock || 0), 0) || 0;

              return (
                <div
                  key={product.id}
                  className="group relative bg-white/80 dark:bg-zinc-900/60 backdrop-blur-md border border-[#e5e5e0]/80 dark:border-zinc-800/80 hover:border-zinc-400 dark:hover:border-zinc-700 rounded-sm transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_10px_25px_-5px_rgba(0,0,0,0.08)]"
                >
                  {/* Image Presentation with luxury hover zoom */}
                  <div className="relative aspect-[3/4] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
                    <img
                      src={imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.src = FALLBACK_IMAGE;
                      }}
                    />

                    {/* Quick View Hover Overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center p-3 sm:p-4">
                      <button
                        onClick={() => setSelectedProduct(product)}
                        className="w-full py-2 sm:py-2.5 px-3 sm:px-4 bg-zinc-950/95 text-white hover:bg-zinc-900 dark:bg-white/95 dark:text-zinc-950 dark:hover:bg-white text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.2em] rounded-sm shadow-xl flex items-center justify-center gap-1.5 sm:gap-2 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300"
                      >
                        <Eye className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        <span>Quick View</span>
                      </button>
                    </div>

                    {/* Stock/Edition Badge */}
                    <div className="absolute top-2 left-2 sm:top-3 sm:left-3">
                      <span className="text-[8px] sm:text-[9px] uppercase tracking-widest font-mono px-1.5 sm:px-2 py-0.5 rounded-full bg-white/95 text-zinc-800 border border-zinc-200 dark:bg-zinc-950/80 dark:text-zinc-300 dark:border-zinc-800 backdrop-blur-sm shadow-sm font-medium">
                        {product.searchKey || 'Reliance Cut'}
                      </span>
                    </div>

                    {/* Crafted Edition Badge */}
                    {totalStock > 0 && totalStock <= 20 && (
                      <div className="absolute top-2 right-2 sm:top-3 sm:right-3">
                        <span className="text-[8px] sm:text-[9px] uppercase tracking-widest font-mono px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-400 dark:border-emerald-800/60 backdrop-blur-sm shadow-sm font-medium">
                          Only {totalStock} Left
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Garment Details Card */}
                  <div className="p-3 sm:p-4 flex flex-col flex-1 justify-between bg-transparent">
                    <div>
                      <div className="flex items-center justify-between text-[9px] sm:text-[10px] uppercase tracking-widest text-zinc-600 dark:text-zinc-400 font-mono mb-1">
                        <span>{product.category?.name || "Men's Wear"}</span>
                        <span>Reliance</span>
                      </div>
                      <h3 className="font-serif text-xs sm:text-sm font-semibold tracking-wide uppercase text-[#09090b] dark:text-white line-clamp-1 group-hover:text-zinc-700 dark:group-hover:text-zinc-200 transition-colors">
                        {product.name}
                      </h3>
                    </div>

                    <div className="mt-3 pt-3 border-t border-[#e5e5e0] dark:border-zinc-900 flex items-center justify-between">
                      <div>
                        <span className="block text-[8px] uppercase tracking-wider text-zinc-500 font-mono">
                          Retail Price
                        </span>
                        <span className="font-mono text-xs sm:text-sm font-bold text-[#09090b] dark:text-white">
                          {formatCurrency(price)}
                        </span>
                      </div>

                      <button
                        onClick={() => {
                          const text = encodeURIComponent(
                            `Hello Reliance Atelier,\nI am interested in:\n- ${product.name} (${product.searchKey || 'SKU'})\n- Price: ${formatCurrency(price)}\nPlease confirm availability.`
                          );
                          window.open(`https://wa.me/94711350123?text=${text}`, '_blank');
                        }}
                        className="p-1.5 sm:p-2 text-zinc-700 dark:text-zinc-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-sm transition-colors"
                        title="Inquire via WhatsApp"
                      >
                        <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* View Full Catalog Link */}
        <div className="mt-12 text-center">
          <Link
            to="/shop"
            className="inline-flex items-center gap-2 px-8 py-3.5 border border-zinc-300 hover:border-zinc-950 dark:border-zinc-800 dark:hover:border-white text-xs font-semibold uppercase tracking-[0.22em] text-[#09090b] dark:text-white rounded-sm hover:bg-zinc-950 hover:text-white dark:hover:bg-white dark:hover:text-zinc-950 transition-all duration-300 shadow-sm"
          >
            <span>Browse Full Runway Catalog ({products.length} Designs)</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </section>

      {/* ── 3. High-Fashion Denim Editorial Split Banner ── */}
      <section className="border-y border-[#e5e5e0] dark:border-zinc-900 bg-white/60 dark:bg-zinc-950 transition-colors">
        <div className="grid grid-cols-1 lg:grid-cols-2">
          <div className="relative aspect-[4/3] lg:aspect-auto min-h-[420px] overflow-hidden">
            <img
              src="/images/editorial/denim-workshop.jpg"
              alt="Raw Selvedge Denim Craftsmanship Close-Up"
              className="w-full h-full object-cover filter contrast-110 brightness-95 dark:brightness-90 animate-ken-burns will-change-transform"
              onError={(e) => {
                e.currentTarget.src = FALLBACK_IMAGE;
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#f8f8f6]/80 dark:to-[#09090b]/80 hidden lg:block" />
          </div>

          <div className="p-6 sm:p-12 lg:p-16 flex flex-col justify-center space-y-6">
            <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-400 font-mono">
              <Award className="w-3.5 h-3.5" />
              <span>Denim & Tee Atelier Standards</span>
            </div>

            <h2 className="font-serif text-2xl sm:text-4xl font-bold tracking-[0.16em] uppercase text-[#09090b] dark:text-white leading-snug">
              Selvedge Soul.<br />Heavyweight Heart.
            </h2>

            <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed font-light">
              Every Reliance garment begins with carefully sourced raw and washed denim or premium heavyweight cotton. Our denim joggers, selvedge cuts, and graphic tees are designed for lasting masculine proportion and streetwear credibility.
            </p>

            <div className="grid grid-cols-2 gap-6 pt-4 border-t border-[#e5e5e0] dark:border-zinc-900 text-xs">
              <div>
                <span className="block font-serif text-xl font-bold text-[#09090b] dark:text-white mb-1">
                  100%
                </span>
                <span className="text-[10px] uppercase tracking-wider text-zinc-600 dark:text-zinc-400 font-medium">
                  Pre-Shrunk Quality
                </span>
              </div>
              <div>
                <span className="block font-serif text-xl font-bold text-[#09090b] dark:text-white mb-1">
                  12oz+
                </span>
                <span className="text-[10px] uppercase tracking-wider text-zinc-600 dark:text-zinc-400 font-medium">
                  Heavyweight Denim
                </span>
              </div>
            </div>

            <div className="pt-2">
              <Link
                to="/about"
                className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] font-semibold text-[#09090b] hover:text-zinc-700 dark:text-white dark:hover:text-zinc-300 transition-colors"
              >
                <span>Read the Manufacturing Heritage</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Craftsmanship Showcase (Minimalist Typography) ── */}
      <section className="py-20 sm:py-28 px-2 sm:px-4 md:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-zinc-600 dark:text-zinc-400 font-mono mb-2">
            The Atelier Pillars
          </div>
          <h2 className="font-serif text-2xl sm:text-4xl font-bold tracking-[0.18em] uppercase text-[#09090b] dark:text-white">
            Manufacturing Craftsmanship
          </h2>
          <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 uppercase tracking-widest mt-3 font-light">
            Rooted in Makandura, Matara · Southern Province
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-8">
          {[
            {
              num: '01',
              title: 'Artisanal Precision',
              desc: 'Master pattern drafting with millimetric tolerances. Hand-guided edge stitching on industrial high-tension lockstitch machines.',
              icon: Scissors,
            },
            {
              num: '02',
              title: 'Architectural Fit',
              desc: 'Engineered specifically for masculine proportions. Reinforced crotches, ergonomic knee folds, and durable waistband stability.',
              icon: Compass,
            },
            {
              num: '03',
              title: 'Ethical Fabric Sourcing',
              desc: 'Only vetted denim mills and premium cotton suppliers. Integrated raw material inventory with full traceability.',
              icon: Layers,
            },
            {
              num: '04',
              title: 'Scrap Recovery Protocol',
              desc: 'Advanced fabric consumption algorithms ensure leftover textile scraps are categorized, tracked, and repurposed sustainably.',
              icon: ShieldCheck,
            },
          ].map((pillar) => (
            <div
              key={pillar.num}
              className="p-5 sm:p-6 md:p-8 bg-white/80 dark:bg-zinc-900/60 backdrop-blur-md border border-[#e5e5e0]/80 dark:border-zinc-800/80 rounded-sm hover:border-zinc-400 dark:hover:border-zinc-700 transition-all duration-300 flex flex-col justify-between space-y-4 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_10px_25px_-5px_rgba(0,0,0,0.08)]"
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <span className="font-serif text-xl font-bold text-zinc-400 dark:text-zinc-600">
                    {pillar.num}
                  </span>
                  <pillar.icon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="font-serif text-sm font-semibold tracking-wider uppercase text-[#09090b] dark:text-white mb-2">
                  {pillar.title}
                </h3>
                <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed font-light">
                  {pillar.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 5. Newsletter / VIP Access ── */}
      <section className="py-20 border-t border-[#e5e5e0] dark:border-zinc-900 bg-[#f0ede6]/40 dark:bg-zinc-950/80 transition-colors">
        <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-300 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900 text-[10px] uppercase tracking-widest text-zinc-800 dark:text-zinc-200 shadow-sm font-medium">
            <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            <span>Private Concierge</span>
          </div>

          <h2 className="font-serif text-2xl sm:text-4xl font-bold tracking-[0.2em] uppercase text-[#09090b] dark:text-white">
            Join The Reliance VIP Circle
          </h2>

          <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 uppercase tracking-widest max-w-lg mx-auto font-light leading-relaxed">
            Gain immediate access to private wholesale lookbooks, priority bespoke cuts, and runway updates.
          </p>

          {vipSubmitted ? (
            <div className="inline-flex items-center gap-3 px-6 py-4 rounded-sm bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-emerald-600 dark:text-emerald-400 text-xs tracking-wider shadow-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
              <span>Thank you. Your credentials have been submitted for VIP access.</span>
            </div>
          ) : (
            <form
              onSubmit={handleVipSubmit}
              className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto pt-2"
            >
              <input
                type="email"
                required
                value={vipEmail}
                onChange={(e) => setVipEmail(e.target.value)}
                placeholder="YOUR WORK OR PERSONAL EMAIL..."
                className="w-full sm:flex-1 px-4 py-3 bg-white/90 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-zinc-950 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-600 text-xs uppercase tracking-widest rounded-sm focus:outline-none focus:border-zinc-950 dark:focus:border-white transition-colors shadow-sm"
              />
              <button
                type="submit"
                className="w-full sm:w-auto px-6 py-3 bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 text-xs font-semibold uppercase tracking-[0.2em] rounded-sm transition-colors shrink-0 shadow-sm"
              >
                Join VIP
              </button>
            </form>
          )}
        </div>
      </section>

      {/* ── Quick View Modal ── */}
      <ProductQuickViewModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />
    </div>
  );
};
