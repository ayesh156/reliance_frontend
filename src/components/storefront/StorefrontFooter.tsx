import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin,
  Phone,
  Mail,
  Globe,
  ArrowRight,
  Shield,
  CheckCircle2,
  Lock,
} from 'lucide-react';

/**
 * StorefrontFooter — Luxury fashion footer.
 * Harmoniously shifts between sleek alabaster ivory in light mode
 * and deep haute obsidian in dark mode.
 */
export const StorefrontFooter: React.FC = () => {
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (newsletterEmail.trim()) {
      setSubscribed(true);
      setNewsletterEmail('');
    }
  };

  return (
    <footer className="bg-zinc-100 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border-t border-zinc-200 dark:border-zinc-900 font-sans transition-colors duration-300">
      {/* ── Top Haute Couture Newsletter Bar ── */}
      <div className="border-b border-zinc-200 dark:border-zinc-900 py-12 px-4 sm:px-6 lg:px-8 bg-zinc-50/50 dark:bg-zinc-950/60">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left max-w-xl">
            <h4 className="text-xs uppercase tracking-[0.3em] font-semibold text-zinc-950 dark:text-zinc-200 mb-2 font-serif">
              The Reliance Gazette &amp; VIP Circle
            </h4>
            <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed font-light">
              Receive private invitations to seasonal capsule drops, bespoke tailoring previews, and wholesale collection catalogs.
            </p>
          </div>

          <div className="w-full md:w-auto">
            {subscribed ? (
              <div className="flex items-center gap-2.5 px-5 py-3 rounded-sm bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-emerald-600 dark:text-emerald-400 text-xs tracking-wider shadow-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                <span>You have been registered for Reliance VIP access.</span>
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="flex max-w-md w-full gap-2">
                <input
                  type="email"
                  required
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder="ENTER YOUR EMAIL..."
                  className="bg-white dark:bg-zinc-900/90 border border-zinc-300 dark:border-zinc-800 text-zinc-950 dark:text-zinc-100 placeholder-zinc-500 dark:placeholder-zinc-600 px-4 py-2.5 text-xs uppercase tracking-widest rounded-sm focus:outline-none focus:border-zinc-950 dark:focus:border-white transition-colors flex-1 shadow-sm"
                />
                <button
                  type="submit"
                  className="bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] rounded-sm transition-colors shrink-0 flex items-center gap-1.5 shadow-sm"
                >
                  <span>Subscribe</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* ── Main Multi-Column Links & Brand Data ── */}
      <div className="max-w-7xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8">
          {/* Col 1: Brand Atelier */}
          <div className="lg:col-span-2 space-y-4">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-sm bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 overflow-hidden flex items-center justify-center shadow-sm">
                <img
                  src="/images/logo.jpg"
                  alt="Reliance"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
              <div>
                <span className="font-serif text-base font-bold tracking-[0.25em] text-zinc-950 dark:text-white uppercase block">
                  RELIANCE
                </span>
                <span className="text-[8px] tracking-[0.3em] text-zinc-500 dark:text-zinc-400 uppercase block font-light">
                  Branded Mens Clothing
                </span>
              </div>
            </Link>

            <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed font-light max-w-sm pt-2">
              Bespoke Sri Lankan tailoring and high-grade industrial menswear manufacturing. Master cutting, ethical production, and timeless masculine silhouettes crafted in the heart of Makandura, Matara.
            </p>

            <div className="pt-2 flex items-center gap-3">
              <Link
                to="/system"
                className="inline-flex items-center gap-1.5 text-[11px] text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white uppercase tracking-widest border border-zinc-300 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900/60 px-3 py-1.5 rounded-sm transition-colors shadow-sm"
              >
                <Lock className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>Enterprise Portal Access</span>
              </Link>
            </div>
          </div>

          {/* Col 2: Collections */}
          <div>
            <h5 className="text-[11px] uppercase tracking-[0.25em] font-semibold text-zinc-950 dark:text-zinc-200 mb-4 font-serif">
              Collections
            </h5>
            <ul className="space-y-2.5 text-xs font-light">
              <li>
                <Link to="/shop" className="text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white transition-colors">
                  A/W Denim Trouser Series
                </Link>
              </li>
              <li>
                <Link to="/shop" className="text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white transition-colors">
                  Patch Short Edition
                </Link>
              </li>
              <li>
                <Link to="/shop" className="text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white transition-colors">
                  Big Fold Regular Trousers
                </Link>
              </li>
              <li>
                <Link to="/shop" className="text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white transition-colors">
                  Jogger Denim Cuts
                </Link>
              </li>
              <li>
                <Link to="/shop" className="text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white transition-colors">
                  Wholesale Bulk Catalog
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Maison & Heritage */}
          <div>
            <h5 className="text-[11px] uppercase tracking-[0.25em] font-semibold text-zinc-950 dark:text-zinc-200 mb-4 font-serif">
              The Maison
            </h5>
            <ul className="space-y-2.5 text-xs font-light">
              <li>
                <Link to="/about" className="text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white transition-colors">
                  Brand Heritage
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white transition-colors">
                  Bespoke Craftsmanship
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white transition-colors">
                  Ethical Scrap Recovery
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white transition-colors">
                  Matara Atelier Directions
                </Link>
              </li>
              <li>
                <Link to="/login" className="text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white transition-colors">
                  Staff Login Portal
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Atelier Credentials & Contact */}
          <div>
            <h5 className="text-[11px] uppercase tracking-[0.25em] font-semibold text-zinc-950 dark:text-zinc-200 mb-4 font-serif">
              Atelier &amp; Contact
            </h5>
            <div className="space-y-3 text-xs font-light">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 shrink-0 mt-0.5" />
                <span className="text-zinc-800 dark:text-zinc-200">
                  Makandura, Matara, Sri Lanka, 81070
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <Phone className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 shrink-0" />
                <div className="flex flex-col">
                  <a
                    href="tel:0711350123"
                    className="text-zinc-800 hover:text-zinc-950 dark:text-zinc-200 dark:hover:text-white transition-colors"
                  >
                    071 135 0123
                  </a>
                  <a
                    href="tel:+94711350123"
                    className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-white transition-colors text-[11px]"
                  >
                    +94 71 135 0123
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <Mail className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 shrink-0" />
                <a
                  href="mailto:ravindrakumarash@gmail.com"
                  className="text-zinc-800 hover:text-zinc-950 dark:text-zinc-200 dark:hover:text-white transition-colors break-all"
                >
                  ravindrakumarash@gmail.com
                </a>
              </div>

              <div className="flex items-center gap-2.5">
                <Globe className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 shrink-0" />
                <a
                  href="https://ravindrakumarash.lk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-800 hover:text-zinc-950 dark:text-zinc-200 dark:hover:text-white transition-colors"
                >
                  ravindrakumarash.lk
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Legal & System Invariant ── */}
      <div className="border-t border-zinc-200 dark:border-zinc-900/80 py-6 px-4 sm:px-6 lg:px-8 bg-zinc-200/60 dark:bg-black">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] uppercase tracking-widest text-zinc-600 dark:text-zinc-400">
          <div>
            &copy; {new Date().getFullYear()} Reliance (Branded Mens Clothing). All Rights Reserved.
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
              <Shield className="w-3 h-3 text-emerald-600 dark:text-emerald-500" />
              <span>Enterprise POS / ERP Secured</span>
            </span>
            <span className="text-zinc-400 dark:text-zinc-800">|</span>
            <Link to="/system" className="hover:text-zinc-950 dark:hover:text-zinc-300">
              System Gateway
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
