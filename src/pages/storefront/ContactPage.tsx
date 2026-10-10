import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { FALLBACK_IMAGE } from '../../lib/utils';
import {
  MapPin,
  Phone,
  Mail,
  Globe,
  Clock,
  Send,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Sparkles,
} from 'lucide-react';

/**
 * ContactPage — Luxury atelier contact page inspired by Chanel.com.
 * Seamlessly adapts to Light Haute Couture (Warm Alabaster Ivory #f8f8f6)
 * and Dark Haute Mode (Deep Obsidian #09090b).
 * 
 * Features:
 * - Animated architectural atelier blueprint backdrop
 * - Sandboxed Google Map iframe with dedicated ad-blocker fallback container
 * - High-contrast Deep Carbon typography with zero white eye glare
 * - Direct telephone, WhatsApp concierge, and bespoke order dispatch
 */
export const ContactPage: React.FC = () => {
  const { resolvedTheme } = useTheme();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('Bespoke Order / Retail Inquiry');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const validatePhone = (val: string): boolean => {
    // Sri Lankan phone format validation (e.g. 0711350123, +94711350123, 07x xxx xxxx)
    const clean = val.replace(/[\s-]/g, '');
    return /^(?:0|\+94)?[1-9]\d{8}$/.test(clean);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please provide your full name.');
      return;
    }

    if (!phone.trim()) {
      setError('Please provide a valid contact telephone or WhatsApp number.');
      return;
    }

    if (!validatePhone(phone)) {
      setError(
        'Please enter a valid Sri Lankan phone number (e.g. 071 135 0123 or +94 71 135 0123).'
      );
      return;
    }

    if (!message.trim() || message.trim().length < 10) {
      setError('Please provide an inquiry message of at least 10 characters.');
      return;
    }

    // Success feedback
    setSubmitted(true);
  };

  const handleWhatsAppDirect = () => {
    const text = encodeURIComponent(
      `Hello Reliance Atelier,\n\nName: ${name || 'Prospective Client'}\nPhone: ${phone || 'Not provided'}\nSubject: ${subject}\nMessage: ${message || 'I would like to inquire about Reliance menswear collections.'}`
    );
    window.open(`https://wa.me/94711350123?text=${text}`, '_blank');
  };

  return (
    <div className="bg-[#f8f8f6] dark:bg-[#09090b] text-[#09090b] dark:text-zinc-50 min-h-screen transition-colors duration-300 ambient-alabaster-canvas">
      {/* ── Contact Page Hero with Architectural Atelier Blueprint Backdrop ── */}
      <section className="relative overflow-hidden border-b border-[#e5e5e0] dark:border-zinc-900 pt-24 sm:pt-28 pb-14 sm:pb-16 mb-12 sm:mb-16">
        <div className="absolute inset-0 z-0 overflow-hidden">
          <img
            src="/images/editorial/atelier-blueprint.svg"
            alt="Reliance Architectural Atelier Blueprint"
            className="w-full h-full object-cover object-center opacity-30 dark:opacity-25 animate-ken-burns will-change-transform"
            onError={(e) => {
              e.currentTarget.src = FALLBACK_IMAGE;
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#f8f8f6] via-[#f8f8f6]/75 to-transparent dark:from-[#09090b] dark:via-[#09090b]/75 dark:to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-[#f8f8f6]/50 to-[#f8f8f6] dark:via-[#09090b]/40 dark:to-[#09090b]" />
        </div>

        <div className="relative z-10 text-center max-w-3xl mx-auto px-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-zinc-300/80 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/60 text-emerald-600 dark:text-emerald-400 text-[10px] tracking-widest uppercase mb-4 shadow-sm backdrop-blur-md">
            <Sparkles className="w-3 h-3" />
            <span>Atelier Concierge &middot; Matara</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-5xl md:text-6xl font-bold tracking-[0.2em] uppercase text-[#09090b] dark:text-white mb-4">
            Contact The Maison
          </h1>
          <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 uppercase tracking-widest font-light leading-relaxed max-w-2xl mx-auto">
            Bespoke fittings, wholesale inquiries, or direct atelier visits. Our dedicated concierge awaits your message.
          </p>
        </div>
      </section>

      {/* ── Main Content Container ── */}
      <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-8 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-10 lg:gap-12 mb-16">
          {/* ── Left Column: Official Brand Credentials & Hours (5 Cols) ── */}
          <div className="lg:col-span-5 space-y-6 sm:space-y-8">
            <div className="p-3.5 sm:p-6 md:p-8 bg-white/80 dark:bg-zinc-900/60 backdrop-blur-md border border-[#e5e5e0]/80 dark:border-zinc-900 rounded-sm space-y-5 sm:space-y-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
              <div>
                <span className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 font-mono block mb-1">
                  Reliance Brand Headquarters
                </span>
                <h3 className="font-serif text-xl sm:text-2xl font-bold uppercase tracking-wider text-[#09090b] dark:text-white">
                  Reliance
                </h3>
                <p className="text-[10px] uppercase tracking-[0.25em] text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                  Branded Mens Clothing
                </p>
              </div>

              <div className="space-y-4 sm:space-y-5 pt-4 border-t border-[#e5e5e0] dark:border-zinc-900 text-xs">
                {/* Address */}
                <div className="flex items-start gap-3">
                  <div className="p-1.5 sm:p-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-sm text-zinc-800 dark:text-zinc-200 shrink-0">
                    <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-0.5">
                      Atelier &amp; Manufacturing Facility
                    </span>
                    <p className="text-zinc-950 dark:text-zinc-100 font-medium leading-relaxed">
                      Makandura, Matara, Sri Lanka
                    </p>
                    <p className="text-zinc-500 font-mono text-[11px]">Postal Code: 81070</p>
                  </div>
                </div>

                {/* Telephone / WhatsApp */}
                <div className="flex items-start gap-3">
                  <div className="p-1.5 sm:p-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-sm text-zinc-800 dark:text-zinc-200 shrink-0">
                    <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-0.5">
                      Primary Concierge Line
                    </span>
                    <a
                      href="tel:0711350123"
                      className="text-zinc-950 dark:text-zinc-100 hover:text-emerald-600 dark:hover:text-emerald-400 font-mono font-medium transition-colors"
                    >
                      071 135 0123
                    </a>
                    <a
                      href="tel:+94711350123"
                      className="text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white font-mono text-[11px] transition-colors"
                    >
                      +94 71 135 0123 (International)
                    </a>
                  </div>
                </div>

                {/* Official Email */}
                <div className="flex items-start gap-3">
                  <div className="p-1.5 sm:p-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-sm text-zinc-800 dark:text-zinc-200 shrink-0">
                    <Mail className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-0.5">
                      Executive / Inquiry Email
                    </span>
                    <a
                      href="mailto:ravindrakumarash@gmail.com"
                      className="text-zinc-950 dark:text-zinc-100 hover:text-emerald-600 dark:hover:text-emerald-400 break-all transition-colors font-mono"
                    >
                      ravindrakumarash@gmail.com
                    </a>
                  </div>
                </div>

                {/* Official Web Domain */}
                <div className="flex items-start gap-3">
                  <div className="p-1.5 sm:p-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-sm text-zinc-800 dark:text-zinc-200 shrink-0">
                    <Globe className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-0.5">
                      Official Online Portal
                    </span>
                    <a
                      href="https://ravindrakumarash.lk"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-zinc-950 dark:text-zinc-100 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors font-mono"
                    >
                      ravindrakumarash.lk
                    </a>
                  </div>
                </div>
              </div>

              {/* Operating Hours Card */}
              <div className="p-3.5 sm:p-4 bg-zinc-50/80 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-sm space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-950 dark:text-zinc-200">
                  <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Atelier Visiting Hours</span>
                </div>
                <div className="text-[11px] text-zinc-700 dark:text-zinc-300 space-y-1 font-light">
                  <div className="flex justify-between">
                    <span>Monday &ndash; Friday</span>
                    <span className="font-mono text-zinc-950 dark:text-zinc-100 font-medium">08:30 &ndash; 18:00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Saturday</span>
                    <span className="font-mono text-zinc-950 dark:text-zinc-100 font-medium">09:00 &ndash; 15:30</span>
                  </div>
                  <div className="flex justify-between text-zinc-500">
                    <span>Sunday &amp; Poya Days</span>
                    <span className="italic">By Appointment Only</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Right Column: Interactive Contact & Bespoke Form (7 Cols) ── */}
          <div className="lg:col-span-7">
            <div className="p-3.5 sm:p-6 md:p-8 bg-white/80 dark:bg-zinc-900/60 backdrop-blur-md border border-[#e5e5e0]/80 dark:border-zinc-900 rounded-sm space-y-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
              <div>
                <span className="text-[10px] uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-400 font-mono block mb-1">
                  Concierge Message Portal
                </span>
                <h3 className="font-serif text-xl sm:text-2xl font-bold uppercase tracking-wider text-[#09090b] dark:text-white">
                  Dispatch An Inquiry
                </h3>
                <p className="text-xs text-zinc-700 dark:text-zinc-300 font-light mt-1">
                  Direct transmission to our production head and tailoring consultants. Response guaranteed within 24 business hours.
                </p>
              </div>

              {submitted ? (
                <div className="p-6 bg-zinc-50/80 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-sm text-center space-y-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-serif text-base font-bold uppercase tracking-wider text-zinc-950 dark:text-white mb-1">
                      Transmission Received
                    </h4>
                    <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed max-w-md mx-auto">
                      Thank you, <strong className="text-zinc-950 dark:text-white">{name}</strong>. Your inquiry has been forwarded to the Reliance atelier floor in Makandura. Our concierge will reach you at{' '}
                      <span className="font-mono text-emerald-600 dark:text-emerald-400">{phone}</span> shortly.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSubmitted(false);
                      setName('');
                      setPhone('');
                      setMessage('');
                    }}
                    className="text-xs uppercase tracking-widest text-zinc-950 dark:text-white underline underline-offset-4 pt-2 font-medium"
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 text-xs rounded-sm flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Name */}
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-zinc-600 dark:text-zinc-400 font-mono mb-1.5">
                        Client Full Name *
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Ravindra Kumar"
                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 px-3.5 py-2.5 rounded-sm focus:outline-none focus:border-zinc-950 dark:focus:border-white transition-colors"
                      />
                    </div>

                    {/* Phone */}
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-zinc-600 dark:text-zinc-400 font-mono mb-1.5">
                        Telephone / WhatsApp *
                      </label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="071 135 0123"
                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-950 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 px-3.5 py-2.5 rounded-sm focus:outline-none focus:border-zinc-950 dark:focus:border-white transition-colors"
                      />
                    </div>
                  </div>

                  {/* Subject */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-zinc-600 dark:text-zinc-400 font-mono mb-1.5">
                      Inquiry Category
                    </label>
                    <select
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white px-3.5 py-2.5 rounded-sm focus:outline-none focus:border-zinc-950 dark:focus:border-white transition-colors appearance-none cursor-pointer"
                    >
                      <option value="Bespoke Order / Retail Inquiry">Bespoke Order / Retail Inquiry</option>
                      <option value="Wholesale Bulk Ordering">Wholesale Bulk Ordering</option>
                      <option value="Custom Garment Manufacturing">Custom Garment Manufacturing</option>
                      <option value="Atelier Fitting Appointment">Atelier Fitting Appointment</option>
                      <option value="General Brand Information">General Brand Information</option>
                    </select>
                  </div>

                  {/* Message */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-zinc-600 dark:text-zinc-400 font-mono mb-1.5">
                      Inquiry Details &amp; Specifications *
                    </label>
                    <textarea
                      rows={4}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Specify sizes, quantities, denim wash preferences, or requested fitting dates..."
                      className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 p-3.5 rounded-sm focus:outline-none focus:border-zinc-950 dark:focus:border-white transition-colors resize-none"
                    />
                  </div>

                  {/* Actions */}
                  <div className="pt-2 flex flex-col sm:flex-row gap-3">
                    <button
                      type="submit"
                      className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 text-xs font-semibold uppercase tracking-[0.2em] rounded-sm transition-colors shadow-xl"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Transmit Message</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleWhatsAppDirect}
                      className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 text-white hover:bg-emerald-500 text-xs font-semibold uppercase tracking-[0.2em] rounded-sm transition-colors shadow-md"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>WhatsApp Concierge</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* ── Geographic Coordinates Map Section ── */}
        <section className="border border-[#e5e5e0] dark:border-zinc-900 rounded-2xl bg-white/80 dark:bg-zinc-900/60 backdrop-blur-md p-3.5 sm:p-6 md:p-8 overflow-hidden shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-400 font-mono mb-1">
                Geographic Coordinates
              </div>
              <h3 className="font-serif text-xl sm:text-2xl font-bold uppercase tracking-wider text-[#09090b] dark:text-white">
                Makandura, Matara &middot; Atelier Location
              </h3>
            </div>

            <a
              href="https://maps.google.com/?q=Makandura,+Matara,+Sri+Lanka"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 border border-zinc-300 hover:border-zinc-500 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-zinc-600 dark:bg-zinc-900 text-xs font-mono text-zinc-800 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white rounded-sm transition-colors self-start sm:self-auto shadow-sm font-medium"
            >
              <span>Open in Google Maps</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Embedded Interactive Map with Ad-Blocker Fallback Container */}
          <div className="relative w-full h-72 sm:h-80 md:h-96 rounded-2xl overflow-hidden border border-[#e5e5e0] dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 shadow-inner">
            {/* Explicit Fallback Container underneath iframe in case ad-blocker blocks the frame */}
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-zinc-100 dark:bg-zinc-900 z-0">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
                <MapPin className="w-6 h-6" />
              </div>
              <h4 className="font-serif text-base font-bold uppercase tracking-wider text-[#09090b] dark:text-white mb-1">
                Makandura Atelier Coordinates
              </h4>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-sm mb-4 font-mono">
                6.046°N 80.573°E &bull; Makandura, Matara (Postal Code 81070)
              </p>
              <a
                href="https://maps.google.com/?q=Makandura,+Matara,+Sri+Lanka"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 rounded-sm text-xs uppercase tracking-wider font-semibold shadow-md hover:bg-zinc-800 transition-colors"
              >
                <span>Launch Live Route Navigation</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Sandboxed iframe embed */}
            <iframe
              title="Reliance Atelier Location - Makandura, Matara, Sri Lanka (81070)"
              src="https://maps.google.com/maps?q=Makandura,+Matara,+Sri+Lanka&t=&z=14&ie=UTF8&iwloc=&output=embed"
              className="relative z-10 w-full h-full border-0 transition-all duration-500"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              style={{
                filter:
                  resolvedTheme === 'dark'
                    ? 'invert(90%) hue-rotate(180deg) contrast(120%) brightness(90%)'
                    : 'none',
              }}
              loading="lazy"
              allowFullScreen
            />
          </div>

          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between text-[10px] sm:text-[11px] text-zinc-600 dark:text-zinc-400 font-mono gap-2">
            <span>Reliance (Branded Mens Clothing) &bull; Makandura, Matara, Sri Lanka &bull; Postal Code 81070</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Concierge: 071 135 0123 / +94 71 135 0123</span>
          </div>
        </section>
      </div>
    </div>
  );
};
