import React from 'react';
import { Link } from 'react-router-dom';
import { FALLBACK_IMAGE } from '../../lib/utils';
import {
  Sparkles,
  Scissors,
  Compass,
  Layers,
  ShieldCheck,
  Award,
  ArrowRight,
  MapPin,
  CheckCircle2,
} from 'lucide-react';

/**
 * AboutPage — Brand heritage narrative with denim & t-shirt editorial imagery.
 * Fully adapts between Parisian Gallery Light Haute Couture (Warm Alabaster Ivory #f8f8f6)
 * and Dark Haute Mode (Deep Obsidian #09090b).
 * 
 * Features:
 * - Animated selvedge loom machinery and heavyweight cotton hero backdrop
 * - Zero external 404/403 console errors via local editorial assets
 * - High-contrast Deep Carbon typography with zero white eye glare
 * - Comprehensive atelier storytelling and values
 */
export const AboutPage: React.FC = () => {
  return (
    <div className="bg-[#f8f8f6] dark:bg-[#09090b] text-[#09090b] dark:text-zinc-50 overflow-hidden transition-colors duration-300 ambient-alabaster-canvas min-h-screen">
      {/* ── 1. Hero Brand Narrative — Animated Textile Loom Background ── */}
      <section className="relative pt-24 sm:pt-28 pb-20 sm:pb-24 border-b border-[#e5e5e0] dark:border-zinc-900 overflow-hidden">
        {/* Subtle Ambient Loom & Weave Background */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <img
            src="/images/editorial/loom-craft.jpg"
            alt="Raw Selvedge Loom Weaving Machinery and Heavyweight Cotton Craft"
            className="w-full h-full object-cover opacity-25 dark:opacity-20 filter contrast-125 dark:contrast-150 animate-ken-burns will-change-transform"
            onError={(e) => {
              e.currentTarget.src = FALLBACK_IMAGE;
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#f8f8f6] via-[#f8f8f6]/80 to-transparent dark:from-[#09090b] dark:via-[#09090b]/80 dark:to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-[#f8f8f6]/50 to-[#f8f8f6] dark:via-[#09090b]/40 dark:to-[#09090b]" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-zinc-300/80 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 text-emerald-600 dark:text-emerald-400 text-[10px] tracking-widest uppercase mb-6 shadow-sm backdrop-blur-md">
            <Sparkles className="w-3 h-3" />
            <span>Maison Heritage · Makandura, Matara</span>
          </div>

          <h1 className="font-serif text-3xl sm:text-5xl md:text-6xl font-bold tracking-[0.2em] uppercase text-[#09090b] dark:text-white leading-tight mb-6">
            The Reliance Saga
          </h1>

          <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 uppercase tracking-[0.25em] font-light max-w-2xl mx-auto leading-relaxed">
            From the historic artisan workshops of the Southern Province to a leading denim and heavyweight tee manufacturing powerhouse.
          </p>
        </div>
      </section>

      {/* ── 2. Brand Story & Heritage — Denim & Tee Editorial ── */}
      <section className="py-20 sm:py-28 px-2 sm:px-4 md:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Text Editorial */}
          <div className="space-y-6">
            <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-600 dark:text-zinc-400 font-mono">
              Manufacturing Heritage &middot; Est. Matara
            </div>

            <h2 className="font-serif text-2xl sm:text-4xl font-bold tracking-[0.16em] uppercase text-[#09090b] dark:text-white leading-snug">
              Selvedge Soul.<br />Heavyweight Heart.
            </h2>

            <div className="space-y-4 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 font-light leading-relaxed">
              <p>
                Founded in Makandura, Matara (Postal Code 81070), <strong className="font-semibold text-zinc-950 dark:text-zinc-100">Reliance</strong> was established to bridge the precision of bespoke tailoring with the scalability of contemporary denim and t-shirt manufacturing.
              </p>
              <p>
                What began as specialized pattern cutting for custom menswear has expanded into an integrated denim house and branded t-shirt production facility. We design, cut, wash, and finish each piece in-house—ensuring complete command over every selvedge edge, rinse treatment, and heavyweight cotton construction.
              </p>
              <p>
                Today, our flagship collections—spanning raw selvedge denim joggers, washed denim shorts, architectural big-fold trousers, and premium graphic heavyweight tees—serve discerning individual clients and wholesale boutiques nationwide.
              </p>
            </div>

            <div className="pt-4 flex items-center gap-6 border-t border-[#e5e5e0] dark:border-zinc-900">
              <div className="flex items-center gap-2 text-xs font-mono text-zinc-800 dark:text-zinc-300">
                <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Makandura, Matara (81070)</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-zinc-800 dark:text-zinc-300">
                <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>100% Sri Lankan Owned</span>
              </div>
            </div>
          </div>

          {/* Right: Denim & Tee Imagery Display */}
          <div className="relative">
            <div className="relative aspect-[4/5] rounded-sm overflow-hidden border border-[#e5e5e0] dark:border-zinc-800 shadow-2xl">
              <img
                src="/images/editorial/denim-workshop.jpg"
                alt="Artisan Selvedge Denim Manufacturing"
                className="w-full h-full object-cover filter contrast-115 brightness-95 dark:brightness-90 animate-ken-burns will-change-transform"
                onError={(e) => {
                  e.currentTarget.src = FALLBACK_IMAGE;
                }}
              />
            </div>
            {/* Floating Luxury Spec Badge */}
            <div className="absolute -bottom-6 -left-6 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border border-[#e5e5e0] dark:border-zinc-700 p-5 rounded-sm shadow-2xl max-w-xs hidden sm:block">
              <div className="flex items-center gap-2 text-xs font-serif font-bold text-zinc-950 dark:text-white uppercase tracking-wider mb-1">
                <Scissors className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Selvedge Archive Quality</span>
              </div>
              <p className="text-[10px] text-zinc-700 dark:text-zinc-300 leading-normal font-mono">
                12oz+ raw and washed denim with industrial tensioned lockstitching and hand-pressed edge finishes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. The Three Foundational Values ── */}
      <section className="border-t border-[#e5e5e0] dark:border-zinc-900 bg-white/50 dark:bg-zinc-950/60 py-20 sm:py-28 px-2 sm:px-4 md:px-8 transition-colors">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="text-[10px] uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-400 font-mono mb-2">
              Our Ethos
            </div>
            <h2 className="font-serif text-2xl sm:text-4xl font-bold tracking-[0.18em] uppercase text-[#09090b] dark:text-white">
              The Three Guiding Values
            </h2>
            <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 uppercase tracking-widest mt-2 font-light">
              Principles informing every garment leaving our Matara facility
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-8">
            {/* Value 1 */}
            <div className="p-6 sm:p-8 bg-white/80 dark:bg-zinc-900/60 backdrop-blur-md border border-[#e5e5e0]/80 dark:border-zinc-800/80 rounded-sm hover:border-zinc-400 dark:hover:border-zinc-700 transition-colors space-y-4 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_10px_25px_-5px_rgba(0,0,0,0.08)]">
              <div className="w-10 h-10 rounded-sm bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Compass className="w-5 h-5" />
              </div>
              <h3 className="font-serif text-lg font-bold uppercase tracking-wider text-[#09090b] dark:text-white">
                1. Precision Tailoring
              </h3>
              <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed font-light">
                We reject fast-fashion shortcuts. From the rise of the waistband to the taper of the ankle hem, every proportion is drafted with geometric accuracy. Patterns are verified across physical fit models before entering production.
              </p>
            </div>

            {/* Value 2 */}
            <div className="p-6 sm:p-8 bg-white/80 dark:bg-zinc-900/60 backdrop-blur-md border border-[#e5e5e0]/80 dark:border-zinc-800/80 rounded-sm hover:border-zinc-400 dark:hover:border-zinc-700 transition-colors space-y-4 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_10px_25px_-5px_rgba(0,0,0,0.08)]">
              <div className="w-10 h-10 rounded-sm bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-serif text-lg font-bold uppercase tracking-wider text-[#09090b] dark:text-white">
                2. Ethical Production &amp; Scrap Recovery
              </h3>
              <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed font-light">
                Our manufacturing floor strictly upholds worker well-being, dignified compensation, and zero fabric squandering. Powered by proprietary ERP inventory algorithms, all leftover textile cuttings are tracked and redirected into secondary items.
              </p>
            </div>

            {/* Value 3 */}
            <div className="p-6 sm:p-8 bg-white/80 dark:bg-zinc-900/60 backdrop-blur-md border border-[#e5e5e0]/80 dark:border-zinc-800/80 rounded-sm hover:border-zinc-400 dark:hover:border-zinc-700 transition-colors space-y-4 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_10px_25px_-5px_rgba(0,0,0,0.08)]">
              <div className="w-10 h-10 rounded-sm bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="font-serif text-lg font-bold uppercase tracking-wider text-[#09090b] dark:text-white">
                3. Denim & Tee Aesthetic
              </h3>
              <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed font-light">
                Menswear must balance poise with dynamic mobility. Our denim silhouettes and heavyweight cotton tees adapt seamlessly from tropical urban streetwear to refined casual settings—engineered to endure repeat laundering without losing structural integrity.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Manufacturing Facility — Denim & Tee Production ── */}
      <section className="py-20 sm:py-28 px-2 sm:px-4 md:px-8 max-w-7xl mx-auto border-t border-[#e5e5e0] dark:border-zinc-900">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Visual Showcase — Denim & Tee Manufacturing */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="aspect-[3/4] rounded-sm overflow-hidden border border-[#e5e5e0] dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 shadow-sm">
              <img
                src="/images/editorial/denim-wash.jpg"
                alt="Denim Wash Treatment Process"
                className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                onError={(e) => {
                  e.currentTarget.src = FALLBACK_IMAGE;
                }}
              />
            </div>
            <div className="aspect-[3/4] rounded-sm overflow-hidden border border-[#e5e5e0] dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 mt-8 shadow-sm">
              <img
                src="/images/editorial/heavyweight-tee.jpg"
                alt="Premium Heavyweight T-Shirt Production"
                className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                onError={(e) => {
                  e.currentTarget.src = FALLBACK_IMAGE;
                }}
              />
            </div>
          </div>

          {/* Facility Highlights */}
          <div className="space-y-6">
            <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-600 dark:text-zinc-400 font-mono">
              Facility Capabilities
            </div>

            <h2 className="font-serif text-2xl sm:text-4xl font-bold tracking-[0.16em] uppercase text-[#09090b] dark:text-white leading-snug">
              From Raw Textile to Runway Perfection
            </h2>

            <div className="space-y-4">
              {[
                {
                  title: 'Raw Material Quarantine & Inspection',
                  desc: 'All purchased bolts of denim, heavyweight cotton, pocketings, and thread undergo tensile testing and shrinkage analysis.',
                },
                {
                  title: 'High-Precision Cutting Tables',
                  desc: 'Multi-layer mechanical fabric spreaders and precision electric cutters ensure identical dimensional repeatability.',
                },
                {
                  title: 'Comprehensive Quality Checkpoints',
                  desc: 'Four-stage visual inspection covering stitch density, bar-tack security, zipper alignment, and seam symmetry.',
                },
              ].map((item, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3.5 sm:p-4 bg-white/80 dark:bg-zinc-900/60 backdrop-blur-md border border-[#e5e5e0]/80 dark:border-zinc-800/80 rounded-sm shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-[#09090b] dark:text-white mb-1">
                      {item.title}
                    </h4>
                    <p className="text-[11px] text-zinc-700 dark:text-zinc-300 font-light leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2">
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 text-xs font-semibold uppercase tracking-[0.2em] rounded-sm transition-colors shadow-xl"
              >
                <span>Visit The Matara Atelier</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
